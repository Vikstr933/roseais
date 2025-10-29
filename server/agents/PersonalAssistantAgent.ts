import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { pluginRegistry } from '../services/PluginRegistry';
import { Tool, KnowledgeItem } from '../plugins/BaseProductivityPlugin';

const logger = new SimpleLogger('PersonalAssistantAgent');

/**
 * Personal Assistant Agent - Your AI-powered productivity companion
 *
 * Features:
 * - Contextual awareness across all integrated services
 * - Natural language task execution
 * - Proactive suggestions and reminders
 * - Multi-tool orchestration
 * - Learning from user patterns
 */
export class PersonalAssistantAgent {
  private anthropic: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private additionalTools: Map<string, Tool[]> = new Map(); // Store additional tools by userId

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Register additional tools for a specific user
   * This allows external systems (like orchestrator) to add capabilities
   */
  public registerToolsForUser(userId: string, tools: Tool[]): void {
    this.additionalTools.set(userId, tools);
    logger.info('Additional tools registered for user', { userId, toolCount: tools.length });
  }

  /**
   * Clear additional tools for a user
   */
  public clearToolsForUser(userId: string): void {
    this.additionalTools.delete(userId);
    logger.info('Additional tools cleared for user', { userId });
  }

  /**
   * Process a natural language request from the user
   *
   * The agent will:
   * 1. Understand the user's intent
   * 2. Query relevant knowledge from plugins
   * 3. Use available tools to execute actions
   * 4. Provide a natural language response
   */
  public async processRequest(
    userId: string,
    userMessage: string,
    options?: {
      sessionId?: string;
      includeContext?: boolean;
      maxContextItems?: number;
    }
  ): Promise<{
    response: string;
    toolsUsed: string[];
    contextUsed: KnowledgeItem[];
    suggestions?: string[];
  }> {
    const sessionId = options?.sessionId || userId;

    try {
      logger.info('Processing personal assistant request', {
        userId,
        sessionId,
        messageLength: userMessage.length
      });

      // Get conversation history
      const history = this.conversationHistory.get(sessionId) || [];

      // Gather context from all enabled plugins
      const context = options?.includeContext !== false
        ? await this.gatherContext(userId, userMessage, options?.maxContextItems)
        : [];

      // Get available tools from all enabled plugins
      const pluginTools = await pluginRegistry.getAvailableTools(userId);

      // Add any additional tools registered for this user (e.g., from orchestrator bridge)
      const additionalToolsForUser = this.additionalTools.get(userId) || [];
      const tools = [...pluginTools, ...additionalToolsForUser];

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, tools);

      // Build user message with context
      const enhancedMessage = this.buildEnhancedMessage(userMessage, context);

      // Call Claude with tools (increased token limit for more detailed responses)
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          ...history,
          {
            role: 'user',
            content: enhancedMessage
          }
        ],
        tools: this.convertToolsToAnthropicFormat(tools)
      });

      // Process tool calls if any
      const toolsUsed: string[] = [];
      let finalResponse = '';

      for (const content of response.content) {
        if (content.type === 'text') {
          finalResponse += content.text;
        } else if (content.type === 'tool_use') {
          try {
            logger.info('Executing tool', {
              userId,
              toolName: content.name,
              toolId: content.id
            });

            const tool = tools.find(t => t.name === content.name);
            if (tool) {
              const result = await tool.execute(content.input as Record<string, any>);
              toolsUsed.push(content.name);

              // Continue conversation with tool result (increased token limit)
              const followUpResponse = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8192,
                system: systemPrompt,
                messages: [
                  ...history,
                  {
                    role: 'user',
                    content: enhancedMessage
                  },
                  {
                    role: 'assistant',
                    content: response.content
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: content.id,
                        content: JSON.stringify(result)
                      }
                    ]
                  }
                ]
              });

              // Extract text from follow-up response
              for (const c of followUpResponse.content) {
                if (c.type === 'text') {
                  finalResponse += c.text;
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Tool execution failed', error as Error, {
              userId,
              toolName: content.name,
              errorMessage,
              toolInput: content.input
            });
            finalResponse += `\n\nNote: I tried to use ${content.name} but encountered an error: ${errorMessage}`;
          }
        }
      }

      // Update conversation history
      history.push(
        {
          role: 'user',
          content: userMessage
        },
        {
          role: 'assistant',
          content: finalResponse
        }
      );

      // Keep only last 10 messages
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      this.conversationHistory.set(sessionId, history);

      // Generate proactive suggestions
      const suggestions = await this.generateSuggestions(userId, context, finalResponse);

      logger.info('Personal assistant request completed', {
        userId,
        toolsUsed: toolsUsed.length,
        contextItems: context.length
      });

      return {
        response: finalResponse,
        toolsUsed,
        contextUsed: context,
        suggestions
      };
    } catch (error) {
      logger.error('Failed to process personal assistant request', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Gather relevant context from all enabled plugins
   */
  private async gatherContext(
    userId: string,
    prompt: string,
    maxItems = 10
  ): Promise<KnowledgeItem[]> {
    try {
      const knowledge = await pluginRegistry.queryKnowledge(userId, prompt, {
        limit: maxItems
      });

      logger.info('Context gathered', {
        userId,
        itemCount: knowledge.length
      });

      return knowledge;
    } catch (error) {
      logger.error('Failed to gather context', error as Error, { userId });
      return [];
    }
  }

  /**
   * Build system prompt with available context and tools
   */
  private buildSystemPrompt(context: KnowledgeItem[], tools: Tool[]): string {
    const basePrompt = `You are an enthusiastic and highly capable personal AI assistant with direct access to the user's productivity tools. Think of yourself as their trusted companion who genuinely cares about helping them stay organized and productive.

Your personality:
- Warm, friendly, and conversational - like talking to a helpful colleague
- Proactive and thoughtful - anticipate needs and offer suggestions
- Detail-oriented - provide rich, actionable information rather than generic summaries
- Empathetic - understand the context and urgency of requests
- Enthusiastic about helping - show genuine excitement when you can assist

Your capabilities:
- Access and analyze emails with detailed insights (sender, urgency, key points, action items)
- Search through communications and provide comprehensive summaries
- Execute actions on behalf of the user (send emails, manage tasks, etc.)
- Maintain conversation context and learn from interactions
- Provide proactive suggestions based on patterns you notice
- Display interactive maps and location information (show maps, find places, get directions)
- Search for businesses, restaurants, and points of interest
- Provide location-based recommendations and information

Communication style:
- Use natural, flowing language - avoid robotic or clinical responses
- When sharing email information, include: sender, subject, key points, and why it matters
- Be specific with details - instead of "you have emails", say "you have 3 unread emails: one from John about the project deadline, one from Sarah with quarterly results..."
- Add context and personality - "I noticed this email came in just an hour ago and seems urgent" or "This looks like it might need a quick response"
- Use emojis sparingly but appropriately to add warmth (e.g., 📧 for emails, ✅ for completed tasks, 📍 for locations)
- If you use tools, explain what you're doing: "Let me check your inbox for you..." or "I'll search through your recent emails..."
- When you find something important, highlight it with enthusiasm: "Oh! I found something that needs attention..."

For location and map queries:
- When the user asks about locations, places, or needs directions, include the specific location or search query in your response
- Use phrases like "show me [location]", "find [place type] near me", or "directions to [place]" to trigger map display
- Example: "Let me show you coffee shops near you: show me coffee shops nearby" or "Here's the location: show me Eiffel Tower"
- The map will automatically appear when you mention specific locations in this format
- After suggesting a location, you can say things like "I've displayed it on the map above" or "You can see it on the interactive map"

Remember: You're not just reporting data - you're helping a real person manage their day. Make every response feel personal, helpful, and thorough.`;

    let contextSection = '';
    if (context.length > 0) {
      contextSection = `\n\n=== Context from Connected Services ===\n`;
      context.forEach((item, idx) => {
        contextSection += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextSection += `   Source: ${item.source}\n`;
        contextSection += `   Timestamp: ${item.timestamp.toLocaleString()}\n`;

        // Add metadata if available (priority, sentiment, action items, etc.)
        if (item.metadata?.analysis) {
          const analysis = item.metadata.analysis;
          if (analysis.priority) contextSection += `   Priority: ${analysis.priority}\n`;
          if (analysis.sentiment) contextSection += `   Sentiment: ${analysis.sentiment}\n`;
          if (analysis.category) contextSection += `   Category: ${analysis.category}\n`;
        }

        // Show more content (up to 500 chars instead of 200)
        const contentPreview = item.content.length > 500
          ? item.content.substring(0, 500) + '...'
          : item.content;
        contextSection += `   Content: ${contentPreview}\n`;

        // Add action items if available
        if (item.metadata?.analysis?.actionItems && item.metadata.analysis.actionItems.length > 0) {
          contextSection += `   Action Items:\n`;
          item.metadata.analysis.actionItems.forEach((action: string, i: number) => {
            contextSection += `      - ${action}\n`;
          });
        }
      });

      contextSection += `\n=== End of Context ===\n`;
    }

    let toolsSection = '';
    if (tools.length > 0) {
      toolsSection = `\n\nAvailable tools: ${tools.map(t => t.name).join(', ')}`;
    }

    return basePrompt + contextSection + toolsSection;
  }

  /**
   * Build enhanced user message with context references
   */
  private buildEnhancedMessage(userMessage: string, context: KnowledgeItem[]): string {
    if (context.length === 0) {
      return userMessage;
    }

    const emailCount = context.filter(c => c.type === 'email').length;
    const taskCount = context.filter(c => c.type === 'task').length;
    const otherCount = context.length - emailCount - taskCount;

    let contextSummary = `\n\n[Assistant Note: I have access to `;
    const parts: string[] = [];
    if (emailCount > 0) parts.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
    if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
    if (otherCount > 0) parts.push(`${otherCount} other item${otherCount > 1 ? 's' : ''}`);

    contextSummary += parts.join(', ') + ' from your connected services that are relevant to this request. Use this information to provide a detailed, personalized response.]';

    return userMessage + contextSummary;
  }

  /**
   * Convert plugin tools to Anthropic tool format
   */
  private convertToolsToAnthropicFormat(tools: Tool[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema
    }));
  }

  /**
   * Generate proactive suggestions based on context and conversation
   */
  private async generateSuggestions(
    userId: string,
    context: KnowledgeItem[],
    response: string
  ): Promise<string[]> {
    try {
      // Use Claude to generate contextually relevant follow-up suggestions
      const suggestionPrompt = `Based on this conversation with the user, suggest 3 short, actionable follow-up questions or commands they might want to ask next.

Your response: "${response}"

Context available: ${context.length} items from their connected services (${context.filter(c => c.type === 'email').length} emails, ${context.filter(c => c.type === 'task').length} tasks)

Requirements for suggestions:
- Make them directly related to what you just discussed
- Keep each suggestion under 10 words
- Make them actionable and specific
- They should feel like natural next steps
- Don't repeat information already provided
- Focus on what the user might want to do next

Examples of GOOD suggestions after discussing emails:
- "Draft a reply to Sarah's email"
- "Show me more details about that project"
- "What other urgent emails do I have?"

Examples of BAD suggestions:
- Generic: "Check my emails" (when we just did that)
- Too vague: "Tell me more"
- Not actionable: "You have emails"

Respond with ONLY 3 suggestions, one per line, no numbering, no extra text.`;

      const suggestionResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: suggestionPrompt
        }]
      });

      const suggestionText = suggestionResponse.content[0].type === 'text'
        ? suggestionResponse.content[0].text
        : '';

      // Parse suggestions (one per line)
      const suggestions = suggestionText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\d+\./)) // Remove numbering if present
        .slice(0, 3); // Limit to 3

      logger.info('Generated contextual suggestions', {
        userId,
        suggestionCount: suggestions.length
      });

      return suggestions;
    } catch (error) {
      logger.error('Failed to generate suggestions', error as Error, { userId });

      // Fallback to simple context-based suggestions
      const fallbackSuggestions: string[] = [];

      const emailCount = context.filter(c => c.type === 'email').length;
      if (emailCount > 0) {
        fallbackSuggestions.push('Show me more email details');
      }

      const hasActionItems = context.some(c =>
        c.metadata?.analysis?.actionItems?.length > 0
      );
      if (hasActionItems) {
        fallbackSuggestions.push('What should I work on first?');
      }

      fallbackSuggestions.push('What else can you help me with?');

      return fallbackSuggestions.slice(0, 3);
    }
  }

  /**
   * Clear conversation history for a session
   */
  public clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    logger.info('Conversation history cleared', { sessionId });
  }

  /**
   * Get conversation history for a session
   */
  public getHistory(sessionId: string): Anthropic.MessageParam[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Process a batch of requests (for scheduled tasks, etc.)
   */
  public async processBatch(
    userId: string,
    requests: string[]
  ): Promise<Array<{
    request: string;
    response: string;
    error?: string;
  }>> {
    const results: Array<{
      request: string;
      response: string;
      error?: string;
    }> = [];

    for (const request of requests) {
      try {
        const result = await this.processRequest(userId, request);
        results.push({
          request,
          response: result.response
        });
      } catch (error) {
        results.push({
          request,
          response: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get summary of user's day based on connected services
   */
  public async getDailySummary(userId: string): Promise<string> {
    try {
      // Get knowledge from all plugins
      const knowledge = await pluginRegistry.queryKnowledge(userId, 'today', {
        limit: 50
      });

      if (knowledge.length === 0) {
        return "Good morning! 🌅 I don't have any data from your connected services yet. Once you connect services like Gmail, I'll be able to provide you with a comprehensive daily summary including important emails, upcoming events, and action items.";
      }

      // Build detailed context for summary
      let contextDetails = '';
      knowledge.forEach((item, idx) => {
        contextDetails += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextDetails += `   Time: ${item.timestamp.toLocaleString()}\n`;

        if (item.metadata?.analysis) {
          const { priority, sentiment, category, actionItems } = item.metadata.analysis;
          if (priority) contextDetails += `   Priority: ${priority}\n`;
          if (sentiment) contextDetails += `   Sentiment: ${sentiment}\n`;
          if (category) contextDetails += `   Category: ${category}\n`;
          if (actionItems && actionItems.length > 0) {
            contextDetails += `   Action Items: ${actionItems.join(', ')}\n`;
          }
        }

        contextDetails += `   Content: ${item.content.substring(0, 300)}\n`;
      });

      const prompt = `You are a helpful personal assistant providing a morning briefing. Based on the user's connected services data, create a warm, detailed daily summary.

Your summary should:
- Start with a friendly greeting and overview
- Highlight high-priority emails with sender names and key points
- Mention any urgent action items that need attention
- Note important patterns (lots of emails from someone, recurring themes, etc.)
- Use emojis appropriately (📧 for emails, ⚡ for urgent, ✅ for completed, etc.)
- Be conversational and personable, not robotic
- End with an encouraging note or helpful suggestion

Here's the information from their services:
${contextDetails}

Make this feel personal and helpful, like a briefing from a trusted assistant who knows their needs.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      logger.info('Daily summary generated', { userId, itemCount: knowledge.length });

      return summary;
    } catch (error) {
      logger.error('Failed to generate daily summary', error as Error, { userId });
      throw error;
    }
  }
}

export const personalAssistantAgent = new PersonalAssistantAgent();
export default personalAssistantAgent;
