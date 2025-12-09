import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';

/**
 * WorkspaceContext - Global state management for the entire application
 *
 * Features:
 * - Persists across page navigation
 * - Auto-saves to database
 * - LocalStorage backup for instant recovery
 * - Syncs across tabs
 */

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

interface CodeError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'type' | 'import' | 'runtime' | 'build' | 'other';
  suggestion?: string;
  fixable: boolean;
}

interface ErrorSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  fixable: number;
}

interface BrowserAnalysisData {
  url: string;
  viewport: { width: number; height: number };
  issuesFound: number;
  issues: Array<{
    type: 'layout' | 'css' | 'responsive' | 'accessibility' | 'performance' | 'visual';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    element?: string;
    suggestion?: string;
  }>;
  metrics?: {
    loadTime: string;
    firstContentfulPaint?: string;
  };
  accessibility?: {
    score: number;
    violations: number;
  };
  summary: string;
  screenshot?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files?: GeneratedFile[];
  errors?: CodeError[];
  warnings?: CodeError[];
  errorSummary?: ErrorSummary;
  browserAnalysis?: BrowserAnalysisData;
}

interface WorkspaceSession {
  id: string;
  name: string;
  type: 'playground' | 'assistant';
  createdAt: number;
  updatedAt: number;
  chatHistory: ChatMessage[];
  generatedFiles: GeneratedFile[];
  currentPrompt?: string;
  metadata?: Record<string, any>;
}

type PlaygroundAction =
  | { type: 'runPrompt'; prompt: string; metadata?: Record<string, any> }
  | { type: 'applyCode'; files: Array<{ path: string; content: string }>; metadata?: Record<string, any> }
  | { type: 'restartDevServer'; metadata?: Record<string, any> };

type PlaygroundActionListener = (action: PlaygroundAction) => void;

interface WorkspaceContextType {
  // Current active session
  currentSession: WorkspaceSession | null;

  // All user sessions
  sessions: WorkspaceSession[];
  sessionsInitialized: boolean;

  // Session management
  createSession: (type: 'playground' | 'assistant', name?: string, metadata?: Record<string, any>) => WorkspaceSession;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;

  // Chat management
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  // File management
  updateGeneratedFiles: (files: GeneratedFile[]) => void;
  addGeneratedFile: (file: GeneratedFile) => void;

  // Metadata management
  updateMetadata: (metadata: Record<string, any>) => void;

  // Prompt forwarding (OmniAssistant → Playground)
  setPendingPrompt: (prompt: string, source: string, metadata?: Record<string, any>) => void;
  getPendingPrompt: () => { prompt: string; timestamp: number; source: string; metadata?: Record<string, any> } | null;
  clearPendingPrompt: () => void;

  // Cross-component action bridge (OmniAssistant -> Playground)
  registerPlaygroundActionListener: (listener: PlaygroundActionListener) => () => void;
  dispatchPlaygroundAction: (action: PlaygroundAction) => void;

  // Auto-save status
  isSaving: boolean;
  lastSaved: Date | null;

  // Sync status
  syncWithServer: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'ai-library-workspace';
const PENDING_PROMPT_TTL = 2 * 60 * 1000; // 2 minutes
const AUTOSAVE_INTERVAL = 30000; // 30 seconds (increased to reduce rate limit issues)
const MAX_LOCALSTORAGE_SIZE = 4 * 1024 * 1024; // 4MB (typical limit is 5-10MB, leave buffer)
const MAX_CHAT_HISTORY_LOCAL = 50; // Only keep last 50 messages in localStorage
const MAX_SESSIONS_LOCAL = 10; // Only keep last 10 sessions in localStorage

/**
 * Compress session data for localStorage by removing large/unnecessary data
 */
function compressSessionForLocalStorage(session: WorkspaceSession): WorkspaceSession {
  // Remove screenshots and other large data from browser analysis
  const compressedChatHistory = session.chatHistory
    .slice(-MAX_CHAT_HISTORY_LOCAL) // Only keep last N messages
    .map(msg => {
      if (msg.browserAnalysis) {
        // Remove screenshot (can be very large)
        const { screenshot, ...analysisWithoutScreenshot } = msg.browserAnalysis;
        return {
          ...msg,
          browserAnalysis: analysisWithoutScreenshot
        };
      }
      return msg;
    });

  return {
    ...session,
    chatHistory: compressedChatHistory,
    // Don't store generated files in localStorage (they're on the server)
    generatedFiles: []
  };
}

/**
 * Clean up old sessions, keeping only the most recent ones
 */
function cleanupOldSessions(sessions: WorkspaceSession[]): WorkspaceSession[] {
  // Sort by updatedAt descending and keep only the most recent
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, MAX_SESSIONS_LOCAL);
}

/**
 * Safely save to localStorage with quota error handling
 */
function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    // Check size before attempting to save
    const size = new Blob([value]).size;
    if (size > MAX_LOCALSTORAGE_SIZE) {
      console.warn(`Data too large for localStorage (${(size / 1024 / 1024).toFixed(2)}MB), compressing...`);
      return false;
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, attempting cleanup...');
      
      // Try to free up space by removing old workspace data
      try {
        const keys = Object.keys(localStorage);
        const workspaceKeys = keys.filter(k => k.startsWith(STORAGE_KEY));
        
        // Remove oldest workspace data
        for (const oldKey of workspaceKeys) {
          if (oldKey !== key) {
            localStorage.removeItem(oldKey);
            // Try saving again
            try {
              localStorage.setItem(key, value);
              console.log('Successfully saved after cleanup');
              return true;
            } catch (retryError) {
              // Continue trying other keys
            }
          }
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup localStorage:', cleanupError);
      }
      
      console.error('Failed to save to localStorage after cleanup:', error);
      return false;
    }
    
    console.error('Failed to save to localStorage:', error);
    return false;
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionToken } = useAuth();
  const [currentSession, setCurrentSession] = useState<WorkspaceSession | null>(null);
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [sessionsInitialized, setSessionsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
const actionListenersRef = useRef<Set<PlaygroundActionListener>>(new Set());
const pendingActionsRef = useRef<PlaygroundAction[]>([]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setSessions([]);
      setCurrentSession(null);
      setSessionsInitialized(false);
      return;
    }

    const initializeSessions = async () => {
      try {
        const savedData = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (!isMounted) return;
            
            // Validate parsed data
            if (parsed && Array.isArray(parsed.sessions)) {
              setSessions(parsed.sessions);

              if (parsed.lastSessionId) {
                const lastSession = parsed.sessions.find((s: WorkspaceSession) => s.id === parsed.lastSessionId);
                if (lastSession) {
                  setCurrentSession(lastSession);
                }
              }
            }
          } catch (error) {
            console.error('Failed to load workspace from localStorage:', error);
            // Clear corrupted data
            try {
              localStorage.removeItem(`${STORAGE_KEY}-${user.id}`);
            } catch (clearError) {
              console.error('Failed to clear corrupted localStorage data:', clearError);
            }
          }
        }

        // Always load from server to get latest data
        await loadSessionsFromServer();
      } finally {
        if (isMounted) {
          setSessionsInitialized(true);
        }
      }
    };

    initializeSessions();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Auto-save to localStorage
  useEffect(() => {
    if (!user || !currentSession) return;

    const saveToLocalStorage = () => {
      try {
        // Compress sessions for localStorage (remove large data)
        const compressedSessions = cleanupOldSessions(sessions).map(compressSessionForLocalStorage);
        
        const data = {
          sessions: compressedSessions,
          lastSessionId: currentSession?.id,
          lastUpdated: Date.now()
        };
        
        const jsonData = JSON.stringify(data);
        const success = safeLocalStorageSetItem(`${STORAGE_KEY}-${user.id}`, jsonData);
        
        if (!success) {
          console.warn('Failed to save workspace to localStorage (quota exceeded or data too large). Data will only be saved to server.');
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        // Don't throw - localStorage is just a backup, server is primary
      }
    };

    saveToLocalStorage();
  }, [currentSession, sessions, user]);

  // Track last saved session state to avoid unnecessary saves
  const lastSavedSessionRef = useRef<string | null>(null);

  // Auto-save to server (only if session has changed)
  useEffect(() => {
    if (!user || !currentSession || !sessionToken) return;

    // Create a hash of the session to detect changes
    const sessionHash = JSON.stringify({
      id: currentSession.id,
      generatedFiles: currentSession.generatedFiles?.length || 0,
      chatHistory: currentSession.chatHistory?.length || 0,
      metadata: currentSession.metadata
    });

    // Only save if session has actually changed
    if (lastSavedSessionRef.current === sessionHash) {
      return;
    }

    const interval = setInterval(() => {
      // Check again before saving
      const currentHash = JSON.stringify({
        id: currentSession.id,
        generatedFiles: currentSession.generatedFiles?.length || 0,
        chatHistory: currentSession.chatHistory?.length || 0,
        metadata: currentSession.metadata
      });

      if (lastSavedSessionRef.current !== currentHash) {
        saveToServer(currentSession).then(() => {
          lastSavedSessionRef.current = currentHash;
        });
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [currentSession, user, sessionToken]);

  // Listen for storage events (sync across tabs)
  useEffect(() => {
    if (!user) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `${STORAGE_KEY}-${user.id}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSessions(parsed.sessions || []);

          // Update current session if it was modified in another tab
          if (currentSession && parsed.lastSessionId === currentSession.id) {
            const updated = parsed.sessions.find((s: WorkspaceSession) => s.id === currentSession.id);
            if (updated) {
              setCurrentSession(updated);
            }
          }
        } catch (error) {
          console.error('Failed to sync across tabs:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, currentSession]);

  const loadSessionsFromServer = async () => {
    if (!sessionToken) return;

    try {
      const response = await apiFetch('/api/workspace-sessions', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions(data.sessions || []);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions from server:', error);
    }
  };

  const saveToServer = async (session: WorkspaceSession) => {
    if (!sessionToken) return;

    setIsSaving(true);
    try {
      const response = await apiFetch('/api/workspace-sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          session: {
            ...session,
            updatedAt: Date.now()
          }
        })
      });

      if (response.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Failed to save to server:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const createSession = useCallback((type: 'playground' | 'assistant', name?: string, metadata?: Record<string, any>): WorkspaceSession => {
    const newSession: WorkspaceSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || `${type === 'playground' ? 'Playground' : 'Assistant'} Session`,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatHistory: [],
      generatedFiles: [],
      metadata: metadata || {}
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSession(newSession);

    return newSession;
  }, []);

  const loadSession = async (sessionId: string) => {
    // First try localStorage
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      return;
    }

    // Try loading from server
    if (!sessionToken) return;

    try {
      const response = await apiFetch(`/api/workspace-sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          setCurrentSession(data.session);
          setSessions(prev => {
            const exists = prev.find(s => s.id === sessionId);
            if (exists) {
              return prev.map(s => s.id === sessionId ? data.session : s);
            } else {
              return [...prev, data.session];
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session from server:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));

    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
    }

    // Delete from server
    if (sessionToken) {
      try {
        await apiFetch(`/api/workspace-sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      } catch (error) {
        console.error('Failed to delete session from server:', error);
      }
    }
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    }
  };

  const addChatMessage = useCallback((message: ChatMessage) => {
    // Use functional setState to ensure we always work with the latest state
    // This prevents race conditions when multiple messages are added quickly
    setCurrentSession(prev => {
      if (!prev) return prev;

      const updated = {
        ...prev,
        chatHistory: [...prev.chatHistory, message],
        updatedAt: Date.now()
      };

      // Also update sessions array with the new chat history
      setSessions(sessions => sessions.map(s => s.id === updated.id ? updated : s));

      return updated;
    });
  }, []);

  const clearChat = useCallback(() => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      chatHistory: [],
      updatedAt: Date.now()
    };

    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession]);

  const updateGeneratedFiles = useCallback((files: GeneratedFile[]) => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      generatedFiles: files,
      updatedAt: Date.now()
    };

    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession]);

  const addGeneratedFile = useCallback((file: GeneratedFile) => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      generatedFiles: [...currentSession.generatedFiles, file],
      updatedAt: Date.now()
    };

    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession]);

  const syncWithServer = async () => {
    if (!currentSession || !sessionToken) return;
    await saveToServer(currentSession);
  };

  // Update session metadata
  const updateMetadata = useCallback((metadata: Record<string, any>) => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      metadata: {
        ...currentSession.metadata,
        ...metadata
      },
      updatedAt: Date.now()
    };

    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession]);

  // Set a pending prompt for forwarding to playground
  const pendingPromptStorageKey = user ? `${STORAGE_KEY}-${user.id}-pending-prompt` : `${STORAGE_KEY}-pending-prompt`;

  const persistPendingPrompt = useCallback((
    value?: { prompt: string; timestamp: number; source: string; metadata?: Record<string, any> }
  ) => {
    if (!value) {
      sessionStorage.removeItem(pendingPromptStorageKey);
      return;
    }
    sessionStorage.setItem(pendingPromptStorageKey, JSON.stringify(value));
  }, [pendingPromptStorageKey]);

  const setPendingPrompt = useCallback((prompt: string, source: string, metadata?: Record<string, any>) => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      metadata: {
        ...currentSession.metadata,
        pendingPrompt: {
          prompt,
          timestamp: Date.now(),
          source,
          ...metadata
        }
      },
      updatedAt: Date.now()
    };

    persistPendingPrompt(updated.metadata?.pendingPrompt);
    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession, persistPendingPrompt]);

  // Get pending prompt if it exists and is recent (within 10 seconds)
  const getPendingPrompt = useCallback(() => {
    const inMemoryPrompt = currentSession?.metadata?.pendingPrompt as {
      prompt: string;
      timestamp: number;
      source: string;
      metadata?: Record<string, any>;
    } | undefined;

    const fromStorage = (() => {
      try {
        const stored = sessionStorage.getItem(pendingPromptStorageKey);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    })();

    const candidate = inMemoryPrompt || fromStorage;
    if (!candidate) return null;

    if (Date.now() - candidate.timestamp < PENDING_PROMPT_TTL) {
      return candidate;
    }

    // Expired prompt — clean up storage
    persistPendingPrompt();
    return null;
  }, [currentSession, pendingPromptStorageKey]);

  // Clear pending prompt
  const clearPendingPrompt = useCallback(() => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      metadata: {
        ...currentSession.metadata,
        pendingPrompt: undefined
      },
      updatedAt: Date.now()
    };

    persistPendingPrompt();
    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession, persistPendingPrompt]);

  const registerPlaygroundActionListener = useCallback((listener: PlaygroundActionListener) => {
    actionListenersRef.current.add(listener);

    // Flush any pending actions queued before the listener mounted
    if (pendingActionsRef.current.length > 0) {
      const queuedActions = [...pendingActionsRef.current];
      pendingActionsRef.current = [];
      queuedActions.forEach(action => {
        try {
          listener(action);
        } catch (error) {
          console.error('WorkspaceContext pending action listener error:', error);
        }
      });
    }

    return () => {
      actionListenersRef.current.delete(listener);
    };
  }, []);

  const dispatchPlaygroundAction = useCallback((action: PlaygroundAction) => {
    if (actionListenersRef.current.size === 0) {
      pendingActionsRef.current.push(action);
      return;
    }

    actionListenersRef.current.forEach(listener => {
      try {
        listener(action);
      } catch (error) {
        console.error('WorkspaceContext playground action listener error:', error);
      }
    });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        currentSession,
        sessions,
        sessionsInitialized,
        createSession,
        loadSession,
        deleteSession,
        switchSession,
        addChatMessage,
        clearChat,
        updateGeneratedFiles,
        addGeneratedFile,
        updateMetadata,
        setPendingPrompt,
        getPendingPrompt,
        clearPendingPrompt,
      registerPlaygroundActionListener,
      dispatchPlaygroundAction,
        isSaving,
        lastSaved,
        syncWithServer
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

export type { WorkspaceSession, ChatMessage, GeneratedFile, PlaygroundAction };
