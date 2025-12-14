import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { Logger } from './Logger';

const logger = new Logger(process.cwd());
logger.initialize().catch(console.error);

interface SandboxConfig {
  maxMemory: string;
  timeout: number;
  allowedModules: string[];
  environment: Record<string, string>;
}

export class SandboxManager {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      maxMemory: '512M',
      timeout: 30000,
      allowedModules: [
        // Core React
        'react',
        'react-dom',
        '@types/react',
        '@types/react-dom',

        // Testing
        '@testing-library/react',
        '@testing-library/jest-dom',
        'jest',

        // Build tools
        '@vitejs/plugin-react',
        'typescript',
        'vite',
        'tailwindcss',
        'autoprefixer',
        'postcss',

        // UI Libraries
        'framer-motion',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',

        // Routing
        'react-router-dom',
        '@types/react-router-dom',

        // State Management
        '@reduxjs/toolkit',
        'react-redux',
        '@types/react-redux',

        // Forms
        'react-hook-form',
        'zod',
        '@hookform/resolvers',

        // Utilities
        'date-fns',
        'lodash',
        '@types/lodash',
        'uuid',
        '@types/uuid',
      ],
      environment: {
        NODE_ENV: 'development',
      },
      ...config,
    };
  }

  async createSandbox(
    workspacePath: string,
    sessionId?: string
  ): Promise<string> {
    const sandboxId = sessionId
      ? `sandbox-${sessionId}`
      : `sandbox-${Date.now()}`;
    const sandboxPath = path.join(workspacePath, sandboxId);

    try {
      // Check if sandbox already exists
      try {
        await fs.access(sandboxPath);
        // Sandbox exists, reuse it
        return sandboxPath;
      } catch {
        // Sandbox doesn't exist, create it
        await fs.mkdir(sandboxPath, { recursive: true });

        // Create sandbox configuration
        await fs.writeFile(
          path.join(sandboxPath, 'sandbox.config.json'),
          JSON.stringify(
            {
              ...this.config,
              workspacePath: sandboxPath,
            },
            null,
            2
          )
        );
      }

      await logger.info('SandboxManager', 'Created sandbox environment', {
        sandboxId,
        sandboxPath,
        config: this.config,
      });

      return sandboxPath;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await logger.error('SandboxManager', 'Failed to create sandbox', {
        error: err,
        sandboxId,
        workspacePath,
      });
      throw error;
    }
  }

  async runInSandbox(
    sandboxPath: string,
    command: string,
    args: string[] = []
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // On Windows, use shell: true to find npm in PATH
      const spawnOptions = {
        cwd: sandboxPath,
        env: {
          ...this.config.environment,
          PATH: process.env.PATH,
        },
        stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      };

      const childProcess = spawn(command, args, spawnOptions);

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Command timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Process exited with code ${code}\n${stderr}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async validateDependencies(
    dependencies: Record<string, string>
  ): Promise<boolean> {
    console.log('Validating dependencies:', Object.keys(dependencies));

    const allowedModules = new Set(this.config.allowedModules);

    // Allow common React ecosystem packages
    const allowedPrefixes = [
      'react',
      '@types/react',
      '@testing-library',
      '@vitejs',
      'typescript',
      'vite',
      'tailwind',
      'framer-motion',
      'lucide-react',
      'clsx',
      'class-variance',
      'react-router',
      '@reduxjs',
      'react-redux',
      'react-hook-form',
      'zod',
      '@hookform',
      'date-fns',
      'lodash',
      'uuid',
    ];

    for (const dep of Object.keys(dependencies)) {
      // Check if it's explicitly allowed
      if (allowedModules.has(dep)) {
        console.log(`Dependency ${dep} is explicitly allowed`);
        continue;
      }

      // Check if it matches any allowed prefix
      const isAllowed = allowedPrefixes.some(prefix => dep.startsWith(prefix));

      if (!isAllowed) {
        console.log(
          `Dependency ${dep} is NOT allowed. Allowed prefixes:`,
          allowedPrefixes
        );
        await logger.info('SandboxManager', 'Blocked unauthorized dependency', {
          dependency: dep,
          allowedModules: this.config.allowedModules,
          allowedPrefixes,
          level: 'warn',
        });
        return false;
      } else {
        console.log(`Dependency ${dep} is allowed by prefix`);
      }
    }

    console.log('All dependencies validated successfully');
    return true;
  }

  async cleanup(sandboxPath: string): Promise<void> {
    try {
      // Only clean up non-session sandboxes (those without a session ID in the path)
      if (!sandboxPath.includes('sandbox-session-')) {
        await fs.rm(sandboxPath, { recursive: true, force: true });
        await logger.info('SandboxManager', 'Cleaned up sandbox', {
          sandboxPath,
        });
      } else {
        await logger.info(
          'SandboxManager',
          'Skipped cleanup of session sandbox',
          {
            sandboxPath,
          }
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await logger.error('SandboxManager', 'Failed to cleanup sandbox', {
        error: err,
        sandboxPath,
      });
      throw error;
    }
  }
}
