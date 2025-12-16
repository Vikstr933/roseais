/**
 * Code Generation Tool Handler
 * 
 * Handles code generation: generate_code
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Generate Code Tool Handler
 */
export class GenerateCodeToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('generate_code');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'generate_code',
      description: `Generate code for applications in the playground. Supports multiple languages:
- **React/TypeScript**: Full WebContainer preview with hot reload
- **Python Scripts**: Browser-based preview using Pyodide (WebAssembly)
- **Python Web Apps (Flask/Django/FastAPI/Streamlit)**: Server-side sandbox preview with live URL
- **Node.js**: WebContainer preview

Use this tool when: (1) User asks to create an app, build a feature, generate code, or make changes to their project. (2) **CRITICAL: User asks to start, restart, or stop the dev server** - use this tool with prompt like "start the dev server" or "restart the dev server". 

**Python Support**: When user asks for Python apps:
- Simple scripts (data processing, algorithms, etc.) → Generates .py files, runs in browser via Pyodide
- Web apps (Flask, FastAPI, Django, Streamlit) → Generates .py files + requirements.txt, runs on server sandbox
- Preview auto-detects project type and uses appropriate runtime

If no projectId is provided, will use the currently selected project from the conversation.`,
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of what code to generate (e.g., "Create an iPhone homescreen app" or "Build a Flask API with user authentication" or "Create a Python data analysis script")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to generate code for. If not provided, will use the currently selected project from the conversation (set via select_project tool).'
          },
          language: {
            type: 'string',
            description: 'Optional: Target language/framework (react, python, flask, fastapi, django, node). Auto-detected from prompt if not specified.'
          }
        },
        required: ['prompt']
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.generateCode === 'function') {
          try {
            return await this.agentInstance.generateCode(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot generate code: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.generateCode === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.generateCode(enrichedParams);
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
    return 'Generate code for applications supporting React/TypeScript, Python, Node.js with live preview.';
  }

  getUsageExamples(): string[] {
    return [
      'Create an iPhone homescreen app',
      'Build a Flask API with authentication',
      'Generate a React component',
      'Start the dev server'
    ];
  }
}

