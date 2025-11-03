import { VM } from 'vm2';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('PluginSandbox');

export interface SandboxConfig {
  maxMemoryMB: number;
  maxCpuSeconds: number;
  maxNetworkCalls: number;
  timeout: number;
  allowedDomains: string[];
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  metrics: {
    executionTimeMs: number;
    memoryUsedMB: number;
    networkCalls: number;
  };
  blocked?: boolean;
  blockReason?: string;
}

/**
 * PluginSandbox
 *
 * Provides isolated execution environment for user-generated plugins using VM2.
 * Implements resource limits, domain whitelist, and security monitoring.
 */
export class PluginSandbox {
  private static readonly DEFAULT_CONFIG: SandboxConfig = {
    maxMemoryMB: 128,
    maxCpuSeconds: 5,
    maxNetworkCalls: 10,
    timeout: 30000,
    allowedDomains: [
      'discord.com',
      'discordapp.com',
      'slack.com',
      'api.slack.com',
      'trello.com',
      'api.trello.com',
      'notion.so',
      'api.notion.com',
      'github.com',
      'api.github.com',
    ],
  };

  /**
   * Execute plugin code in isolated sandbox
   */
  async execute(
    code: string,
    functionName: string,
    args: any[],
    config: Partial<SandboxConfig> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sandboxConfig = { ...PluginSandbox.DEFAULT_CONFIG, ...config };

    logger.info('Starting sandbox execution', { functionName });

    try {
      // Track network calls
      let networkCallCount = 0;
      const blockedDomains: string[] = [];

      // Create sandbox with limited access
      const vm = new VM({
        timeout: sandboxConfig.timeout,
        sandbox: {
          console: {
            log: (...args: any[]) => logger.debug('Plugin log', { args }),
            error: (...args: any[]) => logger.error('Plugin error', { args }),
            warn: (...args: any[]) => logger.warn('Plugin warning', { args }),
          },

          // Provide safe fetch wrapper
          fetch: this.createSafeFetch(
            sandboxConfig.allowedDomains,
            (domain) => {
              networkCallCount++;
              if (networkCallCount > sandboxConfig.maxNetworkCalls) {
                throw new Error('Network call limit exceeded');
              }
              if (!this.isDomainAllowed(domain, sandboxConfig.allowedDomains)) {
                blockedDomains.push(domain);
                throw new Error(`Domain not allowed: ${domain}`);
              }
            }
          ),

          // Provide setTimeout/setInterval with limits
          setTimeout: (fn: Function, delay: number) => {
            if (delay > sandboxConfig.timeout) {
              throw new Error('Timeout exceeds maximum allowed');
            }
            return setTimeout(fn, delay);
          },

          setInterval: (fn: Function, delay: number) => {
            if (delay < 1000) {
              throw new Error('Interval too frequent (minimum 1000ms)');
            }
            return setInterval(fn, delay);
          },
        },

        // Disable require for dangerous modules
        require: {
          external: {
            modules: [
              'axios',
              'node-fetch',
              'discord.js',
              '@discordjs/rest',
              '@discordjs/builders',
              '@slack/web-api',
              'trello',
              '@notionhq/client',
              'zod',
              'date-fns',
              'uuid',
            ],
          },
          builtin: [], // No built-in Node.js modules
          context: 'sandbox',
        },
      });

      // Execute the code
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Run code with CPU time limit
      const result = await this.executeWithCpuLimit(
        () => vm.run(code),
        sandboxConfig.maxCpuSeconds * 1000
      );

      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryUsed = endMemory - startMemory;

      // Check memory limit
      if (memoryUsed > sandboxConfig.maxMemoryMB) {
        logger.warn('Memory limit exceeded', {
          used: memoryUsed,
          limit: sandboxConfig.maxMemoryMB,
        });
        return {
          success: false,
          error: 'Memory limit exceeded',
          metrics: {
            executionTimeMs: Date.now() - startTime,
            memoryUsedMB: memoryUsed,
            networkCalls: networkCallCount,
          },
          blocked: true,
          blockReason: 'memory_limit_exceeded',
        };
      }

      // Check for blocked domains
      if (blockedDomains.length > 0) {
        logger.warn('Blocked domain access attempt', { domains: blockedDomains });
        return {
          success: false,
          error: `Attempted to access blocked domains: ${blockedDomains.join(', ')}`,
          metrics: {
            executionTimeMs: Date.now() - startTime,
            memoryUsedMB: memoryUsed,
            networkCalls: networkCallCount,
          },
          blocked: true,
          blockReason: 'unauthorized_domain',
        };
      }

      logger.info('Sandbox execution completed successfully', {
        functionName,
        executionTime: Date.now() - startTime,
        memoryUsed,
        networkCalls: networkCallCount,
      });

      return {
        success: true,
        result,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          memoryUsedMB: memoryUsed,
          networkCalls: networkCallCount,
        },
      };
    } catch (error) {
      logger.error('Sandbox execution failed', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if timeout
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout');

      return {
        success: false,
        error: errorMessage,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          memoryUsedMB: 0,
          networkCalls: 0,
        },
        blocked: isTimeout,
        blockReason: isTimeout ? 'timeout' : undefined,
      };
    }
  }

  /**
   * Create a safe fetch wrapper that validates domains
   */
  private createSafeFetch(
    allowedDomains: string[],
    onNetworkCall: (domain: string) => void
  ): typeof fetch {
    return async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlString = url.toString();
      const domain = this.extractDomain(urlString);

      // Notify about network call
      onNetworkCall(domain);

      // Validate domain
      if (!this.isDomainAllowed(domain, allowedDomains)) {
        throw new Error(`Domain not allowed: ${domain}`);
      }

      // Use native fetch (or axios)
      const response = await fetch(url, init);
      return response;
    };
  }

  /**
   * Execute function with CPU time limit
   */
  private async executeWithCpuLimit<T>(
    fn: () => Promise<T> | T,
    maxCpuMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const startCpu = process.cpuUsage();
      let checkInterval: NodeJS.Timeout;

      const check = () => {
        const currentCpu = process.cpuUsage(startCpu);
        const cpuMs = (currentCpu.user + currentCpu.system) / 1000;

        if (cpuMs > maxCpuMs) {
          clearInterval(checkInterval);
          reject(new Error(`CPU time limit exceeded: ${cpuMs}ms > ${maxCpuMs}ms`));
        }
      };

      // Check CPU usage every 100ms
      checkInterval = setInterval(check, 100);

      Promise.resolve(fn())
        .then((result) => {
          clearInterval(checkInterval);
          resolve(result);
        })
        .catch((error) => {
          clearInterval(checkInterval);
          reject(error);
        });
    });
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Check if domain is in allowed list
   */
  private isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
    return allowedDomains.some(
      (allowed) => domain === allowed || domain.endsWith('.' + allowed)
    );
  }

  /**
   * Validate plugin code before execution
   */
  async validateCode(code: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/gi, message: 'eval() is not allowed' },
      { pattern: /Function\s*\(/gi, message: 'Function constructor is not allowed' },
      { pattern: /child_process/gi, message: 'child_process module is not allowed' },
      { pattern: /require\s*\(\s*['"]fs['"]\s*\)/gi, message: 'fs module is not allowed' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
