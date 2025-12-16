/**
 * Documentation Tool Handler
 * 
 * Handles documentation generation: generate_docs
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Generate Docs Tool Handler
 */
export class GenerateDocsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('generate_docs');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'generate_docs',
      description: 'Generate documentation for code. Use this when the user asks you to create documentation, write README, generate API docs, or document code. This will create comprehensive documentation including README, code comments, and API documentation.',
      parameters: {
        type: 'object',
        properties: {
          docType: {
            type: 'string',
            enum: ['readme', 'api', 'code-comments', 'all'],
            description: 'Type of documentation to generate: readme (README.md), api (API documentation), code-comments (JSDoc comments), or all (everything). Default: all.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.generateDocs === 'function') {
          try {
            return await this.agentInstance.generateDocs(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot generate documentation: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.generateDocs === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.generateDocs(enrichedParams);
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
    return 'Generate documentation including README, API docs, and code comments.';
  }

  getUsageExamples(): string[] {
    return [
      'Generate README for the project',
      'Create API documentation',
      'Generate all documentation'
    ];
  }
}

