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
    proxy?: {
      server: string; // e.g., "http://proxy.example.com:8080"
      username?: string;
      password?: string;
    } | string; // Simple string format: "http://proxy.example.com:8080" or "http://user:pass@proxy.example.com:8080"
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
  private turnstileSolverPath: string;

  private constructor() {
    this.multiModelAI = new MultiModelAIService();
    // Path to turnstile-solver directory (kept for potential future use)
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
              // IMPORTANT: Enable GPU/WebGL for better fingerprinting (helps Turnstile implicit pass)
              '--enable-webgl',
              '--use-gl=swiftshader', // Use SwiftShader for WebGL in headless
              '--enable-webgl2',
              '--no-first-run',
              '--no-zygote',
              // Don't disable GPU - it causes WebGL fallback warnings that hurt fingerprinting
              '--enable-features=VaapiVideoDecoder'
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

    // Enhanced stealth script to improve browser fingerprint for Turnstile implicit pass
    // This helps avoid session mismatch by making browser look more legitimate
    await page.addInitScript(() => {
      // Remove webdriver flag (CRITICAL for Turnstile)
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });

      // Override plugins with realistic data
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ];
          return plugins as any;
        },
        configurable: true
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Mock chrome object (important for fingerprinting)
      (window as any).chrome = {
        runtime: {},
        app: {
          isInstalled: false
        }
      };

      // Override getBattery to return realistic values (if available)
      const nav = navigator as any;
      if (nav.getBattery) {
        const originalGetBattery = nav.getBattery;
        nav.getBattery = function() {
          return originalGetBattery.call(navigator).catch(() => {
            return Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1
            });
          });
        };
      }

      // Spoof connection type for better fingerprint
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        }),
        configurable: true
      });

      // Override deviceMemory if available
      if ((navigator as any).deviceMemory !== undefined) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
          configurable: true
        });
      }

      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4,
        configurable: true
      });

      // Add missing properties that Turnstile might check
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      });
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
   * Fetch proxy from Webshare API
   * Returns proxy in format: { server: string, username?: string, password?: string }
   * Supports rotating proxies by randomly selecting one from the list
   */
  private async fetchProxyFromAPI(): Promise<{ server: string; username?: string; password?: string } | null> {
    const proxyApiKey = process.env.WEBSHARE_PROXY_API_KEY || process.env.PROXY_API_KEY;
    
    if (!proxyApiKey) {
      return null; // No proxy API key configured
    }

    try {
      logger.info('Fetching proxy from Webshare API...');
      
      // Webshare API endpoint for proxy list
      const proxyListUrl = 'https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page_size=100';
      
      const response = await fetch(proxyListUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${proxyApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('Webshare API authentication failed - check your API key');
        } else if (response.status === 429) {
          logger.warn('Webshare API rate limit exceeded - waiting 60 seconds before retry');
        } else {
          logger.warn(`Webshare API returned status ${response.status}`);
        }
        return null;
      }

      const data = await response.json();
      
      // Webshare API returns: { count: number, next: string | null, previous: string | null, results: Array }
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        logger.warn('No proxies available from Webshare API');
        return null;
      }

      // Randomly select a proxy from the list (for rotation)
      const randomProxy = data.results[Math.floor(Math.random() * data.results.length)];
      
      // Webshare proxy format: { proxy_address: "ip:port", username: string, password: string, ... }
      // or: { ip: string, port: number, username: string, password: string, ... }
      let proxyServer: string;
      
      if (randomProxy.proxy_address) {
        // Format: "ip:port" - proxy_address already contains both IP and port
        // Ensure it has http:// prefix
        proxyServer = randomProxy.proxy_address.includes('://') 
          ? randomProxy.proxy_address 
          : `http://${randomProxy.proxy_address}`;
      } else if (randomProxy.ip && randomProxy.port) {
        // Format: separate ip and port
        const protocol = randomProxy.type === 'socks5' ? 'socks5' : randomProxy.type || 'http';
        proxyServer = `${protocol}://${randomProxy.ip}:${randomProxy.port}`;
      } else {
        // Log proxy object for debugging
        logger.warn(`Unsupported proxy format from Webshare API. Proxy object keys: ${Object.keys(randomProxy).join(', ')}`);
        logger.debug(`Proxy object: ${JSON.stringify(randomProxy).substring(0, 500)}`);
        return null;
      }

      const proxyConfig: { server: string; username?: string; password?: string } = {
        server: proxyServer,
      };

      // Add authentication if provided
      if (randomProxy.username) {
        proxyConfig.username = randomProxy.username;
      }
      if (randomProxy.password) {
        proxyConfig.password = randomProxy.password;
      }

      // Validate proxy configuration before returning
      if (!proxyConfig.server || !proxyConfig.server.includes('://')) {
        logger.warn(`Invalid proxy server format: ${proxyConfig.server}`);
        return null;
      }

      const proxyInfo = randomProxy.proxy_address || `${randomProxy.ip}:${randomProxy.port}`;
      const location = randomProxy.country ? ` (${randomProxy.country}${randomProxy.city ? `, ${randomProxy.city}` : ''})` : '';
      const authInfo = proxyConfig.username ? ' (authenticated)' : ' (no auth)';
      logger.info(`✅ Selected Webshare proxy: ${proxyInfo}${location}${authInfo} (${data.results.length} available on this page, ${data.count || '?'} total in account)`);
      logger.debug(`Proxy config: server=${proxyConfig.server}, username=${proxyConfig.username ? '***' : 'none'}, password=${proxyConfig.password ? '***' : 'none'}`);
      return proxyConfig;
    } catch (error) {
      logger.warn(`Failed to fetch proxy from Webshare API: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get proxy configuration from task options, environment variable, or API
   */
  private async getProxyConfig(task: BrowserUseTask): Promise<{ server: string; username?: string; password?: string } | undefined> {
    // Priority 1: Explicit proxy in task options
    if (task.options?.proxy) {
      if (typeof task.options.proxy === 'string') {
        const proxyUrl = new URL(task.options.proxy);
        return {
          server: `${proxyUrl.protocol}//${proxyUrl.host}`,
          username: proxyUrl.username || undefined,
          password: proxyUrl.password || undefined,
        };
      }
      return task.options.proxy;
    }

    // Priority 2: Environment variable
    const envProxy = process.env.PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (envProxy) {
      try {
        const proxyUrl = new URL(envProxy);
        return {
          server: `${proxyUrl.protocol}//${proxyUrl.host}`,
          username: proxyUrl.username || process.env.PROXY_USERNAME || undefined,
          password: proxyUrl.password || process.env.PROXY_PASSWORD || undefined,
        };
      } catch {
        logger.warn('Invalid PROXY_URL format in environment variable');
      }
    }

    // Priority 3: Fetch from API (for rotating proxies)
    const apiProxy = await this.fetchProxyFromAPI();
    return apiProxy || undefined;
  }

  /**
   * Execute a browser automation task using Playwright
   */
  async executeTask(task: BrowserUseTask): Promise<BrowserUseResult> {
    let browserPage: Page | null = null;
    try {
      logger.info(`Executing browser task: ${task.task} on ${task.url}`);

      const browser = await this.getBrowser();
      
      // Get proxy configuration (from task, env var, or API)
      const proxyConfig = await this.getProxyConfig(task);
      if (proxyConfig) {
        logger.info(`Using proxy: ${proxyConfig.server}${proxyConfig.username ? ' (authenticated)' : ''} - This significantly improves Turnstile implicit pass rate!`);
      } else {
        logger.debug('No proxy configured - using direct connection (datacenter IP may reduce Turnstile implicit pass rate)');
      }
      
      // Create browser context with realistic settings (critical for Turnstile implicit pass)
      // Based on research: Turnstile often gives implicit pass with good fingerprints
      // Using residential proxy significantly improves implicit pass rate
      // Try with proxy first, but fallback to direct connection if proxy fails
      let browserContext;
      const contextConfig: any = {
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
      };
      
      // Add proxy configuration if provided (CRITICAL for improving Turnstile implicit pass rate)
      // Residential proxies make the browser look more legitimate to Cloudflare
      if (proxyConfig) {
        contextConfig.proxy = proxyConfig;
      }
      
      browserContext = await browser.newContext(contextConfig);
      
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
        } catch (navError: any) {
          // Check if it's a proxy connection error
          const errorMessage = navError?.message || String(navError);
          if (errorMessage.includes('ERR_PROXY_CONNECTION_FAILED') || errorMessage.includes('proxy')) {
            logger.warn('Proxy connection failed, retrying without proxy (fallback to direct connection)...');
            
            // Close current context and page
            try {
              await browserPage.close();
              await browserContext.close();
            } catch (closeError) {
              // Ignore close errors
            }
            
            // Create new context without proxy
            browserContext = await browser.newContext({
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              locale: 'en-US',
              timezoneId: 'America/New_York',
              extraHTTPHeaders: contextConfig.extraHTTPHeaders
            });
            
            browserPage = await browserContext.newPage();
            await this.setupStealthPage(browserPage, task.url);
            await this.simulateHumanBehavior(browserPage);
            
            // Retry navigation without proxy
            try {
              await browserPage.goto(task.url, { 
                waitUntil: 'load', 
                timeout: navigationTimeout 
              });
              logger.info(`Navigated to ${task.url} (without proxy)`);
            } catch (retryError) {
              logger.warn(`Navigation with 'load' timed out after proxy fallback, trying 'domcontentloaded'...`);
              try {
                await browserPage.goto(task.url, { 
                  waitUntil: 'domcontentloaded', 
                  timeout: navigationTimeout 
                });
                logger.info(`Navigated to ${task.url} (domcontentloaded, without proxy)`);
              } catch (domError) {
                logger.warn(`Navigation with 'domcontentloaded' also timed out, waiting for page...`);
                await browserPage.goto(task.url, { 
                  waitUntil: 'commit', 
                  timeout: navigationTimeout 
                });
                await browserPage.waitForTimeout(3000);
                logger.info(`Navigated to ${task.url} (commit, without proxy)`);
              }
            }
          } else {
            // If it's not a proxy error, try domcontentloaded as before
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
              await browserPage.waitForTimeout(3000);
              logger.info(`Navigated to ${task.url} (commit)`);
            }
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
    
    // Set up console message logging to capture errors and warnings from browser
    const consoleMessages: Array<{ type: string; text: string; url?: string }> = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      // Filter for relevant messages (errors, warnings, and Turnstile-related logs)
      if (type === 'error' || type === 'warning' || 
          text.toLowerCase().includes('turnstile') || 
          text.toLowerCase().includes('captcha') ||
          text.toLowerCase().includes('cf-') ||
          text.toLowerCase().includes('cloudflare')) {
        consoleMessages.push({
          type,
          text,
          url: location?.url
        });
        logger.debug(`[Browser Console ${type.toUpperCase()}]: ${text}${location?.url ? ` (${location.url})` : ''}`);
      }
    });
    
    // Set up network request/response logging
    const networkRequests: Array<{ url: string; method: string; status?: number; statusText?: string }> = [];
    page.on('request', (request) => {
      const url = request.url();
      // Log registration/API requests
      if (url.includes('/register') || url.includes('/signup') || url.includes('/api/') || url.includes('turnstile') || url.includes('challenges.cloudflare.com')) {
        networkRequests.push({
          url,
          method: request.method()
        });
        logger.debug(`[Network Request] ${request.method()} ${url}`);
      }
    });
    
    page.on('response', (response) => {
      const url = response.url();
      // Log registration/API responses
      if (url.includes('/register') || url.includes('/signup') || url.includes('/api/') || url.includes('turnstile') || url.includes('challenges.cloudflare.com')) {
        const existing = networkRequests.find(r => r.url === url && !r.status);
        if (existing) {
          existing.status = response.status();
          existing.statusText = response.statusText();
        } else {
          networkRequests.push({
            url,
            method: response.request().method(),
            status: response.status(),
            statusText: response.statusText()
          });
        }
        logger.debug(`[Network Response] ${response.status()} ${response.statusText()} ${url}`);
      }
    });
    
    // Set up page error logging
    page.on('pageerror', (error) => {
      const errorMessage = error.message;
      logger.warn(`[Page Error]: ${errorMessage}`);
      
      // Special handling for Turnstile Error 600010
      if (errorMessage.includes('Turnstile') && errorMessage.includes('600010')) {
        logger.error('[CRITICAL] Turnstile Error 600010 detected - this usually means the token was rejected by Cloudflare. Possible causes:');
        logger.error('  1. Token from 2Captcha does not match the current browser session/IP');
        logger.error('  2. Token has expired or was already used');
        logger.error('  3. Browser fingerprint does not match the session where token was generated');
        logger.error('  This is a known limitation when using 2Captcha tokens in a different session than where they were generated.');
        actions.push('Turnstile Error 600010: Token rejected by Cloudflare (session mismatch)');
      }
      
      consoleMessages.push({
        type: 'error',
        text: errorMessage,
        url: page.url()
      });
    });

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
      
      // Store whether we successfully set a token via 2Captcha and the token value (accessible throughout function)
      let tokenSetVia2Captcha = false;
      let saved2CaptchaToken: string | null = null;
      
      // Check if Cloudflare Turnstile is present and extract sitekey
      const turnstileInfo = await page.evaluate(() => {
        const turnstile = document.querySelector('.cf-turnstile, [class*="cf-turnstile"]');
        const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
        const iframe = turnstile?.querySelector('iframe');
        
        // Extract sitekey from data-sitekey attribute
        let sitekey: string | null = null;
        let callbackName: string | null = null;
        
        if (turnstile) {
          sitekey = turnstile.getAttribute('data-sitekey') || null;
          // Extract callback name from data-callback attribute
          callbackName = turnstile.getAttribute('data-callback') || null;
          
          // Also check iframe src for sitekey
          if (!sitekey && iframe) {
            const iframeSrc = iframe.getAttribute('src') || '';
            const sitekeyMatch = iframeSrc.match(/0x[0-9A-Za-z_-]+/);
            if (sitekeyMatch) {
              sitekey = sitekeyMatch[0];
            }
          }
        }
        
        // Fallback: check for common callback names if data-callback is not set
        if (!callbackName) {
          if (typeof (window as any).onRegisterTurnstileSuccess === 'function') {
            callbackName = 'onRegisterTurnstileSuccess';
          } else if (typeof (window as any).onLoginTurnstileSuccess === 'function') {
            callbackName = 'onLoginTurnstileSuccess';
          } else if (typeof (window as any).onTurnstileSuccess === 'function') {
            callbackName = 'onTurnstileSuccess';
          }
        }
        
        return {
          hasTurnstile: !!turnstile,
          hasResponseInput: !!responseInput,
          hasToken: !!(responseInput && responseInput.value && responseInput.value.length > 0),
          hasIframe: !!iframe,
          sitekey: sitekey,
          callback: callbackName
        };
      });
      
      logger.info(`Turnstile info: sitekey=${turnstileInfo.sitekey}, callback=${turnstileInfo.callback || 'none'}`);
      
      if (turnstileInfo.hasTurnstile) {
        // CRITICAL STRATEGY: Focus on implicit pass to avoid session mismatch
        // Implicit pass = Turnstile solves in OUR session = no session mismatch
        // 2Captcha causes session mismatch (Error 600010) because token generated in different session
        logger.info('Turnstile detected - focusing on implicit pass strategy (best way to avoid session mismatch)');
        actions.push('Turnstile detected - waiting for implicit pass');
        
        try {
          // Wait for Turnstile to potentially auto-solve (implicit pass)
          // According to research, most Turnstile challenges are implicit
          // Increased timeout to 30 seconds for server IPs (datacenter IPs need more time)
          // Try to improve implicit pass rate by simulating subtle user activity
          
          // CRITICAL: Focus on implicit pass to avoid session mismatch completely
          // Implicit pass = Turnstile solves in OUR session = ZERO session mismatch issues
          // Strategy: Wait longer with realistic user simulation to encourage implicit pass
          
          logger.info('Waiting up to 60 seconds for implicit pass with user simulation...');
          
          // Start realistic user activity simulation (critical for implicit pass)
          let implicitPassSuccess = false;
          const userActivityPromise = (async () => {
            try {
              // Initial wait for page to settle
              await page.waitForTimeout(3000);
              
              // Extended simulation: Simulate reading/interacting with page
              // This helps Turnstile see legitimate user behavior
              for (let i = 0; i < 20; i++) {
                // Natural mouse movements (simulating reading/interaction)
                const x = 300 + Math.sin(i * 0.4) * 100;
                const y = 400 + Math.cos(i * 0.3) * 80;
                await page.mouse.move(x, y, { steps: 8 }); // Smooth movement
                
                // Random delay (human-like timing)
                await page.waitForTimeout(2500 + Math.random() * 1500);
                
                // Periodic scrolling (simulates reading)
                if (i % 4 === 0) {
                  await page.mouse.wheel(0, 30 + Math.random() * 40);
                  await page.waitForTimeout(800 + Math.random() * 400);
                }
                
                // Check if token appeared during activity
                const hasToken = await page.evaluate(() => {
                  const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                  return !!(responseInput && responseInput.value && responseInput.value.length > 0);
                });
                
                if (hasToken) {
                  implicitPassSuccess = true;
                  logger.info(`✅ Implicit pass detected during user simulation (iteration ${i + 1})!`);
                  return; // Token found, exit early
                }
              }
            } catch (err) {
              logger.debug(`User activity simulation error: ${err instanceof Error ? err.message : String(err)}`);
            }
          })();
          
          // Main wait for token (parallel with user simulation)
          try {
            await page.waitForFunction(() => {
              const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
              return !!(responseInput && responseInput.value && responseInput.value.length > 0);
            }, {
              timeout: 60000, // Wait up to 60 seconds for implicit pass (generous timeout)
              polling: 2000 // Check every 2 seconds
            });
            
            implicitPassSuccess = true;
            logger.info('✅ Implicit pass detected during main wait!');
          } catch {
            // Timeout is expected if implicit pass doesn't happen
            logger.debug('Implicit pass timeout after 60 seconds');
          }
          
          // Wait for user activity to finish (or catch errors)
          await userActivityPromise.catch(() => {});
          
          // Final check for token
          const finalTokenCheck = await page.evaluate(() => {
            const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
            return !!(responseInput && responseInput.value && responseInput.value.length > 0);
          });
          
          if (finalTokenCheck || implicitPassSuccess) {
            logger.info('✅ Turnstile implicit pass successful! No session mismatch issues.');
            actions.push('Turnstile implicit pass successful');
            // Skip 2Captcha entirely - we have a token from implicit pass!
            // This avoids session mismatch completely
          }
          
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
          // Timeout waiting for implicit pass - this is expected if implicit pass doesn't work
          logger.info('Implicit pass timeout after extended wait');
          actions.push('Implicit pass timeout');
        }
        
        // Only try 2Captcha if we don't already have a token from implicit pass
        // NOTE: 2Captcha has session mismatch issues (Error 600010), so prefer implicit pass
        const currentToken = await page.evaluate(() => {
          const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
          return responseInput?.value || null;
        });
        
        if (!currentToken || currentToken.length === 0) {
          // CRITICAL: 2Captcha causes Error 600010 (session mismatch) - completely disabled
          // Focus only on implicit pass which solves in our session
          logger.warn('No implicit pass token found after extended wait. 2Captcha completely disabled (causes Error 600010). Proceeding with form submission - some sites may accept forms even without explicit Turnstile token.');
          actions.push('No implicit pass - proceeding without token (2Captcha disabled due to Error 600010)');
          
          // 2Captcha completely removed - causes Error 600010 session mismatch
          // Proceed directly to form submission - implicit pass is our only strategy
        }
        
        // Final check: Do we have a token now (either from implicit pass)?
        const tokenAlreadySet = await page.evaluate(() => {
          const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
          return !!(responseInput && responseInput.value && responseInput.value.length > 0);
        });
        
        // If token not already set, try manual handling
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

      // Final token check right before submit - re-set if missing
      // CRITICAL: Ensure token is present and properly set before form submission
      const finalTokenCheck = await page.evaluate(() => {
        const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
        const hiddenInput = document.querySelector('input[type="hidden"][name="cf-turnstile-response"]') as HTMLInputElement;
        const turnstileWidget = document.querySelector('.cf-turnstile, [class*="cf-turnstile"], [data-sitekey]') as HTMLElement;
        
        const token = responseInput?.value || hiddenInput?.value || '';
        const widgetState = turnstileWidget?.getAttribute('data-state') || '';
        const widgetClass = turnstileWidget?.className || '';
        
        return {
          hasToken: token.length > 0,
          tokenLength: token.length,
          tokenValue: token.substring(0, 50) + '...', // First 50 chars for logging
          widgetSuccess: widgetState === 'success' || widgetClass.includes('success'),
          callbackCalled: !!(window as any).__turnstileCallbackCalled
        };
      });
      
      logger.info(`Final token check before submit: hasToken=${finalTokenCheck.hasToken}, length=${finalTokenCheck.tokenLength}, widgetSuccess=${finalTokenCheck.widgetSuccess}, callback=${finalTokenCheck.callbackCalled}`);
      
      if (finalTokenCheck.hasToken) {
        logger.info(`Token present before submit (length: ${finalTokenCheck.tokenLength})`);
      } else {
        logger.warn('No Turnstile token found before submit - proceeding anyway (some sites may accept)');
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
              // Wait for navigation or response after clicking submit
              const [response] = await Promise.all([
                page.waitForResponse(response => {
                  // Check if it's a form submission response
                  return response.request().method() === 'POST' || 
                         response.url().includes('/register') || 
                         response.url().includes('/signup') ||
                         response.url().includes('/create') ||
                         response.status() < 400;
                }, { timeout: 10000 }).catch(() => null),
                page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => null),
                page.click(selector, { timeout: 5000 })
              ]);
              
              actions.push('Submitted form');
              submitted = true;
              
              // Wait a bit more for any JavaScript to process
              await page.waitForTimeout(2000);
              
              // Log response status if we got one
              if (response) {
                logger.info(`Form submission response: ${response.status()} ${response.statusText()}`);
                try {
                  const responseBody = await response.text();
                  logger.info(`Response body (first 500 chars): ${responseBody.substring(0, 500)}`);
                  
                  // Check for JSON responses
                  let responseData: any = null;
                  try {
                    responseData = JSON.parse(responseBody);
                    logger.info(`Response JSON: ${JSON.stringify(responseData).substring(0, 500)}`);
                  } catch {
                    // Not JSON, that's fine
                  }
                  
                  if (response.status() >= 400) {
                    logger.warn(`Form submission failed with status ${response.status()}: ${responseBody.substring(0, 300)}`);
                    actions.push(`Error: Server returned ${response.status()}`);
                  } else if (responseBody.includes('error') || responseBody.includes('Error') || responseBody.includes('invalid') || 
                            (responseData && (responseData.error || responseData.message?.toLowerCase().includes('error')))) {
                    logger.warn(`Form submission may have failed - response contains error indicators: ${responseBody.substring(0, 300)}`);
                    actions.push('Warning: Response contains error indicators');
                  } else if (responseBody.includes('success') || responseBody.includes('Success') || responseBody.includes('created') ||
                            (responseData && (responseData.success || responseData.created))) {
                    logger.info('Form submission response contains success indicators');
                    actions.push('Response indicates success');
                  }
                } catch (e) {
                  logger.debug(`Error reading response: ${e instanceof Error ? e.message : String(e)}`);
                }
              } else {
                logger.warn('No network response captured after form submission - may have failed silently');
                actions.push('Warning: No network response captured');
              }
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
                // Wait for navigation or response after clicking submit
                const [response] = await Promise.all([
                  page.waitForResponse(response => {
                    return response.request().method() === 'POST' || 
                           response.url().includes('/register') || 
                           response.url().includes('/signup') ||
                           response.url().includes('/create') ||
                           response.status() < 400;
                  }, { timeout: 10000 }).catch(() => null),
                  page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => null),
                  page.click(selector, { timeout: 5000 })
                ]);
                
                actions.push('Submitted form (waited for button to be enabled)');
                submitted = true;
                
                // Wait a bit more for any JavaScript to process
                await page.waitForTimeout(2000);
                
                // Log response status if we got one
                if (response) {
                  logger.info(`Form submission response: ${response.status()} ${response.statusText()}`);
                  try {
                    const responseBody = await response.text();
                    logger.info(`Response body (first 500 chars): ${responseBody.substring(0, 500)}`);
                    
                    if (response.status() >= 400) {
                      logger.warn(`Form submission failed with status ${response.status()}`);
                      actions.push(`Error: Server returned ${response.status()}`);
                    }
                  } catch (e) {
                    // Ignore errors reading response
                  }
                }
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

      const finalPassword = (typeof validPassword !== 'undefined' ? validPassword : password) || password;
      
      // CRITICAL: Verify that form was actually submitted and account was created
      // This is important because Elon reports success but accounts aren't actually created
      let formSubmitted = submitted;
      let accountCreated = false; // Declare early
      let successIndicators: string[] = [];
      
      if (submitted) {
        // Wait longer for page to react and process submission
        await page.waitForTimeout(8000); // Increased wait time for better detection
        
        // Check current URL - if it changed, might indicate success
        const currentUrl = page.url();
        const originalUrl = task.url;
        logger.info(`Current URL after submission: ${currentUrl}`);
        logger.info(`Original URL: ${originalUrl}`);
        
        // Check for error messages in the page
        const pageErrors = await page.evaluate(() => {
          const errorSelectors = [
            '[class*="error" i]',
            '[class*="alert" i]',
            '[id*="error" i]',
            '.error',
            '.alert-danger',
            '[role="alert"]',
            '.text-danger',
            '.text-red'
          ];
          
          const errors: string[] = [];
          for (const selector of errorSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of Array.from(elements)) {
              const text = el.textContent || '';
              if (text.trim().length > 0 && 
                  (text.toLowerCase().includes('error') || 
                   text.toLowerCase().includes('invalid') ||
                   text.toLowerCase().includes('failed') ||
                   text.toLowerCase().includes('try again') ||
                   text.toLowerCase().includes('captcha') ||
                   text.toLowerCase().includes('turnstile'))) {
                errors.push(text.trim().substring(0, 200));
              }
            }
          }
          return errors;
        });
        
        if (pageErrors.length > 0) {
          logger.warn(`Error messages detected on page after submission: ${pageErrors.join('; ')}`);
          actions.push(`Errors detected: ${pageErrors.join('; ')}`);
          accountCreated = false; // Errors indicate failure
        }
        
        // Check URL change - important indicator
        const urlChanged = currentUrl !== originalUrl && 
                          !currentUrl.includes('/register') && 
                          !currentUrl.includes('/signup');
        
        if (urlChanged) {
          logger.info('URL changed after submission - likely success');
          successIndicators.push('URL changed');
          accountCreated = true;
        }
        
        // Check for specific error messages that indicate account was NOT created
        const specificErrors = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return {
            hasFailedToAuthorize: bodyText.includes('failed to authorize') || 
                                 bodyText.includes('authorization failed') ||
                                 bodyText.includes('authorize your account'),
            hasAccountCreationFailed: bodyText.includes('account creation failed') ||
                                     bodyText.includes('registration failed'),
            hasTurnstileError: bodyText.includes('turnstile') && bodyText.includes('error')
          };
        });
        
        if (specificErrors.hasFailedToAuthorize || specificErrors.hasAccountCreationFailed) {
          logger.warn('Specific error detected indicating account was NOT created');
          accountCreated = false;
          if (specificErrors.hasFailedToAuthorize) {
            successIndicators.push('Error: Failed to authorize account');
          }
          if (specificErrors.hasAccountCreationFailed) {
            successIndicators.push('Error: Account creation failed');
          }
        }
        
        // Check for success indicators
        try {
          const successCheck = await page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return {
              hasSuccessMessage: bodyText.includes('account created') ||
                               bodyText.includes('registration successful') ||
                               bodyText.includes('successfully registered') ||
                               bodyText.includes('welcome'),
              hasSuccessElements: document.querySelectorAll('[class*="success" i], .alert-success, .notification.success').length > 0,
              modalClosed: !document.querySelector('dialog[open], .modal.show, .modal:not([style*="display: none"])'),
              urlChanged: !window.location.href.includes('/register') && !window.location.href.includes('/signup'),
              hasError: bodyText.includes('error') ||
                       bodyText.includes('failed') ||
                       bodyText.includes('invalid')
            };
          });
          
          // Determine account creation status based on indicators
          if (!accountCreated) { // Only set if not already set by error detection above
            if (successCheck.hasSuccessMessage || successCheck.hasSuccessElements) {
              successIndicators.push('Success message/elements detected');
              accountCreated = true;
            } else if (successCheck.modalClosed && urlChanged) {
              successIndicators.push('Modal closed and URL changed');
              accountCreated = true;
            } else if (successCheck.hasError) {
              successIndicators.push('Error message detected - account NOT created');
              accountCreated = false;
            } else {
              // Default to false if unclear (conservative approach)
              successIndicators.push('No clear success/error indicators - assume NOT created');
              accountCreated = false;
            }
          }
        } catch {
          // Could not verify, default to false (conservative)
          if (!accountCreated) {
            accountCreated = false;
            successIndicators.push('Could not verify account creation');
          }
        }
      }
      
      // Collect browser console messages and network requests for debugging
      const relevantConsoleMessages = consoleMessages.filter(msg => 
        msg.text.toLowerCase().includes('error') ||
        msg.text.toLowerCase().includes('turnstile') ||
        msg.text.toLowerCase().includes('captcha') ||
        msg.text.toLowerCase().includes('failed') ||
        msg.text.toLowerCase().includes('invalid')
      );
      
      const relevantNetworkRequests = networkRequests.filter(req =>
        req.url.includes('/register') ||
        req.url.includes('/signup') ||
        req.url.includes('turnstile') ||
        req.url.includes('challenges.cloudflare.com')
      );
      
      // Log summary of console messages and network requests
      if (relevantConsoleMessages.length > 0) {
        logger.warn(`Browser console messages captured: ${relevantConsoleMessages.length} relevant messages`);
        relevantConsoleMessages.forEach(msg => {
          logger.warn(`  [${msg.type}] ${msg.text.substring(0, 200)}`);
        });
      }
      
      if (relevantNetworkRequests.length > 0) {
        logger.info(`Network requests captured: ${relevantNetworkRequests.length} relevant requests`);
        relevantNetworkRequests.forEach(req => {
          logger.info(`  ${req.method} ${req.url} -> ${req.status || 'pending'} ${req.statusText || ''}`);
        });
      }
      
      // CRITICAL: Report accurately whether account was actually created
      // Elon has been reporting success when accounts aren't actually created
      const message = accountCreated
        ? `✅ Account created successfully! Registration form filled and submitted. Actions: ${actions.join(', ')}. ${successIndicators.length > 0 ? `Verification: ${successIndicators.join(', ')}.` : ''} ${finalPassword !== password ? `Note: Password was adjusted to meet requirements (${finalPassword}).` : ''}`
        : formSubmitted
        ? `⚠️ Registration form filled and submitted, but account creation could not be verified. Actions: ${actions.join(', ')}. ${successIndicators.length > 0 ? `Verification: ${successIndicators.join(', ')}.` : 'No clear success indicators found.'} ${finalPassword !== password ? `Note: Password was adjusted to meet requirements (${finalPassword}).` : ''} Please check manually if account was created.`
        : `❌ Registration form filled but submission may have failed. Actions: ${actions.join(', ')}. ${successIndicators.length > 0 ? `Verification: ${successIndicators.join(', ')}.` : ''} ${finalPassword !== password ? `Note: Password was adjusted to meet requirements (${finalPassword}).` : ''}`;
      
      return {
        message,
        data: { 
          actions,
          accountName,
          password: finalPassword,
          passwordAdjusted: finalPassword !== password,
          formSubmitted,
          accountCreated, // CRITICAL: Report actual account creation status
          successIndicators,
          consoleMessages: relevantConsoleMessages.length > 0 ? relevantConsoleMessages : undefined,
          networkRequests: relevantNetworkRequests.length > 0 ? relevantNetworkRequests : undefined
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

