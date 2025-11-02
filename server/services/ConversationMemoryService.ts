/**
 * Conversation Memory Service
 * Manages persistent conversation memory for context-aware AI assistance
 * Part of OmniAssistant - Digital Office Platform (Fas 1)
 */

import { db } from '../../db';
import { conversations, userPreferences, aiInsights, type Conversation, type NewConversation, type UserPreference, type NewUserPreference, type AIInsight, type NewAIInsight } from '../../db/schema-pg';
import { eq, and, desc, gte, or, isNull } from 'drizzle-orm';
import type { MultiModelAIService } from './MultiModelAIService';

export interface ConversationContext {
  contextType: string;
  recentConversations: Conversation[];
  relevantPreferences: UserPreference[];
  activeInsights: AIInsight[];
}

export class ConversationMemoryService {
  private multiModelAI: MultiModelAIService;

  constructor(multiModelAI: MultiModelAIService) {
    this.multiModelAI = multiModelAI;
  }

  /**
   * Store a new conversation with AI-generated summary
   */
  async storeConversation(
    userId: string,
    contextType: string,
    conversationText: string,
    keyPoints?: string[]
  ): Promise<Conversation> {
    // Generate AI summary of the conversation
    const summary = await this.generateConversationSummary(conversationText);

    const newConversation: NewConversation = {
      userId,
      contextType,
      summary,
      keyPoints: keyPoints || [],
      createdAt: new Date(),
      lastReferenced: new Date(),
    };

    const [conversation] = await db.insert(conversations).values(newConversation).returning();

    console.log(`💾 Stored conversation for user ${userId} (context: ${contextType})`);
    return conversation;
  }

  /**
   * Retrieve recent conversations for a specific context
   */
  async getRecentConversations(
    userId: string,
    contextType: string,
    limit: number = 10
  ): Promise<Conversation[]> {
    const results = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.contextType, contextType)))
      .orderBy(desc(conversations.lastReferenced))
      .limit(limit);

    // Update last_referenced timestamp for these conversations
    if (results.length > 0) {
      const ids = results.map(c => c.id);
      await db
        .update(conversations)
        .set({ lastReferenced: new Date() })
        .where(eq(conversations.userId, userId));
    }

    return results;
  }

  /**
   * Get full conversation context for AI assistance
   */
  async getConversationContext(
    userId: string,
    contextType: string = 'general'
  ): Promise<ConversationContext> {
    const [recentConversations, relevantPreferences, activeInsights] = await Promise.all([
      this.getRecentConversations(userId, contextType, 5),
      this.getRelevantPreferences(userId, contextType),
      this.getActiveInsights(userId),
    ]);

    return {
      contextType,
      recentConversations,
      relevantPreferences,
      activeInsights,
    };
  }

  /**
   * Generate AI summary of a conversation
   */
  private async generateConversationSummary(conversationText: string): Promise<string> {
    try {
      const response = await this.multiModelAI.generate({
        prompt: `Summarize this conversation in 1-2 concise sentences, focusing on key topics and decisions:

${conversationText}

Summary:`,
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3,
        maxTokens: 150,
      });

      return response.content.trim();
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      // Fallback: use first 200 characters
      return conversationText.substring(0, 200) + (conversationText.length > 200 ? '...' : '');
    }
  }

  /**
   * Extract key points from conversation using AI
   */
  async extractKeyPoints(conversationText: string): Promise<string[]> {
    try {
      const response = await this.multiModelAI.generate({
        prompt: `Extract 3-5 key points or action items from this conversation. Return as a JSON array of strings.

Conversation:
${conversationText}

Key points (JSON array):`,
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3,
        maxTokens: 300,
      });

      const content = response.content.trim();
      // Try to parse as JSON
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }

      // Fallback: split by newlines
      return content.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
    } catch (error) {
      console.error('Error extracting key points:', error);
      return [];
    }
  }

  // ========== User Preferences ==========

  /**
   * Learn and store user preference
   */
  async learnPreference(
    userId: string,
    preferenceType: string,
    value: any,
    confidenceScore: number = 0.5
  ): Promise<UserPreference> {
    const newPreference: NewUserPreference = {
      userId,
      preferenceType,
      value,
      confidenceScore,
      learnedAt: new Date(),
      lastUpdated: new Date(),
    };

    // Upsert - update if exists, insert if not
    const [preference] = await db
      .insert(userPreferences)
      .values(newPreference)
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.preferenceType],
        set: {
          value,
          confidenceScore,
          lastUpdated: new Date(),
        },
      })
      .returning();

    console.log(`🧠 Learned preference for user ${userId}: ${preferenceType} (confidence: ${confidenceScore})`);
    return preference;
  }

  /**
   * Get relevant preferences for a context
   */
  async getRelevantPreferences(userId: string, contextType: string): Promise<UserPreference[]> {
    // Get preferences relevant to this context
    const preferenceTypes = this.getPreferenceTypesForContext(contextType);

    return await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .orderBy(desc(userPreferences.confidenceScore));
  }

  /**
   * Get all preferences for a user
   */
  async getAllPreferences(userId: string): Promise<UserPreference[]> {
    return await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .orderBy(desc(userPreferences.lastUpdated));
  }

  /**
   * Map context type to relevant preference types
   */
  private getPreferenceTypesForContext(contextType: string): string[] {
    const mapping: Record<string, string[]> = {
      coding: ['coding_style', 'preferred_frameworks', 'testing_approach', 'documentation_level'],
      marketing: ['communication_tone', 'brand_voice', 'content_style', 'target_audience'],
      crm: ['followup_frequency', 'deal_pipeline', 'communication_preferences'],
      analytics: ['chart_preferences', 'reporting_frequency', 'kpi_focus'],
      database: ['db_naming_convention', 'normalization_preference', 'indexing_strategy'],
      general: ['work_hours', 'notification_preferences', 'ui_theme'],
    };

    return mapping[contextType] || [];
  }

  // ========== AI Insights ==========

  /**
   * Generate and store an AI insight
   */
  async generateInsight(
    userId: string,
    insightType: string,
    title: string,
    message: string,
    data?: any,
    priority: number = 1,
    expiresAt?: Date
  ): Promise<AIInsight> {
    const newInsight: NewAIInsight = {
      userId,
      insightType,
      title,
      message,
      data: data || {},
      priority: Math.min(Math.max(priority, 1), 5), // Clamp between 1-5
      dismissed: false,
      actionTaken: false,
      createdAt: new Date(),
      expiresAt,
    };

    const [insight] = await db.insert(aiInsights).values(newInsight).returning();

    console.log(`💡 Generated insight for user ${userId}: ${title} (priority: ${priority})`);
    return insight;
  }

  /**
   * Get active (non-dismissed, non-expired) insights
   */
  async getActiveInsights(userId: string, limit: number = 10): Promise<AIInsight[]> {
    const now = new Date();

    return await db
      .select()
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.userId, userId),
          eq(aiInsights.dismissed, false),
          or(isNull(aiInsights.expiresAt), gte(aiInsights.expiresAt, now))
        )
      )
      .orderBy(desc(aiInsights.priority), desc(aiInsights.createdAt))
      .limit(limit);
  }

  /**
   * Get all insights (including dismissed)
   */
  async getAllInsights(userId: string, limit: number = 50): Promise<AIInsight[]> {
    return await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.userId, userId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(limit);
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(insightId: number): Promise<void> {
    await db.update(aiInsights).set({ dismissed: true }).where(eq(aiInsights.id, insightId));

    console.log(`👎 Dismissed insight ${insightId}`);
  }

  /**
   * Mark insight as actioned
   */
  async markInsightActioned(insightId: number): Promise<void> {
    await db
      .update(aiInsights)
      .set({ actionTaken: true })
      .where(eq(aiInsights.id, insightId));

    console.log(`✅ Marked insight ${insightId} as actioned`);
  }

  /**
   * Clean up old dismissed insights (older than 30 days)
   */
  async cleanupOldInsights(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(aiInsights)
      .where(and(eq(aiInsights.dismissed, true), gte(aiInsights.createdAt, thirtyDaysAgo)));

    console.log(`🧹 Cleaned up old insights`);
    return 0; // Drizzle doesn't return affected rows count easily
  }
}
