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
export const generateReactComponent = async (prompt: string, aiResponse: string): Promise<GeneratedComponent> => {
  try {
    await logger.info('ComponentGenerator', 'Starting component generation', {
      prompt,
    });

    // Parse files from AI response
    const files: { path: string; content: string }[] = [];
    const fileRegex = /\*\*(.*?)\*\*\s*```(?:typescript|tsx|css|json)\s*([\s\S]*?)```/g;
    let match;

    // Sanitize file paths to remove invalid characters and ensure proper directory structure
    const sanitizePath = (path: string) => {
      // Remove invalid characters and trim whitespace
      const sanitized = path.replace(/[<>:"|?*]/g, '-').trim();
      // Ensure path starts with src/ if it doesn't already
      return sanitized.startsWith('src/') ? sanitized : `src/${sanitized}`;
    };

    while ((match = fileRegex.exec(aiResponse)) !== null) {
      const [, filePath, content] = match;
      if (filePath && content) {
        const sanitizedPath = sanitizePath(filePath);
        files.push({
          path: sanitizedPath,
          content: content.trim()
        });
      }
    }

    // If no files were found in the AI response, create a default component
    if (files.length === 0) {
      const componentName = prompt.toLowerCase().includes('todo') ? 'TodoList' : 'CustomComponent';
      files.push({
        path: `src/${componentName}.tsx`,
        content: `import React from 'react';

export default function ${componentName}() {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
}`
      });
    }

    // Log the generated files
    await logger.info('ComponentGenerator', 'Component generation completed', {
      generatedFiles: files.map(f => ({
        path: f.path,
        content: f.content
      }))
    });

    return {
      text: aiResponse,
      files
    };
  } catch (error) {
    await logger.error('ComponentGenerator', 'Error during component generation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      prompt,
      aiResponse
    });
    throw error;
  }
};

export class ComponentGenerator {
  constructor(private features: ComponentFeatures) {}

  async generateFileStructure(): Promise<{ files: GeneratedFile[] }> {
    await logger.info('ComponentGenerator', 'Generating file structure', {
      componentName: this.features.name,
      features: this.features.features
    });

    const baseStructure: GeneratedFile[] = [
      {
        path: 'src/index.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));`
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
}`
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: this.features.name.toLowerCase(),
          version: '1.0.0',
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1'
          }
        }, null, 2)
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
}`
      }
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
}`
      });
    }

    await logger.info('ComponentGenerator', 'File structure generation completed', {
      generatedFiles: baseStructure.map(f => f.path)
    });

    return { files: baseStructure };
  }

  async generateCode(): Promise<{ files: GeneratedFile[] }> {
    await logger.info('ComponentGenerator', 'Starting code generation', {
      componentName: this.features.name,
      features: this.features.features
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
}`
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
}`
      });
    });

    await logger.info('ComponentGenerator', 'Code generation completed', {
      generatedFiles: files.map(f => ({
        path: f.path,
        content: f.content // Log full generated code
      })),
      dependencies: this.features.features // Log dependencies
    });

    return { files };
  }
}
