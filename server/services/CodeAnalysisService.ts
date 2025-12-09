import { SimpleLogger } from '../utils/SimpleLogger';
import * as esbuild from 'esbuild';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../../db';
import { projectFiles } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const logger = new SimpleLogger('CodeAnalysisService');

export interface CodeIssue {
  file: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
  fixable: boolean;
  suggestion?: string;
}

export interface TypeCheckResult {
  valid: boolean;
  errors: CodeIssue[];
  warnings: CodeIssue[];
  info: CodeIssue[];
}

export interface CodeAnalysisResult {
  valid: boolean;
  issues: CodeIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    fixable: number;
  };
  suggestions: string[];
  performance: {
    bundleSize?: number;
    unusedImports?: number;
    duplicateCode?: number;
  };
}

export interface ImprovementSuggestion {
  type: 'refactor' | 'optimize' | 'security' | 'accessibility' | 'best-practice';
  priority: 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  description: string;
  before?: string;
  after?: string;
  reason: string;
}

export class CodeAnalysisService {
  /**
   * Analyze code for errors, warnings, and improvements
   */
  async analyzeCode(
    projectId: number,
    filePath?: string
  ): Promise<CodeAnalysisResult> {
    try {
      // Get project files
      const files = await db
        .select()
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.isActive, true),
            filePath ? eq(projectFiles.filePath, filePath) : undefined as any
          )
        );

      if (files.length === 0) {
        return {
          valid: true,
          issues: [],
          summary: { total: 0, errors: 0, warnings: 0, info: 0, fixable: 0 },
          suggestions: [],
          performance: {}
        };
      }

      const allIssues: CodeIssue[] = [];
      const suggestions: string[] = [];

      // Analyze each file
      for (const file of files) {
        if (!file.fileContent) continue;

        const fileIssues = await this.analyzeFile(file.filePath, file.fileContent);
        allIssues.push(...fileIssues);

        // Get suggestions for this file
        const fileSuggestions = await this.getImprovements(file.filePath, file.fileContent);
        suggestions.push(...fileSuggestions.map(s => `${file.filePath}: ${s.description}`));
      }

      // Type check
      const typeCheckResult = await this.checkTypes(projectId, filePath);
      allIssues.push(...typeCheckResult.errors, ...typeCheckResult.warnings, ...typeCheckResult.info);

      // Performance analysis
      const performance = await this.analyzePerformance(files);

      const errors = allIssues.filter(i => i.severity === 'error');
      const warnings = allIssues.filter(i => i.severity === 'warning');
      const info = allIssues.filter(i => i.severity === 'info');

      return {
        valid: errors.length === 0,
        issues: allIssues,
        summary: {
          total: allIssues.length,
          errors: errors.length,
          warnings: warnings.length,
          info: info.length,
          fixable: allIssues.filter(i => i.fixable).length
        },
        suggestions,
        performance
      };
    } catch (error) {
      logger.error('Error analyzing code', error as Error);
      throw error;
    }
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    // Skip non-code files
    if (!this.isCodeFile(filePath)) {
      return issues;
    }

    // 1. Syntax errors
    const syntaxErrors = await this.checkSyntaxErrors(filePath, content);
    issues.push(...syntaxErrors);

    // 2. TypeScript/JavaScript specific checks
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      const jsIssues = this.checkJavaScriptIssues(filePath, content);
      issues.push(...jsIssues);
    }

    // 3. React specific checks
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      const reactIssues = this.checkReactIssues(filePath, content);
      issues.push(...reactIssues);
    }

    // 4. Security checks
    const securityIssues = this.checkSecurityIssues(filePath, content);
    issues.push(...securityIssues);

    // 5. Performance checks
    const performanceIssues = this.checkPerformanceIssues(filePath, content);
    issues.push(...performanceIssues);

    return issues;
  }

  /**
   * Check for syntax errors using esbuild
   */
  private async checkSyntaxErrors(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    try {
      await esbuild.transform(content, {
        loader: this.getLoader(filePath),
        target: 'es2020',
        format: 'esm',
      });
    } catch (error: any) {
      if (error.errors && Array.isArray(error.errors)) {
        for (const err of error.errors) {
          issues.push({
            file: filePath,
            line: err.location?.line,
            column: err.location?.column,
            severity: 'error',
            message: err.text || 'Syntax error',
            rule: 'syntax',
            fixable: false
          });
        }
      } else {
        issues.push({
          file: filePath,
          severity: 'error',
          message: error.message || 'Syntax error',
          rule: 'syntax',
          fixable: false
        });
      }
    }

    return issues;
  }

  /**
   * Check JavaScript/TypeScript specific issues
   */
  private checkJavaScriptIssues(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      traverse(ast, {
        // Check for unused variables
        VariableDeclarator(path) {
          if (path.node.id.type === 'Identifier') {
            const varName = path.node.id.name;
            if (varName.startsWith('_')) return; // Ignore intentionally unused

            let isUsed = false;
            path.scope.path.traverse({
              Identifier(innerPath) {
                if (innerPath.node.name === varName && innerPath !== path.get('id')) {
                  isUsed = true;
                }
              }
            });

            if (!isUsed && path.parent.type === 'VariableDeclaration' && path.parent.declarations.length === 1) {
              issues.push({
                file: filePath,
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column,
                severity: 'warning',
                message: `Unused variable: ${varName}`,
                rule: 'no-unused-vars',
                fixable: true,
                suggestion: `Remove unused variable or prefix with underscore if intentionally unused`
              });
            }
          }
        },

        // Check for console.log in production code
        CallExpression(path) {
          if (path.node.callee.type === 'MemberExpression' &&
              path.node.callee.object.type === 'Identifier' &&
              path.node.callee.object.name === 'console') {
            issues.push({
              file: filePath,
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column,
              severity: 'warning',
              message: 'console.log should be removed in production code',
              rule: 'no-console',
              fixable: true,
              suggestion: 'Remove console.log or use a proper logging service'
            });
          }
        },

        // Check for any types
        TSTypeAnnotation(path) {
          if (path.node.typeAnnotation.type === 'TSAnyKeyword') {
            issues.push({
              file: filePath,
              line: path.node.loc?.start.line,
              column: path.node.loc?.start.column,
              severity: 'warning',
              message: 'Avoid using `any` type',
              rule: 'no-any',
              fixable: false,
              suggestion: 'Use specific types or `unknown` instead of `any`'
            });
          }
        }
      });
    } catch (error) {
      // If parsing fails, syntax errors are already caught by esbuild
      logger.warn(`Failed to parse AST for ${filePath}`, error as Error);
    }

    return issues;
  }

  /**
   * Check React specific issues
   */
  private checkReactIssues(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for missing keys in lists
    const listPattern = /\.map\s*\([^)]*\)\s*=>/g;
    let match;
    while ((match = listPattern.exec(content)) !== null) {
      const afterMap = content.substring(match.index + match[0].length);
      if (!afterMap.includes('key=') && !afterMap.includes('key:')) {
        const line = content.substring(0, match.index).split('\n').length;
        issues.push({
          file: filePath,
          line,
          severity: 'warning',
          message: 'Missing key prop in list item',
          rule: 'react-keys',
          fixable: true,
          suggestion: 'Add a unique key prop to each list item'
        });
      }
    }

    // Check for missing dependencies in useEffect
    const useEffectPattern = /useEffect\s*\([^,]+,\s*\[\s*\]/g;
    if (useEffectPattern.test(content)) {
      const matches = content.match(useEffectPattern);
      if (matches) {
        for (const match of matches) {
          const line = content.substring(0, content.indexOf(match)).split('\n').length;
          issues.push({
            file: filePath,
            line,
            severity: 'warning',
            message: 'useEffect with empty dependency array might be missing dependencies',
            rule: 'react-hooks',
            fixable: false,
            suggestion: 'Review if all dependencies are included in the dependency array'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for security issues
   */
  private checkSecurityIssues(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'Use of eval() is dangerous', rule: 'no-eval' },
      { pattern: /Function\s*\(/, message: 'Use of Function() constructor is dangerous', rule: 'no-function-constructor' },
      { pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML can lead to XSS', rule: 'no-danger' },
      { pattern: /innerHTML\s*=/, message: 'innerHTML can lead to XSS', rule: 'no-innerhtml' },
    ];

    for (const { pattern, message, rule } of dangerousPatterns) {
      const matches = content.matchAll(new RegExp(pattern.source, 'g'));
      for (const match of matches) {
        const line = content.substring(0, match.index).split('\n').length;
        issues.push({
          file: filePath,
          line,
          severity: 'error',
          message,
          rule,
          fixable: false,
          suggestion: 'Use safer alternatives'
        });
      }
    }

    return issues;
  }

  /**
   * Check for performance issues
   */
  private checkPerformanceIssues(filePath: string, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for inline functions in JSX
    const inlineFunctionPattern = /onClick\s*=\s*\{\s*\([^)]*\)\s*=>/g;
    const matches = content.matchAll(inlineFunctionPattern);
    for (const match of matches) {
      const line = content.substring(0, match.index).split('\n').length;
      issues.push({
        file: filePath,
        line,
        severity: 'info',
        message: 'Inline function in JSX can cause unnecessary re-renders',
        rule: 'react-performance',
        fixable: true,
        suggestion: 'Extract function outside JSX or use useCallback'
      });
    }

    return issues;
  }

  /**
   * Type check using esbuild
   */
  async checkTypes(
    projectId: number,
    filePath?: string
  ): Promise<TypeCheckResult> {
    const errors: CodeIssue[] = [];
    const warnings: CodeIssue[] = [];
    const info: CodeIssue[] = [];

    try {
      // Get project files
      const conditions = [
        eq(projectFiles.projectId, projectId),
        eq(projectFiles.isActive, true)
      ];
      
      if (filePath) {
        conditions.push(eq(projectFiles.filePath, filePath));
      }
      
      const files = await db
        .select()
        .from(projectFiles)
        .where(and(...conditions));

      // Create temp directory and files for type checking
      const tempDir = path.join(process.cwd(), 'temp-typecheck', `project-${projectId}-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Write files to temp directory
        for (const file of files) {
          if (!file.fileContent || !this.isCodeFile(file.filePath)) continue;
          const fullPath = path.join(tempDir, file.filePath);
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(fullPath, file.fileContent);
        }

        // Try to build with esbuild (type checking)
        try {
          await esbuild.build({
            entryPoints: files
              .filter(f => f.filePath.endsWith('.tsx') || f.filePath.endsWith('.ts'))
              .map(f => path.join(tempDir, f.filePath)),
            bundle: false,
            write: false,
            target: 'es2020',
            format: 'esm',
            platform: 'browser',
            jsx: 'transform',
          });
        } catch (buildError: any) {
          if (buildError.errors && Array.isArray(buildError.errors)) {
            for (const err of buildError.errors) {
              errors.push({
                file: err.location?.file?.replace(tempDir + path.sep, '') || 'unknown',
                line: err.location?.line,
                column: err.location?.column,
                severity: 'error',
                message: err.text || 'Type error',
                rule: 'typescript',
                fixable: false
              });
            }
          }
        }
      } finally {
        // Cleanup
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      logger.error('Error checking types', error as Error);
      warnings.push({
        file: 'unknown',
        severity: 'warning',
        message: 'Failed to perform type checking',
        rule: 'type-check',
        fixable: false
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * Find errors in code
   */
  async findErrors(projectId: number, filePath?: string): Promise<CodeIssue[]> {
    const analysis = await this.analyzeCode(projectId, filePath);
    return analysis.issues.filter(i => i.severity === 'error');
  }

  /**
   * Get improvement suggestions
   */
  async getImprovements(
    filePath: string,
    content: string
  ): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for long functions
    const functions = content.match(/function\s+\w+\s*\([^)]*\)\s*\{/g);
    if (functions) {
      for (const func of functions) {
        const funcStart = content.indexOf(func);
        const funcBody = this.extractFunctionBody(content, funcStart);
        const lines = funcBody.split('\n').length;
        
        if (lines > 50) {
          suggestions.push({
            type: 'refactor',
            priority: 'medium',
            file: filePath,
            description: `Function is too long (${lines} lines). Consider breaking it into smaller functions.`,
            reason: 'Long functions are harder to test and maintain'
          });
        }
      }
    }

    // Check for duplicate code patterns
    const duplicatePatterns = this.findDuplicatePatterns(content);
    if (duplicatePatterns.length > 0) {
      suggestions.push({
        type: 'refactor',
        priority: 'low',
        file: filePath,
        description: `Found ${duplicatePatterns.length} potential duplicate code patterns`,
        reason: 'Duplicate code can be extracted into reusable functions'
      });
    }

    return suggestions;
  }

  /**
   * Analyze performance metrics
   */
  private async analyzePerformance(files: Array<{ filePath: string; fileContent: string | null }>): Promise<CodeAnalysisResult['performance']> {
    let totalSize = 0;
    let unusedImports = 0;

    for (const file of files) {
      if (!file.fileContent) continue;
      totalSize += file.fileContent.length;

      // Count unused imports (simple heuristic)
      const importMatches = file.fileContent.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];
        // Simple check: if import path is not used in file
        if (!file.fileContent.includes(importPath.split('/').pop() || '')) {
          unusedImports++;
        }
      }
    }

    return {
      bundleSize: totalSize,
      unusedImports
    };
  }

  /**
   * Helper methods
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  private getLoader(filePath: string): esbuild.Loader {
    if (filePath.endsWith('.tsx')) return 'tsx';
    if (filePath.endsWith('.ts')) return 'ts';
    if (filePath.endsWith('.jsx')) return 'jsx';
    if (filePath.endsWith('.js')) return 'js';
    if (filePath.endsWith('.css')) return 'css';
    if (filePath.endsWith('.json')) return 'json';
    return 'text';
  }

  private extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 0;
    let inFunction = false;
    let bodyStart = startIndex;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (!inFunction) {
          inFunction = true;
          bodyStart = i + 1;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          return content.substring(bodyStart, i);
        }
      }
    }

    return '';
  }

  private findDuplicatePatterns(content: string): string[] {
    // Simple duplicate detection - look for repeated code blocks
    const lines = content.split('\n');
    const patterns: Map<string, number> = new Map();

    // Check for repeated 3+ line patterns
    for (let i = 0; i < lines.length - 2; i++) {
      const pattern = lines.slice(i, i + 3).join('\n');
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .map(([pattern, _]) => pattern);
  }
}

export const codeAnalysisService = new CodeAnalysisService();

