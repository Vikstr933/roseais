/**
 * Project Management Tool Handlers
 * 
 * Handles project management: list_projects, select_project
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * List Projects Tool Handler
 */
export class ListProjectsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('list_projects');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'list_projects',
      description: 'List all projects that the user has access to, including both platform projects and GitHub repositories (if GitHub is connected). Use this when the user asks about their projects, what projects they can work on, or wants to see available projects. This will show project names, descriptions, file counts, and indicate which are platform projects (can be previewed) vs GitHub repos (cannot be previewed but can be worked on via API).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.listProjects === 'function') {
          try {
            return await this.agentInstance.listProjects(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot list projects: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.listProjects === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.listProjects(enrichedParams);
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
    return 'List all projects the user has access to, including platform projects and GitHub repos.';
  }

  getUsageExamples(): string[] {
    return [
      'List all my projects',
      'What projects can I work on?',
      'Show me my available projects'
    ];
  }
}

/**
 * Select Project Tool Handler
 */
export class SelectProjectToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('select_project');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'select_project',
      description: 'Select a project to work on. Use this when the user explicitly chooses a project by name or number (e.g., "Låt oss arbeta på projekt 2" or "Välj Projekt X"). This sets the active project for the conversation, so subsequent code generation will use this project. Always use this tool when the user chooses a specific project to work on.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project to select (e.g., "Projekt 2", "iPhone 16 App Nr.1")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If provided, will use this directly. Otherwise, will search for project by name.'
          }
        },
        required: ['projectName']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.selectProject === 'function') {
          try {
            return await this.agentInstance.selectProject(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to select project: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot select project: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.selectProject === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.selectProject(enrichedParams);
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
    return 'Select a project to work on by name or ID.';
  }

  getUsageExamples(): string[] {
    return [
      'Select project "Projekt 2"',
      'Work on iPhone 16 App',
      'Choose the first project'
    ];
  }
}

