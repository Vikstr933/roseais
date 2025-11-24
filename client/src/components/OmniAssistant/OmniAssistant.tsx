/**
 * OmniAssistant Component
 * Enhanced AI assistant with persistent memory, context awareness, and proactive insights
 * Part of Digital Office Platform (Fas 1)
 *
 * This is the new enhanced assistant that coexists with the existing AssistantWidget
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { useOmniAssistant, type OmniAssistantMessage } from '@/hooks/useOmniAssistant';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

type ViewState = 'closed' | 'minimized' | 'full' | 'settings';

export function OmniAssistant() {
  const [viewState, setViewState] = useState<ViewState>('closed');
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentSession } = useWorkspace();

  const {
    messages,
    isLoading,
    features,
    sendMessage,
    clearSession,
    toggleFeature,
  } = useOmniAssistant();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (viewState === 'full' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, viewState]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage;
    setInputMessage('');

    await sendMessage(message, {
      currentPage: window.location.pathname,
      workspaceId: currentSession?.id as number | undefined,
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
    
    // Send the suggestion as a message
    await sendMessage(suggestion, {
      currentPage: window.location.pathname,
      workspaceId: currentSession?.id as number | undefined,
    });
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
            {features.persistConversation && (
              <div className="absolute -top-1 -right-1">
                <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  <Database className="h-3 w-3" />
                </Badge>
              </div>
            )}
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
                  {features.persistConversation && (
                    <Database className="h-4 w-4 text-green-500" title="Persistent memory enabled" />
                  )}
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
            <Card className="w-[90vw] max-w-[420px] h-[70vh] max-h-[600px] md:max-w-[480px] shadow-2xl flex flex-col">
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
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
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
                    <Switch
                      checked={features.persistConversation || false}
                      onCheckedChange={checked => toggleFeature('persistConversation', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">AI Insights</Label>
                      <p className="text-xs text-muted-foreground">
                        Get proactive suggestions and insights
                      </p>
                    </div>
                    <Switch
                      checked={features.generateInsights || false}
                      onCheckedChange={checked => toggleFeature('generateInsights', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Context Engine</Label>
                      <p className="text-xs text-muted-foreground">
                        Enhanced context awareness based on your activity
                      </p>
                    </div>
                    <Switch
                      checked={features.useContextEngine || false}
                      onCheckedChange={checked => toggleFeature('useContextEngine', checked)}
                    />
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
      {features.persistConversation && (
        <Badge variant="secondary" className="h-5 px-1.5">
          <Database className="h-3 w-3" />
        </Badge>
      )}
      {features.generateInsights && (
        <Badge variant="secondary" className="h-5 px-1.5">
          <Sparkles className="h-3 w-3" />
        </Badge>
      )}
      {features.useContextEngine && (
        <Badge variant="secondary" className="h-5 px-1.5">
          <Brain className="h-3 w-3" />
        </Badge>
      )}
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
  onSuggestionClick 
}: { 
  message: OmniAssistantMessage;
  onSuggestionClick?: (suggestion: string) => void;
}) {
  const isUser = message.role === 'user';

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
              : 'bg-muted'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

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
            <p className="text-xs text-muted-foreground">Suggestions:</p>
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
          <p className="text-xs text-muted-foreground">
            <Database className="h-3 w-3 inline mr-1" />
            Saved to memory
          </p>
        )}
      </div>
    </div>
  );
}
