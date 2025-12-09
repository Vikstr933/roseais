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
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        typescript: '^5.0.0',
        vite: '^4.0.0',
        '@vitejs/plugin-react': '^4.0.0',
        vitest: '^0.34.0',
        '@testing-library/react': '^14.0.0',
        '@testing-library/jest-dom': '^6.0.0',
      },
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        test: 'vitest',
        'test:coverage': 'vitest run --coverage',
      },
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
    // Note: @testing-library/react-hooks is deprecated in React 18, using @testing-library/react instead
    if (this.features.features.includes('api')) {
      devDependencies['msw'] = '^2.0.0';
    }

    return this.baseConfig;
  }

  private sanitizeFeatureName(feature: string): string {
    // Convert to a valid JavaScript identifier
    return feature
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '') // Remove spaces
      .replace(/^(create|make|build|generate|develop|design)\s*/i, '') // Remove common verbs
      .replace(/^(a|an|the)\s*/i, '') // Remove articles
      .replace(/app$/, '') // Remove "app" suffix
      .replace(/^$/, 'Component') // Fallback if empty
      .replace(/^[0-9]/, 'Component$&'); // Ensure it doesn't start with a number
  }

  private async generateFeatureComponent(feature: string): Promise<string> {
    // Generate component content based on the feature type
    switch (feature.toLowerCase()) {
      case 'camera':
      case 'camera-app':
        return `import React, { useState, useRef, useEffect } from 'react';

export default function ${this.sanitizeFeatureName(feature)}() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="camera-app p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Camera App</h2>
      
      <div className="camera-container mb-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full max-w-md mx-auto rounded-lg"
          style={{ display: stream ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {!stream && (
          <div className="w-full max-w-md mx-auto h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Camera not started</p>
          </div>
        )}
      </div>

      <div className="controls flex gap-4 justify-center mb-4">
        {!stream ? (
          <button
            onClick={startCamera}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={capturePhoto}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Capture Photo
            </button>
            <button
              onClick={stopCamera}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {capturedImage && (
        <div className="captured-image">
          <h3 className="text-lg font-semibold mb-2">Captured Photo:</h3>
          <img
            src={capturedImage}
            alt="Captured"
            className="max-w-md mx-auto rounded-lg shadow-md"
          />
          <div className="mt-2 text-center">
            <a
              href={capturedImage}
              download="captured-photo.png"
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors inline-block"
            >
              Download Photo
            </a>
          </div>
        </div>
      )}
    </div>
  );
}`;

      case 'todo':
      case 'todo-app':
        return `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function ${this.sanitizeFeatureName(feature)}() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue,
        completed: false
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="todo-app p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Todo App</h2>
      
      <div className="add-todo mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="todos">
        {todos.length === 0 ? (
          <p className="text-gray-500 text-center">No todos yet. Add one above!</p>
        ) : (
          <ul className="space-y-2">
            {todos.map(todo => (
              <li
                key={todo.id}
                className={\`flex items-center gap-3 p-3 border rounded-lg \${todo.completed ? 'bg-gray-100' : 'bg-white'}\`}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-500' : ''}\`}>
                  {todo.text}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {todos.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          {todos.filter(t => !t.completed).length} remaining, {todos.filter(t => t.completed).length} completed
        </div>
      )}
    </div>
  );
}`;

      case 'calculator':
      case 'calculator-app':
        return `import React, { useState } from 'react';

export default function ${this.sanitizeFeatureName(feature)}() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return firstValue / secondValue;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const performCalculation = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  return (
    <div className="calculator p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl max-w-sm mx-auto">
      <div className="bg-black rounded-lg p-4 mb-4">
        <div className="text-right text-white text-3xl font-mono min-h-[2rem]">
          {display}
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={clear}
          className="col-span-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => inputOperation('÷')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          ÷
        </button>
        <button
          onClick={() => inputOperation('×')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          ×
        </button>

        <button
          onClick={() => inputNumber('7')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          7
        </button>
        <button
          onClick={() => inputNumber('8')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          8
        </button>
        <button
          onClick={() => inputNumber('9')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          9
        </button>
        <button
          onClick={() => inputOperation('-')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          -
        </button>

        <button
          onClick={() => inputNumber('4')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          4
        </button>
        <button
          onClick={() => inputNumber('5')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          5
        </button>
        <button
          onClick={() => inputNumber('6')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          6
        </button>
        <button
          onClick={() => inputOperation('+')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          +
        </button>

        <button
          onClick={() => inputNumber('1')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          1
        </button>
        <button
          onClick={() => inputNumber('2')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          2
        </button>
        <button
          onClick={() => inputNumber('3')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          3
        </button>
        <button
          onClick={performCalculation}
          className="row-span-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          =
        </button>

        <button
          onClick={() => inputNumber('0')}
          className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          0
        </button>
        <button
          onClick={inputDecimal}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          .
        </button>
      </div>
    </div>
  );
}`;

      default:
        return `import React, { useState } from 'react';

export default function ${feature}() {
  const [data, setData] = useState(null);
  
  return (
    <div className="${feature.toLowerCase()} p-4 border rounded-lg bg-gray-50 mb-4">
      <h3 className="font-medium text-lg mb-2">${feature}</h3>
      <p className="text-gray-600">This is a ${feature} component. Add your implementation here.</p>
    </div>
  );
}`;
    }
  }

  async generateCode(): Promise<{ files: GeneratedFile[] }> {
    const files: GeneratedFile[] = [];

    await this.addFeatureDependencies();

    // Add configuration files
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.baseConfig, null, 2),
    });

    // Add TypeScript configuration
    files.push({
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
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
            noFallthrough: true,
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2
      ),
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
});`,
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
}`,
    });

    // Add PostCSS configuration
    files.push({
      path: 'postcss.config.js',
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    });

    // Add CSS
    files.push({
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
    });

    // Add the main component export
    files.push({
      path: 'src/index.ts',
      content: `export { default } from './${this.features.name}';`,
    });

    // Add the actual component implementation
    files.push({
      path: `src/${this.features.name}.tsx`,
      content: `import React from 'react';
${this.features.features
  .map(
    feature =>
      `import ${this.sanitizeFeatureName(feature)} from './components/${this.sanitizeFeatureName(feature)}';`
  )
  .join('\n')}

export default function ${this.features.name}() {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h1 className="text-2xl font-bold mb-4">${this.features.name}</h1>
      ${this.features.features
        .map(
          feature =>
            `<${this.sanitizeFeatureName(feature)} key="${this.sanitizeFeatureName(feature)}" />`
        )
        .join('\n      ')}
    </div>
  );
}`,
    });

    // Add feature-specific components with AI-generated content
    for (const feature of this.features.features) {
      const componentContent = await this.generateFeatureComponent(feature);
      files.push({
        path: `src/components/${this.sanitizeFeatureName(feature)}.tsx`,
        content: componentContent,
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
});`,
      });
    }

    return { files };
  }
}
