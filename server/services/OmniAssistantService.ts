/**
 * OmniAssistant Service
 * Enhanced AI assistant with persistent memory, context awareness, and proactive insights
 * Part of Digital Office Platform (Fas 1)
 *
 * This service wraps the existing PersonalAssistantAgent and adds:
 * - Persistent conversation storage (conversations table)
 * - AI-learned user preferences (user_preferences table)
 * - Proactive insights generation (ai_insights table)
 * - Context-aware responses based on user's current activity
 * - Feature flag support for gradual rollout
 */

import { PersonalAssistantAgent } from '../agents/PersonalAssistantAgent';
import { ConversationMemoryService } from './ConversationMemoryService';
import { ContextEngine } from './ContextEngine';
import { ProjectService } from './ProjectService';
import type { MultiModelAIService } from './MultiModelAIService';

export interface OmniAssistantOptions {
  sessionId?: string;
  currentPage?: string;
  workspaceId?: number;
  playgroundContext?: {
    currentProject?: string;
    projectId?: string;
    filesCount?: number;
    filePaths?: string[];
    files?: Array<{ path: string; content: string; language?: string }>; // Actual file contents
    hasLivePreview?: boolean;
    currentComponent?: string;
    recentErrors?: string[];
    isGenerating?: boolean;
    orchestrationSteps?: number;
    currentStep?: string;
  };
  persistConversation?: boolean; // Feature flag: enable persistent storage
  generateInsights?: boolean; // Feature flag: enable proactive insights
  useContextEngine?: boolean; // Feature flag: enable enhanced context
}

export interface OmniAssistantResponse {
  response: string;
  toolsUsed: string[];
  contextUsed: any[];
  suggestions?: string[];
  conversationId?: number; // If persisted
  insights?: any[]; // Active insights for user
}

export class OmniAssistantService {
  private personalAssistant: PersonalAssistantAgent;
  private conversationMemory: ConversationMemoryService;
  private contextEngine: ContextEngine;
  private projectService: ProjectService;

  constructor(
    personalAssistant: PersonalAssistantAgent,
    multiModelAI: MultiModelAIService,
    projectService: ProjectService
  ) {
    this.personalAssistant = personalAssistant;
    this.conversationMemory = new ConversationMemoryService(multiModelAI);
    this.contextEngine = new ContextEngine(this.conversationMemory, projectService);
    this.projectService = projectService;
  }

  /**
   * Process user request with enhanced OmniAssistant features
   * Falls back to regular PersonalAssistantAgent if features are disabled
   */
  async processRequest(
    userId: string,
    userMessage: string,
    options: OmniAssistantOptions = {}
  ): Promise<OmniAssistantResponse> {
    const {
      sessionId,
      currentPage = '/playground',
      workspaceId,
      playgroundContext,
      persistConversation = false, // Default OFF for backward compatibility
      generateInsights = false,
      useContextEngine = false,
    } = options;

    // Build conversation text for potential persistence
    const conversationText = `User: ${userMessage}`;

    // Enhanced context if ContextEngine is enabled
    let enhancedOptions = {
      sessionId,
      includeContext: true,
      maxContextItems: 10,
      playgroundContext, // Pass playground context to PersonalAssistantAgent
    };

    if (useContextEngine) {
      // Get comprehensive user context
      const userContext = await this.contextEngine.analyzeContext(
        userId,
        currentPage,
        workspaceId
      );

      console.log(`🧠 OmniAssistant: Enhanced context for user ${userId}`, {
        contextType: userContext.contextType,
        workspace: userContext.currentWorkspace?.name,
        recentActivity: userContext.recentActivity.length,
        suggestions: userContext.suggestedActions.length,
      });

      // Check if user needs proactive help
      if (generateInsights) {
        await this.contextEngine.detectNeedForHelp(userId, userContext.recentActivity);
      }
    }

    // Call PersonalAssistantAgent (existing, tested code)
    const result = await this.personalAssistant.processRequest(
      userId,
      userMessage,
      enhancedOptions
    );

    // Persist conversation if feature enabled
    let conversationId: number | undefined;
    if (persistConversation) {
      try {
        const contextType = this.contextEngine['mapPageToContextType'](currentPage);
        const fullConversation = `${conversationText}\n\nAssistant: ${result.response}`;

        // Extract key points from conversation
        const keyPoints = await this.conversationMemory.extractKeyPoints(fullConversation);

        // Store in database
        const conversation = await this.conversationMemory.storeConversation(
          userId,
          contextType,
          fullConversation,
          keyPoints
        );

        conversationId = conversation.id;

        console.log(`💾 OmniAssistant: Conversation persisted`, {
          userId,
          conversationId,
          contextType,
          keyPointsCount: keyPoints.length,
        });
      } catch (error) {
        console.error('❌ OmniAssistant: Failed to persist conversation', error);
        // Don't fail the request if persistence fails
      }
    }

    // Learn from user interaction (if insights enabled)
    if (generateInsights && userMessage.length > 20) {
      // Learn user preferences from their requests
      this.learnFromInteraction(userId, userMessage, result.response, currentPage).catch(
        error => {
          console.error('⚠️ OmniAssistant: Failed to learn from interaction', error);
        }
      );
    }

    // Get active insights
    let insights: any[] = [];
    if (generateInsights) {
      try {
        insights = await this.conversationMemory.getActiveInsights(userId, 5);
      } catch (error) {
        console.error('⚠️ OmniAssistant: Failed to fetch insights', error);
      }
    }

    return {
      response: result.response,
      toolsUsed: result.toolsUsed,
      contextUsed: result.contextUsed,
      suggestions: result.suggestions,
      conversationId,
      insights,
    };
  }

  /**
   * Learn user preferences from their interactions
   */
  private async learnFromInteraction(
    userId: string,
    userMessage: string,
    aiResponse: string,
    currentPage: string
  ): Promise<void> {
    try {
      // Detect coding style preferences
      if (currentPage.includes('playground') || currentPage.includes('editor')) {
        const preferences = this.detectCodingPreferences(userMessage);
        for (const [type, value] of Object.entries(preferences)) {
          await this.conversationMemory.learnPreference(userId, type, value, 0.6);
        }
      }

      // Detect communication tone preferences
      const tone = this.detectCommunicationTone(userMessage);
      if (tone) {
        await this.conversationMemory.learnPreference(
          userId,
          'communication_tone',
          { preferred_tone: tone },
          0.5
        );
      }

      // Detect work patterns (time of day, frequency)
      const hour = new Date().getHours();
      await this.conversationMemory.learnPreference(
        userId,
        'active_hours',
        { hour, count: 1 },
        0.3
      );
    } catch (error) {
      console.error('Error learning from interaction:', error);
    }
  }

  /**
   * Detect coding preferences from user's message
   */
  private detectCodingPreferences(message: string): Record<string, any> {
    const preferences: Record<string, any> = {};

    // Detect framework preferences
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'remix'];
    for (const fw of frameworks) {
      if (message.toLowerCase().includes(fw)) {
        preferences.preferred_framework = fw;
        break;
      }
    }

    // Detect language preferences
    const languages = ['typescript', 'javascript', 'python', 'go', 'rust'];
    for (const lang of languages) {
      if (message.toLowerCase().includes(lang)) {
        preferences.preferred_language = lang;
        break;
      }
    }

    // Detect styling preferences
    const stylingTools = ['tailwind', 'css modules', 'styled-components', 'emotion', 'sass'];
    for (const tool of stylingTools) {
      if (message.toLowerCase().includes(tool)) {
        preferences.preferred_styling = tool;
        break;
      }
    }

    return preferences;
  }

  /**
   * Detect communication tone from message
   */
  private detectCommunicationTone(message: string): string | null {
    const msg = message.toLowerCase();

    if (msg.includes('please') || msg.includes('could you') || msg.includes('would you')) {
      return 'polite';
    }

    if (msg.includes('asap') || msg.includes('quickly') || msg.includes('urgent')) {
      return 'urgent';
    }

    if (msg.split(' ').length < 5) {
      return 'concise';
    }

    if (msg.includes('explain') || msg.includes('detail') || msg.includes('understand')) {
      return 'detailed';
    }

    return null;
  }

  /**
   * Get conversation history for a user (from database)
   */
  async getConversationHistory(
    userId: string,
    contextType: string = 'general',
    limit: number = 10
  ) {
    return await this.conversationMemory.getRecentConversations(userId, contextType, limit);
  }

  /**
   * Get active insights for user
   */
  async getActiveInsights(userId: string, limit: number = 10) {
    return await this.conversationMemory.getActiveInsights(userId, limit);
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(insightId: number) {
    return await this.conversationMemory.dismissInsight(insightId);
  }

  /**
   * Mark insight as actioned
   */
  async markInsightActioned(insightId: number) {
    return await this.conversationMemory.markInsightActioned(insightId);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string) {
    return await this.conversationMemory.getAllPreferences(userId);
  }

  /**
   * Generate daily summary (existing feature from PersonalAssistantAgent)
   */
  async generateDailySummary(userId: string): Promise<string> {
    // Get recent activity
    const recentActivity = await this.contextEngine['getRecentActivity'](userId, 20);

    // Get active insights
    const insights = await this.conversationMemory.getActiveInsights(userId, 5);

    // Build summary prompt
    const summaryPrompt = `Generate a concise daily summary for the user based on their activity:

Recent Activity:
${recentActivity.map(a => `- ${a.description} (${a.type})`).join('\n')}

Active Insights:
${insights.map(i => `- ${i.title}: ${i.message}`).join('\n')}

Provide a friendly, concise summary highlighting:
1. What they accomplished today
2. Any important insights or recommendations
3. Suggested next actions

Keep it under 150 words.`;

    const result = await this.personalAssistant.processRequest(userId, summaryPrompt, {
      includeContext: false,
    });

    return result.response;
  }

  /**
   * Clear conversation history for a session
   * This clears in-memory history in PersonalAssistantAgent
   */
  clearSessionHistory(sessionId: string) {
    this.personalAssistant.clearHistory(sessionId);
    console.log(`🧹 OmniAssistant: Cleared session history for ${sessionId}`);
  }

  /**
   * Register additional tools for user (delegates to PersonalAssistantAgent)
   */
  registerToolsForUser(userId: string, tools: any[]) {
    this.personalAssistant.registerToolsForUser(userId, tools);
  }

  /**
   * Clear additional tools for user
   */
  clearToolsForUser(userId: string) {
    this.personalAssistant.clearToolsForUser(userId);
  }
}
