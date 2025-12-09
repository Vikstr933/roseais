/**
 * useOmniAssistant Hook
 * React hook for interacting with OmniAssistant API
 * Part of Digital Office Platform (Fas 1)
 */

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
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
   * Send a message to OmniAssistant
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

        // Call API
        const response = await apiFetch('/api/omniassistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            sessionId: options?.sessionId,
            currentPage: options?.currentPage || window.location.pathname,
            workspaceId: options?.workspaceId,
            playgroundContext: options?.playgroundContext,
            features: options?.customFeatures || features,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();

        // Add assistant message to local state
        const assistantMessage: OmniAssistantMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          toolsUsed: data.toolsUsed,
          suggestions: data.suggestions,
          conversationId: data.conversationId,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Update insights if returned
        if (data.insights && data.insights.length > 0) {
          setInsights(data.insights);
        }

        return assistantMessage;
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
