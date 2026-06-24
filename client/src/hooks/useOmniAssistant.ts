/**
 * useOmniAssistant Hook
 * React hook for interacting with the Elon assistant API
 * Part of Digital Office Platform (Fas 1)
 */

import { useState, useCallback, useEffect } from 'react';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useToast } from './use-toast';

export interface OmniAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  suggestions?: string[];
  conversationId?: number;
}

export interface AIInsight {
  id: number;
  insightType: string;
  title: string;
  message: string;
  data: any;
  priority: number;
  dismissed: boolean;
  actionTaken: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface UserPreference {
  id: number;
  preferenceType: string;
  value: any;
  confidenceScore: number;
  learnedAt: string;
  lastUpdated: string;
}

export interface OmniAssistantFeatures {
  persistConversation?: boolean;
  generateInsights?: boolean;
  useContextEngine?: boolean;
}

const STORAGE_KEY = 'omniassistant_messages';
const STORAGE_KEY_FEATURES = 'omniassistant_features';

export function useOmniAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<OmniAssistantMessage[]>(() => {
    // Restore messages from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to restore messages from localStorage:', error);
    }
    return [];
  });
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Features are always enabled - no user control
  const [features] = useState<OmniAssistantFeatures>({
    persistConversation: true, // Always enabled
    generateInsights: true, // Always enabled
    useContextEngine: true, // Always enabled
  });

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to persist messages to localStorage:', error);
    }
  }, [messages]);

  // Persist features to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(features));
    } catch (error) {
      console.error('Failed to persist features to localStorage:', error);
    }
  }, [features]);

  /**
   * Send a message to Elon
   */
  const sendMessage = useCallback(
    async (
      message: string,
      options?: {
        sessionId?: string;
        currentPage?: string;
        workspaceId?: number;
        customFeatures?: OmniAssistantFeatures;
        playgroundContext?: {
          currentProject?: string;
          projectId?: string;
          filesCount?: number;
          filePaths?: string[];
          files?: Array<{ path: string; content: string; language?: string; summary?: boolean; fullContent?: boolean }>;
          hasLivePreview?: boolean;
          currentComponent?: string;
          recentErrors?: string[];
          isGenerating?: boolean;
          orchestrationSteps?: number;
          currentStep?: string;
        };
      }
    ) => {
      setIsLoading(true);

      try {
        // Add user message to local state immediately
        const userMessage: OmniAssistantMessage = {
          role: 'user',
          content: message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Use streaming for better UX
        const sessionToken = localStorage.getItem('sessionToken');

        const response = await fetch(getApiUrl('/api/omniassistant/chat'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message,
            sessionId: options?.sessionId,
            currentPage: options?.currentPage || window.location.pathname,
            workspaceId: options?.workspaceId,
            playgroundContext: options?.playgroundContext,
            features: options?.customFeatures || features,
            stream: true, // Enable streaming
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Create placeholder assistant message for streaming
        const assistantMessage: OmniAssistantMessage = {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          toolsUsed: [],
          suggestions: [],
        };

        setMessages(prev => [...prev, assistantMessage]);

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
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'chunk') {
                    // Append text chunk
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
                        lastMessage.suggestions = data.suggestions || [];
                        lastMessage.conversationId = data.conversationId;
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

        // Get final message
        const finalMessage = assistantMessage;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return prev;
          }
          return prev;
        });

        return finalMessage;
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [features, toast]
  );

  /**
   * Load conversation history from database
   */
  const loadHistory = useCallback(
    async (contextType: string = 'general', limit: number = 10) => {
      try {
        const response = await apiFetch(
          `/api/omniassistant/history?contextType=${contextType}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to load history');
        }

        const data = await response.json();

        // Convert to message format
        const historyMessages: OmniAssistantMessage[] = data.conversations.flatMap((conv: any) => {
          // Parse conversation text to extract messages
          // This is simplified - you might want more sophisticated parsing
          return [
            {
              role: 'assistant' as const,
              content: conv.summary,
              timestamp: new Date(conv.createdAt),
            },
          ];
        });

        setMessages(historyMessages);
        return data.conversations;
      } catch (error) {
        console.error('Error loading history:', error);
        toast({
          title: 'Error',
          description: 'Failed to load conversation history.',
          variant: 'destructive',
        });
        return [];
      }
    },
    [toast]
  );

  /**
   * Fetch active insights
   */
  const fetchInsights = useCallback(async (limit: number = 10) => {
    try {
      const response = await apiFetch(`/api/omniassistant/insights?limit=${limit}`);

      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }

      const data = await response.json();
      setInsights(data.insights);
      return data.insights;
    } catch (error) {
      console.error('Error fetching insights:', error);
      return [];
    }
  }, []);

  /**
   * Dismiss an insight
   */
  const dismissInsight = useCallback(
    async (insightId: number) => {
      try {
        const response = await apiFetch(`/api/omniassistant/insights/${insightId}/dismiss`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to dismiss insight');
        }

        // Remove from local state
        setInsights(prev => prev.filter(i => i.id !== insightId));

        toast({
          title: 'Insight dismissed',
          description: 'The insight has been removed.',
        });
      } catch (error) {
        console.error('Error dismissing insight:', error);
        toast({
          title: 'Error',
          description: 'Failed to dismiss insight.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  /**
   * Mark insight as actioned
   */
  const actionInsight = useCallback(
    async (insightId: number) => {
      try {
        const response = await apiFetch(`/api/omniassistant/insights/${insightId}/action`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to action insight');
        }

        // Update local state
        setInsights(prev =>
          prev.map(i => (i.id === insightId ? { ...i, actionTaken: true } : i))
        );

        toast({
          title: 'Action recorded',
          description: 'Thank you for acting on this insight!',
        });
      } catch (error) {
        console.error('Error actioning insight:', error);
        toast({
          title: 'Error',
          description: 'Failed to record action.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  /**
   * Fetch user preferences
   */
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await apiFetch('/api/omniassistant/preferences');

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      return data.preferences;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      return [];
    }
  }, []);

  /**
   * Get daily summary
   */
  const getDailySummary = useCallback(async () => {
    try {
      const response = await apiFetch('/api/omniassistant/daily-summary');

      if (!response.ok) {
        throw new Error('Failed to get daily summary');
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('Error getting daily summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate daily summary.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  /**
   * Clear session history
   */
  const clearSession = useCallback(
    async (sessionId?: string) => {
      try {
        const response = await apiFetch('/api/omniassistant/clear-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to clear session');
        }

        // Clear local messages
        setMessages([]);

        toast({
          title: 'Session cleared',
          description: 'Conversation history has been cleared.',
        });
      } catch (error) {
        console.error('Error clearing session:', error);
        toast({
          title: 'Error',
          description: 'Failed to clear session.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  return {
    // State
    messages,
    insights,
    preferences,
    isLoading,
    features,

    // Actions
    sendMessage,
    loadHistory,
    fetchInsights,
    dismissInsight,
    actionInsight,
    fetchPreferences,
    getDailySummary,
    clearSession,
  };
}
