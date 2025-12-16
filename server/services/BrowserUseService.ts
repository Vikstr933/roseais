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
import { chromium, Browser, Page } from 'playwright';
import { MultiModelAIService } from './MultiModelAIService';

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
  private browser: Browser | null = null;
  private multiModelAI: MultiModelAIService;

  private constructor() {
    this.multiModelAI = new MultiModelAIService();
  }

  public static getInstance(): BrowserUseService {
    if (!BrowserUseService.instance) {
      BrowserUseService.instance = new BrowserUseService();
    }
    return BrowserUseService.instance;
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Launching browser for automation...');
      try {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        logger.info('✅ Browser launched successfully');
      } catch (error) {
        logger.warn('Failed to launch browser, attempting to install Playwright browsers...', error as Error);
        
        // Try to install Playwright browsers at runtime
        try {
          const { execa } = await import('execa');
          logger.info('Installing Playwright browsers...');
          await execa('npx', ['playwright', 'install', 'chromium'], {
            timeout: 120000, // 2 minutes timeout
            stdio: 'inherit'
          });
          logger.info('✅ Playwright browsers installed, retrying launch...');
          
          // Retry launching browser
          this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          logger.info('✅ Browser launched successfully after installation');
        } catch (installError) {
          logger.error('Failed to install Playwright browsers at runtime', installError as Error);
          throw new Error('Failed to launch browser. Playwright browsers are not installed. Please ensure Playwright is installed: npx playwright install chromium');
        }
      }
    }
    return this.browser;
  }

  /**
   * Execute a browser automation task using Playwright
   */
  async executeTask(task: BrowserUseTask): Promise<BrowserUseResult> {
    let browserPage: Page | null = null;
    try {
      logger.info(`Executing browser task: ${task.task} on ${task.url}`);

      const browser = await this.getBrowser();
      browserPage = await browser.newPage();
      
      try {
        // Navigate to URL with longer timeout and less strict wait condition
        // Use 'load' instead of 'networkidle' to avoid timeouts on slow sites
        const navigationTimeout = task.options?.timeout || 60000; // Default 60 seconds
        try {
          await browserPage.goto(task.url, { 
            waitUntil: 'load', 
            timeout: navigationTimeout 
          });
          logger.info(`Navigated to ${task.url}`);
        } catch (navError) {
          // If load times out, try with domcontentloaded (less strict)
          logger.warn(`Navigation with 'load' timed out, trying 'domcontentloaded'...`);
          try {
            await browserPage.goto(task.url, { 
              waitUntil: 'domcontentloaded', 
              timeout: navigationTimeout 
            });
            logger.info(`Navigated to ${task.url} (domcontentloaded)`);
          } catch (domError) {
            // Last resort: just wait for the page to be accessible
            logger.warn(`Navigation with 'domcontentloaded' also timed out, waiting for page...`);
            await browserPage.goto(task.url, { 
              waitUntil: 'commit', 
              timeout: navigationTimeout 
            });
            // Give it a moment to load
            await browserPage.waitForTimeout(3000);
            logger.info(`Navigated to ${task.url} (commit)`);
          }
        }

        // Use AI to understand the task and execute it
        const result = await this.executeTaskWithAI(browserPage, task);

        // Take screenshot if requested
        let screenshot: string | undefined;
        if (task.options?.screenshot) {
          screenshot = (await browserPage.screenshot({ type: 'png' })).toString('base64');
        }

        await browserPage.close();

        return {
          success: true,
          output: result.message || 'Task completed successfully',
          screenshot,
          extractedData: result.data
        };
      } catch (error) {
        if (browserPage) {
          try {
            await browserPage.close();
          } catch (closeError) {
            logger.warn('Error closing browser page', closeError as Error);
          }
        }
        throw error;
      }
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
   * Execute task using AI to understand and perform actions
   */
  private async executeTaskWithAI(page: Page, task: BrowserUseTask): Promise<{ message: string; data?: Record<string, any> }> {
    // Get page content and structure
    const pageContent = await page.content();
    const pageText = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        text: document.body.innerText.substring(0, 5000), // First 5000 chars
        buttons: Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]')).map(el => ({
          text: el.textContent?.trim() || el.getAttribute('value') || '',
          type: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className
        })),
        inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
          type: (el as HTMLInputElement).type,
          name: (el as HTMLInputElement).name,
          id: el.id,
          placeholder: (el as HTMLInputElement).placeholder,
          label: el.closest('label')?.textContent?.trim() || ''
        }))
      };
    });

    // Use AI to determine what actions to take
    const aiPrompt = `You are a browser automation assistant. The user wants to: ${task.task}

Current page information:
- URL: ${pageText.url}
- Title: ${pageText.title}
- Available buttons: ${JSON.stringify(pageText.buttons.slice(0, 10))}
- Available form fields: ${JSON.stringify(pageText.inputs.slice(0, 20))}
- Page text (first part): ${pageText.text.substring(0, 1000)}

Based on the task "${task.task}", determine the sequence of actions needed. Respond with a JSON object:
{
  "actions": [
    {"type": "click", "selector": "button#signup", "reason": "..."},
    {"type": "fill", "selector": "input[name='email']", "value": "vingosAI@gmail.com", "reason": "..."},
    {"type": "fill", "selector": "input[name='username']", "value": "Vingoai2", "reason": "..."},
    {"type": "fill", "selector": "input[name='password']", "value": "vingoai1", "reason": "..."},
    {"type": "click", "selector": "button[type='submit']", "reason": "..."}
  ],
  "message": "Summary of what was done"
}

Action types: "click", "fill", "wait", "navigate"
Use CSS selectors, IDs, or text content to identify elements.`;

    const aiResponse = await this.multiModelAI.generate({
      prompt: aiPrompt,
      systemPrompt: 'You are an expert at browser automation. Analyze the page structure and task, then provide a JSON response with the exact sequence of actions needed.',
      maxTokens: 2000,
      temperature: 0.3,
      useCase: 'explanation',
      priority: 'quality'
    });

    // Parse AI response and execute actions
    try {
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        
        for (const action of plan.actions || []) {
          try {
            if (action.type === 'click') {
              await page.click(action.selector, { timeout: 10000 });
              await page.waitForTimeout(1000); // Wait for page to react
            } else if (action.type === 'fill') {
              await page.fill(action.selector, action.value, { timeout: 10000 });
            } else if (action.type === 'wait') {
              await page.waitForTimeout(action.duration || 2000);
            } else if (action.type === 'navigate') {
              await page.goto(action.url, { waitUntil: 'networkidle' });
            }
          } catch (actionError) {
            logger.warn(`Action failed: ${action.type} on ${action.selector}`, actionError as Error);
            // Continue with next action
          }
        }

        return {
          message: plan.message || 'Task completed',
          data: { actionsExecuted: plan.actions?.length || 0 }
        };
      }
    } catch (parseError) {
      logger.warn('Failed to parse AI response, trying direct approach', parseError as Error);
    }

    // Fallback: Try to find and fill common registration form fields
    return await this.executeRegistrationFallback(page, task);
  }

  /**
   * Fallback method for registration forms
   */
  private async executeRegistrationFallback(page: Page, task: BrowserUseTask): Promise<{ message: string; data?: Record<string, any> }> {
    const actions: string[] = [];

    // Extract email, username, password from task description
    const emailMatch = task.task.match(/email[:\s]+([^\s\n]+@[^\s\n]+)/i) || 
                      task.task.match(/([^\s\n]+@[^\s\n]+)/);
    const usernameMatch = task.task.match(/username[:\s]+([^\s\n]+)/i);
    const passwordMatch = task.task.match(/password[:\s]+([^\s\n]+)/i);

    const email = emailMatch?.[1] || emailMatch?.[0];
    const username = usernameMatch?.[1];
    const password = passwordMatch?.[1];

    try {
      // Look for sign up / register button
      const signupSelectors = [
        'button:has-text("Sign Up")',
        'button:has-text("Register")',
        'a:has-text("Sign Up")',
        'a:has-text("Register")',
        'button[type="submit"]',
        'a[href*="register"]',
        'a[href*="signup"]'
      ];

      for (const selector of signupSelectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          actions.push(`Clicked ${selector}`);
          await page.waitForTimeout(2000);
          break;
        } catch {
          continue;
        }
      }

      // Fill email field
      if (email) {
        const emailSelectors = ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[placeholder*="email" i]'];
        for (const selector of emailSelectors) {
          try {
            await page.fill(selector, email, { timeout: 3000 });
            actions.push(`Filled email: ${email}`);
            break;
          } catch {
            continue;
          }
        }
      }

      // Fill username field
      if (username) {
        const usernameSelectors = ['input[name*="user"]', 'input[id*="user"]', 'input[placeholder*="user" i]'];
        for (const selector of usernameSelectors) {
          try {
            await page.fill(selector, username, { timeout: 3000 });
            actions.push(`Filled username: ${username}`);
            break;
          } catch {
            continue;
          }
        }
      }

      // Fill password field
      if (password) {
        const passwordSelectors = ['input[type="password"]', 'input[name*="password"]', 'input[id*="password"]'];
        for (const selector of passwordSelectors) {
          try {
            await page.fill(selector, password, { timeout: 3000 });
            actions.push(`Filled password`);
            break;
          } catch {
            continue;
          }
        }
      }

      // Submit form
      try {
        await page.click('button[type="submit"]', { timeout: 5000 });
        actions.push('Submitted form');
        await page.waitForTimeout(3000);
      } catch {
        // Try Enter key
        await page.keyboard.press('Enter');
        actions.push('Pressed Enter to submit');
      }

      return {
        message: `Registration form filled and submitted. Actions: ${actions.join(', ')}`,
        data: { actions }
      };
    } catch (error) {
      return {
        message: `Partially completed. Actions: ${actions.join(', ')}. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        data: { actions, error: error instanceof Error ? error.message : 'Unknown' }
      };
    }
  }

  /**
   * Check if browser automation is available (Playwright)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const browser = await this.getBrowser();
      return browser !== null;
    } catch (error) {
      logger.warn('Browser not available', error as Error);
      return false;
    }
  }

  /**
   * Cleanup browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }
}

export const browserUseService = BrowserUseService.getInstance();
export default browserUseService;

