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

export class MissingFileGenerator {
  private aiService: MultiModelAIService;

  constructor() {
    this.aiService = new MultiModelAIService();
  }

  /**
   * Analyze filesystem and detect missing required files
   */
  async analyzeAndGenerateMissingFiles(
    existingFiles: Array<{ path: string; content: string }>
  ): Promise<Array<{ path: string; content: string }>> {
    logger.info('Analyzing filesystem for missing files...');

    const analysis = this.analyzeFileSystem(existingFiles);
    const missingFiles = this.detectMissingFiles(analysis, existingFiles);

    if (missingFiles.length === 0) {
      logger.info('No missing files detected');
      return [];
    }

    logger.info(`Found ${missingFiles.length} missing files, generating...`);

    const generatedFiles: Array<{ path: string; content: string }> = [];

    for (const missing of missingFiles) {
      if (missing.priority === 'critical' || missing.priority === 'high') {
        const content = await this.generateFileContent(missing, analysis, existingFiles);
        if (content) {
          generatedFiles.push({
            path: missing.path,
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
    const existingFiles = new Set(files.map(f => f.path));
    const isMonorepo = files.some(f => f.path.startsWith('client/') || f.path.startsWith('server/'));
    const hasClient = files.some(f => f.path.startsWith('client/'));
    const hasServer = files.some(f => f.path.startsWith('server/'));

    // Find package.json
    let packageJson: FileSystemAnalysis['packageJson'];
    const packageJsonFile = files.find(f => 
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
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.react || deps['react-dom']) {
        projectType = files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))
          ? 'react-typescript'
          : 'react-javascript';
      } else if (deps.express || deps.fastify) {
        projectType = 'node';
      }
    } else if (files.some(f => f.path.endsWith('.py'))) {
      projectType = 'python';
    }

    // Find vite.config
    const viteConfigFile = files.find(f => 
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
    const appFile = files.find(f => 
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
    const mainFile = files.find(f => 
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
    files: Array<{ path: string; content: string }>
  ): MissingFile[] {
    const missing: MissingFile[] = [];
    const cwd = analysis.isMonorepo && analysis.hasClient ? 'client' : '.';
    const srcDir = analysis.isMonorepo && analysis.hasClient ? 'client/src' : 'src';

    // For React/TypeScript projects
    if (analysis.projectType === 'react-typescript' || analysis.projectType === 'react-javascript') {
      // Check index.html
      const indexHtmlPath = `${cwd}/index.html`;
      if (!analysis.existingFiles.has(indexHtmlPath)) {
        missing.push({
          path: indexHtmlPath,
          reason: 'Required HTML entry point',
          priority: 'critical',
          suggestedContent: this.generateIndexHtml(analysis, srcDir)
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

      // Check vite.config.ts
      if (!analysis.viteConfig.exists && analysis.packageJson?.devDependencies?.vite) {
        missing.push({
          path: `${cwd}/vite.config.ts`,
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
    existingFiles: Array<{ path: string; content: string }>
  ): Promise<string | null> {
    // If we have suggested content, use it
    if (missing.suggestedContent) {
      return missing.suggestedContent;
    }

    // Otherwise, use AI to generate based on context
    try {
      const context = this.buildContext(missing, analysis, existingFiles);
      const prompt = this.buildGenerationPrompt(missing, context);

      const response = await this.aiService.generate({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{
          role: 'user',
          content: prompt
        }],
        maxTokens: 2000
      });

      return response.text || null;
    } catch (error) {
      logger.error('Failed to generate file content with AI', error as Error);
      return missing.suggestedContent || null;
    }
  }

  /**
   * Generate index.html based on analysis
   */
  private generateIndexHtml(analysis: FileSystemAnalysis, srcDir: string): string {
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
    <script type="module" src="/${srcDir}/main.${extension}"></script>
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
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  }
});`;
    }
    
    return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  }
});`;
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
  private buildGenerationPrompt(missing: MissingFile, context: string): string {
    return `Generate the missing file: ${missing.path}

Reason: ${missing.reason}

Context:
${context}

Generate a complete, functional file that works with the existing project structure.
Return ONLY the file content, no explanations.`;
  }
}

