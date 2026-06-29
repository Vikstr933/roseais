import { useState, useEffect, useRef, useCallback } from "react"; // Premium UX
import { apiFetch, getApiUrl } from '../lib/api';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Eye, Code, Brain, MessageSquare, Settings, Laptop, User, Users, Plus, RefreshCw, X, PowerOff, Loader2, Folder, LayoutGrid, Smartphone, Crown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { CreateProjectDialog } from "../components/CreateProjectDialog";
import { Badge } from "../components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { ProjectSharing } from "../components/ProjectSharing";
import { ProductionDeployment } from "../components/ProductionDeployment";
import { AdvancedPreview } from "../components/AdvancedPreview";
import { useAuth, getAuthHeaders } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import type { GeneratedFile, ChatMessage as WorkspaceChatMessage, PlaygroundAction } from "../contexts/WorkspaceContext";
import { useRoute, useLocation } from "wouter";
import { webContainerService, type WebContainerSupport } from "../services/WebContainerService";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useProjectManagement } from "../hooks/useProjectManagement";
import { DatabaseAPIKeyDialog } from "../components/DatabaseAPIKeyDialog";
import { ProjectAPIKeyDialog, type MissingAPIKey } from "../components/ProjectAPIKeyDialog";
import { DesktopView } from "../components/DesktopView";
import { ProjectSettingsDialog } from "../components/ProjectSettingsDialog";

// Import extracted types, constants, and utilities
import {
  type RawGeneratedFile,
  type AIResponse,
  type PlaygroundResponse,
  type OrchestrationStep,
  type GenerateResponse,
  type Session,
  type FormFieldProps,
  type AgentStatus,
  type StatusMessage,
  type Project,
  type APIKeyDialogData,
  type PlaygroundTab,
} from "./playground/types";
import {
  SYSTEM_PROMPT,
  promptFormSchema,
  type PromptForm,
} from "./playground/constants";
import {
  getFileLanguage,
  createGeneratedFile,
  toPlaygroundResponse,
  stripWorkspacePrefix,
  mapRawFilesToGenerated,
  validatePreviewContract,
  formatPreviewContractIssues,
  repairMissingPackageDependencies,
} from "./playground/utils";

// Extracted components
import { ChatPanel } from "./playground/components";
import { DesktopTab, PreviewTab, MobileTab } from "./playground/tabs";
import { MobileBottomNav, MobileChatSheet, MobileProgressIndicator, MobilePreviewModal } from "./playground/mobile";
import { RenameProjectDialog } from "./playground/dialogs";

// Types, constants, and utilities are imported from ./playground/
// This reduces file size and improves maintainability

export default function PromptPlayground() {
  const { user, sessionToken, isSuperAdmin, isAdmin, isLoading: authIsLoading } = useAuth();
  const {
    currentSession,
    sessions,
    sessionsInitialized,
    createSession,
    switchSession,
    addChatMessage: workspaceAddChatMessage,
    clearChat: workspaceClearChat,
    updateGeneratedFiles,
    updateMetadata,
    getPendingPrompt,
    clearPendingPrompt,
    isSaving,
    lastSaved,
    registerPlaygroundActionListener
  } = useWorkspace();

  const [match, params] = useRoute('/playground/:projectId');
  const [, setLocation] = useLocation();
  const hasProjectRoute = Boolean(match && params?.projectId);
  const isFreeUser = (user?.tier || 'free') === 'free';
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'desktop' | 'preview'>('desktop');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [orchestrationSteps, setOrchestrationSteps] = useState<OrchestrationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [error, setError] = useState<{ message: string; suggestion: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false); // Chat mode toggle
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  // Track processed prompts to prevent duplicate processing
  const processedPromptRef = useRef<string | null>(null);
  // Track if welcome message has been added for current project
  const welcomeMessageAddedRef = useRef<string | null>(null);
  // Track if we've restored files for the current session to prevent loops
  const restoredFilesRef = useRef<string | null>(null);
  // Track if we've updated metadata for current project to prevent loops
  const metadataUpdatedRef = useRef<string | null>(null);

  // Removed animation-related code - editor/preview are always visible during generation

  // Use workspace context for chat history (persists across navigation)
  // Filter out status messages - only keep user and assistant conversation messages
  const [chatHistory, setChatHistory] = useState<WorkspaceChatMessage[]>(() => {
    const history = currentSession?.chatHistory || [];
    // Filter out status messages (those that start with specific emojis/patterns)
    return history.filter(msg => {
      const content = msg.content || '';
      // Keep user messages and assistant messages that are NOT status updates
      if (msg.role === 'user') return true;
      // Filter out status messages (FILE_GENERATED, PHASE_PROGRESS, agent:start, etc.)
      const isStatusMessage = 
        content.startsWith('📄 Generated:') ||
        content.startsWith('⏳') ||
        content.startsWith('🔄 Starting code generation') ||
        content.includes('Figuring out exactly') ||
        content.includes('Designing something') ||
        content.includes('Planning the perfect') ||
        content.includes('Making it look stunning') ||
        content.includes('Writing the code now') ||
        content.includes('Just doing a final quality check') ||
        content.includes('Got it! I know exactly') ||
        content.includes('Design is ready') ||
        content.includes('Architecture planned') ||
        content.includes('Styling is all set') ||
        content.includes('Code is written') ||
        content.includes('Everything looks perfect') ||
        content.includes('Time for') && content.includes('to jump in') ||
        content.includes('Moving to the next step') ||
        content.includes('Great progress! Moving forward') ||
        content.includes('Agents done! Now generating') ||
        content.includes('Let me get the team together') ||
        content.includes('📋 Created generation plan');
      return !isStatusMessage;
    });
  });
  const chatHistoryRef = useRef<WorkspaceChatMessage[]>(chatHistory);
  const lastSessionIdRef = useRef<string | null>(currentSession?.id || null);
  const chatHistoryManuallyClearedRef = useRef(false);
  const currentSessionId = currentSession?.id || null;
  
  // Separate state for status messages (not saved to chat history)
  const [statusMessages, setStatusMessages] = useState<Array<{ id: string; content: string; timestamp: number; type: string }>>([]);
  const [relevanceScore, setRelevanceScore] = useState<number>(0);
  const [relevanceData, setRelevanceData] = useState<any[]>([]);
  const [currentComponentName, setCurrentComponentName] = useState<string>('');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const livePreviewUrlRef = useRef<string | null>(null);
  const activeDeploySignatureRef = useRef<string | null>(null);
  const completedDeploySignatureRef = useRef<string | null>(null);
  type PlaygroundProjectSummary = {
    id: number;
    name: string;
    description?: string;
    workspaceType?: 'personal' | 'team';
    isPublic?: boolean;
    screenshotUrl?: string | null;
    thumbnailUrl?: string | null;
  };
  const [currentProject, setCurrentProject] = useState<PlaygroundProjectSummary | null>(null);
  const [projects, setProjects] = useState<PlaygroundProjectSummary[]>([]);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [showStartFreshDialog, setShowStartFreshDialog] = useState(false);
  const [isResettingProject, setIsResettingProject] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [showRenameProjectDialog, setShowRenameProjectDialog] = useState(false);
  const [devServerRunning, setDevServerRunning] = useState(false);
  const [devServerStopping, setDevServerStopping] = useState(false);
  const [agentsActive, setAgentsActive] = useState(false); // Track if agents are currently working
  const [agentStatusMap, setAgentStatusMap] = useState<Map<string, { status: 'pending' | 'running' | 'completed' | 'failed'; startTime?: number; endTime?: number; currentMessage?: string; tokenUsage?: { input: number; output: number; total: number } }>>(new Map());
  // API Key Dialog state
  const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false);
  const [apiKeyDialogData, setAPIKeyDialogData] = useState<{
    missingApiKeys: string[];
    databaseType: 'mongodb' | 'postgresql' | 'mysql';
    projectId?: number;
  } | null>(null);
  const [projectAPIKeyDialogData, setProjectAPIKeyDialogData] = useState<{
    missingApiKeys: MissingAPIKey[];
    projectId: number | null;
    projectName?: string;
  } | null>(null);
  const [showProjectAPIKeyDialog, setShowProjectAPIKeyDialog] = useState(false);
  const [pendingGenerationAfterApiKeys, setPendingGenerationAfterApiKeys] = useState<PromptForm | null>(null);
  // Incremental generation is ALWAYS enabled - it's the standard way to generate code

  useEffect(() => {
    livePreviewUrlRef.current = livePreviewUrl;
  }, [livePreviewUrl]);

  const isLocalPreviewUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    } catch {
      return url.includes('localhost') || url.includes('127.0.0.1');
    }
  };

  const createDeploymentSignature = (
    files: Array<{ path: string; content: string }>,
    componentName: string
  ): string => {
    const fileSignature = files
      .map(file => `${file.path}:${file.content.length}`)
      .sort()
      .join('|');

    return `${componentName}:${files.length}:${fileSignature}`;
  };

  const normalizeRuntimeFiles = (files: Array<{ path: string; content: string }>) => {
    const normalizedFiles = files.map(file => {
      const filename = file.path?.split('/').pop() || '';
      const isRootConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);

      if (isRootConfigFile && file.path?.startsWith('src/')) {
        console.log(`Moving ${file.path} to ${filename} (root level)`);
        return { ...file, path: filename };
      }
      return file;
    });

    return repairMissingPackageDependencies(normalizedFiles);
  };

  const isGenerationReadyForPreview = (result: GenerateResponse | any): boolean => {
    return (
      result?.success !== false &&
      result?.metadata?.success !== false &&
      (result?.errorSummary?.errors ?? 0) === 0
    );
  };

  // Project management hook
  const {
    createProject: createProjectHook,
    deleteProject: deleteProjectHook,
    renameProject: renameProjectHook,
    saveProjectFiles,
    isCreating,
    isDeleting,
    isRenaming,
  } = useProjectManagement(sessionToken, {
    onProjectCreated: (project) => {
      // Use SPA navigation to preserve React Query cache
      // This ensures the project list is updated before navigating
      setLocation(`/playground/${project.id}`);
    },
    onProjectDeleted: () => {
      // Navigate to workspaces page using SPA navigation
      setLocation('/workspaces');
    },
    onProjectRenamed: (project) => {
      // Update current project state
      setCurrentProject(prev => prev ? { ...prev, name: project.name } : null);
      // Update projects list
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, name: project.name } : p
      ));
    },
  });

  const handleCreateProject = useCallback(
    async (projectData: { name: string; description: string; projectType?: string }) => {
      const project = await createProjectHook(projectData);
      if (project) {
        setShowCreateProjectDialog(false);
      }
    },
    [createProjectHook]
  );

  // Project settings are now handled by ProjectSettingsDialog

  useEffect(() => {
    let isMounted = true;

    if (!currentSession) {
      if (isMounted) {
        lastSessionIdRef.current = null;
        chatHistoryRef.current = [];
        setChatHistory([]);
      }
      return;
    }

    const newHistory = currentSession.chatHistory || [];
    const isNewSession = lastSessionIdRef.current !== currentSession.id;

    if (isNewSession) {
      if (isMounted) {
        lastSessionIdRef.current = currentSession.id;
        // Filter out status messages when loading session
        const filteredHistory = newHistory.filter(msg => {
          if (msg.role === 'user') return true;
          const content = msg.content || '';
          const isStatusMessage = 
            content.startsWith('📄 Generated:') ||
            content.startsWith('⏳') ||
            content.startsWith('🔄 Starting code generation') ||
            content.includes('Figuring out exactly') ||
            content.includes('Designing something') ||
            content.includes('Planning the perfect') ||
            content.includes('Making it look stunning') ||
            content.includes('Writing the code now') ||
            content.includes('Just doing a final quality check') ||
            content.includes('Got it! I know exactly') ||
            content.includes('Design is ready') ||
            content.includes('Architecture planned') ||
            content.includes('Styling is all set') ||
            content.includes('Code is written') ||
            content.includes('Everything looks perfect') ||
            (content.includes('Time for') && content.includes('to jump in')) ||
            content.includes('Moving to the next step') ||
            content.includes('Great progress! Moving forward') ||
            content.includes('Agents done! Now generating') ||
            content.includes('Let me get the team together') ||
            content.includes('📋 Created generation plan');
          return !isStatusMessage;
        });
        chatHistoryRef.current = filteredHistory;
        chatHistoryManuallyClearedRef.current = false;
        setChatHistory(filteredHistory);
        setStatusMessages([]); // Clear status messages on new session
      }
      return;
    }

    if (
      !chatHistoryManuallyClearedRef.current &&
      newHistory.length < chatHistoryRef.current.length
    ) {
      return;
    }

    if (isMounted) {
      chatHistoryManuallyClearedRef.current = false;
      chatHistoryRef.current = newHistory;
      setChatHistory(newHistory);
    }

    return () => {
      isMounted = false;
    };
  }, [currentSession?.chatHistory, currentSession?.id]);

  // Helper function to safely parse JSON responses (handles HTML error pages)
  const safeJsonParse = async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type');
    
    // Check if response is HTML (error page) instead of JSON
    if (contentType && !contentType.includes('application/json')) {
      const text = await response.text();
      // If it starts with <, it's likely HTML
      if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
      }
      // Try to parse as JSON anyway if it's not HTML
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response. Status: ${response.status}`);
      }
    }
    
    // Parse as JSON
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response body');
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      // If parsing fails, check if it's HTML
      if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML error page. Status: ${response.status}`);
      }
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const canFallbackToServerPreview = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('WebContainer did not provide a browser-accessible preview URL') ||
      message.includes('no browser-accessible preview URL') ||
      message.includes('preview server started locally') ||
      message.includes('no browser-accessible preview URL was returned') ||
      message.includes('signal is aborted')
    );
  };

  const formatPreviewError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes('signal is aborted') || normalized.includes('aborterror')) {
      return 'Preview start was interrupted. Please try starting the preview again.';
    }

    if (
      message.includes('WebContainer did not provide a browser-accessible preview URL') ||
      message.includes('no browser-accessible preview URL') ||
      message.includes('preview server started locally') ||
      message.includes('no browser-accessible preview URL was returned')
    ) {
      return 'Browser preview did not expose a usable URL. You can start a hosted frontend preview instead.';
    }

    if (message.includes('Hosted preview took too long')) {
      return 'Hosted preview is taking longer than expected. Please try again in a moment.';
    }

    return message || 'Unknown error';
  };

  const startServerHostedPreview = async (
    files: Array<{ path: string; content: string }>,
    componentName: string
  ): Promise<string> => {
    const createResponse = await apiFetch('/api/previews', {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify({
        projectId: currentProject?.id || null,
        componentName,
        files,
      }),
    });

    const createData = await safeJsonParse(createResponse);
    if (!createResponse.ok) {
      throw new Error(createData?.message || createData?.error || 'Could not start hosted preview');
    }

    if (!createData?.id) {
      throw new Error('Hosted preview did not return a session id');
    }

    for (let attempt = 0; attempt < 90; attempt += 1) {
      const statusResponse = await apiFetch(`/api/previews/${createData.id}`, {
        method: 'GET',
        headers: getAuthHeaders(sessionToken),
      }, 0);
      const statusData = await safeJsonParse(statusResponse);

      if (!statusResponse.ok) {
        throw new Error(statusData?.error || 'Could not check hosted preview status');
      }

      if (statusData.status === 'ready' && statusData.previewUrl) {
        return statusData.previewUrl;
      }

      if (statusData.status === 'failed') {
        throw new Error(statusData.errorMessage || 'Hosted preview build failed');
      }

      setCurrentStep('Building hosted preview...');
      await wait(2000);
    }

    throw new Error('Hosted preview took too long to build');
  };

  // Helper function to validate timestamp (not 0 or 1970-01-01)
  const isValidTimestamp = (timestamp: number): boolean => {
    if (!timestamp || timestamp === 0) return false;
    // Check if timestamp is from 1970-01-01 (Unix epoch start)
    const date = new Date(timestamp);
    return date.getFullYear() > 1970 && date.getTime() > 0;
  };

  const addChatMessage = useCallback((message: WorkspaceChatMessage) => {
    // Validate content: must exist, be a string, and not be empty after trim
    if (!message.content) {
      console.warn('addChatMessage: Message content is missing', message);
      return;
    }
    
    if (typeof message.content !== 'string') {
      console.warn('addChatMessage: Message content is not a string', message);
      return;
    }
    
    const trimmedContent = message.content.trim();
    if (trimmedContent.length === 0) {
      console.warn('addChatMessage: Message content is empty after trim', message);
      return;
    }
    
    // Validate timestamp: must be valid (not 0 or 1970-01-01)
    if (!message.timestamp || !isValidTimestamp(message.timestamp)) {
      console.warn('addChatMessage: Invalid timestamp, using current time', message);
      message.timestamp = Date.now();
    }
    
    // Create validated message with trimmed content
    const validatedMessage: WorkspaceChatMessage = {
      ...message,
      content: trimmedContent,
      timestamp: message.timestamp
    };
    
    workspaceAddChatMessage(validatedMessage);
    setChatHistory(prev => {
      const next = [...prev, validatedMessage];
      chatHistoryRef.current = next;
      return next;
    });
  }, [workspaceAddChatMessage]);

  const clearChat = useCallback(() => {
    chatHistoryManuallyClearedRef.current = true;
    workspaceClearChat();
    chatHistoryRef.current = [];
    setChatHistory([]);
    setStatusMessages([]); // Clear status messages too
  }, [workspaceClearChat]);
  
  // Helper function to add status messages (not saved to chat history)
  const addStatusMessage = useCallback((content: string, type: string = 'info') => {
    setStatusMessages(prev => {
      const newMessage = {
        id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        timestamp: Date.now(),
        type
      };
      // Keep only last 50 status messages to prevent memory issues
      return [...prev.slice(-49), newMessage];
    });
  }, []);

  // Refs
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  
  // Typewriter streaming state - tracks displayed content per file path
  const streamingContentRef = useRef<Map<string, { fullContent: string; displayedContent: string; intervalId?: NodeJS.Timeout; isComplete?: boolean }>>(new Map());
  
  // Track if we're waiting for typewriter to complete before deploying
  const [waitingForTypewriter, setWaitingForTypewriter] = useState(false);
  
  /**
   * Streams file content character-by-character with typewriter effect
   * @param filePath - Path of the file being streamed
   * @param fullContent - Complete file content to stream
   * @param onUpdate - Callback called each time content updates
   */
  const streamFileContent = (filePath: string, fullContent: string, onUpdate: (content: string) => void) => {
    // Clear any existing stream for this file
    const existing = streamingContentRef.current.get(filePath);
    if (existing?.intervalId) {
      clearInterval(existing.intervalId);
    }
    
    // Initialize streaming state
    streamingContentRef.current.set(filePath, {
      fullContent,
      displayedContent: '',
      intervalId: undefined,
      isComplete: false
    });
    
    let currentIndex = 0;
    // Speed up typewriter if generation is complete (for follow-up prompts)
    const isGenerationComplete = !isLoading;
    const charsPerTick = isGenerationComplete ? 50 : 3; // Much faster if generation already done
    const tickInterval = isGenerationComplete ? 8 : 16; // Faster interval too
    
    const streamInterval = setInterval(() => {
      const streamState = streamingContentRef.current.get(filePath);
      if (!streamState) {
        clearInterval(streamInterval);
        return;
      }
      
      // Calculate how many characters to reveal (word boundaries preferred)
      let nextIndex = currentIndex + charsPerTick;
      
      // If we're in the middle of a word, try to complete it
      if (nextIndex < fullContent.length) {
        const remaining = fullContent.substring(currentIndex, nextIndex);
        // If we hit a space or newline, we can stop at word boundary
        const lastSpace = remaining.lastIndexOf(' ');
        const lastNewline = remaining.lastIndexOf('\n');
        const lastBoundary = Math.max(lastSpace, lastNewline);
        
        if (lastBoundary > 0) {
          nextIndex = currentIndex + lastBoundary + 1;
        }
      }
      
      // Ensure we don't exceed content length
      nextIndex = Math.min(nextIndex, fullContent.length);
      
      // Update displayed content
      const displayedContent = fullContent.substring(0, nextIndex);
      streamState.displayedContent = displayedContent;
      streamingContentRef.current.set(filePath, streamState);
      
      // Notify update
      onUpdate(displayedContent);
      
      // Check if streaming is complete
      if (nextIndex >= fullContent.length) {
        clearInterval(streamInterval);
        streamState.intervalId = undefined;
        streamState.isComplete = true;
        streamingContentRef.current.set(filePath, streamState);
        
        // Check if all streams are complete and we're waiting to deploy
        const allComplete = Array.from(streamingContentRef.current.values()).every(s => s.isComplete);
        if (allComplete && waitingForTypewriter) {
          console.log('✅ All typewriter effects complete, ready to deploy');
          setWaitingForTypewriter(false);
        }
      }
      
      currentIndex = nextIndex;
    }, tickInterval); // Faster if generation complete
    
    // Store interval ID
    const streamState = streamingContentRef.current.get(filePath);
    if (streamState) {
      streamState.intervalId = streamInterval;
      streamingContentRef.current.set(filePath, streamState);
    }
  };

  // WebContainer state
  const [webContainerReady, setWebContainerReady] = useState(false);
  const [webContainerBooting, setWebContainerBooting] = useState(false);
  const [webContainerSupport, setWebContainerSupport] = useState<WebContainerSupport>(() => webContainerService.getSupportStatus());
  const { toast } = useToast();
  
  // Cleanup streaming intervals on unmount
  useEffect(() => {
    return () => {
      streamingContentRef.current.forEach((streamState) => {
        if (streamState.intervalId) {
          clearInterval(streamState.intervalId);
        }
      });
      streamingContentRef.current.clear();
    };
  }, []);

  // Initialize or switch workspace session based on projectId
  // Only create session if we have a valid project (not just any projectId)
  useEffect(() => {
    if (!user || !sessionsInitialized) return;

    let isMounted = true;

    const projectId = params?.projectId;
    
    // Don't create session if no projectId or if projectId is 'default'
    // Wait for project to be loaded from database first
    if (!projectId || projectId === 'default') {
      return;
    }

    // Only proceed if we have a valid project loaded from database
    if (!currentProject || currentProject.id.toString() !== projectId) {
      // Project not loaded yet, wait for it
      return;
    }

    // Find existing session for this project
    const existingSession = sessions.find(
      s => s.type === 'playground' && s.metadata?.projectId === projectId && s.metadata?.workspaceId === currentProject.id
    );

    if (existingSession) {
      // Switch to existing session for this project
      if (currentSession?.id !== existingSession.id && isMounted) {
        console.log(`🔄 Switching to existing session for project: ${projectId}`);
        switchSession(existingSession.id);
      }
      // Update metadata with workspaceId if missing
      if (existingSession.metadata?.workspaceId !== currentProject.id && isMounted) {
        updateMetadata({ workspaceId: currentProject.id, projectId });
      }
    } else {
      // Create new session for this project with both projectId and workspaceId in metadata
      if (isMounted) {
        const projectName = currentProject.name || `Project ${projectId}`;
        console.log(`✨ Creating new session for project: ${projectId} (workspace: ${currentProject.id})`);
        createSession('playground', projectName, { 
          projectId, 
          workspaceId: currentProject.id 
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [user, sessionsInitialized, params?.projectId, currentProject, sessions, currentSession, createSession, switchSession, updateMetadata]);

  // Restore generated files from workspace session
  // Only restore if we have a project and haven't explicitly cleared files (response is null means project is empty)
  useEffect(() => {
    let isMounted = true;

    // Don't restore from session if we're on a project route and response is null (project is empty in DB)
    if (params?.projectId && response === null) {
      // Project is empty in database, don't restore files from session
      return;
    }

    // Use a stable reference to generatedFiles to prevent loops
    const sessionFiles = currentSession?.generatedFiles;
    if (!sessionFiles || sessionFiles.length === 0) {
      // Reset ref when session has no files
      restoredFilesRef.current = null;
      return;
    }

    // Create a hash of the files to check if we've already restored this exact set
    const filesHash = JSON.stringify(sessionFiles.map(f => ({ path: f.path, content: f.content })));
    
    // Skip if we've already restored these exact files
    if (restoredFilesRef.current === filesHash) {
      return;
    }

    // Always restore files from workspace session when currentSession changes
    // This ensures files are visible even after tab switches or refreshes
    if (isMounted) {
      setResponse(prevResponse => {
        // If prevResponse is null and we're on a project route, don't restore (project is empty)
        if (prevResponse === null && params?.projectId) {
          return null;
        }

        const currentFiles: GeneratedFile[] =
          prevResponse?.type === 'component' && prevResponse.files ? prevResponse.files : [];

        const filesChanged =
          currentFiles.length !== sessionFiles.length ||
          !currentFiles.every((file, index) => {
            const sessionFile = sessionFiles[index];
            if (!sessionFile) return false;
            return file.path === sessionFile.path && file.content === sessionFile.content;
          });

        if (filesChanged) {
          console.log(`✅ Restoring ${sessionFiles.length} files from workspace session`);
          restoredFilesRef.current = filesHash; // Mark as restored
          return {
            type: 'component',
            text: '',
            files: sessionFiles
          };
        }
        return prevResponse;
      });

      // Set the first file as selected if no file is selected
      if (selectedFileIndex === 0 && sessionFiles[0]?.path) {
        setEditorLanguage(getFileLanguage(sessionFiles[0].path));
      }
    }

    return () => {
      isMounted = false;
    };
  // Use currentSession?.id instead of generatedFiles to prevent loops
  // Only restore when session ID changes or project changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, params?.projectId]);

  // Auto-scroll to bottom when chat history changes - smooth scroll to generated content
  useEffect(() => {
    if (chatMessagesRef.current) {
      // Smooth scroll to bottom to show latest generated content
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, isLoading]);
  
  // Also scroll when new content is being generated
  useEffect(() => {
    if (isLoading && chatMessagesRef.current) {
      // Scroll to show generation status
      setTimeout(() => {
        if (chatMessagesRef.current) {
          chatMessagesRef.current.scrollTo({
            top: chatMessagesRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [isLoading]);

  // This useEffect will be moved after generateMutation is defined to avoid temporal dead zone

  // Load user projects list - MUST be before useEffect that uses it for optimistic updates
  const { data: userProjects = [], isLoading: isLoadingProjects, refetch: refetchProjects } = useQuery<PlaygroundProjectSummary[]>({
    queryKey: ['/api/workspaces'],
    queryFn: async () => {
      if (!sessionToken) return [];
      const response = await apiFetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return [];
      return safeJsonParse(response);
    },
    enabled: !!sessionToken,
    staleTime: 30000, // Consider data fresh for 30 seconds to avoid refetching
    refetchOnWindowFocus: false, // Disabled to reduce rate limit issues
  });

  // Boot WebContainer on component mount
  useEffect(() => {
    async function initWebContainer() {
      const support = webContainerService.getSupportStatus();
      setWebContainerSupport(support);

      if (!support.supported) {
        setWebContainerBooting(false);
        setWebContainerReady(false);
        console.info('Live browser preview is unavailable in this browser:', support);
        return;
      }

      try {
        setWebContainerBooting(true);
        console.log('Booting WebContainer...');
        
        await webContainerService.boot(5, 2000); // 5 retries with 2s base delay
        
        setWebContainerReady(true);
        setWebContainerBooting(false);
        console.log('WebContainer ready!');
        
        // Removed toast notification - too intrusive for users
      } catch (error) {
        console.error('Failed to boot WebContainer:', error);
        setWebContainerBooting(false);
        setWebContainerReady(false);

        const latestSupport = webContainerService.getSupportStatus();
        setWebContainerSupport(latestSupport);
        if (!latestSupport.supported) {
          return;
        }

        // Show error but keep trying in background
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('WebContainer boot failed:', errorMessage);
        
        // Retry after 10 seconds
        setTimeout(() => {
          console.log('🔄 Retrying WebContainer boot...');
          initWebContainer();
        }, 10000);
        
        // Show user-friendly error
        toast({
          title: "WebContainer Initialization Failed",
          description: "Retrying automatically. If this persists, please refresh the page.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }

    initWebContainer();

    // Cleanup on unmount
    return () => {
      // Don't teardown on unmount - keep WebContainer alive for better UX
    };
  }, [toast]);

  // Load project context if projectId is in URL
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;

    // Wait for auth to finish loading before loading project
    if (authIsLoading) {
      return () => {
        isMounted = false;
      };
    }

    if (params?.projectId && sessionToken) {
      const projectId = params.projectId;
      const numericProjectId = Number(projectId);
      console.log('🔍 Loading project from URL:', { urlProjectId: projectId, type: typeof projectId });

      // 🚀 OPTIMISTIC UPDATE: Check if we already have this project in the cached list
      // This provides INSTANT feedback while we load fresh data in the background
      const cachedProject = userProjects.find(p => p.id === numericProjectId || p.id.toString() === projectId);
      if (cachedProject && (!currentProject || currentProject.id !== cachedProject.id)) {
        console.log('⚡ Optimistic project set from cache:', cachedProject.name);
        setCurrentProject({
          id: cachedProject.id,
          name: cachedProject.name,
          description: cachedProject.description,
          workspaceType: cachedProject.workspaceType || 'personal',
          isPublic: cachedProject.isPublic,
          screenshotUrl: cachedProject.screenshotUrl,
          thumbnailUrl: cachedProject.thumbnailUrl,
        });
      }

      // Set loading state only if we don't have cached project (for file loading)
      const needsFullLoad = !cachedProject;
      if (isMounted && needsFullLoad) {
        setIsLoadingProject(true);
      }
      
      // Safety timeout - always clear loading state after 8 seconds (reduced for better UX)
      loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Project loading timeout - clearing loading state');
          setIsLoadingProject(false);
        }
      }, 8000);

      // Reset refs if this is a different project
      if (welcomeMessageAddedRef.current !== projectId) {
        welcomeMessageAddedRef.current = null;
        metadataUpdatedRef.current = null;
      }

      // Clear workspace state while the new project data loads (but keep project info)
      if (isMounted) {
        setResponse(null);
        updateGeneratedFiles([]);
        setSelectedFileIndex(0);
        setCurrentComponentName('');
        setLivePreviewUrl(null);
      }
      
      // Load project details (validates and gets fresh data)
      apiFetch(`/api/workspaces/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(res => {
          if (!isMounted) return null;
          
          if (!res.ok) {
            if (res.status === 404) {
              // Project doesn't exist, redirect to project selection
              console.warn(`Project ${projectId} not found, redirecting to project selection`);
              if (isMounted) {
                setCurrentProject(null); // Clear optimistic state
                setLocation('/playground');
              }
              return null;
            }
            // For other errors, keep optimistic state if we have it
            if (cachedProject) {
              console.warn(`API error ${res.status}, keeping cached project data`);
              return null; // Don't throw, we have cached data
            }
            throw new Error(`Failed to load project: ${res.status}`);
          }
          return safeJsonParse(res);
        })
        .then(project => {
          if (!project || !isMounted) return; // Project not found or component unmounted
          
          console.log('🔍 Project validated from API:', { 
            requestedId: projectId, 
            receivedId: project.id, 
            name: project.name,
            match: projectId === project.id.toString() || projectId === project.id
          });
          
          // Verify project ID matches URL - if not, redirect to correct URL
          if (project.id.toString() !== projectId && project.id !== Number(projectId)) {
            console.warn(`⚠️ Project ID mismatch! URL: ${projectId}, API returned: ${project.id}. Redirecting to correct URL.`);
            if (isMounted) {
              setLocation(`/playground/${project.id}`);
            }
            return; // Don't continue loading if ID doesn't match
          }
          
          // Update with fresh data from API (may have updated fields)
          if (isMounted) {
            setCurrentProject(prev => {
              if (!isMounted) return prev || null;
              return {
                id: project.id,
                name: project.name,
                description: project.description,
                workspaceType: project.workspaceType || prev?.workspaceType || 'personal',
                isPublic: project.isPublic,
                screenshotUrl: project.screenshotUrl,
                thumbnailUrl: project.thumbnailUrl,
              };
            });

            // Update session metadata with workspaceId for Elon (only once per project)
            if (currentSession && metadataUpdatedRef.current !== projectId) {
              updateMetadata({ workspaceId: project.id, projectId });
              metadataUpdatedRef.current = projectId;
            }
          }

          if (isMounted) {
            console.log('✅ Validated project:', project.name, `(${project.workspaceType || 'personal'})`);
          }
        })
        .catch(err => {
          console.error('Failed to load project:', err);
          // Only redirect if we don't have cached data
          if (isMounted && !cachedProject) {
            if (loadingTimeout) clearTimeout(loadingTimeout);
            setIsLoadingProject(false);
            setLocation('/playground');
          }
          // If we have cached data, just log the error and continue
          if (cachedProject) {
            console.warn('API error but keeping cached project - user can continue working');
          }
        });
      
      // Load chat history
      // Only load if we haven't already loaded for this project
      if (welcomeMessageAddedRef.current !== projectId) {
        apiFetch(`/api/workspaces/${projectId}/chat?limit=50`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(async res => {
          if (!res.ok) {
            throw new Error(`Failed to load chat history: ${res.status}`);
          }
          return safeJsonParse(res);
        })
        .then(messages => {
          if (messages && messages.length > 0) {
            // Transform messages to chat history format
            const history = messages.reverse().map((msg: any) => ({
              role: msg.message.messageType === 'user' ? 'user' : 'assistant',
              content: msg.message.message,
              timestamp: new Date(msg.message.createdAt).getTime()
            }));
            if (!isMounted) return;
            history.forEach((msg: any) => {
              // Only add messages with valid content
              if (msg && msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0) {
                addChatMessage(msg);
              }
            });
            console.log(`✅ Loaded ${history.length} chat messages`);
            // Mark as loaded
            welcomeMessageAddedRef.current = projectId;
          } else {
            // No history, add welcome message only if not already added
            if (welcomeMessageAddedRef.current !== projectId) {
              if (!isMounted) return;
              addChatMessage({
                role: 'assistant',
                content: `👋 Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
                timestamp: Date.now()
              });
              welcomeMessageAddedRef.current = projectId;
            }
          }
        })
        .catch(err => {
          console.error('Failed to load chat history:', err);
          // Add welcome message on error only if not already added
          if (welcomeMessageAddedRef.current !== projectId) {
            if (!isMounted) return;
            addChatMessage({
              role: 'assistant',
              content: `👋 Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
              timestamp: Date.now()
            });
            welcomeMessageAddedRef.current = projectId;
          }
        });
      }
      
      // Load project files
      apiFetch(`/api/workspaces/${projectId}/files`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch files: ${res.status}`);
          }
          return safeJsonParse(res);
        })
        .then(files => {
          if (!isMounted) return;

          console.log('Raw files from API:', files);
          if (files && files.length > 0) {
            // Transform to response format - handle both fileContent and content
            const fileList: GeneratedFile[] = files.map((f: any) => {
              const rawPath = f.filePath || f.path || '';
              const normalizedPath = stripWorkspacePrefix(rawPath);
              const content = f.fileContent || f.content || '';
              return createGeneratedFile(normalizedPath, content);
            });
            setResponse({
              type: 'component',
              text: '',
              files: fileList
            });
            // Update workspace session with files from database
            updateGeneratedFiles(fileList);
            console.log(`✅ Loaded ${fileList.length} project files`);
            
            // Set the first file as selected
            if (fileList.length > 0 && fileList[0]?.path) {
              setSelectedFileIndex(0);
              setEditorLanguage(getFileLanguage(fileList[0].path));
            }
          } else {
            // Project is empty - clear any files from session/response
            console.log('No files found in project - clearing session files');
            setResponse(null);
            updateGeneratedFiles([]);
            setSelectedFileIndex(0);
          }
        })
        .catch(err => {
          console.error('Failed to load project files:', err);
          if (!isMounted) return;
          // Keep any files already restored from the workspace session. A transient
          // database timeout should not make the project look empty.
          const sessionFiles = currentSession?.generatedFiles || [];
          if (sessionFiles.length > 0) {
            setResponse({
              type: 'component',
              text: '',
              files: sessionFiles
            });
          }
        })
        .finally(() => {
          if (isMounted) {
            if (loadingTimeout) clearTimeout(loadingTimeout);
            setIsLoadingProject(false);
          }
        });
    } else {
      setIsLoadingProject(false);
    }
    return () => {
      isMounted = false;
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  // We intentionally omit stable context functions from deps to avoid infinite reload loops
  // Only depend on session ID, not the entire session object
  // userProjects is included for optimistic updates from cache
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.projectId, sessionToken, authIsLoading, userProjects]);

  // Update projects state when data loads
  useEffect(() => {
    if (userProjects && userProjects.length > 0) {
      console.log('📋 Projects loaded from API:', userProjects.map(p => ({ id: p.id, name: p.name, type: typeof p.id })));
      setProjects(userProjects);
    }
  }, [userProjects]);

  // Update currentProject when projects or URL params change
  useEffect(() => {
    if (!projects.length || !params?.projectId) return;
    const projectId = Number(params.projectId);
    if (Number.isNaN(projectId)) return;

    const matchingProject = projects.find(project => project.id === projectId);
    if (matchingProject) {
      setCurrentProject(prev => {
        return {
          id: matchingProject.id,
          name: matchingProject.name,
          description: matchingProject.description,
          workspaceType: matchingProject.workspaceType || prev?.workspaceType || 'personal',
          isPublic: matchingProject.isPublic,
          screenshotUrl: matchingProject.screenshotUrl,
          thumbnailUrl: matchingProject.thumbnailUrl,
        };
      });
    }
  }, [projects, params?.projectId]); // Removed currentProject?.id from deps to prevent loops

  // Persist active workspace ID in WorkspaceContext metadata
  useEffect(() => {
    if (!params?.projectId || !currentSession) return;
    const parsed = Number(params.projectId);
    if (Number.isNaN(parsed)) return;
    // Only update if metadata doesn't match and we haven't updated for this project yet
    if (currentSession.metadata?.workspaceId === parsed) return;
    if (metadataUpdatedRef.current === params.projectId) return;
    updateMetadata({ workspaceId: parsed });
    metadataUpdatedRef.current = params.projectId;
  // Only depend on projectId and session ID, not metadata (to prevent loops)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.projectId, currentSession?.id]);

  const createProjectDialog = (
    <CreateProjectDialog
      open={showCreateProjectDialog}
      onOpenChange={setShowCreateProjectDialog}
      onCreateProject={handleCreateProject}
      isLoading={isCreating}
    />
  );

  // Listen for continue session events
  useEffect(() => {
    // Reset live preview URL when a new generation/component starts
    if (!currentComponentName) {
      setLivePreviewUrl(null);
    }

    // Connect to backend SSE terminal stream when we have a component name
    if (!currentComponentName) return;

    const streamUrl = getApiUrl(`/api/terminal/${encodeURIComponent(currentComponentName)}/stream`);
    let es: EventSource | null = new EventSource(streamUrl);
    let retryTimer: number | null = null;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'output' && typeof payload.data === 'string') {
          const line = payload.data;

          // Detect Vite ready lines and extract preview URL
          const localUrlMatch = line.match(/(?:Local:\s+|started at\s+)(https?:\/\/[^\s]+)/i);
          if (localUrlMatch && localUrlMatch[1]) {
            const url = localUrlMatch[1];
            if (isLocalPreviewUrl(url)) {
              return;
            }
            // Only auto-switch to preview if user is still on desktop tab
            // This allows them to see the generation animation first
            setLivePreviewUrl(url);
            // Auto-switch to preview only if still on desktop (to see the result)
            setActiveTab((currentTab) => {
              if (currentTab === 'desktop') {
                addChatMessage({
                  role: 'assistant',
                  content: `Preview is ready in the Preview tab.`,
                  timestamp: Date.now()
                });
                return 'preview';
              }
              return currentTab; // Keep current tab if user manually switched
            });
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    const handleError = () => {
      if (es) {
        es.close();
      }
      if (retryTimer === null) {
        retryTimer = window.setTimeout(() => {
          es = new EventSource(streamUrl);
          retryTimer = null;
          if (es) {
            es.onmessage = (event) => {
              try {
                const payload = JSON.parse(event.data);
                if (payload?.type === 'output' && typeof payload.data === 'string') {
                  const line = payload.data;
                  const localUrlMatch = line.match(/(?:Local:\s+|started at\s+)(https?:\/\/[^\s]+)/i);
                  if (localUrlMatch && localUrlMatch[1]) {
                    const url = localUrlMatch[1];
                    if (isLocalPreviewUrl(url)) {
                      return;
                    }
                    // Only auto-switch to preview if user is still on desktop tab
                    setLivePreviewUrl(url);
                    setActiveTab((currentTab) => {
                      if (currentTab === 'desktop') {
                        addChatMessage({ role: 'assistant', content: `Preview is ready in the Preview tab.`, timestamp: Date.now() });
                        return 'preview';
                      }
                      return currentTab; // Keep current tab if user manually switched
                    });
                  }
                }
              } catch {}
            };
            es.onerror = handleError;
          }
        }, 3000);
      }
    };
    es.onerror = handleError;

    return () => {
      if (es) es.close();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [currentComponentName, addChatMessage, setActiveTab, setLivePreviewUrl]);

  // Ensure we clear live preview URL on generation start via SSE events
  useEffect(() => {
    if (isLoading) {
      setLivePreviewUrl(null);
    }
  }, [isLoading, setLivePreviewUrl]);

  // Listen for continue session events
  useEffect(() => {
    const handleContinueSession = (event: CustomEvent<Session>) => {
      const session = event.detail;
      const rawFiles = JSON.parse(session.generatedCode || '[]') as RawGeneratedFile[];
      const files: GeneratedFile[] = rawFiles
        .filter(file => file && file.path)
        .map(file => ({
          path: file.path || '',
          content: file.content || '',
          language: getFileLanguage(file.path || ''),
        }));

      addChatMessage({
        role: 'user',
        content: session.inputPrompt,
        timestamp: new Date(session.createdAt).getTime()
      });

      addChatMessage({
        role: 'assistant',
        content: session.title,
        timestamp: new Date(session.createdAt).getTime(),
        files
      });

      setResponse({
        type: 'component',
        text: session.title,
        files
      });

      updateGeneratedFiles(files);
    };

    window.addEventListener('continueSession', handleContinueSession as EventListener);
    return () => {
      window.removeEventListener('continueSession', handleContinueSession as EventListener);
    };
  }, [addChatMessage, updateGeneratedFiles, setResponse]);

  // Helper function to safely format agent names
  const formatAgentName = (agentId: string | undefined | null): string => {
    if (!agentId || typeof agentId !== 'string') {
      return 'AI Agent';
    }
    try {
      return agentId.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    } catch (error) {
      console.error('Error formatting agent name:', error, agentId);
      return 'AI Agent';
    }
  };

  // Set up SSE connections (full version - only runs when hasProjectRoute is true)
  useEffect(() => {
    if (!hasProjectRoute) return;
    
    const eventsSource = new EventSource(getApiUrl('/api/events'));
    const logsSource = new EventSource(getApiUrl('/api/logs'));
    const agentActivitySource = new EventSource(getApiUrl('/api/sse/agent-activity'));

    // Agent Activity Stream - Real-time updates
    agentActivitySource.onmessage = (event) => {
      const agentData = JSON.parse(event.data);
      
      // Handle events from Discord code generation
      if (agentData.type === 'GENERATION_START') {
        setIsLoading(true);
        setError(null);
        setAgentsActive(true);
        addStatusMessage(`🔄 Starting code generation...`, 'info');
        return;
      }
      
      if (agentData.type === 'PLAN_CREATED') {
        const plan = agentData.plan;
        addStatusMessage(`📋 Created generation plan: ${plan?.appName || 'project'} with ${plan?.phases || 0} phases`, 'info');
        return;
      }
      
      if (agentData.type === 'PHASE_PROGRESS') {
        setCurrentStep(`Phase: ${agentData.phase} - ${agentData.message}`);
        setOverallProgress(agentData.progress || 0);
        addStatusMessage(`⏳ ${agentData.phase}: ${agentData.message} (${Math.round(agentData.progress || 0)}%)`, 'progress');
        return;
      }
      
      if (agentData.type === 'FILE_GENERATED') {
        const file = agentData.file;
        if (file && file.path) {
          console.log('📄 File generated from Discord:', file.path);
          // File will be loaded from project when user refreshes or navigates
          addStatusMessage(`📄 Generated: ${file.path} (${agentData.index || 0}/${agentData.total || 0})`, 'file');
        }
        return;
      }
      
      if (agentData.type === 'FILE_SAVED') {
        const file = agentData.file;
        if (file && file.path) {
          console.log('💾 File saved to project:', file.path);
          // File is now saved to project - user can see it in file tree
        }
        return;
      }
      
      if (agentData.type === 'GENERATION_COMPLETE') {
        setIsLoading(false);
        setAgentsActive(false);
        if (agentData.success === false) {
          const details = Array.isArray(agentData.errors) && agentData.errors.length > 0
            ? `\n\nBlocking issues:\n${agentData.errors.slice(0, 5).map((error: string) => `- ${error}`).join('\n')}`
            : '';

          setError({
            message: 'Generation finished, but the app did not pass validation.',
            suggestion: 'Fix the blocking issues or regenerate before using it publicly.'
          });
          addChatMessage({
            role: 'assistant',
            content: `Generation finished, but the app is not release-ready yet.${details}`,
            timestamp: Date.now()
          });
          return;
        }

        addChatMessage({
          role: 'assistant',
          content: `✅ Code generation complete! Check the file tree to see your new files.`,
          timestamp: Date.now()
        });
        return;
      }
      
      if (agentData.type === 'GENERATION_ERROR') {
        setIsLoading(false);
        setAgentsActive(false);
        setError({
          message: agentData.error || 'Unknown error',
          suggestion: 'Please try again or check the logs.'
        });
        addChatMessage({
          role: 'assistant',
          content: `❌ Error: ${agentData.error || 'Unknown error'}`,
          timestamp: Date.now()
        });
        return;
      }
      
      if (agentData.type === 'API_KEY_REQUIRED') {
        // Show project API key dialog for general API key requirements during generation
        const missingApiKeys = agentData.missingApiKeys || agentData.missingKeys;
        if (missingApiKeys && Array.isArray(missingApiKeys) && missingApiKeys.length > 0) {
          const validKeys = missingApiKeys.filter((key: any): key is MissingAPIKey => {
            if (typeof key === 'string') return key.trim().length > 0;
            return Boolean(key?.serviceName && key?.keyName);
          });
          
          if (validKeys.length > 0) {
            setProjectAPIKeyDialogData({
              missingApiKeys: validKeys,
              projectId: agentData.projectId || currentProject?.id || null,
              projectName: agentData.projectName || currentProject?.name,
            });
            setShowProjectAPIKeyDialog(true);
          }
        } else if (agentData.databaseType) {
          // Show database-specific API key dialog for database provisioning
          const dbKeys = Array.isArray(agentData.missingApiKeys) 
            ? agentData.missingApiKeys.filter((key: any): key is string => typeof key === 'string')
            : [];
          setAPIKeyDialogData({
            missingApiKeys: dbKeys,
            databaseType: agentData.databaseType || 'postgresql',
            projectId: agentData.projectId
          });
          setShowAPIKeyDialog(true);
        }
        return;
      }
      
      switch (agentData.type) {
        case 'orchestration:start':
          setAgentsActive(true);
          addStatusMessage(`🚀 Getting the team together to build this for you...`, 'info');
          break;

        case 'phase:start':
          const phaseAgents = Array.isArray(agentData.agentsInPhase) ? agentData.agentsInPhase : [];
          const phaseAgentNames = phaseAgents
            .filter((a: any) => a != null && a !== undefined && typeof a === 'string')
            .map((a: string) => formatAgentName(a));
          const phaseMsg = phaseAgentNames.length > 0
            ? `Time for ${phaseAgentNames.join(' and ')} to jump in!`
            : `Moving to the next step...`;
          addStatusMessage(phaseMsg, 'phase');
          break;

        case 'agent:start':
        case 'AGENT_START':
          const startAgentId = agentData.agentId || agentData.agent;
          if (startAgentId && typeof startAgentId === 'string') {
            const agentMessages: Record<string, string> = {
              'requirements-analyst': "Figuring out exactly what you need...",
              'ui-designer': "Designing something beautiful for you...",
              'component-architect': "Planning the perfect structure...",
              'style-generator': "Making it look stunning...",
              'code-generator': "Writing the code now...",
              'completion': "Just doing a final quality check...",
              'component-developer': "Writing production-ready code...",
              'component-qa': "Validating code quality..."
            };
            const message = agentMessages[startAgentId] || "Working on it... ⚡";
            addStatusMessage(message, 'agent');
            
            // Update agent status
            setAgentStatusMap((prev: Map<string, { status: 'pending' | 'running' | 'completed' | 'failed'; startTime?: number; endTime?: number; currentMessage?: string; tokenUsage?: { input: number; output: number; total: number } }>) => {
              const next = new Map(prev);
              next.set(startAgentId, {
                status: 'running',
                startTime: Date.now(),
                currentMessage: message
              });
              return next;
            });
          }
          break;

        case 'agent:progress':
        case 'AGENT_PROGRESS':
          const progressAgentId = agentData.agentId || agentData.agent;
          if (progressAgentId && typeof progressAgentId === 'string' && agentData.message) {
            setAgentStatusMap((prev: Map<string, { status: 'pending' | 'running' | 'completed' | 'failed'; startTime?: number; endTime?: number; currentMessage?: string; tokenUsage?: { input: number; output: number; total: number } }>) => {
              const next = new Map(prev);
              const agent = next.get(progressAgentId);
              if (agent) {
                next.set(progressAgentId, {
                  ...agent,
                  currentMessage: agentData.message
                });
              } else {
                next.set(progressAgentId, {
                  status: 'running',
                  startTime: Date.now(),
                  currentMessage: agentData.message
                });
              }
              return next;
            });
          }
          break;

        case 'agent:complete':
        case 'AGENT_COMPLETE':
          const completeAgentId = agentData.agentId || agentData.agent;
          if (completeAgentId && typeof completeAgentId === 'string') {
            const completeMessages: Record<string, string> = {
              'requirements-analyst': "Got it! I know exactly what we need to build ✓",
              'ui-designer': "Design is ready and looking great! ✓",
              'component-architect': "Architecture planned out perfectly ✓",
              'style-generator': "Styling is all set! ✓",
              'code-generator': "Code is written and ready! ✓",
              'completion': "Everything looks perfect! ✓",
              'component-developer': "Code generation complete ✓",
              'component-qa': "Quality check passed ✓"
            };
            const message = completeMessages[completeAgentId] || "Done! ✓";
            addStatusMessage(message, 'agent');
            
            // Update agent status
            setAgentStatusMap((prev: Map<string, { status: 'pending' | 'running' | 'completed' | 'failed'; startTime?: number; endTime?: number; currentMessage?: string; tokenUsage?: { input: number; output: number; total: number } }>) => {
              const next = new Map(prev);
              const agent = next.get(completeAgentId);
              if (agent) {
                next.set(completeAgentId, {
                  ...agent,
                  status: 'completed',
                  endTime: Date.now()
                });
              } else {
                next.set(completeAgentId, {
                  status: 'completed',
                  endTime: Date.now()
                });
              }
              return next;
            });
          }
          break;

        case 'agent:failed':
        case 'AGENT_FAILED':
          const failedAgentId = agentData.agentId || agentData.agent;
          if (failedAgentId && typeof failedAgentId === 'string') {
            addStatusMessage(`⚠️ ${formatAgentName(failedAgentId)} encountered an issue, but we're handling it...`, 'error');
            
            // Update agent status
            setAgentStatusMap((prev: Map<string, { status: 'pending' | 'running' | 'completed' | 'failed'; startTime?: number; endTime?: number; currentMessage?: string; tokenUsage?: { input: number; output: number; total: number } }>) => {
              const next = new Map(prev);
              next.set(failedAgentId, {
                status: 'failed',
                endTime: Date.now()
              });
              return next;
            });
          }
          break;

        case 'orchestration:complete':
          setAgentsActive(false);
          addStatusMessage(`🎉 All done! Your app is ready!`, 'success');
          break;
      }
    };

    // Events Stream - General events
    eventsSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'PROJECT_LOADED':
            addChatMessage({
              role: 'assistant',
              content: `Got your project loaded!`,
              timestamp: Date.now()
            });
            break;

          case 'ORCHESTRATION_START':
            // Silently start - we show friendly messages via agent events
            break;

          case 'STEP_START':
            setOrchestrationSteps(prev => [
                    ...prev,
              {
                agent: data.data.agent,
                task: data.data.task,
                status: 'in_progress',
                dependencies: []
              }
            ]);
            break;

          case 'ORCHESTRATION_UPDATE':
            setOrchestrationSteps(data.data.plan.subtasks);
            break;

          case 'GENERATION_COMPLETE':
            setIsLoading(false);
            setAgentsActive(false); // Stop agent animation when fully complete
            if (data.data.success === false) {
              const errors = Array.isArray(data.data.errors) ? data.data.errors : [];
              const details = errors.length > 0
                ? `\n\nBlocking issues:\n${errors.slice(0, 5).map((error: any) => {
                    if (typeof error === 'string') return `- ${error}`;
                    return `- ${error.file || 'Unknown file'}: ${error.message || 'Unknown error'}`;
                  }).join('\n')}`
                : '';

              setError({
                message: 'Generation finished, but the app did not pass validation.',
                suggestion: 'Fix the blocking issues or regenerate before using it publicly.'
              });
              addChatMessage({
                role: 'assistant',
                content: `Generation finished, but the app is not release-ready yet.${details}`,
                timestamp: Date.now()
              });
              break;
            }

            addChatMessage({
              role: 'assistant',
              content: `All done! Your app is ready - check out the Preview tab!`,
              timestamp: Date.now()
            });
            break;

          case 'BROWSER_ANALYSIS_REQUESTED':
            // Mark that browser analysis should be performed when preview URL is available
            // This will be handled when livePreviewUrl is set
            break;

          case 'GENERATION_ERROR':
            setIsLoading(false);
            setAgentsActive(false); // Stop agent animation on error
            setError({
              message: data.data.error,
              suggestion: data.data.suggestion
            });
            addChatMessage({
              role: 'assistant',
              content: `Oops, something went wrong: ${data.data.error}\n\n💡 ${data.data.suggestion}`,
              timestamp: Date.now()
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing event:', error);
      }
    };

    // Logs Stream - Console logs
    logsSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        // You can handle logs here if needed
        console.log('Server log:', logData);
      } catch (error) {
        console.error('Error parsing log:', error);
      }
    };

    eventsSource.onerror = () => {
      console.warn('Events SSE connection closed');
      eventsSource.close();
    };

    logsSource.onerror = () => {
      console.warn('Logs SSE connection closed');
      logsSource.close();
    };

    agentActivitySource.onerror = () => {
      console.warn('Agent Activity SSE connection closed');
      agentActivitySource.close();
    };

    return () => {
      eventsSource.close();
      logsSource.close();
      agentActivitySource.close();
    };
  }, [hasProjectRoute, toast, addStatusMessage, addChatMessage, setIsLoading, setError, setAgentsActive, setCurrentStep, setOverallProgress, setOrchestrationSteps, currentProject, setProjectAPIKeyDialogData, setShowProjectAPIKeyDialog, setAPIKeyDialogData, setShowAPIKeyDialog, setAgentStatusMap, formatAgentName]);

  // Analyze page for visual issues using Browser Agent
  const analyzePageForVisualIssues = useCallback(async (url: string) => {
    try {
      // Skip analysis for localhost URLs - backend can't access them
      // WebContainer runs in browser, so localhost URLs are only accessible from the browser
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        console.log('⏭️ Skipping browser analysis for localhost URL (backend cannot access):', url);
        return;
      }

      console.log('🔍 Starting visual analysis for:', url);
      
      addChatMessage({
        role: 'assistant',
        content: '🔍 Analyzing page for visual and design issues...',
        timestamp: Date.now()
      });

      const response = await apiFetch('/api/browser/analyze', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(sessionToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          checkAccessibility: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await safeJsonParse(response);
      
      if (result.success && result.analysis) {
        // Add analysis result to chat with visual component
        addChatMessage({
          role: 'assistant',
          content: result.analysis.formattedMessage,
          timestamp: Date.now(),
          browserAnalysis: result.analysis
        });
      }
    } catch (error) {
      console.error('Browser analysis failed:', error);
      // Don't show error to user - analysis is optional
    }
  }, [sessionToken, addChatMessage]);

  // CRITICAL: All hooks must be defined before any conditional returns
  // The early return for desktop view is now at the end, after all hooks

  // 🚀 Deploy to WebContainer or fallback to server-side
  async function deployToRuntime(
    files: Array<{ path: string; content: string }>,
    componentName: string,
    options: { force?: boolean; preferServerPreview?: boolean } = {}
  ) {
    const runtimeFiles = normalizeRuntimeFiles(files);
    const deploySignature = createDeploymentSignature(runtimeFiles, componentName);

    if (!options.force) {
      if (activeDeploySignatureRef.current === deploySignature) {
        console.log('Deployment already in progress for this file set, skipping duplicate request');
        return;
      }

      if (completedDeploySignatureRef.current === deploySignature && livePreviewUrlRef.current) {
        setActiveTab('preview');
        return;
      }
    }

    activeDeploySignatureRef.current = deploySignature;

    try {
      const previewContract = validatePreviewContract(runtimeFiles);
      if (!previewContract.valid) {
        console.warn('Skipping preview because generated files failed the preview contract', previewContract);
        addChatMessage({
          role: 'assistant',
          content: `Preview is waiting because the generated app did not pass validation:\n${formatPreviewContractIssues(previewContract)}`,
          timestamp: Date.now()
        });
        return;
      }

      if (webContainerReady && !options.preferServerPreview) {
        console.log('Deploying to WebContainer...');
        
        addChatMessage({
          role: 'assistant',
          content: `Preparing your browser preview...`,
          timestamp: Date.now()
        });

        // Write files to WebContainer
        await webContainerService.writeFiles(runtimeFiles);
        console.log('Files written to WebContainer');

        // Install dependencies
        await webContainerService.installDependencies();

        // Start dev server
        const devServerUrl = await webContainerService.startDevServer();

        if (isLocalPreviewUrl(devServerUrl)) {
          throw new Error('The preview server started locally, but no browser-accessible preview URL was returned.');
        }

        console.log('WebContainer dev server URL:', devServerUrl);

        // Only auto-switch to preview if user is still on desktop tab
        // This allows them to see the generation animation first
        setActiveTab((currentTab) => {
          if (currentTab === 'desktop') {
            return 'preview';
          }
          return currentTab; // Keep current tab if user manually switched
        });

        setLivePreviewUrl(devServerUrl);
        setDevServerRunning(true);
        completedDeploySignatureRef.current = deploySignature;

        addChatMessage({
          role: 'assistant',
          content: `Preview is ready in the Preview tab.`,
          timestamp: Date.now()
        });

        // Automatically analyze the page for visual issues after a short delay
        // Give the page time to fully load before analysis
        setTimeout(() => {
          analyzePageForVisualIssues(devServerUrl);
        }, 3000);

      } else {
        // Fallback to server-hosted static preview for iOS/mobile browsers.
        console.log('Deploying to server-hosted preview...');
        
        addChatMessage({
          role: 'assistant',
          content: `Starting hosted preview...`,
          timestamp: Date.now()
        });

        const serverPreviewUrl = await startServerHostedPreview(runtimeFiles, componentName);
        if (isLocalPreviewUrl(serverPreviewUrl)) {
          throw new Error('The server returned a local preview URL that cannot be opened from this browser.');
        }

        // Only auto-switch to preview if user is still on desktop tab
        setActiveTab((currentTab) => {
          if (currentTab === 'desktop') {
            return 'preview';
          }
          return currentTab; // Keep current tab if user manually switched
        });

        setLivePreviewUrl(serverPreviewUrl);
        setDevServerRunning(true);
        completedDeploySignatureRef.current = deploySignature;

        addChatMessage({
          role: 'assistant',
          content: `Preview is ready in the Preview tab.`,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      if (webContainerReady && !options.preferServerPreview && canFallbackToServerPreview(error)) {
        try {
          addChatMessage({
            role: 'assistant',
            content: `Browser preview did not expose a URL, so I'm starting a hosted preview instead...`,
            timestamp: Date.now()
          });

          const serverPreviewUrl = await startServerHostedPreview(runtimeFiles, componentName);
          if (isLocalPreviewUrl(serverPreviewUrl)) {
            throw new Error('The server returned a local preview URL that cannot be opened from this browser.');
          }

          setActiveTab((currentTab) => {
            if (currentTab === 'desktop') {
              return 'preview';
            }
            return currentTab;
          });

          setLivePreviewUrl(serverPreviewUrl);
          setDevServerRunning(true);
          completedDeploySignatureRef.current = deploySignature;

          addChatMessage({
            role: 'assistant',
            content: `Preview is ready in the Preview tab.`,
            timestamp: Date.now()
          });
          return;
        } catch (fallbackError) {
          console.error('Hosted preview fallback failed:', fallbackError);
          addChatMessage({
            role: 'assistant',
            content: `Preview could not start: ${formatPreviewError(fallbackError)} The generated files are still available to inspect and edit.`,
            timestamp: Date.now()
          });
          return;
        }
      }
      addChatMessage({
        role: 'assistant',
        content: `Preview could not start: ${formatPreviewError(error)} The generated files are still available to inspect and edit.`,
        timestamp: Date.now()
      });
    } finally {
      if (activeDeploySignatureRef.current === deploySignature) {
        activeDeploySignatureRef.current = null;
      }
    }
  }

  const form = useForm<PromptForm>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      userPrompt: "",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.7,
      projectType: 'react',
    },
  });

  // Fully AI-driven intent detection - NO keyword fallbacks
  const detectIntent = async (
    prompt: string, 
    hasExistingFiles: boolean, 
    fileCount: number
  ): Promise<{
    intent: 'deploy' | 'modify' | 'generate' | 'describe' | 'conversational';
    shouldGenerateCode: boolean;
    requiresProjectFiles: boolean;
    confidence: number;
    reasoning: string;
  }> => {
    try {
      // Call AI-based intent detection endpoint
      const response = await apiFetch('/api/intent/detect', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(sessionToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          hasExistingFiles,
          fileCount
        }),
      });

      if (!response.ok) {
        throw new Error(`Intent detection failed: ${response.status}`);
      }

      const result = await safeJsonParse(response);
      console.log('🤖 AI Intent Detection:', { 
        intent: result.intent, 
        confidence: result.confidence, 
        reasoning: result.reasoning,
        shouldGenerateCode: result.shouldGenerateCode,
        requiresProjectFiles: result.requiresProjectFiles
      });
      
      return {
        intent: result.intent,
        shouldGenerateCode: result.shouldGenerateCode ?? false,
        requiresProjectFiles: result.requiresProjectFiles ?? false,
        confidence: result.confidence ?? 0.8,
        reasoning: result.reasoning ?? 'AI classification'
      };
    } catch (error) {
      console.error('⚠️ AI intent detection failed:', error);
      // Safe fallback: conversational (won't break anything)
      return {
        intent: 'conversational',
        shouldGenerateCode: false,
        requiresProjectFiles: false,
        confidence: 0.5,
        reasoning: 'AI detection failed, defaulting to conversational'
      };
    }
  };

  // New mutation for playground chat (Elon)
  const playgroundChatMutation = useMutation({
    mutationFn: async (data: PromptForm) => {
      setError(null);
      
      // Note: User message is added optimistically in handleSubmit before mutation starts
      // So we don't add it here to avoid duplicates

      setIsLoading(true);
      const recentChatHistory = chatHistoryRef.current
        .slice(-10)
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .map(message => ({
          role: message.role,
          content: message.content
        }));

      // Call Elon playground chat endpoint
      const chatResponse = await apiFetch('/api/playground/chat', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(sessionToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: data.userPrompt,
          projectId: currentProject?.id || null,
          sessionId: currentSessionId || undefined,
          chatMode: isChatMode, // Tell backend we're in chat mode
          chatHistory: recentChatHistory,
        }),
      });

      if (!chatResponse.ok) {
        const errorData = await safeJsonParse(chatResponse).catch(() => ({}));
        throw new Error(errorData.message || 'Failed to process chat message');
      }

      const chatData = await safeJsonParse(chatResponse);

      // Add assistant response to chat
      if (chatData.response) {
        addChatMessage({
          role: 'assistant',
          content: chatData.response,
          timestamp: Date.now()
        });
      }

      // If code generation was triggered (improvedPrompt exists), listen for SSE events
      if (chatData.improvedPrompt && chatData.toolsUsed?.includes('generate_code')) {
        // Code generation was triggered - listen for SSE events via existing SSE connection
        // The generate_code tool will emit events that we're already listening to
        console.log('📝 Code generation triggered with improved prompt:', chatData.improvedPrompt);
      }

      return chatData;
    },
    onSuccess: (data) => {
      setIsLoading(false);
      // Clear form
      form.reset({
        userPrompt: "",
        model: form.getValues('model'),
        temperature: form.getValues('temperature'),
        projectType: form.getValues('projectType')
      });
    },
    onError: (error: any) => {
      setIsLoading(false);
      addChatMessage({
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
        timestamp: Date.now()
      });
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (data: PromptForm) => {
      setError(null);
      
      // **CHAT MODE CHECK - CRITICAL**
      // If Chat Mode is active, ALWAYS use chat endpoint, no intent detection needed
      if (isChatMode) {
        console.log('🔵 Chat Mode active - routing directly to Elon chat (no code generation)');
        return playgroundChatMutation.mutateAsync(data);
      }
      
      // Check if we have existing files
      const existingFiles = response?.files?.length ? response.files : currentSession?.generatedFiles || [];
      
      const hasExistingFiles = existingFiles.length > 0;
      const intentResult = await detectIntent(data.userPrompt, hasExistingFiles, existingFiles.length);
      const { intent, shouldGenerateCode, requiresProjectFiles } = intentResult;

      // If intent is conversational, use Elon chat instead
      // Note: User message is added optimistically in handleSubmit before mutation starts
      if (intent === 'conversational') {
        // Use playground chat mutation for conversational requests
        return playgroundChatMutation.mutateAsync(data);
      }

      // Note: User message is added optimistically in handleSubmit before mutation starts
      // So we don't add it here to avoid duplicates

      // If intent is to describe, analyze project and return description without generation
      if (intent === 'describe' && hasExistingFiles) {
        try {
          setIsLoading(true);
          addChatMessage({
            role: 'assistant',
            content: '📖 Analyzing your project...',
            timestamp: Date.now()
          });

          const describeResponse = await apiFetch('/api/project/describe', {
            method: 'POST',
            headers: {
              ...getAuthHeaders(sessionToken),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: existingFiles,
              projectId: params?.projectId || null
            }),
          });

          const describeData = await safeJsonParse(describeResponse);
          
          if (describeData.success && describeData.description) {
            addChatMessage({
              role: 'assistant',
              content: describeData.description,
              timestamp: Date.now()
            });
          } else {
            throw new Error(describeData.error || 'Failed to generate description');
          }
        } catch (error: any) {
          console.error('Failed to describe project:', error);
          addChatMessage({
            role: 'assistant',
            content: `❌ Sorry, I couldn't analyze the project: ${error.message || 'Unknown error'}`,
            timestamp: Date.now()
          });
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // If intent is to deploy and we have files, skip generation and just deploy
      if (intent === 'deploy' && hasExistingFiles && requiresProjectFiles) {
        console.log('🚀 Detected deploy intent - reusing existing files');
        
        addChatMessage({
          role: 'assistant',
          content: `🔄 Restarting dev server with your existing ${existingFiles.length} files...`,
          timestamp: Date.now()
        });
        
        // Clear the form input
        form.reset({
          userPrompt: "",
          model: data.model,
          temperature: data.temperature,
          projectType: data.projectType
        });
        
        // Only switch to preview if user is still on desktop tab
        // This allows them to see the generation animation first
        setActiveTab((currentTab) => {
          if (currentTab === 'desktop') {
            return 'preview';
          }
          return currentTab; // Keep current tab if user manually switched
        });
        
        // Get component name from existing files or use default
        const componentName = currentComponentName || 'App';
        
        // Deploy existing files
        setTimeout(() => {
          deployToRuntime(existingFiles, componentName);
        }, 500);
        
        // Return early - don't call generation API
        return { response: { type: 'text', text: 'Deploying existing files...', files: existingFiles } };
      }

      try {
        const apiKeyCheckResponse = await apiFetch('/api/api-keys/check-requirements', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: data.userPrompt,
            projectId: currentProject?.id || null,
          }),
        });

        if (apiKeyCheckResponse.ok) {
          const apiKeyCheck = await safeJsonParse(apiKeyCheckResponse);
          const missingKeys = Array.isArray(apiKeyCheck.missingKeys)
            ? apiKeyCheck.missingKeys
            : [];

          if (apiKeyCheck.requiresUpgrade && missingKeys.length > 0) {
            setPendingGenerationAfterApiKeys(null);
            addChatMessage({
              role: 'assistant',
              content: 'This app needs external API keys for production features like auth, payments, databases, or uploads. Project API keys are available on paid plans, so please upgrade before I generate this version.',
              timestamp: Date.now()
            });
            toast({
              title: 'Upgrade required',
              description: apiKeyCheck.message || 'Project API keys are available on paid plans.',
              variant: 'destructive',
            });
            return { handled: true, response: { type: 'text', text: '', files: [] } } as any;
          }

          if (!apiKeyCheck.hasAllKeys && missingKeys.length > 0) {
            setPendingGenerationAfterApiKeys(data);
            setProjectAPIKeyDialogData({
              missingApiKeys: missingKeys,
              projectId: currentProject?.id || null,
              projectName: currentProject?.name,
            });
            setShowProjectAPIKeyDialog(true);
            addChatMessage({
              role: 'assistant',
              content: 'I need a few project API keys before I can generate this as a functional app. Add them now and I’ll continue with the same prompt.',
              timestamp: Date.now()
            });
            return { handled: true, response: { type: 'text', text: '', files: [] } } as any;
          }
        } else {
          const apiKeyError = await safeJsonParse(apiKeyCheckResponse).catch(() => null);
          if (apiKeyCheckResponse.status === 402) {
            addChatMessage({
              role: 'assistant',
              content: apiKeyError?.message || 'This request requires a paid plan before generation can continue.',
              timestamp: Date.now()
            });
            toast({
              title: 'Upgrade required',
              description: apiKeyError?.message || 'Upgrade to continue.',
              variant: 'destructive',
            });
            return { handled: true, response: { type: 'text', text: '', files: [] } } as any;
          }
        }
      } catch (error) {
        console.warn('API key preflight failed, continuing generation:', error);
      }
      
      // Clear old files if this is a NEW generation (not a modification)
      // For modifications, we preserve existing files for context
      const shouldClearFiles = intent === 'generate' && !requiresProjectFiles;
      
      if (shouldClearFiles) {
        console.log('🆕 New generation detected - clearing old files');
        
        // Clear streaming state
        streamingContentRef.current.forEach((streamState) => {
          if (streamState.intervalId) {
            clearInterval(streamState.intervalId);
          }
        });
        streamingContentRef.current.clear();
        
        setResponse(null);
        updateGeneratedFiles([]);
        setSelectedFileIndex(0);
        setLivePreviewUrl(null);
        setCurrentComponentName('');
        setError(null);
      } else {
        console.log('🔄 Modification/deploy intent - preserving existing files');
      }

      // Clear the form input after sending
      form.reset({
        userPrompt: "",
        model: data.model,
        temperature: data.temperature,
        projectType: data.projectType
      });

      // Keep user on desktop tab to see generation animation
      // Only switch to preview when dev server is ready (handled elsewhere)
      console.log('🎨 Starting generation - staying on desktop tab to show animation');

      // Small delay to let the tab switch be visible, then start loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsLoading(true);
      console.log('â³ Loading started - glow effect should be visible');

      // âœ¨ Calculate relevance score for the prompt
      try {
        const relevanceRes = await apiFetch('/api/knowledge/calculate-relevance', {
          method: 'POST',
          headers: getAuthHeaders(sessionToken),
          body: JSON.stringify({ query: data.userPrompt })
        });
        
        if (relevanceRes.ok) {
          const relevanceResults = await safeJsonParse(relevanceRes);
          setRelevanceData(relevanceResults);
          
          // Calculate average relevance score
          if (relevanceResults.length > 0) {
            const avgScore = relevanceResults.reduce((acc: number, item: any) => 
              acc + (item.relevanceScore || 0), 0) / relevanceResults.length;
            setRelevanceScore(Math.round(avgScore * 100));
          }
        }
      } catch (err) {
        console.error('Failed to calculate relevance:', err);
      }

      // âœ¨ Bolt.new-style: Add immediate AI greeting with more personality
      const appType = data.userPrompt.toLowerCase().includes('timer') ? 'timer' :
                      data.userPrompt.toLowerCase().includes('todo') ? 'todo list' :
                      data.userPrompt.toLowerCase().includes('calculator') ? 'calculator' : 
                      data.userPrompt.toLowerCase().includes('dashboard') ? 'dashboard' :
                      data.userPrompt.toLowerCase().includes('chart') ? 'chart' :
                      data.userPrompt.toLowerCase().includes('form') ? 'form' : 'app';
      
      const isExistingProject = currentProject?.id;
      
      addChatMessage({
        role: 'assistant',
        content: isExistingProject 
          ? `Perfect! I'll enhance your ${appType} with those changes. Let me get to work! âœ¨`
          : `I'll get started on your ${appType} right away! ðŸŽ¯`,
        timestamp: Date.now()
      });

      // Status messages removed - SSE stream shows real progress instead
      // The SSE stream shows real progress via PLAN_CREATED and PHASE_PROGRESS events

      // Reset progress tracking
      setOrchestrationSteps([]);
      setCurrentStep('');
      setOverallProgress(0);

      // Prepare request body with project context
      // Include chat history so the AI can understand context from previous messages
      // (e.g., if user discussed a Python app, then says "go ahead", we know it's Python)
      const recentChatHistory = chatHistory
        .slice(-10) // Last 10 messages for context
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      const requestBody: any = {
        ...data,
        systemPrompt: SYSTEM_PROMPT,
        orchestration: true, // Always use multi-agent orchestration
        incrementalGeneration: true, // ALWAYS ON: Incremental generation is the standard way
        sessionId: currentSessionId,
        projectId: currentProject?.id, // Pass project ID if working in a project context
        projectType: data.projectType,
        chatHistory: recentChatHistory, // Pass chat history for context awareness
      };

      // If we have existing files and it requires project context, pass them directly
      // This ensures the AI has the latest file contents even if projectId lookup fails
      if (shouldGenerateCode && requiresProjectFiles && hasExistingFiles && existingFiles.length > 0) {
        requestBody.existingFiles = existingFiles.map(f => ({
          path: f.path,
          content: f.content
        }));
        console.log(`📦 Passing ${existingFiles.length} existing files for context`);
      }

      const res = await apiFetch("/api/prompts/generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(sessionToken),
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await safeJsonParse(res).catch(() => ({ error: 'Unknown error' }));
        throw new Error(JSON.stringify(errorData));
      }

      // Check if this is an SSE response or regular JSON
      const contentType = res.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Handle SSE stream for real-time progress updates
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: any = null;

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Handle null/undefined values and ensure proper type
              if (value) {
                try {
                  // TextDecoder.decode accepts Uint8Array directly
                  buffer += decoder.decode(value, { stream: true });
                } catch (decodeError) {
                  console.warn('TextDecoder decode error, skipping chunk:', decodeError);
                  // Skip this chunk and continue
                }
              }
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    // Handle different SSE event types
                    if (data.type === 'INCREMENTAL_GENERATION_START') {
                      console.log('🔄 Incremental generation started:', data.data);
                      setStatusMessages([]);
                      addStatusMessage('Starting incremental code generation...', 'progress');
                    } else if (data.type === 'PLAN_CREATED') {
                      console.log('📋 Generation plan created:', data.data);
                      const plan = data.data.plan;
                      addStatusMessage(`Created generation plan: ${plan.appName} with ${plan.phases.length} phases`, 'progress');
                    } else if (data.type === 'PHASE_PROGRESS') {
                      console.log('⏳ Phase progress:', data.data);
                      setCurrentStep(`Phase: ${data.data.phase} - ${data.data.message}`);
                      setOverallProgress(data.data.progress || 0);
                      addStatusMessage(`${data.data.phase}: ${data.data.message} (${Math.round(data.data.progress)}%)`, 'progress');
                    } else if (data.type === 'STEP_START') {
                    console.log('ðŸ“ Step started:', data.data);
                    setCurrentStep(data.data.details || '');
                    setOverallProgress(data.data.progress || 0);
                    addStatusMessage(data.data.details || data.data.task || 'Processing...', 'progress');
                    
                    // Update orchestration steps
                    setOrchestrationSteps(prev => {
                      const existing = prev.find(s => s.agent === data.data.agent);
                      if (existing) {
                        return prev.map(s => 
                          s.agent === data.data.agent 
                            ? { ...s, status: 'in_progress' as const }
                            : s
                        );
                      } else {
                        return [...prev, {
                          agent: data.data.agent || 'AI Agent',
                          task: data.data.details || '',
                          status: 'in_progress' as const,
                          dependencies: []
                        }];
                      }
                    });

                  } else if (data.type === 'STEP_COMPLETE') {
                    console.log('âœ… Step completed:', data.data);
                    setOverallProgress(data.data.progress || 0);
                    
                    // Mark step as completed
                    setOrchestrationSteps(prev => prev.map(s => 
                      s.agent === data.data.agent 
                        ? { ...s, status: 'completed' as const }
                        : s
                    ));

                    addStatusMessage(data.data.result || 'Step completed', 'success');
                  } else if (data.type === 'FILE_GENERATED') {
                    const filePath = data.data?.file?.path;
                    if (!filePath || typeof filePath !== 'string') {
                      console.warn('FILE_GENERATED event missing valid file path');
                      return;
                    }
                    console.log('📄 File generated:', filePath);
                    const fullContent = data.data.file?.content || '';

                    // Add file to response with empty content initially (will be streamed)
                    setResponse(prev => {
                      // Create file with empty content initially - will be streamed
                      const generatedFile = createGeneratedFile(filePath, '');

                      if (!prev) {
                        const newResponse: PlaygroundResponse = {
                          type: 'component',
                          text: '',
                          files: [generatedFile]
                        };
                        // Auto-select first file when it arrives, but don't switch tabs
                        // This allows user to see generation animation on desktop tab
                        if (data.data.index === 1 && filePath) {
                          setTimeout(() => {
                            setSelectedFileIndex(0);
                            setEditorLanguage(getFileLanguage(filePath));
                            // Don't switch tabs - let user see animation, switch will happen when dev server is ready
                          }, 0);
                        }
                        // Start streaming content
                        streamFileContent(filePath, fullContent, (streamedContent) => {
                          setResponse(current => {
                            if (!current || !current.files) return current;
                            const updatedFiles = current.files.map(f => 
                              f.path === filePath ? { ...f, content: streamedContent } : f
                            );
                            // Update workspace with full content (for persistence) but display streamed
                            if (streamedContent === fullContent) {
                              updateGeneratedFiles(updatedFiles);
                            }
                            return { ...current, files: updatedFiles };
                          });
                        });
                        return newResponse;
                      }

                      // Check if file already exists (avoid duplicates)
                      const existingIndex = prev.files?.findIndex(f => f.path === filePath);
                      let updatedFiles: GeneratedFile[];
                      let fileIndex: number;
                      
                      if (existingIndex !== undefined && existingIndex >= 0 && prev.files) {
                        // Update existing file (restart streaming if needed)
                        updatedFiles = [...prev.files];
                        updatedFiles[existingIndex] = { ...updatedFiles[existingIndex], content: '' };
                        fileIndex = existingIndex;
                      } else {
                        // Add new file
                        updatedFiles = [...(prev.files || []), generatedFile];
                        fileIndex = updatedFiles.length - 1;
                      }

                      // Select the currently generating file, but don't switch tabs
                      // This allows user to see generation animation on desktop tab
                      // Tab switch will happen automatically when dev server is ready
                      if (filePath) {
                        setTimeout(() => {
                          setSelectedFileIndex(fileIndex);
                          setEditorLanguage(getFileLanguage(filePath));
                          // Don't switch tabs - let user see animation, switch will happen when dev server is ready
                        }, 0);
                      }

                      // Start streaming content with typewriter effect
                      streamFileContent(filePath, fullContent, (streamedContent) => {
                        setResponse(current => {
                          if (!current || !current.files) return current;
                          const updatedFiles = current.files.map(f => 
                            f.path === filePath ? { ...f, content: streamedContent } : f
                          );
                          // Update workspace with full content when streaming completes
                          if (streamedContent === fullContent) {
                            updateGeneratedFiles(updatedFiles);
                            
                            // Mark stream as complete
                            const streamState = streamingContentRef.current.get(filePath);
                            if (streamState) {
                              streamState.isComplete = true;
                              streamingContentRef.current.set(filePath, streamState);
                              
                              // Check if all streams are complete and we're waiting to deploy
                              const allComplete = Array.from(streamingContentRef.current.values()).every(s => s.isComplete);
                              if (allComplete && waitingForTypewriter) {
                                console.log('✅ All typewriter effects complete (SSE), ready to deploy');
                                setWaitingForTypewriter(false);
                                // Get current files for deployment
                                const currentFiles = current?.files || [];
                                const componentName = currentComponentName || 'App';
                                deployToRuntime(currentFiles.map(f => ({ path: f.path, content: f.content })), componentName);
                              }
                            }
                          }
                          return { ...current, files: updatedFiles };
                        });
                      });

                      const newResponse = {
                        ...prev,
                        files: updatedFiles
                      };
                      console.log('✅ Started streaming file:', filePath);
                      return newResponse;
                    });

                    // Removed chat messages - files update silently in real-time via setResponse above
                  } else if (data.type === 'PROJECT_CONTEXT_LOADED') {
                    addStatusMessage(data.data.message || 'Loaded project context', 'info');
                  } else if (data.type === 'AUTO_FIXING') {
                    // Silently handle auto-fixing - don't show to user, just log
                    console.log('🔧 Auto-fixing errors:', data.data);
                  } else if (data.type === 'AUTO_FIX_COMPLETE') {
                    // Silently handle auto-fix completion - errors were fixed automatically
                    console.log('✅ Auto-fix complete:', data.data);
                    // Only show message if there are still remaining errors after auto-fix
                    if (data.data.remainingErrors > 0 || data.data.remainingWarnings > 0) {
                      addStatusMessage(data.data.message || `Fixed errors automatically. ${data.data.remainingErrors} error${data.data.remainingErrors !== 1 ? 's' : ''} and ${data.data.remainingWarnings} warning${data.data.remainingWarnings !== 1 ? 's' : ''} remain.`, 'warning');
                    }
                  } else if (data.type === 'ERROR_CHECK_COMPLETE') {
                    console.log('🔍 Error check complete', data.data);
                    const { errors = [], warnings = [], summary } = data.data || {};
                    
                    // Ensure errors and warnings are arrays
                    const errorArray = Array.isArray(errors) ? errors : [];
                    const warningArray = Array.isArray(warnings) ? warnings : [];
                    
                    console.log('📊 Error check results:', {
                      errors: errorArray.length,
                      warnings: warningArray.length,
                      summary
                    });
                    
                    // Only show errors to user if they couldn't be auto-fixed
                    // (fixable errors are already fixed by backend)
                    const unfixableErrors = errorArray.filter(e => !e.fixable);
                    const unfixableWarnings = warningArray.filter(e => !e.fixable);
                    
                    if (summary && (unfixableErrors.length > 0 || unfixableWarnings.length > 0)) {
                      let errorMessage = `⚠️ Found ${unfixableErrors.length} error${unfixableErrors.length !== 1 ? 's' : ''}`;
                      if (unfixableWarnings.length > 0) {
                        errorMessage += ` and ${unfixableWarnings.length} warning${unfixableWarnings.length !== 1 ? 's' : ''}`;
                      }
                      errorMessage += ' that need manual attention.';
                      
                      console.log('📝 Adding error message to chat:', {
                        content: errorMessage,
                        errors: unfixableErrors.length,
                        warnings: unfixableWarnings.length
                      });
                      
                      addChatMessage({
                        role: 'assistant',
                        content: errorMessage,
                        timestamp: Date.now(),
                        errors: unfixableErrors,
                        warnings: unfixableWarnings,
                        errorSummary: {
                          total: unfixableErrors.length + unfixableWarnings.length,
                          errors: unfixableErrors.length,
                          warnings: unfixableWarnings.length,
                          info: 0,
                          fixable: 0
                        }
                      });
                    } else if (summary && summary.total === 0) {
                      addStatusMessage('No errors found. Code looks good.', 'success');
                    }
                    // If all errors were auto-fixed, don't show anything (silent success)
                  } else if (data.type === 'COMPLETE' || data.type === 'GENERATION_COMPLETE' || data.type === 'FINAL_RESPONSE') {
                    console.log('🎉 Generation complete', data.data);
                    // Format finalResult to match expected structure with files
                    finalResult = data.data?.response ? data.data : {
                      response: {
                        type: 'component',
                        text: data.data?.files?.[0]?.content || data.data?.files?.find((f: any) => f.path?.includes('App.tsx'))?.content || '',
                        files: data.data?.files || data.data?.response?.files || []
                      },
                      ...data.data
                    };
                    console.log('📁 Final result files:', finalResult.response?.files?.length);
                    const generationReady = isGenerationReadyForPreview(finalResult);
                    
                    // Show error summary if present
                    if (data.data?.errorSummary && data.data.errorSummary.total > 0) {
                      const { errorSummary } = data.data;
                      addChatMessage({
                        role: 'assistant',
                        content: `📊 Generation complete! Found ${errorSummary.errors} error${errorSummary.errors !== 1 ? 's' : ''} and ${errorSummary.warnings} warning${errorSummary.warnings !== 1 ? 's' : ''}. Check the errors above for details.`,
                        timestamp: Date.now()
                      });
                    } else {
                      addStatusMessage('Generation finished. Preparing preview...', 'success');
                    }

                    // 🚀 Auto-deploy to WebContainer if files are available
                    if (finalResult.response?.files && finalResult.response.files.length > 0) {
                      const displayFiles = mapRawFilesToGenerated(finalResult.response.files);
                      const componentName = currentComponentName || 'App';
                      const previewContract = validatePreviewContract(normalizeRuntimeFiles(displayFiles));
                      const canAutoPreview = generationReady && previewContract.valid;
                      
                      if (canAutoPreview) {
                        console.log('🚀 Auto-deploying to WebContainer after generation complete...');
                        setTimeout(() => {
                          deployToRuntime(displayFiles, componentName);
                        }, 500);
                      } else if (!previewContract.valid) {
                        console.warn('Skipping auto-preview because generated files failed preview contract', previewContract);
                        addChatMessage({
                          role: 'assistant',
                          content: `Files were generated, but preview will wait until Elon fixes these blocking issues:\n${formatPreviewContractIssues(previewContract)}`,
                          timestamp: Date.now()
                        });
                      } else {
                        console.log('Skipping auto-preview because generation did not pass validation');
                      }
                    } else if (!generationReady) {
                      console.log('Skipping auto-preview because generation did not pass validation');
                    }
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE event:', line, e);
                }
              }
            }
            }
          } catch (e) {
            // Handle stream errors gracefully (stream might be closed)
            if (e instanceof TypeError && e.message.includes('ReadableStream')) {
              console.warn('Stream was closed, ending read operation');
            } else {
              console.error('Error reading stream:', e);
            }
            // Exit loop on error - use return instead of break to avoid crossing function boundary
            return finalResult || { response: { type: 'text', text: 'Generation completed but no response received', files: [] } };
          } finally {
            // Ensure reader is released
            try {
              reader.releaseLock();
            } catch (e) {
              // Ignore errors when releasing lock
            }
          }
        }

        // Return the final result
        return finalResult || { response: { type: 'text', text: 'Generation completed but no response received', files: [] } };
      } else {
        // Regular JSON response (backend didn't send SSE)
        console.log('ðŸ"¦ Received regular JSON response (not SSE)');
        return await safeJsonParse(res);
      }
    },
    onSuccess: async (data: GenerateResponse) => {
      if ((data as any)?.handled) {
        setIsLoading(false);
        return;
      }

      console.log('ðŸŽ¯ Generation response received:', data);
      console.log('ðŸ“ Files in response:', data.response?.files);
      
      // Silent validation - log but don't show errors to user
      if (!data || !data.response) {
        console.warn('Invalid response structure, system will retry:', data);
        // Keep loading state active - AI will self-correct
        return;
      }

      if (data.response.type === 'component') {
        // Silent validation - if no files, system will retry automatically
        if (!data.response.files || data.response.files.length === 0) {
          console.warn('No files in response, system will retry with enhanced prompt');
          // Keep loading state active - AI will self-correct
          return;
        }

        // âœ¨ Display files one by one with animation - BOLT.NEW STYLE!
        const displayFiles = mapRawFilesToGenerated(data.response.files);
        const generationReady = isGenerationReadyForPreview(data);

        console.log('ðŸ"‚ Files to display:', displayFiles.length);

        // Extract a better component name from the user's prompt
        const promptText = form.getValues('userPrompt');
        let componentName = 'App';
        
        // Remove common words and extract meaningful nouns
        const cleanPrompt = (promptText || '')
          .toLowerCase()
          .replace(/\b(make|build|create|generate|a|an|the|for|me|my|app|application|website|web|site)\b/gi, ' ')
          .trim();
        
        // Extract first meaningful word (3+ chars)
        const words = cleanPrompt.split(/\s+/).filter(w => w.length >= 3);
        if (words.length > 0) {
          componentName = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        }
        
        setCurrentComponentName(componentName);
        console.log('ðŸ·ï¸ Component name set:', componentName);
        
        // Fix file paths: move config files to root for display (matches deployment)
        const fixedDisplayFiles = displayFiles.map((file: GeneratedFile) => {
          const filename = file.path?.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path?.startsWith('src/')) {
            console.log(`ðŸ“¦ Moving ${file.path} â†’ ${filename} (root level for display)`);
            return createGeneratedFile(filename, file.content);
          }
          return file;
        });

        // Log what files were generated for debugging
        console.log('ðŸ"¦ Files generated by AI:', fixedDisplayFiles.map((f: GeneratedFile) => f.path));
        
        // Validate critical files and imports before preview is allowed.
        const previewContract = validatePreviewContract(normalizeRuntimeFiles(fixedDisplayFiles));
        const canAutoPreview = generationReady && previewContract.valid;
        
        if (!previewContract.valid) {
          console.error('âŒ PREVIEW CONTRACT FAILED:', previewContract);
          console.error('Generated files:', fixedDisplayFiles.map((f: GeneratedFile) => f.path));
          
          addChatMessage({
            role: 'assistant',
            content: `Files were generated, but preview will wait until Elon fixes these blocking issues:\n${formatPreviewContractIssues(previewContract)}`,
            timestamp: Date.now()
          });
        }
        
        // âœ… INSTANT FILE DISPLAY - Show all files immediately for better UX
        setResponse({
          type: 'component',
          text: data.response.text,
          files: fixedDisplayFiles // Show all files at once with corrected paths
        });

        // Update generated files in workspace context for persistence
        updateGeneratedFiles(fixedDisplayFiles);

        // Add summary chat message
        if (canAutoPreview) {
          addChatMessage({
            role: 'assistant',
            content: `Files are ready. Starting the preview now...`,
            timestamp: Date.now()
          });
        } else if (previewContract.valid) {
          addChatMessage({
            role: 'assistant',
            content: `Files were generated, but preview will stay off until the blocking validation errors are fixed.`,
            timestamp: Date.now()
          });
        }
        
        setIsLoading(false);
        console.log('âœ… All files displayed!');
        
        // Deploy only when the backend says this generation is valid.
        if (canAutoPreview) {
          setTimeout(() => {
            deployToRuntime(fixedDisplayFiles, componentName);
          }, 500); // Small delay for UI to update
        }

        // Save chat messages and files to project if we're in a project context
        if (currentProject?.id && sessionToken) {
          const userMessage = form.getValues('userPrompt');
          
          // Save user message
          apiFetch(`/api/workspaces/${currentProject.id}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(sessionToken),
            body: JSON.stringify({
              message: userMessage,
              messageType: 'user',
              metadata: { timestamp: Date.now() }
            })
          }).catch(err => console.error('Failed to save user message:', err));
          
          // Save AI response
          apiFetch(`/api/workspaces/${currentProject.id}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(sessionToken),
            body: JSON.stringify({
              message: `Generated ${data.response.files?.length || 0} files for your ${componentName} component.`,
              messageType: 'assistant',
              metadata: { 
                timestamp: Date.now(),
                files: data.response.files?.map((f: any) => f.path) || []
              }
            })
          }).catch(err => console.error('Failed to save AI message:', err));

          // Save generated files to project immediately (no arbitrary delay)
          if (currentProject?.id) {
            apiFetch(`/api/workspaces/${currentProject.id}/files`, {
              method: 'POST',
              headers: getAuthHeaders(sessionToken),
              body: JSON.stringify({
                files: displayFiles,
                componentName: componentName
              })
            })
              .then(async (response) => {
                if (response.ok) {
                  console.log('âœ… Files saved to project');
                  addStatusMessage(`Saved ${displayFiles.length} files to workspace`, 'success');
                } else {
                  const error = await response.text();
                  console.error('Failed to save files:', error);
                  addChatMessage({
                    role: 'assistant',
                    content: `âš ï¸ Warning: Could not save files to workspace. Files are still available in this session. Error: ${error}`,
                    timestamp: Date.now()
                  });
                }
              })
              .catch(err => {
                console.error('Failed to save files to project:', err);
                addChatMessage({
                  role: 'assistant',
                  content: `â š ï¸ Warning: Could not save files to workspace. Files are still available in this session. Please try regenerating.`,
                  timestamp: Date.now()
                });
              });
          } else {
            console.warn('â š ï¸ No project ID - files will only be saved to session');
          }
        }
      } else {
        // Merge text responses into chat without resetting state
        if (data.response?.type === 'text') {
          addChatMessage({ role: 'assistant', content: data.response.text, timestamp: Date.now() });
        } else if (data.response) {
          setResponse(prev => {
            if (prev?.files && data.response?.files) {
              // Merge files by path, preserving existing
              const existing = new Map(prev.files.map(f => [f.path, f]));
              const newFiles = mapRawFilesToGenerated(data.response.files);
              for (const file of newFiles) {
                existing.set(file.path, file);
              }
              return { ...prev, files: Array.from(existing.values()) };
            }
            return toPlaygroundResponse(data.response);
          });
        }
      setIsLoading(false);
      }
    },
    onError: (error) => {
      setIsLoading(false);
      try {
        const errorData = JSON.parse(error.message);
        setError({
          message: errorData.error,
          suggestion: errorData.suggestion
        });
      } catch {
        setError({
          message: "An unexpected error occurred",
          suggestion: "Please try again later"
        });
      }
      // Do not clear response on error; append error to chat
      addChatMessage({ role: 'assistant', content: 'âŒ Generation failed. Please try again.', timestamp: Date.now() });
    },
  });

  // Optimistic submit handler - adds user message instantly before mutation
  const handleSubmit = useCallback((data: PromptForm) => {
    // Add user message optimistically for instant UI feedback
    addChatMessage({
      role: 'user',
      content: data.userPrompt,
      timestamp: Date.now()
    });
    
    // Clear input immediately for better UX
    form.reset({
      userPrompt: "",
      model: form.getValues('model'),
      temperature: form.getValues('temperature'),
      projectType: form.getValues('projectType')
    });
    
    // Then trigger the mutation
    generateMutation.mutate(data);
  }, [addChatMessage, generateMutation, form]);

  // Handle prompt from URL (from homepage) and Elon prompts
  useEffect(() => {
    if (!hasProjectRoute) return; // Only process prompts when we have a project route
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlPrompt = urlParams.get('prompt') || localStorage.getItem('pendingPrompt');
    
    if (urlPrompt && user) {
      form.setValue('userPrompt', urlPrompt);
      localStorage.removeItem('pendingPrompt');
      setTimeout(() => {
        const formData = form.getValues();
        generateMutation.mutate(formData);
      }, 500);
    }

    if (!user || !currentSession) return;
    
    const pendingPrompt = getPendingPrompt();
    if (pendingPrompt && pendingPrompt.prompt && pendingPrompt.prompt !== processedPromptRef.current) {
      processedPromptRef.current = pendingPrompt.prompt;
      form.setValue('userPrompt', pendingPrompt.prompt);
      clearPendingPrompt();
      setTimeout(() => {
        const formData = form.getValues();
        generateMutation.mutate(formData);
      }, 800);
    }
  }, [hasProjectRoute, user, currentSession, form, generateMutation, getPendingPrompt, clearPendingPrompt]);

  useEffect(() => {
    if (!hasProjectRoute || !registerPlaygroundActionListener) return;
    
    const unsubscribe = registerPlaygroundActionListener(async (action: PlaygroundAction) => {
      if (action.type === 'runPrompt') {
        const prompt = action.prompt?.trim();
        if (prompt) {
          form.setValue('userPrompt', prompt);
          setTimeout(() => {
            generateMutation.mutate(form.getValues());
          }, 300);
        }
      }
    });

    return unsubscribe;
  }, [hasProjectRoute, registerPlaygroundActionListener, form, generateMutation]);

  // Early return for desktop view when no project route - moved to conditional rendering
  if (!hasProjectRoute) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    if (isMobile) {
      return (
        <>
          {createProjectDialog}
          <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <span className="font-bold">Elon</span>
              </div>
              <div className="flex items-center gap-2">
                {isFreeUser && (
                  <Button size="sm" variant="outline" onClick={() => setLocation('/pricing')}>
                    <Crown className="h-4 w-4 mr-1" />
                    Upgrade
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowCreateProjectDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
            </div>
            
            {/* Project List */}
            <div className="flex-1 p-4">
              <h2 className="text-lg font-semibold mb-4">Your Apps</h2>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (userProjects?.length || 0) > 0 ? (
                <div className="space-y-3">
                  {userProjects?.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => setLocation(`/playground/${project.id}`)}
                      className="w-full p-4 bg-card rounded-xl border border-border text-left hover:bg-accent transition-colors"
                    >
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description || 'No description'}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">No apps yet</p>
                  <Button onClick={() => setShowCreateProjectDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First App
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }
    
    return (
      <>
        {createProjectDialog}
        <div className="h-screen flex flex-col bg-background">
          {/* Navigation Header */}
          <div className="h-14 sm:h-16 border-b bg-card/80 backdrop-blur flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Elon</span>
              <Badge variant="secondary" className="text-[10px]">Desktop</Badge>
            </div>
            <div className="flex items-center gap-2">
              {isFreeUser && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/pricing')}
                >
                  <Crown className="h-4 w-4 mr-1.5" />
                  Upgrade
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCreateProjectDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New App
              </Button>
            </div>
          </div>
          
          {/* Desktop View - Constrained but fills screen */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50 overflow-auto">
            {isLoadingProjects ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground">Loading your workspace...</p>
                </div>
              </div>
            ) : (
              <div 
                className="relative overflow-hidden rounded-lg shadow-xl"
                style={{
                  width: 'min(1200px, calc(100vw - 2rem))',
                  height: 'min(750px, calc(100vh - 8rem))',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              >
                <DesktopView
                  projects={userProjects || []}
                  currentProjectId={undefined}
                  onSelectProject={(projectId) => {
                    setLocation(`/playground/${projectId}`);
                  }}
                  onCreateProject={() => setShowCreateProjectDialog(true)}
                  onEditProject={(projectId) => {
                    setLocation(`/playground/${projectId}`);
                  }}
                  webContainerService={webContainerService}
                  isWebContainerReady={webContainerReady}
                />
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background pt-14 sm:pt-16">
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('Playground error:', error, errorInfo);
          toast({
            title: "Error",
            description: "An error occurred. Please try refreshing the page.",
            variant: "destructive",
          });
        }}
      >
      {/* Top Bar - Project info and actions */}
      <div className="h-14 md:h-16 min-h-[3.5rem] md:min-h-[4rem] border-b flex items-center justify-between px-3 md:px-6 bg-gradient-to-r from-background via-muted/30 to-background flex-shrink-0 shadow-sm pt-2 md:pt-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          {currentProject && (
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <div className="flex items-center px-2 md:px-3 py-1 md:py-1.5 bg-brand-gradient-subtle rounded-full border border-purple-200 dark:border-purple-800 shadow-sm hover-lift transition-smooth">
                <Laptop className="h-3 w-3 md:icon-xs mr-1 md:mr-2 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <span className="text-[10px] md:text-xs font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap">{currentProject.name}</span>
              </div>
              {/* Workspace Type Badge */}
              {currentProject.workspaceType === 'team' ? (
                <div className="flex items-center px-1.5 md:px-2 py-0.5 md:py-1 bg-blue-500/20 dark:bg-blue-500/30 rounded-full border border-blue-500/40 dark:border-blue-500/50 transition-smooth flex-shrink-0">
                  <Users className="h-3 w-3 md:icon-xs mr-1 md:mr-1.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] md:text-xs font-medium text-blue-700 dark:text-blue-300 hidden sm:inline">Team</span>
                </div>
              ) : (
                <div className="flex items-center px-1.5 md:px-2 py-0.5 md:py-1 bg-green-500/20 dark:bg-green-500/30 rounded-full border border-green-500/40 dark:border-green-500/50 transition-smooth flex-shrink-0">
                  <User className="h-3 w-3 md:icon-xs mr-1 md:mr-1.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-[10px] md:text-xs font-medium text-green-700 dark:text-green-300 hidden sm:inline">Personal</span>
                </div>
              )}
            </div>
          )}
          
          {/* Superadmin Only - Status Indicators */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5 md:gap-2 text-body-sm flex-shrink-0">
              <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1 bg-muted/50 rounded-full flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? "bg-purple-500 animate-pulse" : "bg-green-500"}`}></div>
                <span className="text-[10px] md:text-xs font-medium text-foreground">{isLoading ? "Working" : "Ready"}</span>
              </div>
              <div className="hidden lg:flex items-center gap-1 md:gap-1.5">
                <div className="flex items-center px-2 py-1 bg-blue-500/10 dark:bg-blue-500/20 rounded-full flex-shrink-0">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></div>
                  <span className="text-[10px] md:text-xs font-medium text-blue-600 dark:text-blue-400">Orchestration</span>
                </div>
                <div className="flex items-center px-2 py-1 bg-green-500/10 dark:bg-green-500/20 rounded-full flex-shrink-0">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>
                  <span className="text-[10px] md:text-xs font-medium text-green-600 dark:text-green-400">Incremental</span>
                </div>
              </div>
              {/* WebContainer Status */}
              <div className={`hidden md:flex items-center px-2 py-1 rounded-full flex-shrink-0 ${
                webContainerReady ? 'bg-green-500/10 dark:bg-green-500/20' :
                webContainerBooting ? 'bg-yellow-500/10 dark:bg-yellow-500/20' :
                'bg-muted/50'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  webContainerReady ? 'bg-green-500' :
                  webContainerBooting ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-400'
                }`}></div>
                <span className={`text-[10px] md:text-xs font-medium ${
                  webContainerReady ? 'text-green-600 dark:text-green-400' :
                  webContainerBooting ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-muted-foreground'
                }`}>
                  {webContainerReady ? 'Server' :
                   webContainerBooting ? 'Booting' :
                   webContainerSupport.supported ? 'Server' : 'Preview unavailable'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Compact on mobile */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {isFreeUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/pricing')}
              className="hidden sm:flex items-center gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Crown className="h-4 w-4" />
              Upgrade
            </Button>
          )}

          {/* Project Selector */}
          {projects.length > 0 && (
            <Select
              value={currentProject?.id?.toString() || ''}
              onValueChange={(value) => {
                const projectId = parseInt(value);
                if (projectId && projectId !== currentProject?.id) {
                  // Navigate to selected project using SPA routing
                  setLocation(`/playground/${projectId}`);
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Laptop className="h-3 w-3" />
                      <span>{project.name}</span>
                      {project.workspaceType === 'team' && (
                        <Users className="h-3 w-3 ml-auto" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Dev Server Controls */}
          {devServerRunning && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    setDevServerStopping(true);
                    const existingFiles = response?.files?.length ? response.files : currentSession?.generatedFiles || [];
                    
                    if (existingFiles.length > 0) {
                      const componentName = currentComponentName || 'App';
                      // Restart dev server
                      setLivePreviewUrl(null);
                      setDevServerRunning(false);
                      await new Promise(resolve => setTimeout(resolve, 500));
                      await deployToRuntime(existingFiles, componentName, { force: true });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to restart dev server",
                      variant: "destructive",
                    });
                  } finally {
                    setDevServerStopping(false);
                  }
                }}
                disabled={devServerStopping}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${devServerStopping ? 'animate-spin' : ''}`} />
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    setDevServerStopping(true);
                    await webContainerService.stopDevServer();
                    setLivePreviewUrl(null);
                    setDevServerRunning(false);
                    setCurrentComponentName('');
                    toast({
                      title: "Dev Server Stopped",
                      description: "The development server has been stopped.",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to stop dev server",
                      variant: "destructive",
                    });
                  } finally {
                    setDevServerStopping(false);
                  }
                }}
                disabled={devServerStopping}
                className="flex items-center gap-2 text-destructive hover:text-destructive"
              >
                <PowerOff className={`h-4 w-4 ${devServerStopping ? 'animate-pulse' : ''}`} />
                Stop
              </Button>
            </div>
          )}

          {/* Project Settings Button - Only for admins */}
          {currentProject && (isSuperAdmin || isAdmin) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProjectSettings(true)}
              className="flex items-center gap-2"
              title="Project Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}


          {(() => {
            // Get files from response or existing project files
            const files = response?.files || currentSession?.generatedFiles || [];
            const hasFiles = files.length > 0;
            
            // Show deploy/sharing options if we have files
            if (!hasFiles) return null;
            
            return (
              <>
                <ProjectSharing
                  projectId={currentProject?.id?.toString() || 'temp'}
                  projectName={currentProject?.name || currentComponentName || 'My App'}
                  files={files}
                  previewUrl={livePreviewUrl || undefined}
                />

              <ProductionDeployment
                files={files}
                projectName={currentProject?.name || currentComponentName || 'My App'}
                workspaceId={currentProject?.id}
                onDeployment={(result) => {
                  if (result.success) {
                    addChatMessage({
                      role: 'assistant',
                      content: `ðŸš€ Your app is now live! Visit: ${result.vercelUrl}`,
                      timestamp: Date.now()
                    });
                  }
                }}
              />
              </>
            );
          })()}
        </div>
      </div>

      {/* Loading state while project loads - Premium skeleton UI */}
      {isLoadingProject && hasProjectRoute && !currentProject && (
        <div className="flex-1 flex bg-background overflow-hidden relative">
          {/* Skeleton mimics the actual playground layout */}
          <div className="flex flex-col flex-1">
            {/* Header skeleton */}
            <div className="h-12 border-b border-border/30 flex items-center px-4 gap-3 bg-card/50">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
              <div className="h-4 w-32 rounded-md bg-gradient-to-r from-muted to-muted/50 animate-pulse" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-20 rounded-lg bg-gradient-to-r from-muted to-muted/50 animate-pulse" />
                <div className="h-8 w-20 rounded-lg bg-gradient-to-r from-muted to-muted/50 animate-pulse" style={{ animationDelay: '150ms' }} />
              </div>
            </div>
            {/* Content skeleton */}
            <div className="flex-1 flex">
              {/* Chat panel skeleton */}
              <div className="w-80 border-r border-border/30 p-4 space-y-3 bg-card/30">
                <div className="h-4 w-3/4 rounded-md bg-gradient-to-r from-muted to-muted/50 animate-pulse" />
                <div className="h-4 w-1/2 rounded-md bg-gradient-to-r from-muted to-muted/50 animate-pulse" style={{ animationDelay: '100ms' }} />
                <div className="h-24 rounded-xl bg-gradient-to-br from-muted/80 to-muted/30 animate-pulse mt-4" style={{ animationDelay: '200ms' }} />
                <div className="h-4 w-2/3 rounded-md bg-gradient-to-r from-muted to-muted/50 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              {/* Main area skeleton */}
              <div className="flex-1 p-4 space-y-4">
                <div className="flex gap-2">
                  <div className="h-9 w-20 rounded-lg bg-gradient-to-r from-muted to-muted/50 animate-pulse" />
                  <div className="h-9 w-20 rounded-lg bg-gradient-to-r from-muted to-muted/50 animate-pulse" style={{ animationDelay: '100ms' }} />
                  <div className="h-9 w-20 rounded-lg bg-gradient-to-r from-muted to-muted/50 animate-pulse" style={{ animationDelay: '200ms' }} />
                </div>
                <div className="h-72 rounded-xl bg-gradient-to-br from-muted/60 to-muted/20 animate-pulse" style={{ animationDelay: '150ms' }} />
              </div>
            </div>
          </div>
          {/* Single elegant loading indicator */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card/90 border border-border/50 shadow-2xl shadow-primary/5">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5" />
                <Loader2 className="h-6 w-6 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm font-medium text-foreground">Loading project...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Bolt.new Style Layout - No scroll container */}
      {/* Show content if: not loading, OR we have project data (even if still loading files) */}
      {(!isLoadingProject || !hasProjectRoute || currentProject) && (
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10 min-h-0">
          {/* Elon Chat Panel - Extracted Component */}
          <ChatPanel
            chatHistory={chatHistory}
            statusMessages={statusMessages}
            agentStatusMap={agentStatusMap}
            isLoading={isLoading}
            form={form}
            onSubmit={handleSubmit}
            onClearChat={clearChat}
            chatMessagesRef={chatMessagesRef}
            isChatMode={isChatMode}
            onChatModeChange={setIsChatMode}
          />

        {/* Workspace Panel - Right Side (70%) - Full width on mobile */}
        <div className="flex-1 flex flex-col min-h-0 w-full md:w-auto">
          {/* Workspace Tabs - Desktop version (hidden on mobile) */}
          <div className="border-b border-border bg-card px-2 sm:px-4 hidden md:block">
            <div className="flex h-10 items-center gap-6 justify-between">
              <div className="flex items-center gap-6 min-w-max">
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex items-center gap-2 px-3 md:px-3 py-2.5 md:py-2 text-sm font-medium rounded-lg transition-smooth relative focus-ring min-h-[44px] md:min-h-0 ${
                  activeTab === 'desktop'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <LayoutGrid className="icon-sm" />
                Desktop
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3 md:px-3 py-2.5 md:py-2 text-sm font-medium rounded-lg transition-smooth focus-ring min-h-[44px] md:min-h-0 ${
                  activeTab === 'preview'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Eye className="icon-sm" />
                Preview
                {currentComponentName && livePreviewUrl && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </button>
                            </div>
              
              {/* Debug Info - Hidden on mobile */}
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tab: {activeTab}</span>
                <span>|</span>
                <span>Loading: {isLoading ? 'âœ"' : 'âœ—'}</span>
                <span>|</span>
                <span>Files: {response && typeof response === 'object' && response.files ? response.files.length : 0}</span>
                          </div>
                          </div>
                        </div>
          
          {/* Mobile Tab Bar - Bottom Navigation (visible only on mobile) */}
          <div className="md:hidden border-b border-border bg-card">
            <div className="flex items-center justify-around px-2 py-1">
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-smooth min-w-[70px] ${
                  activeTab === 'desktop'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-muted-foreground'
                }`}
              >
                <Smartphone className="h-5 w-5" />
                <span className="text-[10px] font-medium">Apps</span>
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-smooth min-w-[70px] ${
                  activeTab === 'preview'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-muted-foreground'
                }`}
              >
                <Eye className="h-5 w-5" />
                <span className="text-[10px] font-medium">Preview</span>
                {currentComponentName && livePreviewUrl && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
            <div className="flex-1 min-h-0 overflow-hidden">
            {/* Desktop/Mobile Tab - Responsive */}
            {activeTab === 'desktop' && (
              <>
                {/* Desktop view (hidden on mobile) */}
                <div className="hidden md:block h-full">
                  <DesktopTab
                    projects={projects}
                    currentProjectId={currentProject?.id}
                    onSelectProject={(projectId) => {
                      window.location.href = `/playground/${projectId}`;
                    }}
                    onCreateProject={() => setShowCreateProjectDialog(true)}
                    onEditProject={(projectId) => {
                      setActiveTab('preview');
                      window.location.href = `/playground/${projectId}`;
                    }}
                    webContainerService={webContainerService}
                    isWebContainerReady={webContainerReady}
                    isLoading={isLoading}
                    currentStep={currentStep}
                    progress={overallProgress}
                  />
                </div>
                
                {/* Mobile view (hidden on desktop) */}
                <div className="block md:hidden h-full">
                  <MobileTab
                    projects={projects}
                    currentProjectId={currentProject?.id}
                    onSelectProject={(projectId) => {
                      window.location.href = `/playground/${projectId}`;
                    }}
                    onCreateProject={() => setShowCreateProjectDialog(true)}
                    onEditProject={(projectId) => {
                      setActiveTab('preview');
                      window.location.href = `/playground/${projectId}`;
                    }}
                    webContainerService={webContainerService}
                    isWebContainerReady={webContainerReady}
                  />
                </div>
              </>
            )}


            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <PreviewTab
                response={response}
                livePreviewUrl={livePreviewUrl}
                currentComponentName={currentComponentName}
                isLoading={isLoading}
                setPreviewModalOpen={setPreviewModalOpen}
                setLivePreviewUrl={setLivePreviewUrl}
                webContainerSupport={webContainerSupport}
                onStartServerPreview={async () => {
                  if (!response?.files || response.files.length === 0) {
                    throw new Error('No files were found in this project. Generate or add files first.');
                  }
                  await deployToRuntime(response.files, currentComponentName || 'App', { force: true, preferServerPreview: true });
                }}
              />
            )}




            </div>
          </div>
        </div>
      </div>
      )}

        {createProjectDialog}

      {/* Mobile: Elon Chat Bottom Sheet */}
      <MobileChatSheet
        open={chatSheetOpen}
        onOpenChange={setChatSheetOpen}
        chatHistory={chatHistory}
        isLoading={isLoading}
        form={form}
        onSubmit={handleSubmit}
        clearChat={clearChat}
      />

      {/* Mobile: Bottom Navigation Footer (iOS/Android style) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'desktop' | 'preview')}
        setChatSheetOpen={setChatSheetOpen}
        setPreviewModalOpen={setPreviewModalOpen}
        chatHistory={chatHistory}
        isLoading={isLoading}
        currentComponentName={currentComponentName}
        livePreviewUrl={livePreviewUrl}
      />

      {/* Mobile: Generation Progress Indicator */}
      <MobileProgressIndicator
        isLoading={isLoading}
        currentStep={currentStep}
        setActiveTab={setActiveTab}
        setChatSheetOpen={setChatSheetOpen}
      />

      {/* Mobile: Fullscreen Preview Modal */}
      <MobilePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        response={response}
        livePreviewUrl={livePreviewUrl}
        currentComponentName={currentComponentName}
        previewUnavailableMessage={!webContainerSupport.supported ? webContainerSupport.userMessage : undefined}
      />

      {/* Rename Project Dialog */}
      <RenameProjectDialog
        open={showRenameProjectDialog}
        onOpenChange={setShowRenameProjectDialog}
        currentProject={currentProject}
        onRename={renameProjectHook}
      />


      {/* Database API Key Dialog */}
      {apiKeyDialogData && (
        <DatabaseAPIKeyDialog
          open={showAPIKeyDialog}
          onOpenChange={setShowAPIKeyDialog}
          missingApiKeys={apiKeyDialogData.missingApiKeys}
          databaseType={apiKeyDialogData.databaseType}
          projectId={apiKeyDialogData.projectId}
          onKeysAdded={async (projectId) => {
            if (!projectId) {
              setShowAPIKeyDialog(false);
              setAPIKeyDialogData(null);
              return;
            }
            
            try {
              // Retry database provisioning after API keys are configured
              const response = await fetch(getApiUrl(`/api/workspaces/${projectId}/retry-database-provisioning`), {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`,
                  'Content-Type': 'application/json'
                }
              });

              const result = await safeJsonParse(response);
              
              if (result.success) {
                toast({
                  title: "Database Provisioned",
                  description: `Database successfully provisioned using ${result.provider}. Your project is now ready!`,
                  variant: "default",
                });
              } else {
                toast({
                  title: "Provisioning Failed",
                  description: result.error || "Failed to provision database. Please check that API keys are correctly configured.",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('Failed to retry database provisioning:', error);
              toast({
                title: "Error",
                description: "Failed to retry database provisioning. Please try again later.",
                variant: "destructive",
              });
            }
            
            setShowAPIKeyDialog(false);
            setAPIKeyDialogData(null);
          }}
        />
      )}

      {/* Project API Key Dialog - for general API key requirements during generation */}
      {projectAPIKeyDialogData && (
        <ProjectAPIKeyDialog
          open={showProjectAPIKeyDialog}
          onOpenChange={setShowProjectAPIKeyDialog}
          missingApiKeys={projectAPIKeyDialogData.missingApiKeys}
          projectId={projectAPIKeyDialogData.projectId}
          projectName={projectAPIKeyDialogData.projectName}
          onKeysAdded={async () => {
            const pendingGeneration = pendingGenerationAfterApiKeys;
            setShowProjectAPIKeyDialog(false);
            setProjectAPIKeyDialogData(null);
            setPendingGenerationAfterApiKeys(null);
            // Continue generation - API keys are now available
            toast({
              title: 'API Keys Saved',
              description: pendingGeneration
                ? 'API keys have been saved. Continuing generation now.'
                : 'API keys have been saved.',
            });
            if (pendingGeneration) {
              setTimeout(() => {
                generateMutation.mutate(pendingGeneration);
              }, 0);
            }
          }}
        />
      )}

      {/* Project Settings Dialog */}
      {showProjectSettings && currentProject && (
        <ProjectSettingsDialog
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
          projectId={currentProject.id}
          projectName={currentProject.name}
          projectDescription={currentProject.description}
          isPublic={currentProject.isPublic}
          previewUrl={livePreviewUrl}
          onProjectUpdate={(updatedProject) => {
            if (updatedProject?.id === currentProject.id) {
              setCurrentProject(prev => prev ? {
                ...prev,
                name: updatedProject.name || prev.name,
                description: updatedProject.description ?? prev.description,
                isPublic: updatedProject.isPublic ?? prev.isPublic,
                screenshotUrl: updatedProject.screenshotUrl ?? prev.screenshotUrl,
                thumbnailUrl: updatedProject.thumbnailUrl ?? prev.thumbnailUrl,
              } : prev);
            }
            refetchProjects();
          }}
        />
      )}
      </ErrorBoundary>
    </div>
  );
}
