/**
 * Project Validator Service
 * 
 * Comprehensive validation and auto-fixing to ensure projects are functional
 * after the first generation round. This runs AFTER IncrementalOrchestrator
 * completes and BEFORE files are returned to the user.
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { ProjectFixer, ProjectAnalysis } from './ProjectFixer';
import { MissingFileGenerator } from './MissingFileGenerator';

const logger = new SimpleLogger('ProjectValidator');

export interface ValidationResult {
  isValid: boolean;
  canStart: boolean;
  issuesFixed: number;
  filesModified: number;
  criticalIssues: number;
  warnings: string[];
  errors: string[];
  validatedFiles: Array<{ path: string; content: string }>;
}

export class ProjectValidator {
  private projectFixer: ProjectFixer;
  private missingFileGenerator: MissingFileGenerator;

  constructor() {
    this.projectFixer = new ProjectFixer();
    this.missingFileGenerator = new MissingFileGenerator();
  }

  /**
   * Comprehensive validation and auto-fix pipeline
   * This ensures projects are functional before returning to user
   */
  async validateAndFixProject(
    files: Array<{ path: string; content: string }>
  ): Promise<ValidationResult> {
    logger.info(`Starting comprehensive validation for ${files.length} files...`);

    const warnings: string[] = [];
    const errors: string[] = [];
    let validatedFiles = [...files];
    let issuesFixed = 0;
    let filesModified = 0;

    try {
      // Step 1: Analyze project for all issues
      const analysis = await this.projectFixer.analyzeProject(validatedFiles);
      
      logger.info(`Analysis complete: ${analysis.totalIssues} issues found (${analysis.criticalIssues} critical)`);

      // Step 2: Auto-fix all issues
      if (analysis.totalIssues > 0) {
        logger.info(`Auto-fixing ${analysis.totalIssues} issues...`);
        const fixedFiles = await this.projectFixer.fixProject(validatedFiles, analysis);
        
        filesModified = fixedFiles.length - validatedFiles.length;
        validatedFiles = fixedFiles;
        issuesFixed = analysis.totalIssues;

        logger.info(`Fixed ${issuesFixed} issues, ${filesModified} files created/modified`);
      }

      // Step 3: Ensure all critical files exist
      const missingFiles = await this.missingFileGenerator.analyzeAndGenerateMissingFiles(validatedFiles);
      if (missingFiles.length > 0) {
        logger.info(`Generating ${missingFiles.length} missing critical files...`);
        validatedFiles.push(...missingFiles);
        filesModified += missingFiles.length;
        issuesFixed += missingFiles.length;
      }

      // Step 4: Validate critical file structure
      const structureValidation = this.validateProjectStructure(validatedFiles);
      if (!structureValidation.valid) {
        errors.push(...structureValidation.errors);
        warnings.push(...structureValidation.warnings);
      }

      // Step 5: Validate dependencies
      const dependencyValidation = this.validateDependencies(validatedFiles);
      if (!dependencyValidation.valid) {
        errors.push(...dependencyValidation.errors);
        warnings.push(...dependencyValidation.warnings);
        
        // Auto-fix dependency issues
        if (dependencyValidation.fixes) {
          validatedFiles = this.applyDependencyFixes(validatedFiles, dependencyValidation.fixes);
          issuesFixed += dependencyValidation.fixes.length;
        }
      }

      // Step 6: Validate entry points
      const entryPointValidation = this.validateEntryPoints(validatedFiles);
      if (!entryPointValidation.valid) {
        errors.push(...entryPointValidation.errors);
        warnings.push(...entryPointValidation.warnings);
      }

      // Step 7: Validate imports and exports
      const importValidation = this.validateImportsAndExports(validatedFiles);
      if (!importValidation.valid) {
        warnings.push(...importValidation.warnings);
        // Try to fix import issues
        if (importValidation.fixes) {
          validatedFiles = this.applyImportFixes(validatedFiles, importValidation.fixes);
          issuesFixed += importValidation.fixes.length;
        }
      }

      // Step 8: Final syntax check
      const syntaxValidation = this.validateSyntax(validatedFiles);
      if (!syntaxValidation.valid) {
        errors.push(...syntaxValidation.errors);
        warnings.push(...syntaxValidation.warnings);
      }

      // Determine if project can start
      const canStart = errors.length === 0 && analysis.criticalIssues === 0;
      const isValid = canStart && syntaxValidation.valid && structureValidation.valid;

      logger.info(`Validation complete: isValid=${isValid}, canStart=${canStart}, issuesFixed=${issuesFixed}`);

      return {
        isValid,
        canStart,
        issuesFixed,
        filesModified,
        criticalIssues: analysis.criticalIssues,
        warnings,
        errors,
        validatedFiles
      };
    } catch (error) {
      logger.error('Validation failed with error', error as Error);
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        isValid: false,
        canStart: false,
        issuesFixed,
        filesModified,
        criticalIssues: errors.length,
        warnings,
        errors,
        validatedFiles
      };
    }
  }

  /**
   * Validate project structure (critical files exist)
   */
  private validateProjectStructure(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const filePaths = new Set(files.map(f => f.path));

    // Detect project type
    const hasReactFiles = files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
    const hasPackageJson = files.some(f => f.path === 'package.json' || f.path === 'client/package.json');
    const isMonorepo = files.some(f => f.path.startsWith('client/') || f.path.startsWith('server/'));

    if (hasReactFiles || hasPackageJson) {
      // React/TypeScript project requirements
      const requiredFiles = isMonorepo
        ? [
            'client/package.json',
            'client/index.html',
            'client/src/main.tsx',
            'client/src/App.tsx',
            'client/vite.config.ts'
          ]
        : [
            'package.json',
            'index.html',
            'src/main.tsx',
            'src/App.tsx',
            'vite.config.ts'
          ];

      for (const required of requiredFiles) {
        if (!filePaths.has(required)) {
          errors.push(`Missing required file: ${required}`);
        }
      }

      // Check for TypeScript config if using .tsx files
      if (files.some(f => f.path.endsWith('.tsx'))) {
        const tsConfigPath = isMonorepo ? 'client/tsconfig.json' : 'tsconfig.json';
        if (!filePaths.has(tsConfigPath)) {
          warnings.push(`Missing TypeScript config: ${tsConfigPath} (recommended for .tsx files)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate dependencies in package.json
   */
  private validateDependencies(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; errors: string[]; warnings: string[]; fixes?: Array<{ path: string; dependency: string; version: string }> } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixes: Array<{ path: string; dependency: string; version: string }> = [];

    const packageJsonFile = files.find(f => f.path === 'package.json' || f.path === 'client/package.json');
    if (!packageJsonFile) {
      return { valid: true, errors, warnings }; // No package.json, skip dependency validation
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for React projects
      const hasReactFiles = files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
      if (hasReactFiles) {
        if (!deps.react) {
          errors.push('Missing react dependency');
          fixes.push({ path: packageJsonFile.path, dependency: 'react', version: '^18.2.0' });
        }
        if (!deps['react-dom']) {
          errors.push('Missing react-dom dependency');
          fixes.push({ path: packageJsonFile.path, dependency: 'react-dom', version: '^18.2.0' });
        }
      }

      // Check for Vite projects
      const hasViteConfig = files.some(f => f.path.includes('vite.config'));
      if (hasViteConfig && !deps.vite && !deps['@vitejs/plugin-react']) {
        errors.push('Missing vite dependencies');
        fixes.push({ path: packageJsonFile.path, dependency: 'vite', version: '^5.0.0' });
        fixes.push({ path: packageJsonFile.path, dependency: '@vitejs/plugin-react', version: '^5.0.0' });
      }

      // Check for dev script
      if (!packageJson.scripts || !packageJson.scripts.dev) {
        warnings.push('Missing "dev" script in package.json');
      }
    } catch (error) {
      errors.push(`Invalid package.json: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fixes: fixes.length > 0 ? fixes : undefined
    };
  }

  /**
   * Validate entry points (index.html, main.tsx, etc.)
   */
  private validateEntryPoints(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const indexHtml = files.find(f => f.path === 'index.html' || f.path === 'client/index.html');
    const mainTsx = files.find(f => f.path === 'src/main.tsx' || f.path === 'client/src/main.tsx');
    const appTsx = files.find(f => f.path === 'src/App.tsx' || f.path === 'client/src/App.tsx');

    if (indexHtml) {
      // Check that index.html references main.tsx
      if (!indexHtml.content.includes('main.tsx') && !indexHtml.content.includes('main.jsx')) {
        errors.push('index.html does not reference main.tsx/main.jsx');
      }
      if (!indexHtml.content.includes('root')) {
        warnings.push('index.html should have a #root element');
      }
    }

    if (mainTsx) {
      // Check that main.tsx imports App
      if (!mainTsx.content.includes('App') && !mainTsx.content.includes('from')) {
        errors.push('main.tsx does not import App component');
      }
      if (!mainTsx.content.includes('createRoot') && !mainTsx.content.includes('render')) {
        errors.push('main.tsx does not render to DOM');
      }
    }

    if (appTsx) {
      // Check that App.tsx has default export
      if (!appTsx.content.includes('export default') && !appTsx.content.includes('export default function')) {
        warnings.push('App.tsx should have a default export');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate imports and exports
   */
  private validateImportsAndExports(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; warnings: string[]; fixes?: Array<{ file: string; fix: string }> } {
    const warnings: string[] = [];
    const fixes: Array<{ file: string; fix: string }> = [];
    const fileMap = new Map(files.map(f => [f.path, f.content]));

    for (const file of files) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        // Check for relative imports
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(file.content)) !== null) {
          const importPath = match[1];
          
          // Skip node_modules imports
          if (importPath.startsWith('.') || importPath.startsWith('/')) {
            const resolvedPath = this.resolveImportPath(file.path, importPath);
            if (resolvedPath && !fileMap.has(resolvedPath) && !resolvedPath.includes('node_modules')) {
              warnings.push(`Import ${importPath} in ${file.path} resolves to missing file: ${resolvedPath}`);
            }
          }
        }
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      fixes: fixes.length > 0 ? fixes : undefined
    };
  }

  /**
   * Validate syntax
   */
  private validateSyntax(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      // Check for unclosed braces
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        const openBraces = (file.content.match(/{/g) || []).length;
        const closeBraces = (file.content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
          errors.push(`Unclosed braces in ${file.path}: ${openBraces} opening, ${closeBraces} closing`);
        }

        const openParens = (file.content.match(/\(/g) || []).length;
        const closeParens = (file.content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
          errors.push(`Unclosed parentheses in ${file.path}: ${openParens} opening, ${closeParens} closing`);
        }
      }

      // Check JSON files
      if (file.path.endsWith('.json')) {
        try {
          JSON.parse(file.content);
        } catch (error) {
          errors.push(`Invalid JSON in ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Apply dependency fixes
   */
  private applyDependencyFixes(
    files: Array<{ path: string; content: string }>,
    fixes: Array<{ path: string; dependency: string; version: string }>
  ): Array<{ path: string; content: string }> {
    const result = [...files];

    for (const fix of fixes) {
      const file = result.find(f => f.path === fix.path);
      if (!file) continue;

      try {
        const packageJson = JSON.parse(file.content);
        if (!packageJson.dependencies) {
          packageJson.dependencies = {};
        }
        if (!packageJson.devDependencies) {
          packageJson.devDependencies = {};
        }

        // Add to devDependencies if it's a build tool, otherwise dependencies
        const isDevDep = ['vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom'].includes(fix.dependency);
        const target = isDevDep ? packageJson.devDependencies : packageJson.dependencies;
        target[fix.dependency] = fix.version;

        file.content = JSON.stringify(packageJson, null, 2);
        logger.info(`Added dependency ${fix.dependency}@${fix.version} to ${fix.path}`);
      } catch (error) {
        logger.warn(`Failed to apply dependency fix to ${fix.path}`, error as Error);
      }
    }

    return result;
  }

  /**
   * Apply import fixes (placeholder - would need AI to generate missing files)
   */
  private applyImportFixes(
    files: Array<{ path: string; content: string }>,
    fixes: Array<{ file: string; fix: string }>
  ): Array<{ path: string; content: string }> {
    // This would require AI to generate missing imported files
    // For now, just log warnings
    logger.warn(`Import fixes needed but not implemented: ${fixes.length} fixes`);
    return files;
  }

  /**
   * Resolve import path
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

