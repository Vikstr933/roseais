/**
 * Elon - AI Assistant Component
 * Enhanced AI assistant with proactive insights and web search
 * Part of Digital Office Platform (Fas 1)
 *
 * This is the new enhanced assistant that coexists with the existing AssistantWidget
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiFetch } from '@/lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Settings,
  Sparkles,
  Database,
  Brain,
  MapPin,
  FolderOpen,
  ArrowRight,
  Download,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { useOmniAssistant, type OmniAssistantMessage } from '@/hooks/useOmniAssistant'; // Hook keeps same name for backward compatibility
import { useVoiceMode } from '@/hooks/useVoiceMode';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type ViewState = 'closed' | 'minimized' | 'full' | 'settings';

interface Project {
  id: number;
  name: string;
  description?: string;
  workspaceType?: 'personal' | 'team';
}

interface ProjectFile {
  id: number;
  projectId: number;
  filePath: string;
  content: string;
  language: string;
}

export function OmniAssistant() {
  console.log('[OmniAssistant] Component mounting...');
  
  const [viewState, setViewState] = useState<ViewState>('closed');
  const [inputMessage, setInputMessage] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(() => {
    // Restore from localStorage
    try {
      const stored = localStorage.getItem('elon_voice_mode_enabled');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(() => {
    // Restore from localStorage
    try {
      const stored = localStorage.getItem('elon_auto_speak_enabled');
      return stored !== 'false'; // Default to true
    } catch {
      return true;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayedMessagesRef = useRef<Set<string>>(new Set()); // Track messages that have been displayed with typewriter
  
  // Voice mode hook
  let voiceModeResult;
  try {
    console.log('[OmniAssistant] Initializing useVoiceMode hook...');
    voiceModeResult = useVoiceMode();
    console.log('[OmniAssistant] useVoiceMode hook initialized successfully');
  } catch (error) {
    console.error('[OmniAssistant] Error initializing useVoiceMode:', error);
    // Fallback to prevent crash
    voiceModeResult = {
      isListening: false,
      isSpeaking: false,
      transcript: '',
      error: null,
      isSupported: false,
      isInCall: false,
      selectedVoice: null,
      startListening: () => {},
      stopListening: () => {},
      getTranscript: () => '',
      speak: () => {},
      speakStreaming: () => {},
      stopSpeaking: () => {},
      clearError: () => {},
      startCall: () => {},
      endCall: () => {},
    };
  }

  const {
    isListening,
    isSpeaking,
    transcript,
    error: voiceError,
    isSupported: voiceSupported,
    isInCall,
    selectedVoice,
    startListening,
    stopListening,
    getTranscript,
    speak,
    speakStreaming,
    stopSpeaking,
    clearError,
    startCall,
    endCall,
  } = voiceModeResult;
  
  // Listen for custom event to open Elon from Navigation
  // Also check if we're on the dedicated Elon chat page
  const [location] = useLocation();
  useEffect(() => {
    const handleOpenElon = () => {
      setViewState('full');
    };
    window.addEventListener('openElon', handleOpenElon);
    
    // Auto-open if on dedicated Elon chat page
    if (location === '/elon' || location === '/chat') {
      setViewState('full');
    }
    
    return () => window.removeEventListener('openElon', handleOpenElon);
  }, [location]);

  // Track mobile/desktop screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const {
    currentSession,
    updateGeneratedFiles,
    setPendingPrompt,
    dispatchPlaygroundAction,
  } = useWorkspace();
  const { sessionToken, user } = useAuth();
  const [, setLocation] = useLocation();

  const {
    messages,
    isLoading,
    features,
    sendMessage,
    clearSession,
  } = useOmniAssistant();

  // Handle auto-send in call mode
  const handleCallMessage = useCallback(async (messageText: string) => {
    console.log('[OmniAssistant] 📞 handleCallMessage called with:', messageText);
    if (!messageText.trim()) {
      console.warn('[OmniAssistant] ⚠️ Empty message, skipping');
      return;
    }
    if (isLoading) {
      console.warn('[OmniAssistant] ⏳ Already loading, skipping');
      return;
    }

    console.log('[OmniAssistant] 📤 Sending message to AI...');
    const playgroundContext = buildPlaygroundContext();
    const workspaceId = getActiveWorkspaceId();

    try {
      await sendMessage(messageText, {
        currentPage: window.location.pathname,
        workspaceId,
        playgroundContext,
      });
      console.log('[OmniAssistant] ✅ Message sent successfully');
    } catch (error) {
      console.error('[OmniAssistant] ❌ Error sending message:', error);
    }
  }, [isLoading, sendMessage]);

  // Update input message when voice transcript is available (only if not in call mode)
  useEffect(() => {
    if (transcript && !isListening && !isInCall) {
      // When listening stops, update the input field with the transcript
      const finalTranscript = getTranscript();
      if (finalTranscript) {
        setInputMessage(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    }
  }, [transcript, isListening, isInCall, getTranscript]);

  // Auto-speak assistant responses when voice mode is enabled
  useEffect(() => {
    if (autoSpeakEnabled && voiceModeEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content) {
        // In call mode, use streaming speech
        if (isInCall) {
          // Use streaming speech for call mode - speaks as text arrives
          // This triggers every time the message content updates (streaming)
          const cleanText = lastMessage.content
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/`([^`]+)`/g, '$1') // Remove inline code
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
            .replace(/\*([^*]+)\*/g, '$1') // Remove italic
            .replace(/#{1,6}\s+/g, '') // Remove headers
            .replace(/\n{2,}/g, '. ') // Replace multiple newlines with period
            .trim();
          
          // Always try to speak streaming text (even if already speaking, it will queue)
          if (cleanText.length > 10) {
            speakStreaming(cleanText, { lang: 'sv-SE', rate: 1.0 });
          }
        } else {
          // Normal mode - wait for message to complete
          if (!isSpeaking) {
            const timer = setTimeout(() => {
              if (lastMessage.content.trim().length > 0) {
                const cleanText = lastMessage.content
                  .replace(/```[\s\S]*?```/g, '') // Remove code blocks
                  .replace(/`([^`]+)`/g, '$1') // Remove inline code
                  .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
                  .replace(/\*([^*]+)\*/g, '$1') // Remove italic
                  .replace(/#{1,6}\s+/g, '') // Remove headers
                  .replace(/\n{2,}/g, '. ') // Replace multiple newlines with period
                  .trim();
                
                if (cleanText.length > 0) {
                  speak(cleanText, { lang: 'sv-SE', rate: 1.0 });
                }
              }
            }, 1000);
            
            return () => clearTimeout(timer);
          }
        }
      }
    }
  }, [messages, autoSpeakEnabled, voiceModeEnabled, isSpeaking, isInCall, speak, speakStreaming]);

  // Persist voice mode settings
  useEffect(() => {
    localStorage.setItem('elon_voice_mode_enabled', String(voiceModeEnabled));
  }, [voiceModeEnabled]);

  useEffect(() => {
    localStorage.setItem('elon_auto_speak_enabled', String(autoSpeakEnabled));
  }, [autoSpeakEnabled]);

  // Handle voice input toggle
  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
      if (!isInCall) {
        const finalTranscript = getTranscript();
        if (finalTranscript) {
          setInputMessage(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      }
    } else {
      startListening('sv-SE', false);
    }
  };

  // Handle call mode toggle
  const handleCallToggle = () => {
    if (isInCall) {
      endCall();
      stopSpeaking();
    } else {
      // Enable voice mode if not already enabled
      if (!voiceModeEnabled) {
        setVoiceModeEnabled(true);
      }
      // Start the call
      startCall(handleCallMessage, 'sv-SE');
    }
  };

  // Get WorkspaceContext methods for prompt forwarding
  const userDisplayName = user?.displayName || user?.email || 'You';

  // Fetch user projects
  const { data: userProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/workspaces'],
    queryFn: async () => {
      if (!sessionToken) return [];
      const response = await apiFetch('/api/workspaces', {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!sessionToken,
  });

  const getActiveWorkspaceId = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const routeMatch = path.match(/\/playground\/(\d+)/);
    if (routeMatch) {
      const parsed = parseInt(routeMatch[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    if (selectedProjectId) {
      return selectedProjectId;
    }

    const metadataWorkspaceId = currentSession?.metadata?.workspaceId;
    if (typeof metadataWorkspaceId === 'number' && metadataWorkspaceId > 0) {
      return metadataWorkspaceId;
    }
    if (typeof metadataWorkspaceId === 'string') {
      const parsed = parseInt(metadataWorkspaceId, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return undefined;
  };

  // Fetch project files when a project is selected (with full content)
  useEffect(() => {
    if (!selectedProjectId || !sessionToken) {
      setProjectFiles([]);
      return;
    }

    const fetchProjectFiles = async () => {
      try {
        console.log('📂 Elon: Fetching full project files for project', selectedProjectId);
        const response = await apiFetch(`/api/workspaces/${selectedProjectId}/files`, {
          headers: getAuthHeaders(sessionToken),
        });
        if (response.ok) {
          const files = await response.json();
          console.log(`✅ Elon: Loaded ${files.length} files`, {
            filesWithContent: files.filter((f: any) => f.content && f.content.trim().length > 0).length,
            totalSize: files.reduce((sum: number, f: any) => sum + (f.content?.length || 0), 0),
          });
          
          // Verify we have content
          if (files.length > 0 && files.every((f: any) => !f.content || f.content.trim().length === 0)) {
            console.warn('⚠️ Elon: Project files loaded but all content fields are empty. Files may not be saved to database yet.');
          }
          
          setProjectFiles(files);
        } else {
          console.error('❌ Elon: Failed to fetch project files', response.status);
        }
      } catch (error) {
        console.error('❌ Elon: Error fetching project files:', error);
      }
    };

    fetchProjectFiles();
  }, [selectedProjectId, sessionToken]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (viewState === 'full' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, viewState]);

  // Clear displayed messages tracking when session is cleared
  useEffect(() => {
    if (messages.length === 0) {
      displayedMessagesRef.current.clear();
    }
  }, [messages.length]);

  // Mark all existing/old messages as displayed when they're loaded (no typewriter effect for old messages)
  useEffect(() => {
    const now = Date.now();
    messages.forEach((message) => {
      if (message.role === 'assistant' && message.content && message.content.trim().length > 0) {
        // Create unique message ID based on content and timestamp
        const messageId = `${message.role}-${message.timestamp?.getTime()}-${message.content.substring(0, 50)}`;
        
        // If message is older than 2 seconds (loaded from history/localStorage), mark as displayed
        // This prevents typewriter effect for old messages while allowing new streaming messages
        const messageAge = message.timestamp ? now - message.timestamp.getTime() : Infinity;
        
        // Only mark as displayed if:
        // 1. Message is older than 2 seconds (definitely from history)
        // 2. OR message is not already being tracked (newly loaded from history)
        // This ensures new streaming messages (age < 2s) still get typewriter effect
        if (messageAge > 2000) {
          // Old message from history - mark as displayed immediately
          displayedMessagesRef.current.add(messageId);
        }
      }
    });
  }, [messages]); // Run whenever messages change (when history is loaded)

  // Build playground context - works both on playground page and with selected project
  const buildPlaygroundContext = () => {
    const currentPage = window.location.pathname;
    const isPlaygroundPage = currentPage.startsWith('/playground');
    const activeWorkspaceId = getActiveWorkspaceId();
    const activeProject = activeWorkspaceId
      ? userProjects.find(project => project.id === activeWorkspaceId)
      : undefined;
    const projectName = activeProject?.name || currentSession?.name || 'Untitled Project';
    
    // Optimize files helper
    const optimizeFileContents = (fileList: any[]) => {
      if (!fileList || fileList.length === 0) return [];
      
      const priorityOrder = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json', '.md', '.html'];
      const sortedFiles = [...fileList].sort((a, b) => {
        const aExt = '.' + a.path.split('.').pop()?.toLowerCase();
        const bExt = '.' + b.path.split('.').pop()?.toLowerCase();
        const aPriority = priorityOrder.indexOf(aExt);
        const bPriority = priorityOrder.indexOf(bExt);
        return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
      });
      
      const importantFiles = sortedFiles.slice(0, 5).map((f: any) => ({
        path: f.path || f.filePath,
        content: (f.content || '').substring(0, 2000),
        language: (f.path || f.filePath).split('.').pop() || 'text',
        fullContent: (f.content || '').length <= 2000
      }));
      
      const otherFiles = sortedFiles.slice(5, 10).map((f: any) => {
        const content = f.content || '';
        return {
          path: f.path || f.filePath,
          content: `// File structure: ${content.split('\n').length} lines\n// Preview (first 200 chars):\n${content.substring(0, 200)}...`,
          language: (f.path || f.filePath).split('.').pop() || 'text',
          summary: true
        };
      });
      
      return [...importantFiles, ...otherFiles];
    };
    
    // Priority 1: If on playground page with session files
    if (isPlaygroundPage && currentSession?.generatedFiles?.length) {
      const projectId = activeWorkspaceId ? activeWorkspaceId.toString() : 'default';

      return {
        currentProject: projectName,
        projectId,
        filesCount: currentSession.generatedFiles.length,
        filePaths: currentSession.generatedFiles.map(f => f.path),
        files: optimizeFileContents(currentSession.generatedFiles),
        hasLivePreview: false,
        currentComponent: 'None',
        recentErrors: [],
        isGenerating: false,
        orchestrationSteps: 0,
        currentStep: 'None'
      };
    }
    
    // Priority 2: If user has selected a project (even when not on playground)
    if (selectedProjectId && projectFiles.length > 0) {
      const selectedProject = userProjects.find(p => p.id === selectedProjectId);
      
      // Check if files have content
      const filesWithContent = projectFiles.filter(f => f.content && f.content.trim().length > 0);
      
      if (filesWithContent.length === 0) {
        console.warn('⚠️ Elon: Building context for project with no file content', {
          projectId: selectedProjectId,
          projectName: selectedProject?.name,
          fileCount: projectFiles.length,
          filePaths: projectFiles.map(f => f.filePath),
        });
        
        // Return context with file structure but note that content isn't available
        return {
          currentProject: selectedProject?.name || 'Selected Project',
          projectId: selectedProjectId.toString(),
          filesCount: projectFiles.length,
          filePaths: projectFiles.map(f => f.filePath),
          files: [], // No content available
          hasLivePreview: false,
          currentComponent: 'None',
          recentErrors: [],
          isGenerating: false,
          orchestrationSteps: 0,
          currentStep: 'None'
        };
      }
      
      console.log('✅ Elon: Building context for selected project', {
        projectId: selectedProjectId,
        projectName: selectedProject?.name,
        filesWithContent: filesWithContent.length,
        totalFiles: projectFiles.length,
      });
      
      return {
        currentProject: selectedProject?.name || projectName || 'Selected Project',
        projectId: (activeWorkspaceId || selectedProjectId).toString(),
        filesCount: projectFiles.length,
        filePaths: projectFiles.map(f => f.filePath),
        files: optimizeFileContents(projectFiles.map(f => ({ path: f.filePath, content: f.content || '' }))),
        hasLivePreview: false,
        currentComponent: 'None',
        recentErrors: [],
        isGenerating: false,
        orchestrationSteps: 0,
        currentStep: 'None'
      };
    }
    
    // No context available
    console.log('ℹ️ Elon: No playground context available', {
      isPlaygroundPage,
      hasCurrentSession: !!currentSession,
      hasGeneratedFiles: !!currentSession?.generatedFiles?.length,
      hasSelectedProject: !!selectedProjectId,
      hasProjectFiles: projectFiles.length > 0,
    });
    
    return undefined;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage;
    setInputMessage('');

    const playgroundContext = buildPlaygroundContext();
    const workspaceId = getActiveWorkspaceId();

    await sendMessage(message, {
      currentPage: window.location.pathname,
      workspaceId,
      playgroundContext,
    });

    // Detect dev server requests - match various phrasings
    const wantsDevServer = /\b(start|run|restart|stop|stoppa|starta|starta om|kör|kör igång)\b.*\b(dev|preview|utvecklings|development)\s*(server|servern|servern)\b/i.test(message.toLowerCase()) ||
      /\b(dev|preview|utvecklings)\s*(server|servern)\b.*\b(start|run|restart|stop|stoppa|starta|starta om|kör|kör igång)\b/i.test(message.toLowerCase()) ||
      /\b(starta|kör|start|run)\b.*\b(dev|preview|utvecklings)\b/i.test(message.toLowerCase());
    
    if (wantsDevServer) {
      dispatchPlaygroundAction({
        type: 'restartDevServer',
        metadata: {
          source: 'elon',
          message: '🔁 Starting the playground dev server as requested…',
          fromPage: window.location.pathname,
        },
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isLoading) return;
    
    // Track that user took this action (for learning)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const sessionToken = localStorage.getItem('sessionToken');
      const workspaceId = getActiveWorkspaceId();
      
      await fetch(`${API_BASE}/api/omniassistant/track-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: suggestion,
          currentPage: window.location.pathname,
          workspaceId,
          success: true
        })
      }).catch(() => {
        // Silently fail - tracking is optional
      });
    } catch (error) {
      // Silently fail - tracking is optional
    }
    
    // Suggestions are for continuing conversation with Elon, not for playground
    // Send the suggestion as a message to Elon (no hardcoded acknowledgment needed)
    const playgroundContext = buildPlaygroundContext();
    const workspaceId = getActiveWorkspaceId();
    
    await sendMessage(suggestion, {
      currentPage: window.location.pathname,
      workspaceId,
      playgroundContext,
    });
  };

  const handleSendToPlayground = async (messageContent: string) => {
    if (isLoading || !currentSession) return;
    
    // Transform Elon's message content into a proper prompt for the playground AI
    const playgroundContext = buildPlaygroundContext();
    const workspaceId = getActiveWorkspaceId();
    
    // Extract structured information from Elon's response
    // Look for patterns like "📍 Adress:", "📞 Telefon:", "🕐 Öppettider:", etc.
    const addressPatterns = [
      /(?:📍|Adress|Address)[:\s]+([^\n]+)/i,
      /(?:adress|address)[:\s]+([^\n]+)/i,
      /Bondevägen\s+\d+[^\n]*/i,
    ];
    const phonePatterns = [
      /(?:📞|Telefon|Phone)[:\s]+([^\n]+)/i,
      /(?:telefon|phone)[:\s]+([^\n]+)/i,
      /046[-\s]?\d+[-\s]?\d+[-\s]?\d+/i,
    ];
    const hoursPatterns = [
      /(?:🕐|Öppettider|Hours|Opening)[:\s]+([^\n]+)/i,
      /(?:öppettider|hours|opening)[:\s]+([^\n]+)/i,
      /(?:Vardagar|Weekdays|Måndag|Monday)[^\n]*(?:09:00|10:00)[^\n]*18:00/i,
    ];
    
    let address = '';
    let phone = '';
    let hours = '';
    
    for (const pattern of addressPatterns) {
      const match = messageContent.match(pattern);
      if (match) {
        address = match[1]?.trim() || match[0].trim();
        break;
      }
    }
    
    for (const pattern of phonePatterns) {
      const match = messageContent.match(pattern);
      if (match) {
        phone = match[1]?.trim() || match[0].trim();
        break;
      }
    }
    
    for (const pattern of hoursPatterns) {
      const match = messageContent.match(pattern);
      if (match) {
        hours = match[1]?.trim() || match[0].trim();
        break;
      }
    }
    
    // Extract file names mentioned
    const fileMatches = messageContent.match(/(?:file|fil)[:\s]+([^\n`]+)/gi) || [];
    const files = fileMatches.map(m => m.replace(/(?:file|fil)[:\s]+/i, '').trim());
    
    // Build a clear, actionable prompt for the playground AI
    let prompt = '';
    
    if (address || phone || hours) {
      // Structured update prompt
      prompt = 'Uppdatera följande information i projektet:\n\n';
      if (address) prompt += `📍 Adress: ${address}\n`;
      if (phone) prompt += `📞 Telefon: ${phone}\n`;
      if (hours) {
        // Extract hours details
        const hoursText = hours.replace(/🕐|Öppettider|Hours|Opening[:\s]*/gi, '').trim();
        prompt += `🕐 Öppettider:\n${hoursText}\n`;
      }
      
      prompt += '\nAnalysera den befintliga koden först för att förstå projektstrukturen, designmönstren, och var denna information lagras. Uppdatera sedan alla relevanta filer med den nya informationen. Se till att matcha den befintliga kodstilen och formateringen.';
      
      if (files.length > 0) {
        prompt += `\n\nFiler som troligen behöver uppdateras: ${files.join(', ')}`;
      }
    } else {
      // Generic prompt - clean up markdown and make it actionable
      prompt = messageContent
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/📍|📞|🕐|💡|⚠️|✅|❌/g, '') // Remove emojis
        .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
        .trim();
      
      // Add instruction prefix if not already present
      if (!prompt.match(/^(?:uppdatera|update|ändra|change|fix|implementera|implement)/i)) {
        prompt = `Uppdatera projektet enligt följande:\n\n${prompt}`;
      }
      
      prompt += '\n\nAnalysera den befintliga koden först för att förstå projektstrukturen och designmönstren, sedan implementera ändringarna.';
    }
    
    // Add project context if available
    if (playgroundContext?.currentProject) {
      prompt = `[Projekt: ${playgroundContext.currentProject}]\n\n${prompt}`;
    }
    
    dispatchPlaygroundAction({
      type: 'runPrompt',
      prompt,
      metadata: {
        source: 'elon-suggestion',
        title: 'Elon is updating your playground',
        message: 'Running these instructions directly in Chap-ZPT…',
        originalMessage: messageContent.substring(0, 200),
      },
    });

    // Set pending prompt using WorkspaceContext (fallback / persistence)
    setPendingPrompt(prompt, 'elon-suggestion', {
      fromPage: window.location.pathname,
      originalMessage: messageContent.substring(0, 200),
      workspaceId,
    });

    dispatchPlaygroundAction({
      type: 'runPrompt',
      prompt,
      metadata: {
        source: 'elon',
        fromPage: window.location.pathname,
        originalMessage: messageContent.substring(0, 200),
      },
    });
    
    // Navigate to playground if not already there
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith('/playground')) {
      const projectId = currentSession?.id;
      const playgroundPath = projectId ? `/playground/${projectId}` : '/playground';
      setLocation(playgroundPath);
    }
  };

  // Intelligent code insertion - inserts code at the right location instead of replacing entire file
  const insertCodeIntelligently = (
    existingContent: string,
    newCode: string,
    filePath: string
  ): string => {
    // Try to find insertion markers in the new code
    // Look for function/class/component definitions
    const functionMatch = newCode.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    const classMatch = newCode.match(/(?:export\s+)?class\s+(\w+)/);
    const componentMatch = newCode.match(/(?:export\s+)?(?:const|function)\s+(\w+)\s*[:=]\s*(?:\(|\(.*?\)\s*=>)/);
    const constMatch = newCode.match(/(?:export\s+)?const\s+(\w+)\s*[:=]/);
    
    const targetName = functionMatch?.[1] || classMatch?.[1] || componentMatch?.[1] || constMatch?.[1];
    
    if (targetName && existingContent) {
      // Try to find the existing function/class/component in the file
      // Look for the same pattern
      const existingFunctionRegex = new RegExp(
        `(?:export\\s+)?(?:async\\s+)?function\\s+${targetName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`,
        'm'
      );
      const existingClassRegex = new RegExp(
        `(?:export\\s+)?class\\s+${targetName}\\s*(?:extends\\s+\\w+)?\\s*\\{[\\s\\S]*?\\n\\}`,
        'm'
      );
      const existingComponentRegex = new RegExp(
        `(?:export\\s+)?(?:const|function)\\s+${targetName}\\s*[:=]\\s*(?:\\(|.*?=>)[\\s\\S]*?\\n\\}`,
        'm'
      );
      const existingConstRegex = new RegExp(
        `(?:export\\s+)?const\\s+${targetName}\\s*[:=][\\s\\S]*?(?=\\n(?:export|const|function|class|\\}|$))`,
        'm'
      );
      
      // Try to find and replace the specific function/class/component
      if (functionMatch && existingFunctionRegex.test(existingContent)) {
        return existingContent.replace(existingFunctionRegex, newCode.trim());
      }
      if (classMatch && existingClassRegex.test(existingContent)) {
        return existingContent.replace(existingClassRegex, newCode.trim());
      }
      if (componentMatch && existingComponentRegex.test(existingContent)) {
        return existingContent.replace(existingComponentRegex, newCode.trim());
      }
      if (constMatch && existingConstRegex.test(existingContent)) {
        return existingContent.replace(existingConstRegex, newCode.trim());
      }
      
      // If found but couldn't replace, try to insert after the existing definition
      const insertAfterRegex = new RegExp(
        `((?:export\\s+)?(?:async\\s+)?function\\s+${targetName}[\\s\\S]*?\\n\\})`,
        'm'
      );
      if (insertAfterRegex.test(existingContent)) {
        return existingContent.replace(insertAfterRegex, `$1\n\n${newCode.trim()}`);
      }
    }
    
    // If new code is very short (likely a snippet), try to find insertion point
    if (newCode.split('\n').length < 20 && existingContent) {
      // Look for common insertion markers like "// Add here" or similar
      const insertionMarker = existingContent.match(/\/\/\s*(?:add|insert|TODO|FIXME).*?here/i);
      if (insertionMarker) {
        const markerIndex = existingContent.indexOf(insertionMarker[0]);
        const beforeMarker = existingContent.substring(0, markerIndex);
        const afterMarker = existingContent.substring(markerIndex + insertionMarker[0].length);
        return `${beforeMarker}${newCode.trim()}\n${afterMarker}`;
      }
    }
    
    // Fallback: If new code looks like a complete file (has imports, exports, etc.), replace
    // Otherwise, append to the end
    const hasImports = newCode.includes('import ') || newCode.includes('from ');
    const hasExports = newCode.includes('export ');
    const isCompleteFile = hasImports && hasExports && newCode.split('\n').length > 30;
    
    if (isCompleteFile || !existingContent) {
      return newCode.trim();
    }
    
    // Append to end of file
    return `${existingContent.trim()}\n\n${newCode.trim()}`;
  };

  // Handle applying file changes - Trigger playground AI code generation directly
  const handleApplyChanges = async (files: Array<{ path: string; content: string }>) => {
    if (!currentSession) return;
    
    // Check if we're on a playground page
    const isPlaygroundPage = window.location.pathname.startsWith('/playground');
    
    if (!isPlaygroundPage) {
      // If not on playground, fall back to direct application
      const existingFiles = currentSession.generatedFiles || [];
      const fileMap = new Map(existingFiles.map(f => [f.path, f]));
      
      files.forEach(file => {
        const existingFile = fileMap.get(file.path);
        const existingContent = existingFile?.content || '';
        const mergedContent = insertCodeIntelligently(existingContent, file.content, file.path);
        
        fileMap.set(file.path, {
          path: file.path,
          content: mergedContent,
          language: file.path.split('.').pop() || 'text'
        });
      });
      
      const updatedFiles = Array.from(fileMap.values());
      updateGeneratedFiles(updatedFiles);
      return;
    }
    
    // On playground page - trigger playground AI code generation directly
    try {
      // Build a prompt that asks the playground AI to apply these changes
      const fileDescriptions = files.map(f => {
        const lines = f.content.split('\n').length;
        return `- ${f.path} (${lines} lines)`;
      }).join('\n');
      
      const prompt = `Please apply the following code changes to match the current app's design system and patterns. Analyze the existing codebase first to understand the design patterns, component structure, styling approach, and state management patterns, then apply these changes accordingly:\n\nFiles to update:\n${fileDescriptions}\n\nCode to apply:\n\n${files.map(f => `**${f.path}**\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n')}\n\nIMPORTANT: Make sure the changes match the existing design patterns, component structure, styling approach (Tailwind classes, CSS modules, etc.), state management patterns, import patterns, and UI component library being used in the current project.`;
      
      // Set pending prompt using WorkspaceContext (auto-saves to localStorage and database)
      setPendingPrompt(prompt, 'omniassistant-code', {
        files,
        fileCount: files.length,
        fromPage: window.location.pathname,
      });

      dispatchPlaygroundAction({
        type: 'applyCode',
        files,
        metadata: {
          source: 'elon',
          message: `🔧 Elon prepared ${files.length} file update${files.length === 1 ? '' : 's'}. Applying now...`,
          fromPage: window.location.pathname,
        },
      });
      
      // Navigate to playground if not already there
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/playground')) {
        const projectId = currentSession?.id;
        const playgroundPath = projectId ? `/playground/${projectId}` : '/playground';
        setLocation(playgroundPath);
      }

      // Code changes sent successfully - let the playground handle user feedback naturally
      // No hardcoded success message needed
    } catch (error) {
      console.error('Failed to trigger playground generation:', error);
      // Let the error propagate naturally - don't add hardcoded error messages
      // The playground will handle error feedback appropriately
    }
  };

  return (
    <>
      <AnimatePresence>
        {viewState === 'closed' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`fixed bottom-6 right-6 z-[48] ${
              window.location.pathname.startsWith('/playground') ? 'hidden md:block' : 'block'
            }`}
          >
            <Button
              size="lg"
              className="h-16 w-16 rounded-full shadow-2xl"
              onClick={() => setViewState('full')}
            >
              <Bot className="h-8 w-8" />
            </Button>
            <div className="absolute -top-1 -right-1">
              <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center">
                <Database className="h-3 w-3" />
              </Badge>
            </div>
          </motion.div>
        )}

        {viewState === 'minimized' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[48]"
          >
            <Card className="w-80 shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm">Elon</CardTitle>
                  <Database className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setViewState('full')}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setViewState('closed')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground">
                  {messages.length > 0
                    ? `${messages.length} messages in conversation`
                    : 'Click to open your AI assistant'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {viewState === 'full' && (
          <>
            {/* Mobile: Sheet (like Chap-ZPT) - only render on mobile */}
            {isMobile && (
              <Sheet open={true} onOpenChange={(open) => !open && setViewState('closed')}>
                <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col [&>button]:hidden">
                <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="font-bold">Elon</span>
                    </SheetTitle>
                    <div className="flex items-center gap-2">
                      {messages.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          title="Export conversation"
                          onClick={() => {
                            const transcript = messages
                              .map(msg => {
                                const sender = msg.role === 'user' ? userDisplayName : 'Elon';
                                const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                                return `[${time}] ${sender}:\n${msg.content}\n`;
                              })
                              .join('\n');
                            const blob = new Blob([transcript], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            const date = new Date().toISOString().split('T')[0];
                            link.href = url;
                            link.download = `elon-conversation-${date}.txt`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Close"
                        onClick={() => setViewState('closed')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </SheetHeader>
                {/* Voice Call Mode Layout for Mobile */}
                {isInCall ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
                    {/* Large pulsing microphone */}
                    <div className="relative flex items-center justify-center mb-8">
                      {/* Pulsing rings */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-purple-500/30"
                        animate={{
                          scale: [1, 1.5, 2],
                          opacity: [0.6, 0.3, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-purple-500/30"
                        animate={{
                          scale: [1, 1.3, 1.6],
                          opacity: [0.6, 0.3, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: 0.5,
                          ease: "easeOut",
                        }}
                      />
                      {/* Microphone button */}
                      <motion.div
                        className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-2xl cursor-pointer"
                        animate={{
                          scale: isListening ? [1, 1.1, 1] : 1,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: isListening ? Infinity : 0,
                        }}
                        onClick={handleVoiceToggle}
                      >
                        {isListening ? (
                          <MicOff className="h-10 w-10 text-white" />
                        ) : (
                          <Mic className="h-10 w-10 text-white" />
                        )}
                      </motion.div>
                    </div>

                    {/* Status text */}
                    <div className="text-center space-y-4">
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-lg font-semibold text-foreground"
                      >
                        {isListening ? "Lyssnar..." : isSpeaking ? "Elon pratar..." : isLoading ? "Elon tänker..." : "I samtal"}
                      </motion.div>
                      
                      {/* Thinking indicator */}
                      {isLoading && !isSpeaking && (
                        <motion.div
                          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <motion.div
                            className="flex gap-1"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <div className="w-2 h-2 bg-purple-500 rounded-full" />
                            <div className="w-2 h-2 bg-purple-500 rounded-full" style={{ animationDelay: '0.2s' }} />
                            <div className="w-2 h-2 bg-purple-500 rounded-full" style={{ animationDelay: '0.4s' }} />
                          </motion.div>
                          <span>Bearbetar ditt meddelande...</span>
                        </motion.div>
                      )}
                      
                      {/* Live transcript */}
                      {transcript && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="max-w-sm px-4 py-3 bg-card border border-border rounded-lg shadow-lg"
                        >
                          <p className="text-sm text-muted-foreground mb-1">Du säger:</p>
                          <p className="text-base font-medium">{transcript}</p>
                        </motion.div>
                      )}

                      {/* Hang up button */}
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={handleCallToggle}
                        className="mt-6 rounded-full px-6 py-5 h-auto"
                      >
                        <PhoneOff className="h-5 w-5 mr-2" />
                        Avsluta samtal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="rounded-lg border border-border bg-muted/70 p-4 text-muted-foreground">
                            Ask me anything about your digital office, projects, or building stellar experiences.
                          </div>
                        ) : (
                          messages.map((msg, idx) => (
                            <MessageBubble
                              key={idx}
                              message={msg}
                              userName={userDisplayName}
                              onSuggestionClick={handleSuggestionClick}
                              onSendToPlayground={handleSendToPlayground}
                              onApplyChanges={handleApplyChanges}
                              displayedMessagesRef={displayedMessagesRef}
                            />
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
                  {/* Project Selector - only show when not on playground */}
                  {!window.location.pathname.startsWith('/playground') && userProjects.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={selectedProjectId?.toString() || "none"}
                        onValueChange={(value) => setSelectedProjectId(value === "none" ? null : parseInt(value))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select a project for context..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project selected</SelectItem>
                          {userProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProjectId && projectFiles.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {projectFiles.length} files
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder={isListening ? "Lyssnar..." : "Ask me anything about your digital office..."}
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    {voiceSupported && (
                      <Button
                        variant={voiceModeEnabled ? "default" : "outline"}
                        size="icon"
                        onClick={() => setVoiceModeEnabled(!voiceModeEnabled)}
                        title={voiceModeEnabled ? "Stäng av röstläge" : "Aktivera röstläge"}
                        className={voiceModeEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    )}
                    {voiceModeEnabled && (
                      <Button
                        variant={isListening ? "destructive" : "outline"}
                        size="icon"
                        onClick={handleVoiceToggle}
                        disabled={isLoading}
                        title={isListening ? "Stoppa inspelning" : "Starta inspelning"}
                        className={isListening ? "animate-pulse" : ""}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    )}
                    {voiceModeEnabled && (
                      <Button
                        variant={autoSpeakEnabled ? "default" : "outline"}
                        size="icon"
                        onClick={() => {
                          if (autoSpeakEnabled) {
                            stopSpeaking();
                          }
                          setAutoSpeakEnabled(!autoSpeakEnabled);
                        }}
                        title={autoSpeakEnabled ? "Stäng av uppläsning" : "Aktivera uppläsning"}
                        className={autoSpeakEnabled ? "bg-blue-600 hover:bg-blue-700" : ""}
                      >
                        {autoSpeakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                    )}
                    {voiceSupported && (
                      <Button
                        variant={isInCall ? "default" : "outline"}
                        size="icon"
                        onClick={handleCallToggle}
                        disabled={isLoading}
                        title={isInCall ? "Avsluta samtal" : "Starta röstsamtal"}
                        className={isInCall ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {isInCall ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading || isInCall}
                      className="brand-gradient text-white hover:opacity-90"
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Sparkles className="h-4 w-4" />
                        </motion.div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {isListening && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="h-2 w-2 bg-red-500 rounded-full"
                      />
                      <span>Lyssnar... {transcript && `"${transcript}"`}</span>
                    </div>
                  )}
                  {isSpeaking && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="h-2 w-2 bg-blue-500 rounded-full"
                      />
                      <span>Elon pratar...</span>
                    </div>
                  )}
                  {voiceError && (
                    <div className="text-sm text-red-500 mt-2 flex items-center justify-between">
                      <span>{voiceError}</span>
                      <Button variant="ghost" size="sm" onClick={clearError} className="h-6 px-2">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>
            )}

            {/* Desktop: Card - only render on desktop */}
            {!isMobile && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-[48]"
              >
              <Card className="w-[95vw] max-w-[820px] h-[85vh] max-h-[900px] shadow-2xl flex flex-col border border-border rounded-lg overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border bg-background flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <CardTitle className="text-base font-bold text-foreground">Elon</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      title="Export conversation"
                      onClick={() => {
                        const transcript = messages
                          .map(msg => {
                            const sender = msg.role === 'user' ? userDisplayName : 'Elon';
                            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                            return `[${time}] ${sender}:\n${msg.content}\n`;
                          })
                          .join('\n');
                        const blob = new Blob([transcript], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        const date = new Date().toISOString().split('T')[0];
                        link.href = url;
                        link.download = `elon-conversation-${date}.txt`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    title="Settings"
                    onClick={() => setViewState('settings')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Minimize"
                    onClick={() => setViewState('minimized')}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Close"
                    onClick={() => setViewState('closed')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Voice Call Mode Layout for Desktop */}
              {isInCall ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
                    {/* Large pulsing microphone */}
                    <div className="relative flex items-center justify-center mb-8">
                      {/* Pulsing rings */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-purple-500/30"
                        animate={{
                          scale: [1, 1.5, 2],
                          opacity: [0.6, 0.3, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-purple-500/30"
                        animate={{
                          scale: [1, 1.3, 1.6],
                          opacity: [0.6, 0.3, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: 0.5,
                          ease: "easeOut",
                        }}
                      />
                      {/* Microphone button */}
                      <motion.div
                        className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-2xl cursor-pointer"
                        animate={{
                          scale: isListening ? [1, 1.1, 1] : 1,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: isListening ? Infinity : 0,
                        }}
                        onClick={handleVoiceToggle}
                      >
                        {isListening ? (
                          <MicOff className="h-12 w-12 text-white" />
                        ) : (
                          <Mic className="h-12 w-12 text-white" />
                        )}
                      </motion.div>
                    </div>

                  {/* Status text */}
                  <div className="text-center space-y-4">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-lg font-semibold text-foreground"
                    >
                      {isListening ? "Lyssnar..." : isSpeaking ? "Elon pratar..." : isLoading ? "Elon tänker..." : "I samtal"}
                    </motion.div>
                    
                    {/* Thinking indicator */}
                    {isLoading && !isSpeaking && (
                      <motion.div
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="flex gap-1"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <div className="w-2 h-2 bg-purple-500 rounded-full" />
                          <div className="w-2 h-2 bg-purple-500 rounded-full" style={{ animationDelay: '0.2s' }} />
                          <div className="w-2 h-2 bg-purple-500 rounded-full" style={{ animationDelay: '0.4s' }} />
                        </motion.div>
                        <span>Bearbetar ditt meddelande...</span>
                      </motion.div>
                    )}
                    
                    {/* Live transcript */}
                    {transcript && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-md px-4 py-3 bg-card border border-border rounded-lg shadow-lg"
                      >
                        <p className="text-sm text-muted-foreground mb-1">Du säger:</p>
                        <p className="text-base font-medium">{transcript}</p>
                      </motion.div>
                    )}

                    {/* Hang up button */}
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={handleCallToggle}
                      className="mt-6 rounded-full px-8 py-6 h-auto"
                    >
                      <PhoneOff className="h-5 w-5 mr-2" />
                      Avsluta samtal
                    </Button>
                  </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="rounded-lg border border-border bg-muted/70 p-4 text-muted-foreground">
                            Ask me anything about your digital office, projects, or building stellar experiences.
                          </div>
                        ) : (
                          messages.map((msg, idx) => (
                            <MessageBubble
                              key={idx}
                              message={msg}
                              userName={userDisplayName}
                              onSuggestionClick={handleSuggestionClick}
                              onSendToPlayground={handleSendToPlayground}
                              onApplyChanges={handleApplyChanges}
                              displayedMessagesRef={displayedMessagesRef}
                            />
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
                  {/* Project Selector - only show when not on playground */}
                  {!window.location.pathname.startsWith('/playground') && userProjects.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={selectedProjectId?.toString() || "none"}
                        onValueChange={(value) => setSelectedProjectId(value === "none" ? null : parseInt(value))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select a project for context..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project selected</SelectItem>
                          {userProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProjectId && projectFiles.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {projectFiles.length} files
                        </Badge>
                      )}
                    </div>
                  )}

                <div className="flex gap-2">
                  <Input
                    placeholder={isListening ? "Lyssnar..." : "Ask me anything about your digital office..."}
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  {voiceSupported && (
                    <Button
                      variant={voiceModeEnabled ? "default" : "outline"}
                      size="icon"
                      onClick={() => setVoiceModeEnabled(!voiceModeEnabled)}
                      title={voiceModeEnabled ? "Stäng av röstläge" : "Aktivera röstläge"}
                      className={voiceModeEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                  {voiceModeEnabled && (
                    <Button
                      variant={isListening ? "destructive" : "outline"}
                      size="icon"
                      onClick={handleVoiceToggle}
                      disabled={isLoading}
                      title={isListening ? "Stoppa inspelning" : "Starta inspelning"}
                      className={isListening ? "animate-pulse" : ""}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                  {voiceModeEnabled && (
                    <Button
                      variant={autoSpeakEnabled ? "default" : "outline"}
                      size="icon"
                      onClick={() => {
                        if (autoSpeakEnabled) {
                          stopSpeaking();
                        }
                        setAutoSpeakEnabled(!autoSpeakEnabled);
                      }}
                      title={autoSpeakEnabled ? "Stäng av uppläsning" : "Aktivera uppläsning"}
                      className={autoSpeakEnabled ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {autoSpeakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                  )}
                  {voiceSupported && (
                    <Button
                      variant={isInCall ? "default" : "outline"}
                      size="icon"
                      onClick={handleCallToggle}
                      disabled={isLoading}
                      title={isInCall ? "Avsluta samtal" : "Starta röstsamtal"}
                      className={isInCall ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {isInCall ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading || isInCall}
                    className="brand-gradient text-white hover:opacity-90"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {isListening && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="h-2 w-2 bg-red-500 rounded-full"
                    />
                    <span>Lyssnar... {transcript && `"${transcript}"`}</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="h-2 w-2 bg-blue-500 rounded-full"
                    />
                    <span>Elon pratar...</span>
                  </div>
                )}
                {voiceError && (
                  <div className="text-sm text-red-500 mt-2 flex items-center justify-between">
                    <span>{voiceError}</span>
                    <Button variant="ghost" size="sm" onClick={clearError} className="h-6 px-2">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
            )}
          </>
        )}

        {viewState === 'settings' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[48]"
          >
            <Card className="w-[480px] shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
                <CardTitle className="text-base">OmniAssistant Settings</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewState('full')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">AI Insights</Label>
                      <p className="text-xs text-muted-foreground">
                        Get proactive suggestions and insights
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>

                  {voiceSupported && (
                    <>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            Voice Mode
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Prata med Elon istället för att skriva
                          </p>
                        </div>
                        <Switch
                          checked={voiceModeEnabled}
                          onCheckedChange={setVoiceModeEnabled}
                        />
                      </div>

                      {voiceModeEnabled && (
                        <div className="flex items-center justify-between pl-4">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Volume2 className="h-4 w-4" />
                              Auto-speak Responses
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Låt Elon läsa upp sina svar automatiskt
                            </p>
                          </div>
                          <Switch
                            checked={autoSpeakEnabled}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                stopSpeaking();
                              }
                              setAutoSpeakEnabled(checked);
                            }}
                          />
                        </div>
                      )}
                      {selectedVoice && (
                        <div className="pl-4 pt-2">
                          <p className="text-xs text-muted-foreground">
                            🎤 Röst: <span className="font-medium text-foreground">{selectedVoice}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {!voiceSupported && (
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        <Mic className="h-3 w-3 inline mr-1" />
                        Voice mode är inte tillgängligt i din webbläsare. Använd Chrome eller Edge för bästa stöd.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (confirm('Clear all conversation history? This cannot be undone.')) {
                        clearSession();
                      }
                    }}
                  >
                    Clear Conversation History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FeatureIndicators({ features }: { features: any }) {
  return (
    <div className="flex gap-1">
      <Badge variant="secondary" className="h-5 px-1.5">
        <Database className="h-3 w-3" />
      </Badge>
      <Badge variant="secondary" className="h-5 px-1.5">
        <Sparkles className="h-3 w-3" />
      </Badge>
      <Badge variant="secondary" className="h-5 px-1.5">
        <Brain className="h-3 w-3" />
      </Badge>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Bot className="h-16 w-16 text-primary/60 mb-4" />
      <h3 className="font-semibold text-xl mb-2">Welcome to Elon 🤝</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        I’m here to help you craft beautiful experiences—whether that's building UI components,
        planning your next release, or polishing your copy. Ask me anything and let’s create together.
      </p>
    </div>
  );
}

function MessageBubble({
  message,
  onSuggestionClick,
  onSendToPlayground,
  onApplyChanges,
  displayedMessagesRef,
  userName,
}: {
  message: OmniAssistantMessage;
  onSuggestionClick?: (suggestion: string) => void;
  onSendToPlayground?: (content: string) => void;
  onApplyChanges?: (files: Array<{ path: string; content: string }>) => void;
  displayedMessagesRef?: React.MutableRefObject<Set<string>>;
  userName: string;
}) {
  const isUser = message.role === 'user';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const animationRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const speedRef = useRef(100); // characters per second for typewriter effect (increased from 30)

  // Create unique message ID based on content and timestamp
  const messageId = `${message.role}-${message.timestamp?.getTime()}-${message.content.substring(0, 50)}`;
  const hasBeenDisplayed = displayedMessagesRef?.current.has(messageId) || false;

  // Typewriter effect for assistant messages - only on first display
  useEffect(() => {
    if (isUser) {
      // User messages show immediately
      setDisplayedContent(message.content);
      return;
    }

    // If message has already been displayed, show instantly
    if (hasBeenDisplayed) {
      setDisplayedContent(message.content);
      setIsTyping(false);
      return;
    }

    // Reset when message content changes and hasn't been displayed yet
    if (message.content && message.content !== displayedContent && !hasBeenDisplayed) {
      setIsTyping(true);
      currentIndexRef.current = 0;
      lastUpdateRef.current = Date.now();
      setDisplayedContent('');

      const animate = () => {
        const now = Date.now();
        const elapsed = now - lastUpdateRef.current;
        const charsToAdd = Math.floor((elapsed / 1000) * speedRef.current);

        if (charsToAdd > 0) {
          const newIndex = Math.min(
            currentIndexRef.current + charsToAdd,
            message.content.length
          );

          setDisplayedContent(message.content.substring(0, newIndex));
          currentIndexRef.current = newIndex;
          lastUpdateRef.current = now;

          if (newIndex >= message.content.length) {
            setIsTyping(false);
            // Mark message as displayed
            if (displayedMessagesRef) {
              displayedMessagesRef.current.add(messageId);
            }
            return;
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [message.content, isUser, hasBeenDisplayed, messageId, displayedMessagesRef]);

  // Extract code blocks with file paths from message
  const extractCodeBlocks = (content: string): Array<{ path: string; content: string; language?: string }> => {
    const codeBlocks: Array<{ path: string; content: string; language?: string }> = [];
    // Match code blocks - look for file path in comment at start of code block
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1];
      const codeContent = match[2].trim();
      
      // Look for file path in various formats:
      // // file: path/to/file.tsx
      // // file:path/to/file.tsx
      // file: path/to/file.tsx
      // File: path/to/file.tsx
      const filePathMatch = codeContent.match(/^(?:\/\/\s*)?(?:file|File):\s*([^\n]+)/i);
      const filePath = filePathMatch ? filePathMatch[1].trim() : null;
      
      if (filePath) {
        // Remove the file path comment from the code content
        const actualCode = codeContent.replace(/^(?:\/\/\s*)?(?:file|File):\s*[^\n]+\n?/i, '').trim();
        codeBlocks.push({ path: filePath, content: actualCode, language });
      }
    }
    
    return codeBlocks;
  };

  const codeBlocks = !isUser ? extractCodeBlocks(message.content) : [];
  const hasEditableCode = codeBlocks.length > 0;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };


  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse text-right' : 'text-left')}>
      <div
        className={cn(
          'flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shadow-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-zinc-800 text-white'
        )}
        aria-label={isUser ? userName : 'Elon'}
      >
        {isUser ? userName.charAt(0).toUpperCase() : 'E'}
      </div>

      <div className={cn('flex-1 space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'text-xs text-muted-foreground flex items-center gap-2',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="font-semibold">{isUser ? userName : 'Elon'}</span>
          {message.timestamp && (
            <span className="text-[11px] opacity-70">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-3 max-w-[85%] shadow border transition-all',
            isUser
              ? 'bg-gradient-to-r from-primary/90 via-primary to-primary/80 text-primary-foreground'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-foreground'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap text-primary-foreground">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              {isTyping && <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-1" />}
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    const filePathMatch = codeString.match(/\/\/\s*file:\s*([^\n]+)/);
                    const filePath = filePathMatch ? filePathMatch[1].trim() : null;
                    const actualCode = filePathMatch ? codeString.replace(/\/\/\s*file:\s*[^\n]+\n/, '').trim() : codeString;
                    const isInline = !match || className?.includes('inline');

                    return !isInline && match ? (
                      <div className="relative my-2">
                        {filePath && (
                          <div className="text-xs text-white/70 mb-1 px-2">
                            📄 {filePath}
                          </div>
                        )}
                        <div className="relative group">
                          <SyntaxHighlighter
                            style={vscDarkPlus as any}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md"
                            {...(props as any)}
                          >
                            {actualCode}
                          </SyntaxHighlighter>
                          <button
                            onClick={() => handleCopyCode(actualCode)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-background/80 rounded hover:bg-background"
                            title="Copy code"
                          >
                            {copiedCode === actualCode ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-4">{children}</ol>,
                  li: ({ children }) => <li className="text-sm mb-1">{children}</li>,
                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-4 italic my-2">{children}</blockquote>
                  ),
                  a: ({ children, href }) => (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {displayedContent || (isUser ? message.content : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action Buttons for Assistant Messages */}
        {!isUser && (
          <div className="flex gap-2 flex-wrap">
            {hasEditableCode && onApplyChanges && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onApplyChanges(codeBlocks)}
                className="text-xs h-7 gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                Apply to Playground ({codeBlocks.length} file{codeBlocks.length > 1 ? 's' : ''})
              </Button>
            )}
            {!hasEditableCode && onSendToPlayground && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSendToPlayground(message.content)}
                className="text-xs h-7 gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                Send to Playground
              </Button>
            )}
          </div>
        )}

        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {message.toolsUsed.map((tool, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tool}
              </Badge>
            ))}
          </div>
        )}

        {message.suggestions && message.suggestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-white/70">Suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {message.suggestions.map((suggestion, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => onSuggestionClick?.(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {message.conversationId && (
          <p className="text-xs text-white/70">
            <Database className="h-3 w-3 inline mr-1" />
            Saved to memory
          </p>
        )}
      </div>
    </div>
  );
}
