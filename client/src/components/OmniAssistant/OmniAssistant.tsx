/**
 * OmniAssistant Component
 * Enhanced AI assistant with persistent memory, context awareness, and proactive insights
 * Part of Digital Office Platform (Fas 1)
 *
 * This is the new enhanced assistant that coexists with the existing AssistantWidget
 */

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useOmniAssistant, type OmniAssistantMessage } from '@/hooks/useOmniAssistant';
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
  const [viewState, setViewState] = useState<ViewState>('closed');
  const [inputMessage, setInputMessage] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayedMessagesRef = useRef<Set<string>>(new Set()); // Track messages that have been displayed with typewriter
  const { currentSession, updateGeneratedFiles } = useWorkspace();
  const { sessionToken } = useAuth();
  const [, setLocation] = useLocation();

  const {
    messages,
    isLoading,
    features,
    sendMessage,
    clearSession,
  } = useOmniAssistant();

  // Get WorkspaceContext methods for prompt forwarding
  const { setPendingPrompt } = useWorkspace();

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

  // Fetch project files when a project is selected
  useEffect(() => {
    if (!selectedProjectId || !sessionToken) {
      setProjectFiles([]);
      return;
    }

    const fetchProjectFiles = async () => {
      try {
        const response = await apiFetch(`/api/workspaces/${selectedProjectId}/files`, {
          headers: getAuthHeaders(sessionToken),
        });
        if (response.ok) {
          const files = await response.json();
          setProjectFiles(files);
        }
      } catch (error) {
        console.error('Failed to fetch project files:', error);
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

  // Build playground context - works both on playground page and with selected project
  const buildPlaygroundContext = () => {
    const currentPage = window.location.pathname;
    const isPlaygroundPage = currentPage.startsWith('/playground');
    
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
      const projectIdMatch = currentPage.match(/\/playground\/(\d+)/);
      const projectId = projectIdMatch ? projectIdMatch[1] : 'default';

      return {
        currentProject: currentSession.name || 'Untitled Project',
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
      
      return {
        currentProject: selectedProject?.name || 'Selected Project',
        projectId: selectedProjectId.toString(),
        filesCount: projectFiles.length,
        filePaths: projectFiles.map(f => f.filePath),
        files: optimizeFileContents(projectFiles.map(f => ({ path: f.filePath, content: f.content }))),
        hasLivePreview: false,
        currentComponent: 'None',
        recentErrors: [],
        isGenerating: false,
        orchestrationSteps: 0,
        currentStep: 'None'
      };
    }
    
    // No context available
    return undefined;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage;
    setInputMessage('');

    const playgroundContext = buildPlaygroundContext();

    await sendMessage(message, {
      currentPage: window.location.pathname,
      workspaceId: currentSession?.id as number | undefined,
      playgroundContext,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isLoading) return;
    
    // Forward suggestion to playground AI using WorkspaceContext
    try {
      // Set pending prompt in workspace context (auto-saves to localStorage and database)
      setPendingPrompt(suggestion, 'omniassistant', {
        selectedProjectId,
        fromPage: window.location.pathname,
      });
      
      // Navigate to playground
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/playground')) {
        const projectId = selectedProjectId || currentSession?.id;
        const playgroundPath = projectId ? `/playground/${projectId}` : '/playground';
        setLocation(playgroundPath);
      }

      // Acknowledge to user
      await sendMessage(`✅ Suggestion sent to Playground AI: "${suggestion.substring(0, 100)}${suggestion.length > 100 ? '...' : ''}"`, {
        currentPage: window.location.pathname,
        workspaceId: (selectedProjectId || currentSession?.id) as number | undefined,
        playgroundContext: buildPlaygroundContext(),
      });
    } catch (error) {
      console.error('Failed to send suggestion to playground:', error);
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
      
      // Navigate to playground if not already there
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/playground')) {
        const projectId = currentSession?.id;
        const playgroundPath = projectId ? `/playground/${projectId}` : '/playground';
        setLocation(playgroundPath);
      }

      // Show success message
      await sendMessage('✅ Code changes have been sent to the playground AI. The playground will now apply these changes matching your app\'s design system.', {
        currentPage: window.location.pathname,
        workspaceId: currentSession?.id as number | undefined,
        playgroundContext: buildPlaygroundContext(),
      });
    } catch (error) {
      console.error('Failed to trigger playground generation:', error);
      await sendMessage(`❌ Failed to send code changes to playground: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or apply changes manually.`, {
        currentPage: window.location.pathname,
        workspaceId: currentSession?.id as number | undefined,
        playgroundContext: buildPlaygroundContext(),
      });
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
            className="fixed bottom-6 right-6 z-[48]"
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
                  <CardTitle className="text-sm">OmniAssistant</CardTitle>
                  <Database className="h-4 w-4 text-green-500" title="Persistent memory enabled" />
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
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[48]"
          >
            <Card className="w-[95vw] max-w-[800px] h-[85vh] max-h-[900px] md:max-w-[900px] shadow-2xl flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3 border-b">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">OmniAssistant</CardTitle>
                  <FeatureIndicators features={features} />
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewState('settings')}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewState('minimized')}
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewState('closed')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <MessageBubble 
                        key={idx} 
                        message={msg} 
                        onSuggestionClick={handleSuggestionClick}
                        onApplyChanges={handleApplyChanges}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t space-y-3">
                {/* Project Selector - only show when not on playground */}
                {!window.location.pathname.startsWith('/playground') && userProjects.length > 0 && (
                  <div className="flex items-center gap-2">
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
                    placeholder="Ask me anything about your digital office..."
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
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
              </div>
            </Card>
          </motion.div>
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
                      <Label className="text-sm font-medium">Persistent Memory</Label>
                      <p className="text-xs text-muted-foreground">
                        Save conversations to database for future reference
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      <Database className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>

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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Context Engine</Label>
                      <p className="text-xs text-muted-foreground">
                        Enhanced context awareness based on your activity
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      <Brain className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>
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
      <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 className="font-semibold text-lg mb-2">Welcome to OmniAssistant</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your AI-powered digital office assistant. I can help with coding, marketing, CRM, analytics,
        database design, and business guidance.
      </p>
    </div>
  );
}

function MessageBubble({ 
  message, 
  onSuggestionClick,
  onApplyChanges,
  displayedMessagesRef
}: { 
  message: OmniAssistantMessage;
  onSuggestionClick?: (suggestion: string) => void;
  onApplyChanges?: (files: Array<{ path: string; content: string }>) => void;
  displayedMessagesRef?: React.MutableRefObject<Set<string>>;
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
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-muted'
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold text-primary-foreground">You</span>
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>

      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'inline-block rounded-lg px-4 py-2 max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground border border-border'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap text-primary-foreground">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-white">
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />
              )}
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    const filePathMatch = codeString.match(/\/\/\s*file:\s*([^\n]+)/);
                    const filePath = filePathMatch ? filePathMatch[1].trim() : null;
                    const actualCode = filePathMatch ? codeString.replace(/\/\/\s*file:\s*[^\n]+\n/, '').trim() : codeString;

                    return !inline && match ? (
                      <div className="relative my-2">
                        {filePath && (
                          <div className="text-xs text-white/70 mb-1 px-2">
                            📄 {filePath}
                          </div>
                        )}
                        <div className="relative group">
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md"
                            {...props}
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
            {!hasEditableCode && onSuggestionClick && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSuggestionClick(message.content)}
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
