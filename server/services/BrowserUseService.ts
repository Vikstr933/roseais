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
import { spawn } from 'child_process';
import { join } from 'path';

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
  private turnstileSolverApiUrl: string | null = null;
  private turnstileSolverPath: string;

  private constructor() {
    this.multiModelAI = new MultiModelAIService();
    // Get Turnstile Solver API URL from environment variable (optional, for API mode)
    this.turnstileSolverApiUrl = process.env.TURNSTILE_SOLVER_API_URL || null;
    // Path to turnstile-solver directory
    this.turnstileSolverPath = join(process.cwd(), 'turnstile-solver');
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
        // Use improved browser args to avoid detection (based on Turnstile research)
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled', // Critical for Turnstile
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
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
          
          // Retry launching browser with improved args
          this.browser = await chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-blink-features=AutomationControlled',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu'
            ]
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
      
      // Create browser context with realistic settings (critical for Turnstile implicit pass)
      // Based on research: Turnstile often gives implicit pass with good fingerprints
      const browserContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        // Add extra HTTP headers for better fingerprint
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': new URL(task.url).origin,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'
        }
      });
      
      browserPage = await browserContext.newPage();
      
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

        // Check if this is a registration/account creation task
        const isRegistrationTask = task.task.toLowerCase().includes('register') || 
                                  task.task.toLowerCase().includes('create account') ||
                                  task.task.toLowerCase().includes('sign up') ||
                                  task.task.toLowerCase().includes('account creation') ||
                                  task.task.toLowerCase().includes('registration');
        
        let result: { message: string; data?: Record<string, any> };
        
        // For registration tasks, use the robust fallback method directly
        if (isRegistrationTask) {
          logger.info('Detected registration task, using robust fallback method');
          result = await this.executeRegistrationFallback(browserPage, task);
        } else {
          // For other tasks, use AI first, then fallback if needed
          try {
            result = await this.executeTaskWithAI(browserPage, task);
          } catch (aiError) {
            logger.warn('AI task execution failed, using fallback', aiError as Error);
            // If it's a registration-like task, use registration fallback
            if (isRegistrationTask) {
              result = await this.executeRegistrationFallback(browserPage, task);
            } else {
              throw aiError;
            }
          }
        }

        // Take screenshot if requested
        let screenshot: string | undefined;
        if (task.options?.screenshot) {
          screenshot = (await browserPage.screenshot({ type: 'png' })).toString('base64');
        }

        // Close page and context (context was created for better Turnstile fingerprints)
        await browserPage.close();
        if (browserContext) {
          await browserContext.close();
        }

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
        // Close context if it exists
        const context = browserPage?.context();
        if (context) {
          try {
            await context.close();
          } catch (closeError) {
            logger.warn('Error closing browser context', closeError as Error);
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
        // Retrotales specific
        'button#reg-openModal',
        'button[id="reg-openModal"]',
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
          // Wait for the element to exist in DOM (attached, not necessarily visible)
          await page.waitForSelector(selector, { timeout: 5000, state: 'attached' });
          
          // Try clicking with force if element exists but isn't visible
          try {
            await page.click(selector, { timeout: 5000, force: false });
            actions.push(`Clicked Register button: ${selector}`);
          } catch {
            // If normal click fails, try with force
            await page.click(selector, { timeout: 5000, force: true });
            actions.push(`Clicked Register button (force): ${selector}`);
          }
          
          registerClicked = true;
          // Wait for dialog/modal/form to open
          await page.waitForTimeout(3000);
          break;
        } catch (error) {
          logger.debug(`Register button selector ${selector} failed: ${error instanceof Error ? error.message : String(error)}`);
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

      // Wait for registration form to appear in DOM (form#register-form or form fields)
      try {
        // Wait for the registration form or form fields to appear
        await page.waitForSelector('form#register-form, input[name="reg-username"], input[name="reg-password"], input[name="password_again"], input[id="password-confirmation"]', {
          timeout: 15000,
          state: 'attached' // Just need them to exist in DOM
        });
        actions.push('Registration form detected in DOM');
        
        // Wait a bit for form to be fully rendered
        await page.waitForTimeout(2000);
        
        // Make form and fields visible/accessible
        await page.evaluate(() => {
          // Find the registration form
          const form = document.querySelector('form#register-form') as HTMLFormElement;
          if (form) {
            // Make form visible
            form.style.display = '';
            form.style.visibility = '';
            form.style.opacity = '';
            form.removeAttribute('hidden');
            
            // Make all input fields visible
            const fields = form.querySelectorAll('input[name="reg-username"], input[name="reg-password"], input[name="password_again"], input[id="password-confirmation"]');
            fields.forEach((field: Element) => {
              if (field instanceof HTMLElement) {
                field.style.display = '';
                field.style.visibility = '';
                field.style.opacity = '';
                field.removeAttribute('hidden');
                // Remove disabled attribute if present
                (field as HTMLInputElement).disabled = false;
              }
            });
            
            // Make submit button visible and enabled
            const submitBtn = form.querySelector('button#register-submit-btn') as HTMLButtonElement;
            if (submitBtn) {
              submitBtn.style.display = '';
              submitBtn.style.visibility = '';
              submitBtn.style.opacity = '';
              submitBtn.removeAttribute('hidden');
            }
          }
        });
        
        await page.waitForTimeout(1000);
        actions.push('Form made visible and accessible');
      } catch (error) {
        logger.warn('Registration form not found, trying to find form fields directly', error as Error);
        // Try to find form fields anyway
        try {
          await page.waitForSelector('input[name="reg-username"], input[name="reg-password"], input[name="password_again"], input[id="password-confirmation"]', {
            timeout: 10000,
            state: 'attached'
          });
          actions.push('Form fields found without form element');
        } catch {
          logger.warn('Form fields not found in DOM');
        }
      }

      // Fill Account Name field (first field, usually)
      if (accountName) {
        const accountNameSelectors = [
          // Retrotales specific
          'input[name="reg-username"]',
          'input[id="reg-username"]',
          // Generic selectors
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
            // Wait for element to exist in DOM (attached, not necessarily visible)
            await page.waitForSelector(selector, { timeout: 5000, state: 'attached' });
            
            // Make element visible and interactable
            await page.evaluate((sel: string) => {
              const el = document.querySelector(sel) as HTMLElement;
              if (el) {
                // Remove hidden styles and attributes
                el.style.display = '';
                el.style.visibility = '';
                el.style.opacity = '';
                el.removeAttribute('hidden');
                // Make it visible
                if (el instanceof HTMLInputElement) {
                  el.type = el.getAttribute('data-original-type') || el.type;
                }
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            }, selector);
            
            await page.waitForTimeout(500);
            
            // Try to set value directly first (most reliable for hidden elements)
            const valueSet = await page.evaluate(({ sel, val }: { sel: string; val: string }) => {
              const el = document.querySelector(sel) as HTMLInputElement;
              if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                return el.value === val;
              }
              return false;
            }, { sel: selector, val: accountName });
            
            if (valueSet) {
              // Verify the value was set
              const value = await page.inputValue(selector);
              if (value === accountName) {
                actions.push(`Filled Account Name (direct): ${accountName}`);
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
            
            // Fallback: try clicking and typing (human-like)
            try {
              await page.click(selector, { timeout: 3000, force: true });
              await page.waitForTimeout(200 + Math.random() * 300);
              await page.fill(selector, '');
              await page.type(selector, accountName, { delay: 50 + Math.random() * 100 });
              
              const value = await page.inputValue(selector);
              if (value === accountName) {
                actions.push(`Filled Account Name: ${accountName}`);
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            } catch {
              // If that fails, value was already set by evaluate
              const value = await page.inputValue(selector);
              if (value === accountName) {
                actions.push(`Filled Account Name (evaluate): ${accountName}`);
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
          } catch (error) {
            logger.warn(`Failed to fill account name with selector ${selector}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
        }
      }

      // Validate and potentially fix password to meet requirements
      let validPassword = password;
      if (password) {
        // Check if password meets common requirements (8+ chars, uppercase, lowercase, number)
        const hasMinLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        
        if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
          logger.warn(`Password "${password}" does not meet requirements. Generating valid password...`);
          // Generate a valid password based on the original
          const base = password.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6) || 'pass';
          validPassword = base.charAt(0).toUpperCase() + base.substring(1).toLowerCase() + '123';
          if (validPassword.length < 8) {
            validPassword = validPassword + '456';
          }
          logger.info(`Generated valid password: ${validPassword}`);
          actions.push(`Password adjusted to meet requirements: ${validPassword}`);
        }
      }

      // Fill password field (first password field)
      if (validPassword) {
        const passwordSelectors = [
          // Retrotales specific
          'input[name="reg-password"]',
          'input[id="reg-password"]',
          // Generic selectors
          'input[type="password"]:first-of-type',
          'input[name*="password" i]:not([name*="confirm" i]):not([name*="again" i])',
          'input[id*="password" i]:not([id*="confirm" i]):not([id*="again" i])',
          'input[placeholder*="password" i]:not([placeholder*="confirm" i]):not([placeholder*="again" i])'
        ];
        for (const selector of passwordSelectors) {
          try {
            // Wait for element to exist in DOM
            await page.waitForSelector(selector, { timeout: 5000, state: 'attached' });
            
            // Make element visible and set value directly
            const valueSet = await page.evaluate(({ sel, val }: { sel: string; val: string }) => {
              const el = document.querySelector(sel) as HTMLInputElement;
              if (el) {
                // Remove hidden styles
                el.style.display = '';
                el.style.visibility = '';
                el.style.opacity = '';
                el.removeAttribute('hidden');
                // Set value
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                return el.value === val;
              }
              return false;
            }, { sel: selector, val: validPassword });
            
            if (valueSet) {
              const value = await page.inputValue(selector);
              if (value === validPassword) {
                actions.push('Filled Password (direct)');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
            
            // Fallback: try clicking and typing
            try {
              await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLElement;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                }
              }, selector);
              
              await page.waitForTimeout(500);
              await page.click(selector, { timeout: 3000, force: true });
              await page.waitForTimeout(200 + Math.random() * 300);
              await page.fill(selector, '');
              await page.type(selector, validPassword, { delay: 50 + Math.random() * 100 });
              
              const value = await page.inputValue(selector);
              if (value === validPassword) {
                actions.push('Filled Password');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            } catch {
              const value = await page.inputValue(selector);
              if (value === validPassword) {
                actions.push('Filled Password (evaluate)');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
          } catch (error) {
            logger.warn(`Failed to fill password with selector ${selector}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
        }
      }

      // Fill confirm password field (second password field)
      const confirmPasswordValue = confirmPassword || validPassword;
      if (confirmPasswordValue) {
        const confirmPasswordSelectors = [
          // Retrotales specific (try both underscore and hyphen variations)
          'input[id="password-confirmation"]',
          'input[id="password_again"]',
          'input[name="password_again"]',
          'input[name="password-confirmation"]',
          // Generic selectors
          'input[type="password"]:last-of-type',
          'input[id*="password" i][id*="confirm" i]',
          'input[id*="password" i][id*="again" i]',
          'input[name*="confirm" i]',
          'input[name*="again" i]',
          'input[id*="confirm" i]',
          'input[id*="again" i]',
          'input[placeholder*="confirm" i]',
          'input[placeholder*="again" i]',
          'input[name*="password" i][name*="confirm" i]'
        ];
        for (const selector of confirmPasswordSelectors) {
          try {
            // Wait for element to exist in DOM
            await page.waitForSelector(selector, { timeout: 5000, state: 'attached' });
            
            // Make element visible and set value directly
            const valueSet = await page.evaluate(({ sel, val }: { sel: string; val: string }) => {
              const el = document.querySelector(sel) as HTMLInputElement;
              if (el) {
                // Remove hidden styles
                el.style.display = '';
                el.style.visibility = '';
                el.style.opacity = '';
                el.removeAttribute('hidden');
                // Set value
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                return el.value === val;
              }
              return false;
            }, { sel: selector, val: confirmPasswordValue });
            
            if (valueSet) {
              // Verify value using evaluate (works even for hidden elements)
              const value = await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                return el ? el.value : '';
              }, selector);
              
              if (value === confirmPasswordValue) {
                actions.push('Filled Confirm Password (direct)');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
            
            // Fallback: try clicking and typing
            try {
              await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLElement;
                if (el) {
                  // Make sure it's visible
                  el.style.display = '';
                  el.style.visibility = '';
                  el.style.opacity = '';
                  el.removeAttribute('hidden');
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                }
              }, selector);
              
              await page.waitForTimeout(500);
              await page.click(selector, { timeout: 3000, force: true });
              await page.waitForTimeout(200 + Math.random() * 300);
              await page.fill(selector, '');
              await page.type(selector, confirmPasswordValue, { delay: 50 + Math.random() * 100 });
              
              // Verify using evaluate
              const value = await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                return el ? el.value : '';
              }, selector);
              
              if (value === confirmPasswordValue) {
                actions.push('Filled Confirm Password');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            } catch {
              // Final check using evaluate
              const value = await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                return el ? el.value : '';
              }, selector);
              
              if (value === confirmPasswordValue) {
                actions.push('Filled Confirm Password (evaluate)');
                await page.waitForTimeout(500 + Math.random() * 500);
                break;
              }
            }
          } catch (error) {
            logger.warn(`Failed to fill confirm password with selector ${selector}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
        }
      }

      // Handle Cloudflare Turnstile protection
      logger.info('Checking for Cloudflare Turnstile...');
      actions.push('Checking for Cloudflare Turnstile');
      
      // Check if Cloudflare Turnstile is present and extract sitekey
      const turnstileInfo = await page.evaluate(() => {
        const turnstile = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
        const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
        const iframe = turnstile?.querySelector('iframe');
        
        // Extract sitekey from data-sitekey attribute
        let sitekey: string | null = null;
        if (turnstile) {
          sitekey = turnstile.getAttribute('data-sitekey') || null;
          // Also check iframe src for sitekey
          if (!sitekey && iframe) {
            const iframeSrc = iframe.getAttribute('src') || '';
            const sitekeyMatch = iframeSrc.match(/0x[0-9A-Za-z_-]+/);
            if (sitekeyMatch) {
              sitekey = sitekeyMatch[0];
            }
          }
        }
        
        return {
          hasTurnstile: !!turnstile,
          hasResponseInput: !!responseInput,
          hasToken: !!(responseInput && responseInput.value && responseInput.value.length > 0),
          hasIframe: !!iframe,
          sitekey: sitekey,
          callback: (window as any).onRegisterTurnstileSuccess ? 'onRegisterTurnstileSuccess' : null
        };
      });
      
      if (turnstileInfo.hasTurnstile) {
        // KEY INSIGHT: Turnstile often gives implicit pass (no interaction needed)
        // Wait 3-5 seconds first to see if Turnstile auto-solves
        logger.info('Turnstile detected - waiting for implicit pass (3-5 seconds)...');
        actions.push('Waiting for Turnstile implicit pass');
        
        try {
          // Wait for Turnstile to potentially auto-solve (implicit pass)
          // According to research, most Turnstile challenges are implicit
          // Increased timeout to 15 seconds for server IPs (datacenter IPs need more time)
          await page.waitForFunction(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            return !!(responseInput && responseInput.value && responseInput.value.length > 0);
          }, {
            timeout: 15000, // Wait up to 15 seconds for implicit pass (longer for server IPs)
            polling: 1000 // Check every 1 second
          });
          
          // Check if we got an implicit pass
          const implicitToken = await page.evaluate(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            return responseInput?.value || null;
          });
          
          if (implicitToken && implicitToken.length > 0) {
            logger.info('✅ Turnstile gave implicit pass! Token received automatically.');
            actions.push('Turnstile implicit pass - token received automatically');
            // Skip all solving attempts - we already have a token!
          } else {
            // No implicit pass, continue with active solving below
            logger.info('No implicit pass received, trying active solving methods...');
            actions.push('No implicit pass - trying active solving');
          }
        } catch (timeoutError) {
          // Timeout waiting for implicit pass - this is normal, continue with active solving
          logger.info('Implicit pass timeout (expected) - trying active solving methods...');
          actions.push('Implicit pass timeout - trying active solving');
        }
        
        // Only try active solving if we don't already have a token
        const currentToken = await page.evaluate(() => {
          const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
          return responseInput?.value || null;
        });
        
        if (!currentToken || currentToken.length === 0) {
          // Try to solve using Turnstile-Solver (direct Python execution or API)
          // Only if implicit pass didn't work
          if (turnstileInfo.sitekey) {
            try {
              logger.info(`No implicit pass received, attempting active Turnstile solving (sitekey: ${turnstileInfo.sitekey})...`);
              actions.push('Attempting active Turnstile solving');
              
              // Try direct Python execution first, then API if available
              // Use shorter timeout since implicit pass is preferred
              let token: string | null = null;
              
              // First, try direct Python execution (no API server needed)
              // Use shorter timeout (45 seconds) since we prefer implicit pass
              token = await this.solveTurnstileDirect(page.url(), turnstileInfo.sitekey, 45000);
              
              // If direct execution failed and API URL is set, try API
              if (!token && this.turnstileSolverApiUrl) {
                logger.info('Direct Python execution failed, trying API...');
                token = await this.solveTurnstileWithAPI(page.url(), turnstileInfo.sitekey);
              }
              
              // If still no token, try 2Captcha as final fallback
              if (!token) {
                logger.info('Python solver failed, trying 2Captcha as fallback...');
                token = await this.solveTurnstileWith2Captcha(page.url(), turnstileInfo.sitekey);
              }
            
            if (token) {
              logger.info('Turnstile solved successfully!');
              actions.push('Turnstile solved');
              
              // Enhanced token application using Turnstile API
              const tokenSet = await page.evaluate((tokenValue) => {
                // Find and fill the response input
                const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                if (!responseInput) {
                  return { success: false, reason: 'input_not_found' };
                }
                
                // Set the token value first
                responseInput.value = tokenValue;
                
                // Trigger all necessary events to ensure Turnstile recognizes the token
                const events = ['input', 'change', 'blur', 'focus'];
                events.forEach(eventType => {
                  responseInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                });
                
                // Find Turnstile widget
                const turnstileWidget = document.querySelector('.cf-turnstile, [class*="cf-turnstile"], [data-sitekey]') as HTMLElement;
                let widgetId: string | null = null;
                
                if (turnstileWidget) {
                  widgetId = turnstileWidget.getAttribute('data-widget-id');
                  turnstileWidget.setAttribute('data-token', tokenValue);
                }
                
                // Try to use Turnstile API to properly register the token
                let apiSuccess = false;
                if (typeof (window as any).turnstile !== 'undefined') {
                  const turnstile = (window as any).turnstile;
                  
                  // Method 1: Use turnstile.render with callback to set token
                  if (turnstile.render && turnstileWidget) {
                    try {
                      const sitekey = turnstileWidget.getAttribute('data-sitekey');
                      if (sitekey) {
                        // Remove existing widget if any
                        if (widgetId && turnstile.remove) {
                          try {
                            turnstile.remove(widgetId);
                          } catch (e) {
                            // Ignore
                          }
                        }
                        
                        // Re-render widget with token callback
                        const newWidgetId = turnstile.render(turnstileWidget, {
                          sitekey: sitekey,
                          callback: (t: string) => {
                            responseInput.value = t;
                            responseInput.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        });
                        
                        // If we got a widget ID, try to set token directly
                        if (newWidgetId) {
                          // Use execute to set token directly
                          try {
                            (window as any).__turnstileToken = tokenValue;
                            responseInput.value = tokenValue;
                            apiSuccess = true;
                          } catch (e) {
                            // Ignore
                          }
                        }
                      }
                    } catch (e) {
                      // Ignore errors
                    }
                  }
                  
                  // Method 2: Use turnstile.execute if available (for programmatic token setting)
                  if (turnstile.execute && widgetId) {
                    try {
                      turnstile.execute(widgetId, {
                        response: tokenValue
                      });
                      apiSuccess = true;
                    } catch (e) {
                      // Ignore
                    }
                  }
                  
                  // Method 3: Try reset then manually set
                  if (widgetId && turnstile.reset) {
                    try {
                      turnstile.reset(widgetId);
                      // After reset, set token
                      setTimeout(() => {
                        responseInput.value = tokenValue;
                        responseInput.dispatchEvent(new Event('input', { bubbles: true }));
                      }, 100);
                      apiSuccess = true;
                    } catch (e) {
                      // Ignore
                    }
                  }
                }
                
                // Check for onRegisterTurnstileSuccess callback
                if (typeof (window as any).onRegisterTurnstileSuccess === 'function') {
                  try {
                    (window as any).onRegisterTurnstileSuccess(tokenValue);
                    apiSuccess = true;
                  } catch (e) {
                    try {
                      (window as any).onRegisterTurnstileSuccess();
                      apiSuccess = true;
                    } catch (e2) {
                      // Ignore errors
                    }
                  }
                }
                
                // Verify token is still in input
                const hasToken = !!(responseInput && responseInput.value && responseInput.value.length > 0);
                
                return { 
                  success: hasToken, 
                  apiSuccess: apiSuccess,
                  widgetId: widgetId,
                  tokenLength: responseInput.value?.length || 0
                };
              }, token);
              
              if (tokenSet.success) {
                logger.info(`Turnstile token set successfully (API: ${tokenSet.apiSuccess ? 'yes' : 'no'}, length: ${tokenSet.tokenLength})`);
                actions.push('Turnstile token set and events triggered');
                
                // Wait longer for Turnstile to process and verify token
                await page.waitForTimeout(3000);
                
                // Verify the token is still there and check for success indicators
                const tokenStatus = await page.evaluate(() => {
                  const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                  const hasToken = !!(responseInput && responseInput.value && responseInput.value.length > 0);
                  
                  // Check for Turnstile success indicators
                  const turnstileWidget = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
                  const widgetClass = turnstileWidget?.className || '';
                  const isSuccess = widgetClass.includes('success') || widgetClass.includes('complete') || 
                                   turnstileWidget?.getAttribute('data-state') === 'success';
                  
                  // Check if iframe shows success
                  const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
                  const iframeLoaded = iframe ? (iframe as HTMLIFrameElement).contentWindow !== null : false;
                  
                  return {
                    hasToken,
                    tokenLength: responseInput?.value?.length || 0,
                    isSuccess,
                    widgetClass,
                    iframeLoaded
                  };
                });
                
                if (tokenStatus.hasToken) {
                  logger.info(`Turnstile token verified after setting (length: ${tokenStatus.tokenLength}, success state: ${tokenStatus.isSuccess})`);
                  actions.push('Turnstile token verified');
                  
                  // Wait additional time for Turnstile to fully process
                  if (!tokenStatus.isSuccess) {
                    logger.info('Waiting for Turnstile to show success state...');
                    await page.waitForTimeout(2000);
                  }
                } else {
                  logger.warn('Turnstile token was cleared after setting - may need manual interaction');
                  actions.push('Warning: Turnstile token was cleared');
                }
              } else {
                logger.warn(`Failed to set Turnstile token: ${tokenSet.reason || 'unknown'}`);
                actions.push('Failed to set Turnstile token');
              }
              
              // Skip the rest of the Turnstile handling since we solved it
              // Continue to form submission - no need to wait for Turnstile anymore
            } else {
              // Token not received, fall through to manual handling
              logger.warn('Turnstile-Solver did not return a token');
              actions.push('Turnstile-Solver did not return token, using manual handling');
            }
          } catch (error) {
            logger.warn(`Turnstile-Solver failed: ${error instanceof Error ? error.message : String(error)}`);
            logger.info('Falling back to manual Turnstile handling...');
            actions.push('Turnstile-Solver unavailable, using manual handling');
            // Continue with manual handling below
          }
        }
        
        } // End of "if we don't have a token yet" block
        
        // Final check: Do we have a token now (either from implicit pass or active solving)?
        const tokenAlreadySet = await page.evaluate(() => {
          const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
          return !!(responseInput && responseInput.value && responseInput.value.length > 0);
        });
        
        if (!tokenAlreadySet) {
          logger.info('Cloudflare Turnstile detected, attempting to interact manually...');
          actions.push('Cloudflare Turnstile detected - manual handling');
        
        // Try to click on the Turnstile widget to trigger it (improved method)
        try {
          // First, try to find the iframe and click through it
          const iframe = await page.$('iframe[src*="challenges.cloudflare.com"]');
          if (iframe) {
            // Get iframe bounding box and click in the center
            const box = await iframe.boundingBox();
            if (box) {
              await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              actions.push('Clicked on Turnstile iframe (center)');
              await page.waitForTimeout(3000); // Wait longer after click
              
              // Check if token appeared
              const tokenAfterClick = await page.evaluate(() => {
                const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                return !!(responseInput && responseInput.value && responseInput.value.length > 0);
              });
              
              if (tokenAfterClick) {
                logger.info('Turnstile token received after iframe click');
                actions.push('Turnstile token received after iframe click');
              }
            }
          }
          
          // Also try clicking the widget container directly
          const turnstileClicked = await page.evaluate(() => {
            const turnstile = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
            if (turnstile) {
              // Try clicking on the widget container
              (turnstile as HTMLElement).click();
              return true;
            }
            return false;
          });
          
          if (turnstileClicked) {
            actions.push('Clicked on Turnstile widget container');
            await page.waitForTimeout(3000); // Wait longer after click
          }
        } catch (error) {
          logger.debug(`Could not click Turnstile widget: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Try clicking on the iframe (though this usually doesn't work due to cross-origin)
        if (turnstileInfo.hasIframe) {
          try {
            const iframe = await page.$('.cf-turnstile iframe, [class*="cf-turnstile"] iframe');
            if (iframe) {
              await iframe.click({ timeout: 2000 }).catch(() => {
                logger.debug('Could not click Turnstile iframe (expected - cross-origin restriction)');
              });
              await page.waitForTimeout(2000);
            }
          } catch {
            // Expected to fail due to cross-origin restrictions
          }
        }
        
        // Wait for Turnstile response token to be set or callback to be called
        try {
          await page.waitForFunction(() => {
            // Check if Turnstile response input has a value
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            if (responseInput && responseInput.value && responseInput.value.length > 0) {
              return true;
            }
            // Check if callback was called
            if ((window as any).__turnstileSuccess === true) {
              return true;
            }
            // Check if callback function exists and was called
            if (typeof (window as any).onRegisterTurnstileSuccess === 'function') {
              // Check if it was already called by looking for success indicators
              const responseInput2 = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
              return !!(responseInput2 && responseInput2.value && responseInput2.value.length > 0);
            }
            return false;
          }, {
            timeout: 45000, // Wait up to 45 seconds (Turnstile can take time)
            polling: 2000 // Check every 2 seconds
          });
          
          logger.info('Cloudflare Turnstile completed successfully');
          actions.push('Cloudflare Turnstile completed');
        } catch {
          // If timeout, wait a bit more and check if we can proceed anyway
          logger.warn('Cloudflare Turnstile timeout, waiting additional time...');
          await page.waitForTimeout(15000); // Wait 15 more seconds
          
          // Check if response token exists anyway
          const hasToken = await page.evaluate(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            return !!(responseInput && responseInput.value && responseInput.value.length > 0);
          });
          
          if (hasToken) {
            logger.info('Cloudflare Turnstile token found (after extended wait)');
            actions.push('Cloudflare Turnstile token found (after extended wait)');
          } else {
            logger.warn('Cloudflare Turnstile may not be completed - token not found');
            actions.push('Warning: Cloudflare Turnstile may not be completed - form submission may fail');
            
            // Try to trigger Turnstile manually one more time
            try {
              await page.evaluate(() => {
                // Try to find and trigger the Turnstile widget
                const turnstile = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
                if (turnstile) {
                  // Dispatch click event
                  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                  turnstile.dispatchEvent(event);
                  
                  // Also try mousedown and mouseup
                  turnstile.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                  turnstile.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                }
              });
              await page.waitForTimeout(5000);
              
              // Check again
              const hasTokenAfterClick = await page.evaluate(() => {
                const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                return !!(responseInput && responseInput.value && responseInput.value.length > 0);
              });
              
              if (hasTokenAfterClick) {
                actions.push('Cloudflare Turnstile completed after manual trigger');
              }
            } catch {
              // Ignore errors
            }
          }
        }
        } // Close if (!tokenAlreadySet) block
      } else {
        // No Turnstile detected, wait a bit anyway for any other protection
        await page.waitForTimeout(3000);
      }

      // Verify all fields are filled before submitting
      logger.info('Verifying all fields are filled...');
      const fieldsFilled = await page.evaluate(() => {
        const usernameField = document.querySelector('input[name="reg-username"]') as HTMLInputElement;
        const passwordField = document.querySelector('input[name="reg-password"]') as HTMLInputElement;
        const confirmPasswordField = document.querySelector('input[name="password_again"], input[id="password-confirmation"]') as HTMLInputElement;
        
        return {
          username: usernameField?.value || '',
          password: passwordField?.value || '',
          confirmPassword: confirmPasswordField?.value || '',
          allFilled: !!(usernameField?.value && passwordField?.value && confirmPasswordField?.value)
        };
      });
      
      if (!fieldsFilled.allFilled) {
        logger.warn(`Fields not all filled: username=${fieldsFilled.username ? 'filled' : 'empty'}, password=${fieldsFilled.password ? 'filled' : 'empty'}, confirm=${fieldsFilled.confirmPassword ? 'filled' : 'empty'}`);
        actions.push('Warning: Some fields may not be filled correctly');
      } else {
        actions.push('All fields verified as filled');
      }
      
      // Wait a bit for form validation to complete
      await page.waitForTimeout(2000 + Math.random() * 1000);
      
      // Final check: Ensure Cloudflare Turnstile is completed before submitting
      logger.info('Final check: Verifying Cloudflare Turnstile is completed...');
      const turnstileStatus = await page.evaluate(() => {
        const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
        const hasToken = !!(responseInput && responseInput.value && responseInput.value.length > 0);
        
        // Check for Turnstile success indicators
        const turnstileWidget = document.querySelector('.cf-turnstile, [class*="cf-turnstile"], [data-sitekey]');
        const widgetState = turnstileWidget?.getAttribute('data-state') || '';
        const widgetClass = turnstileWidget?.className || '';
        const isSuccess = widgetState === 'success' || widgetClass.includes('success') || widgetClass.includes('complete');
        
        // Check if Turnstile callback was called
        const callbackCalled = !!(window as any).__turnstileSuccess || 
                              !!(window as any).__turnstileCallbackCalled;
        
        return {
          hasInput: !!responseInput,
          hasToken,
          tokenLength: responseInput?.value?.length || 0,
          isSuccess,
          widgetState,
          callbackCalled
        };
      });
      
      if (turnstileStatus.hasInput && !turnstileStatus.hasToken) {
        logger.warn('Cloudflare Turnstile token not found before submit - waiting additional time...');
        actions.push('Waiting for Cloudflare Turnstile token before submit');
        
        // Wait up to 30 more seconds for Turnstile to complete
        try {
          await page.waitForFunction(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            return !!(responseInput && responseInput.value && responseInput.value.length > 0);
          }, {
            timeout: 30000,
            polling: 2000
          });
          
          logger.info('Cloudflare Turnstile token found after additional wait');
          actions.push('Cloudflare Turnstile token found - ready to submit');
        } catch {
          logger.warn('Cloudflare Turnstile still not completed - attempting submit anyway (may fail)');
          actions.push('Warning: Submitting without Turnstile token (may fail)');
        }
      } else if (turnstileStatus.hasToken) {
        // Token exists - wait additional time to ensure Turnstile has verified it
        logger.info(`Cloudflare Turnstile token verified (length: ${turnstileStatus.tokenLength}, success: ${turnstileStatus.isSuccess}, callback: ${turnstileStatus.callbackCalled})`);
        
        // If token was set via 2Captcha, wait longer for Turnstile to verify
        if (!turnstileStatus.isSuccess && !turnstileStatus.callbackCalled) {
          logger.info('Waiting for Turnstile to verify token (2Captcha token needs verification)...');
          await page.waitForTimeout(5000); // Wait 5 more seconds for verification
          
          // Check again
          const recheck = await page.evaluate(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            const turnstileWidget = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
            return {
              hasToken: !!(responseInput && responseInput.value && responseInput.value.length > 0),
              isSuccess: turnstileWidget?.getAttribute('data-state') === 'success' || 
                       (turnstileWidget?.className || '').includes('success')
            };
          });
          
          if (recheck.hasToken && recheck.isSuccess) {
            logger.info('Turnstile token verified and accepted by widget');
            actions.push('Turnstile token verified and accepted - ready to submit');
          } else if (recheck.hasToken) {
            logger.info('Turnstile token present but widget not showing success - proceeding anyway');
            actions.push('Turnstile token present - proceeding with submit');
          }
        } else {
          actions.push('Cloudflare Turnstile token verified - ready to submit');
        }
      } else {
        logger.info('No Cloudflare Turnstile detected - proceeding with submit');
        actions.push('No Turnstile detected - proceeding');
      }

      // Submit form - look for submit button in dialog/modal
      const submitSelectors = [
        // Retrotales specific
        'button#register-submit-btn',
        'button[id="register-submit-btn"]',
        // Generic selectors
        'button[type="submit"]:not([disabled])',
        'button:has-text("Continue")',
        'button:has-text("Register")',
        'button:has-text("Sign Up")',
        'button:has-text("Create Account")',
        'button:has-text("Submit")',
        'button[class*="submit" i]:not([disabled])',
        'button[class*="register" i]:not([disabled])',
        'dialog button[type="submit"]:not([disabled])',
        '[role="dialog"] button[type="submit"]:not([disabled])',
        '.modal button[type="submit"]:not([disabled])'
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          // Wait for button to be visible and enabled
          const submitButton = await page.waitForSelector(selector, { 
            timeout: 5000, 
            state: 'visible' 
          });
          
          if (submitButton) {
            // Check if button is enabled (not disabled)
            const isEnabled = await page.evaluate((sel) => {
              const btn = document.querySelector(sel);
              return btn && !(btn as HTMLButtonElement).disabled;
            }, selector);
            
            if (isEnabled) {
              await page.click(selector, { timeout: 5000 });
              actions.push('Submitted form');
              submitted = true;
              await page.waitForTimeout(3000); // Wait for form submission
              break;
            } else {
              // Button exists but is disabled - wait for it to become enabled
              logger.info('Submit button is disabled, waiting for it to become enabled...');
              try {
                await page.waitForFunction(
                  (sel) => {
                    const btn = document.querySelector(sel);
                    return btn && !(btn as HTMLButtonElement).disabled;
                  },
                  selector,
                  { timeout: 10000 }
                );
                await page.click(selector, { timeout: 5000 });
                actions.push('Submitted form (waited for button to be enabled)');
                submitted = true;
                await page.waitForTimeout(3000);
                break;
              } catch {
                logger.warn(`Button ${selector} remained disabled`);
                continue;
              }
            }
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
          actions.push('Could not submit form - no submit button found or button remained disabled');
        }
      }

      const finalPassword = validPassword || password;
      
      // Verify that form was actually submitted by checking for success indicators
      let formSubmitted = submitted;
      let successIndicators: string[] = [];
      
      if (submitted) {
        // Wait a bit for page to react
        await page.waitForTimeout(2000);
        
        // Check for success indicators
        try {
          const successCheck = await page.evaluate(() => {
            const indicators = {
              hasSuccessMessage: document.body.innerText.toLowerCase().includes('success') ||
                               document.body.innerText.toLowerCase().includes('created') ||
                               document.body.innerText.toLowerCase().includes('registered') ||
                               document.body.innerText.toLowerCase().includes('welcome'),
              modalClosed: !document.querySelector('dialog[open], .modal:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])'),
              urlChanged: window.location.href !== window.location.origin + '/',
              hasError: document.body.innerText.toLowerCase().includes('error') ||
                       document.body.innerText.toLowerCase().includes('failed') ||
                       document.body.innerText.toLowerCase().includes('invalid')
            };
            return indicators;
          });
          
          if (successCheck.hasSuccessMessage) {
            successIndicators.push('Success message detected');
            formSubmitted = true;
          } else if (successCheck.modalClosed && successCheck.urlChanged) {
            successIndicators.push('Modal closed and URL changed');
            formSubmitted = true;
          } else if (successCheck.hasError) {
            successIndicators.push('Error message detected - form may not have been submitted');
            formSubmitted = false;
          } else {
            successIndicators.push('No clear success/error indicators');
          }
        } catch {
          // Could not verify, assume submitted if button was clicked
        }
      }
      
      const message = formSubmitted 
        ? `Registration form filled and submitted successfully. Actions: ${actions.join(', ')}. ${successIndicators.length > 0 ? `Verification: ${successIndicators.join(', ')}.` : ''} ${finalPassword !== password ? `Note: Password was adjusted to meet requirements (${finalPassword}).` : ''}`
        : `Registration form filled but submission may have failed. Actions: ${actions.join(', ')}. ${successIndicators.length > 0 ? `Verification: ${successIndicators.join(', ')}.` : ''} ${finalPassword !== password ? `Note: Password was adjusted to meet requirements (${finalPassword}).` : ''}`;
      
      return {
        message,
        data: { 
          actions,
          accountName,
          password: finalPassword,
          passwordAdjusted: finalPassword !== password,
          formSubmitted,
          successIndicators
        }
      };
    } catch (error) {
      return {
        message: `Partially completed. Actions: ${actions.join(', ')}. Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        data: { actions, error: error instanceof Error ? error.message : 'Unknown' }
      };
    }
  }

  /**
   * Solve Cloudflare Turnstile using direct Python execution (no API server needed)
   * @param url The URL where the Turnstile is located
   * @param sitekey The Turnstile sitekey
   * @param timeoutMs Optional timeout in milliseconds (default: 120000 = 2 minutes)
   * @returns The Turnstile token if solved successfully, null otherwise
   */
  private async solveTurnstileDirect(url: string, sitekey: string, timeoutMs: number = 120000): Promise<string | null> {
    const solverScript = join(this.turnstileSolverPath, 'async_solver.py');
    
    try {
      // Check if solver script exists
      const fs = await import('fs/promises');
      try {
        await fs.access(solverScript);
      } catch {
        logger.debug('Turnstile-Solver script not found, skipping direct execution');
        return null;
      }

      logger.info(`Solving Turnstile directly using Python (url: ${url}, sitekey: ${sitekey})`);
      
      // Try to ensure Python dependencies are installed (runtime fallback)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const requirementsPath = join(this.turnstileSolverPath, 'requirements.txt');
      
      try {
        // Quick check if camoufox is importable
        const checkProc = spawn(pythonCmd, ['-c', 'import camoufox'], {
          cwd: this.turnstileSolverPath,
          env: { ...process.env },
          stdio: 'pipe',
        });
        
        let checkOutput = '';
        checkProc.stdout?.on('data', (data) => {
          checkOutput += data.toString();
        });
        checkProc.stderr?.on('data', (data) => {
          checkOutput += data.toString();
        });
        
        await new Promise<void>((resolve) => {
          const checkTimeout = setTimeout(() => {
            checkProc.kill('SIGKILL');
            logger.debug('Dependency check timed out, proceeding with chromium fallback');
            resolve();
          }, 3000); // 3 second timeout for check
          
          checkProc.on('exit', (code) => {
            clearTimeout(checkTimeout);
            if (code !== 0) {
              // camoufox not available, try to install (but don't wait too long)
              logger.warn('Python dependencies not found, attempting runtime installation...');
              const installProc = spawn(pythonCmd, ['-m', 'pip', 'install', '--user', '-r', 'requirements.txt'], {
                cwd: this.turnstileSolverPath,
                env: { ...process.env },
                stdio: 'pipe',
              });
              
              let installOutput = '';
              installProc.stdout?.on('data', (data) => {
                installOutput += data.toString();
              });
              installProc.stderr?.on('data', (data) => {
                installOutput += data.toString();
              });
              
              const installTimeout = setTimeout(() => {
                installProc.kill('SIGKILL');
                logger.warn('Python dependency installation timed out, will use chromium fallback');
                resolve();
              }, 30000); // 30 second timeout for installation
              
              installProc.on('exit', (installCode) => {
                clearTimeout(installTimeout);
                if (installCode === 0) {
                  logger.info('Python dependencies installed successfully at runtime');
                } else {
                  logger.warn(`Failed to install Python dependencies at runtime (code: ${installCode})`);
                  if (installOutput) {
                    logger.debug(`Install output: ${installOutput.substring(0, 500)}`);
                  }
                }
                resolve();
              });
              
              installProc.on('error', (err) => {
                clearTimeout(installTimeout);
                logger.warn(`Error during Python dependency installation: ${err.message}`);
                resolve();
              });
            } else {
              logger.debug('Python dependencies (camoufox) are available');
              resolve();
            }
          });
          
          checkProc.on('error', (err) => {
            clearTimeout(checkTimeout);
            logger.debug(`Dependency check error: ${err.message}, proceeding with chromium fallback`);
            resolve();
          });
        });
      } catch (error) {
        logger.debug(`Dependency check failed, proceeding anyway: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Use standalone solve script
      const solveScript = join(this.turnstileSolverPath, 'solve_turnstile.py');
      
      return new Promise((resolve) => {
        const proc = spawn(pythonCmd, [solveScript, url, sitekey], {
          cwd: this.turnstileSolverPath,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
            logger.warn(`Turnstile-Solver direct execution timed out after ${timeoutMs}ms`);
          } catch (killError) {
            logger.debug(`Error killing Turnstile-Solver process: ${killError instanceof Error ? killError.message : String(killError)}`);
          }
          resolve(null);
        }, timeoutMs);

        proc.on('exit', (code, signal) => {
          clearTimeout(timeout);
          
          if (code === null && signal === 'SIGKILL') {
            // Process was killed by timeout
            logger.debug('Turnstile-Solver process was killed (timeout)');
            resolve(null);
            return;
          }
          
          if (code === 0 && stdout) {
            try {
              const result = JSON.parse(stdout.trim());
              if (result.status === 'success' && result.turnstile_value) {
                logger.info(`Turnstile solved directly in ${result.elapsed_time_seconds || 'unknown'} seconds`);
                resolve(result.turnstile_value);
              } else {
                logger.warn(`Turnstile-Solver returned failure: ${result.reason || result.error || 'unknown'}`);
                if (result.error) {
                  logger.debug(`Turnstile-Solver error details: ${result.error}`);
                }
                resolve(null);
              }
            } catch (parseError) {
              logger.warn(`Failed to parse Turnstile-Solver output: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
              if (stdout) {
                logger.debug(`Turnstile-Solver stdout: ${stdout.substring(0, 500)}`);
              }
              if (stderr) {
                logger.debug(`Turnstile-Solver stderr: ${stderr.substring(0, 500)}`);
              }
              resolve(null);
            }
          } else {
            // Non-zero exit code or no stdout
            const errorMsg = stderr || stdout || 'No output';
            logger.warn(`Turnstile-Solver exited with code ${code}${signal ? ` (signal: ${signal})` : ''}: ${errorMsg.substring(0, 200)}`);
            if (stderr && stderr.length > 0) {
              logger.debug(`Turnstile-Solver stderr: ${stderr.substring(0, 500)}`);
            }
            resolve(null);
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeout);
          logger.warn(`Turnstile-Solver execution error: ${error.message}`);
          resolve(null);
        });
      });
    } catch (error) {
      logger.warn(`Turnstile-Solver direct execution failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Solve Cloudflare Turnstile using Turnstile-Solver API (fallback if API server is running)
   * @param url The URL where the Turnstile is located
   * @param sitekey The Turnstile sitekey
   * @returns The Turnstile token if solved successfully, null otherwise
   */
  private async solveTurnstileWithAPI(url: string, sitekey: string): Promise<string | null> {
    if (!this.turnstileSolverApiUrl) {
      return null;
    }
    if (!this.turnstileSolverApiUrl) {
      return null;
    }

    try {
      // Step 1: Request Turnstile solution
      const solveUrl = `${this.turnstileSolverApiUrl}/turnstile?url=${encodeURIComponent(url)}&sitekey=${encodeURIComponent(sitekey)}`;
      logger.info(`Requesting Turnstile solution from API: ${solveUrl}`);
      
      // Create AbortController for timeout
      const solveController = new AbortController();
      const solveTimeout = setTimeout(() => solveController.abort(), 30000);
      
      const solveResponse = await fetch(solveUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: solveController.signal,
      });
      
      clearTimeout(solveTimeout);

      if (!solveResponse.ok) {
        logger.warn(`Turnstile-Solver API returned error: ${solveResponse.status} ${solveResponse.statusText}`);
        return null;
      }

      const solveData = await solveResponse.json();
      const taskId = solveData.task_id;

      if (!taskId) {
        logger.warn('Turnstile-Solver API did not return a task_id');
        return null;
      }

      logger.info(`Turnstile solving task created: ${taskId}`);

      // Step 2: Poll for result (max 2 minutes)
      const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
      const pollInterval = 2000; // 2 seconds between polls

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const resultUrl = `${this.turnstileSolverApiUrl}/result?id=${encodeURIComponent(taskId)}`;
        // Create AbortController for timeout
        const resultController = new AbortController();
        const resultTimeout = setTimeout(() => resultController.abort(), 5000);
        
        const resultResponse = await fetch(resultUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: resultController.signal,
        });
        
        clearTimeout(resultTimeout);

        if (!resultResponse.ok) {
          logger.debug(`Result poll attempt ${attempt + 1} failed: ${resultResponse.status}`);
          continue;
        }

        const resultData = await resultResponse.json();

        // Check if we have a token
        if (resultData.value && typeof resultData.value === 'string' && resultData.value.length > 0) {
          logger.info(`Turnstile solved in ${resultData.elapsed_time || 'unknown'} seconds`);
          return resultData.value;
        }

        // If we get an error response, stop polling
        if (resultData.error) {
          logger.warn(`Turnstile-Solver API error: ${resultData.error}`);
          return null;
        }

        // Continue polling if no result yet
        logger.debug(`Turnstile solving in progress... (attempt ${attempt + 1}/${maxAttempts})`);
      }

      logger.warn('Turnstile solving timed out after maximum attempts');
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Turnstile-Solver API request timed out');
      } else {
        logger.warn(`Turnstile-Solver API error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }

  /**
   * Solve Cloudflare Turnstile using 2Captcha service (paid service, reliable fallback)
   * Uses the new 2Captcha API v2 (createTask/getTaskResult)
   * @param url The URL where the Turnstile is located
   * @param sitekey The Turnstile sitekey
   * @param action Optional action parameter (for Cloudflare Challenge pages)
   * @param cData Optional cData parameter (for Cloudflare Challenge pages)
   * @param chlPageData Optional chlPageData parameter (for Cloudflare Challenge pages)
   * @returns The Turnstile token if solved successfully, null otherwise
   */
  private async solveTurnstileWith2Captcha(
    url: string, 
    sitekey: string, 
    action?: string, 
    cData?: string, 
    chlPageData?: string
  ): Promise<string | null> {
    const apiKey = process.env.TWOCAPTCHA_API_KEY || process.env.CAPTCHA_API_KEY || '21011299571af0a6a09db29cdec3249f';
    
    if (!apiKey) {
      logger.debug('2Captcha API key not configured, skipping 2Captcha solver');
      return null;
    }

    try {
      logger.info(`Solving Turnstile using 2Captcha API v2 (url: ${url}, sitekey: ${sitekey})`);
      
      // Step 1: Create task using new API
      const createTaskUrl = 'https://api.2captcha.com/createTask';
      
      const taskPayload: any = {
        type: 'TurnstileTaskProxyless',
        websiteURL: url,
        websiteKey: sitekey
      };
      
      // Add optional parameters for Cloudflare Challenge pages
      if (action) {
        taskPayload.action = action;
      }
      if (cData) {
        taskPayload.data = cData;
      }
      if (chlPageData) {
        taskPayload.pagedata = chlPageData;
      }

      const createTaskResponse = await fetch(createTaskUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientKey: apiKey,
          task: taskPayload
        }),
      });

      const createTaskData = await createTaskResponse.json();
      
      if (createTaskData.errorId !== 0) {
        logger.warn(`2Captcha task creation failed: ${createTaskData.errorCode || 'Unknown error'} - ${createTaskData.errorDescription || ''}`);
        return null;
      }

      const taskId = createTaskData.taskId;
      logger.info(`2Captcha task created: ${taskId}`);

      // Step 2: Poll for result (max 2 minutes, check every 5 seconds)
      // According to 2Captcha docs: wait at least 5 seconds before first poll
      const maxAttempts = 24; // 24 attempts * 5 seconds = 2 minutes max
      const pollInterval = 5000; // 5 seconds between polls (2Captcha recommendation)
      const getTaskResultUrl = 'https://api.2captcha.com/getTaskResult';

      // Wait before first poll (2Captcha recommendation: at least 5 seconds)
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Wait between polls (except before first poll which we already did)
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        const getTaskResultResponse = await fetch(getTaskResultUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientKey: apiKey,
            taskId: taskId
          }),
        });

        const resultData = await getTaskResultResponse.json();

        if (resultData.errorId !== 0) {
          logger.warn(`2Captcha returned error: ${resultData.errorCode || 'Unknown'} - ${resultData.errorDescription || ''}`);
          return null;
        }

        // Handle status according to 2Captcha API v2 specification
        // Status should be: 0 (processing) or 1 (ready)
        // But API sometimes returns strings, so we handle both
        const status = resultData.status;
        const statusNum = typeof status === 'string' ? parseInt(status, 10) : status;
        const statusStr = String(status).toLowerCase();
        
        // Check if ready (status === 1 or "ready" or "1")
        const isReady = statusNum === 1 || statusStr === 'ready' || statusStr === '1';
        // Check if processing (status === 0 or "processing" or "0")
        const isProcessing = statusNum === 0 || statusStr === 'processing' || statusStr === '0';

        if (isReady) {
          // Check if we have a token
          const token = resultData.solution?.token;
          if (token) {
            // Success! Token received
            const solveTime = resultData.endTime && resultData.createTime 
              ? resultData.endTime - resultData.createTime 
              : (attempt + 1) * pollInterval / 1000;
            logger.info(`2Captcha solved Turnstile successfully in ${solveTime} seconds (cost: ${resultData.cost || 'unknown'})`);
            return token;
          } else {
            // Status is ready but no token - this shouldn't happen, but log it
            logger.warn(`2Captcha status is ready but no token in solution (attempt ${attempt + 1}/${maxAttempts})`);
            // Continue polling in case token arrives in next response
            if (attempt < maxAttempts - 1) {
              continue;
            } else {
              return null;
            }
          }
        } else if (isProcessing) {
          // Still processing, continue polling
          logger.debug(`2Captcha task ${taskId} processing... (attempt ${attempt + 1}/${maxAttempts}, status: ${status})`);
          continue;
        } else {
          // Unknown status - log for debugging
          logger.debug(`2Captcha returned status: ${status} (type: ${typeof status}, attempt ${attempt + 1}/${maxAttempts})`);
          // Log full response for debugging
          if (attempt === 0) {
            logger.debug(`2Captcha first response: ${JSON.stringify(resultData).substring(0, 500)}`);
          }
          // Continue polling in case it's a transient state or different format
          if (attempt < maxAttempts - 1) {
            continue;
          } else {
            logger.warn(`2Captcha task ${taskId} ended with unknown status: ${status} after ${maxAttempts} attempts`);
            return null;
          }
        }
      }

      // Timeout
      logger.warn(`2Captcha task ${taskId} timed out after ${maxAttempts * pollInterval / 1000} seconds`);
      return null;
    } catch (error) {
      logger.warn(`2Captcha API error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
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

