import type { ComponentFeatures, GeneratedFile } from './types';
export type { ComponentFeatures };
import { Logger } from './Logger';

const logger = new Logger(process.cwd());
logger.initialize().catch(console.error);

interface GeneratedComponent {
  type?: 'component';
  text: string;
  files: { path: string; content: string }[];
}

// Export the static method directly for use in other files
export const generateReactComponent = async (
  prompt: string,
  aiResponse: string,
  onFileGenerated?: (file: { path: string; content: string }, index: number, total: number) => void
): Promise<GeneratedComponent> => {
  try {
    await logger.info('ComponentGenerator', 'Starting component generation', {
      prompt,
    });

    // Parse files from AI response
    const files: { path: string; content: string }[] = [];

    // Enhanced regex to match various markdown formats
    // Matches: **path** ```lang ... ``` or **path**\n```lang ... ```
    const fileRegex =
      /\*\*\s*(.*?)\s*\*\*\s*\n?\s*```(?:typescript|tsx|ts|jsx|css|json|html|js|javascript)?\s*\n([\s\S]*?)```/gi;
    let match;

    // Sanitize file paths to remove invalid characters and ensure proper directory structure
    const sanitizePath = (path: string) => {
      // Remove invalid characters and trim whitespace
      let sanitized = path.replace(/[<>:"|?*]/g, '-').trim();

      // Handle root-level files (index.html, package.json, etc.)
      const rootFiles = ['index.html', 'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js'];
      const fileName = sanitized.split('/').pop() || '';

      if (rootFiles.includes(fileName) && !sanitized.startsWith('src/')) {
        return fileName; // Keep root files at root
      }

      // Ensure other files start with src/ if they don't already
      return sanitized.startsWith('src/') ? sanitized : `src/${sanitized}`;
    };

    // First pass: collect all files
    const tempFiles: { path: string; content: string }[] = [];

    // Reset regex
    fileRegex.lastIndex = 0;

    while ((match = fileRegex.exec(aiResponse)) !== null) {
      const [, filePath, content] = match;
      if (filePath && content) {
        const sanitizedPath = sanitizePath(filePath);
        tempFiles.push({
          path: sanitizedPath,
          content: content.trim(),
        });

        await logger.info('ComponentGenerator', `Parsed file: ${sanitizedPath}`, {
          contentLength: content.length
        });
      }
    }

    // Log parsing results
    await logger.info('ComponentGenerator', `Parsed ${tempFiles.length} files from AI response`, {
      responseLength: aiResponse.length,
      filePaths: tempFiles.map(f => f.path)
    });

    // Second pass: stream files with callback
    const totalFiles = tempFiles.length;
    for (let i = 0; i < tempFiles.length; i++) {
      const file = tempFiles[i];
      files.push(file);
      
      // Call the callback to stream this file to the client
      if (onFileGenerated) {
        onFileGenerated(file, i + 1, totalFiles);
      }
    }

    // If no files or very few files were found, ensure we have a complete project
    if (files.length === 0) {
      await logger.warning('ComponentGenerator', 'No files found in AI response - creating default structure', {
        responsePreview: aiResponse.substring(0, 500)
      });

      const componentName = prompt.toLowerCase().includes('todo')
        ? 'TodoList'
        : 'CustomComponent';

      // Create a minimal working structure
      files.push(
        {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${componentName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: componentName.toLowerCase(),
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview'
            },
            dependencies: {
              react: '^18.3.1',
              'react-dom': '^18.3.1'
            },
            devDependencies: {
              '@types/react': '^18.3.18',
              '@types/react-dom': '^18.3.5',
              '@vitejs/plugin-react': '^4.3.4',
              typescript: '^5.7.2',
              vite: '^6.0.11'
            }
          }, null, 2)
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              isolatedModules: true,
              moduleDetection: 'force',
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true
            },
            include: ['src']
          }, null, 2)
        },
        {
          path: 'vite.config.ts',
          content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`
        },
        {
          path: 'src/main.tsx',
          content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);`
        },
        {
          path: 'src/index.css',
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`
        },
        {
          path: `src/App.tsx`,
          content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>${componentName}</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`
        }
      );
    } else if (files.length < 5) {
      // If we have some files but not all required ones, fill in the gaps
      await logger.warning('ComponentGenerator', `Only ${files.length} files found - may be missing config files`);

      const existingPaths = new Set(files.map(f => f.path));

      // Ensure we have required files
      if (!existingPaths.has('package.json')) {
        files.push({
          path: 'package.json',
          content: JSON.stringify({
            name: 'generated-app',
            version: '1.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
            devDependencies: {
              '@types/react': '^18.3.18',
              '@types/react-dom': '^18.3.5',
              '@vitejs/plugin-react': '^4.3.4',
              typescript: '^5.7.2',
              vite: '^6.0.11'
            }
          }, null, 2)
        });
      }

      if (!existingPaths.has('index.html')) {
        files.push({
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
        });
      }

      if (!existingPaths.has('tsconfig.json')) {
        files.push({
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              isolatedModules: true,
              moduleDetection: 'force',
              noEmit: true,
              jsx: 'react-jsx',
              strict: true
            },
            include: ['src']
          }, null, 2)
        });
      }

      if (!existingPaths.has('vite.config.ts')) {
        files.push({
          path: 'vite.config.ts',
          content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`
        });
      }
    }

    // Log the generated files
    await logger.info('ComponentGenerator', 'Component generation completed', {
      generatedFiles: files.map(f => ({
        path: f.path,
        content: f.content,
      })),
    });

    return {
      text: aiResponse,
      files,
    };
  } catch (error) {
    await logger.error(
      'ComponentGenerator',
      'Error during component generation',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        prompt,
        aiResponse,
      }
    );
    throw error;
  }
};

export class ComponentGenerator {
  constructor(private features: ComponentFeatures) {}

  async generateFileStructure(): Promise<{ files: GeneratedFile[] }> {
    await logger.info('ComponentGenerator', 'Generating file structure', {
      componentName: this.features.name,
      features: this.features.features,
    });

    const baseStructure: GeneratedFile[] = [
      {
        path: 'src/index.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));`,
      },
      {
        path: 'src/App.tsx',
        content: `import React from 'react';

export default function App() {
  return (
    <div>
      <h1>${this.features.name}</h1>
    </div>
  );
}`,
      },
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: this.features.name.toLowerCase(),
            version: '1.0.0',
            scripts: {
              start: 'react-scripts start',
              build: 'react-scripts build',
              test: 'react-scripts test',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              'react-scripts': '5.0.1',
            },
          },
          null,
          2
        ),
      },
      {
        path: 'tailwind.config.ts',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
      },
    ];

    // Add feature-specific files
    if (this.features.features.includes('routing')) {
      baseStructure.push({
        path: 'src/Router.tsx',
        content: `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}`,
      });
    }

    await logger.info(
      'ComponentGenerator',
      'File structure generation completed',
      {
        generatedFiles: baseStructure.map(f => f.path),
      }
    );

    return { files: baseStructure };
  }

  async generateCode(): Promise<{ files: GeneratedFile[] }> {
    await logger.info('ComponentGenerator', 'Starting code generation', {
      componentName: this.features.name,
      features: this.features.features,
    });

    const files: GeneratedFile[] = [];

    // Generate main component
    files.push({
      path: `src/components/${this.features.name}.tsx`,
      content: `import React from 'react';

export default function ${this.features.name}() {
  return (
    <div>
      ${this.features.features.map((f: string) => `<${f} />`).join('\n      ')}
    </div>
  );
}`,
    });

    // Generate feature components
    this.features.features.forEach((feature: string) => {
      files.push({
        path: `src/components/${feature}.tsx`,
        content: `import React from 'react';

export default function ${feature}() {
  return (
    <div>
      ${feature} Component
    </div>
  );
}`,
      });
    });

    await logger.info('ComponentGenerator', 'Code generation completed', {
      generatedFiles: files.map(f => ({
        path: f.path,
        content: f.content, // Log full generated code
      })),
      dependencies: this.features.features, // Log dependencies
    });

    return { files };
  }
}
