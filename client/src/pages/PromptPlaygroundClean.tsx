import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '../components/ui/form';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import Editor from '@monaco-editor/react';
import { ComponentPreview } from '../components/ComponentPreview/ComponentPreview';
import { useServerStatus } from '../hooks/useServerStatus';
import FileExplorer from '../components/FileExplorer';
import { KnowledgeSelector } from '../components/KnowledgeSelector';
import { GitHubKnowledgeManager } from '../components/GitHubKnowledgeManager';
import { APIKeyManager } from '../components/APIKeyManager';
import {
  Send,
  Play,
  Square,
  Eye,
  Code,
  Settings,
  Brain,
  MessageSquare,
} from 'lucide-react';

// Types
interface AIResponse {
  type: 'text' | 'component';
  text: string;
  files?: {
    path: string;
    content: string;
  }[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SelectedKnowledge {
  companyIds: number[];
  frameworkIds: number[];
  workspaceIds: number[];
}

// Form Schema
const formSchema = z.object({
  userPrompt: z.string().min(1, 'Please enter a prompt'),
});

export default function PromptPlaygroundClean() {
  // State
  const [activeTab, setActiveTab] = useState('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [knowledgeMode, setKnowledgeMode] = useState<'automatic' | 'manual'>(
    'automatic'
  );
  const [selectedKnowledge, setSelectedKnowledge] = useState<SelectedKnowledge>(
    {
      companyIds: [],
      frameworkIds: [],
      workspaceIds: [],
    }
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { toast } = useToast();
  const { status: serverStatus } = useServerStatus();

  // Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userPrompt: '',
    },
  });

  // Helper Functions
  const getFileLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'ts':
        return 'typescript';
      case 'jsx':
      case 'js':
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

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Limit chat history to prevent performance issues
  const limitChatHistory = (messages: ChatMessage[]): ChatMessage[] => {
    const MAX_MESSAGES = 50; // Keep last 50 messages
    if (messages.length > MAX_MESSAGES) {
      return messages.slice(-MAX_MESSAGES);
    }
    return messages;
  };

  // Auto-scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  // Handlers
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: values.userPrompt,
      timestamp: new Date(),
    };

    setChatHistory(prev => limitChatHistory([...prev, userMessage]));
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content:
          "I've generated a React component for you. Check the Preview tab to see it in action!",
        timestamp: new Date(),
      };

      setChatHistory(prev => limitChatHistory([...prev, aiMessage]));

      // Mock response
      setResponse({
        type: 'component',
        text: 'Generated React component',
        files: [
          {
            path: 'src/components/ExampleComponent.tsx',
            content: `import React from 'react';

interface ExampleComponentProps {
  title: string;
  description?: string;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({ 
  title, 
  description = "This is a generated component" 
}) => {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default ExampleComponent;`,
          },
        ],
      });

      toast({
        title: 'Component Generated',
        description: 'Your React component has been created successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate component. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold">AI Playground</h1>
            <Badge
              variant={serverStatus === 'running' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {serverStatus === 'running'
                ? '🟢 Server Running'
                : '🔴 Server Offline'}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup
        direction="vertical"
        className="flex-1 overflow-hidden"
      >
        {/* Top Panel */}
        <ResizablePanel defaultSize={75} minSize={50} maxSize={90}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* File Explorer */}
            <ResizablePanel
              defaultSize={15}
              minSize={10}
              maxSize={20}
              className="bg-muted/30"
            >
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b bg-muted/50">
                  <h2 className="text-xs font-semibold text-muted-foreground">
                    📁 EXPLORER
                  </h2>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {response?.type === 'component' && response.files && (
                      <FileExplorer
                        workspacePath="/workspaces"
                        files={response.files.map(file => ({
                          ...file,
                          path: file.path.replace(/^\/workspaces\//, ''),
                        }))}
                        onSelectFile={(index: number) => {
                          setSelectedFileIndex(index);
                          const selectedFile = response.files?.[index];
                          if (selectedFile) {
                            setEditorLanguage(
                              getFileLanguage(selectedFile.path)
                            );
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

            {/* Main Content Area */}
            <ResizablePanel defaultSize={85} minSize={60}>
              <div className="h-full flex flex-col">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex-1 flex flex-col"
                >
                  <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <TabsList className="grid w-full grid-cols-5 h-10">
                      <TabsTrigger
                        value="chat"
                        className="text-xs flex items-center space-x-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Chat</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="preview"
                        className="text-xs flex items-center space-x-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Preview</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="editor"
                        className="text-xs flex items-center space-x-1"
                      >
                        <Code className="h-3 w-3" />
                        <span>Editor</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="knowledge"
                        className="text-xs flex items-center space-x-1"
                      >
                        <Brain className="h-3 w-3" />
                        <span>Knowledge</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="settings"
                        className="text-xs flex items-center space-x-1"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Settings</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Chat Tab */}
                  <TabsContent
                    value="chat"
                    className="flex-1 p-0 h-full overflow-hidden"
                  >
                    <div className="h-full flex flex-col">
                      {/* Chat Messages */}
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="p-4 space-y-4 pb-6">
                          {chatHistory.map((message, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-lg p-3 break-words ${
                                  message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <div className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                  {message.content}
                                </div>
                                <div className="text-xs opacity-70 mt-2 text-right">
                                  {message.timestamp.toLocaleTimeString()}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          {isLoading && (
                            <div className="flex justify-start">
                              <div className="bg-muted rounded-lg p-3 max-w-[85%]">
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                  <span className="text-sm text-muted-foreground">
                                    AI is thinking...
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Scroll anchor for auto-scroll */}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Chat Input */}
                      <div className="border-t p-4">
                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4"
                          >
                            <FormField
                              control={form.control}
                              name="userPrompt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="flex space-x-2">
                                      <Input
                                        placeholder="Describe what you want to build..."
                                        className="flex-1"
                                        {...field}
                                        disabled={isLoading}
                                      />
                                      <Button
                                        type="submit"
                                        disabled={isLoading}
                                      >
                                        {isLoading ? (
                                          <Square className="h-4 w-4" />
                                        ) : (
                                          <Send className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </form>
                        </Form>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Preview Tab */}
                  <TabsContent value="preview" className="flex-1 p-0">
                    <div className="h-full">
                      {response?.type === 'component' &&
                      response.files &&
                      response.files.length > 0 ? (
                        <div className="h-full border rounded-lg bg-background flex flex-col">
                          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium">
                                Component Preview
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {response.files.length} files
                              </Badge>
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <ComponentPreview
                              componentName="GeneratedComponent"
                              files={response.files || []}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <h3 className="text-lg font-medium mb-2">
                              No Component Generated
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Generate a component to see the preview here
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Editor Tab */}
                  <TabsContent value="editor" className="flex-1 p-0">
                    <div className="h-full">
                      {response?.type === 'component' &&
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
                            lineNumbers: 'on',
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            readOnly: false,
                            wordWrap: 'on',
                            suggestOnTriggerCharacters: true,
                            formatOnPaste: true,
                            formatOnType: true,
                            tabSize: 2,
                            insertSpaces: true,
                            detectIndentation: true,
                            folding: true,
                            glyphMargin: true,
                            bracketPairColorization: {
                              enabled: true,
                            },
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <h3 className="text-lg font-medium mb-2">
                              No File Selected
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Generate a component to see the code here
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Knowledge Tab */}
                  <TabsContent value="knowledge" className="flex-1 p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-6">
                        {/* Knowledge Mode Selection */}
                        <div className="bg-card p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold">
                                Knowledge Selection
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Control how AI agents use your knowledge base
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label
                                htmlFor="knowledge-mode"
                                className="text-sm font-medium"
                              >
                                Mode:
                              </Label>
                              <Select
                                value={knowledgeMode}
                                onValueChange={(
                                  value: 'automatic' | 'manual'
                                ) => setKnowledgeMode(value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="automatic">
                                    Automatic
                                  </SelectItem>
                                  <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Knowledge Selector */}
                          <KnowledgeSelector
                            onKnowledgeChange={setSelectedKnowledge}
                            initialQuery={form.watch('userPrompt')}
                            mode={knowledgeMode}
                          />
                        </div>

                        {/* GitHub Knowledge Manager */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">
                            GitHub Repository Knowledge
                          </h4>
                          <GitHubKnowledgeManager
                            userId="user123"
                            onRepositoryAdded={repository => {
                              toast({
                                title: 'Repository Added',
                                description: `Added ${repository.fullName} to knowledge base`,
                              });
                            }}
                          />
                        </div>

                        {/* API Key Manager */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">
                            API Key Management
                          </h4>
                          <APIKeyManager
                            userId="user123"
                            onAPIKeyAdded={apiKey => {
                              toast({
                                title: 'API Key Added',
                                description: `Added ${apiKey.serviceName} API key`,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="flex-1 p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-6">
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold">
                            Generation Settings
                          </h3>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                AI Model
                              </span>
                              <span className="text-sm text-muted-foreground">
                                Claude 3.5 Sonnet
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                Server Status
                              </span>
                              <Badge
                                variant={
                                  serverStatus === 'running'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {serverStatus === 'running'
                                  ? 'Running'
                                  : 'Offline'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Editor Theme
                              </span>
                              <Select
                                value={editorTheme}
                                onValueChange={setEditorTheme}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="vs-dark">Dark</SelectItem>
                                  <SelectItem value="vs-light">
                                    Light
                                  </SelectItem>
                                </SelectContent>
                              </Select>
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
        </ResizablePanel>

        <ResizableHandle />

        {/* Terminal Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={50}>
          <div className="h-full flex flex-col bg-muted/30">
            <div className="px-3 py-2 border-b bg-muted/50">
              <h3 className="text-xs font-semibold text-muted-foreground">
                🖥️ TERMINAL
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3">
                <div className="font-mono text-xs space-y-1">
                  {isLoading && (
                    <div className="text-primary animate-pulse flex items-center space-x-2">
                      <span>🔄</span>
                      <span>Generating component...</span>
                    </div>
                  )}
                  {!isLoading && (
                    <div className="text-muted-foreground">
                      Ready to generate components
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
