import { SimpleLogger } from '../utils/SimpleLogger';
import { multiModelAI, AIRequest } from './MultiModelAIService';

const logger = new SimpleLogger('ErrorChecker');

export interface CodeError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'type' | 'import' | 'runtime' | 'build' | 'other';
  suggestion?: string;
  fixable: boolean;
}

export interface ErrorCheckResult {
  errors: CodeError[];
  warnings: CodeError[];
  info: CodeError[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    fixable: number;
  };
}

export class ErrorChecker {
  /**
   * Check generated code for errors and provide fix suggestions
   */
  async checkErrors(
    files: { path: string; content: string }[]
  ): Promise<ErrorCheckResult> {
    const errors: CodeError[] = [];
    const warnings: CodeError[] = [];
    const info: CodeError[] = [];

    logger.info(`Checking ${files.length} files for errors...`);

    // Syntax is validated by AISyntaxFixer with esbuild before this checker runs.
    // Regex syntax checks produced false positives on valid code like `statement; }`,
    // which blocked previews even when the generated app compiled successfully.

    // Check 2: Missing required files
    const missingFiles = this.checkMissingFiles(files);
    errors.push(...missingFiles);

    // Check 3: Import errors
    const importErrors = this.checkImportErrors(files);
    warnings.push(...importErrors);

    // Check 4: Inert navigation controls
    const navigationWarnings = this.checkNavigationInteractivity(files);
    warnings.push(...navigationWarnings);

    // Check 5: TypeScript configuration issues
    const tsConfigErrors = this.checkTypeScriptConfig(files);
    errors.push(...tsConfigErrors);

    // Check 6: Package.json issues
    const packageErrors = this.checkPackageJson(files);
    errors.push(...packageErrors.filter(e => e.severity === 'error'));
    warnings.push(...packageErrors.filter(e => e.severity === 'warning'));

    // Use AI to analyze complex errors and provide suggestions
    if (errors.length > 0 || warnings.length > 0) {
      const aiSuggestions = await this.getAISuggestions(files, errors, warnings);
      // Merge AI suggestions with existing errors
      errors.forEach((error, index) => {
        if (aiSuggestions[index]) {
          error.suggestion = aiSuggestions[index].suggestion;
          error.fixable = aiSuggestions[index].fixable;
        }
      });
    }

    const summary = {
      total: errors.length + warnings.length + info.length,
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      fixable: [...errors, ...warnings, ...info].filter(e => e.fixable).length
    };

    logger.info(`Error check complete: ${summary.errors} errors, ${summary.warnings} warnings`);

    return {
      errors,
      warnings,
      info,
      summary
    };
  }

  private checkMissingFiles(files: { path: string; content: string }[]): CodeError[] {
    const errors: CodeError[] = [];
    const filePaths = new Set(files.map(f => f.path));

    const requiredFiles = [
      { path: 'package.json', reason: 'Required for npm dependencies' },
      { path: 'tsconfig.json', reason: 'Required for TypeScript compilation' },
      { path: 'index.html', reason: 'Required HTML entry point' },
      { path: 'src/main.tsx', reason: 'Required React entry point' },
      { path: 'src/App.tsx', reason: 'Required main component' }
    ];

    requiredFiles.forEach(req => {
      if (!filePaths.has(req.path)) {
        errors.push({
          file: req.path,
          message: `Missing required file: ${req.path}`,
          severity: 'error',
          category: 'build',
          suggestion: `Create ${req.path} file`,
          fixable: true
        });
      }
    });

    return errors;
  }

  private checkImportErrors(files: { path: string; content: string }[]): CodeError[] {
    const warnings: CodeError[] = [];
    const fileMap = new Map(files.map(f => [f.path, f.content]));
    const filePaths = new Set(files.map(f => f.path.replace(/\\/g, '/')));

    const resolveRelativeImport = (fromFile: string, importPath: string): string[] => {
      const fromParts = fromFile.replace(/\\/g, '/').split('/');
      fromParts.pop();
      const combined = [...fromParts, ...importPath.split('/')];
      const normalized: string[] = [];

      for (const part of combined) {
        if (!part || part === '.') continue;
        if (part === '..') {
          normalized.pop();
          continue;
        }
        normalized.push(part);
      }

      const basePath = normalized.join('/');
      return [
        basePath,
        `${basePath}.tsx`,
        `${basePath}.ts`,
        `${basePath}.jsx`,
        `${basePath}.js`,
        `${basePath}/index.tsx`,
        `${basePath}/index.ts`,
        `${basePath}/index.jsx`,
        `${basePath}/index.js`,
      ];
    };

    files.forEach(file => {
      const importRegex = /import\s+(?:.*\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
      const matches = file.content.matchAll(importRegex);

      for (const match of matches) {
        const importPath = match[1];
        const candidates = resolveRelativeImport(file.path, importPath);

        if (!candidates.some(candidate => filePaths.has(candidate) || fileMap.has(candidate))) {
          warnings.push({
            file: file.path,
            message: `Import not found: ${importPath}`,
            severity: 'warning',
            category: 'import',
            suggestion: `Check if ${importPath} exists or remove the import`,
            fixable: true
          });
        }
      }
    });

    return warnings;
  }

  private checkNavigationInteractivity(files: { path: string; content: string }[]): CodeError[] {
    const warnings: CodeError[] = [];
    const pageLikeLabels = [
      'home',
      'gallery',
      'community',
      'about',
      'cards',
      'packs',
      'settings',
      'profile',
      'dashboard',
      'collection',
    ];

    for (const file of files) {
      if (!/\.(tsx|jsx)$/.test(file.path)) continue;

      const navBlocks = file.content.matchAll(/<nav\b[\s\S]*?<\/nav>/gi);
      for (const navMatch of navBlocks) {
        const navContent = navMatch[0];
        const normalizedNavText = navContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .toLowerCase();
        const matchedLabels = pageLikeLabels.filter(label =>
          new RegExp(`\\b${label}\\b`, 'i').test(normalizedNavText)
        );

        if (matchedLabels.length < 2) continue;

        const deadHref = /href=["']#?["']/i.test(navContent);
        const buttonMatches = Array.from(navContent.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi));
        const inertButtons = buttonMatches.filter(([, attributes, children]) => {
          const labelText = children.replace(/<[^>]+>/g, ' ').toLowerCase();
          return !/onClick\s*=/.test(attributes) && pageLikeLabels.some(label => new RegExp(`\\b${label}\\b`, 'i').test(labelText));
        });

        if (!deadHref && inertButtons.length === 0) continue;

        const line = file.content.slice(0, navMatch.index ?? 0).split('\n').length;
        warnings.push({
          file: file.path,
          line,
          message: `Navigation appears to include page labels (${matchedLabels.join(', ')}) but has inert links or buttons`,
          severity: 'warning',
          category: 'runtime',
          suggestion: 'Wire each navigation item to active page/tab state, matching anchor sections, or real router routes',
          fixable: true,
        });
      }
    }

    return warnings;
  }

  private checkTypeScriptConfig(files: { path: string; content: string }[]): CodeError[] {
    const errors: CodeError[] = [];
    const tsConfigFile = files.find(f => f.path === 'tsconfig.json');
    const tsConfigNodeFile = files.find(f => f.path === 'tsconfig.node.json');

    if (tsConfigFile) {
      try {
        const tsConfig = JSON.parse(tsConfigFile.content);
        // Check if tsconfig.json references tsconfig.node.json but it doesn't exist
        if (tsConfig.references && !tsConfigNodeFile) {
          errors.push({
            file: 'tsconfig.json',
            message: 'tsconfig.json references tsconfig.node.json but file is missing',
            severity: 'error',
            category: 'build',
            suggestion: 'Either create tsconfig.node.json or remove references from tsconfig.json',
            fixable: true
          });
        }
      } catch (e) {
        errors.push({
          file: 'tsconfig.json',
          message: 'Invalid JSON in tsconfig.json',
          severity: 'error',
          category: 'syntax',
          suggestion: 'Fix JSON syntax errors',
          fixable: true
        });
      }
    }

    // Check if vite.config.ts exists but tsconfig.node.json doesn't
    const viteConfig = files.find(f => f.path === 'vite.config.ts');
    if (viteConfig && !tsConfigNodeFile) {
      errors.push({
        file: 'tsconfig.node.json',
        message: 'Missing tsconfig.node.json (required by vite.config.ts)',
        severity: 'error',
        category: 'build',
        suggestion: 'Create tsconfig.node.json file',
        fixable: true
      });
    }

    return errors;
  }

  private checkPackageJson(files: { path: string; content: string }[]): CodeError[] {
    const errors: CodeError[] = [];
    const packageJsonFile = files.find(f => f.path === 'package.json');

    if (!packageJsonFile) {
      return errors;
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      
      // Check required dependencies
      const requiredDeps = ['react', 'react-dom'];
      requiredDeps.forEach(dep => {
        if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
          errors.push({
            file: 'package.json',
            message: `Missing required dependency: ${dep}`,
            severity: 'warning',
            category: 'build',
            suggestion: `Add "${dep}" to dependencies`,
            fixable: true
          });
        }
      });

      // Check required devDependencies
      const requiredDevDeps = ['vite', 'typescript', '@types/react', '@types/react-dom'];
      requiredDevDeps.forEach(dep => {
        if (!packageJson.devDependencies?.[dep]) {
          errors.push({
            file: 'package.json',
            message: `Missing required devDependency: ${dep}`,
            severity: 'warning',
            category: 'build',
            suggestion: `Add "${dep}" to devDependencies`,
            fixable: true
          });
        }
      });
    } catch (e) {
      errors.push({
        file: 'package.json',
        message: 'Invalid JSON in package.json',
        severity: 'error',
        category: 'syntax',
        suggestion: 'Fix JSON syntax errors',
        fixable: true
      });
    }

    return errors;
  }

  private async getAISuggestions(
    files: { path: string; content: string }[],
    errors: CodeError[],
    _warnings: CodeError[]
  ): Promise<Array<{ suggestion: string; fixable: boolean }>> {
    try {
      const errorSummary = errors.slice(0, 10).map(e => 
        `- ${e.file}:${e.line || '?'} - ${e.message}`
      ).join('\n');

      const systemPrompt = `You are an expert code reviewer. Analyze the errors and provide specific, actionable fix suggestions.
      
For each error, provide:
1. A clear explanation of what's wrong
2. A specific fix suggestion
3. Whether the error is automatically fixable (true/false)

Be concise and practical. Focus on syntax errors, missing files, and configuration issues.`;

      const userPrompt = `I have generated code with the following errors:

${errorSummary}

${errors.length > 10 ? `... and ${errors.length - 10} more errors` : ''}

Provide fix suggestions for each error. Format as JSON array:
[
  {
    "suggestion": "specific fix instruction",
    "fixable": true/false
  }
]`;

      const aiRequest: AIRequest = {
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 1000,
        temperature: 0.3,
        useCase: 'code_review',
        priority: 'speed'
      };

      const response = await multiModelAI.generate(aiRequest);
      
      if (!response.content) {
        return errors.map(() => ({ suggestion: 'Unable to generate suggestion', fixable: false }));
      }

      // Parse AI response
      try {
        const content = response.content.trim();
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          return suggestions.slice(0, errors.length);
        }
      } catch (e) {
        logger.warn('Failed to parse AI suggestions', e as Error);
      }

      return errors.map(() => ({ suggestion: 'See error details above', fixable: false }));
    } catch (error) {
      logger.error('Failed to get AI suggestions', error as Error);
      return errors.map(() => ({ suggestion: 'Error analysis unavailable', fixable: false }));
    }
  }
}

export const errorChecker = new ErrorChecker();
