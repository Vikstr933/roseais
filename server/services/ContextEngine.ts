/**
 * Context Engine
 * Analyzes user's current location, activity, and provides context-aware assistance
 * Part of OmniAssistant - Digital Office Platform (Fas 1)
 */

import type { ConversationMemoryService } from './ConversationMemoryService';
import type { ProjectService } from './ProjectService';
import { db } from '../../db';
import { workspaces, codeGenerationSessions, chatMessages } from '../../db/schema-pg';
import { eq, desc } from 'drizzle-orm';

export interface UserContext {
  userId: string;
  currentPage: string; // e.g., '/playground', '/marketing', '/crm'
  contextType: string; // e.g., 'coding', 'marketing', 'crm'
  currentWorkspace?: {
    id: number;
    name: string;
    type: string;
  };
  recentActivity: ActivityRecord[];
  suggestedActions: string[];
  relevantData: any;
}

export interface ActivityRecord {
  type: string; // 'code_generation', 'chat_message', 'deployment', etc.
  timestamp: Date;
  description: string;
  metadata?: any;
}

export class ContextEngine {
  private conversationMemory: ConversationMemoryService;
  private projectService: ProjectService;

  constructor(conversationMemory: ConversationMemoryService, projectService: ProjectService) {
    this.conversationMemory = conversationMemory;
    this.projectService = projectService;
  }

  /**
   * Analyze user's current context and build comprehensive context object
   */
  async analyzeContext(
    userId: string,
    currentPage: string,
    workspaceId?: number
  ): Promise<UserContext> {
    const contextType = this.mapPageToContextType(currentPage);

    // Gather context in parallel
    const [currentWorkspace, recentActivity, conversationContext] = await Promise.all([
      workspaceId ? this.getCurrentWorkspace(workspaceId) : Promise.resolve(undefined),
      this.getRecentActivity(userId, 10),
      this.conversationMemory.getConversationContext(userId, contextType),
    ]);

    // Generate suggested actions based on context
    const suggestedActions = await this.generateSuggestedActions(
      contextType,
      recentActivity,
      conversationContext
    );

    // Gather relevant data based on context type
    const relevantData = await this.gatherRelevantData(userId, contextType, workspaceId);

    return {
      userId,
      currentPage,
      contextType,
      currentWorkspace,
      recentActivity,
      suggestedActions,
      relevantData,
    };
  }

  /**
   * Map current page/route to context type
   */
  private mapPageToContextType(page: string): string {
    const mappings: Record<string, string> = {
      '/playground': 'coding',
      '/workspaces': 'coding',
      '/projects': 'coding',
      '/editor': 'coding',
      '/marketing': 'marketing',
      '/crm': 'crm',
      '/analytics': 'analytics',
      '/database': 'database',
      '/guidance': 'guidance',
      '/settings': 'general',
    };

    // Find matching prefix
    for (const [prefix, type] of Object.entries(mappings)) {
      if (page.startsWith(prefix)) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * Get current workspace details
   */
  private async getCurrentWorkspace(
    workspaceId: number
  ): Promise<{ id: number; name: string; type: string } | undefined> {
    const [workspace] = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        type: workspaces.projectType,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return workspace;
  }

  /**
   * Get recent user activity
   */
  private async getRecentActivity(userId: string, limit: number): Promise<ActivityRecord[]> {
    const activities: ActivityRecord[] = [];

    // Get recent code generations
    const recentGenerations = await db
      .select({
        id: codeGenerationSessions.id,
        title: codeGenerationSessions.title,
        createdAt: codeGenerationSessions.createdAt,
        status: codeGenerationSessions.status,
      })
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.userId, userId))
      .orderBy(desc(codeGenerationSessions.createdAt))
      .limit(limit);

    for (const gen of recentGenerations) {
      activities.push({
        type: 'code_generation',
        timestamp: gen.createdAt || new Date(),
        description: `Generated: ${gen.title}`,
        metadata: { id: gen.id, status: gen.status },
      });
    }

    // Get recent chat messages
    const recentChats = await db
      .select({
        id: chatMessages.id,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        projectId: chatMessages.projectId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    for (const chat of recentChats) {
      activities.push({
        type: 'chat_message',
        timestamp: chat.createdAt || new Date(),
        description: `Chat: ${chat.content?.substring(0, 50)}...`,
        metadata: { id: chat.id, projectId: chat.projectId },
      });
    }

    // Sort by timestamp descending and limit
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  /**
   * Generate suggested actions based on context
   */
  private async generateSuggestedActions(
    contextType: string,
    recentActivity: ActivityRecord[],
    conversationContext: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Context-specific suggestions
    switch (contextType) {
      case 'coding':
        suggestions.push('Generate a new component');
        suggestions.push('Review recent code');
        if (recentActivity.some(a => a.type === 'code_generation' && a.metadata?.status === 'failed')) {
          suggestions.push('Fix failed generation');
        }
        break;

      case 'marketing':
        suggestions.push('Create a marketing campaign');
        suggestions.push('Generate blog post');
        suggestions.push('Analyze campaign performance');
        break;

      case 'crm':
        suggestions.push('Add new lead');
        suggestions.push('Review pipeline');
        suggestions.push('Follow up with customers');
        break;

      case 'analytics':
        suggestions.push('View performance dashboard');
        suggestions.push('Generate report');
        suggestions.push('Analyze trends');
        break;

      case 'database':
        suggestions.push('Design database schema');
        suggestions.push('Create migration');
        suggestions.push('Optimize queries');
        break;

      case 'guidance':
        suggestions.push('Get business advice');
        suggestions.push('Brainstorm ideas');
        suggestions.push('Market research');
        break;

      default:
        suggestions.push('Explore features');
        suggestions.push('Get help');
    }

    // Add insights-based suggestions
    if (conversationContext.activeInsights && conversationContext.activeInsights.length > 0) {
      const topInsight = conversationContext.activeInsights[0];
      suggestions.unshift(`Check insight: ${topInsight.title}`);
    }

    return suggestions.slice(0, 5); // Max 5 suggestions
  }

  /**
   * Gather relevant data based on context type
   */
  private async gatherRelevantData(
    userId: string,
    contextType: string,
    workspaceId?: number
  ): Promise<any> {
    const data: any = {};

    switch (contextType) {
      case 'coding':
        if (workspaceId) {
          // Get workspace files
          const files = await this.projectService.getProjectFiles(workspaceId);
          data.files = files;
          data.fileCount = files.length;
        }

        // Get recent generations
        const recentGens = await db
          .select()
          .from(codeGenerationSessions)
          .where(eq(codeGenerationSessions.userId, userId))
          .orderBy(desc(codeGenerationSessions.createdAt))
          .limit(5);

        data.recentGenerations = recentGens;
        break;

      case 'marketing':
        // TODO: When marketing tables are added, fetch campaign data
        data.campaigns = [];
        data.content = [];
        break;

      case 'crm':
        // TODO: When CRM tables are added, fetch contacts and deals
        data.contacts = [];
        data.deals = [];
        break;

      case 'analytics':
        // TODO: When analytics tables are added, fetch metrics
        data.metrics = {};
        data.insights = [];
        break;

      default:
        break;
    }

    return data;
  }

  /**
   * Get context-aware help message
   */
  getContextualHelp(contextType: string): string {
    const helpMessages: Record<string, string> = {
      coding: 'I can help you generate React components, fix bugs, refactor code, and deploy your projects. What would you like to build?',
      marketing: 'I can create marketing campaigns, generate content for social media, write blog posts, and optimize your SEO. How can I help with your marketing?',
      crm: 'I can help you manage leads, track deals, analyze your sales pipeline, and suggest follow-up actions. What do you need help with?',
      analytics: 'I can create custom dashboards, generate reports, analyze trends, and provide data-driven insights. What would you like to analyze?',
      database: 'I can design database schemas, create migrations, optimize queries, and help with data modeling. What database task are you working on?',
      guidance: 'I can provide business advice, help with strategic planning, conduct market research, and brainstorm ideas. What guidance do you need?',
      general: 'I\'m your AI assistant! I can help with coding, marketing, CRM, analytics, databases, and business guidance. What can I do for you today?',
    };

    return helpMessages[contextType] || helpMessages.general;
  }

  /**
   * Detect if user needs proactive help
   */
  async detectNeedForHelp(userId: string, recentActivity: ActivityRecord[]): Promise<boolean> {
    // Check for repeated failures
    const recentFailures = recentActivity.filter(
      a => a.metadata?.status === 'failed' || a.metadata?.error
    );

    if (recentFailures.length >= 3) {
      // User is stuck, offer help
      await this.conversationMemory.generateInsight(
        userId,
        'suggestion',
        'Need help?',
        'I noticed you\'ve encountered some issues. Would you like me to help troubleshoot?',
        { failures: recentFailures.map(f => f.description) },
        3 // Medium priority
      );
      return true;
    }

    // Check for inactivity (TODO: when we have last_active tracking)

    return false;
  }
}
