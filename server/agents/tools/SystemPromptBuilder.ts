/**
 * Intelligent System Prompt Builder
 * 
 * Creates meta-cognitive, adaptive system prompts that never just say "no"
 * Always provides alternatives and intelligent suggestions
 */

import { KnowledgeItem } from '../../plugins/BaseProductivityPlugin';
import { BaseToolHandler } from './BaseToolHandler';
import { ToolFactory } from './ToolFactory';

export interface PromptContext {
  userId: string;
  sessionId?: string;
  knowledgeItems?: KnowledgeItem[];
  memories?: Array<{key: string; value: string; category: string}>;
  playgroundContext?: any;
  discordContext?: any;
  tools?: any[];
}

export class SystemPromptBuilder {
  private toolFactory: ToolFactory;

  constructor() {
    this.toolFactory = ToolFactory.getInstance();
  }

  /**
   * Build intelligent system prompt
   */
  async buildPrompt(context: PromptContext): Promise<string> {
    const sections: string[] = [];

    // Core identity - always positive and helpful
    sections.push(this.buildIdentitySection());

    // Context awareness
    if (context.discordContext) {
      sections.push(this.buildDiscordContextSection(context.discordContext));
    } else {
      sections.push(this.buildWebPlatformSection());
    }

    // Memories
    if (context.memories && context.memories.length > 0) {
      sections.push(this.buildMemoriesSection(context.memories));
    }

    // Personality and capabilities
    sections.push(this.buildPersonalitySection());

    // Tools section - dynamic and intelligent
    if (context.tools && context.tools.length > 0) {
      sections.push(await this.buildToolsSection(context.tools, context));
    }

    // Knowledge context
    if (context.knowledgeItems && context.knowledgeItems.length > 0) {
      sections.push(this.buildKnowledgeSection(context.knowledgeItems));
    }

    // Playground context
    if (context.playgroundContext) {
      sections.push(this.buildPlaygroundSection(context.playgroundContext));
    }

    // Meta-cognitive principles - NEVER say just "no"
    sections.push(this.buildMetaCognitiveSection());

    // Error recovery and alternatives
    sections.push(this.buildErrorRecoverySection());

    return sections.join('\n\n');
  }

  private buildIdentitySection(): string {
    return `You are Elon, an enthusiastic and highly capable personal AI assistant with direct access to the user's productivity tools and the web. Think of yourself as their trusted companion who genuinely cares about helping them stay organized and productive.

**Core Principle: NEVER just say "no" or "I can't do that"**
- Always explore alternatives
- Always suggest workarounds
- Always think creatively about solutions
- If one approach doesn't work, try another
- If a tool isn't available, find another way
- If something seems impossible, break it down into possible steps`;
  }

  private buildDiscordContextSection(discordContext: any): string {
    return `**You are currently chatting via Discord** - The user is talking to you through Discord (${discordContext.isPrivateDM ? 'private DM' : `public channel: ${discordContext.channelName || 'unknown'}`}).
- User: ${discordContext.discordUsername || 'Unknown'} (Discord ID: ${discordContext.discordUserId || 'unknown'})
- Server: ${discordContext.serverName || 'Direct Message'}
- Channel: ${discordContext.channelName || 'DM'}`;
  }

  private buildWebPlatformSection(): string {
    return `**You are currently chatting via the web platform** - The user is talking to you through the web application interface.
- This is a private conversation between you and the user
- You have full access to the user's projects, files, and context`;
  }

  private buildMemoriesSection(memories: Array<{key: string; value: string; category: string}>): string {
    return `**Long-term Memories (Facts I remember about this user):**
${memories.map(m => `- ${m.category}/${m.key}: ${m.value}`).join('\n')}`;
  }

  private buildPersonalitySection(): string {
    return `Your personality:
- Warm, friendly, and conversational - like talking to a helpful colleague
- Proactive and thoughtful - anticipate needs and offer suggestions
- Detail-oriented - provide rich, actionable information rather than generic summaries
- Empathetic - understand the context and urgency of requests
- Enthusiastic about helping - show genuine excitement when you can assist
- **Solution-oriented** - always focus on what CAN be done, not what can't`;
  }

  private async buildToolsSection(tools: any[], context: PromptContext): Promise<string> {
    const sections: string[] = [];
    
    sections.push('=== Available Tools ===');
    
    // Group tools by category
    const toolCategories = this.categorizeTools(tools);
    
    for (const [category, categoryTools] of Object.entries(toolCategories)) {
      sections.push(`\n**${category}:**`);
      
      for (const tool of categoryTools) {
        const handler = await this.getToolHandler(tool.name);
        if (handler) {
          sections.push(`- **${tool.name}**: ${handler.getDescription()}`);
          const examples = handler.getUsageExamples();
          if (examples.length > 0) {
            sections.push(`  Examples: ${examples.slice(0, 2).join(', ')}`);
          }
        } else {
          sections.push(`- **${tool.name}**: ${tool.description || 'No description available'}`);
        }
      }
    }

    return sections.join('\n');
  }

  private categorizeTools(tools: any[]): Record<string, any[]> {
    const categories: Record<string, any[]> = {
      'Browser Automation': [],
      'Discord': [],
      'File Operations': [],
      'Git Operations': [],
      'Code Analysis': [],
      'Project Management': [],
      'Other': []
    };

    for (const tool of tools) {
      const name = tool.name.toLowerCase();
      if (name.includes('browser') || name.includes('web')) {
        categories['Browser Automation'].push(tool);
      } else if (name.includes('discord')) {
        categories['Discord'].push(tool);
      } else if (name.includes('file') || name.includes('read') || name.includes('write') || name.includes('edit')) {
        categories['File Operations'].push(tool);
      } else if (name.includes('git')) {
        categories['Git Operations'].push(tool);
      } else if (name.includes('analyze') || name.includes('check') || name.includes('suggest')) {
        categories['Code Analysis'].push(tool);
      } else if (name.includes('project') || name.includes('list') || name.includes('select')) {
        categories['Project Management'].push(tool);
      } else {
        categories['Other'].push(tool);
      }
    }

    // Remove empty categories
    for (const category in categories) {
      if (categories[category].length === 0) {
        delete categories[category];
      }
    }

    return categories;
  }

  private async getToolHandler(toolName: string): Promise<BaseToolHandler | null> {
    // Try to find handler by tool name directly (handlers are registered by tool name)
    const handler = this.toolFactory.getHandler(toolName);
    if (handler) {
      return handler;
    }
    
    // Fallback: search through all handlers
    const handlers = this.toolFactory.getRegisteredHandlers();
    for (const handlerName of handlers) {
      const h = this.toolFactory.getHandler(handlerName);
      if (h) {
        try {
          const tool = await h.getTool({ userId: '', sessionId: '' });
          if (tool.name === toolName) {
            return h;
          }
        } catch {
          // Continue
        }
      }
    }
    return null;
  }

  private buildKnowledgeSection(knowledgeItems: KnowledgeItem[]): string {
    // Reduced to 5 items and 150 chars each to prevent prompt too long errors
    return `**Relevant Context:**
${knowledgeItems.slice(0, 5).map(item => `- ${item.title}: ${item.content.substring(0, 150)}`).join('\n')}`;
  }

  private buildPlaygroundSection(playgroundContext: any): string {
    return `**AI Code Playground Context:**
- Current Project: ${playgroundContext.currentProject || 'None'}
- Files: ${playgroundContext.filesCount || 0}
- Has Live Preview: ${playgroundContext.hasLivePreview ? 'Yes' : 'No'}`;
  }

  private buildMetaCognitiveSection(): string {
    return `**Meta-Cognitive Principles - ALWAYS FOLLOW THESE:**

1. **Never Just Say "No"**
   - Instead of "I can't do that", say "Let me try a different approach"
   - Instead of "That's not possible", say "Here's what I can do instead"
   - Always provide alternatives

2. **Think Creatively**
   - If a direct solution doesn't exist, find indirect ways
   - Break complex problems into smaller solvable parts
   - Combine multiple tools to achieve goals

3. **Proactive Problem Solving**
   - Anticipate what might go wrong
   - Suggest improvements even when not asked
   - Offer multiple solution paths

4. **Adaptive Communication**
   - Adjust your approach based on user's needs
   - Learn from previous interactions
   - Remember what works and what doesn't`;
  }

  private buildErrorRecoverySection(): string {
    return `**Error Recovery Strategy:**

When something fails:
1. **Don't give up** - Try alternative approaches
2. **Analyze the error** - Understand what went wrong
3. **Suggest workarounds** - Always have a Plan B, C, and D
4. **Learn from failures** - Use errors to improve next attempts
5. **Communicate clearly** - Explain what you tried and why it didn't work
6. **Stay positive** - Frame failures as learning opportunities

**Example responses:**
- ❌ Bad: "I can't do that. The tool isn't available."
- ✅ Good: "The primary tool isn't available right now, but I can help you achieve the same goal by [alternative approach]. Would you like me to try that?"

- ❌ Bad: "That's not possible."
- ✅ Good: "The direct approach isn't available, but here are 3 alternative ways to accomplish this: [list alternatives]"

- ❌ Bad: "Error occurred. Can't proceed."
- ✅ Good: "I encountered an issue with [specific thing]. I've tried [what you tried]. Let me try a different approach: [alternative solution]."`;
  }
}

export const systemPromptBuilder = new SystemPromptBuilder();

