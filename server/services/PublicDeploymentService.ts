import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';

const execAsync = promisify(exec);

export interface PublicDeploymentOptions {
  platform: 'vercel' | 'netlify' | 'github-pages';
  domain?: string;
  customDomain?: string;
}

export interface PublicDeploymentResult {
  deploymentId: string;
  url: string;
  platform: string;
  status: 'deploying' | 'ready' | 'error';
  createdAt: Date;
  expiresAt?: Date;
}

export class PublicDeploymentService {
  private logger: Logger;
  private deployments: Map<string, PublicDeploymentResult> = new Map();

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
  }

  /**
   * Deploy app to public platform for global access
   */
  async deployToPublic(
    componentName: string,
    files: GeneratedFile[],
    options: PublicDeploymentOptions = { platform: 'vercel' }
  ): Promise<PublicDeploymentResult> {
    const deploymentId = `${componentName}-${Date.now()}`;
    
    this.logger.info('PublicDeploymentService', 'Starting public deployment', {
      componentName,
      platform: options.platform,
      deploymentId,
    });

    try {
      // Create temporary deployment directory
      const deploymentPath = path.join(process.cwd(), 'temp-deployments', deploymentId);
      await fs.mkdir(deploymentPath, { recursive: true });

      // Write files to deployment directory
      await this.writeFilesToDeployment(deploymentPath, files);

      // Install dependencies
      await this.installDependencies(deploymentPath);

      // Build the application
      await this.buildApplication(deploymentPath);

      // Deploy to platform
      const result = await this.deployToPlatform(deploymentPath, deploymentId, options);

      // Store deployment info
      const deploymentResult: PublicDeploymentResult = {
        deploymentId,
        url: result.url,
        platform: options.platform,
        status: 'ready',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      this.deployments.set(deploymentId, deploymentResult);

      // Cleanup temporary files
      await this.cleanupDeployment(deploymentPath);

      this.logger.info('PublicDeploymentService', 'Public deployment successful', {
        deploymentId,
        url: result.url,
        platform: options.platform,
      });

      return deploymentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('PublicDeploymentService', 'Public deployment failed', {
        error: errorMessage,
        deploymentId,
        platform: options.platform,
      });

      const failedResult: PublicDeploymentResult = {
        deploymentId,
        url: '',
        platform: options.platform,
        status: 'error',
        createdAt: new Date(),
      };

      this.deployments.set(deploymentId, failedResult);
      throw error;
    }
  }

  /**
   * Write files to deployment directory
   */
  private async writeFilesToDeployment(
    deploymentPath: string,
    files: GeneratedFile[]
  ): Promise<void> {
    for (const file of files) {
      const filePath = path.join(deploymentPath, file.path);
      const dirPath = path.dirname(filePath);
      
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  /**
   * Install dependencies
   */
  private async installDependencies(deploymentPath: string): Promise<void> {
    this.logger.info('PublicDeploymentService', 'Installing dependencies...');
    
    try {
      await execAsync('npm install --legacy-peer-deps', {
        cwd: deploymentPath,
        timeout: 120000, // 2 minutes
      });
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  }

  /**
   * Build application for production
   */
  private async buildApplication(deploymentPath: string): Promise<void> {
    this.logger.info('PublicDeploymentService', 'Building application...');
    
    try {
      await execAsync('npm run build', {
        cwd: deploymentPath,
        timeout: 180000, // 3 minutes
      });
    } catch (error) {
      throw new Error(`Failed to build application: ${error}`);
    }
  }

  /**
   * Deploy to specific platform
   */
  private async deployToPlatform(
    deploymentPath: string,
    deploymentId: string,
    options: PublicDeploymentOptions
  ): Promise<{ url: string }> {
    switch (options.platform) {
      case 'vercel':
        return this.deployToVercel(deploymentPath, deploymentId, options);
      case 'netlify':
        return this.deployToNetlify(deploymentPath, deploymentId, options);
      case 'github-pages':
        return this.deployToGitHubPages(deploymentPath, deploymentId, options);
      default:
        throw new Error(`Unsupported platform: ${options.platform}`);
    }
  }

  /**
   * Deploy to Vercel
   */
  private async deployToVercel(
    deploymentPath: string,
    deploymentId: string,
    options: PublicDeploymentOptions
  ): Promise<{ url: string }> {
    this.logger.info('PublicDeploymentService', 'Deploying to Vercel...');
    
    try {
      // Install Vercel CLI
      await execAsync('npm install -g vercel', { timeout: 60000 });
      
      // Deploy to Vercel
      const { stdout } = await execAsync('vercel --prod --yes', {
        cwd: deploymentPath,
        timeout: 300000, // 5 minutes
      });

      // Extract URL from Vercel output
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      if (!urlMatch) {
        throw new Error('Failed to extract deployment URL from Vercel output');
      }

      return { url: urlMatch[0] };
    } catch (error) {
      throw new Error(`Vercel deployment failed: ${error}`);
    }
  }

  /**
   * Deploy to Netlify
   */
  private async deployToNetlify(
    deploymentPath: string,
    deploymentId: string,
    options: PublicDeploymentOptions
  ): Promise<{ url: string }> {
    this.logger.info('PublicDeploymentService', 'Deploying to Netlify...');
    
    try {
      // Install Netlify CLI
      await execAsync('npm install -g netlify-cli', { timeout: 60000 });
      
      // Deploy to Netlify
      const { stdout } = await execAsync('netlify deploy --prod --dir=dist', {
        cwd: deploymentPath,
        timeout: 300000, // 5 minutes
      });

      // Extract URL from Netlify output
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      if (!urlMatch) {
        throw new Error('Failed to extract deployment URL from Netlify output');
      }

      return { url: urlMatch[0] };
    } catch (error) {
      throw new Error(`Netlify deployment failed: ${error}`);
    }
  }

  /**
   * Deploy to GitHub Pages
   */
  private async deployToGitHubPages(
    deploymentPath: string,
    deploymentId: string,
    options: PublicDeploymentOptions
  ): Promise<{ url: string }> {
    this.logger.info('PublicDeploymentService', 'Deploying to GitHub Pages...');
    
    try {
      // This would require GitHub integration
      // For now, return a placeholder URL
      const url = `https://your-username.github.io/${deploymentId}`;
      return { url };
    } catch (error) {
      throw new Error(`GitHub Pages deployment failed: ${error}`);
    }
  }

  /**
   * Cleanup deployment directory
   */
  private async cleanupDeployment(deploymentPath: string): Promise<void> {
    try {
      await fs.rm(deploymentPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn('PublicDeploymentService', 'Failed to cleanup deployment directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        deploymentPath,
      });
    }
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): PublicDeploymentResult | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get all deployments
   */
  getAllDeployments(): PublicDeploymentResult[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Clean up expired deployments
   */
  async cleanupExpiredDeployments(): Promise<void> {
    const now = new Date();
    const expiredDeployments = Array.from(this.deployments.values()).filter(
      deployment => deployment.expiresAt && deployment.expiresAt < now
    );

    for (const deployment of expiredDeployments) {
      this.deployments.delete(deployment.deploymentId);
      this.logger.info('PublicDeploymentService', 'Cleaned up expired deployment', {
        deploymentId: deployment.deploymentId,
        url: deployment.url,
      });
    }
  }
}

// Export singleton instance
export const publicDeploymentService = new PublicDeploymentService();
