/**
 * Missing File Generator Service
 * 
 * Intelligently analyzes the filesystem and generates missing required files
 * based on what actually exists in the project.
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { MultiModelAIService } from './MultiModelAIService';

const logger = new SimpleLogger('MissingFileGenerator');

export interface FileSystemAnalysis {
  projectType: 'react-typescript' | 'react-javascript' | 'python' | 'node' | 'unknown';
  isMonorepo: boolean;
  hasClient: boolean;
  hasServer: boolean;
  existingFiles: Set<string>;
  packageJson?: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  viteConfig?: {
    exists: boolean;
    path: string;
  };
  appComponent?: {
    path: string;
    exportType: 'default' | 'named';
    componentName: string;
  };
  entryPoint?: {
    path: string;
    imports: string[];
  };
}

export interface MissingFile {
  path: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
  suggestedContent?: string;
}

export interface MissingFileGenerationContext {
  userPrompt?: string;
  appName?: string;
  knowledgeContext?: string;
}

export class MissingFileGenerator {
  private aiService: MultiModelAIService;

  constructor() {
    this.aiService = new MultiModelAIService();
  }

  /**
   * Analyze filesystem and detect missing required files
   */
  async analyzeAndGenerateMissingFiles(
    existingFiles: Array<{ path: string; content: string }>,
    context: MissingFileGenerationContext = {}
  ): Promise<Array<{ path: string; content: string }>> {
    logger.info('Analyzing filesystem for missing files...');

    const normalizedExistingFiles = this.normalizeFiles(existingFiles);
    const analysis = this.analyzeFileSystem(normalizedExistingFiles);
    const missingFiles = this.detectMissingFiles(analysis, normalizedExistingFiles, context);

    if (missingFiles.length === 0) {
      logger.info('No missing files detected');
      return [];
    }

    logger.info(`Found ${missingFiles.length} missing files, generating...`);

    const generatedFiles: Array<{ path: string; content: string }> = [];

    for (const missing of missingFiles) {
      if (missing.priority === 'critical' || missing.priority === 'high') {
        const content = await this.generateFileContent(missing, analysis, normalizedExistingFiles, context);
        if (content) {
          generatedFiles.push({
            path: this.normalizePath(missing.path),
            content
          });
          logger.info(`Generated missing file: ${missing.path}`);
        }
      }
    }

    return generatedFiles;
  }

  /**
   * Analyze the filesystem structure
   */
  private analyzeFileSystem(
    files: Array<{ path: string; content: string }>
  ): FileSystemAnalysis {
    const normalizedFiles = this.normalizeFiles(files);
    const existingFiles = new Set(normalizedFiles.map(f => f.path));
    const isMonorepo = normalizedFiles.some(f => f.path.startsWith('client/') || f.path.startsWith('server/'));
    const hasClient = normalizedFiles.some(f => f.path.startsWith('client/'));
    const hasServer = normalizedFiles.some(f => f.path.startsWith('server/'));

    // Find package.json
    let packageJson: FileSystemAnalysis['packageJson'];
    const packageJsonFile = normalizedFiles.find(f =>
      f.path === 'package.json' || f.path === 'client/package.json'
    );
    if (packageJsonFile) {
      try {
        packageJson = JSON.parse(packageJsonFile.content);
      } catch {
        // Invalid JSON
      }
    }

    // Detect project type
    let projectType: FileSystemAnalysis['projectType'] = 'unknown';
    const hasReactLikeFiles = normalizedFiles.some(f =>
      /\.(tsx|jsx)$/.test(f.path) ||
      /from\s+['"]react['"]|react-dom|createRoot|<\w+/i.test(f.content)
    );
    const hasTypeScriptFiles = normalizedFiles.some(f => /\.(ts|tsx)$/.test(f.path));

    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.react || deps['react-dom']) {
        projectType = normalizedFiles.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
          ? 'react-typescript'
          : 'react-javascript';
      } else if (deps.express || deps.fastify) {
        projectType = 'node';
      }
    } else if (hasReactLikeFiles) {
      projectType = hasTypeScriptFiles ? 'react-typescript' : 'react-javascript';
    } else if (normalizedFiles.some(f => f.path.endsWith('.py'))) {
      projectType = 'python';
    }

    // Find vite.config
    const viteConfigFile = normalizedFiles.find(f =>
      f.path === 'vite.config.ts' ||
      f.path === 'vite.config.js' ||
      f.path === 'client/vite.config.ts' ||
      f.path === 'client/vite.config.js'
    );
    const viteConfig = viteConfigFile ? {
      exists: true,
      path: viteConfigFile.path
    } : { exists: false, path: '' };

    // Find App component
    let appComponent: FileSystemAnalysis['appComponent'];
    const appFile = normalizedFiles.find(f =>
      f.path === 'src/App.tsx' ||
      f.path === 'src/App.jsx' ||
      f.path === 'client/src/App.tsx' ||
      f.path === 'client/src/App.jsx'
    );
    if (appFile) {
      const content = appFile.content;
      const hasDefaultExport = /export\s+default/.test(content);
      const componentNameMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+)?(\w+)/);
      appComponent = {
        path: appFile.path,
        exportType: hasDefaultExport ? 'default' : 'named',
        componentName: componentNameMatch?.[1] || 'App'
      };
    }

    // Find entry point
    let entryPoint: FileSystemAnalysis['entryPoint'];
    const mainFile = normalizedFiles.find(f =>
      f.path === 'src/main.tsx' ||
      f.path === 'src/main.jsx' ||
      f.path === 'src/index.tsx' ||
      f.path === 'src/index.jsx' ||
      f.path === 'client/src/main.tsx' ||
      f.path === 'client/src/main.jsx'
    );
    if (mainFile) {
      const imports = mainFile.content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
      entryPoint = {
        path: mainFile.path,
        imports: imports.map(i => i.match(/['"]([^'"]+)['"]/)?.[1] || '')
      };
    }

    return {
      projectType,
      isMonorepo,
      hasClient,
      hasServer,
      existingFiles,
      packageJson,
      viteConfig,
      appComponent,
      entryPoint
    };
  }

  /**
   * Detect missing required files based on analysis
   */
  private detectMissingFiles(
    analysis: FileSystemAnalysis,
    files: Array<{ path: string; content: string }>,
    context: MissingFileGenerationContext = {}
  ): MissingFile[] {
    const missing: MissingFile[] = [];
    const rootDir = analysis.isMonorepo && analysis.hasClient ? 'client' : '';
    const srcDir = rootDir ? `${rootDir}/src` : 'src';
    const rootPath = (fileName: string) => rootDir ? `${rootDir}/${fileName}` : fileName;

    // For React/TypeScript projects
    if (analysis.projectType === 'react-typescript' || analysis.projectType === 'react-javascript') {
      const packageJsonPath = rootPath('package.json');
      if (!analysis.existingFiles.has(packageJsonPath)) {
        missing.push({
          path: packageJsonPath,
          reason: 'Required npm package manifest for installing and starting the generated app',
          priority: 'critical',
          suggestedContent: this.generatePackageJson(analysis, context)
        });
      }

      const tsconfigPath = rootPath('tsconfig.json');
      if (analysis.projectType === 'react-typescript' && !analysis.existingFiles.has(tsconfigPath)) {
        missing.push({
          path: tsconfigPath,
          reason: 'Required TypeScript configuration for Vite/React compilation',
          priority: 'critical',
          suggestedContent: this.generateTsConfig()
        });
      }

      // Check index.html
      const indexHtmlPath = rootPath('index.html');
      if (!analysis.existingFiles.has(indexHtmlPath)) {
        missing.push({
          path: indexHtmlPath,
          reason: 'Required HTML entry point',
          priority: 'critical',
          suggestedContent: this.generateIndexHtml(analysis)
        });
      }

      // Check main.tsx/jsx
      const mainPath = `${srcDir}/main.${analysis.projectType === 'react-typescript' ? 'tsx' : 'jsx'}`;
      if (!analysis.existingFiles.has(mainPath)) {
        missing.push({
          path: mainPath,
          reason: 'Required React entry point',
          priority: 'critical',
          suggestedContent: this.generateMainEntry(analysis, srcDir)
        });
      }

      // 🚨 CRITICAL: Check App.tsx/jsx (main.tsx imports it)
      const appPath = `${srcDir}/App.${analysis.projectType === 'react-typescript' ? 'tsx' : 'jsx'}`;
      if (!analysis.existingFiles.has(appPath) && !analysis.appComponent) {
        missing.push({
          path: appPath,
          reason: 'Required App component (imported by main.tsx)',
          priority: 'critical',
          suggestedContent: context.userPrompt ? undefined : this.generateAppComponent(analysis, context)
        });
      }

      // Check vite.config.ts
      if (analysis.viteConfig && !analysis.viteConfig.exists) {
        missing.push({
          path: rootPath('vite.config.ts'),
          reason: 'Required Vite configuration',
          priority: 'high',
          suggestedContent: this.generateViteConfig(analysis)
        });
      }

      // Check src/index.css
      const indexCssPath = `${srcDir}/index.css`;
      if (!analysis.existingFiles.has(indexCssPath)) {
        missing.push({
          path: indexCssPath,
          reason: 'Global styles file',
          priority: 'medium',
          suggestedContent: this.generateIndexCss()
        });
      }
    }

    return missing;
  }

  /**
   * Generate file content using AI based on analysis
   */
  private async generateFileContent(
    missing: MissingFile,
    analysis: FileSystemAnalysis,
    existingFiles: Array<{ path: string; content: string }>,
    context: MissingFileGenerationContext = {}
  ): Promise<string | null> {
    // If we have suggested content, use it
    if (missing.suggestedContent) {
      return missing.suggestedContent;
    }

    // Otherwise, use AI to generate based on context
    try {
      const contextSummary = this.buildContext(missing, analysis, existingFiles);
      const prompt = this.buildGenerationPrompt(missing, contextSummary, context);

      const response = await this.aiService.generate({
        prompt: prompt,
        useCase: 'code_generation',
        preferredModel: 'claude-sonnet-4-5-20250929',
        maxTokens: 2000,
        priority: 'quality'
      });

      return response.content ? this.stripMarkdownCodeFence(response.content) : null;
    } catch (error) {
      logger.error('Failed to generate file content with AI', error as Error);
      return missing.suggestedContent || null;
    }
  }

  /**
   * Generate package.json based on analysis
   */
  private generatePackageJson(_analysis: FileSystemAnalysis, context: MissingFileGenerationContext = {}): string {
    const appName = (context.appName || 'generated-app')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'generated-app';

    return JSON.stringify({
      name: appName,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0',
        build: 'vite build',
        preview: 'vite preview --host 0.0.0.0'
      },
      dependencies: {
        '@vitejs/plugin-react': '^5.0.0',
        vite: '^7.0.0',
        typescript: '^5.7.0',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.468.0'
      },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1'
      }
    }, null, 2);
  }

  /**
   * Generate tsconfig.json for Vite/React
   */
  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        allowJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: 'ESNext',
        moduleResolution: 'Node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx'
      },
      include: ['src'],
      references: []
    }, null, 2);
  }

  /**
   * Generate index.html based on analysis
   */
  private generateIndexHtml(analysis: FileSystemAnalysis): string {
    const extension = analysis.projectType === 'react-typescript' ? 'tsx' : 'jsx';
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${extension}"></script>
  </body>
</html>`;
  }

  /**
   * Generate main entry point based on analysis
   */
  private generateMainEntry(analysis: FileSystemAnalysis, srcDir: string): string {
    const extension = analysis.projectType === 'react-typescript' ? 'tsx' : 'jsx';
    const importReact = analysis.projectType === 'react-typescript' 
      ? "import React from 'react';\nimport ReactDOM from 'react-dom/client';"
      : "import React from 'react';\nimport ReactDOM from 'react-dom/client';";
    
    let appImport = '';
    if (analysis.appComponent) {
      const appPath = analysis.appComponent.path.replace(/^client\//, '');
      appImport = analysis.appComponent.exportType === 'default'
        ? `import App from './App';`
        : `import { ${analysis.appComponent.componentName} as App } from './App';`;
    } else {
      appImport = "import App from './App';";
    }

    return `${importReact}
${appImport}
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found!');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  /**
   * Generate vite.config.ts based on analysis
   */
  private generateViteConfig(analysis: FileSystemAnalysis): string {
    const hasReact = analysis.packageJson?.dependencies?.react || analysis.packageJson?.devDependencies?.react;
    
    if (hasReact) {
      return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    cors: {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With']
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With'
    }
  }
});`;
    }
    
    return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    cors: {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With']
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With'
    }
  }
});`;
  }

  /**
   * Generate App component
   */
  private generateAppComponent(analysis: FileSystemAnalysis, context: MissingFileGenerationContext = {}): string {
    const importReact = analysis.projectType === 'react-typescript'
      ? "import React from 'react';"
      : "import React from 'react';";
    const title = context.appName || 'Your App';
    
    return `${importReact}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ${title}
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Your application is ready.
        </p>
      </div>
    </div>
  );
}`;
  }

  /**
   * Generate index.css
   */
  private generateIndexCss(): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}`;
  }

  private normalizeFiles(files: Array<{ path: string; content: string }>): Array<{ path: string; content: string }> {
    const normalized = new Map<string, string>();

    for (const file of files) {
      normalized.set(this.normalizePath(file.path), file.content);
    }

    return Array.from(normalized.entries()).map(([path, content]) => ({ path, content }));
  }

  private stripMarkdownCodeFence(content: string): string {
    const trimmed = content.trim();
    const match = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n?```$/);
    return match ? match[1].trim() : trimmed;
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

  /**
   * Build context for AI generation
   */
  private buildContext(
    missing: MissingFile,
    analysis: FileSystemAnalysis,
    existingFiles: Array<{ path: string; content: string }>
  ): string {
    const relevantFiles = existingFiles
      .filter(f => 
        f.path.includes('package.json') ||
        f.path.includes('App.') ||
        f.path.includes('main.') ||
        f.path.includes('vite.config')
      )
      .slice(0, 5)
      .map(f => `${f.path}:\n${f.content.substring(0, 500)}`)
      .join('\n\n---\n\n');

    return `Project Type: ${analysis.projectType}
Is Monorepo: ${analysis.isMonorepo}
Has Client: ${analysis.hasClient}
Has Server: ${analysis.hasServer}

Relevant Files:
${relevantFiles}`;
  }

  /**
   * Build prompt for AI generation
   */
  private buildGenerationPrompt(
    missing: MissingFile,
    context: string,
    generationContext: MissingFileGenerationContext = {}
  ): string {
    return `Generate the missing file: ${missing.path}

Reason: ${missing.reason}

App name:
${generationContext.appName || 'Generated app'}

Original user prompt:
${generationContext.userPrompt || '(not provided)'}

Knowledge context:
${generationContext.knowledgeContext || '(none)'}

Context:
${context}

Generate a complete, functional file that works with the existing project structure.
If this is the main App component, it must reflect the user's requested app rather than a generic placeholder.
Return ONLY the file content, no explanations.`;
  }
}
