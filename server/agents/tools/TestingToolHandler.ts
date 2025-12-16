/**
 * Testing Tool Handlers
 * 
 * Handles testing operations: generate_tests, run_tests, test_coverage
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Generate Tests Tool Handler
 */
export class GenerateTestsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('generate_tests');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'generate_tests',
      description: 'Generate tests for code. Use this when the user asks you to create tests, write tests, or generate test files. This will create unit, integration, or E2E tests depending on the test type specified.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to generate tests for. If not provided, generates tests for all files in the project.'
          },
          testType: {
            type: 'string',
            enum: ['unit', 'integration', 'e2e'],
            description: 'Type of tests to generate: unit (individual functions/components), integration (component interactions), or e2e (end-to-end user flows). Default: unit.'
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
        
        if (this.agentInstance && typeof this.agentInstance.generateTests === 'function') {
          try {
            return await this.agentInstance.generateTests(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot generate tests: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.generateTests === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.generateTests(enrichedParams);
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
    return 'Generate unit, integration, or E2E tests for code.';
  }

  getUsageExamples(): string[] {
    return [
      'Generate unit tests for App.tsx',
      'Create integration tests',
      'Generate E2E tests for the login flow'
    ];
  }
}

/**
 * Run Tests Tool Handler
 */
export class RunTestsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('run_tests');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'run_tests',
      description: 'Run tests in a project. Use this when the user asks you to run tests, execute tests, or check if tests pass. This will execute the test suite and return results.',
      parameters: {
        type: 'object',
        properties: {
          testPath: {
            type: 'string',
            description: 'Optional specific test file path to run. If not provided, runs all tests.'
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
        
        if (this.agentInstance && typeof this.agentInstance.runTests === 'function') {
          try {
            return await this.agentInstance.runTests(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot run tests: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.runTests === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.runTests(enrichedParams);
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
    return 'Run tests and get test results.';
  }

  getUsageExamples(): string[] {
    return [
      'Run all tests',
      'Run tests for App.test.tsx',
      'Execute the test suite'
    ];
  }
}

/**
 * Test Coverage Tool Handler
 */
export class TestCoverageToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('test_coverage');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'test_coverage',
      description: 'Get test coverage report. Use this when the user asks about test coverage, coverage percentage, or wants to see how much of the code is tested.',
      parameters: {
        type: 'object',
        properties: {
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
        
        if (this.agentInstance && typeof this.agentInstance.getTestCoverage === 'function') {
          try {
            return await this.agentInstance.getTestCoverage(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to get test coverage: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot get test coverage: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.getTestCoverage === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.getTestCoverage(enrichedParams);
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
    return 'Get test coverage report showing how much code is tested.';
  }

  getUsageExamples(): string[] {
    return [
      'Get test coverage',
      'Show coverage percentage',
      'What is the test coverage?'
    ];
  }
}

