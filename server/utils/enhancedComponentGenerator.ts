import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from './Logger';
import type { ComponentFeatures, GeneratedFile } from './types';

const logger = new Logger(process.cwd());
logger.initialize().catch(console.error);

interface DependencyConfig {
  [key: string]: string;
}

interface ApplicationConfig {
  name: string;
  features: string[];
  dependencies: DependencyConfig;
  devDependencies: DependencyConfig;
  scripts: { [key: string]: string };
}

export class EnhancedComponentGenerator {
  private features: ComponentFeatures;
  private baseConfig: ApplicationConfig;

  constructor(features: ComponentFeatures) {
    this.features = features;
    this.baseConfig = {
      name: features.name.toLowerCase(),
      features: features.features,
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        'typescript': '^5.0.0',
        'vite': '^4.0.0',
        '@vitejs/plugin-react': '^4.0.0',
        'vitest': '^0.34.0',
        '@testing-library/react': '^14.0.0',
        '@testing-library/jest-dom': '^6.0.0'
      },
      scripts: {
        'dev': 'vite',
        'build': 'tsc && vite build',
        'preview': 'vite preview',
        'test': 'vitest',
        'test:coverage': 'vitest run --coverage'
      }
    };
  }

  private async addFeatureDependencies(): Promise<ApplicationConfig> {
    const { dependencies, devDependencies } = this.baseConfig;

    // Add routing if needed
    if (this.features.features.includes('routing')) {
      dependencies['react-router-dom'] = '^6.0.0';
    }

    // Add state management if needed
    if (this.features.features.includes('state-management')) {
      dependencies['@reduxjs/toolkit'] = '^1.9.0';
      dependencies['react-redux'] = '^8.1.0';
    }

    // Add form handling if needed
    if (this.features.features.includes('forms')) {
      dependencies['react-hook-form'] = '^7.0.0';
      dependencies['zod'] = '^3.0.0';
    }

    // Add styling dependencies
    if (this.features.styling?.animations) {
      dependencies['framer-motion'] = '^10.0.0';
    }
    dependencies['tailwindcss'] = '^3.0.0';
    devDependencies['postcss'] = '^8.0.0';
    devDependencies['autoprefixer'] = '^10.0.0';

    // Add testing dependencies
    devDependencies['@testing-library/user-event'] = '^14.0.0';
    devDependencies['@testing-library/react-hooks'] = '^8.0.0';
    if (this.features.features.includes('api')) {
      devDependencies['msw'] = '^2.0.0';
    }

    return this.baseConfig;
  }

  async generateCode(): Promise<{ files: GeneratedFile[] }> {
    const files: GeneratedFile[] = [];
    
    await this.addFeatureDependencies();

    // Add configuration files
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.baseConfig, null, 2)
    });

    // Add TypeScript configuration
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
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthrough: true
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }]
      }, null, 2)
    });

    // Add Vite configuration
    files.push({
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom']
    }
  }
});`
    });

    // Add Tailwind configuration
    files.push({
      path: 'tailwind.config.js',
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
    });

    // Add PostCSS configuration
    files.push({
      path: 'postcss.config.js',
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    });

    // Add CSS
    files.push({
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    });

    // Add the main component export
    files.push({
      path: 'src/index.ts',
      content: `export { default } from './${this.features.name}';`
    });

    // Add the actual component implementation
    files.push({
      path: `src/${this.features.name}.tsx`,
      content: `import React from 'react';
${this.features.features.map(feature => 
  `import ${feature} from './components/${feature}';`
).join('\n')}

export default function ${this.features.name}() {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h1 className="text-2xl font-bold mb-4">${this.features.name}</h1>
      ${this.features.features.map(feature => 
        `<${feature} key="${feature}" />`
      ).join('\n      ')}
    </div>
  );
}`
    });

    // Add feature-specific components
    for (const feature of this.features.features) {
      files.push({
        path: `src/components/${feature}.tsx`,
        content: `import React from 'react';
${this.features.features.includes('state-management') ? "import { useSelector, useDispatch } from 'react-redux';" : ''}

export default function ${feature}() {
  ${this.features.features.includes('state-management') ? 'const dispatch = useDispatch();' : ''}
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50 mb-4">
      <h3 className="font-medium">${feature}</h3>
      {/* ${feature} specific implementation */}
    </div>
  );
}`
      });

      // Add tests for each component
      files.push({
        path: `src/components/${feature}.test.tsx`,
        content: `import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ${feature} from './${feature}';

describe('${feature}', () => {
  test('renders component', () => {
    render(<${feature} />);
    expect(screen.getByText('${feature}')).toBeInTheDocument();
  });
});`
      });
    }

    return { files };
  }
}
