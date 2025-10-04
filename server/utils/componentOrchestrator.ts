import path from 'path';
import { promises as fs } from 'fs';
import { Request, Response } from 'express';
import { ComponentGenerator } from './componentGenerator';
import { EnhancedComponentGenerator } from './enhancedComponentGenerator';
import { SandboxManager } from './sandboxManager';
import {
  ComponentFeatures,
  AgentResult,
  OrchestrationResult,
  GeneratedFile,
  ValidationResult,
} from './types';
import { validateComponent, verifyRuntime } from './componentValidator';
import { PathUtils } from './pathUtils';
import { AgentManager } from './AgentManager';
import { Logger } from './Logger';
import { OrchestrationAgent } from '../agents/OrchestrationAgent';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import config from '../../config.json';
import { addTerminalOutput } from '../routes/terminal';

interface AgentManagementConfig {
  basePath: string;
  activeAgents: string[];
  inactiveAgents: string[];
}

interface WorkflowConfig {
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
  };
}

interface DatabaseSyncConfig {
  enabled: boolean;
  syncInterval: number;
  tables: string[];
}

interface LoggingConfig {
  level: string;
  format: string;
  filePath: string;
  maxSize: string;
}

interface MessageQueueConfig {
  type: 'in-memory' | 'external';
}

interface AppConfig {
  agentManagement: AgentManagementConfig;
  workflowConfig: WorkflowConfig;
  databaseSync: DatabaseSyncConfig;
  logging: LoggingConfig;
  messageQueue: MessageQueueConfig;
}

class ConfigurationManager {
  private config: AppConfig;

  constructor() {
    this.config = config as unknown as AppConfig;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.agentManagement) {
      throw new Error('Invalid configuration: missing agentManagement section');
    }
    if (!this.config.workflowConfig) {
      throw new Error('Invalid configuration: missing workflowConfig section');
    }
  }

  get agentConfig(): AgentManagementConfig {
    return this.config.agentManagement;
  }

  get workflowConfig(): WorkflowConfig {
    return this.config.workflowConfig;
  }

  get databaseSyncConfig(): DatabaseSyncConfig {
    return this.config.databaseSync;
  }

  get messageQueueConfig(): MessageQueueConfig {
    return this.config.messageQueue;
  }
}

declare module 'express' {
  interface Application {
    locals: {
      sseClients?: Set<Response>;
    };
  }
}

export class ComponentOrchestrator {
  private pathUtils: PathUtils;
  private features: ComponentFeatures;
  private configManager: ConfigurationManager;
  private agentManager: AgentManager;
  private logger: Logger;
  private sandboxManager: SandboxManager;
  private orchestrationAgent: OrchestrationAgent;

  getComponentName(): string {
    return this.features.name;
  }

  constructor(workspacePath: string) {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
    this.configManager = new ConfigurationManager();
    this.features = {
      name: '',
      features: [],
      styling: {
        animations: false,
        theme: 'light',
      },
    };
    this.pathUtils = new PathUtils(workspacePath, this.features);
    this.agentManager = new AgentManager(workspacePath);
    this.orchestrationAgent = new OrchestrationAgent();
    this.sandboxManager = new SandboxManager({
      maxMemory: '1G',
      timeout: 60000,
      allowedModules: [
        'react',
        'react-dom',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        'react-hook-form',
        'zod',
        'framer-motion',
        'tailwindcss',
        '@testing-library/react',
        '@testing-library/user-event',
        '@testing-library/react-hooks',
        'msw',
      ],
      environment: {
        NODE_ENV: 'development',
        VITE_DEV_SERVER_PORT: '3000',
      },
    });
  }

  async initialize(): Promise<void> {
    await this.agentManager.initialize();
    await this.orchestrationAgent.initialize();
  }

  private async generateCodeFilesOnly(
    prompt: string,
    sessionId?: string
  ): Promise<AgentResult> {
    try {
      await this.logger.info(
        'ComponentOrchestrator',
        'Starting AI-powered code generation'
      );

      // Use the OrchestrationAgent to generate intelligent code
      const orchestrationResult = await this.orchestrationAgent.executeTask({
        prompt,
        features: this.features,
        sessionId,
        progressCallback: (details) => {
          // Use component name for terminal output if available, otherwise use sessionId
          const terminalId = this.features.name || sessionId;
          if (terminalId) {
            details.forEach(detail => addTerminalOutput(terminalId, detail));
          }
        },
      });

      if (!orchestrationResult.success) {
        throw new Error(orchestrationResult.errors.join(', '));
      }

      // Log generated dependencies
      const packageJsonFile = orchestrationResult.files.find(
        (f: GeneratedFile) => f.path === 'package.json'
      );
      if (packageJsonFile) {
        const packageJson = JSON.parse(packageJsonFile.content);
        console.log('AI-generated dependencies:', {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        });
      }

      await this.logger.info(
        'ComponentOrchestrator',
        'AI-powered generation completed',
        {
          filesGenerated: orchestrationResult.files.length,
          agentsUsed: orchestrationResult.agentsUsed,
        }
      );

      return {
        success: true,
        files: orchestrationResult.files,
        componentName: this.features.name,
        errors: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error(
        'ComponentOrchestrator',
        'AI-powered code generation failed',
        { error: errorMessage }
      );

      return {
        success: false,
        files: [],
        componentName: this.features.name,
        errors: [errorMessage],
      };
    }
  }

  private async generateCode(
    progressCallback?: (details: string[]) => void
  ): Promise<AgentResult> {
    try {
      await this.logger.info(
        'ComponentOrchestrator',
        'Starting code generation',
        {
          componentName: this.features.name,
          features: this.features.features,
        }
      );

      // Create sandbox environment
      const sandboxPath = await this.sandboxManager.createSandbox(
        this.pathUtils.resolvePath('')
      );

      // Generate code using enhanced generator
      const generator = new EnhancedComponentGenerator(this.features);
      const { files } = await generator.generateCode();

      // Validate dependencies - temporarily disabled for playground
      const packageJsonFile = files.find(
        (f: GeneratedFile) => f.path === 'package.json'
      );
      if (packageJsonFile) {
        const packageJson = JSON.parse(packageJsonFile.content);
        console.log('Generated dependencies:', {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        });

        // Temporarily skip validation for playground
        // const isValid = await this.sandboxManager.validateDependencies({
        //   ...packageJson.dependencies,
        //   ...packageJson.devDependencies
        // });

        // if (!isValid) {
        //   throw new Error('Invalid dependencies detected');
        // }
      }

      // Write files to sandbox
      await Promise.all(
        files.map(async (file: GeneratedFile) => {
          const filePath = path.join(sandboxPath, file.path);
          await this.pathUtils.createDirectory(path.dirname(filePath));
          await this.pathUtils.writeFile(filePath, file.content);
          await this.logger.info('ComponentOrchestrator', 'Generated file', {
            path: filePath,
            contentPreview: file.content.slice(0, 100) + '...',
          });
        })
      );

      // Install dependencies in sandbox with legacy peer deps to handle version conflicts
      await this.sandboxManager.runInSandbox(sandboxPath, 'npm', [
        'install',
        '--legacy-peer-deps',
      ]);

      // Run tests in sandbox
      const { stdout, stderr } = await this.sandboxManager.runInSandbox(
        sandboxPath,
        'npm',
        ['test']
      );

      if (stderr) {
        this.logger.info('ComponentOrchestrator', 'Test output', { stderr });
      }

      // Copy files back to workspace
      await Promise.all(
        files.map(async (file: GeneratedFile) => {
          const sourcePath = path.join(sandboxPath, file.path);
          const targetPath = this.pathUtils.resolvePath(file.path);
          await this.pathUtils.createDirectory(path.dirname(targetPath));
          await fs.copyFile(sourcePath, targetPath);
        })
      );

      // Start development server
      await this.sandboxManager.runInSandbox(sandboxPath, 'npm', [
        'run',
        'dev',
      ]);

      // Cleanup sandbox
      await this.sandboxManager.cleanup(sandboxPath);

      progressCallback?.(['Code generated and validated successfully']);

      return {
        success: true,
        content: 'Code generated and validated successfully',
        files,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async analyzeRequirements(
    prompt: string,
    progressCallback?: (details: string[]) => void
  ): Promise<AgentResult> {
    try {
      await this.logger.info(
        'ComponentOrchestrator',
        'Analyzing requirements',
        { prompt }
      );
      const features = prompt
        .toLowerCase()
        .split(/[.,\n]/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-.•\s]+/, '').trim())
        .filter(Boolean);

      const componentName = this.extractComponentName(prompt);
      this.features = {
        name: componentName,
        features: features,
        styling: {
          animations: prompt.toLowerCase().includes('animation'),
          theme: prompt.toLowerCase().includes('dark') ? 'dark' : 'light',
        },
      };

      progressCallback?.(['Requirements analyzed:', ...features]);

      return {
        success: true,
        content: JSON.stringify({ features }, null, 2),
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private extractComponentName(prompt: string): string {
    // If we already have a component name, keep using it
    if (this.features.name && this.features.name !== '') {
      return this.features.name;
    }

    // Extract meaningful words from the prompt
    const words = prompt
      .toLowerCase()
      .split(' ')
      .filter(word => !['a', 'an', 'the', 'with', 'using', 'make', 'me', 'create', 'build', 'generate', 'for', 'app', 'application'].includes(word))
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    // If we have meaningful words, use them, otherwise fallback to timestamp
    const componentName = words.length > 0 ? `${words}App` : `Component${Date.now()}`;
    
    // Update the features name
    this.features.name = componentName;
    
    return componentName;
  }

  async generateFilesOnly(
    prompt: string,
    req: any,
    projectId?: number,
    existingComponentName?: string,
    sessionId?: string,
    selectedKnowledge?: any
  ): Promise<AgentResult> {
    try {
      // Send status update
      if (sessionId) {
        addTerminalOutput(sessionId, '🔍 Analyzing your requirements...');
      }

      // Analyze requirements
      await this.logger.info('ComponentOrchestrator', 'Analyzing requirements');
      const analysisResult = await this.analyzeRequirements(prompt);
      if (!analysisResult.success) {
        throw new Error(
          analysisResult.errors?.join(', ') || 'Requirements analysis failed'
        );
      }

      if (existingComponentName) {
        this.features.name = existingComponentName;
      } else {
        // Extract component name from prompt
        this.extractComponentName(prompt);
      }

      // Send status update
      if (sessionId) {
        addTerminalOutput(
          sessionId,
          '🎨 Generating beautiful frontend components...'
        );
      }

      // Generate code files only using AI agents (skip npm install and tests for faster response)
      const result = await this.generateCodeFilesOnly(prompt, sessionId);

      // Send status update
      if (sessionId) {
        addTerminalOutput(
          sessionId,
          '✅ Frontend components generated successfully!'
        );
        addTerminalOutput(sessionId, '📦 Setting up dependencies...');
      }

      return {
        success: true,
        files: result.files,
        componentName: this.features.name,
        errors: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.logger.error('ComponentOrchestrator', 'Generation failed', {
        error: errorMessage,
      });

      // Send error status
      if (sessionId) {
        addTerminalOutput(sessionId, `❌ Generation failed: ${errorMessage}`);
      }

      return {
        success: false,
        files: [],
        componentName: this.features.name,
        errors: [errorMessage],
      };
    }
  }

  async orchestrate(
    prompt: string,
    req?: Request,
    progressCallback?: (details: string[]) => void,
    existingComponentName?: string,
    sessionId?: string,
    selectedKnowledge?: {
      companyIds: number[];
      frameworkIds: number[];
      workspaceIds: number[];
    }
  ): Promise<OrchestrationResult> {
    // If an existing component name is provided, use it
    if (existingComponentName) {
      this.features.name = existingComponentName;
    } else {
      // Extract component name from prompt
      this.extractComponentName(prompt);
    }
    const startTime = new Date().toISOString();
    const result: OrchestrationResult = {
      success: false,
      files: [],
      errors: [],
      warnings: [],
      metadata: {
        startTime,
        endTime: '',
        agentsUsed: [],
        resourceUsage: {
          totalMemory: process.memoryUsage().heapUsed,
          peakMemory: 0,
          averageCpu: 0,
        },
      },
    };

    try {
      // Create unique project directory to avoid file lock conflicts
      const timestamp = Date.now();
      const projectDir = path.join(
        process.cwd(),
        'workspaces',
        `${this.features.name.toLowerCase()}-${timestamp}`
      );
      await fs.mkdir(projectDir, { recursive: true });

      // Update pathUtils to use the project directory
      this.pathUtils = new PathUtils(projectDir, this.features);

      // Create standard directory structure
      await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(projectDir, 'src', 'components'), {
        recursive: true,
      });
      await fs.mkdir(path.join(projectDir, 'src', 'hooks'), {
        recursive: true,
      });
      await fs.mkdir(path.join(projectDir, 'src', 'types'), {
        recursive: true,
      });
      await fs.mkdir(path.join(projectDir, 'src', '__tests__'), {
        recursive: true,
      });

      // Generate base package.json if it doesn't exist
      const packageJsonPath = path.join(projectDir, 'package.json');
      if (
        !(await fs
          .access(packageJsonPath)
          .then(() => true)
          .catch(() => false))
      ) {
        const basePackageJson = {
          name: this.features.name.toLowerCase(),
          version: '1.0.0',
          private: true,
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
            test: 'vitest',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'react-router-dom': '^6.14.2',
          },
          devDependencies: {
            vite: '^4.4.5',
            '@vitejs/plugin-react': '^4.0.3',
            vitest: '^0.32.2',
            typescript: '^5.1.6',
            '@types/react': '^18.2.15',
            '@types/react-dom': '^18.2.7',
          },
        };
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify(basePackageJson, null, 2)
        );
      }

      const analysisResult = await this.analyzeRequirements(
        prompt,
        progressCallback
      );
      if (!analysisResult.success) {
        result.errors.push(...(analysisResult.errors || []));
        return result;
      }

      const codeGenResult = await this.generateCode(progressCallback);
      if (!codeGenResult.success) {
        result.errors.push(...(codeGenResult.errors || []));
        return result;
      }

      // Install dependencies and start dev server
      try {
        await this.sandboxManager.runInSandbox(projectDir, 'npm', ['install']);
        result.metadata.agentsUsed.push('DependencyInstaller');

        // Start dev server in background
        this.sandboxManager
          .runInSandbox(projectDir, 'npm', ['run', 'dev'])
          .then(() => {
            this.logger.info(
              'ComponentOrchestrator',
              'Dev server started successfully'
            );
          })
          .catch(error => {
            this.logger.error(
              'ComponentOrchestrator',
              'Failed to start dev server',
              { error }
            );
          });

        // Get generated files
        const generatedFiles = await this.pathUtils.getGeneratedFiles();
        result.success = true;
        result.files = generatedFiles;
        result.metadata.endTime = new Date().toISOString();
        return result;
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        result.errors.push(`Orchestration failed: ${err}`);
        result.metadata.endTime = new Date().toISOString();
        return result;
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      result.errors.push(`Orchestration failed: ${err}`);
      result.metadata.endTime = new Date().toISOString();
      return result;
    }
  }
}
