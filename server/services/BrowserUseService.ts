/**
 * Browser Use Service
 * 
 * Provides browser automation using the browser-use Python library.
 * Allows AI agents to interact with web browsers through natural language commands.
 * 
 * Features:
 * - Navigate to URLs
 * - Fill forms
 * - Click buttons
 * - Extract information
 * - Create accounts
 * - Automate web interactions
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { pythonSandboxService } from './PythonSandboxService';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const logger = new SimpleLogger('BrowserUseService');

export interface BrowserUseTask {
  url: string;
  task: string; // Natural language description of what to do
  options?: {
    timeout?: number;
    headless?: boolean;
    waitForNavigation?: boolean;
    screenshot?: boolean;
  };
}

export interface BrowserUseResult {
  success: boolean;
  output: string;
  error?: string;
  screenshot?: string; // Base64 encoded screenshot
  extractedData?: Record<string, any>;
}

export class BrowserUseService {
  private static instance: BrowserUseService;
  private installationChecked = false;
  private isInstalled = false;

  private constructor() {}

  public static getInstance(): BrowserUseService {
    if (!BrowserUseService.instance) {
      BrowserUseService.instance = new BrowserUseService();
    }
    return BrowserUseService.instance;
  }

  /**
   * Check if browser-use is installed, install if needed
   */
  private async ensureInstalled(): Promise<boolean> {
    if (this.installationChecked) {
      return this.isInstalled;
    }

    this.installationChecked = true;

    try {
      // Check if browser-use is installed
      const checkCode = `
import sys
try:
    import browser_use
    print("INSTALLED")
except ImportError:
    print("NOT_INSTALLED")
sys.exit(0)
`;

      const result = await pythonSandboxService.executeScript(checkCode, 10000);
      
      if (result.success && result.output.includes('INSTALLED')) {
        this.isInstalled = true;
        logger.info('browser-use is already installed');
        return true;
      }

      // Try to install browser-use
      logger.info('Installing browser-use Python package...');
      const installCode = `
import subprocess
import sys

try:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'browser-use', '--quiet'], 
                         stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print("INSTALLED")
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;

      const installResult = await pythonSandboxService.executeScript(installCode, 120000); // 2 min timeout
      
      if (installResult.success && installResult.output.includes('INSTALLED')) {
        this.isInstalled = true;
        logger.info('✅ browser-use installed successfully');
        return true;
      } else {
        logger.warn('Failed to install browser-use:', installResult.error || installResult.output);
        this.isInstalled = false;
        return false;
      }
    } catch (error) {
      logger.error('Error checking/installing browser-use', error as Error);
      this.isInstalled = false;
      return false;
    }
  }

  /**
   * Execute a browser automation task using browser-use
   */
  async executeTask(task: BrowserUseTask): Promise<BrowserUseResult> {
    try {
      const isInstalled = await this.ensureInstalled();
      
      if (!isInstalled) {
        return {
          success: false,
          output: '',
          error: 'browser-use is not installed and could not be installed automatically. Please install it manually: pip install browser-use'
        };
      }

      logger.info(`Executing browser task: ${task.task} on ${task.url}`);

      // Generate Python script for browser-use
      const pythonScript = this.generateBrowserUseScript(task);

      // Execute the script
      const timeout = (task.options?.timeout || 60000); // Default 60 seconds
      const result = await pythonSandboxService.executeScript(pythonScript, timeout);

      if (!result.success) {
        return {
          success: false,
          output: result.output,
          error: result.error || 'Browser automation failed'
        };
      }

      // Parse the result
      return this.parseBrowserUseResult(result.output);
    } catch (error) {
      logger.error('Error executing browser task', error as Error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate Python script for browser-use
   */
  private generateBrowserUseScript(task: BrowserUseTask): string {
    const headless = task.options?.headless !== false; // Default to headless
    const waitForNavigation = task.options?.waitForNavigation !== false;
    const takeScreenshot = task.options?.screenshot === true;

    return `
import asyncio
import json
import sys
from browser_use import Agent
from browser_use.browser.browser import Browser

async def main():
    try:
        # Create browser agent with task and URL
        agent = Agent(
            task="${this.escapeString(task.task)}",
            url="${this.escapeString(task.url)}",
            headless=${headless}
        )
        
        # Execute the task
        result = await agent.run()
        
        # Prepare output
        output = {
            "success": True,
            "message": str(result) if result else "Task completed successfully",
            "url": "${task.url}",
            "task": "${this.escapeString(task.task)}"
        }
        
        ${takeScreenshot ? `
        # Take screenshot if requested
        try:
            # Get screenshot from browser
            if hasattr(agent, 'browser') and agent.browser:
                screenshot_bytes = await agent.browser.screenshot()
                if screenshot_bytes:
                    import base64
                    output["screenshot"] = base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            output["screenshot_error"] = str(e)
        ` : ''}
        
        print(json.dumps(output))
        
    except Exception as e:
        import traceback
        error_output = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "url": "${task.url}",
            "task": "${this.escapeString(task.task)}"
        }
        print(json.dumps(error_output))
        sys.exit(1)

# Run the async function
asyncio.run(main())
`;
  }

  /**
   * Escape string for use in Python code
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * Parse browser-use result
   */
  private parseBrowserUseResult(output: string): BrowserUseResult {
    try {
      // Try to find JSON in output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          success: parsed.success !== false,
          output: parsed.message || parsed.output || 'Task completed',
          error: parsed.error,
          screenshot: parsed.screenshot,
          extractedData: parsed.data || parsed.extractedData
        };
      }

      // If no JSON, return raw output
      return {
        success: !output.toLowerCase().includes('error'),
        output: output,
        error: output.toLowerCase().includes('error') ? output : undefined
      };
    } catch (error) {
      logger.warn('Failed to parse browser-use result', error as Error);
      return {
        success: !output.toLowerCase().includes('error'),
        output: output,
        error: output.toLowerCase().includes('error') ? output : undefined
      };
    }
  }

  /**
   * Check if browser-use is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.ensureInstalled();
  }
}

export const browserUseService = BrowserUseService.getInstance();
export default browserUseService;

