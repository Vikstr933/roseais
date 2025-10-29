import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files?: GeneratedFile[];
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

interface WorkspaceContextType {
  // Current active session
  currentSession: WorkspaceSession | null;

  // All user sessions
  sessions: WorkspaceSession[];

  // Session management
  createSession: (type: 'playground' | 'assistant', name?: string) => WorkspaceSession;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;

  // Chat management
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  // File management
  updateGeneratedFiles: (files: GeneratedFile[]) => void;
  addGeneratedFile: (file: GeneratedFile) => void;

  // Auto-save status
  isSaving: boolean;
  lastSaved: Date | null;

  // Sync status
  syncWithServer: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'ai-library-workspace';
const AUTOSAVE_INTERVAL = 5000; // 5 seconds

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionToken } = useAuth();
  const [currentSession, setCurrentSession] = useState<WorkspaceSession | null>(null);
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    if (!user) return;

    const savedData = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSessions(parsed.sessions || []);

        // Restore last active session
        if (parsed.lastSessionId) {
          const lastSession = parsed.sessions.find((s: WorkspaceSession) => s.id === parsed.lastSessionId);
          if (lastSession) {
            setCurrentSession(lastSession);
          }
        }
      } catch (error) {
        console.error('Failed to load workspace from localStorage:', error);
      }
    }

    // Load from server
    loadSessionsFromServer();
  }, [user]);

  // Auto-save to localStorage
  useEffect(() => {
    if (!user || !currentSession) return;

    const saveToLocalStorage = () => {
      const data = {
        sessions,
        lastSessionId: currentSession?.id,
        lastUpdated: Date.now()
      };
      localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(data));
    };

    saveToLocalStorage();
  }, [currentSession, sessions, user]);

  // Auto-save to server
  useEffect(() => {
    if (!user || !currentSession || !sessionToken) return;

    const interval = setInterval(() => {
      saveToServer(currentSession);
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
      const response = await fetch('/api/workspace-sessions', {
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
      const response = await fetch('/api/workspace-sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
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

  const createSession = useCallback((type: 'playground' | 'assistant', name?: string): WorkspaceSession => {
    const newSession: WorkspaceSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || `${type === 'playground' ? 'Playground' : 'Assistant'} Session`,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatHistory: [],
      generatedFiles: [],
      metadata: {}
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
      const response = await fetch(`/api/workspace-sessions/${sessionId}`, {
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
        await fetch(`/api/workspace-sessions/${sessionId}`, {
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
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      chatHistory: [...currentSession.chatHistory, message],
      updatedAt: Date.now()
    };

    setCurrentSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, [currentSession]);

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

  return (
    <WorkspaceContext.Provider
      value={{
        currentSession,
        sessions,
        createSession,
        loadSession,
        deleteSession,
        switchSession,
        addChatMessage,
        clearChat,
        updateGeneratedFiles,
        addGeneratedFile,
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

export type { WorkspaceSession, ChatMessage, GeneratedFile };
