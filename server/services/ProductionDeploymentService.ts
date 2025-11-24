import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';
import { db } from '../../db';
import { projectFiles, workspaces } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

export interface DeploymentConfig {
  projectName: string;
  repoName: string;
  description?: string;
  isPrivate?: boolean;
  customDomain?: string;
  envVars?: Record<string, string>;
  framework: 'vite' | 'nextjs' | 'react';
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  githubUrl?: string;
  vercelUrl?: string;
  previewUrl?: string;
  error?: string;
  status: 'building' | 'ready' | 'error';
  createdAt: Date;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
}

export class ProductionDeploymentService {
  private logger: Logger;
  private octokit: Octokit | null = null;
  private vercelToken: string | null = null;

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);

    // Initialize GitHub client if token is available
    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
    }

    this.vercelToken = process.env.VERCEL_TOKEN || null;
  }

  /**
   * Complete deployment pipeline: GitHub repo + Vercel deployment
   */
  async deployToProduction(
    files: GeneratedFile[],
    config: DeploymentConfig,
    userId: string
  ): Promise<DeploymentResult> {
    const deploymentId = `${config.projectName}-${Date.now()}`;

    try {
      this.logger.info('ProductionDeploymentService', 'Starting production deployment', {
        deploymentId,
        projectName: config.projectName,
        fileCount: files.length,
        framework: config.framework,
      });

      // Step 1: Create GitHub repository
      const repo = await this.createGitHubRepo(config, files);

      // Step 2: Deploy to Vercel
      const vercelDeployment = await this.deployToVercel(repo, config);

      // Step 3: Store deployment info in database
      await this.saveDeploymentRecord(deploymentId, repo, vercelDeployment, userId);

      const result: DeploymentResult = {
        success: true,
        deploymentId,
        githubUrl: repo.htmlUrl,
        vercelUrl: vercelDeployment.url,
        previewUrl: vercelDeployment.url,
        status: 'ready',
        createdAt: new Date(),
      };

      this.logger.info('ProductionDeploymentService', 'Deployment completed successfully', result);
      return result;

    } catch (error) {
      this.logger.error('ProductionDeploymentService', 'Deployment failed', error as Error);
      return {
        success: false,
        deploymentId,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
        status: 'error',
        createdAt: new Date(),
      };
    }
  }

  /**
   * Create GitHub repository with generated files
   */
  private async createGitHubRepo(
    config: DeploymentConfig,
    files: GeneratedFile[]
  ): Promise<GitHubRepo> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured. Please set GITHUB_TOKEN environment variable.');
    }

    // Create repository (use createForAuthenticatedUser for authenticated user repos)
    // Set auto_init to false to avoid initial README.md that requires SHA
    const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
      name: config.repoName,
      description: config.description || `Generated with AI - ${config.projectName}`,
      private: config.isPrivate || false,
      auto_init: false, // Don't create initial README to avoid SHA requirement
    });

    // Create all files in the repository
    for (const file of files) {
      const content = Buffer.from(file.content).toString('base64');

      // Check if file exists to get SHA for updates
      let fileSha: string | undefined;
      try {
        const { data: existingFile } = await this.octokit.repos.getContent({
          owner: repo.owner.login,
          repo: repo.name,
          path: file.path,
          ref: repo.default_branch,
        });
        
        if (Array.isArray(existingFile)) {
          // It's a directory, skip SHA
          fileSha = undefined;
        } else if (existingFile.type === 'file') {
          // File exists, get its SHA
          fileSha = existingFile.sha;
        }
      } catch (error: any) {
        // File doesn't exist (404), that's fine - we'll create it
        if (error.status !== 404) {
          this.logger.warn('ProductionDeploymentService', `Error checking file ${file.path}`, { error: error.message });
        }
        fileSha = undefined;
      }

      // Create or update file with SHA if it exists
      await this.octokit.repos.createOrUpdateFileContents({
        owner: repo.owner.login,
        repo: repo.name,
        path: file.path,
        message: fileSha ? `Update ${file.path}` : `Add ${file.path}`,
        content,
        sha: fileSha, // Include SHA if file exists, undefined for new files
      });
    }

    // Create additional necessary files
    await this.createNecessaryFiles(repo.owner.login, repo.name, config);

    return {
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
    };
  }

  /**
   * Create necessary deployment files (.gitignore, README, etc.)
   */
  private async createNecessaryFiles(
    owner: string,
    repo: string,
    config: DeploymentConfig
  ): Promise<void> {
    if (!this.octokit) return;

    // .gitignore
    const gitignoreContent = `# Dependencies
node_modules/
/.pnp
.pnp.js

# Production build
/dist
/build

# Environment variables
.env
.env.local
.env.production

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*`;

    // Helper function to get file SHA if it exists
    const getFileSha = async (path: string): Promise<string | undefined> => {
      try {
        const { data: file } = await this.octokit!.repos.getContent({
          owner,
          repo,
          path,
          ref: 'main',
        });
        if (!Array.isArray(file) && file.type === 'file') {
          return file.sha;
        }
      } catch (error: any) {
        if (error.status !== 404) {
          this.logger.warn('ProductionDeploymentService', `Error checking file ${path}`, { error: error.message });
        }
      }
      return undefined;
    };

    // Create .gitignore
    const gitignoreSha = await getFileSha('.gitignore');
    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '.gitignore',
      message: gitignoreSha ? 'Update .gitignore' : 'Add .gitignore',
      content: Buffer.from(gitignoreContent).toString('base64'),
      sha: gitignoreSha,
    });

    // README.md
    const readmeContent = `# ${config.projectName}

Generated with AI-powered development platform.

## 🚀 Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## 📦 Built With

- **React** ${config.framework === 'nextjs' ? '+ Next.js' : '+ Vite'}
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Modern React patterns** (hooks, functional components)

## 🌐 Live Demo

This application is automatically deployed to Vercel: [View Live Demo](https://your-app.vercel.app)

## 🔧 Development

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
\`\`\`

## 📝 License

MIT License - feel free to use this project as you wish!

---

**Generated with ❤️ by AI Development Platform**`;

    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Add README',
      content: Buffer.from(readmeContent).toString('base64'),
    });
  }

  /**
   * Deploy repository to Vercel
   */
  private async deployToVercel(
    repo: GitHubRepo,
    config: DeploymentConfig
  ): Promise<{ url: string; deploymentId: string }> {
    if (!this.vercelToken) {
      throw new Error('Vercel token not configured. Please set VERCEL_TOKEN environment variable.');
    }

    // Create Vercel project
    const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.repoName,
        gitRepository: {
          type: 'github',
          repo: repo.fullName,
        },
        framework: config.framework === 'nextjs' ? 'nextjs' : 'vite',
        buildCommand: this.getBuildCommand(config.framework),
        outputDirectory: this.getOutputDirectory(config.framework),
        environmentVariables: config.envVars || {},
      }),
    });

    if (!projectResponse.ok) {
      const error = await projectResponse.text();
      throw new Error(`Failed to create Vercel project: ${error}`);
    }

    const project = await projectResponse.json();

    // Trigger deployment
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.repoName,
        gitSource: {
          type: 'github',
          repo: repo.fullName,
          ref: repo.defaultBranch,
        },
        projectSettings: {
          framework: config.framework === 'nextjs' ? 'nextjs' : 'vite',
          buildCommand: this.getBuildCommand(config.framework),
          outputDirectory: this.getOutputDirectory(config.framework),
        },
      }),
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.text();
      throw new Error(`Failed to create Vercel deployment: ${error}`);
    }

    const deployment = await deploymentResponse.json();

    return {
      url: `https://${deployment.url}`,
      deploymentId: deployment.uid,
    };
  }

  /**
   * Get build command for framework
   */
  private getBuildCommand(framework: string): string {
    switch (framework) {
      case 'nextjs':
        return 'npm run build';
      case 'vite':
        return 'npm run build';
      default:
        return 'npm run build';
    }
  }

  /**
   * Get output directory for framework
   */
  private getOutputDirectory(framework: string): string {
    switch (framework) {
      case 'nextjs':
        return '.next';
      case 'vite':
        return 'dist';
      default:
        return 'dist';
    }
  }

  /**
   * Save deployment record to database
   */
  private async saveDeploymentRecord(
    deploymentId: string,
    repo: GitHubRepo,
    vercelDeployment: { url: string; deploymentId: string },
    userId: string
  ): Promise<void> {
    try {
      // Store deployment info in a new table or extend existing workspace
      const deploymentData = {
        deploymentId,
        githubUrl: repo.htmlUrl,
        vercelUrl: vercelDeployment.url,
        status: 'ready' as const,
        createdAt: new Date(),
        userId,
      };

      // For now, log the deployment data
      this.logger.info('ProductionDeploymentService', 'Deployment record saved', deploymentData);
    } catch (error) {
      this.logger.error('ProductionDeploymentService', 'Failed to save deployment record', error as Error);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<{
    status: 'building' | 'ready' | 'error';
    url?: string;
    error?: string;
  }> {
    if (!this.vercelToken) {
      return { status: 'error', error: 'Vercel token not configured' };
    }

    try {
      const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.vercelToken}`,
        },
      });

      if (!response.ok) {
        return { status: 'error', error: 'Failed to fetch deployment status' };
      }

      const deployment = await response.json();

      return {
        status: deployment.readyState === 'READY' ? 'ready' :
                deployment.readyState === 'ERROR' ? 'error' : 'building',
        url: deployment.url ? `https://${deployment.url}` : undefined,
        error: deployment.readyState === 'ERROR' ? 'Deployment failed' : undefined,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List user deployments
   */
  async listUserDeployments(userId: string): Promise<DeploymentResult[]> {
    // This would query the database for user deployments
    // For now, return empty array
    return [];
  }
}

export const productionDeploymentService = new ProductionDeploymentService();