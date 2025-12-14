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

// Lazy import to avoid circular dependency
let _agentEventEmitter: any = null;
const getAgentEventEmitter = () => {
  if (!_agentEventEmitter) {
    const { agentEventEmitter } = require('../index');
    _agentEventEmitter = agentEventEmitter;
  }
  return _agentEventEmitter;
};

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
      category: 'productivity',
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
      logger.error(`Failed to initialize GitHub plugin for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
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
      logger.error(`Failed to enable GitHub plugin for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
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
      logger.error(`Failed to reload GitHub state for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = new Date();
    let itemsSynced = 0;
    const errors: string[] = [];

    try {
      this.updateStatus({ syncInProgress: true });
      this.emitSyncProgress({ current: 0, total: 100, message: 'Starting GitHub sync...' });

      const octokit = await this.getUserOctokit(userId);
      const userState = this.userStates.get(userId)!;

      // Sync repositories
      this.emitSyncProgress({ current: 10, total: 100, message: 'Fetching repositories...' });
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
            timestamp: new Date(repo.updated_at || Date.now())
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
              timestamp: new Date(repo.updated_at || Date.now())
            }
          });

          itemsSynced++;
        } catch (error) {
          logger.error(`Failed to sync repository ${repo.full_name} for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
          errors.push(`Failed to sync repository ${repo.full_name}`);
        }
      }

      // Sync recent pull requests
      if (this.metadata.settings?.trackPullRequests) {
        this.emitSyncProgress({ current: 50, total: 100, message: 'Fetching pull requests...' });
        // Use search.issuesAndPullRequests for pull requests
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
              timestamp: new Date(pr.updated_at || Date.now())
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
            logger.error(`Failed to sync pull request #${pr.number} for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
          }
        }
      }

      this.emitSyncProgress({ current: 100, total: 100, message: `Synced ${itemsSynced} items` });

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
      logger.error(`GitHub sync failed for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
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
      },
      {
        name: 'import_repository',
        description: 'Import an external GitHub repository into the playground workspace. This allows you to work on existing projects using Elon and Chap-ZPT.',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            branch: {
              type: 'string',
              description: 'Branch to import (default: default branch)'
            },
            projectName: {
              type: 'string',
              description: 'Name for the imported project in playground (default: repository name)'
            }
          },
          required: ['owner', 'repo']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('GitHub plugin not initialized with user ID');
          }
          return this.importRepository(
            this.userId,
            params.owner,
            params.repo,
            params.branch,
            params.projectName
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
      case 'import_repository':
        return this.importRepository(userId, params.owner, params.repo, params.branch, params.projectName);
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
      logger.error(`Failed to commit files to ${owner}/${repo} for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
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
    prompt: string,
    filters?: Record<string, any>
  ): Promise<KnowledgeItem[]> {
    try {
      const conditions = [
        eq(pluginKnowledge.userId, userId),
        eq(pluginKnowledge.pluginId, this.metadata.id)
      ];

      if (filters?.type) {
        conditions.push(eq(pluginKnowledge.type, filters.type));
      }

      const baseQuery = db
        .select()
        .from(pluginKnowledge)
        .where(and(...conditions))
        .orderBy(desc(pluginKnowledge.relevanceScore));

      const results = filters?.limit 
        ? await baseQuery.limit(filters.limit)
        : await baseQuery;

      // Map GitHub-specific types to KnowledgeItem types
      return results.map(item => ({
        id: item.externalId,
        type: this.mapGitHubTypeToKnowledgeType(item.type),
        title: item.title,
        content: item.content || '',
        metadata: item.metadata as Record<string, any>,
        relevanceScore: item.relevanceScore || 0.5,
        timestamp: item.timestamp,
        source: this.metadata.name
      }));
    } catch (error) {
      logger.error(`Failed to get knowledge items for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  private mapGitHubTypeToKnowledgeType(githubType: string): 'email' | 'calendar_event' | 'task' | 'document' | 'contact' | 'note' {
    // Map GitHub types to KnowledgeItem types
    if (githubType === 'repository') return 'document';
    if (githubType === 'pull_request') return 'task';
    return 'note'; // Default fallback
  }

  /**
   * Import a GitHub repository into playground workspace
   */
  private async importRepository(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
    projectName?: string
  ): Promise<any> {
    try {
      const octokit = await this.getUserOctokit(userId);

      // Get repository info
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      const defaultBranch = branch || repoData.default_branch || 'main';

      // Get all files from repository recursively
      const files = await this.getAllFilesFromRepo(octokit, owner, repo, defaultBranch);

      // Detect language and framework
      const detection = this.detectLanguageAndFramework(files);

      // Create project in playground
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      const project = await projectService.createProject({
        name: projectName || repoData.name,
        description: repoData.description || `Imported from ${owner}/${repo}`,
        projectType: this.mapLanguageToProjectType(detection.language),
        ownerId: userId,
        settings: {
          importedFrom: {
            owner,
            repo,
            branch: defaultBranch,
            url: repoData.html_url
          },
          detectedLanguage: detection.language,
          detectedFramework: detection.framework,
          recommendedAgents: detection.recommendedAgents
        }
      });

      // Import all files
      let importedCount = 0;
      for (const file of files) {
        try {
          await projectService.createProjectFile(
            project.id,
            file.path,
            file.content,
            userId
          );
          importedCount++;
        } catch (error) {
          logger.error(`Failed to import file ${file.path} for project ${project.id} (user ${userId})`, error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Extract and analyze README.md if present
      const readmeFile = files.find(f => 
        f.path.toLowerCase() === 'readme.md' || 
        f.path.toLowerCase() === 'readme' ||
        f.path.toLowerCase().endsWith('/readme.md')
      );
      
      let readmeAnalysis: {
        environmentVariables?: string[];
        installationSteps?: string[];
        dependencies?: string[];
        databaseInfo?: string;
        setupInstructions?: string;
      } | null = null;

      if (readmeFile) {
        try {
          readmeAnalysis = await this.analyzeReadme(readmeFile.content);
          if (readmeAnalysis) {
            logger.info('Analyzed README.md for setup information', {
              projectId: project.id,
              foundEnvVars: readmeAnalysis.environmentVariables?.length || 0,
              foundInstallSteps: readmeAnalysis.installationSteps?.length || 0
            });
          }
        } catch (error) {
          logger.warn('Failed to analyze README.md', error as Error);
        }
      }

      // Detect database requirements (enhanced with README analysis)
      const { databaseSetupService } = await import('../services/DatabaseSetupService');
      const databaseInfo = await databaseSetupService.detectDatabaseRequirements(files, readmeAnalysis);

      // Try to automatically provision database if needed
      let databaseProvisioned = false;
      let databaseConnectionString: string | null = null;
      let provisioningError: string | null = null;
      let missingApiKeys: string[] = [];

      if (databaseInfo.needsDatabase && databaseInfo.recommendedSetup) {
        try {
          const { databaseProvisioningService } = await import('../services/DatabaseProvisioningService');
          
          // Check for API keys BEFORE attempting to provision
          const apiKeyCheck = databaseProvisioningService.checkRequiredAPIKeys(
            databaseInfo.recommendedSetup.type as 'mongodb' | 'postgresql' | 'mysql'
          );
          
          if (!apiKeyCheck.hasAllKeys) {
            // Missing API keys - emit event and return early
            missingApiKeys = apiKeyCheck.missingKeys;
            provisioningError = `Missing required API keys: ${apiKeyCheck.missingKeys.join(', ')}`;
            
            logger.info('API keys missing for database provisioning', {
              projectId: project.id,
              databaseType: databaseInfo.recommendedSetup.type,
              missingKeys: missingApiKeys
            });
            
            // Emit API_KEY_REQUIRED event immediately
            try {
              const emitter = getAgentEventEmitter();
              emitter.emit('agent-event', {
                type: 'API_KEY_REQUIRED',
                missingApiKeys,
                databaseType: databaseInfo.recommendedSetup.type,
                projectId: project.id,
                userId,
                message: `API keys required for automatic ${databaseInfo.recommendedSetup.type} database provisioning. The import process is paused until credentials are provided.`
              });
              logger.info('Sent API_KEY_REQUIRED event (before provisioning attempt)', {
                userId,
                projectId: project.id,
                missingApiKeys,
                databaseType: databaseInfo.recommendedSetup.type
              });
            } catch (error) {
              logger.warn('Failed to send API_KEY_REQUIRED event', error as Error);
            }
            
            // Don't attempt provisioning - return early
            // The import will complete but indicate credentials are needed
          } else {
            // API keys are available - proceed with provisioning
            const provisioningResult = await databaseProvisioningService.provisionDatabase(
              userId,
              project.id,
              databaseInfo.recommendedSetup.type as 'mongodb' | 'postgresql' | 'mysql',
              project.name
            );

            if (provisioningResult.success && provisioningResult.connectionString) {
              databaseProvisioned = true;
              databaseConnectionString = provisioningResult.connectionString;
              logger.info('Database automatically provisioned', {
                projectId: project.id,
                provider: provisioningResult.provider,
                databaseType: databaseInfo.recommendedSetup.type
              });
            } else {
              provisioningError = provisioningResult.error || 'Unknown error';
              logger.warn('Database provisioning failed', {
                projectId: project.id,
                error: provisioningError,
                provider: provisioningResult.provider
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to auto-provision database, will use manual setup', error as Error);
          provisioningError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Generate .env.example if database is needed
      if (databaseInfo.needsDatabase) {
        let envExampleContent = databaseSetupService.generateEnvExample(
          databaseInfo,
          project.name
        );

        // If database was auto-provisioned, update .env.example with actual connection string
        if (databaseProvisioned && databaseConnectionString) {
          if (databaseInfo.recommendedSetup?.type === 'mongodb') {
            envExampleContent = envExampleContent.replace(
              'MONGODB_URI=mongodb://localhost:27017/your-database-name',
              `MONGODB_URI=${databaseConnectionString}`
            );
          } else if (databaseInfo.recommendedSetup?.type === 'postgresql') {
            // Use PROJECT_DATABASE_URL to avoid conflict with platform's DATABASE_URL
            envExampleContent = envExampleContent.replace(
              'PROJECT_DATABASE_URL=postgresql://user:password@localhost:5432/your-database-name',
              `PROJECT_DATABASE_URL=${databaseConnectionString}`
            );
          }
        }
        
        // Check if .env.example already exists
        const envExampleExists = files.some(f => 
          f.path.includes('.env.example') || f.path.includes('.env.sample')
        );

        if (!envExampleExists && envExampleContent) {
          try {
            await projectService.createProjectFile(
              project.id,
              '.env.example',
              envExampleContent,
              userId
            );
            importedCount++;
            logger.info('Generated .env.example for database setup', {
              projectId: project.id,
              databaseType: databaseInfo.recommendedSetup?.type,
              autoProvisioned: databaseProvisioned
            });
          } catch (error) {
            logger.warn('Failed to create .env.example', error as Error);
          }
        }
      }

      // Generate warning message (enhanced with README analysis)
      const warning = this.generateAgentWarning(
        detection, 
        databaseInfo, 
        databaseProvisioned,
        provisioningError,
        missingApiKeys
      );

      // Send API_KEY_REQUIRED event if API keys are missing
      if (missingApiKeys.length > 0 && databaseInfo.needsDatabase && databaseInfo.recommendedSetup) {
        try {
          const emitter = getAgentEventEmitter();
          emitter.emit('agent-event', {
            type: 'API_KEY_REQUIRED',
            missingApiKeys,
            databaseType: databaseInfo.recommendedSetup.type,
            projectId: project.id,
            userId,
            message: `API keys required for automatic ${databaseInfo.recommendedSetup.type} database provisioning`
          });
          logger.info('Sent API_KEY_REQUIRED event', {
            userId,
            projectId: project.id,
            missingApiKeys,
            databaseType: databaseInfo.recommendedSetup.type
          });
        } catch (error) {
          logger.warn('Failed to send API_KEY_REQUIRED event', error as Error);
        }
      }

      logger.info('Repository imported', {
        userId,
        owner,
        repo,
        projectId: project.id,
        filesImported: importedCount
      });

      return {
        success: true,
        workspaceId: project.id,
        workspaceName: project.name,
        filesImported: importedCount,
        totalFiles: files.length,
        detectedLanguage: detection.language,
        detectedFramework: detection.framework,
        recommendedAgents: detection.recommendedAgents,
        warning,
        databaseInfo: databaseInfo.needsDatabase ? {
          needsDatabase: true,
          databaseType: databaseInfo.recommendedSetup?.type,
          setupInstructions: databaseSetupService.generateSetupInstructions(databaseInfo),
          envExampleGenerated: databaseInfo.needsDatabase && !files.some(f => 
            f.path.includes('.env.example') || f.path.includes('.env.sample')
          ),
          databaseProvisioned,
          provisioningError,
          missingApiKeys: missingApiKeys.length > 0 ? missingApiKeys : undefined,
          credentialsRequired: missingApiKeys.length > 0
        } : {
          needsDatabase: false
        },
        repository: {
          owner,
          repo,
          branch: defaultBranch,
          url: repoData.html_url
        }
      };
    } catch (error) {
      logger.error(`Failed to import repository ${owner}/${repo} for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Recursively get all files from a repository
   */
  private async getAllFilesFromRepo(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    path: string = ''
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: path || '',
        ref: branch
      });

      if (Array.isArray(data)) {
        // Directory
        for (const item of data) {
          if (item.type === 'file' && item.size && item.size < 1024 * 100) { // Skip files > 100KB
            try {
              const fileContent = await octokit.repos.getContent({
                owner,
                repo,
                path: item.path,
                ref: branch
              });

              if ('content' in fileContent.data) {
                const ext = item.path.split('.').pop()?.toLowerCase() || '';
                const isBinaryFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'pdf', 'zip', 'tar', 'gz'].includes(ext);
                
                if (isBinaryFile) {
                  // For binary files, keep as base64 data URI
                  // Note: GitHub API returns base64 encoded content
                  files.push({
                    path: item.path,
                    content: `data:image/${ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext};base64,${fileContent.data.content}`
                  });
                } else {
                  // For text files, decode to UTF-8
                  files.push({
                    path: item.path,
                    content: Buffer.from(fileContent.data.content, 'base64').toString('utf-8')
                  });
                }
              }
            } catch (error) {
              logger.warn('Failed to get file content', { path: item.path });
            }
          } else if (item.type === 'dir') {
            // Recursively get files from subdirectory
            const subFiles = await this.getAllFilesFromRepo(octokit, owner, repo, branch, item.path);
            files.push(...subFiles);
          }
        }
      } else if (data.type === 'file' && 'content' in data) {
        // Single file
        const ext = data.path.split('.').pop()?.toLowerCase() || '';
        const isBinaryFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'pdf', 'zip', 'tar', 'gz'].includes(ext);
        
        if (isBinaryFile) {
          // For binary files, keep as base64 data URI
          files.push({
            path: data.path,
            content: `data:image/${ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext};base64,${data.content}`
          });
        } else {
          // For text files, decode to UTF-8
          files.push({
            path: data.path,
            content: Buffer.from(data.content, 'base64').toString('utf-8')
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to get repository content from ${owner}/${repo} at path ${path}`, error instanceof Error ? error : new Error(String(error)));
    }

    return files;
  }

  /**
   * Detect language and framework from files
   */
  private detectLanguageAndFramework(files: Array<{ path: string; content: string }>): {
    language: string;
    framework: string | null;
    recommendedAgents: string[];
  } {
    const languageCounts: Record<string, number> = {};
    const frameworkIndicators: Record<string, number> = {};

    for (const file of files) {
      const ext = file.path.split('.').pop()?.toLowerCase() || '';
      
      // Count languages by extension
      if (ext === 'py') languageCounts['Python'] = (languageCounts['Python'] || 0) + 1;
      else if (ext === 'js' || ext === 'jsx') languageCounts['JavaScript'] = (languageCounts['JavaScript'] || 0) + 1;
      else if (ext === 'ts' || ext === 'tsx') languageCounts['TypeScript'] = (languageCounts['TypeScript'] || 0) + 1;
      else if (ext === 'java') languageCounts['Java'] = (languageCounts['Java'] || 0) + 1;
      else if (ext === 'go') languageCounts['Go'] = (languageCounts['Go'] || 0) + 1;
      else if (ext === 'rs') languageCounts['Rust'] = (languageCounts['Rust'] || 0) + 1;
      else if (ext === 'php') languageCounts['PHP'] = (languageCounts['PHP'] || 0) + 1;
      else if (ext === 'rb') languageCounts['Ruby'] = (languageCounts['Ruby'] || 0) + 1;

      // Detect frameworks
      if (file.path.includes('package.json')) {
        const content = file.content.toLowerCase();
        if (content.includes('react')) frameworkIndicators['React'] = (frameworkIndicators['React'] || 0) + 1;
        if (content.includes('vue')) frameworkIndicators['Vue'] = (frameworkIndicators['Vue'] || 0) + 1;
        if (content.includes('angular')) frameworkIndicators['Angular'] = (frameworkIndicators['Angular'] || 0) + 1;
        if (content.includes('next')) frameworkIndicators['Next.js'] = (frameworkIndicators['Next.js'] || 0) + 1;
        if (content.includes('express')) frameworkIndicators['Express'] = (frameworkIndicators['Express'] || 0) + 1;
      }
      if (file.path.includes('requirements.txt') || file.path.includes('setup.py')) {
        frameworkIndicators['Python'] = (frameworkIndicators['Python'] || 0) + 1;
      }
      if (file.path.includes('pom.xml') || file.path.includes('build.gradle')) {
        frameworkIndicators['Java'] = (frameworkIndicators['Java'] || 0) + 1;
      }
    }

    // Determine primary language
    const primaryLanguage = Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';

    // Determine framework
    const primaryFramework = Object.entries(frameworkIndicators)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // Recommend agents based on language/framework
    const recommendedAgents: string[] = [];
    if (primaryLanguage === 'Python') {
      recommendedAgents.push('Python Expert');
    } else if (primaryLanguage === 'JavaScript' || primaryLanguage === 'TypeScript') {
      if (primaryFramework === 'React') {
        recommendedAgents.push('React Developer', 'Component Developer');
      } else if (primaryFramework === 'Next.js') {
        recommendedAgents.push('Next.js Expert', 'React Developer');
      } else {
        recommendedAgents.push('JavaScript Expert', 'Component Developer');
      }
    } else if (primaryLanguage === 'Java') {
      recommendedAgents.push('Java Expert');
    } else if (primaryLanguage === 'Go') {
      recommendedAgents.push('Go Expert');
    } else if (primaryLanguage === 'Rust') {
      recommendedAgents.push('Rust Expert');
    }

    return {
      language: primaryLanguage,
      framework: primaryFramework,
      recommendedAgents
    };
  }

  /**
   * Map detected language to project type
   */
  private mapLanguageToProjectType(language: string): 'web_app' | 'mobile_app' | 'api' | 'desktop_app' {
    if (language === 'Python' || language === 'Java' || language === 'Go') {
      return 'api';
    } else if (language === 'JavaScript' || language === 'TypeScript') {
      return 'web_app';
    }
    return 'web_app'; // Default
  }

  /**
   * Generate warning message about using correct agents and database setup
   */
  private generateAgentWarning(
    detection: {
      language: string;
      framework: string | null;
      recommendedAgents: string[];
    },
    databaseInfo?: any,
    databaseProvisioned?: boolean,
    provisioningError?: string | null,
    missingApiKeys?: string[]
  ): string {
    const warnings: string[] = [];

    // Agent warning
    if (detection.recommendedAgents.length === 0) {
      warnings.push(`⚠️ **Agent:** Detta projekt verkar vara skrivet i ${detection.language}. Se till att använda en agent som är specialiserad på ${detection.language} för bästa resultat.`);
    } else {
      const frameworkText = detection.framework ? ` (${detection.framework})` : '';
      warnings.push(`⚠️ **Agent:** Detta projekt är skrivet i ${detection.language}${frameworkText}. 

För bästa resultat, använd en av dessa agenter:
- ${detection.recommendedAgents.join('\n- ')}

Användning av fel agent kan leda till dåliga resultat eller fel.`);
    }

    // Database warning
    if (databaseInfo?.needsDatabase && databaseInfo.recommendedSetup) {
      const dbType = databaseInfo.recommendedSetup.type.toUpperCase();
      
      if (databaseProvisioned) {
        warnings.push(`\n✅ **Databas:** En ${dbType} databas har automatiskt skapats och konfigurerats för detta projekt! 

Databasen är redan klar att använda - ingen manuell konfiguration behövs.

**Nästa steg:**
1. Kör eventuella migrations-skript som ingår i projektet för att skapa tabeller/scheman
2. Databas-anslutningssträngen finns redan i \`.env.example\` - kopiera den till \`.env\` om du vill köra lokalt
3. För production, använd samma connection string i dina deployment-miljövariabler

Databasen är hostad på ${databaseInfo.recommendedSetup.type === 'postgresql' ? 'Supabase/Neon' : databaseInfo.recommendedSetup.type === 'mongodb' ? 'MongoDB Atlas' : 'Cloud'} och är redo att användas!`);
      } else {
        // Check if we can provide automatic provisioning with API keys
        const canAutoProvision = missingApiKeys && missingApiKeys.length > 0;
        
        warnings.push(`\n📊 **Databas:** Detta projekt kräver en ${dbType} databas.`);

        if (canAutoProvision) {
          // Provide API key setup instructions
          if (databaseInfo.recommendedSetup.type === 'mongodb') {
            warnings.push(`\n🔑 **Automatisk Databas-Setup Tillgänglig!**

Jag kan automatiskt skapa en MongoDB Atlas databas åt dig, men först behöver vi konfigurera API-nycklar.

**Så här gör du:**

1. **Skapa MongoDB Atlas Account:**
   - Gå till: https://www.mongodb.com/cloud/atlas/register
   - Skapa ett konto (gratis tier finns)

2. **Skapa API Key:**
   - Gå till: https://cloud.mongodb.com → Project Settings → Access Manager → API Keys
   - Klicka "Create API Key"
   - Välj "Project Owner" som roll
   - Spara **Public Key** och **Private Key**

3. **Hämta Project ID:**
   - Gå till: https://cloud.mongodb.com → Project Settings → General
   - Kopiera **Project ID**

4. **Konfigurera i Plattformen:**
   - Kontakta support eller administratör för att lägga till dessa environment variables:
     - \`MONGODB_ATLAS_API_KEY\` = Din Public Key
     - \`MONGODB_ATLAS_PROJECT_ID\` = Ditt Project ID

5. **Efter konfiguration:**
   - Be mig importera projektet igen, så skapar jag automatiskt databasen åt dig!

**Alternativ: Manuell Setup**
Om du föredrar att sätta upp databasen manuellt, se instruktioner nedan.`);
          } else if (databaseInfo.recommendedSetup.type === 'postgresql') {
            warnings.push(`\n🔑 **Automatisk Databas-Setup Tillgänglig!**

Jag kan automatiskt skapa en PostgreSQL databas åt dig via Supabase eller Neon, men först behöver vi konfigurera API-nycklar.

**Option 1: Supabase (Rekommenderat)**
1. **Skapa Supabase Account:**
   - Gå till: https://supabase.com/dashboard/sign-up
   - Skapa ett nytt projekt

2. **Hämta API-nycklar:**
   - Gå till: Project Settings → API
   - Kopiera: \`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`
   - Gå till: Project Settings → Database
   - Kopiera: \`SUPABASE_DB_PASSWORD\`

3. **Konfigurera i Plattformen:**
   - Kontakta support eller administratör för att lägga till dessa environment variables

**Option 2: Neon (Serverless)**
1. **Skapa Neon Account:**
   - Gå till: https://neon.tech/signup
   - Skapa ett nytt projekt

2. **Hämta API-nycklar:**
   - Gå till: Settings → API Keys
   - Skapa ny API key
   - Kopiera: \`NEON_API_KEY\` och \`NEON_PROJECT_ID\`

3. **Konfigurera i Plattformen:**
   - Kontakta support eller administratör för att lägga till dessa environment variables

**Efter konfiguration:**
- Be mig importera projektet igen, så skapar jag automatiskt databasen åt dig!

**Alternativ: Manuell Setup**
Om du föredrar att sätta upp databasen manuellt, se instruktioner nedan.`);
          }
        }

        warnings.push(`\n**Manuell Setup:**
${databaseInfo.recommendedSetup.setupInstructions || ''}`);
      }
    }

    return warnings.join('\n\n');
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      const octokit = await this.getUserOctokit(userId);
      await octokit.users.getAuthenticated();
      return true;
    } catch (error) {
      logger.error(`GitHub credentials validation failed for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Analyze README content to extract setup information
   */
  private async analyzeReadme(content: string): Promise<{
    environmentVariables?: string[];
    installationSteps?: string[];
    dependencies?: string[];
    databaseInfo?: string;
    setupInstructions?: string;
  } | null> {
    try {
      // Simple regex-based extraction
      const envVars: string[] = [];
      const envVarRegex = /(?:export\s+|ENV\s+|\.env\s*[=:]\s*)([A-Z_][A-Z0-9_]*)/gi;
      const matches = content.matchAll(envVarRegex);
      for (const match of matches) {
        if (match[1] && !envVars.includes(match[1])) {
          envVars.push(match[1]);
        }
      }

      const installSteps: string[] = [];
      const installRegex = /(?:npm\s+install|yarn\s+install|pip\s+install|bundle\s+install)/gi;
      if (installRegex.test(content)) {
        installSteps.push('Install dependencies');
      }

      return {
        environmentVariables: envVars.length > 0 ? envVars : undefined,
        installationSteps: installSteps.length > 0 ? installSteps : undefined
      };
    } catch (error) {
      logger.warn('Failed to analyze README', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  public async cleanup(): Promise<void> {
    this.userStates.clear();
    await super.cleanup();
    logger.info('GitHub plugin cleaned up');
  }
}

export default GitHubPlugin;
