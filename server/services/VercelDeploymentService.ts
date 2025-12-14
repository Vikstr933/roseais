import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';

const execAsync = promisify(exec);

export interface VercelDeploymentResult {
  deploymentId: string;
  url: string;
  status: 'ready' | 'building' | 'error';
  createdAt: Date;
  vercelUrl?: string;
  previewUrl?: string;
}

export class VercelDeploymentService {
  private logger: Logger;
  private deployments: Map<string, VercelDeploymentResult> = new Map();

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
  }

  /**
   * Deploy a generated app to Vercel
   */
  async deployToVercel(
    componentName: string,
    files: GeneratedFile[],
    options: {
      projectName?: string;
      framework?: 'react' | 'next' | 'vite';
      buildCommand?: string;
      outputDirectory?: string;
    } = {}
  ): Promise<VercelDeploymentResult> {
    const deploymentId = `${componentName}-${Date.now()}`;
    const projectName = options.projectName || componentName.toLowerCase();
    
    this.logger.info('VercelDeploymentService', 'Starting Vercel deployment', {
      componentName,
      projectName,
      fileCount: files.length,
      deploymentId,
    });

    try {
      // Create temporary deployment directory
      const deploymentPath = path.join(process.cwd(), 'temp-vercel-deployments', deploymentId);
      await fs.mkdir(deploymentPath, { recursive: true });

      // Write files to deployment directory
      await this.writeFilesToDeployment(deploymentPath, files);

      // Create Vercel configuration
      await this.createVercelConfig(deploymentPath, options);

      // Install dependencies
      await this.installDependencies(deploymentPath);

      // Deploy to Vercel
      const vercelResult = await this.deployToVercelCLI(deploymentPath, projectName);

      // Store deployment info
      const deploymentResult: VercelDeploymentResult = {
        deploymentId,
        url: vercelResult.url,
        status: 'ready',
        createdAt: new Date(),
        vercelUrl: vercelResult.vercelUrl,
        previewUrl: vercelResult.previewUrl,
      };

      this.deployments.set(deploymentId, deploymentResult);

      // Cleanup temporary files
      await this.cleanupDeployment(deploymentPath);

      this.logger.info('VercelDeploymentService', 'Vercel deployment successful', {
        deploymentId,
        url: deploymentResult.url,
        vercelUrl: deploymentResult.vercelUrl,
      });

      return deploymentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('VercelDeploymentService', 'Failed to deploy to Vercel', {
        error: errorMessage,
        componentName,
        deploymentId,
      });
      throw error;
    }
  }

  /**
   * Write files to the deployment directory
   */
  private async writeFilesToDeployment(
    deploymentPath: string,
    files: GeneratedFile[]
  ): Promise<void> {
    for (const file of files) {
      const filePath = path.join(deploymentPath, file.path);
      const dirPath = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file content
      await fs.writeFile(filePath, file.content);
    }
  }

  /**
   * Create Vercel configuration file
   */
  private async createVercelConfig(
    deploymentPath: string,
    options: {
      framework?: 'react' | 'next' | 'vite';
      buildCommand?: string;
      outputDirectory?: string;
    }
  ): Promise<void> {
    const vercelConfig = {
      version: 2,
      name: path.basename(deploymentPath),
      builds: [
        {
          src: 'package.json',
          use: '@vercel/static-build',
          config: {
            distDir: options.outputDirectory || 'dist',
            ...(options.buildCommand && { buildCommand: options.buildCommand }),
          },
        },
      ],
      routes: [
        {
          src: '/(.*)',
          dest: '/index.html',
        },
      ],
    };

    await fs.writeFile(
      path.join(deploymentPath, 'vercel.json'),
      JSON.stringify(vercelConfig, null, 2)
    );
  }

  /**
   * Install dependencies in the deployment directory
   */
  private async installDependencies(deploymentPath: string): Promise<void> {
    this.logger.info('VercelDeploymentService', 'Installing dependencies...');

    try {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      await execAsync(`${npmCommand} install --legacy-peer-deps`, {
        cwd: deploymentPath,
        timeout: 120000, // 2 minute timeout for Vercel deployments
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      });
      
      this.logger.info('VercelDeploymentService', 'Dependencies installed successfully');
    } catch (error) {
      this.logger.error('VercelDeploymentService', 'Failed to install dependencies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  }

  /**
   * Deploy to Vercel using CLI
   */
  private async deployToVercelCLI(
    deploymentPath: string,
    projectName: string
  ): Promise<{ url: string; vercelUrl?: string; previewUrl?: string }> {
    this.logger.info('VercelDeploymentService', 'Deploying to Vercel...');

    try {
      // Check if Vercel CLI is installed
      try {
        await execAsync('vercel --version', { 
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash' 
        });
      } catch (error) {
        throw new Error('Vercel CLI is not installed. Please install it with: npm i -g vercel');
      }

      // Deploy to Vercel
      const { stdout } = await execAsync('vercel --prod --yes', {
        cwd: deploymentPath,
        timeout: 300000, // 5 minute timeout
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      });

      // Parse the output to get the deployment URL
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : '';

      if (!url) {
        throw new Error('Failed to get deployment URL from Vercel output');
      }

      this.logger.info('VercelDeploymentService', 'Vercel deployment completed', {
        url,
        projectName,
      });

      return {
        url,
        vercelUrl: url,
        previewUrl: url,
      };
    } catch (error) {
      this.logger.error('VercelDeploymentService', 'Failed to deploy to Vercel CLI', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cleanup temporary deployment files
   */
  private async cleanupDeployment(deploymentPath: string): Promise<void> {
    try {
      await fs.rm(deploymentPath, { recursive: true, force: true });
      this.logger.info('VercelDeploymentService', 'Cleaned up temporary deployment files');
    } catch (error) {
      this.logger.warning('VercelDeploymentService', 'Failed to cleanup deployment files', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): VercelDeploymentResult | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get all deployments
   */
  getAllDeployments(): VercelDeploymentResult[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      this.deployments.delete(deploymentId);
      this.logger.info('VercelDeploymentService', 'Deployment deleted', { deploymentId });
    }
  }
}

export const vercelDeploymentService = new VercelDeploymentService();
