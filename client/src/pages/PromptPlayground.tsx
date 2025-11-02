import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { apiFetch, getApiUrl } from '../lib/api';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../components/ui/resizable";
import { ScrollArea } from "../components/ui/scroll-area";
import { Sidebar } from "../components/ui/sidebar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { AlertCircle, HelpCircle, Eye, Code, Send, FileCode, Brain, MessageSquare, Settings, Laptop, Trash2, User, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { ChatMessage } from "../components/ChatMessage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import Editor from "@monaco-editor/react";
import { ComponentPreview } from "../components/ComponentPreview/ComponentPreview";
import FileExplorer from "../components/FileExplorer/FileExplorer";
import { EnhancedFileExplorer } from "../components/EnhancedFileExplorer";
import SessionHistory from "../components/SessionHistory";
import { ChatAutocomplete } from "../components/ChatAutocomplete";
import { AgentMonitorPanel } from "../components/AgentMonitor/AgentMonitorPanel";
import { ComponentLibrary } from "../components/ComponentLibrary";
import { ProjectSharing } from "../components/ProjectSharing";
import { ProductionDeployment } from "../components/ProductionDeployment";
import { AdvancedPreview } from "../components/AdvancedPreview";
import { useAuth, getAuthHeaders } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useRoute } from "wouter";
import { webContainerService } from "../services/WebContainerService";

// Agent interface removed - using orchestration only

interface AIResponse {
  type: 'text' | 'component';
  text: string;
  files?: {
    path: string;
  content: string;
  }[];
}

interface OrchestrationStep {
  agent: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  previews?: string[];
}

interface GenerateResponse {
  response: AIResponse;
  orchestrationPlan: {
    subtasks: OrchestrationStep[];
  } | null;
}

interface Session {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  inputPrompt: string;
  generatedCode: string;
  status: string;
}

const SYSTEM_PROMPT = `Hey! I'm your AI development assistant - think of me as your friendly coding buddy who helps bring your ideas to life.

I work with a team of specialized AI agents to build complete, production-ready apps for you:
- Requirements Agent - figures out exactly what you want
- UI Designer - makes it look amazing
- Code Architect - plans the structure
- Style Generator - adds beautiful styling
- Code Generator - writes the actual code
- QA Agent - makes sure everything works perfectly

Just tell me what you want to build in plain English! I'll:
âœ¨ Understand your idea and ask questions if needed
ðŸŽ¨ Design a beautiful, modern UI
âš¡ Write clean, production-ready React code
ðŸ“± Make it responsive and user-friendly
ðŸš€ Ensure it works flawlessly

Don't worry about technical details - I've got you covered! Just describe your app like you're talking to a friend.

Output format for files:
**src/App.tsx**
\`\`\`typescript
// component code here
\`\`\`

**src/index.css**
\`\`\`css
/* styles here */
\`\`\`

Generate applications that users can actually interact with and that demonstrate the requested functionality completely.`;

const promptFormSchema = z.object({
  userPrompt: z.string().min(1, "User prompt is required"),
  model: z.string().default("claude-sonnet-4-5-20250929"),
  temperature: z.number().min(0).max(1).default(0.7),
  projectType: z.enum(['react', 'vue', 'node', 'python']).default('react'),
});

type PromptForm = z.infer<typeof promptFormSchema>;

interface FormFieldProps {
  field: {
    value: any;
    onChange: (value: any) => void;
  };
}

const getFileLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
    case 'tsx':
        return 'typescript';
      case 'js':
    case 'jsx':
        return 'javascript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      default:
        return 'typescript';
    }
  };

export default function PromptPlayground() {
  const { user, sessionToken, isSuperAdmin } = useAuth();
  const {
    currentSession,
    sessions,
    createSession,
    switchSession,
    addChatMessage,
    clearChat,
    updateGeneratedFiles,
    isSaving,
    lastSaved
  } = useWorkspace();

  const [match, params] = useRoute('/playground/:projectId');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'agents' | 'sessions' | 'settings'>('editor');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [response, setResponse] = useState<string | AIResponse | null>(null);
  const [orchestrationSteps, setOrchestrationSteps] = useState<OrchestrationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [error, setError] = useState<{ message: string; suggestion: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use workspace context for chat history (persists across navigation)
  const chatHistory = currentSession?.chatHistory || [];
  const currentSessionId = currentSession?.id || null;
  const [relevanceScore, setRelevanceScore] = useState<number>(0);
  const [relevanceData, setRelevanceData] = useState<any[]>([]);
  const [currentComponentName, setCurrentComponentName] = useState<string>('');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<{ id: number; name: string; description?: string; workspaceType?: 'personal' | 'team' } | null>(null);
  const [agentsActive, setAgentsActive] = useState(false); // Track if agents are currently working

  // Refs
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // WebContainer state
  const [webContainerReady, setWebContainerReady] = useState(false);
  const [webContainerBooting, setWebContainerBooting] = useState(false);
  const [useWebContainer, setUseWebContainer] = useState(true); // Toggle for fallback
  const { toast } = useToast();

  // Initialize or switch workspace session based on projectId
  useEffect(() => {
    if (!user) return;

    const projectId = params?.projectId || 'default';

    // Find existing session for this project
    const existingSession = sessions.find(
      s => s.type === 'playground' && s.metadata?.projectId === projectId
    );

    if (existingSession) {
      // Switch to existing session for this project
      if (currentSession?.id !== existingSession.id) {
        console.log(`🔄 Switching to existing session for project: ${projectId}`);
        switchSession(existingSession.id);
      }
    } else {
      // Create new session for this project with projectId in metadata
      const projectName = currentProject?.name || (projectId === 'default' ? 'Playground' : `Project ${projectId}`);
      console.log(`✨ Creating new session for project: ${projectId}`);
      createSession('playground', projectName, { projectId });
    }
  }, [user, params?.projectId, currentProject?.name, sessions, currentSession, createSession, switchSession]);

  // Restore generated files from workspace session
  useEffect(() => {
    if (currentSession?.generatedFiles && currentSession.generatedFiles.length > 0) {
      // Always restore files from workspace session when currentSession changes
      // This ensures files are visible even after tab switches or refreshes
      setResponse(prevResponse => {
        // Only update if files are different to avoid infinite loops
        const currentFiles = prevResponse?.type === 'component' ? prevResponse.files : [];
        const sessionFiles = currentSession.generatedFiles;

        // Check if files are actually different
        const filesChanged = currentFiles?.length !== sessionFiles.length ||
          !currentFiles?.every((f, i) => f.path === sessionFiles[i]?.path && f.content === sessionFiles[i]?.content);

        if (filesChanged) {
          console.log(`✅ Restoring ${sessionFiles.length} files from workspace session`);
          return {
            type: 'component',
            text: '',
            files: sessionFiles
          };
        }
        return prevResponse;
      });

      // Set the first file as selected if no file is selected
      if (selectedFileIndex === 0 && currentSession.generatedFiles[0]) {
        setEditorLanguage(getFileLanguage(currentSession.generatedFiles[0].path));
      }
    }
  }, [currentSession?.generatedFiles]); // Only depend on generatedFiles to avoid re-runs

  // Auto-scroll to bottom when chat history changes
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Handle prompt from URL (from homepage)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPrompt = urlParams.get('prompt') || localStorage.getItem('pendingPrompt');
    
    if (urlPrompt && user) {
      // Auto-fill the prompt and trigger generation
      form.setValue('userPrompt', urlPrompt);
      localStorage.removeItem('pendingPrompt');
      
      // Auto-submit after a short delay
      setTimeout(() => {
        const formData = form.getValues();
        generateMutation.mutate(formData);
      }, 500);
    }
  }, [user]);

  // Boot WebContainer on component mount
  useEffect(() => {
    async function initWebContainer() {
      // Check if WebContainer is supported
      if (!useWebContainer) {
        console.log('âš ï¸ WebContainer disabled, using server-side deployment');
        return;
      }

      try {
        setWebContainerBooting(true);
        console.log('ðŸš€ Booting WebContainer...');
        
        await webContainerService.boot();
        
        setWebContainerReady(true);
        setWebContainerBooting(false);
        console.log('âœ… WebContainer ready!');
        
        toast({
          title: "WebContainer Ready",
          description: "Browser-based preview is now available for instant updates!",
        });
      } catch (error) {
        console.error('âŒ Failed to boot WebContainer:', error);
        setWebContainerBooting(false);
        setWebContainerReady(false);
        setUseWebContainer(false); // Fallback to server-side
        
        toast({
          title: "WebContainer Unavailable",
          description: "Using server-side deployment as fallback. Preview may be slower.",
          variant: "destructive",
        });
      }
    }

    initWebContainer();

    // Cleanup on unmount
    return () => {
      webContainerService.teardown().catch(console.error);
    };
  }, [useWebContainer, toast]);

  // Load project context if projectId is in URL
  useEffect(() => {
    if (params?.projectId && sessionToken) {
      const projectId = params.projectId;
      
      // Load project details
      apiFetch(`/api/workspaces/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(project => {
          setCurrentProject({
            id: project.id,
            name: project.name,
            description: project.description,
            workspaceType: project.workspaceType || 'personal'
          });

          console.log('âœ… Loaded project:', project.name, `(${project.workspaceType || 'personal'})`);
        })
        .catch(err => {
          console.error('Failed to load project:', err);
        });
      
      // Load chat history
      apiFetch(`/api/workspaces/${projectId}/chat?limit=100`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(messages => {
          if (messages && messages.length > 0) {
            // Transform messages to chat history format
            const history = messages.reverse().map((msg: any) => ({
              role: msg.message.messageType === 'user' ? 'user' : 'assistant',
              content: msg.message.message,
              timestamp: new Date(msg.message.createdAt).getTime()
            }));
            history.forEach((msg: any) => addChatMessage(msg));
            console.log(`âœ… Loaded ${history.length} chat messages`);
          } else {
            // No history, add welcome message
            addChatMessage({
              role: 'assistant',
              content: `ðŸ‘‹ Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
              timestamp: Date.now()
            });
          }
        })
        .catch(err => {
          console.error('Failed to load chat history:', err);
          // Add welcome message on error
          addChatMessage({
            role: 'assistant',
            content: `ðŸ‘‹ Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
            timestamp: Date.now()
          });
        });
      
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
          return res.json();
        })
        .then(files => {
          console.log('Raw files from API:', files);
          if (files && files.length > 0) {
            // Transform to response format - handle both fileContent and content
            const fileList = files.map((f: any) => ({
              path: f.filePath || f.path,
              content: f.fileContent || f.content || ''
            }));
            setResponse({
              type: 'component',
              text: '',
              files: fileList
            });
            console.log(`âœ… Loaded ${fileList.length} project files`);
            
            // Set the first file as selected
            if (fileList.length > 0) {
              setSelectedFileIndex(0);
              setEditorLanguage(getFileLanguage(fileList[0].path));
            }
          } else {
            console.log('No files found in project');
          }
        })
        .catch(err => {
          console.error('Failed to load project files:', err);
        });
    }
  }, [params?.projectId, sessionToken]);

  // Removed agent query since we always use orchestration now

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
          // Example lines from Vite:
          //   âžœ  Local:   http://localhost:5173/
          // Example lines from DeploymentService:
          //   âœ… Development server started at http://localhost:3002
          const localUrlMatch = line.match(/(?:Local:\s+|started at\s+)(https?:\/\/[^\s]+)/i);
          if (localUrlMatch && localUrlMatch[1]) {
            const url = localUrlMatch[1];
            // Auto-switch to preview when dev server is ready (switch tab FIRST)
            setActiveTab('preview');

            // Wait for tab switch to render before setting preview URL
            setTimeout(() => {
              setLivePreviewUrl(url);
              addChatMessage({
                role: 'assistant',
                content: `ðŸ"Œ Dev server ready at ${url}. Switching to Previewâ€¦`,
                timestamp: Date.now()
              });
            }, 100);
          }
        }
      } catch {
        // ignore malformed messages (e.g., heartbeat)
      }
    };

    const handleError = () => {
      // Retry after a short delay
      if (es) {
        es.close();
      }
      if (retryTimer === null) {
        retryTimer = window.setTimeout(() => {
          es = new EventSource(streamUrl);
          retryTimer = null;
          // reattach handlers
          if (es) {
            es.onmessage = (event) => {
              try {
                const payload = JSON.parse(event.data);
                if (payload?.type === 'output' && typeof payload.data === 'string') {
                  const line = payload.data;
                  const localUrlMatch = line.match(/(?:Local:\s+|started at\s+)(https?:\/\/[^\s]+)/i);
                  if (localUrlMatch && localUrlMatch[1]) {
                    const url = localUrlMatch[1];
                    setActiveTab('preview');
                    setTimeout(() => {
                      setLivePreviewUrl(url);
                      addChatMessage({ role: 'assistant', content: `ðŸ"Œ Dev server ready at ${url}. Switching to Previewâ€¦`, timestamp: Date.now() });
                    }, 100);
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
  }, [currentComponentName]);

  // Ensure we clear live preview URL on generation start via SSE events
  useEffect(() => {
    if (isLoading) {
      setLivePreviewUrl(null);
    }
  }, [isLoading]);


  // Listen for continue session events
  useEffect(() => {
    const handleContinueSession = (event: CustomEvent<Session>) => {
      const session = event.detail;

      // Parse the generated code back into files
      const files = JSON.parse(session.generatedCode);

      // Add messages to workspace context
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

      // Set the response
      setResponse({
        type: 'component',
        text: session.title,
        files
      });

      // Update generated files in workspace
      updateGeneratedFiles(files);
    };

    window.addEventListener('continueSession', handleContinueSession as EventListener);
    return () => {
      window.removeEventListener('continueSession', handleContinueSession as EventListener);
    };
  }, [addChatMessage, updateGeneratedFiles]);

  // Set up SSE connections
  useEffect(() => {
    const eventsSource = new EventSource(getApiUrl('/api/events'));
    const logsSource = new EventSource(getApiUrl('/api/logs'));
    const agentActivitySource = new EventSource(getApiUrl('/api/sse/agent-activity'));

    // ðŸ¤– Agent Activity Stream - Real-time updates
    agentActivitySource.onmessage = (event) => {
      const agentData = JSON.parse(event.data);
      
      switch (agentData.type) {
        case 'orchestration:start':
          setAgentsActive(true);
          addChatMessage({
            role: 'assistant',
            content: `Awesome! ðŸš€ Let me get the team together to build this for you...`,
            timestamp: Date.now()
          });
          break;

        case 'phase:start':
          const phaseAgents = agentData.agentsInPhase || [];
          const phaseAgentNames = phaseAgents.map((a: string) =>
            a.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          );
          const phaseMsg = phaseAgentNames.length > 0
            ? `Time for ${phaseAgentNames.join(' and ')} to jump in! ðŸ’ª`
            : `Moving to the next step...`;
          addChatMessage({
            role: 'assistant',
            content: phaseMsg,
            timestamp: Date.now()
          });
          break;

        case 'agent:start':
          if (agentData.agentId) {
            const agentMessages: Record<string, string> = {
              'requirements-analyst': "Figuring out exactly what you need... ðŸ¤”",
              'ui-designer': "Designing something beautiful for you... ðŸŽ¨",
              'component-architect': "Planning the perfect structure... ðŸ—ï¸",
              'style-generator': "Making it look stunning... âœ¨",
              'code-generator': "Writing the code now... ðŸ’»",
              'completion': "Just doing a final quality check... ðŸ”"
            };
            const message = agentMessages[agentData.agentId] || "Working on it... âš¡";
            addChatMessage({
              role: 'assistant',
              content: message,
              timestamp: Date.now()
            });
          }
          break;

        case 'agent:complete':
          if (agentData.agentId) {
            const completeMessages: Record<string, string> = {
              'requirements-analyst': "Got it! I know exactly what we need to build âœ…",
              'ui-designer': "Design is ready and looking great! âœ…",
              'component-architect': "Architecture planned out perfectly âœ…",
              'style-generator': "Styling is all set! âœ…",
              'code-generator': "Code is written and ready! âœ…",
              'completion': "Everything looks perfect! âœ…"
            };
            const message = completeMessages[agentData.agentId] || "Done! âœ…";
            addChatMessage({
              role: 'assistant',
              content: message,
              timestamp: Date.now()
            });
          }
          break;

        case 'phase:complete':
          addChatMessage({
            role: 'assistant',
            content: `Great progress! Moving forward... ðŸŽ¯`,
            timestamp: Date.now()
          });
          break;
          
        case 'orchestration:complete':
          // Keep agents active! File generation happens after orchestration
          addChatMessage({
            role: 'assistant',
            content: `Agents done! Now generating your files... ðŸ"`,
            timestamp: Date.now()
          });
          break;

        case 'agent:error':
          if (agentData.error) {
            addChatMessage({
              role: 'assistant',
              content: `Hmm, hit a small snag: ${agentData.error}. Let me try a different approach...`,
              timestamp: Date.now()
            });
          }
          break;
      }
    };

    eventsSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'GENERATION_START':
    setIsLoading(true);
          setError(null);
          // Keep current response and steps to support iterative edits
          break;

        case 'PROJECT_CONTEXT_LOADED':
          addChatMessage({
            role: 'assistant',
            content: `Got your project loaded! ðŸ“‚`,
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
          addChatMessage({
            role: 'assistant',
            content: `All done! ðŸŽ‰ Your app is ready - check out the Editor and Preview tabs!`,
            timestamp: Date.now()
          });
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
            content: `Oops, something went wrong: ${data.data.error}\n\nðŸ’¡ ${data.data.suggestion}`,
            timestamp: Date.now()
          });
          break;
      }
    };

    logsSource.onmessage = (event) => {
      const logEntry = JSON.parse(event.data);
      if (logEntry.category === 'ComponentGenerator' && logEntry.metadata?.generatedFiles) {
        setOrchestrationSteps(prev => {
          return prev.map(step => {
            if (step.status === 'in_progress') {
              return {
                ...step,
                previews: logEntry.metadata.generatedFiles.map((file: { content: string }) => file.content),
                dependencies: logEntry.metadata.dependencies || []
              };
            }
            return step;
          });
        });
      }
    };

    eventsSource.onerror = (error) => {
      console.error('SSE Error:', error);
      toast({
        title: "Connection Error",
        description: "Lost connection to server. Please refresh the page.",
        variant: "destructive"
      });
    };

    logsSource.onerror = (error) => {
      console.error('SSE Error:', error);
      toast({
        title: "Connection Error",
        description: "Lost connection to server. Please refresh the page.",
        variant: "destructive"
      });
    };

    return () => {
      eventsSource.close();
      logsSource.close();
      agentActivitySource.close();
    };
  }, [toast]);

  // ðŸš€ Deploy to WebContainer or fallback to server-side
  async function deployToRuntime(files: Array<{ path: string; content: string }>, componentName: string) {
    try {
      if (webContainerReady && useWebContainer) {
        console.log('ðŸš€ Deploying to WebContainer...');
        
        addChatMessage({
          role: 'assistant',
          content: `ðŸŒ Deploying to browser-based WebContainer for instant preview...`,
          timestamp: Date.now()
        });

        // Fix file paths: move package.json, tsconfig.json, vite.config.ts to root
        const fixedFiles = files.map(file => {
          const filename = file.path.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path.startsWith('src/')) {
            console.log(`ðŸ“¦ Moving ${file.path} â†’ ${filename} (root level)`);
            return { ...file, path: filename };
          }
          return file;
        });

        // Write files to WebContainer
        await webContainerService.writeFiles(fixedFiles);
        console.log('âœ… Files written to WebContainer');

        addChatMessage({
          role: 'assistant',
          content: `ðŸ“¦ Installing npm dependencies in browser...`,
          timestamp: Date.now()
        });

        // Install dependencies
        await webContainerService.installDependencies((msg) => {
          if (msg.includes('added') || msg.includes('dependencies')) {
            addChatMessage({
              role: 'assistant',
              content: `âœ… ${msg}`,
              timestamp: Date.now()
            });
          }
        });

        addChatMessage({
          role: 'assistant',
          content: `ðŸš€ Starting Vite dev server in browser...`,
          timestamp: Date.now()
        });

        // Start dev server
        const devServerUrl = await webContainerService.startDevServer((msg) => {
          if (msg.includes('ready') || msg.includes('Local:')) {
            addChatMessage({
              role: 'assistant',
              content: `âœ… ${msg}`,
              timestamp: Date.now()
            });
          }
        });

        console.log('âœ… WebContainer dev server URL:', devServerUrl);

        // Switch to preview tab FIRST, then set URL after tab is visible
        // This prevents race condition where iframe tries to load while hidden
        setActiveTab('preview');

        // Wait for tab switch to render before setting preview URL
        // This ensures iframe is visible when it starts loading
        setTimeout(() => {
          setLivePreviewUrl(devServerUrl);

          addChatMessage({
            role: 'assistant',
            content: `ðŸŽ‰ Preview is ready at: ${devServerUrl}`,
            timestamp: Date.now()
          });
        }, 100);

      } else {
        // Fallback to server-side deployment
        console.log('ðŸ“¡ Deploying to server...');
        
        addChatMessage({
          role: 'assistant',
          content: `ðŸ“¡ Deploying to server (WebContainer unavailable)...`,
          timestamp: Date.now()
        });

        // Call existing server-side deployment
      const response = await apiFetch('/api/components/generate', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
            componentName,
            files,
            deploymentType: 'local'
          })
        });

        if (response.ok) {
      const result = await response.json();
          if (result.deploymentUrl) {
            // Switch to preview tab FIRST, then set URL
            setActiveTab('preview');

            // Wait for tab switch to render before setting preview URL
            setTimeout(() => {
              setLivePreviewUrl(result.deploymentUrl);

              addChatMessage({
        role: 'assistant',
                content: `âœ… Server deployment complete! Preview available at: ${result.deploymentUrl}`,
                timestamp: Date.now()
              });
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('âŒ Deployment failed:', error);
      addChatMessage({
        role: 'assistant',
        content: `âŒ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now()
      });
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

  const generateMutation = useMutation({
    mutationFn: async (data: PromptForm) => {
      setError(null);
      // Preserve existing response and terminal logs for iterative workflow

      // Add user message to chat history
      addChatMessage({
        role: 'user',
        content: data.userPrompt,
        timestamp: Date.now()
      });

      // Clear the form input after sending
      form.reset({
        userPrompt: "",
        model: data.model,
        temperature: data.temperature,
        projectType: data.projectType
      });

      // âœ¨ Bolt.new-style: Auto-switch to Editor tab FIRST (before loading state)
      console.log('ðŸŽ¨ Switching to Editor tab');
      setActiveTab('editor');

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
          const relevanceResults = await relevanceRes.json();
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

      // Add progressive analysis updates with more personality
      setTimeout(() => {
        addChatMessage({
          role: 'assistant',
          content: isExistingProject
            ? `Let me check out your current project first... ðŸ“‚`
            : `Thinking about what you need... ðŸ¤”`,
          timestamp: Date.now()
        });
      }, 500);

      setTimeout(() => {
        addChatMessage({
          role: 'assistant',
          content: isExistingProject
            ? `Figuring out what to change and what to keep... ðŸ”„`
            : `Breaking this down into features and components... ðŸ’¡`,
          timestamp: Date.now()
        });
      }, 1200);

      setTimeout(() => {
        addChatMessage({
          role: 'assistant',
          content: `Getting the specialized agents ready to help... ðŸŽ¨`,
          timestamp: Date.now()
        });
      }, 1800);

      // Reset progress tracking
      setOrchestrationSteps([]);
      setCurrentStep('');
      setOverallProgress(0);

      const res = await apiFetch("/api/prompts/generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(sessionToken),
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          ...data,
          systemPrompt: SYSTEM_PROMPT,
          orchestration: true, // Always use multi-agent orchestration
          sessionId: currentSessionId,
          projectId: currentProject?.id, // Pass project ID if working in a project context
          projectType: data.projectType,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
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

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    // Handle different SSE event types
                    if (data.type === 'STEP_START') {
                    console.log('ðŸ“ Step started:', data.data);
                    setCurrentStep(data.data.details || '');
                    setOverallProgress(data.data.progress || 0);
                    
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

                    // Add chat message
                    addChatMessage({
                      role: 'assistant',
                      content: `${data.data.details || 'Processing...'}`,
                      timestamp: Date.now()
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

                    // Add completion message
                    addChatMessage({
                      role: 'assistant',
                      content: `âœ… ${data.data.result || 'Step completed'}`,
                      timestamp: Date.now()
                    });
                  } else if (data.type === 'FILE_GENERATED') {
                    console.log('ðŸ“„ File generated:', data.data.file.path);

                    // Add file to response in real-time!
                    setResponse(prev => {
                      if (!prev || typeof prev === 'string') {
                        return {
                          type: 'component',
                          text: '',
                          files: [{ path: data.data.file.path, content: data.data.file.content }]
                        };
                      }

                      // Check if file already exists (avoid duplicates)
                      const existingIndex = prev.files?.findIndex(f => f.path === data.data.file.path);
                      if (existingIndex !== undefined && existingIndex >= 0 && prev.files) {
                        // Update existing file
                        const newFiles = [...prev.files];
                        newFiles[existingIndex] = { path: data.data.file.path, content: data.data.file.content };
                        return { ...prev, files: newFiles };
                      } else {
                        // Add new file
                        return {
                          ...prev,
                          files: [...(prev.files || []), { path: data.data.file.path, content: data.data.file.content }]
                        };
                      }
                    });

                    // Auto-select the first file and switch to editor tab
                    if (data.data.index === 1) {
                      setSelectedFileIndex(0);
                      setActiveTab('editor');
                      setEditorLanguage(getFileLanguage(data.data.file.path));

                      // Add a glow animation to the editor tab
                      addChatMessage({
                        role: 'assistant',
                        content: `âœ¨ Watch the magic happen! Code is being generated in real-time...`,
                        timestamp: Date.now()
                      });
                    }

                    // Show real-time file generation progress
                    addChatMessage({
                      role: 'assistant',
                      content: `ðŸ“ Generated ${data.data.file.path} (${data.data.index}/${data.data.total})`,
                      timestamp: Date.now()
                    });

                    // Add chat message for first and last file
                    if (data.data.index === 1) {
                      addChatMessage({
                        role: 'assistant',
                        content: `ðŸ“ Writing ${data.data.total} files to your project...`,
                        timestamp: Date.now()
                      });
                    } else if (data.data.index === data.data.total) {
                      addChatMessage({
                        role: 'assistant',
                        content: `âœ… All ${data.data.total} files generated!`,
                        timestamp: Date.now()
                      });
                    }
                  } else if (data.type === 'PROJECT_CONTEXT_LOADED') {
                    addChatMessage({
                      role: 'assistant',
                      content: data.data.message || 'Loaded project context',
                      timestamp: Date.now()
                    });
                  } else if (data.type === 'COMPLETE' || data.type === 'GENERATION_COMPLETE') {
                    console.log('ðŸŽ‰ Generation complete');
                    finalResult = data.data;
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE event:', line, e);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error reading stream:', e);
        }
        }

        // Return the final result
        return finalResult || { response: { type: 'text', text: 'Generation completed but no response received', files: [] } };
      } else {
        // Regular JSON response (backend didn't send SSE)
        console.log('ðŸ“¦ Received regular JSON response (not SSE)');
        return await res.json();
      }
    },
    onSuccess: async (data: GenerateResponse) => {
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
        const displayFiles = data.response.files.map(file => ({
          ...file,
          path: file.path.replace(/^workspaces\/[^/]+\//, '').replace(/^\/workspaces\/[^/]+\//, '')
        }));

        console.log('ðŸ"‚ Files to display:', displayFiles.length);

        // Extract a better component name from the user's prompt
        const promptText = form.getValues('userPrompt');
        let componentName = 'App';
        
        // Remove common words and extract meaningful nouns
        const cleanPrompt = promptText
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
        const fixedDisplayFiles = displayFiles.map(file => {
          const filename = file.path.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path.startsWith('src/')) {
            console.log(`ðŸ“¦ Moving ${file.path} â†’ ${filename} (root level for display)`);
            return { ...file, path: filename };
          }
          return file;
        });

        // Log what files were generated for debugging
        console.log('ðŸ“¦ Files generated by AI:', fixedDisplayFiles.map(f => f.path));
        
        // Validate critical files exist (LOG ERRORS but don't add fallbacks)
        const requiredFiles = ['index.html', 'package.json', 'tsconfig.json', 'src/App.tsx', 'src/main.tsx'];
        const missingFiles = requiredFiles.filter(required => 
          !fixedDisplayFiles.find(f => f.path === required || f.path === `src/${required}`)
        );
        
        if (missingFiles.length > 0) {
          console.error('âŒ MISSING REQUIRED FILES:', missingFiles);
          console.error('Generated files:', fixedDisplayFiles.map(f => f.path));
          
          addChatMessage({
            role: 'assistant',
            content: `âš ï¸ Warning: AI missed some files: ${missingFiles.join(', ')}. The app might not work correctly. You may need to regenerate.`,
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
        addChatMessage({
          role: 'assistant',
          content: `ðŸŽ‰ All ${displayFiles.length} files created successfully! Installing dependencies and starting development server...`,
          timestamp: Date.now()
        });
        
        addChatMessage({
          role: 'assistant',
          content: `ðŸš€ Development server is spinning up. This usually takes 10-15 seconds...`,
          timestamp: Date.now()
        });
        
        addChatMessage({
          role: 'assistant',
          content: `âœ¨ Almost ready! I'll automatically switch to the preview tab once the server is live.`,
          timestamp: Date.now()
        });
        
        setIsLoading(false);
        console.log('âœ… All files displayed!');
        
        // ðŸš€ Deploy to WebContainer or server immediately
        setTimeout(() => {
          deployToRuntime(displayFiles, componentName);
        }, 500); // Small delay for UI to update

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
                  addChatMessage({
                    role: 'assistant',
                    content: `ðŸ'¾ Saved ${displayFiles.length} files to workspace`,
                    timestamp: Date.now()
                  });
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
        } else {
          setResponse(prev => {
            if (prev && typeof prev === 'object' && 'files' in prev && data.response?.files) {
              // Merge files by path, preserving existing
              const existing = new Map((prev.files || []).map(f => [f.path, f]));
              for (const f of data.response.files) existing.set(f.path, f);
              return { ...(prev as any), files: Array.from(existing.values()) };
            }
            return data.response;
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

  return (
    <div className="fixed inset-0 w-full h-screen bg-background flex flex-col overflow-hidden">
      {/* Extended header background to cover navigation area */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-muted/30 z-0"></div>
      
      {/* Spacer for floating navigation */}
      <div className="h-16 flex-shrink-0"></div>
      
      {/* Top Bar - Fixed height */}
      <div className="h-12 border-b flex items-center justify-between px-4 bg-muted/30 flex-shrink-0 relative z-10">
        <div className="flex items-center space-x-4">
          {currentProject && (
            <div className="flex items-center gap-2">
              <div className="flex items-center px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                <Laptop className="h-3.5 w-3.5 mr-2 text-primary" />
                <span className="text-xs font-semibold text-primary">{currentProject.name}</span>
              </div>
              {/* Workspace Type Badge */}
              {currentProject.workspaceType === 'team' ? (
                <div className="flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
                  <Users className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Team</span>
                </div>
              ) : (
                <div className="flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800">
                  <User className="h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Personal</span>
                </div>
              )}
            </div>
          )}
          
          {/* Superadmin Only - Status Indicators */}
          {isSuperAdmin && (
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <h1 className="text-sm font-medium">Multi-Agent App Generator</h1>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isLoading ? "bg-blue-500 animate-pulse" : "bg-green-500"}`}></div>
                {isLoading ? "AI Agents Working..." : "Ready for Ideas"}
              </div>
              <div className="flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Orchestration Mode</span>
              </div>
              {/* WebContainer Status */}
              <div className={`flex items-center px-2 py-1 rounded-full ${
                webContainerReady ? 'bg-green-100 dark:bg-green-900/20' :
                webContainerBooting ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                'bg-gray-100 dark:bg-gray-800'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                  webContainerReady ? 'bg-green-500' :
                  webContainerBooting ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-400'
                }`}></div>
                <span className={`text-xs font-medium ${
                  webContainerReady ? 'text-green-700 dark:text-green-300' :
                  webContainerBooting ? 'text-yellow-700 dark:text-yellow-300' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {webContainerReady ? 'WebContainer Ready' :
                   webContainerBooting ? 'Booting...' :
                   'Server Mode'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <ComponentLibrary
            onSelectComponent={(component) => {
              // Add component code to current file or create new file
              const componentFile = {
                path: `src/components/${component.name}.tsx`,
                content: component.code
              };

              if (response && typeof response === 'object' && response.files) {
                setResponse(prev => ({
                  ...prev as AIResponse,
                  files: [...(prev as AIResponse).files!, componentFile]
                }));
              } else {
                setResponse({
                  type: 'component',
                  text: `Added ${component.name} component`,
                  files: [componentFile]
                });
              }

              toast({
                title: "Component Added!",
                description: `${component.name} has been added to your project.`,
              });
            }}
            onSelectTemplate={(template) => {
              setResponse({
                type: 'component',
                text: `Loaded ${template.name} template`,
                files: template.files
              });

              toast({
                title: "Template Loaded!",
                description: `${template.name} template has been loaded.`,
              });
            }}
          />

          {response && typeof response === 'object' && response.files && (
            <>
              <ProjectSharing
                projectId={currentProject?.id?.toString() || 'temp'}
                projectName={currentProject?.name || currentComponentName || 'My App'}
                files={response.files}
                isPublic={false}
                onUpdateSharing={(settings) => {
                  console.log('Sharing settings updated:', settings);
                }}
              />

              <ProductionDeployment
                files={response.files}
                projectName={currentProject?.name || currentComponentName || 'My App'}
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
          )}
        </div>
      </div>

      {/* Main Content - Bolt.new Style Layout - No scroll container */}
      <div className="flex-1 overflow-hidden flex relative z-10">
          {/* Chat Panel - Left Side - Responsive sizing */}
          <div className="w-[25%] min-w-[280px] max-w-[400px] lg:w-[28%] xl:w-[30%] border-r border-border flex flex-col bg-card relative">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex-shrink-0 bg-card relative z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Assistant
              </h2>
              {chatHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Describe what you want to build
            </p>
                  </div>

                      {/* Chat Messages - Scrollable area that takes remaining space */}
          <div
            ref={chatMessagesRef}
            className="flex-1 overflow-y-auto p-3 min-h-0 relative"
          >
            <div className="space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    What would you like to build today?
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try: "Build an egg timer with smooth animations"
                  </p>
                  </div>
              )}

                          {chatHistory.map((message, index) => (
                            <ChatMessage
                              key={index}
                              role={message.role}
                              content={message.content}
                              timestamp={message.timestamp}
                            />
                          ))}

              {/* Generation Status */}
                          {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Brain className="h-4 w-4 text-primary-foreground" />
                                </div>
                  
                  <div className="rounded-lg px-4 py-3 bg-muted max-w-[80%] flex-1">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <span>I'll get started on your app right away! ðŸŽ¯</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Watch the Editor tab light up as code appears!
                      </p>
                    </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chat Input - Always visible at bottom */}
          <div className="p-2 border-t border-border flex-shrink-0 bg-card relative z-20">
                        <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))} className="space-y-1">
                            <FormField
                              control={form.control}
                              name="userPrompt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                        <div className="relative">
                          <textarea
                            {...field}
                            placeholder="Describe your app or request changes..."
                            className="w-full min-h-[40px] max-h-[80px] p-2 pr-10 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        disabled={isLoading}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit((data) => generateMutation.mutate(data))();
                              }
                            }}
                                      />
                                      <Button
                                        type="submit"
                            disabled={isLoading || !field.value?.trim()}
                            size="sm"
                            className="absolute bottom-2 right-2 h-8 w-8 p-0"
                                      >
                                        {isLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        ) : (
                                          <Send className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                <p className="text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line
                </p>
                          </form>
                        </Form>
                      </div>
                    </div>

        {/* Workspace Panel - Right Side (70%) */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Workspace Tabs */}
          <div className="border-b border-border bg-card px-4">
            <div className="flex h-10 items-center gap-6 justify-between">
              <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('editor')}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-colors relative ${
                  activeTab === 'editor'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                } ${isLoading && activeTab === 'editor' ? 'animate-pulse' : ''}`}
              >
                <Code className="h-4 w-4" />
                Editor
                {isLoading && activeTab === 'editor' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Eye className="h-4 w-4" />
                Preview
                {currentComponentName && livePreviewUrl && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${
                  activeTab === 'agents'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Brain className="h-4 w-4" />
                Agents
                {agentsActive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'sessions'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Sessions
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
                            </div>
              
              {/* Debug Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tab: {activeTab}</span>
                <span>|</span>
                <span>Loading: {isLoading ? 'âœ“' : 'âœ—'}</span>
                <span>|</span>
                <span>Files: {response && typeof response === 'object' && response.files ? response.files.length : 0}</span>
                          </div>
                          </div>
                        </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
            {/* Editor Tab */}
            {activeTab === 'editor' && (
              <div className="h-full min-h-0 flex">
                {/* File Explorer - Fixed Width */}
                <div className="w-[240px] bg-muted/30 min-h-0 border-r border-border flex-shrink-0">
          <div className="h-full min-h-0 flex flex-col">
            <div className="px-2 py-1.5 border-b flex items-center justify-between">
              <h2 className="text-xs font-semibold">EXPLORER</h2>
              {/* Clear All Files Button */}
              {response && typeof response === 'object' && response.files && response.files.length > 0 && (
                <button
                  onClick={() => {
                    // Clear files from UI state
                    setResponse(null);
                    // Clear files from workspace session
                    updateGeneratedFiles([]);
                    // Clear selected file
                    setSelectedFileIndex(0);
                    // Notify user
                    addChatMessage({
                      role: 'assistant',
                      content: 'All files cleared from workspace',
                      timestamp: Date.now()
                    });
                  }}
                  className="text-xs px-2 py-0.5 rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-1"
                  title="Clear all files"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              )}
                            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2">
                {(() => {
                  const isComponent = typeof response === 'object' && response !== null && response.type === 'component';
                  const fileCount = isComponent ? (response.files?.length || 0) : 0;
                  console.log('ðŸ” FileExplorer check - response type:', typeof response, 'is component:', isComponent, 'files count:', fileCount);
                  return isComponent && fileCount > 0;
                })() ? (
                    <EnhancedFileExplorer
                    workspacePath="/workspaces"
                    files={(response as AIResponse).files?.map((file: any) => ({
                      ...file,
                      path: file.path.replace(/^\/workspaces\//, '')
                    })) || []}
                    onSelectFile={(index: number) => {
                      setSelectedFileIndex(index);
                      const selectedFile = (response as AIResponse).files?.[index];
                      if (selectedFile) {
                        setEditorLanguage(getFileLanguage(selectedFile.path));
                      }
                    }}
                    selectedFileIndex={selectedFileIndex}
                    onCreateFile={(path: string, content: string) => {
                      const newFile = { path, content };
                      if (response && typeof response === 'object' && response.files) {
                        const updatedFiles = [...(response as AIResponse).files!, newFile];
                        setResponse(prev => ({
                          ...prev as AIResponse,
                          files: updatedFiles
                        }));
                        // Sync with workspace session
                        updateGeneratedFiles(updatedFiles);
                      }
                    }}
                    onDeleteFile={(path: string) => {
                      if (response && typeof response === 'object' && response.files) {
                        const updatedFiles = (response as AIResponse).files!.filter(f => f.path !== path);
                        setResponse(prev => ({
                          ...prev as AIResponse,
                          files: updatedFiles
                        }));
                        // Sync with workspace session
                        updateGeneratedFiles(updatedFiles);
                      }
                    }}
                    onRenameFile={(oldPath: string, newPath: string) => {
                      if (response && typeof response === 'object' && response.files) {
                        const updatedFiles = (response as AIResponse).files!.map(f =>
                          f.path === oldPath ? { ...f, path: newPath } : f
                        );
                        setResponse(prev => ({
                          ...prev as AIResponse,
                          files: updatedFiles
                        }));
                        // Sync with workspace session
                        updateGeneratedFiles(updatedFiles);
                      }
                    }}
                    onDuplicateFile={(path: string) => {
                      if (response && typeof response === 'object' && response.files) {
                        const originalFile = (response as AIResponse).files!.find(f => f.path === path);
                        if (originalFile) {
                          const duplicatedFile = {
                            ...originalFile,
                            path: path.replace(/(\.[^.]+)$/, '_copy$1')
                          };
                          const updatedFiles = [...(response as AIResponse).files!, duplicatedFile];
                          setResponse(prev => ({
                            ...prev as AIResponse,
                            files: updatedFiles
                          }));
                          // Sync with workspace session
                          updateGeneratedFiles(updatedFiles);
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No files yet</p>
                    <p className="text-xs mt-1">
                      {isLoading ? 'Generating code...' : 'Start a conversation to generate code'}
                    </p>
                    {response && typeof response === 'object' && (
                      <p className="text-xs mt-2 text-red-400">
                        Debug: Type={(response as AIResponse).type}, Files={(response as AIResponse).files?.length || 0}
                      </p>
                    )}
                        </div>
                      )}
                    </div>
            </ScrollArea>
                        </div>
                </div>

        {/* Main Editor Area */}
        <div className="flex-1 min-h-0">
          <div className="h-full min-h-0 overflow-hidden">
              {typeof response === 'object' && 
               response?.type === 'component' && 
                      response.files &&
                      response.files[selectedFileIndex] ? (
                        <Editor
                          height="calc(100% - 0px)"
                          defaultLanguage={editorLanguage}
                          language={editorLanguage}
                          value={response.files[selectedFileIndex].content}
                          theme={editorTheme}
                          onChange={(value) => {
                            // Update the file content in local state
                            if (value !== undefined && response && typeof response === 'object' && response.files) {
                              const updatedFiles = response.files.map((file, idx) =>
                                idx === selectedFileIndex ? { ...file, content: value } : file
                              );
                              setResponse({ ...response, files: updatedFiles });

                              // Sync to workspace for persistence
                              updateGeneratedFiles(updatedFiles);
                            }
                          }}
                          options={{
                            minimap: { enabled: true },
                            fontSize: 14,
                    lineNumbers: "on",
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            readOnly: false,
                    wordWrap: "on",
                            suggestOnTriggerCharacters: true,
                            formatOnPaste: true,
                            formatOnType: true,
                            tabSize: 2,
                            insertSpaces: true,
                            detectIndentation: true,
                            folding: true,
                            glyphMargin: true,
                            bracketPairColorization: {
                      enabled: true
                    }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">No File Selected</h3>
                    <p className="text-sm text-muted-foreground">Generate a component to see the code here</p>
                          </div>
                        </div>
                      )}
                    </div>
        </div>
              </div>
            )}

            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <div className="h-full flex flex-col">
                {typeof response === 'object' &&
                 response?.type === 'component' &&
                 response.files &&
                 response.files.length > 0 ? (
                  <AdvancedPreview
                    files={response.files}
                    previewUrl={livePreviewUrl || ''}
                    projectName={currentComponentName}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-background">
                    <div className="text-center text-muted-foreground">
                      <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Preview will appear here</p>
                      <p className="text-sm mt-2">Generate a component to see the preview</p>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <AgentMonitorPanel />
                </div>
              </ScrollArea>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="h-full overflow-hidden">
                <SessionHistory
                  onSessionDeleted={(sessionId) => {
                    // Clear chat history when a session is deleted
                    clearChat();
                  }}
                />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Playground Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure your AI generation preferences and deployment options.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Editor Theme</h4>
                      <Select value={editorTheme} onValueChange={(val) => setEditorTheme(val as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vs-dark">Dark</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Default Project Type</h4>
                      <p className="text-sm text-muted-foreground">React (TypeScript + Vite)</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}

          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
