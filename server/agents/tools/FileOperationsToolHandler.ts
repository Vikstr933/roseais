/**
 * File Operations Tool Handler
 * 
 * Handles file read, write, edit, delete, and directory operations
 * This handler delegates to PersonalAssistantAgent's existing methods
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

export class FileOperationsToolHandler extends BaseToolHandler {
  private agentInstance: any; // PersonalAssistantAgent instance

  constructor(agentInstance?: any) {
    super('file_operations');
    this.agentInstance = agentInstance;
  }

  /**
   * Get all file operation tools
   */
  async getTool(context: ToolContext): Promise<Tool> {
    // This handler provides multiple tools, so we return a composite tool
    // In practice, we'll register separate handlers for each operation
    throw new Error('FileOperationsToolHandler should not be used directly. Use specific handlers like ReadFileToolHandler.');
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    throw new Error('FileOperationsToolHandler should not be used directly');
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    return true;
  }

  getDescription(): string {
    return 'File operations handler';
  }

  getUsageExamples(): string[] {
    return [];
  }
}

/**
 * Read File Tool Handler
 */
export class ReadFileToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('read_file');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'read_file',
      description: 'Read and analyze a specific file from a project. **CRITICAL: Use this tool FIRST whenever the user mentions a specific file by name (e.g., "look at xxxx.lua", "check the App.tsx file", "review config.json").** After reading the file, you can then use other tools like suggest_improvements, analyze_code, or provide direct analysis based on what the user asked for (e.g., performance improvements, bug fixes, refactoring suggestions). You can read any file in the project by its path.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to read (e.g., "src/App.tsx", "src/components/Button.tsx", "package.json", "data/script.lua"). Extract the file path from the user\'s message if they mention a specific file.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          },
          analyze: {
            type: 'boolean',
            description: 'If true, provide analysis of the code including potential issues, improvements, and explanations. Default: true.'
          }
        },
        required: ['filePath']
      },
      execute: async (params: Record<string, any>) => {
        // Params should already have _userId and _sessionId from PersonalAssistantAgent
        // But we'll use context as fallback if not present
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.readFile === 'function') {
          try {
            const result = await this.agentInstance.readFile(enrichedParams);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        // Fallback: return error
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot read file: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.readFile === 'function') {
      const enrichedParams = {
        ...params,
        _userId: context.userId,
        _sessionId: context.sessionId
      };
      
      try {
        const result = await this.agentInstance.readFile(enrichedParams);
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
    return 'Read and analyze files from projects. Use this first when user mentions a specific file.';
  }

  getUsageExamples(): string[] {
    return [
      'Read the App.tsx file',
      'Check the config.json file',
      'Look at script.lua file'
    ];
  }
}

/**
 * Write File Tool Handler
 */
export class WriteFileToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('write_file');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'write_file',
      description: 'Create a new file or completely replace an existing file. Use this when the user asks you to create a new file, write content to a file, or completely rewrite a file. Example: "Create a new Button component" or "Write a utils.ts file with helper functions".',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The full path to the file (e.g., "src/components/Button.tsx", "utils/helpers.ts", "package.json")'
          },
          content: {
            type: 'string',
            description: 'The complete content of the file'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath', 'content']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.writeFile === 'function') {
          try {
            return await this.agentInstance.writeFile(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot write file: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.writeFile === 'function') {
      const enrichedParams = {
        ...params,
        _userId: context.userId,
        _sessionId: context.sessionId
      };
      
      try {
        const result = await this.agentInstance.writeFile(enrichedParams);
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
    return 'Create new files or completely replace existing files.';
  }

  getUsageExamples(): string[] {
    return [
      'Create a new Button component',
      'Write a utils.ts file',
      'Create package.json'
    ];
  }
}

/**
 * Edit File Tool Handler
 */
export class EditFileToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('edit_file');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'edit_file',
      description: 'Edit specific parts of an existing file. Use this when the user asks you to modify, change, or update specific parts of a file (e.g., "change the button color", "update the function", "modify the onClick handler"). This is perfect for targeted changes without rewriting the entire file. Example: "Change the button color to blue" → use edit_file to modify just the color property.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The full path to the file to edit'
          },
          changes: {
            type: 'string',
            description: 'Description of what to change (e.g., "replace the button color with blue", "update the function name from oldName to newName")'
          },
          newContent: {
            type: 'string',
            description: 'The new content to replace the old content with'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath', 'changes', 'newContent']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.editFile === 'function') {
          try {
            return await this.agentInstance.editFile(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot edit file: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.editFile === 'function') {
      const enrichedParams = {
        ...params,
        _userId: context.userId,
        _sessionId: context.sessionId
      };
      
      try {
        const result = await this.agentInstance.editFile(enrichedParams);
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
    return 'Edit specific parts of existing files. Use for targeted changes.';
  }

  getUsageExamples(): string[] {
    return [
      'Change the button color to blue',
      'Update the function name',
      'Modify the onClick handler'
    ];
  }
}

/**
 * Delete File Tool Handler
 */
export class DeleteFileToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('delete_file');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'delete_file',
      description: 'Delete a file from a project. Use this when the user explicitly asks you to remove or delete a file. Always confirm with the user before deleting important files.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The full path to the file to delete'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.deleteFile === 'function') {
          try {
            return await this.agentInstance.deleteFile(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot delete file: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.deleteFile === 'function') {
      const enrichedParams = {
        ...params,
        _userId: context.userId,
        _sessionId: context.sessionId
      };
      
      try {
        const result = await this.agentInstance.deleteFile(enrichedParams);
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
    return 'Delete files from projects. Always confirm before deleting important files.';
  }

  getUsageExamples(): string[] {
    return [
      'Delete the old config file',
      'Remove unused component',
      'Delete test file'
    ];
  }
}

/**
 * Create Directory Tool Handler
 */
export class CreateDirectoryToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('create_directory');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'create_directory',
      description: 'Create a new directory (folder) in a project. Use this when the user asks you to create a new folder or directory structure.',
      parameters: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'The full path to the directory to create (e.g., "src/components", "utils/helpers")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['directoryPath']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.createDirectory === 'function') {
          try {
            return await this.agentInstance.createDirectory(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot create directory: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.createDirectory === 'function') {
      const enrichedParams = {
        ...params,
        _userId: context.userId,
        _sessionId: context.sessionId
      };
      
      try {
        const result = await this.agentInstance.createDirectory(enrichedParams);
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
    return 'Create new directories in projects.';
  }

  getUsageExamples(): string[] {
    return [
      'Create src/components directory',
      'Create utils/helpers folder',
      'Create new directory structure'
    ];
  }
}
