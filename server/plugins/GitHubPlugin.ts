import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import Anthropic from '@anthropic-ai/sdk';
import {
  BaseProductivityPlugin,
  PluginCredentials,
  SyncOptions,
  SyncResult,
  Tool,
  KnowledgeItem,
  PluginMetadata
} from './BaseProductivityPlugin';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { pluginKnowledge, pluginSyncLogs } from '../../db/schema-pg';
import { eq, and, gte, desc } from 'drizzle-orm';

const logger = new SimpleLogger('GitHubPlugin');

/**
 * GitHub plugin for integrating code repositories into the AI Library
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Repository management (create, list, fork)
 * - Branch operations (create, list, switch)
 * - Commit and push generated code
 * - Pull request creation and management
 * - File operations (read, write, update)
 * - Code search across repositories
 * - Issue tracking
 * - Deployment integration
 */

interface UserGitHubState {
  octokit: Octokit;
  credentials: PluginCredentials;
  user: {
    login: string;
    name: string;
    email: string;
  };
}

interface FileToCommit {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

export class GitHubPlugin extends BaseProductivityPlugin {
  private anthropic: Anthropic;
  private userStates: Map<string, UserGitHubState> = new Map();

  constructor() {
    const metadata: PluginMetadata = {
      id: 'github',
      name: 'GitHub',
      version: '1.0.0',
      description: 'Integrate GitHub for repository management, code hosting, and collaborative development',
      author: 'AI Library Team',
      category: 'development',
      icon: '🐙',
      requiresAuth: true,
      authType: 'oauth2',
      capabilities: [
        'create_repositories',
        'manage_branches',
        'commit_code',
        'create_pull_requests',
        'manage_issues',
        'search_code',
        'deploy_generated_code',
        'fork_repositories'
      ],
      settings: {
        syncFrequency: 'hourly',
        maxReposPerSync: 50,
        trackIssues: true,
        trackPullRequests: true
      }
    };

    super(metadata);

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  public async initialize(userId: string): Promise<void> {
    try {
      this.userId = userId;
      this.updateStatus({ initialized: true });
      logger.info('GitHub plugin initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize GitHub plugin', error as Error, { userId });
      this.updateStatus({ initialized: false, health: 'error', healthMessage: 'Initialization failed' });
      throw error;
    }
  }

  public async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      this.userId = userId;
      this.credentials = credentials;

      // Create Octokit instance with user's OAuth token
      const octokit = new Octokit({
        auth: credentials.accessToken
      });

      // Test connection and get user info
      const { data: user } = await octokit.users.getAuthenticated();

      // Store per-user state
      this.userStates.set(userId, {
        octokit,
        credentials,
        user: {
          login: user.login,
          name: user.name || user.login,
          email: user.email || ''
        }
      });

      this.updateStatus({
        enabled: true,
        authenticated: true,
        health: 'healthy'
      });

      logger.info('GitHub plugin enabled', { userId, githubUser: user.login });
      this.emitInfo('GitHub plugin enabled successfully');
    } catch (error) {
      logger.error('Failed to enable GitHub plugin', error as Error, { userId });
      this.updateStatus({
        enabled: false,
        authenticated: false,
        health: 'error',
        healthMessage: 'Authentication failed'
      });
      throw error;
    }
  }

  public async disable(userId: string): Promise<void> {
    this.userStates.delete(userId);
    await super.disable(userId);
    logger.info('GitHub plugin disabled', { userId });
  }

  private async getUserOctokit(userId: string): Promise<Octokit> {
    let userState = this.userStates.get(userId);

    if (!userState) {
      logger.warn('GitHub state not found in cache, reloading from database', { userId });
      await this.reloadUserState(userId);
      userState = this.userStates.get(userId);

      if (!userState) {
        throw new Error(`GitHub not initialized for user ${userId}. Please reconnect your GitHub account.`);
      }
    }

    return userState.octokit;
  }

  private async reloadUserState(userId: string): Promise<void> {
    try {
      const { pluginRegistry } = await import('../services/PluginRegistry');
      await pluginRegistry.loadUserPlugins(userId);
      logger.info('GitHub state reloaded for user', { userId });
    } catch (error) {
      logger.error('Failed to reload GitHub state', error as Error, { userId });
      throw error;
    }
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = new Date();
    let itemsSynced = 0;
    const errors: string[] = [];

    try {
      this.updateStatus({ syncInProgress: true });
      this.emitSyncProgress({ phase: 'starting', message: 'Starting GitHub sync...' });

      const octokit = await this.getUserOctokit(userId);
      const userState = this.userStates.get(userId)!;

      // Sync repositories
      this.emitSyncProgress({ phase: 'syncing', message: 'Fetching repositories...' });
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 50
      });

      // Store repositories in knowledge base
      for (const repo of repos) {
        try {
          await db.insert(pluginKnowledge).values({
            userId,
            pluginId: this.metadata.id,
            type: 'repository',
            title: repo.full_name,
            content: repo.description || '',
            externalId: String(repo.id),
            metadata: {
              name: repo.name,
              full_name: repo.full_name,
              private: repo.private,
              html_url: repo.html_url,
              clone_url: repo.clone_url,
              language: repo.language,
              stargazers_count: repo.stargazers_count,
              default_branch: repo.default_branch,
              updated_at: repo.updated_at
            },
            relevanceScore: this.calculateRepoRelevance(repo),
            timestamp: new Date(repo.updated_at),
            createdAt: new Date()
          }).onConflictDoUpdate({
            target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
            set: {
              title: repo.full_name,
              content: repo.description || '',
              metadata: {
                name: repo.name,
                full_name: repo.full_name,
                private: repo.private,
                html_url: repo.html_url,
                clone_url: repo.clone_url,
                language: repo.language,
                stargazers_count: repo.stargazers_count,
                default_branch: repo.default_branch,
                updated_at: repo.updated_at
              },
              relevanceScore: this.calculateRepoRelevance(repo),
              timestamp: new Date(repo.updated_at)
            }
          });

          itemsSynced++;
        } catch (error) {
          logger.error('Failed to sync repository', error as Error, { userId, repo: repo.full_name });
          errors.push(`Failed to sync repository ${repo.full_name}`);
        }
      }

      // Sync recent pull requests
      if (this.metadata.settings?.trackPullRequests) {
        this.emitSyncProgress({ phase: 'syncing', message: 'Fetching pull requests...' });
        const { data: pullRequests } = await octokit.search.issuesAndPullRequests({
          q: `is:pr author:${userState.user.login} sort:updated-desc`,
          per_page: 30
        });

        for (const pr of pullRequests.items) {
          try {
            await db.insert(pluginKnowledge).values({
              userId,
              pluginId: this.metadata.id,
              type: 'pull_request',
              title: pr.title,
              content: pr.body || '',
              externalId: `pr-${pr.id}`,
              metadata: {
                number: pr.number,
                state: pr.state,
                html_url: pr.html_url,
                repository_url: pr.repository_url,
                created_at: pr.created_at,
                updated_at: pr.updated_at
              },
              relevanceScore: 0.7,
              timestamp: new Date(pr.updated_at),
              createdAt: new Date()
            }).onConflictDoUpdate({
              target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
              set: {
                title: pr.title,
                content: pr.body || '',
                metadata: {
                  number: pr.number,
                  state: pr.state,
                  html_url: pr.html_url,
                  repository_url: pr.repository_url,
                  created_at: pr.created_at,
                  updated_at: pr.updated_at
                }
              }
            });

            itemsSynced++;
          } catch (error) {
            logger.error('Failed to sync pull request', error as Error, { userId, pr: pr.number });
          }
        }
      }

      this.emitSyncProgress({ phase: 'completed', message: `Synced ${itemsSynced} items` });

      this.updateStatus({
        syncInProgress: false,
        health: errors.length > 0 ? 'warning' : 'healthy'
      });

      return {
        success: true,
        itemsSynced,
        lastSyncTime: startTime,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      logger.error('GitHub sync failed', error as Error, { userId });
      this.updateStatus({ syncInProgress: false, health: 'error' });
      throw error;
    }
  }

  private calculateRepoRelevance(repo: any): number {
    let score = 0.5;

    // Boost score for recently updated repos
    const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score += 0.3;
    else if (daysSinceUpdate < 30) score += 0.2;

    // Boost for popular repos
    if (repo.stargazers_count > 10) score += 0.1;
    if (repo.stargazers_count > 50) score += 0.1;

    // Boost for repos with relevant languages
    const relevantLanguages = ['TypeScript', 'JavaScript', 'React', 'Python'];
    if (relevantLanguages.includes(repo.language)) score += 0.2;

    return Math.min(1, score);
  }

  public getTools(): Tool[] {
    return [
      {
        name: 'list_repositories',
        description: 'List user\'s GitHub repositories',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Type of repos: all, owner, member',
              enum: ['all', 'owner', 'member']
            },
            sort: {
              type: 'string',
              description: 'Sort by: created, updated, pushed, full_name',
              enum: ['created', 'updated', 'pushed', 'full_name']
            },
            limit: {
              type: 'number',
              description: 'Maximum number of repos to return (default: 30)'
            }
          },
          required: []
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.listRepositories(this.userId, params.type || 'all', params.sort || 'updated', params.limit || 30);
        }
      },
      {
        name: 'create_repository',
        description: 'Create a new GitHub repository',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Repository name'
            },
            description: {
              type: 'string',
              description: 'Repository description'
            },
            private: {
              type: 'string',
              description: 'Whether the repository should be private (true/false)'
            },
            auto_init: {
              type: 'string',
              description: 'Create README automatically (true/false)'
            }
          },
          required: ['name']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.createRepository(
            this.userId,
            params.name,
            params.description,
            params.private === 'true',
            params.auto_init === 'true'
          );
        }
      },
      {
        name: 'create_branch',
        description: 'Create a new branch in a repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or org)'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            branch: {
              type: 'string',
              description: 'New branch name'
            },
            from_branch: {
              type: 'string',
              description: 'Base branch to create from (default: main)'
            }
          },
          required: ['owner', 'repo', 'branch']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.createBranch(
            this.userId,
            params.owner,
            params.repo,
            params.branch,
            params.from_branch || 'main'
          );
        }
      },
      {
        name: 'commit_files',
        description: 'Commit and push files to a repository (for deploying generated code)',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            branch: {
              type: 'string',
              description: 'Branch to commit to'
            },
            message: {
              type: 'string',
              description: 'Commit message'
            },
            files: {
              type: 'string',
              description: 'JSON array of files: [{path: "src/App.tsx", content: "..."}]'
            }
          },
          required: ['owner', 'repo', 'branch', 'message', 'files']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          const files = JSON.parse(params.files);
          return this.commitFiles(
            this.userId,
            params.owner,
            params.repo,
            params.branch,
            params.message,
            files
          );
        }
      },
      {
        name: 'create_pull_request',
        description: 'Create a pull request',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            title: {
              type: 'string',
              description: 'Pull request title'
            },
            body: {
              type: 'string',
              description: 'Pull request description'
            },
            head: {
              type: 'string',
              description: 'Branch with changes'
            },
            base: {
              type: 'string',
              description: 'Base branch (usually main)'
            }
          },
          required: ['owner', 'repo', 'title', 'head', 'base']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.createPullRequest(
            this.userId,
            params.owner,
            params.repo,
            params.title,
            params.body || '',
            params.head,
            params.base
          );
        }
      },
      {
        name: 'get_file_content',
        description: 'Get content of a file from a repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            path: {
              type: 'string',
              description: 'File path in repository'
            },
            branch: {
              type: 'string',
              description: 'Branch name (default: default branch)'
            }
          },
          required: ['owner', 'repo', 'path']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.getFileContent(
            this.userId,
            params.owner,
            params.repo,
            params.path,
            params.branch
          );
        }
      },
      {
        name: 'search_code',
        description: 'Search for code across repositories',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            language: {
              type: 'string',
              description: 'Filter by programming language'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)'
            }
          },
          required: ['query']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.searchCode(
            this.userId,
            params.query,
            params.language,
            params.limit || 10
          );
        }
      },
      {
        name: 'create_issue',
        description: 'Create an issue in a repository',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            title: {
              type: 'string',
              description: 'Issue title'
            },
            body: {
              type: 'string',
              description: 'Issue description'
            },
            labels: {
              type: 'string',
              description: 'Comma-separated labels'
            }
          },
          required: ['owner', 'repo', 'title']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.createIssue(
            this.userId,
            params.owner,
            params.repo,
            params.title,
            params.body || '',
            params.labels?.split(',')
          );
        }
      }
    ];
  }

  public async executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    switch (action) {
      case 'list_repositories':
        return this.listRepositories(userId, params.type, params.sort, params.limit);
      case 'create_repository':
        return this.createRepository(userId, params.name, params.description, params.private, params.auto_init);
      case 'create_branch':
        return this.createBranch(userId, params.owner, params.repo, params.branch, params.from_branch);
      case 'commit_files':
        const files = typeof params.files === 'string' ? JSON.parse(params.files) : params.files;
        return this.commitFiles(userId, params.owner, params.repo, params.branch, params.message, files);
      case 'create_pull_request':
        return this.createPullRequest(userId, params.owner, params.repo, params.title, params.body, params.head, params.base);
      case 'get_file_content':
        return this.getFileContent(userId, params.owner, params.repo, params.path, params.branch);
      case 'search_code':
        return this.searchCode(userId, params.query, params.language, params.limit);
      case 'create_issue':
        return this.createIssue(userId, params.owner, params.repo, params.title, params.body, params.labels);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async listRepositories(userId: string, type: string, sort: string, limit: number): Promise<any[]> {
    const octokit = await this.getUserOctokit(userId);

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      type: type as any,
      sort: sort as any,
      per_page: limit
    });

    return repos.map(repo => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at
    }));
  }

  private async createRepository(
    userId: string,
    name: string,
    description?: string,
    isPrivate?: boolean,
    autoInit?: boolean
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: autoInit
    });

    logger.info('Repository created', { userId, repo: repo.full_name });

    return {
      success: true,
      repository: {
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch
      }
    };
  }

  private async createBranch(
    userId: string,
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    // Get the SHA of the base branch
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`
    });

    // Create new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha
    });

    logger.info('Branch created', { userId, repo: `${owner}/${repo}`, branch: branchName });

    return {
      success: true,
      branch: branchName,
      sha: ref.object.sha
    };
  }

  private async commitFiles(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: FileToCommit[]
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    try {
      // Get the latest commit SHA on the branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });
      const latestCommitSha = refData.object.sha;

      // Get the tree associated with the latest commit
      const { data: commitData } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha
      });
      const treeSha = commitData.tree.sha;

      // Create blobs for each file
      const treeItems = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content: file.encoding === 'base64' ? file.content : Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha
          };
        })
      );

      // Create new tree
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: treeSha,
        tree: treeItems
      });

      // Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message,
        tree: newTree.sha,
        parents: [latestCommitSha]
      });

      // Update branch reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });

      logger.info('Files committed', {
        userId,
        repo: `${owner}/${repo}`,
        branch,
        filesCount: files.length,
        commitSha: newCommit.sha
      });

      return {
        success: true,
        commit: {
          sha: newCommit.sha,
          message: newCommit.message,
          url: newCommit.html_url
        },
        filesCommitted: files.length
      };
    } catch (error) {
      logger.error('Failed to commit files', error as Error, { userId, repo: `${owner}/${repo}` });
      throw error;
    }
  }

  private async createPullRequest(
    userId: string,
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base
    });

    logger.info('Pull request created', { userId, repo: `${owner}/${repo}`, pr: pr.number });

    return {
      success: true,
      pull_request: {
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        state: pr.state
      }
    };
  }

  private async getFileContent(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    const params: any = { owner, repo, path };
    if (branch) params.ref = branch;

    const { data } = await octokit.repos.getContent(params);

    if ('content' in data) {
      return {
        success: true,
        path: data.path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        sha: data.sha,
        size: data.size
      };
    }

    throw new Error('Path is a directory, not a file');
  }

  private async searchCode(
    userId: string,
    query: string,
    language?: string,
    limit: number = 10
  ): Promise<any[]> {
    const octokit = await this.getUserOctokit(userId);
    const userState = this.userStates.get(userId)!;

    let searchQuery = `${query} user:${userState.user.login}`;
    if (language) {
      searchQuery += ` language:${language}`;
    }

    const { data } = await octokit.search.code({
      q: searchQuery,
      per_page: limit
    });

    return data.items.map(item => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      html_url: item.html_url,
      score: item.score
    }));
  }

  private async createIssue(
    userId: string,
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<any> {
    const octokit = await this.getUserOctokit(userId);

    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels
    });

    logger.info('Issue created', { userId, repo: `${owner}/${repo}`, issue: issue.number });

    return {
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        state: issue.state
      }
    };
  }

  public async getKnowledgeItems(
    userId: string,
    filters?: {
      query?: string;
      type?: string;
      limit?: number;
    }
  ): Promise<KnowledgeItem[]> {
    try {
      let query = db
        .select()
        .from(pluginKnowledge)
        .where(
          and(
            eq(pluginKnowledge.userId, userId),
            eq(pluginKnowledge.pluginId, this.metadata.id)
          )
        )
        .orderBy(desc(pluginKnowledge.relevanceScore));

      if (filters?.type) {
        query = query.where(eq(pluginKnowledge.type, filters.type));
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const results = await query;

      return results.map(item => ({
        id: item.externalId,
        type: item.type as 'repository' | 'pull_request',
        title: item.title,
        content: item.content || '',
        metadata: item.metadata as Record<string, any>,
        relevanceScore: item.relevanceScore || 0.5,
        timestamp: item.timestamp,
        source: this.metadata.name
      }));
    } catch (error) {
      logger.error('Failed to get knowledge items', error as Error, { userId });
      return [];
    }
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      const octokit = await this.getUserOctokit(userId);
      await octokit.users.getAuthenticated();
      return true;
    } catch (error) {
      logger.error('GitHub credentials validation failed', error as Error, { userId });
      return false;
    }
  }

  public async cleanup(): Promise<void> {
    this.userStates.clear();
    await super.cleanup();
    logger.info('GitHub plugin cleaned up');
  }
}

export default GitHubPlugin;
