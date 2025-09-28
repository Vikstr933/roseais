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
import { AlertCircle, HelpCircle, Eye, Code, Play, Square, Send, FileCode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import Editor from "@monaco-editor/react";
import { ComponentPreview } from "../components/ComponentPreview/ComponentPreview";
import { useServerStatus } from "../hooks/useServerStatus";
import FileExplorer from "../components/FileExplorer";
import SessionHistory from "../components/SessionHistory";

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
  const [showPreview, setShowPreview] = useState(false);
  const { status: serverStatus, isLoading: serverLoading, startServer, stopServer } = useServerStatus();
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [response, setResponse] = useState<string | AIResponse | null>(null);
  const [orchestrationSteps, setOrchestrationSteps] = useState<OrchestrationStep[]>([]);
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
  const { toast } = useToast();

  // Removed agent query since we always use orchestration now

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
          setResponse(null);
          setOrchestrationSteps([]);
          toast({
            title: "Generation Started",
            description: data.data.message
          });
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
      setResponse(null);
      setIsLoading(true);

      // Add user message to chat history
      setChatHistory(prev => [...prev, {
        role: 'user',
        content: data.userPrompt,
        timestamp: Date.now()
      }]);

      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          systemPrompt: SYSTEM_PROMPT,
          orchestration: true, // Always use multi-agent orchestration
          sessionId: currentSessionId,
          projectType: data.projectType,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      return res.json();
    },
    onSuccess: async (data: GenerateResponse) => {
      setIsLoading(false);
      
      if (data.response.type === 'component' && data.response.files) {
        // Add assistant message to chat history
        const newMessage = {
          role: 'assistant' as const,
          content: data.response.text,
          timestamp: Date.now(),
          files: data.response.files
        };
        setChatHistory(prev => [...prev, newMessage]);

        // Save session
        const sessionData = {
          id: currentSessionId || undefined,
          title: data.response.text,
          inputPrompt: form.getValues('userPrompt'),
          generatedCode: JSON.stringify(data.response.files),
          description: `Generated using multi-agent orchestration with ${form.getValues('model')}`
        };

        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });

        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          setCurrentSessionId(newSession.id);
        }

        // Create workspace immediately
        const workspaceId = Date.now();
        const workspacePath = `/workspaces/${workspaceId}`;
        
        // Format and store files in final location
        const formattedFiles = data.response.files.map(file => ({
          ...file,
          content: file.content.trim(),
          path: `${workspacePath}/${file.path}`
        }));

        // Save files and install dependencies in one operation
        const saveResponse = await fetch('/api/workspaces/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            files: formattedFiles,
            installDependencies: true // Add flag to install dependencies
          })
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save workspace and install dependencies');
        }

        // Update state with new files immediately
        setResponse({
          ...data.response,
          files: formattedFiles
        });

        // Start the app server with dependencies pre-installed
        const serverResponse = await fetch('/api/server/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            workspaceId,
            withDependencies: true // Ensure dependencies are available
          })
        });

        if (!serverResponse.ok) {
          throw new Error('Failed to start server with dependencies');
        }

        toast({
          title: "Component Generated",
          description: "Your component has been created and is ready for preview.",
        });
      } else {
        setResponse(data.response);
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
      setResponse(null);
    },
  });

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Top Bar */}
      <div className="h-12 border-b flex items-center justify-between px-4 bg-muted/30">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-medium">Multi-Agent App Generator</h1>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isLoading ? "bg-blue-500 animate-pulse" : "bg-green-500"}`}></div>
              {isLoading ? "AI Agents Working..." : "Ready for Ideas"}
            </div>
            <div className="flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Orchestration Mode</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={startServer}
            disabled={serverStatus === 'running' || serverLoading}
          >
            <Play className="h-4 w-4 mr-2" />
            {serverLoading ? "Starting..." : "Start Server"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={stopServer}
            disabled={serverStatus === 'stopped' || serverLoading}
          >
            <Square className="h-4 w-4 mr-2" />
            {serverLoading ? "Stopping..." : "Stop Server"}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Documentation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* File Explorer */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={20} className="bg-muted/30">
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">EXPLORER</h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {typeof response === 'object' && response?.type === 'component' && (
                    <FileExplorer 
                    workspacePath="/workspaces"
                    files={response.files?.map(file => ({
                      ...file,
                      path: file.path.replace(/^\/workspaces\//, '')
                    })) || []}
                    onSelectFile={(index: number) => {
                      setSelectedFileIndex(index);
                      const selectedFile = response.files?.[index];
                      if (selectedFile) {
                        setEditorLanguage(getFileLanguage(selectedFile.path));
                      }
                    }}
                    selectedFileIndex={selectedFileIndex}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Editor Area */}
        <ResizablePanel defaultSize={45}>
          <div className="h-full flex flex-col">
            <div className="px-4 border-b h-10 bg-muted/30 flex items-center justify-end">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    if (typeof response === 'object' && response?.type === 'component') {
                      const formattedFiles = response.files?.map(file => ({
                        ...file,
                        content: file.content.trim()
                      }));
                      setResponse({
                        ...response,
                        files: formattedFiles
                      });
                    }
                  }}
                >
                  Format
                </Button>
                <Button
                  variant={showPreview ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (!showPreview && serverStatus !== 'running') {
                      toast({
                        title: "Server Required",
                        description: "Start the server to preview the component",
                        variant: "destructive"
                      });
                      return;
                    }
                    setShowPreview(!showPreview);
                  }}
                >
                  {showPreview ? <Code className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showPreview ? "Editor" : "Preview"}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {!showPreview ? (
                typeof response === 'object' && 
                response?.type === 'component' && 
                response.files && 
                response.files[selectedFileIndex] ? (
                  <Editor
                    height="100%"
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
                )
              ) : (
                <div className="h-full">
                  {typeof response === 'object' &&
                   response?.type === 'component' &&
                   response.files &&
                   response.files.length > 0 ? (
                    <div className="h-full border rounded-lg bg-background flex flex-col">
                      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                        <h4 className="text-sm font-medium">Live Preview</h4>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          Running
                        </div>
                      </div>
                      <div className="flex-1 p-4 overflow-auto">
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
                                    const { useState, useEffect, useCallback } = React;

                                    ${response.files.find(f => f.path.includes('.tsx') && !f.path.includes('main.tsx'))?.content?.replace(/export default function/g, 'function Component').replace(/import.*from.*;/g, '').replace(/import.*;/g, '') || 'function Component() { return React.createElement("div", {className: "app"}, "Component generated successfully!"); }'}

                                    const rootElement = document.getElementById('root');
                                    if (rootElement) {
                                      const root = ReactDOM.createRoot ? ReactDOM.createRoot(rootElement) : null;
                                      if (root) {
                                        root.render(React.createElement(Component));
                                      } else {
                                        ReactDOM.render(React.createElement(Component), rootElement);
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
                          className="w-full h-full min-h-[400px] border-0 rounded bg-white"
                          title="Component Preview"
                          sandbox="allow-scripts"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">Component Preview</h3>
                        <p className="text-sm text-muted-foreground">Generate a component to see the preview here</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Panel - AI Extension */}
        <ResizablePanel defaultSize={40} minSize={30} maxSize={60}>
          <div className="h-full flex flex-col">
            <div className="px-4 border-b h-10 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium">AI Extension</h3>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`}></div>
                  <span className="text-sm text-muted-foreground">{isLoading ? "Processing" : "Ready"}</span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="prompt" className="flex-1">
              <TabsList className="px-4 border-b h-10 bg-muted/30">
                <TabsTrigger value="prompt" className="text-sm">Prompt</TabsTrigger>
                <TabsTrigger value="process" className="text-sm">Process</TabsTrigger>
                <TabsTrigger value="sessions" className="text-sm">Sessions</TabsTrigger>
                <TabsTrigger value="settings" className="text-sm">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((message, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-50/10 border border-blue-200/20 ml-auto max-w-[80%]'
                          : 'bg-green-50/10 border border-green-200/20 mr-auto max-w-[80%]'
                      }`}
                    >
                      <div className="text-sm text-muted-foreground mb-1">
                        {message.role === 'user' ? 'You' : 'Assistant'} • {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.role === 'assistant' && message.files && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium mb-1">Generated Files:</h4>
                          <div className="space-y-1">
                            {message.files.map((file, i) => (
                              <div key={i} className="text-sm text-muted-foreground">
                                <FileCode className="inline-block h-4 w-4 mr-2" />
                                {file.path}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="p-4 border-t bg-background">
                  <Form {...form}>
                    <form 
                      onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))} 
                      className="space-y-4"
                    >
                      <div className="flex gap-4">
                        <FormField
                          control={form.control}
                          name="userPrompt"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Describe your app idea... (e.g., 'Create a todo list app with priorities')"
                                  {...field}
                                  className="w-full"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={generateMutation.isPending}>
                          {generateMutation.isPending ? "Sending..." : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium">Multi-Agent Orchestration</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          AI agents will collaborate to build your app
                        </div>
                      </div>
                    </form>
                  </Form>
                </div>
              </TabsContent>

              <TabsContent value="sessions" className="flex-1 p-0">
                <SessionHistory />
              </TabsContent>

              <TabsContent value="process" className="flex-1 p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {orchestrationSteps.map((step, index) => (
                      <div 
                        key={index}
                        className={
                          "p-4 rounded-lg border " + 
                          (step.status === 'completed' 
                            ? "bg-green-50/10 border-green-200/20"
                            : step.status === 'in_progress'
                            ? "bg-blue-50/10 border-blue-200/20"
                            : step.status === 'failed'
                            ? "bg-red-50/10 border-red-200/20"
                            : "bg-gray-50/10 border-gray-200/20")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{step.agent}</h4>
                            <p className="text-sm text-muted-foreground">{step.task}</p>
                          </div>
                          <div className="text-sm">
                            {step.status === 'completed' && '✓ Done'}
                            {step.status === 'in_progress' && '⟳ In Progress'}
                            {step.status === 'failed' && '✕ Failed'}
                            {step.status === 'pending' && '⋯ Pending'}
                          </div>
                        </div>
                        {step.dependencies.length > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Depends on: {step.dependencies.join(', ')}
                          </div>
                        )}
                        {step.previews && step.previews.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium mb-2">Code Previews:</h5>
                            {step.previews.map((preview, i) => (
                              <div key={i} className="bg-background p-3 rounded-md mb-2">
                                <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {preview}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Generation Settings</h3>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">AI Model</span>
                          <span className="text-sm text-muted-foreground">Claude 3.5 Sonnet</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Mode</span>
                          <span className="text-sm text-muted-foreground">Multi-Agent Orchestration</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Temperature</span>
                          <span className="text-sm text-muted-foreground">0.7 (Balanced)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Agent Workflow</h3>
                      <div className="space-y-2">
                        <div className="flex items-center p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                          <div>
                            <div className="text-sm font-medium">Requirements Analysis</div>
                            <div className="text-xs text-muted-foreground">Analyze and break down user requirements</div>
                          </div>
                        </div>
                        <div className="flex items-center p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          <div>
                            <div className="text-sm font-medium">UI Design</div>
                            <div className="text-xs text-muted-foreground">Design user interface and components</div>
                          </div>
                        </div>
                        <div className="flex items-center p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                          <div>
                            <div className="text-sm font-medium">Code Generation</div>
                            <div className="text-xs text-muted-foreground">Generate complete application code</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Terminal Panel */}
      <div className="h-48 border-t bg-muted/30">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-2">Terminal</h3>
          <div className="font-mono text-sm">
            {orchestrationSteps.map((step, index) => (
              <div key={index} className="text-muted-foreground">
                {step.status === 'completed' && '✓'}
                {step.status === 'in_progress' && '⟳'}
                {step.status === 'failed' && '✕'}
                {step.status === 'pending' && '⋯'}
                {' '}{step.agent}: {step.task}
              </div>
            ))}
            {isLoading && (
              <div className="text-primary animate-pulse">
                Generating component...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
