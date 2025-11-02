import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { Node } from '@babel/types';
import { SimpleLogger } from '../utils/logger';

const logger = SimpleLogger.getInstance().child({ service: 'PluginSecurityAnalyzer' });

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  location: { line: number; column: number };
  autoFixable: boolean;
  suggestion?: string;
}

export interface SecurityAnalysisResult {
  issues: SecurityIssue[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  securityScore: number; // 0-100
  passed: boolean;
  blockedPatterns: string[];
  allowedPackages: string[];
  usedPackages: string[];
}

/**
 * PluginSecurityAnalyzer
 *
 * Multi-layer security analysis for user-generated plugins:
 * 1. Dangerous function detection
 * 2. Package whitelist validation
 * 3. Network call domain validation
 * 4. File system access detection
 * 5. Code complexity analysis
 * 6. Credential leak detection
 */
export class PluginSecurityAnalyzer {
  // Dangerous patterns that are completely blocked
  private static readonly DANGEROUS_PATTERNS: Array<{ pattern: RegExp; severity: SecurityIssue['severity']; description: string }> = [
    {
      pattern: /eval\s*\(/gi,
      severity: 'critical',
      description: 'Use of eval() allows arbitrary code execution and is prohibited'
    },
    {
      pattern: /Function\s*\(/gi,
      severity: 'critical',
      description: 'Function constructor allows arbitrary code execution and is prohibited'
    },
    {
      pattern: /child_process/gi,
      severity: 'critical',
      description: 'Process spawning (child_process) is prohibited for security reasons'
    },
    {
      pattern: /require\s*\(\s*['"]fs['"]\s*\)/gi,
      severity: 'critical',
      description: 'File system access (fs module) is prohibited in plugins'
    },
    {
      pattern: /import\s+.*\s+from\s+['"]fs['"]/gi,
      severity: 'critical',
      description: 'File system access (fs module) is prohibited in plugins'
    },
    {
      pattern: /fs\.unlink|fs\.rmdir|fs\.rm/gi,
      severity: 'critical',
      description: 'File deletion operations are prohibited'
    },
    {
      pattern: /process\.env/gi,
      severity: 'high',
      description: 'Direct access to process.env is restricted. Use plugin credentials instead.'
    },
    {
      pattern: /\.exec\s*\(/gi,
      severity: 'critical',
      description: 'Command execution (.exec) is prohibited for security reasons'
    },
    {
      pattern: /crypto\.createHash|crypto\.pbkdf2|crypto\.scrypt/gi,
      severity: 'high',
      description: 'Cryptographic hashing detected - potential cryptocurrency mining'
    },
    {
      pattern: /__dirname|__filename/gi,
      severity: 'medium',
      description: 'Direct file path access is restricted in sandboxed environment'
    },
    {
      pattern: /require\s*\(\s*['"]vm['"]\s*\)|import\s+.*\s+from\s+['"]vm['"]/gi,
      severity: 'critical',
      description: 'VM module usage is prohibited - plugins run in controlled sandbox'
    },
    {
      pattern: /require\s*\(\s*['"]cluster['"]\s*\)|import\s+.*\s+from\s+['"]cluster['"]/gi,
      severity: 'critical',
      description: 'Cluster module usage is prohibited'
    },
  ];

  // Allowed npm packages for plugins
  private static readonly ALLOWED_PACKAGES = [
    'axios',
    'node-fetch',
    'discord.js',
    '@discordjs/rest',
    '@discordjs/builders',
    '@slack/web-api',
    '@slack/bolt',
    'trello',
    '@notionhq/client',
    'zod',
    'date-fns',
    'dayjs',
    'lodash',
    'ramda',
    'uuid',
    'nanoid',
    'jsonwebtoken',
    'jose',
    'bcryptjs',
    'validator',
  ];

  // Approved API domains
  private static readonly APPROVED_DOMAINS = [
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
    'gitlab.com',
    'linear.app',
    'api.linear.app',
    'asana.com',
    'app.asana.com',
    'todoist.com',
    'api.todoist.com',
  ];

  /**
   * Analyze plugin code for security issues
   */
  analyze(code: string): SecurityAnalysisResult {
    logger.info('Starting security analysis');
    const issues: SecurityIssue[] = [];

    try {
      // Step 1: Pattern-based analysis (fast, catches obvious issues)
      issues.push(...this.detectDangerousPatterns(code));

      // Step 2: AST-based analysis (deep, catches complex issues)
      const ast = this.parseAST(code);
      if (ast) {
        issues.push(...this.analyzeAST(ast, code));
        issues.push(...this.validateImports(ast));
        issues.push(...this.validateNetworkCalls(ast, code));
        issues.push(...this.checkComplexity(ast));
      }

      // Step 3: Credential leak detection
      issues.push(...this.detectCredentialLeaks(code));

      // Calculate statistics
      const criticalIssues = issues.filter(i => i.severity === 'critical').length;
      const highIssues = issues.filter(i => i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'medium').length;
      const lowIssues = issues.filter(i => i.severity === 'low').length;

      const securityScore = this.calculateSecurityScore(issues);
      const passed = criticalIssues === 0 && securityScore >= 70;

      const usedPackages = this.extractPackages(code);

      logger.info('Security analysis complete', {
        issuesFound: issues.length,
        criticalIssues,
        securityScore,
        passed,
      });

      return {
        issues,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        securityScore,
        passed,
        blockedPatterns: issues.filter(i => i.severity === 'critical').map(i => i.type),
        allowedPackages: PluginSecurityAnalyzer.ALLOWED_PACKAGES,
        usedPackages,
      };
    } catch (error) {
      logger.error('Error during security analysis', error);
      return {
        issues: [{
          severity: 'critical',
          type: 'analysis_error',
          description: `Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: { line: 0, column: 0 },
          autoFixable: false,
        }],
        criticalIssues: 1,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        securityScore: 0,
        passed: false,
        blockedPatterns: [],
        allowedPackages: PluginSecurityAnalyzer.ALLOWED_PACKAGES,
        usedPackages: [],
      };
    }
  }

  /**
   * Detect dangerous patterns using regex
   */
  private detectDangerousPatterns(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const { pattern, severity, description } of PluginSecurityAnalyzer.DANGEROUS_PATTERNS) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          severity,
          type: 'dangerous_pattern',
          description,
          location: this.getLocationFromIndex(code, match.index || 0),
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Parse code into AST
   */
  private parseAST(code: string): Node | null {
    try {
      return parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      });
    } catch (error) {
      logger.error('Failed to parse AST', error);
      return null;
    }
  }

  /**
   * Analyze AST for dangerous function calls
   */
  private analyzeAST(ast: Node, code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    traverse(ast, {
      CallExpression(path: any) {
        const callee = path.node.callee;

        // Check for eval()
        if (callee.name === 'eval') {
          issues.push({
            severity: 'critical',
            type: 'eval_usage',
            description: 'Use of eval() is prohibited',
            location: path.node.loc?.start || { line: 0, column: 0 },
            autoFixable: false,
          });
        }

        // Check for setTimeout/setInterval with string
        if ((callee.name === 'setTimeout' || callee.name === 'setInterval') &&
            path.node.arguments[0]?.type === 'StringLiteral') {
          issues.push({
            severity: 'high',
            type: 'string_execution',
            description: `${callee.name} with string argument can execute arbitrary code`,
            location: path.node.loc?.start || { line: 0, column: 0 },
            autoFixable: false,
          });
        }
      },

      // Check for dangerous property access
      MemberExpression(path: any) {
        const object = path.node.object;
        const property = path.node.property;

        // process.exit, process.kill, etc.
        if (object.name === 'process' && property.name === 'exit') {
          issues.push({
            severity: 'high',
            type: 'process_exit',
            description: 'Calling process.exit() can terminate the entire application',
            location: path.node.loc?.start || { line: 0, column: 0 },
            autoFixable: false,
          });
        }
      },
    });

    return issues;
  }

  /**
   * Validate that only allowed packages are imported
   */
  private validateImports(ast: Node): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    traverse(ast, {
      ImportDeclaration(path: any) {
        const packageName = path.node.source.value;
        if (!this.isAllowedPackage(packageName)) {
          issues.push({
            severity: 'high',
            type: 'unauthorized_package',
            description: `Package "${packageName}" is not in the approved package list`,
            location: path.node.loc?.start || { line: 0, column: 0 },
            autoFixable: false,
            suggestion: `Use one of the approved packages: ${PluginSecurityAnalyzer.ALLOWED_PACKAGES.join(', ')}`,
          });
        }
      },

      CallExpression(path: any) {
        // Check require() calls
        if (path.node.callee.name === 'require' && path.node.arguments[0]?.type === 'StringLiteral') {
          const packageName = path.node.arguments[0].value;
          if (!this.isAllowedPackage(packageName)) {
            issues.push({
              severity: 'high',
              type: 'unauthorized_package',
              description: `Package "${packageName}" is not in the approved package list`,
              location: path.node.loc?.start || { line: 0, column: 0 },
              autoFixable: false,
            });
          }
        }
      },
    });

    return issues;
  }

  /**
   * Validate network calls are to approved domains
   */
  private validateNetworkCalls(ast: Node, code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for axios/fetch calls with hardcoded URLs
    const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+)/gi;
    const urlMatches = code.matchAll(urlPattern);

    for (const match of urlMatches) {
      const domain = match[1];
      if (!this.isApprovedDomain(domain)) {
        issues.push({
          severity: 'medium',
          type: 'unapproved_domain',
          description: `Network call to unapproved domain: ${domain}`,
          location: this.getLocationFromIndex(code, match.index || 0),
          autoFixable: false,
          suggestion: `Approved domains: ${PluginSecurityAnalyzer.APPROVED_DOMAINS.join(', ')}`,
        });
      }
    }

    return issues;
  }

  /**
   * Check code complexity (cyclomatic complexity, nesting depth)
   */
  private checkComplexity(ast: Node): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    let maxNestingDepth = 0;
    let currentDepth = 0;

    traverse(ast, {
      enter(path: any) {
        if (path.node.type.includes('Statement') || path.node.type.includes('Expression')) {
          currentDepth++;
          maxNestingDepth = Math.max(maxNestingDepth, currentDepth);
        }
      },
      exit(path: any) {
        if (path.node.type.includes('Statement') || path.node.type.includes('Expression')) {
          currentDepth--;
        }
      },
    });

    if (maxNestingDepth > 10) {
      issues.push({
        severity: 'medium',
        type: 'high_complexity',
        description: `Code has high nesting depth (${maxNestingDepth}), which may indicate obfuscation`,
        location: { line: 0, column: 0 },
        autoFixable: false,
        suggestion: 'Simplify code structure and reduce nesting',
      });
    }

    return issues;
  }

  /**
   * Detect potential credential leaks (API keys, tokens, passwords)
   */
  private detectCredentialLeaks(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    const credentialPatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi, type: 'api_key' },
      { pattern: /(?:token|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi, type: 'token' },
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'password' },
      { pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi, type: 'secret' },
      { pattern: /(?:private[_-]?key|priv[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'private_key' },
    ];

    for (const { pattern, type } of credentialPatterns) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          severity: 'high',
          type: 'credential_leak',
          description: `Possible hardcoded ${type} detected. Use plugin credentials instead.`,
          location: this.getLocationFromIndex(code, match.index || 0),
          autoFixable: false,
          suggestion: 'Store credentials securely using plugin credential system',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(issues: SecurityIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 50;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if package is in allowed list
   */
  private isAllowedPackage(packageName: string): boolean {
    // Allow relative imports
    if (packageName.startsWith('.') || packageName.startsWith('/')) {
      return true;
    }

    // Allow scoped packages if base package is allowed
    const baseName = packageName.startsWith('@')
      ? packageName.split('/').slice(0, 2).join('/')
      : packageName.split('/')[0];

    return PluginSecurityAnalyzer.ALLOWED_PACKAGES.some(allowed =>
      baseName === allowed || baseName.startsWith(allowed + '/')
    );
  }

  /**
   * Check if domain is in approved list
   */
  private isApprovedDomain(domain: string): boolean {
    return PluginSecurityAnalyzer.APPROVED_DOMAINS.some(approved =>
      domain === approved || domain.endsWith('.' + approved)
    );
  }

  /**
   * Extract packages used in code
   */
  private extractPackages(code: string): string[] {
    const packages = new Set<string>();

    // Match import statements
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/gi;
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;

    for (const match of code.matchAll(importPattern)) {
      packages.add(match[1]);
    }

    for (const match of code.matchAll(requirePattern)) {
      packages.add(match[1]);
    }

    return Array.from(packages).filter(pkg => !pkg.startsWith('.') && !pkg.startsWith('/'));
  }

  /**
   * Convert string index to line/column location
   */
  private getLocationFromIndex(code: string, index: number): { line: number; column: number } {
    const lines = code.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }
}
