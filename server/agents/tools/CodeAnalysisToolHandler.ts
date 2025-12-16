/**
 * Code Analysis Tool Handlers
 * 
 * Handles code analysis: analyze_code, check_types, find_errors, suggest_improvements
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Analyze Code Tool Handler
 */
export class AnalyzeCodeToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('analyze_code');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'analyze_code',
      description: 'Analyze code for errors, warnings, and improvements. Use this when the user asks you to analyze code, check for errors, find issues, or review code quality. This performs comprehensive analysis including syntax errors, type errors, security issues, performance problems, and best practices. **When the user mentions a specific file, use read_file first to read it, then use this tool with the filePath parameter to analyze that specific file.**',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to analyze. If the user mentioned a specific file, provide the file path here to analyze that file. If not provided, analyzes all files in the project.'
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
        
        if (this.agentInstance && typeof this.agentInstance.analyzeCode === 'function') {
          try {
            return await this.agentInstance.analyzeCode(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to analyze code: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot analyze code: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.analyzeCode === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.analyzeCode(enrichedParams);
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
    return 'Comprehensive code analysis including errors, warnings, security issues, and best practices.';
  }

  getUsageExamples(): string[] {
    return [
      'Analyze the codebase for issues',
      'Check code quality',
      'Find all errors and warnings'
    ];
  }
}

/**
 * Check Types Tool Handler
 */
export class CheckTypesToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('check_types');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'check_types',
      description: 'Check TypeScript types in code. Use this when the user asks you to check types, verify TypeScript types, or find type errors. This performs TypeScript type checking on the project.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to check. If not provided, checks all TypeScript files in the project.'
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
        
        if (this.agentInstance && typeof this.agentInstance.checkTypes === 'function') {
          try {
            return await this.agentInstance.checkTypes(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to check types: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot check types: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.checkTypes === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.checkTypes(enrichedParams);
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
    return 'Check TypeScript types for type errors.';
  }

  getUsageExamples(): string[] {
    return [
      'Check TypeScript types',
      'Find type errors',
      'Verify types in the project'
    ];
  }
}

/**
 * Find Errors Tool Handler
 */
export class FindErrorsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('find_errors');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'find_errors',
      description: 'Find errors in code. Use this when the user asks you to find errors, check for bugs, or identify problems. This focuses specifically on finding errors (not warnings or suggestions).',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to check. If not provided, checks all files in the project.'
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
        
        if (this.agentInstance && typeof this.agentInstance.findErrors === 'function') {
          try {
            return await this.agentInstance.findErrors(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to find errors: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot find errors: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.findErrors === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.findErrors(enrichedParams);
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
    return 'Find errors in code (not warnings, only actual errors).';
  }

  getUsageExamples(): string[] {
    return [
      'Find all errors',
      'Check for bugs',
      'Identify problems in the code'
    ];
  }
}

/**
 * Suggest Improvements Tool Handler
 */
export class SuggestImprovementsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('suggest_improvements');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'suggest_improvements',
      description: 'Suggest code improvements and refactoring opportunities, including performance improvements, code quality enhancements, and best practices. Use this when the user asks for suggestions, improvements, refactoring ideas, code quality recommendations, or performance improvements (e.g., "ge mig performance förbättringar"). **When the user mentions a specific file, use read_file first to read it, then use this tool with the filePath parameter to get targeted improvements for that file.** This provides actionable suggestions for making code better.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to analyze. If the user mentioned a specific file, provide the file path here to get targeted improvements for that file. If not provided, analyzes all files in the project.'
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
        
        if (this.agentInstance && typeof this.agentInstance.suggestImprovements === 'function') {
          try {
            return await this.agentInstance.suggestImprovements(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to suggest improvements: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot suggest improvements: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.suggestImprovements === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.suggestImprovements(enrichedParams);
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
    return 'Suggest code improvements including performance, quality, and best practices.';
  }

  getUsageExamples(): string[] {
    return [
      'Suggest performance improvements',
      'Get refactoring suggestions',
      'Improve code quality'
    ];
  }
}

