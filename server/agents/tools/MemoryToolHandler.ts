/**
 * Memory Tool Handlers
 * 
 * Handles memory operations: remember_fact, recall_memory
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Remember Fact Tool Handler
 */
export class RememberFactToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('remember_fact');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'remember_fact',
      description: 'Remember a fact about the user or their preferences. Use this when the user tells you something important to remember, like preferences, facts about themselves, or information you should recall in future conversations.',
      parameters: {
        type: 'object',
        properties: {
          fact: {
            type: 'string',
            description: 'The fact or information to remember (e.g., "User prefers dark mode", "User\'s favorite programming language is TypeScript")'
          },
          category: {
            type: 'string',
            description: 'Optional category for the fact (e.g., "preferences", "skills", "projects", "personal")'
          }
        },
        required: ['fact']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.rememberFact === 'function') {
          try {
            return await this.agentInstance.rememberFact(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to remember fact: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot remember fact: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.rememberFact === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.rememberFact(enrichedParams);
        return {
          success: result.success !== false,
          data: result,
          error: result.error,
          retryable: false
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true
        };
      }
    }
    
    return {
      success: false,
      error: 'PersonalAssistantAgent instance not available',
      retryable: false
    };
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    return true;
  }

  getDescription(): string {
    return 'Remember facts about the user or their preferences for future conversations.';
  }

  getUsageExamples(): string[] {
    return [
      'Remember that user prefers dark mode',
      'Remember user\'s favorite language is TypeScript',
      'Remember user prefers functional programming'
    ];
  }
}

/**
 * Recall Memory Tool Handler
 */
export class RecallMemoryToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('recall_memory');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'recall_memory',
      description: 'Recall remembered facts about the user. Use this when you need to remember something about the user, their preferences, or past conversations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to recall (e.g., "user preferences", "favorite language", "previous projects")'
          },
          category: {
            type: 'string',
            description: 'Optional category to filter by (e.g., "preferences", "skills", "projects")'
          }
        },
        required: ['query']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.recallMemory === 'function') {
          try {
            return await this.agentInstance.recallMemory(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to recall memory: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot recall memory: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.recallMemory === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.recallMemory(enrichedParams);
        return {
          success: result.success !== false,
          data: result,
          error: result.error,
          retryable: false
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true
        };
      }
    }
    
    return {
      success: false,
      error: 'PersonalAssistantAgent instance not available',
      retryable: false
    };
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    return true;
  }

  getDescription(): string {
    return 'Recall remembered facts about the user or their preferences.';
  }

  getUsageExamples(): string[] {
    return [
      'Recall user preferences',
      'What do I remember about the user?',
      'Recall favorite programming language'
    ];
  }
}

