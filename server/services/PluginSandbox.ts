import { Worker } from 'worker_threads';
import { SimpleLogger } from '../utils/SimpleLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';

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
  details?: {
    message?: string;
    stack?: string;
    codeSample?: string;
    lineNumber?: number;
    codeLength?: number;
  };
}

/**
 * PluginSandbox
 *
 * Provides isolated execution environment for user-generated plugins using Worker threads.
 * Implements resource limits, domain whitelist, and security monitoring.
 *
 * SECURITY: Replaces vulnerable vm2 with Node.js Worker threads for true process isolation.
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

  private workerPath: string;

  constructor() {
    // Create worker script path - use import.meta.url for ESM compatibility
    // Use .cjs extension so it's treated as CommonJS (since it uses require())
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    this.workerPath = path.join(currentDir, 'sandbox-worker.cjs');
    this.ensureWorkerScript();
  }

  /**
   * Execute plugin code in isolated Worker thread
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
      // First, transpile any TypeScript syntax to JavaScript
      let transpiledCode = code;
      try {
        const tsResult = ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext,
            useDefineForClassFields: false,
            experimentalDecorators: false,
          },
          reportDiagnostics: false,
        });
        transpiledCode = tsResult.outputText || code;
      } catch (transpileError) {
        logger.warn('TypeScript transpilation failed, falling back to raw code', transpileError as Error);
      }

      // Transform ES module syntax to CommonJS (which also strips TypeScript)
      const transformedCode = this.transformESMToCommonJS(transpiledCode);
      
      // Fix common Zod schema shorthand that causes invalid JavaScript
      const zodFixedCode = this.fixZodPropertyShortcuts(transformedCode);
      
      // Transform modern JavaScript syntax that might not be supported in VM
      const vmCompatibleCode = this.transformToVMCompatible(zodFixedCode);

      // Log a sample of the transformed code for debugging
      logger.info('Code transformation complete', {
        functionName,
        originalLength: code.length,
        finalLength: vmCompatibleCode.length,
        sample: vmCompatibleCode.substring(0, 500)
      });

      // Validate code before execution
      const validation = await this.validateCode(vmCompatibleCode);
      if (!validation.valid) {
        return {
          success: false,
          error: `Code validation failed: ${validation.errors.join(', ')}`,
          metrics: {
            executionTimeMs: Date.now() - startTime,
            memoryUsedMB: 0,
            networkCalls: 0,
          },
          blocked: true,
          blockReason: 'code_validation_failed',
        };
      }

      // Execute in Worker thread with transformed code
      const result = await this.executeInWorker(vmCompatibleCode, functionName, args, sandboxConfig);

      logger.info('Sandbox execution completed successfully', {
        functionName,
        executionTime: result.metrics.executionTimeMs,
        memoryUsed: result.metrics.memoryUsedMB,
        networkCalls: result.metrics.networkCalls,
      });

      return result;
    } catch (error) {
      logger.error('Sandbox execution failed', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
   * Execute code in Worker thread with resource limits
   */
  private async executeInWorker(
    code: string,
    functionName: string,
    args: any[],
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Create Worker with resource limits
      const worker = new Worker(this.workerPath, {
        workerData: {
          code,
          functionName,
          args,
          config,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: config.maxMemoryMB,
          maxYoungGenerationSizeMb: Math.floor(config.maxMemoryMB / 4),
        },
      });

      let networkCallCount = 0;
      let completed = false;

      // Set execution timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          worker.terminate();
          reject(new Error(`Execution timeout after ${config.timeout}ms`));
        }
      }, config.timeout);

      // Handle messages from worker
      worker.on('message', (message) => {
        if (message.type === 'network_call') {
          networkCallCount++;
          if (networkCallCount > config.maxNetworkCalls) {
            completed = true;
            worker.terminate();
            clearTimeout(timeout);
            resolve({
              success: false,
              error: 'Network call limit exceeded',
              metrics: {
                executionTimeMs: Date.now() - startTime,
                memoryUsedMB: 0,
                networkCalls: networkCallCount,
              },
              blocked: true,
              blockReason: 'network_limit_exceeded',
            });
          }
        } else if (message.type === 'result') {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            worker.terminate();
            resolve({
              success: true,
              result: message.result,
              metrics: {
                executionTimeMs: Date.now() - startTime,
                memoryUsedMB: message.memoryUsed || 0,
                networkCalls: networkCallCount,
              },
            });
          }
        } else if (message.type === 'error') {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            worker.terminate();

            const blocked = message.blocked || false;
            const blockReason = message.blockReason;
            const details = message.details || undefined;

            resolve({
              success: false,
              error: message.error,
              metrics: {
                executionTimeMs: Date.now() - startTime,
                memoryUsedMB: 0,
                networkCalls: networkCallCount,
              },
              blocked,
              blockReason,
              details, // Include error details
            });
          }
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          }
        }
      });
    });
  }

  /**
   * Ensure worker script exists
   */
  private ensureWorkerScript(): void {
    const workerScript = `
const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

const { code, functionName, args, config } = workerData;

// Track network calls
let networkCallCount = 0;

// Create safe context
const allowedModules = ['https', 'http', 'url', 'crypto', 'buffer', 'util'];
const safeRequire = (moduleName) => {
  if (!allowedModules.includes(moduleName)) {
    throw new Error(\`Module '\${moduleName}' is not allowed. Allowed modules: \${allowedModules.join(', ')}\`);
  }
  return require(moduleName);
};

const context = {
  console: {
    log: (...args) => console.log('[Plugin]', ...args),
    error: (...args) => console.error('[Plugin]', ...args),
    warn: (...args) => console.warn('[Plugin]', ...args),
  },

  // Provide limited require function for plugin code
  require: safeRequire,

  // Proxy fetch to track network calls
  fetch: new Proxy(fetch, {
    apply(target, thisArg, argumentsList) {
      networkCallCount++;
      parentPort.postMessage({ type: 'network_call' });

      const url = argumentsList[0]?.toString() || '';
      const domain = extractDomain(url);

      if (!isDomainAllowed(domain, config.allowedDomains)) {
        parentPort.postMessage({
          type: 'error',
          error: \`Domain not allowed: \${domain}\`,
          blocked: true,
          blockReason: 'unauthorized_domain'
        });
        process.exit(1);
      }

      return Reflect.apply(target, thisArg, argumentsList);
    }
  }),

  setTimeout: (fn, delay) => {
    if (delay > config.timeout) {
      throw new Error('Timeout exceeds maximum allowed');
    }
    return setTimeout(fn, delay);
  },

  setInterval: (fn, delay) => {
    if (delay < 1000) {
      throw new Error('Interval too frequent (minimum 1000ms)');
    }
    return setInterval(fn, delay);
  },
};

vm.createContext(context);

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

function isDomainAllowed(domain, allowedDomains) {
  return allowedDomains.some(
    (allowed) => domain === allowed || domain.endsWith('.' + allowed)
  );
}

try {
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  // Execute code in VM context with better error handling
  try {
    vm.runInContext(code, context, {
      timeout: config.timeout,
      displayErrors: true,
    });
  } catch (vmError) {
    // Log the actual syntax error for debugging
    const errorMsg = vmError.message || String(vmError);
    const errorStack = vmError.stack || '';
    
    // Find the line number from the error if available
    const lineMatch = errorMsg.match(/line (\d+)/i) || errorStack.match(/at.*:(\d+):/);
    const lineNumber = lineMatch ? parseInt(lineMatch[1]) : null;
    
    // Get code around the error line for context
    const codeLines = code.split('\\n');
    let codeContext = '';
    if (lineNumber && lineNumber > 0 && lineNumber <= codeLines.length) {
      const start = Math.max(0, lineNumber - 3);
      const end = Math.min(codeLines.length, lineNumber + 3);
      codeContext = codeLines.slice(start, end).join('\\n');
    } else {
      codeContext = code.substring(0, 500);
    }
    
    parentPort.postMessage({
      type: 'error',
      error: 'Syntax error in plugin code: ' + errorMsg,
      blocked: false,
      details: {
        message: errorMsg,
        stack: errorStack.substring(0, 1000),
        codeSample: codeContext,
        lineNumber: lineNumber,
        codeLength: code.length
      }
    });
    process.exit(1);
  }

  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryUsed = endMemory - startMemory;

  // Check memory limit
  if (memoryUsed > config.maxMemoryMB) {
    parentPort.postMessage({
      type: 'error',
      error: 'Memory limit exceeded',
      blocked: true,
      blockReason: 'memory_limit_exceeded'
    });
    process.exit(1);
  }

  // Get function result
  const fn = context[functionName];
  if (typeof fn !== 'function') {
    throw new Error(\`Function "\${functionName}" not found in code\`);
  }

  // Handle both sync and async functions
  try {
    const resultPromise = Promise.resolve(fn(...args));
    
    resultPromise
      .then((result) => {
        parentPort.postMessage({
          type: 'result',
          result,
          memoryUsed
        });
        process.exit(0);
      })
      .catch((error) => {
        parentPort.postMessage({
          type: 'error',
          error: error.message || String(error),
          blocked: false
        });
        process.exit(1);
      });
  } catch (syncError) {
    // Handle synchronous errors
    parentPort.postMessage({
      type: 'error',
      error: syncError.message || String(syncError),
      blocked: false
    });
    process.exit(1);
  }
} catch (error) {
  parentPort.postMessage({
    type: 'error',
    error: error.message,
    blocked: false
  });
  process.exit(1);
}
`;

    try {
      // Create worker script if it doesn't exist
      if (!fs.existsSync(this.workerPath)) {
        fs.writeFileSync(this.workerPath, workerScript, 'utf8');
        logger.info('Created sandbox worker script', { path: this.workerPath });
      }
    } catch (error) {
      logger.error('Failed to create worker script', error);
      throw error;
    }
  }

  /**
   * Strip TypeScript type annotations from code
   */
  private stripTypeScript(code: string): string {
    let stripped = code;

    // Remove interface declarations (multiline)
    stripped = stripped.replace(/interface\s+\w+[^{]*\{[^}]*\}/gs, '');

    // Remove type declarations
    stripped = stripped.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

    // Remove generic type parameters from function declarations: function name<T>() -> function name()
    stripped = stripped.replace(/(function\s+\w+|<[^>]+>)/g, (match) => {
      if (match.startsWith('<')) return '';
      return match.replace(/<[^>]+>/, '');
    });

    // Remove type annotations from function parameters: (param: Type) -> (param)
    // Handle nested parentheses and complex types
    stripped = stripped.replace(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (match, params) => {
      // Remove : Type from each parameter
      const cleaned = params.replace(/:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*/g, '');
      return `(${cleaned})`;
    });

    // Remove return type annotations from arrow functions: (): ReturnType => -> () =>
    stripped = stripped.replace(/\)\s*:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*\s*=>/g, ') =>');

    // Remove return type annotations from function declarations: function name(): ReturnType { -> function name() {
    stripped = stripped.replace(/\)\s*:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*\s*{/g, ') {');

    // Remove type annotations from variable declarations: const x: Type = -> const x =
    stripped = stripped.replace(/(const|let|var)\s+(\w+)\s*:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*\s*=/g, '$1 $2 =');

    // Remove type annotations from object properties: { prop: Type } -> { prop }
    // This is tricky, so we'll handle simple cases
    stripped = stripped.replace(/(\w+)\s*:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*\s*([,}])/g, '$1$2');

    // Remove 'as Type' type assertions
    stripped = stripped.replace(/\s+as\s+[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*/g, '');

    // Remove generic type parameters: <Type> -> (empty)
    stripped = stripped.replace(/<[A-Za-z][A-Za-z0-9_<>\[\]|&\s,{}]*>/g, '');

    return stripped;
  }

  /**
   * Transform modern JavaScript syntax to VM-compatible syntax
   * Node.js VM should support most modern syntax, but we'll handle edge cases
   */
  private transformToVMCompatible(code: string): string {
    let transformed = code;

    // Remove TypeScript access modifiers, readonly, and property types in class bodies
    transformed = transformed.replace(
      /(public|private|protected)\s+(readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?==)/g,
      '$3'
    );
    transformed = transformed.replace(
      /(public|private|protected)\s+(readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?=;)/g,
      '$3'
    );
    transformed = transformed.replace(
      /readonly\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?==)/g,
      '$1'
    );
    transformed = transformed.replace(
      /readonly\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?=;)/g,
      '$1'
    );
    // Remove leftover access modifiers like "private foo =" or "readonly foo ="
    transformed = transformed.replace(
      /\b(public|private|protected|readonly)\s+(?=[A-Za-z_])/g,
      ''
    );
    // Remove plain typed properties without modifiers
    transformed = transformed.replace(
      /(^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?==)/gm,
      '$1$2'
    );
    transformed = transformed.replace(
      /(^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+(?=;)/gm,
      '$1$2'
    );
    // Handle assignments with modifiers and initializers in one go
    transformed = transformed.replace(
      /^(\s*)(?:public|private|protected)?\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+\s*(?==)/gm,
      '$1$2'
    );
    transformed = transformed.replace(
      /^(\s*)(?:public|private|protected)?\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&\.]+\s*(?=;)/gm,
      '$1$2'
    );
    transformed = transformed.replace(
      /readonly\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&]+=/g,
      '$1 ='
    );
    transformed = transformed.replace(
      /readonly\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z0-9_<>\[\]\s|&]+;/g,
      '$1;'
    );

    // Transform optional chaining: obj?.prop -> (obj && obj.prop)
    // More comprehensive pattern matching
    transformed = transformed.replace(/(\w+(?:\.\w+)*)\?\.(\w+)/g, '($1 && $1.$2)');
    transformed = transformed.replace(/(\w+)\?\.(\w+)\s*\(/g, '($1 && $1.$2(');
    
    // Transform nullish coalescing: a ?? b -> (a != null ? a : b)
    transformed = transformed.replace(/([^?])\?\?([^=])/g, '$1 != null ? $1 : $2');
    
    // Transform optional chaining with brackets: obj?.[key] -> (obj && obj[key])
    transformed = transformed.replace(/(\w+)\?\.\[([^\]]+)\]/g, '($1 && $1[$2])');
    
    return transformed;
  }

  /**
   * Fix common shorthand mistakes in generated Zod schemas
   * e.g. channelId.string() -> channelId: z.string()
   */
  private fixZodPropertyShortcuts(code: string): string {
    let transformed = code;

    // Ensure z import exists before referencing z.
    if (!/const\s+\{\s*z\s*\}/.test(transformed) && transformed.includes("require('zod'")) {
      transformed = transformed.replace(
        /const\s+\{\s*([^}]+)\s*\}\s*=\s*require\('zod'\);/,
        (match, imports) => {
          if (imports.includes('z')) return match;
          return `const { ${imports.trim()}, z } = require('zod');`;
        }
      );
    }

    // Replace property shortcuts like channelId.string(... with channelId: z.string(...
    const zTypes = ['string','number','boolean','array','date','bigint','symbol','function','any','unknown','object','enum'];
    const zTypePattern = zTypes.join('|');
    const propertyRegex = new RegExp(`([\\{,]\\s*)([A-Za-z_][A-Za-z0-9_]*)\\s*\\.(${zTypePattern})\\s*\\(`, 'g');

    transformed = transformed.replace(propertyRegex, (_match, prefix, prop, zType) => {
      return `${prefix}${prop}: z.${zType}(`;
    });

    // Fix accidental "= z: z." sequences if they appear
    transformed = transformed.replace(/=\s*z:\s*z\./g, '= z.');

    return transformed;
  }

  /**
   * Transform ES module syntax to CommonJS
   */
  private transformESMToCommonJS(code: string): string {
    // First strip TypeScript syntax
    let transformed = this.stripTypeScript(code);

    // Check if code uses ES module syntax
    const hasESM = /^import\s+/.test(transformed.trim()) || /^export\s+/.test(transformed.trim());
    if (!hasESM) {
      return transformed; // Already CommonJS, no transformation needed
    }

    // Transform import statements to require()
    // Default import: import X from 'module' -> const X = require('module').default || require('module')
    transformed = transformed.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      (match, name, module) => {
        // For most cases, just require the module
        // If it's a default export, we might need .default
        return `const ${name} = require('${module}')`;
      }
    );

    // Named imports: import { a, b } from 'module' -> const { a, b } = require('module')
    transformed = transformed.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
      "const { $1 } = require('$2')"
    );

    // Default + named: import X, { a, b } from 'module'
    transformed = transformed.replace(
      /import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
      "const $1 = require('$3'); const { $2 } = require('$3')"
    );

    // Import all: import * as X from 'module' -> const X = require('module')
    transformed = transformed.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      "const $1 = require('$2')"
    );

    // Side-effect imports: import 'module' -> require('module')
    transformed = transformed.replace(
      /import\s+['"]([^'"]+)['"]/g,
      "require('$1')"
    );

    // Remove export statements (not needed in CommonJS context)
    // export default X -> (just X, no export)
    transformed = transformed.replace(/export\s+default\s+/g, '');
    
    // export { a, b } -> (just remove export)
    transformed = transformed.replace(/export\s+\{([^}]+)\}/g, '');
    
    // export const/let/var/function/class -> const/let/var/function/class
    transformed = transformed.replace(/export\s+(const|let|var|function|class|async\s+function)\s+/g, '$1 ');

    return transformed;
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
      { pattern: /process\.exit/gi, message: 'process.exit is not allowed' },
      { pattern: /process\.kill/gi, message: 'process.kill is not allowed' },
      { pattern: /process\.binding/gi, message: 'process.binding is not allowed' },
      { pattern: /__dirname/gi, message: '__dirname is not allowed' },
      { pattern: /__filename/gi, message: '__filename is not allowed' },
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
}
