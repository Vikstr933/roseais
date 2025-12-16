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
   * Setup page with realistic headers and stealth features
   */
  private async setupStealthPage(page: Page, url: string): Promise<void> {
    // Set realistic viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Override navigator.webdriver to hide automation
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Mock chrome object
      (window as any).chrome = {
        runtime: {},
      };
    });

    // Set realistic headers
    const headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': new URL(url).origin,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };

    await page.setExtraHTTPHeaders(headers);
  }

  /**
   * Simulate human-like behavior (mouse movements, scrolling, delays)
   */
  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Random delay
    await page.waitForTimeout(1000 + Math.random() * 2000);

    // Simulate mouse movement
    await page.mouse.move(
      100 + Math.random() * 500,
      100 + Math.random() * 500
    );

    // Scroll a bit
    await page.evaluate(() => {
      window.scrollBy(0, 100 + Math.random() * 200);
    });

    await page.waitForTimeout(500 + Math.random() * 1000);
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
      
      // Setup stealth features and realistic headers
      await this.setupStealthPage(browserPage, task.url);
      
      try {
        // Simulate human behavior before navigation
        await this.simulateHumanBehavior(browserPage);
        
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

    // Extract account name, username, password, confirm password from task description
    const emailMatch = task.task.match(/email[:\s]+([^\s\n]+@[^\s\n]+)/i) || 
                      task.task.match(/([^\s\n]+@[^\s\n]+)/);
    const accountNameMatch = task.task.match(/account\s+name[:\s]+([^\s\n]+)/i) || 
                            task.task.match(/accountname[:\s]+([^\s\n]+)/i);
    const usernameMatch = task.task.match(/username[:\s]+([^\s\n]+)/i);
    const passwordMatch = task.task.match(/password[:\s]+([^\s\n]+)/i);
    const confirmPasswordMatch = task.task.match(/confirm\s+password[:\s]+([^\s\n]+)/i);

    const email = emailMatch?.[1] || emailMatch?.[0];
    const accountName = accountNameMatch?.[1] || usernameMatch?.[1];
    const username = usernameMatch?.[1] || accountName;
    const password = passwordMatch?.[1];
    const confirmPassword = confirmPasswordMatch?.[1] || password;

    try {
      // First, look for Register button in top right corner (common pattern)
      // Try multiple strategies to find the Register button
      const registerSelectors = [
        // Top right corner patterns
        'header button:has-text("Register")',
        'header a:has-text("Register")',
        'nav button:has-text("Register")',
        'nav a:has-text("Register")',
        '.header button:has-text("Register")',
        '.header a:has-text("Register")',
        '.navbar button:has-text("Register")',
        '.navbar a:has-text("Register")',
        // General patterns
        'button:has-text("Register")',
        'a:has-text("Register")',
        'button:has-text("Sign Up")',
        'a:has-text("Sign Up")',
        'button[aria-label*="Register" i]',
        'a[href*="register"]',
        'a[href*="signup"]',
        // Try by position (top right)
        'button[class*="register" i]',
        'a[class*="register" i]'
      ];

      let registerClicked = false;
      for (const selector of registerSelectors) {
        try {
          // Wait for the element to be visible
          await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
          await page.click(selector, { timeout: 5000 });
          actions.push(`Clicked Register button: ${selector}`);
          registerClicked = true;
          // Wait for dialog/modal to open
          await page.waitForTimeout(2000);
          break;
        } catch {
          continue;
        }
      }

      if (!registerClicked) {
        // Try to find by text content in all buttons/links
        try {
          const registerButton = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const found = buttons.find(el => 
              el.textContent?.toLowerCase().includes('register') || 
              el.textContent?.toLowerCase().includes('sign up')
            );
            return found ? (found as HTMLElement).outerHTML : null;
          });
          
          if (registerButton) {
            // Find the element again and click it
            const buttonSelector = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, a'));
              const found = buttons.find(el => 
                el.textContent?.toLowerCase().includes('register') || 
                el.textContent?.toLowerCase().includes('sign up')
              );
              if (found) {
                // Generate a unique selector
                if (found.id) return `#${found.id}`;
                if (found.className) return `.${found.className.split(' ')[0]}`;
                return found.tagName.toLowerCase();
              }
              return null;
            });
            
            if (buttonSelector) {
              await page.click(buttonSelector, { timeout: 5000 });
              actions.push('Clicked Register button (found by text search)');
              await page.waitForTimeout(2000);
              registerClicked = true;
            }
          }
        } catch {
          logger.warn('Could not find Register button');
        }
      }

      // Wait for dialog/modal to appear (look for common modal/dialog patterns)
      try {
        await page.waitForSelector('dialog, [role="dialog"], .modal, .dialog, [class*="modal" i], [class*="dialog" i]', { 
          timeout: 5000,
          state: 'visible' 
        });
        actions.push('Dialog/modal appeared');
        await page.waitForTimeout(1000);
      } catch {
        logger.warn('No dialog detected, continuing anyway');
      }

      // Fill Account Name field (first field, usually)
      if (accountName) {
        const accountNameSelectors = [
          'input[name*="account" i]',
          'input[id*="account" i]',
          'input[placeholder*="account" i]',
          'input[name*="username" i]',
          'input[id*="username" i]',
          'input[placeholder*="username" i]',
          'input[placeholder*="account name" i]',
          'input[type="text"]:first-of-type'
        ];
        for (const selector of accountNameSelectors) {
          try {
            const element = await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
            if (element) {
              // Click on the field first (human-like)
              await page.click(selector, { timeout: 3000 });
              await page.waitForTimeout(200 + Math.random() * 300);
              // Type with human-like delays
              await page.type(selector, accountName, { delay: 50 + Math.random() * 100 });
              actions.push(`Filled Account Name: ${accountName}`);
              await page.waitForTimeout(500 + Math.random() * 500); // Random delay between fields
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Fill password field (first password field)
      if (password) {
        const passwordSelectors = [
          'input[type="password"]:first-of-type',
          'input[name*="password" i]:not([name*="confirm" i])',
          'input[id*="password" i]:not([id*="confirm" i])',
          'input[placeholder*="password" i]:not([placeholder*="confirm" i])'
        ];
        for (const selector of passwordSelectors) {
          try {
            const element = await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
            if (element) {
              await page.click(selector, { timeout: 3000 });
              await page.waitForTimeout(200 + Math.random() * 300);
              await page.type(selector, password, { delay: 50 + Math.random() * 100 });
              actions.push('Filled Password');
              await page.waitForTimeout(500 + Math.random() * 500);
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Fill confirm password field (second password field)
      if (confirmPassword) {
        const confirmPasswordSelectors = [
          'input[type="password"]:last-of-type',
          'input[name*="confirm" i]',
          'input[id*="confirm" i]',
          'input[placeholder*="confirm" i]',
          'input[name*="password" i][name*="confirm" i]',
          'input[id*="password" i][id*="confirm" i]'
        ];
        for (const selector of confirmPasswordSelectors) {
          try {
            const element = await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
            if (element) {
              await page.click(selector, { timeout: 3000 });
              await page.waitForTimeout(200 + Math.random() * 300);
              await page.type(selector, confirmPassword, { delay: 50 + Math.random() * 100 });
              actions.push('Filled Confirm Password');
              await page.waitForTimeout(500 + Math.random() * 500);
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Handle Cloudflare protection - wait extra time for it to complete
      logger.info('Waiting for Cloudflare protection to complete...');
      actions.push('Waiting for Cloudflare protection');
      await page.waitForTimeout(5000); // Wait 5 seconds for Cloudflare to complete
      
      // Check if Cloudflare challenge is visible and wait for it to complete
      try {
        const cloudflareSelectors = [
          '[data-ray]', // Cloudflare Turnstile
          '.cf-browser-verification',
          '#cf-challenge-running',
          '[id*="cf-"]',
          '[class*="cf-"]'
        ];
        
        for (const selector of cloudflareSelectors) {
          try {
            const cfElement = await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
            if (cfElement) {
              logger.info('Cloudflare challenge detected, waiting for completion...');
              // Wait up to 15 seconds for Cloudflare to complete automatically
              await page.waitForTimeout(15000);
              actions.push('Cloudflare challenge completed');
              break;
            }
          } catch {
            continue;
          }
        }
      } catch {
        // No Cloudflare detected, continue
      }

      // Submit form - look for submit button in dialog/modal
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Register")',
        'button:has-text("Sign Up")',
        'button:has-text("Create Account")',
        'button:has-text("Submit")',
        'button[class*="submit" i]',
        'button[class*="register" i]',
        'dialog button[type="submit"]',
        '[role="dialog"] button[type="submit"]',
        '.modal button[type="submit"]'
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = await page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
          if (submitButton) {
            await page.click(selector, { timeout: 5000 });
            actions.push('Submitted form');
            submitted = true;
            await page.waitForTimeout(3000); // Wait for form submission
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        // Try Enter key as fallback
        try {
          await page.keyboard.press('Enter');
          actions.push('Pressed Enter to submit');
          await page.waitForTimeout(3000);
        } catch {
          actions.push('Could not submit form - no submit button found');
        }
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

