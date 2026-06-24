import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatBeforeBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectType: string;
  initialIdea?: string;
  onComplete: (refinedDescription: string) => void;
}

export function ChatBeforeBuildDialog({
  open,
  onOpenChange,
  projectType,
  initialIdea,
  onComplete,
}: ChatBeforeBuildDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sessionToken } = useAuth();

  useEffect(() => {
    if (open && initialIdea) {
      setInput(initialIdea);
    }
    if (open && messages.length === 0) {
      // Add welcome message
      setMessages([
        {
          role: 'assistant',
          content: `Hi! I'm here to help you refine your ${projectType.replace('_', ' ')} idea. Tell me what you want to build, and I'll ask questions to help create a better project description.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, initialIdea, projectType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Use Elon for chat
      const response = await apiFetch('/api/omniassistant/chat', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          message: `I want to create a ${projectType.replace('_', ' ')}. ${userMessage.content}. Help me refine this idea and create a detailed project description. Ask clarifying questions if needed.`,
          currentPage: '/workspaces',
          features: {
            persistConversation: false,
            generateInsights: false,
            useContextEngine: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || 'I understand. Can you tell me more about what features you want?',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if AI suggests we're done
      if (data.response?.toLowerCase().includes('ready to create') || 
          data.response?.toLowerCase().includes('project description') ||
          messages.length >= 5) {
        setIsComplete(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDescription = () => {
    // Extract key points from conversation
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // Use the last assistant message or generate summary
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    const refinedDescription = lastAssistantMessage?.content || conversationText;

    onComplete(refinedDescription);
    onOpenChange(false);
  };

  const handleSkip = () => {
    const initialDescription = initialIdea || `A ${projectType.replace('_', ' ')} project`;
    onComplete(initialDescription);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Refine Your Project Idea
          </DialogTitle>
          <DialogDescription>
            Chat with AI to refine your idea before creating the project. This helps create a better project description.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-muted/30 rounded-lg">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border border-border'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-primary-foreground">You</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-background border border-border rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your project idea or answer questions..."
                className="min-h-[80px] resize-none"
                disabled={isLoading || isComplete}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || isComplete}
                size="icon"
                className="h-[80px]"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isComplete && (
              <Badge variant="default" className="w-full justify-center">
                Ready to create project!
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between">
          <Button variant="outline" onClick={handleSkip}>
            Skip Chat
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateDescription}
              disabled={messages.length < 2}
            >
              Use This Description
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
