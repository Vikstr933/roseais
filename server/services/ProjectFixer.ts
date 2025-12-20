/**
 * Project Fixer Service
 * 
 * Analyzes projects for issues and automatically fixes them
 * to ensure projects start and run without problems.
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { MultiModelAIService } from './MultiModelAIService';
import { MissingFileGenerator } from './MissingFileGenerator';

const logger = new SimpleLogger('ProjectFixer');

export interface ProjectIssue {
  type: 'missing_file' | 'syntax_error' | 'import_error' | 'config_error' | 'dependency_error' | 'runtime_error';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  message: string;
  fix?: {
    action: 'create_file' | 'modify_file' | 'add_dependency' | 'fix_syntax';
    description: string;
    content?: string;
    modifications?: Array<{
      line: number;
      old: string;
      new: string;
    }>;
  };
}

export interface ProjectAnalysis {
  issues: ProjectIssue[];
  canStart: boolean;
  criticalIssues: number;
  totalIssues: number;
}

export class ProjectFixer {
  private aiService: MultiModelAIService;
  private missingFileGenerator: MissingFileGenerator;

  constructor() {
    this.aiService = new MultiModelAIService();
    this.missingFileGenerator = new MissingFileGenerator();
  }

  /**
   * Analyze project and identify all issues
   */
  async analyzeProject(
    files: Array<{ path: string; content: string }>
  ): Promise<ProjectAnalysis> {
    logger.info(`Analyzing project with ${files.length} files...`);

    const issues: ProjectIssue[] = [];

    // 1. Check for missing critical files
    const missingFiles = await this.missingFileGenerator.analyzeAndGenerateMissingFiles(files);
    if (missingFiles.length > 0) {
      for (const missing of missingFiles) {
        issues.push({
          type: 'missing_file',
          severity: 'critical',
          file: missing.path,
          message: `Missing critical file: ${missing.path}`,
          fix: {
            action: 'create_file',
            description: `Create ${missing.path}`,
            content: missing.content
          }
        });
      }
    }

    // 2. Check for syntax errors
    const syntaxIssues = this.detectSyntaxErrors(files);
    issues.push(...syntaxIssues);

    // 3. Check for import errors
    const importIssues = this.detectImportErrors(files);
    issues.push(...importIssues);

    // 4. Check for configuration errors
    const configIssues = this.detectConfigErrors(files);
    issues.push(...configIssues);

    // 5. Check for dependency errors
    const dependencyIssues = this.detectDependencyErrors(files);
    issues.push(...dependencyIssues);

    // 6. Check for runtime errors (common patterns)
    const runtimeIssues = this.detectRuntimeErrors(files);
    issues.push(...runtimeIssues);

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const canStart = criticalIssues === 0;

    logger.info(`Analysis complete: ${issues.length} issues found (${criticalIssues} critical)`);

    return {
      issues,
      canStart,
      criticalIssues,
      totalIssues: issues.length
    };
  }

  /**
   * Fix all issues in the project
   */
  async fixProject(
    files: Array<{ path: string; content: string }>,
    analysis?: ProjectAnalysis
  ): Promise<Array<{ path: string; content: string }>> {
    if (!analysis) {
      analysis = await this.analyzeProject(files);
    }

    logger.info(`Fixing ${analysis.totalIssues} issues in project...`);

    const fixedFiles = new Map<string, string>();
    const fileMap = new Map(files.map(f => [f.path, f.content]));

    // Sort issues by severity (critical first)
    const sortedIssues = [...analysis.issues].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const issue of sortedIssues) {
      if (!issue.fix) continue;

      try {
        switch (issue.fix.action) {
          case 'create_file':
            if (issue.fix.content && !fileMap.has(issue.file || '')) {
              fixedFiles.set(issue.file || '', issue.fix.content);
              logger.info(`Created file: ${issue.file}`);
            }
            break;

          case 'modify_file':
            if (issue.file && issue.fix.modifications) {
              const currentContent = fileMap.get(issue.file) || fixedFiles.get(issue.file) || '';
              const modifiedContent = this.applyModifications(currentContent, issue.fix.modifications);
              fixedFiles.set(issue.file, modifiedContent);
              logger.info(`Modified file: ${issue.file}`);
            }
            break;

          case 'fix_syntax':
            if (issue.file) {
              const currentContent = fileMap.get(issue.file) || fixedFiles.get(issue.file) || '';
              const fixedContent = await this.fixSyntaxErrors(currentContent, issue);
              if (fixedContent && fixedContent !== currentContent) {
                fixedFiles.set(issue.file, fixedContent);
                logger.info(`Fixed syntax in: ${issue.file}`);
              }
            }
            break;

          case 'add_dependency':
            // Handle dependency additions
            const packageJsonFile = files.find(f => f.path === 'package.json' || f.path === 'client/package.json');
            if (packageJsonFile && issue.fix.content) {
              const updatedPackageJson = this.addDependency(packageJsonFile.content, issue.fix.content);
              fixedFiles.set(packageJsonFile.path, updatedPackageJson);
              logger.info(`Added dependency to: ${packageJsonFile.path}`);
            }
            break;
        }
      } catch (error) {
        logger.warn(`Failed to fix issue: ${issue.message}`, error as Error);
      }
    }

    // Merge fixed files with original files
    const result = files.map(file => ({
      path: file.path,
      content: fixedFiles.has(file.path) ? fixedFiles.get(file.path)! : file.content
    }));

    // Add newly created files
    for (const [path, content] of fixedFiles.entries()) {
      if (!result.some(f => f.path === path)) {
        result.push({ path, content });
      }
    }

    logger.info(`Fixed ${fixedFiles.size} file(s)`);

    return result;
  }

  /**
   * Detect syntax errors in files
   */
  private detectSyntaxErrors(files: Array<{ path: string; content: string }>): ProjectIssue[] {
    const issues: ProjectIssue[] = [];

    for (const file of files) {
      // Check for common syntax errors
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        // Unclosed braces
        const openBraces = (file.content.match(/{/g) || []).length;
        const closeBraces = (file.content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
          issues.push({
            type: 'syntax_error',
            severity: 'critical',
            file: file.path,
            message: `Unclosed braces: ${openBraces} opening, ${closeBraces} closing`,
            fix: {
              action: 'fix_syntax',
              description: 'Fix unclosed braces'
            }
          });
        }

        // Unclosed parentheses
        const openParens = (file.content.match(/\(/g) || []).length;
        const closeParens = (file.content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
          issues.push({
            type: 'syntax_error',
            severity: 'critical',
            file: file.path,
            message: `Unclosed parentheses: ${openParens} opening, ${closeParens} closing`,
            fix: {
              action: 'fix_syntax',
              description: 'Fix unclosed parentheses'
            }
          });
        }

        // Semicolon after opening brace (common error)
        if (/\{\s*;/.test(file.content)) {
          issues.push({
            type: 'syntax_error',
            severity: 'critical',
            file: file.path,
            message: 'Semicolon after opening brace ({;)',
            fix: {
              action: 'fix_syntax',
              description: 'Remove semicolon after opening brace'
            }
          });
        }
      }

      // Check JSON files
      if (file.path.endsWith('.json')) {
        try {
          JSON.parse(file.content);
        } catch (error) {
          issues.push({
            type: 'syntax_error',
            severity: 'critical',
            file: file.path,
            message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            fix: {
              action: 'fix_syntax',
              description: 'Fix JSON syntax'
            }
          });
        }
      }
    }

    return issues;
  }

  /**
   * Detect import errors
   */
  private detectImportErrors(files: Array<{ path: string; content: string }>): ProjectIssue[] {
    const issues: ProjectIssue[] = [];
    const filePaths = new Set(files.map(f => f.path));

    for (const file of files) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        // Extract imports
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(file.content)) !== null) {
          const importPath = match[1];
          
          // Skip node_modules imports
          if (importPath.startsWith('.') || importPath.startsWith('/')) {
            const resolvedPath = this.resolveImportPath(file.path, importPath);
            if (resolvedPath && !filePaths.has(resolvedPath) && !resolvedPath.includes('node_modules')) {
              issues.push({
                type: 'import_error',
                severity: 'high',
                file: file.path,
                message: `Missing import: ${importPath} (resolved to ${resolvedPath})`,
                fix: {
                  action: 'create_file',
                  description: `Create missing file: ${resolvedPath}`
                }
              });
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Detect configuration errors
   */
  private detectConfigErrors(files: Array<{ path: string; content: string }>): ProjectIssue[] {
    const issues: ProjectIssue[] = [];

    // Check package.json
    const packageJson = files.find(f => f.path === 'package.json' || f.path === 'client/package.json');
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);
        
        // Check for missing dev script
        if (!pkg.scripts || !pkg.scripts.dev) {
          issues.push({
            type: 'config_error',
            severity: 'critical',
            file: packageJson.path,
            message: 'Missing "dev" script in package.json',
            fix: {
              action: 'modify_file',
              description: 'Add dev script',
              modifications: [{
                line: 0,
                old: '',
                new: pkg.scripts ? '' : '"scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },'
              }]
            }
          });
        }

        // Check for missing vite dependency
        if (!pkg.devDependencies?.vite && !pkg.dependencies?.vite) {
          issues.push({
            type: 'dependency_error',
            severity: 'high',
            file: packageJson.path,
            message: 'Missing vite dependency',
            fix: {
              action: 'add_dependency',
              description: 'Add vite to devDependencies',
              content: JSON.stringify({ vite: '^5.0.0', '@vitejs/plugin-react': '^5.0.0' })
            }
          });
        }
      } catch {
        // Invalid JSON already caught by syntax check
      }
    }

    return issues;
  }

  /**
   * Detect dependency errors
   */
  private detectDependencyErrors(files: Array<{ path: string; content: string }>): ProjectIssue[] {
    const issues: ProjectIssue[] = [];

    const packageJson = files.find(f => f.path === 'package.json' || f.path === 'client/package.json');
    if (!packageJson) return issues;

    try {
      const pkg = JSON.parse(packageJson.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for React projects missing React
      const hasReactFiles = files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
      if (hasReactFiles && !deps.react) {
        issues.push({
          type: 'dependency_error',
          severity: 'critical',
          file: packageJson.path,
          message: 'React project missing react dependency',
          fix: {
            action: 'add_dependency',
            description: 'Add react and react-dom',
            content: JSON.stringify({ react: '^18.2.0', 'react-dom': '^18.2.0' })
          }
        });
      }
    } catch {
      // Invalid JSON
    }

    return issues;
  }

  /**
   * Detect runtime errors (common patterns)
   */
  private detectRuntimeErrors(files: Array<{ path: string; content: string }>): ProjectIssue[] {
    const issues: ProjectIssue[] = [];

    for (const file of files) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
        // Check for undefined/null access without optional chaining
        if (/\.\w+\s*[=!<>]/.test(file.content) && !file.content.includes('?.') && file.content.includes('undefined') || file.content.includes('null')) {
          // This is a warning, not critical
          issues.push({
            type: 'runtime_error',
            severity: 'medium',
            file: file.path,
            message: 'Potential null/undefined access without optional chaining',
            fix: {
              action: 'modify_file',
              description: 'Add optional chaining for safer access'
            }
          });
        }
      }
    }

    return issues;
  }

  /**
   * Fix syntax errors using AI
   */
  private async fixSyntaxErrors(content: string, issue: ProjectIssue): Promise<string> {
    try {
      const prompt = `Fix the syntax error in this code:

Error: ${issue.message}

Code:
\`\`\`
${content}
\`\`\`

Return the fixed code with the syntax error corrected. Return ONLY the code, no explanations.`;

      const response = await this.aiService.generate({
        prompt,
        useCase: 'code_review',
        maxTokens: 4000,
        priority: 'quality'
      });

      return response.content;
    } catch (error) {
      logger.warn('Failed to fix syntax with AI', error as Error);
      return content;
    }
  }

  /**
   * Apply modifications to file content
   */
  private applyModifications(content: string, modifications: Array<{ line: number; old: string; new: string }>): string {
    let result = content;
    const lines = result.split('\n');

    for (const mod of modifications) {
      if (mod.line === 0) {
        // Insert at beginning
        result = mod.new + '\n' + result;
      } else if (mod.line < lines.length) {
        // Replace line
        lines[mod.line] = mod.new;
      } else {
        // Append
        lines.push(mod.new);
      }
    }

    return lines.join('\n');
  }

  /**
   * Add dependency to package.json
   */
  private addDependency(packageJsonContent: string, dependencyJson: string): string {
    try {
      const pkg = JSON.parse(packageJsonContent);
      const depsToAdd = JSON.parse(dependencyJson);

      if (!pkg.devDependencies) {
        pkg.devDependencies = {};
      }

      Object.assign(pkg.devDependencies, depsToAdd);

      return JSON.stringify(pkg, null, 2);
    } catch {
      return packageJsonContent;
    }
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null; // External import
    }

    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/')) || '.';
    
    if (importPath.startsWith('./')) {
      return `${fromDir}/${importPath.substring(2)}`;
    } else if (importPath.startsWith('../')) {
      const parts = fromDir.split('/').filter(p => p);
      const importParts = importPath.split('/').filter(p => p);
      
      for (const part of importParts) {
        if (part === '..') {
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      
      return parts.join('/');
    }

    return importPath;
  }
}

