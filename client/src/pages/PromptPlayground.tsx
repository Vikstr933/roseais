import { motion } from "framer-motion";
import { useState, useEffect } from "react";
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
import { AlertCircle, HelpCircle, Eye, Code, Send, FileCode, Brain, MessageSquare, Settings, Laptop } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import Editor from "@monaco-editor/react";
import { ComponentPreview } from "../components/ComponentPreview/ComponentPreview";
import FileExplorer from "../components/FileExplorer/FileExplorer";
import SessionHistory from "../components/SessionHistory";
import { ChatAutocomplete } from "../components/ChatAutocomplete";
import { useAuth, getAuthHeaders } from "../contexts/AuthContext";
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

const SYSTEM_PROMPT = `You are an AI orchestrator specialized in coordinating multiple AI agents to generate complete, functional React applications.

Your role is to:
1. Analyze user requirements and break them down into actionable tasks
2. Coordinate with specialized agents (UI Designer, Code Generator, etc.)
3. Generate production-ready React applications with proper file structure
4. Ensure applications are functional, well-designed, and follow best practices

When generating applications, always provide:
- Complete, functional React components
- Proper TypeScript typing
- Modern React patterns (hooks, functional components)
- Clean, readable code with proper error handling
- Responsive design and good UX
- Multiple files structured correctly

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
  model: z.string().default("claude-3-5-sonnet-20241022"),
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
  const [match, params] = useRoute('/playground/:projectId');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'process' | 'sessions' | 'settings'>('editor');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [response, setResponse] = useState<string | AIResponse | null>(null);
  const [orchestrationSteps, setOrchestrationSteps] = useState<OrchestrationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [error, setError] = useState<{ message: string; suggestion: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    files?: Array<{
      path: string;
      content: string;
    }>;
  }>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [relevanceScore, setRelevanceScore] = useState<number>(0);
  const [relevanceData, setRelevanceData] = useState<any[]>([]);
  const [currentComponentName, setCurrentComponentName] = useState<string>('');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<{ id: number; name: string; description?: string } | null>(null);
  
  // WebContainer state
  const [webContainerReady, setWebContainerReady] = useState(false);
  const [webContainerBooting, setWebContainerBooting] = useState(false);
  const [useWebContainer, setUseWebContainer] = useState(true); // Toggle for fallback
  const { toast } = useToast();

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
        console.log('⚠️ WebContainer disabled, using server-side deployment');
        return;
      }

      try {
        setWebContainerBooting(true);
        console.log('🚀 Booting WebContainer...');
        
        await webContainerService.boot();
        
        setWebContainerReady(true);
        setWebContainerBooting(false);
        console.log('✅ WebContainer ready!');
        
        toast({
          title: "WebContainer Ready",
          description: "Browser-based preview is now available for instant updates!",
        });
      } catch (error) {
        console.error('❌ Failed to boot WebContainer:', error);
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
      fetch(`/api/workspaces/${projectId}`, {
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
            description: project.description
          });
          
          console.log('✅ Loaded project:', project.name);
        })
        .catch(err => {
          console.error('Failed to load project:', err);
        });
      
      // Load chat history
      fetch(`/api/workspaces/${projectId}/chat?limit=100`, {
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
            setChatHistory(history);
            console.log(`✅ Loaded ${history.length} chat messages`);
          } else {
            // No history, add welcome message
            setChatHistory([{
              role: 'assistant',
              content: `👋 Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
              timestamp: Date.now()
            }]);
          }
        })
        .catch(err => {
          console.error('Failed to load chat history:', err);
          // Add welcome message on error
          setChatHistory([{
            role: 'assistant',
            content: `👋 Welcome back! I'm ready to help you work on this project. What would you like to build or modify?`,
            timestamp: Date.now()
          }]);
        });
      
      // Load project files
      fetch(`/api/workspaces/${projectId}/files`, {
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
            console.log(`✅ Loaded ${fileList.length} project files`);
            
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

    const streamUrl = `/api/terminal/${encodeURIComponent(currentComponentName)}/stream`;
    let es: EventSource | null = new EventSource(streamUrl);
    let retryTimer: number | null = null;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'output' && typeof payload.data === 'string') {
          const line = payload.data;

          // Detect Vite ready lines and extract preview URL
          // Example lines from Vite:
          //   ➜  Local:   http://localhost:5173/
          // Example lines from DeploymentService:
          //   ✅ Development server started at http://localhost:3002
          const localUrlMatch = line.match(/(?:Local:\s+|started at\s+)(https?:\/\/[^\s]+)/i);
          if (localUrlMatch && localUrlMatch[1]) {
            const url = localUrlMatch[1];
            setLivePreviewUrl(url);
            // Auto-switch to preview when dev server is ready
            setActiveTab('preview');
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `🔌 Dev server ready at ${url}. Switching to Preview…`,
              timestamp: Date.now()
            }]);
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
                    setLivePreviewUrl(url);
                    setActiveTab('preview');
                    setChatHistory(prev => [...prev, { role: 'assistant', content: `🔌 Dev server ready at ${url}. Switching to Preview…`, timestamp: Date.now() }]);
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
      setCurrentSessionId(session.id);
      
      // Parse the generated code back into files
      const files = JSON.parse(session.generatedCode);
      
      // Set up chat history
      setChatHistory([
        {
      role: 'user',
          content: session.inputPrompt,
          timestamp: new Date(session.createdAt).getTime()
        },
        {
          role: 'assistant',
          content: session.title,
          timestamp: new Date(session.createdAt).getTime(),
          files
        }
      ]);

      // Set the response
      setResponse({
        type: 'component',
        text: session.title,
        files
      });
    };

    window.addEventListener('continueSession', handleContinueSession as EventListener);
    return () => {
      window.removeEventListener('continueSession', handleContinueSession as EventListener);
    };
  }, []);

  // Set up SSE connections
  useEffect(() => {
    const eventsSource = new EventSource('/api/events');
    const logsSource = new EventSource('/api/logs');

    eventsSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'GENERATION_START':
    setIsLoading(true);
          setError(null);
          // Keep current response and steps to support iterative edits
          toast({
            title: "Generation Started",
            description: data.data.message
          });
          break;

        case 'PROJECT_CONTEXT_LOADED':
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `📂 ${data.data.message}`,
            timestamp: Date.now()
          }]);
          break;

        case 'ORCHESTRATION_START':
          toast({
            title: "Orchestration Started",
            description: data.data.message
          });
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
          toast({
            title: "Generation Complete",
            description: data.data.message
          });
          break;

        case 'GENERATION_ERROR':
          setIsLoading(false);
          setError({
            message: data.data.error,
            suggestion: data.data.suggestion
          });
          toast({
            title: "Generation Error",
            description: data.data.error,
            variant: "destructive"
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
    };
  }, [toast]);

  // 🚀 Deploy to WebContainer or fallback to server-side
  async function deployToRuntime(files: Array<{ path: string; content: string }>, componentName: string) {
    try {
      if (webContainerReady && useWebContainer) {
        console.log('🚀 Deploying to WebContainer...');
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🌐 Deploying to browser-based WebContainer for instant preview...`,
          timestamp: Date.now()
        }]);

        // Fix file paths: move package.json, tsconfig.json, vite.config.ts to root
        const fixedFiles = files.map(file => {
          const filename = file.path.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path.startsWith('src/')) {
            console.log(`📦 Moving ${file.path} → ${filename} (root level)`);
            return { ...file, path: filename };
          }
          return file;
        });

        // Write files to WebContainer
        await webContainerService.writeFiles(fixedFiles);
        console.log('✅ Files written to WebContainer');

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `📦 Installing npm dependencies in browser...`,
          timestamp: Date.now()
        }]);

        // Install dependencies
        await webContainerService.installDependencies((msg) => {
          if (msg.includes('added') || msg.includes('dependencies')) {
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `✅ ${msg}`,
              timestamp: Date.now()
            }]);
          }
        });

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🚀 Starting Vite dev server in browser...`,
          timestamp: Date.now()
        }]);

        // Start dev server
        const devServerUrl = await webContainerService.startDevServer((msg) => {
          if (msg.includes('ready') || msg.includes('Local:')) {
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `✅ ${msg}`,
              timestamp: Date.now()
            }]);
          }
        });

        console.log('✅ WebContainer dev server URL:', devServerUrl);
        setLivePreviewUrl(devServerUrl);
        setActiveTab('preview');

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🎉 Preview is ready at: ${devServerUrl}`,
          timestamp: Date.now()
        }]);

      } else {
        // Fallback to server-side deployment
        console.log('📡 Deploying to server...');
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `📡 Deploying to server (WebContainer unavailable)...`,
          timestamp: Date.now()
        }]);

        // Call existing server-side deployment
      const response = await fetch('/api/components/generate', {
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
            setLivePreviewUrl(result.deploymentUrl);
            setActiveTab('preview');

            setChatHistory(prev => [...prev, {
        role: 'assistant',
              content: `✅ Server deployment complete! Preview available at: ${result.deploymentUrl}`,
              timestamp: Date.now()
            }]);
          }
        }
      }
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now()
      }]);
    }
  }

  const form = useForm<PromptForm>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      userPrompt: "",
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      projectType: 'react',
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: PromptForm) => {
      setError(null);
      // Preserve existing response and terminal logs for iterative workflow

      // Add user message to chat history
      setChatHistory(prev => [...prev, {
        role: 'user',
        content: data.userPrompt,
        timestamp: Date.now()
      }]);

      // ✨ Bolt.new-style: Auto-switch to Editor tab FIRST (before loading state)
      console.log('🎨 Switching to Editor tab');
      setActiveTab('editor');

      // Small delay to let the tab switch be visible, then start loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsLoading(true);
      console.log('⏳ Loading started - glow effect should be visible');

      // ✨ Calculate relevance score for the prompt
      try {
        const relevanceRes = await fetch('/api/knowledge/calculate-relevance', {
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

      // ✨ Bolt.new-style: Add immediate AI greeting with more personality
      const appType = data.userPrompt.toLowerCase().includes('timer') ? 'timer' :
                      data.userPrompt.toLowerCase().includes('todo') ? 'todo list' :
                      data.userPrompt.toLowerCase().includes('calculator') ? 'calculator' : 
                      data.userPrompt.toLowerCase().includes('dashboard') ? 'dashboard' :
                      data.userPrompt.toLowerCase().includes('chart') ? 'chart' :
                      data.userPrompt.toLowerCase().includes('form') ? 'form' : 'app';
      
      const isExistingProject = currentProject?.id;
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: isExistingProject 
          ? `Perfect! I'll enhance your ${appType} with those changes. Let me get to work! ✨`
          : `I'll get started on your ${appType} right away! 🎯`,
        timestamp: Date.now()
      }]);

      // Add progressive analysis updates with more detail
      setTimeout(() => {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: isExistingProject
            ? `📂 Loading your existing project files to understand the current implementation...`
            : `📋 Analyzing your requirements and planning the architecture...`,
          timestamp: Date.now()
        }]);
      }, 500);
      
      setTimeout(() => {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: isExistingProject
            ? `🔄 Identifying what needs to be modified and what can stay the same...`
            : `🔍 Identifying core features, UI components, and dependencies needed...`,
          timestamp: Date.now()
        }]);
      }, 1200);

      setTimeout(() => {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🎨 Assembling our specialized AI agents to collaborate on your project...`,
          timestamp: Date.now()
        }]);
      }, 1800);

      // Reset progress tracking
      setOrchestrationSteps([]);
      setCurrentStep('');
      setOverallProgress(0);

      const res = await fetch("/api/prompts/generate", {
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
                    console.log('📍 Step started:', data.data);
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
                    setChatHistory(prev => [...prev, {
                      role: 'assistant',
                      content: `${data.data.details || 'Processing...'}`,
                      timestamp: Date.now()
                    }]);
                  } else if (data.type === 'STEP_COMPLETE') {
                    console.log('✅ Step completed:', data.data);
                    setOverallProgress(data.data.progress || 0);
                    
                    // Mark step as completed
                    setOrchestrationSteps(prev => prev.map(s => 
                      s.agent === data.data.agent 
                        ? { ...s, status: 'completed' as const }
                        : s
                    ));

                    // Add completion message
                    setChatHistory(prev => [...prev, {
                      role: 'assistant',
                      content: `✅ ${data.data.result || 'Step completed'}`,
                      timestamp: Date.now()
                    }]);
                  } else if (data.type === 'FILE_GENERATED') {
                    console.log('📄 File generated:', data.data.file.path);
                    
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
                      setChatHistory(prev => [...prev, {
                        role: 'assistant',
                        content: `✨ Watch the magic happen! Code is being generated in real-time...`,
                        timestamp: Date.now()
                      }]);
                    }

                    // Add chat message for first and last file
                    if (data.data.index === 1) {
                      setChatHistory(prev => [...prev, {
                        role: 'assistant',
                        content: `📝 Writing ${data.data.total} files to your project...`,
                        timestamp: Date.now()
                      }]);
                    } else if (data.data.index === data.data.total) {
                      setChatHistory(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ All ${data.data.total} files generated!`,
                        timestamp: Date.now()
                      }]);
                    }
                  } else if (data.type === 'PROJECT_CONTEXT_LOADED') {
                    setChatHistory(prev => [...prev, {
                      role: 'assistant',
                      content: data.data.message || 'Loaded project context',
                      timestamp: Date.now()
                    }]);
                  } else if (data.type === 'COMPLETE' || data.type === 'GENERATION_COMPLETE') {
                    console.log('🎉 Generation complete');
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
        console.log('📦 Received regular JSON response (not SSE)');
        return await res.json();
      }
    },
    onSuccess: async (data: GenerateResponse) => {
      console.log('🎯 Generation response received:', data);
      console.log('📁 Files in response:', data.response?.files);
      
      if (data.response.type === 'component' && data.response.files) {
        // ✨ Display files one by one with animation - BOLT.NEW STYLE!
        const displayFiles = data.response.files.map(file => ({
          ...file,
          path: file.path.replace(/^workspaces\/[^/]+\//, '').replace(/^\/workspaces\/[^/]+\//, '')
        }));
        
        console.log('📂 Files to display:', displayFiles.length);
        
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
        console.log('🏷️ Component name set:', componentName);
        
        // Fix file paths: move config files to root for display (matches deployment)
        const fixedDisplayFiles = displayFiles.map(file => {
          const filename = file.path.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path.startsWith('src/')) {
            console.log(`📦 Moving ${file.path} → ${filename} (root level for display)`);
            return { ...file, path: filename };
          }
          return file;
        });

        // Log what files were generated for debugging
        console.log('📦 Files generated by AI:', fixedDisplayFiles.map(f => f.path));
        
        // Validate critical files exist (LOG ERRORS but don't add fallbacks)
        const requiredFiles = ['index.html', 'package.json', 'tsconfig.json', 'src/App.tsx', 'src/main.tsx'];
        const missingFiles = requiredFiles.filter(required => 
          !fixedDisplayFiles.find(f => f.path === required || f.path === `src/${required}`)
        );
        
        if (missingFiles.length > 0) {
          console.error('❌ MISSING REQUIRED FILES:', missingFiles);
          console.error('Generated files:', fixedDisplayFiles.map(f => f.path));
          
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ Warning: AI missed some files: ${missingFiles.join(', ')}. The app might not work correctly. You may need to regenerate.`,
            timestamp: Date.now()
          }]);
        }
        
        // ✅ INSTANT FILE DISPLAY - Show all files immediately for better UX
        setResponse({
          type: 'component',
          text: data.response.text,
          files: fixedDisplayFiles // Show all files at once with corrected paths
        });

        // Add summary chat message
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🎉 All ${displayFiles.length} files created successfully! Installing dependencies and starting development server...`,
          timestamp: Date.now()
        }]);
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `🚀 Development server is spinning up. This usually takes 10-15 seconds...`,
          timestamp: Date.now()
        }]);
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `✨ Almost ready! I'll automatically switch to the preview tab once the server is live.`,
          timestamp: Date.now()
        }]);
        
        setIsLoading(false);
        console.log('✅ All files displayed!');
        
        // 🚀 Deploy to WebContainer or server immediately
        setTimeout(() => {
          deployToRuntime(displayFiles, componentName);
        }, 500); // Small delay for UI to update

        // Save chat messages and files to project if we're in a project context
        if (currentProject?.id && sessionToken) {
          const userMessage = form.getValues('userPrompt');
          
          // Save user message
          fetch(`/api/workspaces/${currentProject.id}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(sessionToken),
            body: JSON.stringify({
              message: userMessage,
              messageType: 'user',
              metadata: { timestamp: Date.now() }
            })
          }).catch(err => console.error('Failed to save user message:', err));
          
          // Save AI response
          fetch(`/api/workspaces/${currentProject.id}/chat`, {
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
          
          // Save generated files to project after all are displayed
          setTimeout(() => {
            fetch(`/api/workspaces/${currentProject.id}/files`, {
              method: 'POST',
              headers: getAuthHeaders(sessionToken),
              body: JSON.stringify({
                files: displayFiles,
                componentName: componentName
              })
            })
              .then(() => console.log('✅ Files saved to project'))
              .catch(err => console.error('Failed to save files to project:', err));
          }, 600); // Small delay after files are displayed
        }
      } else {
        // Merge text responses into chat without resetting state
        if (data.response?.type === 'text') {
          setChatHistory(prev => [...prev, { role: 'assistant', content: data.response.text, timestamp: Date.now() }]);
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
      setChatHistory(prev => [...prev, { role: 'assistant', content: '❌ Generation failed. Please try again.', timestamp: Date.now() }]);
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
            <div className="flex items-center px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
              <Laptop className="h-3.5 w-3.5 mr-2 text-primary" />
              <span className="text-xs font-semibold text-primary">{currentProject.name}</span>
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
              </div>

      {/* Main Content - Bolt.new Style Layout - No scroll container */}
      <div className="flex-1 overflow-hidden flex relative z-10">
          {/* Chat Panel - Left Side (30%) */}
          <div className="w-[30%] min-w-[320px] max-w-[480px] border-r border-border flex flex-col bg-card overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Assistant
                  </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Describe what you want to build
            </p>
                  </div>

                      {/* Chat Messages - Scrollable area that takes remaining space */}
          <div className="flex-1 overflow-y-auto p-3">
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
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Brain className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  
                  <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                  message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4" />
                                </div>
                  )}
                            </motion.div>
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
                        <span>I'll get started on your app right away! 🎯</span>
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
          <div className="p-2 border-t border-border flex-shrink-0 bg-card">
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
                onClick={() => setActiveTab('process')}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'process'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Brain className="h-4 w-4" />
                Process
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
                <span>Loading: {isLoading ? '✓' : '✗'}</span>
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
              <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                {/* File Explorer */}
                <ResizablePanel defaultSize={5} minSize={4} maxSize={15} className="bg-muted/30 min-h-0">
          <div className="h-full min-h-0 flex flex-col">
            <div className="px-2 py-1.5 border-b flex items-center justify-between">
              <h2 className="text-xs font-semibold">EXPLORER</h2>
                            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2">
                {(() => {
                  const isComponent = typeof response === 'object' && response !== null && response.type === 'component';
                  const fileCount = isComponent ? (response.files?.length || 0) : 0;
                  console.log('🔍 FileExplorer check - response type:', typeof response, 'is component:', isComponent, 'files count:', fileCount);
                  return isComponent && fileCount > 0;
                })() ? (
                    <FileExplorer 
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
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Editor Area */}
        <ResizablePanel defaultSize={95}>
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
        </ResizablePanel>
          </ResizablePanelGroup>
            )}

            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <div className="h-full flex flex-col">
                {typeof response === 'object' &&
                 response?.type === 'component' &&
                 response.files &&
                 response.files.length > 0 ? (
                  <div className="h-full flex flex-col bg-background">
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                      <h4 className="text-sm font-medium">Live Preview</h4>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <div className={`w-2 h-2 rounded-full mr-2 ${currentComponentName ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        {currentComponentName ? 'Ready' : 'Waiting...'}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden p-2">
                      {livePreviewUrl ? (
                        <iframe
                          key={livePreviewUrl}
                          src={livePreviewUrl}
                          className="w-full h-full border-0 rounded-lg bg-white"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                          allow="cross-origin-isolated"
                          title="WebContainer Preview"
                        />
                      ) : (
                      <iframe
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <title>Component Preview</title>
                              <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
                              <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
                              <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                              <style>
                                body {
                                  margin: 0;
                                  padding: 20px;
                                  font-family: system-ui, -apple-system, sans-serif;
                                  background: white;
                                  min-height: 100vh;
                                }
                                * { box-sizing: border-box; }
                                ${response.files.find(f => f.path.includes('.css'))?.content || `
                                  .app {
                                    max-width: 800px;
                                    margin: 0 auto;
                                    padding: 2rem;
                                  }
                                  .button {
                                    background: #3b82f6;
                                    color: white;
                                    border: none;
                                    padding: 0.5rem 1rem;
                                    border-radius: 0.5rem;
                                    cursor: pointer;
                                    margin: 0.25rem;
                                  }
                                  .button:hover {
                                    background: #2563eb;
                                  }
                                  input, textarea {
                                    padding: 0.5rem;
                                    border: 1px solid #d1d5db;
                                    border-radius: 0.25rem;
                                    margin: 0.25rem;
                                  }
                                `}
                              </style>
                            </head>
                            <body>
                              <div id="root"></div>
                              <script type="text/babel">
                                try {
                                  const { useState, useEffect, useCallback, createContext, useContext } = React;

                                  ${(() => {
                                    // Get all component files (including those in components/ folder)
                                    const componentFiles = response.files?.filter(f => 
                                      (f.path.endsWith('.tsx') || f.path.endsWith('.jsx')) && 
                                      !f.path.includes('main.tsx') &&
                                      !f.path.includes('main.jsx')
                                    ) || [];
                                    
                                    console.log('Preview: Found component files:', componentFiles.map(f => f.path));
                                    
                                    if (componentFiles.length === 0) {
                                      return 'function App() { return React.createElement("div", {className: "app"}, "Component generated successfully!"); }';
                                    }
                                    
                                    // Function to remove TypeScript syntax (more aggressive)
                                    function removeTypeScript(code: string): string {
                                      // Remove ALL import statements (including multiline)
                                      code = code.replace(/import\\s+[\\s\\S]*?;/g, '');
                                      code = code.replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"]/g, '');
                                      // Remove export statements
                                      code = code.replace(/export\\s+default\\s+/g, '');
                                      code = code.replace(/export\\s+(const|function|interface|type|enum)\\s+/g, '$1 ');
                                      // CRITICAL: Remove ALL interface and type definitions (including nested braces)
                                      code = code.replace(/interface\\s+\\w+\\s*\\{[^}]*\\}/gs, '');
                                      code = code.replace(/type\\s+\\w+\\s*=\\s*[^;]+;/gs, '');
                                      code = code.replace(/enum\\s+\\w+\\s*\\{[^}]*\\}/gs, '');
                                      // Remove type annotations from function parameters
                                      code = code.replace(/\\([^)]*\\)\\s*:\\s*[\\w<>\\[\\]]+/g, (match: string) => {
                                        return match.replace(/:\\s*[\\w<>\\[\\]]+/g, '');
                                      });
                                      // Remove generic type parameters
                                      code = code.replace(/useState<[^>]+>/g, 'useState');
                                      code = code.replace(/useRef<[^>]+>/g, 'useRef');
                                      code = code.replace(/useEffect<[^>]+>/g, 'useEffect');
                                      code = code.replace(/useMemo<[^>]+>/g, 'useMemo');
                                      code = code.replace(/useCallback<[^>]+>/g, 'useCallback');
                                      code = code.replace(/createContext<[^>]+>/g, 'createContext');
                                      code = code.replace(/React\\.createContext<[^>]+>/g, 'React.createContext');
                                      code = code.replace(/<[A-Z]\\w+<[^>]+>>/g, (match: string) => match.split('<').slice(0, 2).join('<') + '>');
                                      // Remove type annotations from variable declarations
                                      code = code.replace(/const\\s+(\\w+)\\s*:\\s*[^=]+=/g, 'const $1 =');
                                      code = code.replace(/let\\s+(\\w+)\\s*:\\s*[^=]+=/g, 'let $1 =');
                                      // Remove React.FC and other type annotations
                                      code = code.replace(/:\\s*React\\.FC(<[^>]+>)?/g, '');
                                      code = code.replace(/:\\s*FC(<[^>]+>)?/g, '');
                                      // Remove as type assertions
                                      code = code.replace(/\\s+as\\s+(const|\\w+)/g, '');
                                      // Remove ErrorBoundary wrapper
                                      code = code.split('<ErrorBoundary').join('<React.Fragment');
                                      code = code.split('</ErrorBoundary>').join('</React.Fragment>');
                                      return code;
                                    }
                                    
                                    // Sort files: components/ folder first, then App.tsx last
                                    const sortedFiles = componentFiles.sort((a, b) => {
                                      const aIsApp = a.path.includes('App.tsx');
                                      const bIsApp = b.path.includes('App.tsx');
                                      const aIsComponent = a.path.includes('components/');
                                      const bIsComponent = b.path.includes('components/');
                                      
                                      if (aIsApp) return 1;  // App.tsx goes last
                                      if (bIsApp) return -1;
                                      if (aIsComponent && !bIsComponent) return -1; // components/ first
                                      if (!aIsComponent && bIsComponent) return 1;
                                      return 0;
                                    });
                                    
                                    console.log('Preview: Loading order:', sortedFiles.map(f => f.path));
                                    
                                    // Combine all component code
                                    let allCode = '';
                                    sortedFiles.forEach((file, index) => {
                                      let code = removeTypeScript(file.content);
                                      allCode += code + String.fromCharCode(10) + String.fromCharCode(10);
                                      console.log('Preview: Added file ' + (index + 1) + '/' + sortedFiles.length + ': ' + file.path);
                                    });

                                    // Detect undefined JSX component identifiers and stub them to avoid ReferenceErrors
                                    try {
                                      const jsxTags = Array.from(new Set((allCode.match(/<([A-Z][A-Za-z0-9_]*)\b/g) || []).map(m => m.replace('<',''))));
                                      const definedNames = Array.from(new Set((allCode.match(/(function|const)\s+([A-Z][A-Za-z0-9_]*)/g) || []).map(m => m.split(/\s+/)[1])));
                                      const missing = jsxTags.filter(name => !definedNames.includes(name) && name !== 'App' && name !== 'React' && name !== 'Fragment');
                                      if (missing.length) {
                                        missing.forEach(name => {
                                          allCode = `const ${name} = (props) => React.createElement('div', props, '${name}');\n` + allCode;
                                        });
                                        console.log('Preview: Stubbed missing components:', missing);
                                      }
                                    } catch (e) { console.warn('Preview: Stub scan failed', e); }
                                    
                                    // Find the main App component name
                                    const mainFile = sortedFiles.find(f => f.path.includes('App.tsx'));
                                    if (mainFile) {
                                      const cleanCode = removeTypeScript(mainFile.content);
                                      const match = cleanCode.match(/function\\s+(\\w+)/) || cleanCode.match(/const\\s+(\\w+)\\s*=/);
                                      const componentName = match ? match[1] : 'App';
                                      allCode += '; const AppComponent = ' + componentName + ';';
                                      console.log('Preview: Main component name:', componentName);
                                    }
                                    
                                    return allCode;
                                  })()}

                                  const rootElement = document.getElementById('root');
                                  if (rootElement) {
                                    const root = ReactDOM.createRoot ? ReactDOM.createRoot(rootElement) : null;
                                    if (root) {
                                      root.render(React.createElement(AppComponent));
                                    } else {
                                      ReactDOM.render(React.createElement(AppComponent), rootElement);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Preview error:', error);
                                  document.getElementById('root').innerHTML = '<div style="padding: 2rem; color: #ef4444; border: 1px solid #fecaca; border-radius: 0.5rem; background: #fef2f2;">Error rendering component: ' + error.message + '</div>';
                                }
                              </script>
                            </body>
                          </html>
                        `}
                        className="w-full h-full border-0 rounded bg-white"
                        title="Component Preview (Fallback)"
                        sandbox="allow-scripts"
                      />
                      )}
                            </div>
                  </div>
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

            {/* Process Tab */}
            {activeTab === 'process' && (
                    <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {/* Overall Progress Header */}
                  {orchestrationSteps.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6 border border-blue-200/20">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <span className="text-2xl">🎯</span>
                          Multi-Agent Orchestration
                          </h3>
                        <span className="text-sm font-medium text-muted-foreground">
                          {orchestrationSteps.filter(s => s.status === 'completed').length} / {orchestrationSteps.length} completed
                              </span>
                            </div>
                      <div className="w-full bg-muted/30 rounded-full h-2.5 mb-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${overallProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isLoading 
                          ? currentStep || '✨ Our AI agents are working together to build your application...' 
                          : '✅ All agents have completed their tasks successfully!'}
                      </p>
                    </div>
                  )}

                  {/* Agent Steps */}
                  <div className="space-y-4">
                    {orchestrationSteps.map((step, index) => {
                      const agentDetails = {
                        'Requirements Analyst': {
                          icon: '📋',
                          description: 'Breaking down your idea into technical specifications',
                          color: 'blue',
                          tips: 'Analyzing requirements, identifying core features, and planning architecture'
                        },
                        'UI Designer': {
                          icon: '🎨',
                          description: 'Crafting a beautiful and intuitive user interface',
                          color: 'purple',
                          tips: 'Designing components, choosing color schemes, and planning layouts'
                        },
                        'Code Generator': {
                          icon: '⚡',
                          description: 'Writing clean, production-ready code for your app',
                          color: 'green',
                          tips: 'Generating React components, configuring dependencies, and setting up the project'
                        },
                        'Completion Agent': {
                          icon: '🎉',
                          description: 'Finalizing and polishing your application',
                          color: 'yellow',
                          tips: 'Adding finishing touches, optimizing performance, and ensuring quality'
                        }
                      };

                      const details = agentDetails[step.agent as keyof typeof agentDetails] || {
                        icon: '🤖',
                        description: 'Processing your request',
                        color: 'gray',
                        tips: 'Working on your application'
                      };

                      return (
                        <div 
                          key={index}
                          className={`
                            relative overflow-hidden rounded-lg border transition-all duration-300
                            ${step.status === 'completed' 
                              ? 'bg-green-50/10 border-green-200/30 shadow-sm' 
                              : step.status === 'in_progress'
                              ? 'bg-blue-50/10 border-blue-200/30 shadow-md ring-2 ring-blue-500/20 animate-pulse'
                              : step.status === 'failed'
                              ? 'bg-red-50/10 border-red-200/30'
                              : 'bg-muted/10 border-border opacity-60'}
                          `}
                        >
                          {/* Gradient overlay for active step */}
                          {step.status === 'in_progress' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 animate-pulse"></div>
                          )}
                          
                          <div className="relative p-5">
                            <div className="flex items-start gap-4">
                              {/* Icon and Status */}
                              <div className="flex-shrink-0">
                                <div className={`
                                  text-3xl mb-2 transition-transform duration-300
                                  ${step.status === 'in_progress' ? 'animate-bounce' : ''}
                                `}>
                                  {details.icon}
                            </div>
                                <div className="flex justify-center">
                                  {step.status === 'completed' && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs">
                                      ✓
                              </span>
                                  )}
                                  {step.status === 'in_progress' && (
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                                  )}
                                  {step.status === 'failed' && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs">
                                      ✕
                                    </span>
                                  )}
                                  {step.status === 'pending' && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">
                                      ⋯
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-base">{step.agent}</h4>
                                  {step.status === 'in_progress' && (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200/50">
                                      Working...
                                    </Badge>
                                  )}
                                  {step.status === 'completed' && (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200/50">
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm font-medium text-foreground mb-2">
                                  {step.task}
                                </p>
                                
                                <p className="text-sm text-muted-foreground mb-3">
                                  {details.description}
                                </p>

                                {/* Progress details */}
                                {step.status === 'in_progress' && (
                                  <div className="mt-3 p-3 bg-blue-500/5 rounded-md border border-blue-200/20">
                                    <p className="text-xs text-muted-foreground italic">
                                      💭 {details.tips}
                                    </p>
                                  </div>
                                )}

                                {/* Completion details */}
                                {step.status === 'completed' && (
                                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    Successfully completed • Ready for next step
                                  </div>
                                )}

                                {/* Dependencies */}
                                {step.dependencies && step.dependencies.length > 0 && (
                                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Depends on:</span>
                                    {step.dependencies.map((dep, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {dep}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Connection line to next step */}
                          {index < orchestrationSteps.length - 1 && (
                            <div className="flex justify-center">
                              <div className={`w-0.5 h-4 ${step.status === 'completed' ? 'bg-green-500/30' : 'bg-border'}`}></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Loading state */}
                  {isLoading && orchestrationSteps.length === 0 && (
                    <div className="text-center py-12">
                      <div className="relative inline-block mb-4">
                        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl">🤖</span>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Initializing AI Agents...</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        We're assembling a team of specialized AI agents to handle your request. 
                        Each agent brings unique expertise to build your application perfectly.
                      </p>
                    </div>
                  )}

                  {/* Empty state */}
                  {!isLoading && orchestrationSteps.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">💡</div>
                      <h3 className="text-lg font-semibold mb-2">Ready to Build</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Describe what you want to create in the chat, and watch as our AI agents 
                        collaborate to bring your idea to life. Each step will be shown here in real-time.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="h-full overflow-hidden">
                <SessionHistory />
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
