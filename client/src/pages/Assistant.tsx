import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  Sparkles,
  Mail,
  Calendar,
  ListTodo,
  Lightbulb,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  contextUsed?: any[];
  suggestions?: string[];
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Load daily summary on mount
    loadDailySummary();
  }, []);

  const loadDailySummary = async () => {
    try {
      setLoadingSummary(true);
      const response = await apiFetch('/api/plugins/assistant/daily-summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setDailySummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load daily summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    const userInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Create placeholder assistant message for streaming
    const assistantMessageId = Date.now();
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      toolsUsed: [],
      contextUsed: [],
      suggestions: []
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const sessionToken = localStorage.getItem('sessionToken');

      // Use streaming endpoint
      const response = await fetch(`${API_BASE}/api/plugins/assistant/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userInput,
          includeContext: true,
          maxContextItems: 10,
          stream: true // Enable streaming
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      // Read stream with proper error handling
      // Using a helper function to avoid esbuild parsing issues with nested try-catch
      const readStream = async () => {
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
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk') {
                  // Append text chunk to message
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content += data.text || '';
                    }
                    return updated;
                  });
                } else if (data.type === 'tools_used') {
                  // Update tools used
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.toolsUsed = data.tools || [];
                    }
                    return updated;
                  });
                } else if (data.type === 'complete') {
                  // Final message with all metadata
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMessage = updated[updated.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content = data.response || lastMessage.content;
                      lastMessage.toolsUsed = data.toolsUsed || [];
                      lastMessage.contextUsed = data.contextUsed || [];
                      lastMessage.suggestions = data.suggestions || [];
                    }
                    return updated;
                  });
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Streaming error');
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      };

      try {
        await readStream();
      } catch (streamError) {
        // Handle stream errors gracefully (stream might be closed)
        if (streamError instanceof TypeError && streamError.message.includes('ReadableStream')) {
          console.warn('Stream was closed, ending read operation');
        } else {
          console.error('Error reading stream:', streamError);
        }
      } finally {
        // Ensure reader is released
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore errors when releasing lock
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered a network error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => {
        // Replace the empty streaming message with error
        const updated = [...prev];
        updated[updated.length - 1] = errorMessage;
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await apiFetch('/api/plugins/assistant/clear-history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('email')) return <Mail className="w-3 h-3" />;
    if (toolName.includes('calendar')) return <Calendar className="w-3 h-3" />;
    if (toolName.includes('task')) return <ListTodo className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl h-screen flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Sparkles className="w-8 h-8 mr-2 text-primary" />
              AI Assistant
            </h1>
            <p className="text-muted-foreground">
              Your intelligent companion with access to your connected services
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear History
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            <ScrollArea className="flex-1 px-6" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Sparkles className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Ask me anything! I have access to your connected services and can help with emails, calendar, tasks, and more.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                    <Button
                      variant="outline"
                      onClick={() => setInput('What are my high priority emails today?')}
                    >
                      Check my emails
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInput('Summarize my day')}
                    >
                      Daily summary
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInput('What action items do I have?')}
                    >
                      Show action items
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInput('Help me draft an email')}
                    >
                      Draft an email
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-start space-x-2 mb-2">
                          {message.role === 'assistant' && (
                            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-semibold mb-1">
                              {message.role === 'user' ? 'You' : 'Assistant'}
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>
                        </div>

                        {message.toolsUsed && message.toolsUsed.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs text-muted-foreground">Tools used:</span>
                            {message.toolsUsed.map((tool, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {getToolIcon(tool)}
                                <span className="ml-1">{tool.replace(/_/g, ' ')}</span>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Lightbulb className="w-3 h-3 mr-1" />
                              Suggestions:
                            </div>
                            {message.suggestions.map((suggestion, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-xs"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-4 flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="resize-none"
                  rows={2}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="h-full"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Daily Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Daily Summary</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadDailySummary}
                  disabled={loadingSummary}
                >
                  {loadingSummary ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : dailySummary ? (
                <div className="text-sm whitespace-pre-wrap">{dailySummary}</div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Connect integrations to see your daily summary
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput('Check my unread emails')}
              >
                <Mail className="w-4 h-4 mr-2" />
                Check Emails
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput('What are my action items?')}
              >
                <ListTodo className="w-4 h-4 mr-2" />
                View Action Items
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setInput('Summarize today')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Get Summary
              </Button>
            </CardContent>
          </Card>

          {/* Context Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Contextual awareness from connected services</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Email management and analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Action item extraction</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Natural language commands</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
