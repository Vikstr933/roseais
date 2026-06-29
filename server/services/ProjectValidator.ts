/**
 * Project Validator Service
 * 
 * Comprehensive validation and auto-fixing to ensure projects are functional
 * after the first generation round. This runs AFTER IncrementalOrchestrator
 * completes and BEFORE files are returned to the user.
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { ProjectFixer } from './ProjectFixer';
import { MissingFileGenerator } from './MissingFileGenerator';
import { ImportCompletenessContext, ImportCompletenessFixer } from './ImportCompletenessFixer';

const logger = new SimpleLogger('ProjectValidator');

const DEPENDENCY_VERSION_OVERRIDES: Record<string, string> = {
  '@vitejs/plugin-react': '^5.0.0',
  vite: '^7.0.0',
  typescript: '^5.7.0',
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  'lucide-react': '^0.468.0',
  'framer-motion': '^11.13.1',
  'react-router-dom': '^7.0.0',
  recharts: '^2.13.0',
  axios: '^1.7.7',
  'date-fns': '^3.6.0',
  clsx: '^2.1.1',
  'class-variance-authority': '^0.7.0',
  'tailwind-merge': '^2.5.4',
  '@types/react': '^18.3.12',
  '@types/react-dom': '^18.3.1',
};

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
  private importCompletenessFixer: ImportCompletenessFixer;

  constructor() {
    this.projectFixer = new ProjectFixer();
    this.missingFileGenerator = new MissingFileGenerator();
    this.importCompletenessFixer = new ImportCompletenessFixer();
  }

  /**
   * Comprehensive validation and auto-fix pipeline
   * This ensures projects are functional before returning to user
   */
  async validateAndFixProject(
    files: Array<{ path: string; content: string }>,
    context: ImportCompletenessContext = {}
  ): Promise<ValidationResult> {
    logger.info(`Starting comprehensive validation for ${files.length} files...`);

    const warnings: string[] = [];
    const errors: string[] = [];
    let validatedFiles = this.normalizeFiles(files);
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
      const missingFiles = await this.missingFileGenerator.analyzeAndGenerateMissingFiles(validatedFiles, context);
      if (missingFiles.length > 0) {
        logger.info(`Generating ${missingFiles.length} missing critical files...`);
        validatedFiles = this.normalizeFiles([...validatedFiles, ...missingFiles]);
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
      let dependencyValidation = this.validateDependencies(validatedFiles);
      if (!dependencyValidation.valid) {
        // Auto-fix dependency issues
        if (dependencyValidation.fixes) {
          validatedFiles = this.applyDependencyFixes(validatedFiles, dependencyValidation.fixes);
          issuesFixed += dependencyValidation.fixes.length;
          dependencyValidation = this.validateDependencies(validatedFiles);
        }

        if (!dependencyValidation.valid) {
          errors.push(...dependencyValidation.errors);
        }
        warnings.push(...dependencyValidation.warnings);
      }

      // Step 6: Validate entry points
      const entryPointValidation = this.validateEntryPoints(validatedFiles);
      if (!entryPointValidation.valid) {
        errors.push(...entryPointValidation.errors);
        warnings.push(...entryPointValidation.warnings);
      }

      // Step 7: Validate imports and exports
      let importValidation = this.validateImportsAndExports(validatedFiles);
      if (!importValidation.valid) {
        const importRepair = await this.importCompletenessFixer.repairMissingImports(
          validatedFiles,
          context
        );

        if (importRepair.generatedFiles.length > 0) {
          validatedFiles = importRepair.fixedFiles;
          filesModified += importRepair.generatedFiles.length;
          issuesFixed += importRepair.generatedFiles.length;
          logger.info(`Generated ${importRepair.generatedFiles.length} missing import module(s) during validation`);
        }

        importValidation = this.validateImportsAndExports(validatedFiles);
        if (!importValidation.valid) {
          errors.push(...importValidation.errors);
          warnings.push(...importValidation.warnings);
        }
      }

      // Step 8: Final syntax check
      const syntaxValidation = this.validateSyntax(validatedFiles);
      if (!syntaxValidation.valid) {
        errors.push(...syntaxValidation.errors);
        warnings.push(...syntaxValidation.warnings);
      }

      // Step 9: Block generic fallback app screens from counting as complete apps
      const placeholderValidation = this.validateNoPlaceholderContent(validatedFiles);
      if (!placeholderValidation.valid) {
        errors.push(...placeholderValidation.errors);
        warnings.push(...placeholderValidation.warnings);
      }

      // Determine if project can start
      const canStart = errors.length === 0;
      const isValid = canStart && syntaxValidation.valid && structureValidation.valid && importValidation.valid && placeholderValidation.valid;
      const criticalIssues = errors.length;

      logger.info(`Validation complete: isValid=${isValid}, canStart=${canStart}, issuesFixed=${issuesFixed}, criticalIssues=${criticalIssues}`);

      return {
        isValid,
        canStart,
        issuesFixed,
        filesModified,
        criticalIssues,
        warnings,
        errors,
        validatedFiles: this.normalizeFiles(validatedFiles)
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
    const normalizedFiles = this.normalizeFiles(files);
    const filePaths = new Set(normalizedFiles.map(f => f.path));

    // Detect project type
    const hasReactFiles = normalizedFiles.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
    const hasPackageJson = normalizedFiles.some(f => f.path === 'package.json' || f.path === 'client/package.json');
    const isMonorepo = normalizedFiles.some(f => f.path.startsWith('client/') || f.path.startsWith('server/'));

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
      if (normalizedFiles.some(f => f.path.endsWith('.tsx'))) {
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
      const externalImports = this.detectExternalPackageImports(files, packageJsonFile.path);

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

      for (const dependency of externalImports) {
        if (!deps[dependency]) {
          errors.push(`Missing dependency for generated import: ${dependency}`);
          fixes.push({
            path: packageJsonFile.path,
            dependency,
            version: this.getDependencyVersion(dependency),
          });
        }
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
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedFiles = this.normalizeFiles(files);
    const fileMap = new Map(normalizedFiles.map(f => [f.path, f.content]));

    for (const file of normalizedFiles) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        // Check for relative imports
        const importRegex = /(?:import\s+(?:.*?\s+from\s+)?|export\s+.*?\s+from\s+)['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(file.content)) !== null) {
          const importPath = match[1];
          
          // Skip node_modules imports
          if (importPath.startsWith('.') || importPath.startsWith('/')) {
            const resolvedPaths = this.resolveImportCandidates(file.path, importPath);
            if (resolvedPaths.length > 0 && !resolvedPaths.some(path => fileMap.has(path))) {
              errors.push(`Import ${importPath} in ${file.path} resolves to missing file (checked: ${resolvedPaths.join(', ')})`);
            }
          }
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
   * Do not let generic system-created placeholders pass as a completed app.
   */
  private validateNoPlaceholderContent(
    files: Array<{ path: string; content: string }>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const placeholderPatterns = [
      /Welcome to your new application/i,
      /This is a starter template/i,
      /Welcome to Your App/i,
      /Your application is ready/i,
      /Start building your features here/i,
      /Customize this component to build your application/i
    ];

    for (const file of files) {
      if (!/(^|\/)App\.(tsx|jsx)$/.test(file.path)) {
        continue;
      }

      if (placeholderPatterns.some(pattern => pattern.test(file.content))) {
        errors.push(`${file.path} contains a generic fallback App component instead of the requested application`);
        warnings.push('Regenerate the app component from the user prompt rather than publishing fallback content');
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

  private detectExternalPackageImports(
    files: Array<{ path: string; content: string }>,
    packageJsonPath: string
  ): string[] {
    const frontendFiles = packageJsonPath === 'client/package.json'
      ? files.filter(file => file.path.startsWith('client/'))
      : files.filter(file => !file.path.startsWith('server/'));
    const packageNames = new Set<string>();
    const importRegex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;

    for (const file of frontendFiles) {
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(file.path)) {
        continue;
      }

      for (const match of file.content.matchAll(importRegex)) {
        const packageName = this.getPackageNameFromImport(match[1]);
        if (packageName) {
          packageNames.add(packageName);
        }
      }
    }

    return Array.from(packageNames).sort();
  }

  private getPackageNameFromImport(importPath: string): string | null {
    if (
      !importPath ||
      importPath.startsWith('.') ||
      importPath.startsWith('/') ||
      importPath.startsWith('node:') ||
      importPath.startsWith('virtual:')
    ) {
      return null;
    }

    const builtins = new Set([
      'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http',
      'https', 'module', 'net', 'os', 'path', 'process', 'querystring',
      'stream', 'timers', 'tty', 'url', 'util', 'zlib'
    ]);
    if (builtins.has(importPath)) {
      return null;
    }

    if (importPath.startsWith('@')) {
      const [scope, name] = importPath.split('/');
      return scope && name ? `${scope}/${name}` : importPath;
    }

    return importPath.split('/')[0];
  }

  private getDependencyVersion(dependency: string): string {
    return DEPENDENCY_VERSION_OVERRIDES[dependency] || 'latest';
  }

  /**
   * Resolve import path
   */
  private resolveImportCandidates(fromFile: string, importPath: string): string[] {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return []; // External import
    }

    const normalizedFromFile = this.normalizePath(fromFile);
    const fromDir = normalizedFromFile.includes('/')
      ? normalizedFromFile.substring(0, normalizedFromFile.lastIndexOf('/'))
      : '';
    const basePath = importPath.startsWith('/')
      ? importPath.substring(1)
      : this.normalizePath(`${fromDir}/${importPath}`);
    const normalizedBase = this.normalizePath(basePath);

    if (/\.[a-zA-Z0-9]+$/.test(normalizedBase)) {
      return [normalizedBase];
    }

    return [
      normalizedBase,
      `${normalizedBase}.tsx`,
      `${normalizedBase}.ts`,
      `${normalizedBase}.jsx`,
      `${normalizedBase}.js`,
      `${normalizedBase}.json`,
      `${normalizedBase}.css`,
      `${normalizedBase}/index.tsx`,
      `${normalizedBase}/index.ts`,
      `${normalizedBase}/index.jsx`,
      `${normalizedBase}/index.js`
    ];
  }

  private normalizeFiles(files: Array<{ path: string; content: string }>): Array<{ path: string; content: string }> {
    const normalized = new Map<string, string>();
    const normalizedInput = files.map(file => ({
      ...file,
      path: this.normalizePath(file.path)
    }));
    const hasServer = normalizedInput.some(file => file.path.startsWith('server/'));
    const hasClientPackage = normalizedInput.some(file => file.path === 'client/package.json');

    for (const file of normalizedInput) {
      normalized.set(this.normalizeFullstackPath(file.path, hasServer, hasClientPackage), file.content);
    }

    return Array.from(normalized.entries()).map(([path, content]) => ({ path, content }));
  }

  private normalizeFullstackPath(path: string, hasServer: boolean, hasClientPackage: boolean): string {
    if (!hasServer || path.startsWith('client/') || path.startsWith('server/')) {
      return path;
    }

    if (path.startsWith('src/')) {
      return `client/${path}`;
    }

    const frontendRootFiles = new Set([
      'index.html',
      'vite.config.ts',
      'vite.config.js',
      'tsconfig.json',
      'tsconfig.node.json',
      'tailwind.config.js',
      'postcss.config.js',
      '.env.example'
    ]);

    if (frontendRootFiles.has(path)) {
      return `client/${path}`;
    }

    if (path === 'package.json' && !hasClientPackage) {
      return 'client/package.json';
    }

    return path;
  }

  private normalizePath(filePath: string): string {
    const parts: string[] = [];
    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '');

    for (const part of normalized.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    return parts.join('/');
  }
}
