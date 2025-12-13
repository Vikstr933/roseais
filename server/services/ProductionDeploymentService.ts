import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';
import { db } from '../../db';
import { projectFiles, workspaces } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

export interface DeploymentConfig {
  projectName: string;
  repoName: string;
  description?: string;
  isPrivate?: boolean;
  customDomain?: string;
  envVars?: Record<string, string>;
  framework: 'vite' | 'nextjs' | 'react';
  workspaceId?: number; // Optional workspace ID to track deployment
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
  id: number; // GitHub repository ID (required for Vercel)
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
   * Get API key for a service, checking shared connectors first, then personal, then env vars
   */
  private async getServiceAPIKey(
    serviceName: string,
    userId: string,
    workspaceId?: number
  ): Promise<string | null> {
    try {
      const { db } = await import('../../db');
      const { apiKeys } = await import('../../db/schema-pg');
      const { eq, and, or, isNull } = await import('drizzle-orm');

      // 1. Check workspace-wide (shared) connector first
      if (workspaceId) {
        const [sharedKey] = await db
          .select()
          .from(apiKeys)
          .where(
            and(
              eq(apiKeys.serviceName, serviceName),
              eq(apiKeys.isShared, true),
              eq(apiKeys.isActive, true),
              eq(apiKeys.workspaceId, workspaceId.toString())
            )
          )
          .limit(1);

        if (sharedKey) {
          this.logger.info('ProductionDeploymentService', `Found shared ${serviceName} connector for workspace ${workspaceId}`);
          // Decrypt and return the API key
          try {
            const { apiKeyService } = await import('./APIKeyService');
            const decrypted = await apiKeyService.getAPIKey(sharedKey.id.toString(), userId);
            if (decrypted) {
              return decrypted.keyValue;
            }
          } catch (error) {
            this.logger.error('ProductionDeploymentService', `Failed to decrypt shared ${serviceName} connector`, error as Error);
            // Fall through to next option
          }
        }
      }

      // 2. Check user-specific (personal) connector
      const [personalKey] = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.serviceName, serviceName),
            eq(apiKeys.userId, userId),
            eq(apiKeys.isShared, false),
            eq(apiKeys.isActive, true),
            isNull(apiKeys.projectId) // User-wide, not project-specific
          )
        )
        .limit(1);

      if (personalKey) {
        this.logger.info('ProductionDeploymentService', `Found personal ${serviceName} connector for user ${userId}`);
        // Decrypt and return the API key
        try {
          const { apiKeyService } = await import('./APIKeyService');
          const decrypted = await apiKeyService.getAPIKey(personalKey.id.toString(), userId);
          if (decrypted) {
            return decrypted.keyValue;
          }
        } catch (error) {
          this.logger.error('ProductionDeploymentService', `Failed to decrypt personal ${serviceName} connector`, error as Error);
          // Fall through to next option
        }
      }

      // 3. Fallback to environment variable (for backward compatibility)
      const envKey = process.env[`${serviceName.toUpperCase()}_TOKEN`] || 
                     process.env[`${serviceName.toUpperCase()}_API_KEY`] ||
                     process.env[`${serviceName.toUpperCase()}_KEY`];
      
      if (envKey) {
        return envKey;
      }

      return null;
    } catch (error) {
      this.logger.error('ProductionDeploymentService', `Error getting ${serviceName} API key`, error as Error);
      // Fallback to env var
      return process.env[`${serviceName.toUpperCase()}_TOKEN`] || null;
    }
  }

  /**
   * Complete deployment pipeline: GitHub repo + Vercel deployment
   * Checks for existing deployment and updates instead of creating new one
   */
  async deployToProduction(
    files: GeneratedFile[],
    config: DeploymentConfig,
    userId: string
  ): Promise<DeploymentResult> {
    let deploymentId = `${config.projectName}-${Date.now()}`;
    let existingDeployment: any = null;

    try {
      // CRITICAL: Validate files before deployment
      this.logger.info('ProductionDeploymentService', 'Validating files before deployment', {
        fileCount: files.length,
      });

      const validationResult = await this.validateFilesBeforeDeployment(files);
      
      // Use fixed files if auto-fixes were applied
      const filesToDeploy = validationResult.fixedFiles || files;
      
      if (!validationResult.valid) {
        const errorMessage = `Deployment blocked: ${validationResult.errors.length} error(s) found:\n${validationResult.errors.join('\n')}`;
        this.logger.error('ProductionDeploymentService', 'File validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
        
        return {
          success: false,
          deploymentId,
          error: errorMessage,
          status: 'error',
          createdAt: new Date(),
        };
      }

      if (validationResult.warnings.length > 0) {
        this.logger.warning('ProductionDeploymentService', 'File validation warnings', {
          warnings: validationResult.warnings,
        });
      }

      if (validationResult.fixedFiles) {
        this.logger.info('ProductionDeploymentService', 'Using auto-fixed files for deployment', {
          originalFileCount: files.length,
          fixedFileCount: validationResult.fixedFiles.length
        });
      }

      // Check if workspace already has a deployment
      if (config.workspaceId) {
        const workspace = await db.select().from(workspaces).where(eq(workspaces.id, config.workspaceId)).limit(1);
        if (workspace.length > 0 && workspace[0].githubUrl && workspace[0].vercelUrl) {
          existingDeployment = workspace[0];
          deploymentId = workspace[0].deploymentId || deploymentId;
          this.logger.info('ProductionDeploymentService', 'Found existing deployment, will update', {
            workspaceId: config.workspaceId,
            githubUrl: workspace[0].githubUrl,
            vercelUrl: workspace[0].vercelUrl,
          });
        }
      }

      this.logger.info('ProductionDeploymentService', 'Starting production deployment', {
        deploymentId,
        projectName: config.projectName,
        fileCount: files.length,
        framework: config.framework,
        isUpdate: !!existingDeployment,
      });

      let repo: GitHubRepo;
      let vercelDeployment: { url: string; deploymentId: string };

      if (existingDeployment) {
        // Update existing deployment
        // Extract repo name from GitHub URL
        const githubUrlMatch = existingDeployment.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (githubUrlMatch) {
          const repoOwner = githubUrlMatch[1];
          const repoName = githubUrlMatch[2];
          
          // Update files in existing GitHub repo (use fixed files if available)
          repo = await this.updateGitHubRepo(repoOwner, repoName, filesToDeploy);
          
          // Trigger new Vercel deployment
          // Get projectId from workspaceId if available
          let projectId: number | undefined;
          if (config.workspaceId) {
            projectId = config.workspaceId;
          }
          
          vercelDeployment = await this.triggerVercelRedeploy(
            existingDeployment.githubRepoId || repo.id,
            repo.defaultBranch,
            config,
            filesToDeploy,
            userId,
            projectId
          );
        } else {
          throw new Error('Invalid GitHub URL in existing deployment');
        }
      } else {
        // Create new deployment (use fixed files if available)
        repo = await this.createGitHubRepo(config, filesToDeploy);
        // Get projectId from workspaceId if available
        let projectId: number | undefined;
        if (config.workspaceId) {
          projectId = config.workspaceId;
        }
        
        vercelDeployment = await this.deployToVercel(repo, config, filesToDeploy, userId, projectId);
      }

      // Step 3: Store/update deployment info in database
      await this.saveDeploymentRecord(deploymentId, repo, vercelDeployment, userId, config.workspaceId);

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

    // Validate repoName is not empty
    if (!config.repoName || config.repoName.trim().length === 0) {
      throw new Error(`Repository name cannot be empty. Received: "${config.repoName}". Project name: "${config.projectName}"`);
    }

    // Check if repository name already exists, append timestamp if needed
    let repoName = config.repoName.trim();
    let attempts = 0;
    const maxAttempts = 5;
    const currentUser = (await this.octokit.users.getAuthenticated()).data.login;
    
    this.logger.info('ProductionDeploymentService', `Creating GitHub repository: name="${repoName}", projectName="${config.projectName}"`);

    while (attempts < maxAttempts) {
      try {
        // Check if repo exists
        await this.octokit.repos.get({
          owner: currentUser,
          repo: repoName,
        });
        
        // Repo exists, append timestamp
        repoName = `${config.repoName}-${Date.now()}`;
        attempts++;
        this.logger.info('ProductionDeploymentService', `Repository name exists, trying: ${repoName}`);
      } catch (error: any) {
        // Repo doesn't exist (404), we can use this name
        if (error.status === 404) {
          break;
        }
        // Other error, throw it
        throw error;
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error(`Could not find available repository name after ${maxAttempts} attempts`);
    }

    // Create repository (use createForAuthenticatedUser for authenticated user repos)
    // Set auto_init to true to create an initial README.md
    // This makes the repository immediately ready for Git operations (blobs, trees, commits)
    // Without this, empty repositories can take 10-30+ seconds to initialize
    const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: config.description || `Generated with AI - ${config.projectName}`,
      private: config.isPrivate || false,
      auto_init: true, // Create initial README.md to make repository ready immediately
    });

    // Determine default branch (usually 'main' for new repos)
    const defaultBranch = repo.default_branch || 'main';

    // Wait longer for GitHub to fully propagate the repository
    // This helps avoid race conditions when immediately trying to commit
    // Increased from 500ms to 2000ms to handle GitHub's eventual consistency
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create necessary files (.gitignore, README.md) and add them to the files array
    const necessaryFiles = await this.getNecessaryFiles(config);
    const allFiles = [...files, ...necessaryFiles];

    // Create all files in a single commit using Git Tree API
    // Retry logic for empty repo handling
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
      try {
        await this.commitFilesToRepo(
          repo.owner.login,
          repo.name,
          defaultBranch,
          allFiles,
          `Initial commit: Add ${allFiles.length} file${allFiles.length > 1 ? 's' : ''}`
        );
        // Success - break out of retry loop
        break;
      } catch (error: any) {
        lastError = error;
        // If it's a 404 or 409 (ref conflict), wait and retry with exponential backoff
        if ((error.status === 404 || error.status === 409) && retries > 1) {
          const waitTime = (4 - retries) * 2000; // Exponential backoff: 2s, 4s, 6s
          this.logger.warning('ProductionDeploymentService', `Retrying commit after ${error.status} error, waiting ${waitTime}ms`, {
            owner: repo.owner.login,
            repo: repo.name,
            branch: defaultBranch,
            retriesLeft: retries - 1
          });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
        } else {
          // Not a retryable error or out of retries
          throw error;
        }
      }
    }
    
    if (lastError && retries === 0) {
      throw lastError;
    }

    return {
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      id: repo.id, // Include repository ID for Vercel
    };
  }

  /**
   * Get necessary deployment files (.gitignore, README, etc.) as GeneratedFile array
   */
  private async getNecessaryFiles(config: DeploymentConfig): Promise<GeneratedFile[]> {
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

    return [
      {
        path: '.gitignore',
        content: gitignoreContent,
      },
      {
        path: 'README.md',
        content: readmeContent,
      },
    ];
  }

  /**
   * Sanitize project name for Vercel
   * Vercel requirements:
   * - Up to 100 characters
   * - Lowercase only
   * - Letters, digits, '.', '_', '-' only
   * - Cannot contain '---'
   */
  private sanitizeVercelProjectName(name: string): string {
    // Convert to lowercase
    let sanitized = name.toLowerCase();
    
    // Replace invalid characters with '-'
    sanitized = sanitized.replace(/[^a-z0-9._-]/g, '-');
    
    // Replace multiple consecutive dashes with single dash
    sanitized = sanitized.replace(/-+/g, '-');
    
    // Remove '---' sequences (replace with '--')
    sanitized = sanitized.replace(/---/g, '--');
    
    // Remove leading/trailing dashes
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    
    // Limit to 100 characters
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
      // Remove trailing dash if truncated
      sanitized = sanitized.replace(/-+$/, '');
    }
    
    // Ensure it's not empty
    if (!sanitized) {
      sanitized = 'project';
    }
    
    return sanitized;
  }

  /**
   * Deploy repository to Vercel
   */
  private async deployToVercel(
    repo: GitHubRepo,
    config: DeploymentConfig,
    files?: GeneratedFile[],
    userId?: string,
    projectId?: number
  ): Promise<{ url: string; deploymentId: string }> {
    // Try to get Vercel token from shared/personal connectors first
    let vercelToken = this.vercelToken;
    if (userId) {
      const connectorToken = await this.getServiceAPIKey('vercel', userId, projectId || undefined);
      if (connectorToken) {
        vercelToken = connectorToken;
      }
    }

    if (!vercelToken) {
      throw new Error('Vercel token not configured. Please configure Vercel API key in Settings → Integrations → Shared Connectors (admin) or Personal Connectors.');
    }

    // Check publishing policy if projectId is provided
    if (projectId) {
      const { db } = await import('../../db');
      const { workspaces } = await import('../../db/schema-pg');
      const { eq } = await import('drizzle-orm');
      
      const [project] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, projectId))
        .limit(1);

      if (project?.publishingPolicy) {
        const policy = typeof project.publishingPolicy === 'string' 
          ? JSON.parse(project.publishingPolicy) 
          : project.publishingPolicy;
        
        if (policy.allowExternalPublishing === false) {
          throw new Error('External publishing is disabled for this project');
        }

        // Check if user role is allowed
        if (policy.allowedRoles && userId) {
          const { users } = await import('../../db/schema-pg');
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          if (user && !policy.allowedRoles.includes(user.role)) {
            throw new Error(`Your role (${user.role}) is not allowed to publish externally. Allowed roles: ${policy.allowedRoles.join(', ')}`);
          }
        }
      }
    }

    // Detect monorepo structure
    const hasClientPackageJson = files?.some(f => f.path === 'client/package.json') || false;
    const hasServerPackageJson = files?.some(f => f.path === 'server/package.json') || false;
    const isMonorepo = hasClientPackageJson || hasServerPackageJson;
    const rootDirectory = hasClientPackageJson ? 'client' : undefined;

    // Convert envVars object to Vercel's array format
    // Vercel expects: [{key: 'KEY', value: 'value', target: ['production']}]
    const environmentVariables = config.envVars 
      ? Object.entries(config.envVars).map(([key, value]) => ({
          key,
          value,
          target: ['production', 'preview', 'development'] as ('production' | 'preview' | 'development')[],
        }))
      : [];

    // Extract environment variables from .env.example files in the project
    const extractedEnvVars = this.extractEnvironmentVariablesFromFiles(files || []);
    for (const [key, value] of Object.entries(extractedEnvVars)) {
      // Only add if not already present (don't override config.envVars)
      if (!environmentVariables.some(ev => ev.key === key)) {
        environmentVariables.push({
          key,
          value: value || '', // Use empty string if value is placeholder
          target: ['production', 'preview', 'development'] as ('production' | 'preview' | 'development')[],
        });
      }
    }

    // Automatically add database connection string if project has a database
    if (userId && projectId) {
      try {
        const { databaseProvisioningService } = await import('./DatabaseProvisioningService');
        const connectionString = await databaseProvisioningService.getDatabaseConnection(userId, projectId);
        
        if (connectionString) {
          // Get database type from project_databases table
          const { db } = await import('../../db');
          const { projectDatabases } = await import('../../db/schema-pg');
          const { eq } = await import('drizzle-orm');
          
          const [dbConfig] = await db.select()
            .from(projectDatabases)
            .where(eq(projectDatabases.projectId, projectId))
            .limit(1);

          if (dbConfig && dbConfig.status === 'active') {
            const dbType = dbConfig.databaseType;
            
            // Add appropriate environment variable based on database type
            if (dbType === 'mongodb') {
              environmentVariables.push({
                key: 'MONGODB_URI',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
              this.logger.info('ProductionDeploymentService', 'Added MONGODB_URI to Vercel environment variables', {
                projectId
              });
            } else if (dbType === 'postgresql') {
              // Add PROJECT_DATABASE_URL (to avoid conflict with platform's DATABASE_URL)
              environmentVariables.push({
                key: 'PROJECT_DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
              
              // Also add DATABASE_URL as alias (many frameworks expect this)
              environmentVariables.push({
                key: 'DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
              
              this.logger.info('ProductionDeploymentService', 'Added PROJECT_DATABASE_URL and DATABASE_URL to Vercel environment variables', {
                projectId
              });
            } else if (dbType === 'mysql') {
              // Parse MySQL connection string or use individual variables
              // For now, add as DATABASE_URL (common convention)
              environmentVariables.push({
                key: 'DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
              this.logger.info('ProductionDeploymentService', 'Added DATABASE_URL to Vercel environment variables', {
                projectId
              });
            }
          }
        }
      } catch (error) {
        // Non-fatal: log but continue deployment
        this.logger.warning('ProductionDeploymentService', 'Failed to add database connection string to Vercel', error as Error);
      }
    }

    // Add connector environment variables (from shared/personal connectors)
    if (userId && config.workspaceId) {
      try {
        const { ConnectorService } = await import('./ConnectorService');
        const connectors = await ConnectorService.getWorkspaceConnectors(userId, config.workspaceId);
        
        // Add env vars from connectors to Vercel
        for (const [key, value] of Object.entries(connectors.envVarsForCode)) {
          // Only add if not already present (don't override existing env vars)
          if (!environmentVariables.some(ev => ev.key === key)) {
            environmentVariables.push({
              key,
              value,
              target: ['production', 'preview', 'development'] as ('production' | 'preview' | 'development')[],
            });
            this.logger.info('ProductionDeploymentService', `Added connector env var ${key} to Vercel`, {
              workspaceId: config.workspaceId,
              connectorCount: connectors.availableConnectors.length,
            });
          }
        }
      } catch (error) {
        // Non-fatal: log but continue deployment
        this.logger.warning('ProductionDeploymentService', 'Failed to add connector env vars to Vercel', error as Error);
      }
    }

    // Sanitize project name for Vercel requirements
    const vercelProjectName = this.sanitizeVercelProjectName(repo.name);

    // Get build command and output directory (adjusted for monorepo if needed)
    const buildCommand = this.getBuildCommand(config.framework, isMonorepo, rootDirectory);
    const outputDirectory = this.getOutputDirectory(config.framework, isMonorepo);

    // Create Vercel project
    // NOTE: Do NOT include environmentVariables in project creation body
    // Vercel v9 API doesn't accept env vars during project creation - they must be added after
    const projectBody: any = {
      name: vercelProjectName, // Use sanitized name for Vercel
      gitRepository: {
        type: 'github',
        repo: repo.fullName,
      },
      framework: config.framework === 'nextjs' ? 'nextjs' : 'vite',
      buildCommand,
      outputDirectory,
      ...(rootDirectory && { rootDirectory }), // Add rootDirectory for monorepo
    };

    const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectBody),
    });

    if (!projectResponse.ok) {
      const error = await projectResponse.text();
      throw new Error(`Failed to create Vercel project: ${error}`);
    }

    const project = await projectResponse.json();

    // Add all environment variables to Vercel project after creation
    // This ensures they're properly saved even if project creation didn't accept them
    if (environmentVariables.length > 0) {
      try {
        for (const envVar of environmentVariables) {
          // Check if env var already exists
          const existingEnvResponse = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectName}/env/${envVar.key}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.vercelToken}`,
            },
          });

          if (existingEnvResponse.ok) {
            // Update existing env var
            const updateResponse = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectName}/env/${envVar.key}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${this.vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                value: envVar.value,
                target: envVar.target
              }),
            });
            
            if (updateResponse.ok) {
              this.logger.info('ProductionDeploymentService', `Updated ${envVar.key} in Vercel project`, {
                projectName: vercelProjectName
              });
            }
          } else {
            // Create new env var
            const createResponse = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectName}/env`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key: envVar.key,
                value: envVar.value,
                target: envVar.target,
                type: 'encrypted' // Encrypt sensitive values
              }),
            });

            if (createResponse.ok) {
              this.logger.info('ProductionDeploymentService', `Added ${envVar.key} to Vercel project`, {
                projectName: vercelProjectName
              });
            } else {
              const errorText = await createResponse.text();
              this.logger.warning('ProductionDeploymentService', `Failed to add ${envVar.key} to Vercel project`, {
                error: errorText
              });
            }
          }
        }
      } catch (error) {
        // Non-fatal: log but continue deployment
        this.logger.warning('ProductionDeploymentService', 'Failed to add environment variables to Vercel project', error as Error);
      }
    }

    // Trigger deployment
    // Vercel API requires repoId instead of repo name in gitSource
    const deploymentBody: any = {
      name: vercelProjectName, // Use sanitized name for Vercel
      gitSource: {
        type: 'github',
        repoId: repo.id, // Use repository ID (required by Vercel)
        ref: repo.defaultBranch,
      },
      projectSettings: {
        framework: config.framework === 'nextjs' ? 'nextjs' : 'vite',
        buildCommand,
        outputDirectory,
        ...(rootDirectory && { rootDirectory }), // Add rootDirectory for monorepo
      },
    };

    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deploymentBody),
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
   * Extract environment variables from .env.example files in project
   */
  private extractEnvironmentVariablesFromFiles(files: GeneratedFile[]): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    // Find .env.example or .env.sample files
    const envExampleFiles = files.filter(f => 
      f.path.includes('.env.example') || 
      f.path.includes('.env.sample') ||
      f.path.endsWith('.env.example') ||
      f.path.endsWith('.env.sample')
    );
    
    for (const file of envExampleFiles) {
      const lines = file.content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim().replace(/^["']|["']$/g, '');
            
            // Skip if it's a comment-only value or placeholder
            if (value && !value.startsWith('#')) {
              // Keep placeholder values as-is (they'll be replaced with actual values for database vars)
              envVars[key] = value;
            }
          }
        }
      }
    }
    
    return envVars;
  }

  /**
   * Get build command for framework
   * For Vite, we use vite build directly to avoid TypeScript strict checking
   * that might fail on unused imports in generated code
   * Supports monorepo structures where build needs to run in subdirectory
   */
  private getBuildCommand(framework: string, isMonorepo: boolean = false, rootDirectory?: string): string {
    const baseCommand = (() => {
      switch (framework) {
        case 'nextjs':
          return 'npm run build';
        case 'vite':
          // Use vite build directly - it handles TypeScript without strict unused checks
          return 'vite build';
        case 'react':
          return 'vite build';
        default:
          return 'vite build';
      }
    })();

    // For monorepo, run command in the root directory (client/)
    if (isMonorepo && rootDirectory) {
      return `cd ${rootDirectory} && ${baseCommand}`;
    }

    return baseCommand;
  }

  /**
   * Get output directory for framework
   * For monorepo, output directory is relative to rootDirectory (e.g., client/dist)
   */
  private getOutputDirectory(framework: string, isMonorepo: boolean = false, rootDirectory?: string): string {
    const baseDir = (() => {
      switch (framework) {
        case 'nextjs':
          return '.next';
        case 'vite':
          return 'dist';
        default:
          return 'dist';
      }
    })();

    // For monorepo, output is relative to rootDirectory
    if (isMonorepo && rootDirectory) {
      return `${rootDirectory}/${baseDir}`;
    }

    return baseDir;
  }

  /**
   * Update existing GitHub repository with new files
   */
  private async updateGitHubRepo(
    owner: string,
    repoName: string,
    files: GeneratedFile[]
  ): Promise<GitHubRepo> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured');
    }

    const { data: repo } = await this.octokit.repos.get({
      owner,
      repo: repoName,
    });

    const defaultBranch = repo.default_branch || 'main';

    // Update all files in a single commit using Git Tree API
    await this.commitFilesToRepo(
      owner,
      repoName,
      defaultBranch,
      files,
      `Update project: ${files.length} file${files.length > 1 ? 's' : ''} changed`
    );

    return {
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch || 'main',
      id: repo.id,
    };
  }

  /**
   * Trigger Vercel redeployment for existing project
   */
  private async triggerVercelRedeploy(
    repoId: number,
    branch: string,
    config: DeploymentConfig,
    files?: GeneratedFile[],
    userId?: string,
    projectId?: number
  ): Promise<{ url: string; deploymentId: string }> {
    if (!this.vercelToken) {
      throw new Error('Vercel token not configured');
    }

    // Detect monorepo structure
    const hasClientPackageJson = files?.some(f => f.path === 'client/package.json') || false;
    const isMonorepo = hasClientPackageJson;
    const rootDirectory = hasClientPackageJson ? 'client' : undefined;

    const projectName = this.sanitizeVercelProjectName(config.repoName);

    // Get build command and output directory (adjusted for monorepo if needed)
    const buildCommand = this.getBuildCommand(config.framework, isMonorepo, rootDirectory);
    const outputDirectory = this.getOutputDirectory(config.framework, isMonorepo, rootDirectory);

    // Extract environment variables from .env.example files in the project
    const extractedEnvVars = this.extractEnvironmentVariablesFromFiles(files || []);
    
    // Get database connection string if available
    let databaseEnvVars: Array<{ key: string; value: string; target: ('production' | 'preview' | 'development')[] }> = [];
    
    // Add extracted env vars first (excluding database vars which will be added with actual values)
    for (const [key, value] of Object.entries(extractedEnvVars)) {
      // Skip database-related vars as they'll be added with actual connection strings
      if (!key.includes('DATABASE') && !key.includes('MONGODB') && !key.includes('MYSQL')) {
        databaseEnvVars.push({
          key,
          value: value || '',
          target: ['production', 'preview', 'development']
        });
      }
    }
    
    if (userId && projectId) {
      try {
        const { databaseProvisioningService } = await import('./DatabaseProvisioningService');
        const connectionString = await databaseProvisioningService.getDatabaseConnection(userId, projectId);
        
        if (connectionString) {
          const { db } = await import('../../db');
          const { projectDatabases } = await import('../../db/schema-pg');
          const { eq } = await import('drizzle-orm');
          
          const [dbConfig] = await db.select()
            .from(projectDatabases)
            .where(eq(projectDatabases.projectId, projectId))
            .limit(1);

          if (dbConfig && dbConfig.status === 'active') {
            const dbType = dbConfig.databaseType;
            
            if (dbType === 'mongodb') {
              databaseEnvVars.push({
                key: 'MONGODB_URI',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
            } else if (dbType === 'postgresql') {
              databaseEnvVars.push({
                key: 'PROJECT_DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
              databaseEnvVars.push({
                key: 'DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
            } else if (dbType === 'mysql') {
              databaseEnvVars.push({
                key: 'DATABASE_URL',
                value: connectionString,
                target: ['production', 'preview', 'development']
              });
            }
          }
        }
      } catch (error) {
        this.logger.warning('ProductionDeploymentService', 'Failed to get database connection for redeploy', error as Error);
      }
    }

    // Add database environment variables to Vercel project if available
    if (databaseEnvVars.length > 0) {
      try {
        for (const envVar of databaseEnvVars) {
          // Check if env var already exists
          const existingEnvResponse = await fetch(`https://api.vercel.com/v10/projects/${projectName}/env/${envVar.key}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.vercelToken}`,
            },
          });

          if (existingEnvResponse.ok) {
            // Update existing env var
            const updateResponse = await fetch(`https://api.vercel.com/v10/projects/${projectName}/env/${envVar.key}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${this.vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                value: envVar.value,
                target: envVar.target
              }),
            });
            
            if (updateResponse.ok) {
              this.logger.info('ProductionDeploymentService', `Updated ${envVar.key} in Vercel project`, {
                projectName
              });
            }
          } else {
            // Create new env var
            const createResponse = await fetch(`https://api.vercel.com/v10/projects/${projectName}/env`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key: envVar.key,
                value: envVar.value,
                target: envVar.target,
                type: 'encrypted' // Encrypt sensitive values
              }),
            });

            if (createResponse.ok) {
              this.logger.info('ProductionDeploymentService', `Added ${envVar.key} to Vercel project`, {
                projectName
              });
            } else {
              const errorText = await createResponse.text();
              this.logger.warning('ProductionDeploymentService', `Failed to add ${envVar.key} to Vercel project`, {
                error: errorText
              });
            }
          }
        }
      } catch (error) {
        // Non-fatal: log but continue deployment
        this.logger.warning('ProductionDeploymentService', 'Failed to add database env vars to Vercel project', error as Error);
      }
    }

    const deploymentBody: any = {
      name: projectName,
      gitSource: {
        type: 'github',
        repoId: repoId,
        ref: branch,
      },
      projectSettings: {
        framework: config.framework === 'nextjs' ? 'nextjs' : 'vite',
        buildCommand,
        outputDirectory,
        ...(rootDirectory && { rootDirectory }), // Add rootDirectory for monorepo
      },
    };

    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deploymentBody),
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.text();
      throw new Error(`Failed to trigger Vercel redeployment: ${error}`);
    }

    const deployment = await deploymentResponse.json();

    return {
      url: `https://${deployment.url}`,
      deploymentId: deployment.uid,
    };
  }

  /**
   * Save deployment record to database
   */
  private async saveDeploymentRecord(
    deploymentId: string,
    repo: GitHubRepo,
    vercelDeployment: { url: string; deploymentId: string },
    userId: string,
    workspaceId?: number
  ): Promise<void> {
    try {
      if (workspaceId) {
        // Update workspace record with deployment info
        await db.update(workspaces)
          .set({
            githubUrl: repo.htmlUrl,
            vercelUrl: vercelDeployment.url,
            deploymentId: deploymentId,
            githubRepoId: repo.id,
            deploymentStatus: 'ready',
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));

        this.logger.info('ProductionDeploymentService', 'Deployment record updated in workspace', {
          workspaceId,
          deploymentId,
          githubUrl: repo.htmlUrl,
          vercelUrl: vercelDeployment.url,
        });
      } else {
        // Log deployment data (no workspace to update)
        this.logger.info('ProductionDeploymentService', 'Deployment record saved', {
          deploymentId,
          githubUrl: repo.htmlUrl,
          vercelUrl: vercelDeployment.url,
          userId,
        });
      }
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

  /**
   * Commit multiple files to GitHub repository in a single commit using Git Tree API
   * This prevents creating multiple commits (and thus multiple Vercel deployments)
   */
  private async commitFilesToRepo(
    owner: string,
    repo: string,
    branch: string,
    files: GeneratedFile[],
    commitMessage: string
  ): Promise<void> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured');
    }

    // Store octokit in local variable for TypeScript null safety
    const octokit = this.octokit;

    try {
      // Check if repository is empty (no branch exists)
      let isEmptyRepo = false;
      let latestCommitSha: string | null = null;
      let baseTreeSha: string | null = null;

      // Wait a bit after repository creation to let GitHub propagate
      // With auto_init: true, repository is ready much faster (usually 1-2 seconds)
      // But we still wait a bit to ensure consistency
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to get branch reference with retry logic for race conditions
      // GitHub sometimes returns 409 for empty repos due to eventual consistency
      let getRefRetries = 3; // Reduced retries since we wait before
      let persistent409 = false;
      
      while (getRefRetries > 0) {
        try {
          const { data: refData } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
          });
          latestCommitSha = refData.object.sha;
          
          // Get the tree associated with the latest commit
          const { data: commitData } = await octokit.git.getCommit({
            owner,
            repo,
            commit_sha: latestCommitSha,
          });
          baseTreeSha = commitData.tree.sha;
          // Repository is not empty
          isEmptyRepo = false;
          break; // Success
        } catch (error: any) {
          // Branch doesn't exist (empty repo)
          if (error.status === 404) {
            isEmptyRepo = true;
            this.logger.info('ProductionDeploymentService', 'Repository is empty (404), creating initial commit', {
              owner,
              repo,
              branch
            });
            break; // Empty repo is expected, continue
          } else if (error.status === 409) {
            // 409 at getRef can mean:
            // 1. Ref exists but GitHub is still initializing (eventual consistency)
            // 2. Ref doesn't exist yet but GitHub returns 409 instead of 404
            // We'll retry, but if it persists, treat as empty repo
            if (getRefRetries > 1) {
              const waitTime = (3 - getRefRetries) * 3000 + 3000; // Exponential backoff: 3s, 6s, 9s
              this.logger.warning('ProductionDeploymentService', `Ref conflict (409) during getRef, waiting ${waitTime}ms before retry`, {
                owner,
                repo,
                branch,
                retriesLeft: getRefRetries - 1
              });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              getRefRetries--;
              persistent409 = true;
            } else {
              // Last retry failed with 409 - likely means repository is empty
              // GitHub sometimes returns 409 for empty repos instead of 404
              this.logger.warning('ProductionDeploymentService', 'Persistent 409 on getRef after retries, treating as empty repository', {
                owner,
                repo,
                branch
              });
              isEmptyRepo = true;
              break;
            }
          } else {
            throw error;
          }
        }
      }
      
      // If we got persistent 409s, verify by trying to list commits
      if (persistent409 && isEmptyRepo) {
        try {
                  const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo,
            per_page: 1,
          });
          if (commits.length > 0) {
            // Repository actually has commits, so it's not empty
            this.logger.info('ProductionDeploymentService', 'Found commits via listCommits, repository is not empty', {
              owner,
              repo,
              branch,
              commitCount: commits.length
            });
            isEmptyRepo = false;
            latestCommitSha = commits[0].sha;
            const { data: commitData } = await octokit.git.getCommit({
              owner,
              repo,
              commit_sha: latestCommitSha,
            });
            baseTreeSha = commitData.tree.sha;
          }
        } catch (listError: any) {
          // If listing fails with 409 or 404, repository is definitely empty
          if (listError.status === 404 || listError.status === 409) {
            this.logger.info('ProductionDeploymentService', 'Confirmed repository is empty via listCommits', {
              owner,
              repo,
              branch
            });
            isEmptyRepo = true;
          } else {
            // Other error, log but continue with empty repo assumption
            this.logger.warning('ProductionDeploymentService', 'Error listing commits, assuming empty repository', {
              owner,
              repo,
              branch,
              error: listError.message
            });
          }
        }
      }

      // Create blobs for each file with retry logic for empty repositories
      // Create blobs sequentially instead of in parallel to avoid overwhelming GitHub API
      // and to better handle rate limits during repository initialization
      const treeItems: Array<{
        path: string;
        mode: '100644';
        type: 'blob';
        sha: string;
      }> = [];
      
      for (const file of files) {
        let blobRetries = 5; // Increased retries
        let blobCreated = false;
        
        while (blobRetries > 0 && !blobCreated) {
          try {
            const { data: blob } = await octokit.git.createBlob({
              owner,
              repo,
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64',
            });

            treeItems.push({
              path: file.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blob.sha,
            });
            blobCreated = true;
          } catch (error: any) {
            // If repository is still initializing, wait and retry
            if ((error.status === 409 || error.message?.includes('empty') || error.message?.includes('Git Repository is empty')) && blobRetries > 1) {
              const waitTime = (5 - blobRetries) * 3000 + 5000; // 5s, 8s, 11s, 14s, 17s
              this.logger.warning('ProductionDeploymentService', `Repository not ready for blob creation (${file.path}), waiting ${waitTime}ms before retry`, {
                owner,
                repo,
                file: file.path,
                retriesLeft: blobRetries - 1,
                error: error.message
              });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              blobRetries--;
            } else {
              // Last retry or different error
              throw new Error(`Failed to create blob for ${file.path} after ${5 - blobRetries} retries: ${error.message}`);
            }
          }
        }
        
        if (!blobCreated) {
          throw new Error(`Failed to create blob for ${file.path} after all retries`);
        }
      }

      // Create new tree with all files
      const treeOptions: any = {
        owner,
        repo,
        tree: treeItems,
      };
      
      // Only include base_tree if repository is not empty
      if (!isEmptyRepo && baseTreeSha) {
        treeOptions.base_tree = baseTreeSha; // Preserve existing files
      }

      const { data: newTree } = await octokit.git.createTree(treeOptions);

      // Create commit with all files
      const commitOptions: any = {
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
      };

      // For empty repos, create initial commit without parents
      // For existing repos, set parent to latest commit
      if (isEmptyRepo) {
        commitOptions.parents = [];
      } else if (latestCommitSha) {
        commitOptions.parents = [latestCommitSha];
      }

      const { data: newCommit } = await octokit.git.createCommit(commitOptions);

      // Update or create branch reference
      if (isEmptyRepo) {
        // Create branch reference for empty repo
        // Retry logic in case of race conditions
        let refRetries = 5;
        while (refRetries > 0) {
          try {
            await octokit.git.createRef({
              owner,
              repo,
              ref: `refs/heads/${branch}`,
              sha: newCommit.sha,
            });
            this.logger.info('ProductionDeploymentService', 'Created initial branch and commit', {
              owner,
              repo,
              branch,
              commitSha: newCommit.sha
            });
            break; // Success
          } catch (error: any) {
            // If ref already exists (409), try to update it instead
            if (error.status === 409) {
              this.logger.warning('ProductionDeploymentService', 'Ref already exists (409), trying to update instead', {
                owner,
                repo,
                branch,
                retriesLeft: refRetries - 1
              });
              try {
                // Ref already exists, update it
                await octokit.git.updateRef({
                  owner,
                  repo,
                  ref: `heads/${branch}`,
                  sha: newCommit.sha,
                  force: false,
                });
                this.logger.info('ProductionDeploymentService', 'Updated existing branch reference', {
                  owner,
                  repo,
                  branch,
                  commitSha: newCommit.sha
                });
                break; // Success
              } catch (updateError: any) {
                // If update also fails, wait and retry
                if (refRetries > 1) {
                  const waitTime = (5 - refRetries) * 3000 + 3000; // Exponential backoff: 3s, 6s, 9s, 12s
                  this.logger.warning('ProductionDeploymentService', `Update failed (status: ${updateError.status}), waiting ${waitTime}ms before retry`, {
                    owner,
                    repo,
                    branch,
                    retriesLeft: refRetries - 1,
                    errorStatus: updateError.status
                  });
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  refRetries--;
                } else {
                  // Last retry failed
                  throw updateError;
                }
              }
            } else if (error.status === 404 && refRetries > 1) {
              // Repo might not be fully ready yet, wait and retry
              const waitTime = (5 - refRetries) * 2000 + 2000; // Exponential backoff: 2s, 4s, 6s, 8s
              this.logger.warning('ProductionDeploymentService', `Repository not ready (404), waiting ${waitTime}ms before retry`, {
                owner,
                repo,
                branch,
                retriesLeft: refRetries - 1
              });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              refRetries--;
            } else {
              throw error;
            }
          }
        }
      } else {
        // Update existing branch reference
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.sha,
        });
      }

      this.logger.info('ProductionDeploymentService', `Committed ${files.length} files in single commit`, {
        owner,
        repo,
        branch,
        commitMessage,
      });
    } catch (error) {
      this.logger.error('ProductionDeploymentService', 'Failed to commit files to repository', error as Error);
      throw error;
    }
  }

  /**
   * Auto-fix common syntax errors in files before validation
   * This prevents deployment failures due to common syntax issues
   */
  private autoFixSyntaxErrors(files: GeneratedFile[]): GeneratedFile[] {
    return files.map(file => {
      let content = file.content;
      let wasFixed = false;

      // Fix common syntax errors that esbuild catches
      // These are the same fixes used in IncrementalOrchestrator.fixPhase
      
      // Fix {; patterns (most common)
      const beforeBraceSemicolon = content;
      content = content.replace(/\{\s*;/g, '{');
      content = content.replace(/\{\s*\n\s*;/g, '{\n');
      if (content !== beforeBraceSemicolon) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed {; patterns in ${file.path}`);
      }

      // Fix return (; patterns
      const beforeReturnParen = content;
      content = content.replace(/return\s*\(\s*;/g, 'return (');
      if (content !== beforeReturnParen) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed return (; pattern in ${file.path}`);
      }

      // Fix return {; patterns
      const beforeReturnBrace = content;
      content = content.replace(/return\s*\{\s*;/g, 'return {');
      if (content !== beforeReturnBrace) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed return {; pattern in ${file.path}`);
      }

      // Fix arrow function {; patterns
      const beforeArrow = content;
      content = content.replace(/\)\s*=>\s*\{\s*;/g, ') => {');
      if (content !== beforeArrow) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed arrow function {; pattern in ${file.path}`);
      }

      // Fix semicolons before closing parentheses
      const beforeParenSemicolon = content;
      content = content.replace(/\}\s*;\s*\)/g, '})');
      if (content !== beforeParenSemicolon) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed semicolon before closing parenthesis in ${file.path}`);
      }

      // Fix object literal semicolons: { key: value; } -> { key: value, }
      const beforeObjectLiteral = content;
      content = content.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^;]+);(\s*[},])/g, (match, keyValue, after) => {
        if (after.trim().startsWith('}')) {
          return keyValue + after;
        } else {
          return keyValue + ',' + after;
        }
      });
      if (content !== beforeObjectLiteral) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed object literal semicolons in ${file.path}`);
      }

      // Fix Expected ")" but found ";" - usually means semicolon where closing paren should be
      // Pattern: function(; or (; or something(;
      const beforeParenSemicolon2 = content;
      content = content.replace(/\(\s*;/g, '(');
      if (content !== beforeParenSemicolon2) {
        wasFixed = true;
        this.logger.info('ProductionDeploymentService', `Fixed (; pattern in ${file.path}`);
      }

      // NOTE: Export/import mismatches should be fixed at code generation time, not here
      // The system prompts have been updated to ensure correct exports from the start
      // This auto-fixer has been removed to encourage proper code generation

      if (wasFixed) {
        this.logger.info('ProductionDeploymentService', `Applied auto-fixes to ${file.path}`);
      }

      return {
        ...file,
        content
      };
    });
  }

  /**
   * Validate files before deployment to catch compilation errors
   * This prevents deploying broken code to production
   */
  private async validateFilesBeforeDeployment(
    files: GeneratedFile[]
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[]; fixedFiles?: GeneratedFile[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // STEP 1: Auto-fix common syntax errors before validation
    this.logger.info('ProductionDeploymentService', 'Applying auto-fixes to files before validation', {
      fileCount: files.length
    });
    const fixedFiles = this.autoFixSyntaxErrors(files);
    const hasFixes = fixedFiles.some((f, i) => f.content !== files[i].content);
    if (hasFixes) {
      this.logger.info('ProductionDeploymentService', 'Auto-fixes applied to files', {
        fixedFileCount: fixedFiles.filter((f, i) => f.content !== files[i].content).length
      });
    }

    // Create temporary directory for validation
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deployment-validation-'));
    
    try {
      // Write fixed files to temp directory (use fixed files for validation)
      for (const file of fixedFiles) {
        const filePath = path.join(tempDir, file.path);
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      }

      // Find TypeScript/React files (use fixed files)
      const tsFiles = fixedFiles.filter(f => 
        f.path.endsWith('.ts') || 
        f.path.endsWith('.tsx') || 
        f.path.endsWith('.js') || 
        f.path.endsWith('.jsx')
      );

      if (tsFiles.length === 0) {
        // No TypeScript files to validate
        return { valid: true, errors: [], warnings: [] };
      }

      // Check for required config files (use fixed files)
      // Support both single-package and monorepo structures
      const hasRootPackageJson = fixedFiles.some(f => f.path === 'package.json');
      const hasClientPackageJson = fixedFiles.some(f => f.path === 'client/package.json');
      const hasServerPackageJson = fixedFiles.some(f => f.path === 'server/package.json');
      const hasPackageJson = hasRootPackageJson || hasClientPackageJson || hasServerPackageJson;
      const hasTsConfig = fixedFiles.some(f => f.path === 'tsconfig.json' || f.path === 'client/tsconfig.json');

      if (!hasPackageJson) {
        errors.push('Missing package.json - required for deployment. Expected in root, client/, or server/ directory.');
      }

      // Try to validate TypeScript files with esbuild
      if (hasTsConfig || tsFiles.length > 0) {
        try {
          // Find entry point (usually src/main.tsx or src/App.tsx)
          const possibleEntryPoints = [
            path.join(tempDir, 'src/main.tsx'),
            path.join(tempDir, 'src/App.tsx'),
            path.join(tempDir, 'src/index.tsx'),
            path.join(tempDir, 'src/index.ts'),
          ];
          
          const entryPoints: string[] = [];
          for (const ep of possibleEntryPoints) {
            try {
              await fs.access(ep);
              entryPoints.push(ep);
            } catch {
              // File doesn't exist, skip
            }
          }

          if (entryPoints.length > 0) {
            // Try to build with esbuild to catch compilation errors
            // Use transform API instead of build API to avoid CSS import issues
            try {
              // Transform each TypeScript/React file individually to catch syntax errors
              for (const tsFile of tsFiles) {
                const filePath = path.join(tempDir, tsFile.path);
                const fileContent = tsFile.content;
                
                try {
                  // Use transform API which doesn't require CSS handling
                  await esbuild.transform(fileContent, {
                    loader: tsFile.path.endsWith('.tsx') ? 'tsx' : 'ts',
                    format: 'esm',
                    target: 'es2020',
                    jsx: 'automatic',
                  });
                } catch (transformError: any) {
                  // Extract meaningful error messages
                  if (transformError.errors && Array.isArray(transformError.errors)) {
                    transformError.errors.forEach((err: any) => {
                      const line = err.location?.line || 0;
                      const column = err.location?.column || 0;
                      const message = err.text || err.message || 'Unknown error';
                      
                      // Only report errors that are NOT about CSS imports
                      // CSS imports are handled by Vite and are not real errors
                      if (!message.includes('CSS') && !message.includes('output path')) {
                        errors.push(`${tsFile.path}:${line}:${column} - ${message}`);
                      }
                    });
                  } else {
                    const errorMsg = transformError.message || 'Unknown compilation error';
                    // Ignore CSS-related errors
                    if (!errorMsg.includes('CSS') && !errorMsg.includes('output path')) {
                      errors.push(`${tsFile.path} - ${errorMsg}`);
                    }
                  }
                }
              }
            } catch (validationError: any) {
              // If validation fails completely, log but don't block if it's a configuration issue
              warnings.push(`Could not validate with esbuild: ${validationError.message}`);
            }
          } else {
            warnings.push('No entry point found (src/main.tsx, src/App.tsx, etc.) - skipping build validation');
          }
        } catch (validationError: any) {
          // If esbuild validation fails, log but don't block if it's a configuration issue
          warnings.push(`Could not validate with esbuild: ${validationError.message}`);
        }
      }

      // Basic syntax validation for all files (use fixed files)
      for (const file of fixedFiles) {
        // Check for common syntax errors
        if (file.content.includes('{;')) {
          errors.push(`${file.path}: Contains syntax error '{;' (semicolon after opening brace)`);
        }
        if (file.content.includes('return (;')) {
          errors.push(`${file.path}: Contains syntax error 'return (;' (incomplete return statement)`);
        }
        if (file.content.includes('return {;')) {
          errors.push(`${file.path}: Contains syntax error 'return {;' (incomplete return statement)`);
        }

        // Validate JSON files
        if (file.path.endsWith('.json')) {
          try {
            JSON.parse(file.content);
          } catch (jsonError: any) {
            errors.push(`${file.path}: Invalid JSON - ${jsonError.message}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        fixedFiles: hasFixes ? fixedFiles : undefined, // Return fixed files if any fixes were applied
      };
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warning('ProductionDeploymentService', 'Failed to cleanup temp directory', cleanupError as Error);
      }
    }
  }
}

export const productionDeploymentService = new ProductionDeploymentService();