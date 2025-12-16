/**
 * Browser Use Tool Handler
 * 
 * Handles browser automation using Playwright
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';
import { browserUseService } from '../../services/BrowserUseService';

export class BrowserUseToolHandler extends BaseToolHandler {
  constructor() {
    super('browser_use');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'browser_use',
      description: '**CRITICAL TOOL FOR WEB AUTOMATION - READY TO USE NOW** - Automate web browser interactions using Playwright. **YOU MUST USE THIS TOOL** when the user asks you to: interact with websites, fill forms, create accounts (e.g., "skapa ett konto på retrotales.online", "create an account on retrotales.online"), click buttons, navigate pages, register on websites, or perform ANY web automation tasks. **This tool is INSTALLED and READY - DO NOT say it needs to be installed or that you cannot do this - you HAVE this tool and it works NOW!** This tool uses Playwright (already installed) to navigate to URLs, fill in forms, click buttons, extract information, and perform complex web interactions. It uses AI to understand page structure and automatically fill forms. **When user asks to create an account or interact with a website, you MUST use this tool immediately - it is ready and working.** Examples: "create an account on retrotales.online" → use browser_use NOW, "fill in the registration form" → use browser_use NOW, "click the login button" → use browser_use NOW.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the website to interact with (e.g., "https://retrotales.online", "https://example.com/register")'
          },
          task: {
            type: 'string',
            description: 'Natural language description of what to do on the website (e.g., "create an account with email test@example.com and password mypass123", "fill in the registration form", "click the sign up button", "navigate to the login page and fill in credentials")'
          },
          headless: {
            type: 'boolean',
            description: 'Whether to run the browser in headless mode (default: true). Set to false to see the browser window (useful for debugging).'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 60000 = 60 seconds). Increase for complex tasks.'
          },
          screenshot: {
            type: 'boolean',
            description: 'Whether to take a screenshot after completing the task (default: false)'
          }
        },
        required: ['url', 'task']
      },
      execute: async (params: Record<string, any>) => {
        return await this.execute(params, context);
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const url = params.url as string;
    const task = params.task as string;

    if (!url || !task) {
      return {
        success: false,
        error: 'URL and task are required',
        retryable: false
      };
    }

    try {
      const result = await browserUseService.executeTask({
        url,
        task,
        options: {
          headless: params.headless !== false,
          timeout: params.timeout,
          screenshot: params.screenshot === true
        }
      });

      if (result.success) {
        return {
          success: true,
          data: {
            message: result.output,
            screenshot: result.screenshot,
            extractedData: result.extractedData
          }
        };
      }

      return {
        success: false,
        error: result.error || 'Browser automation failed',
        retryable: true,
        fallbackSuggestion: 'The browser automation encountered an issue. You could try: 1) Check if the website is accessible, 2) Verify the URL is correct, 3) Try again with a longer timeout'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    try {
      return await browserUseService.isAvailable();
    } catch {
      return false;
    }
  }

  getDescription(): string {
    return 'Automate web browser interactions using Playwright. Can create accounts, fill forms, click buttons, and navigate websites.';
  }

  getUsageExamples(): string[] {
    return [
      'Create an account on retrotales.online',
      'Fill in the registration form with email, username, and password',
      'Click the sign up button',
      'Navigate to the login page and fill in credentials'
    ];
  }
}

