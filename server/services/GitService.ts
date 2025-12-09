import { execa } from 'execa';
import { SimpleLogger } from '../utils/SimpleLogger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Octokit } from '@octokit/rest';
import { db } from '../../db';
import { projectFiles, workspaces } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const logger = new SimpleLogger('GitService');

export interface GitStatus {
  branch: string;
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: number;
}

export interface GitDiff {
  file: string;
  changes: string;
  additions: number;
  deletions: number;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
  lastCommitMessage: string;
}

export class GitService {
  /**
   * Check if a directory is a Git repository
   */
  async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(projectPath, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Initialize a Git repository
   */
  async initRepository(projectPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout } = await execa('git', ['init'], { cwd: projectPath });
      return {
        success: true,
        message: `Git repository initialized: ${stdout}`
      };
    } catch (error) {
      logger.error('Failed to initialize Git repository', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Git status
   */
  async getStatus(projectPath: string): Promise<GitStatus> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return {
          branch: 'unknown',
          isClean: true,
          modifiedFiles: [],
          untrackedFiles: [],
          stagedFiles: []
        };
      }

      // Get current branch
      const { stdout: branch } = await execa('git', ['branch', '--show-current'], { cwd: projectPath });

      // Get status
      const { stdout: statusOutput } = await execa('git', ['status', '--porcelain'], { cwd: projectPath });
      
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];
      const stagedFiles: string[] = [];

      if (statusOutput) {
        const lines = statusOutput.trim().split('\n');
        for (const line of lines) {
          const status = line.substring(0, 2);
          const file = line.substring(3);

          if (status.startsWith('??')) {
            untrackedFiles.push(file);
          } else if (status.startsWith('A') || status.startsWith('M') && status[1] === ' ') {
            stagedFiles.push(file);
          } else if (status[1] === 'M' || status[1] === 'D') {
            modifiedFiles.push(file);
          }
        }
      }

      const isClean = modifiedFiles.length === 0 && untrackedFiles.length === 0 && stagedFiles.length === 0;

      return {
        branch: branch.trim() || 'unknown',
        isClean,
        modifiedFiles,
        untrackedFiles,
        stagedFiles
      };
    } catch (error) {
      logger.error('Failed to get Git status', error as Error);
      throw error;
    }
  }

  /**
   * Get Git diff
   */
  async getDiff(projectPath: string, filePath?: string): Promise<GitDiff[]> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return [];
      }

      const args = ['diff', '--numstat'];
      if (filePath) {
        args.push(filePath);
      }

      const { stdout: diffOutput } = await execa('git', args, { cwd: projectPath });

      if (!diffOutput) {
        return [];
      }

      const diffs: GitDiff[] = [];
      const lines = diffOutput.trim().split('\n');

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const file = parts[2];

          // Get actual diff content
          const { stdout: changes } = await execa('git', ['diff', file], { cwd: projectPath });

          diffs.push({
            file,
            changes: changes || '',
            additions,
            deletions
          });
        }
      }

      return diffs;
    } catch (error) {
      logger.error('Failed to get Git diff', error as Error);
      return [];
    }
  }

  /**
   * Get Git log
   */
  async getLog(projectPath: string, limit: number = 10): Promise<GitCommit[]> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return [];
      }

      const { stdout: logOutput } = await execa(
        'git',
        ['log', `-${limit}`, '--pretty=format:%H|%an|%ad|%s|%stat', '--date=iso'],
        { cwd: projectPath }
      );

      if (!logOutput) {
        return [];
      }

      const commits: GitCommit[] = [];
      const lines = logOutput.trim().split('\n');

      let currentCommit: Partial<GitCommit> | null = null;

      for (const line of lines) {
        if (line.includes('|')) {
          // New commit line
          if (currentCommit) {
            commits.push(currentCommit as GitCommit);
          }

          const parts = line.split('|');
          if (parts.length >= 4) {
            currentCommit = {
              hash: parts[0].substring(0, 7),
              author: parts[1],
              date: parts[2],
              message: parts[3],
              filesChanged: 0
            };
          }
        } else if (line.includes('files changed')) {
          // Stat line
          const match = line.match(/(\d+)\s+files? changed/);
          if (match && currentCommit) {
            currentCommit.filesChanged = parseInt(match[1]) || 0;
          }
        }
      }

      if (currentCommit) {
        commits.push(currentCommit as GitCommit);
      }

      return commits;
    } catch (error) {
      logger.error('Failed to get Git log', error as Error);
      return [];
    }
  }

  /**
   * Get Git branches
   */
  async getBranches(projectPath: string): Promise<GitBranch[]> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return [];
      }

      const { stdout: branchOutput } = await execa('git', ['branch', '-v'], { cwd: projectPath });

      if (!branchOutput) {
        return [];
      }

      const branches: GitBranch[] = [];
      const lines = branchOutput.trim().split('\n');

      // Get current branch
      const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'], { cwd: projectPath });
      const currentBranchName = currentBranch.trim();

      for (const line of lines) {
        const isCurrent = line.startsWith('*');
        const branchName = line.replace(/^\*\s*/, '').split(/\s+/)[0];
        const rest = line.substring(line.indexOf(branchName) + branchName.length).trim();
        
        // Extract commit hash and message
        const parts = rest.split(/\s+/);
        const lastCommit = parts[0] || '';
        const lastCommitMessage = parts.slice(1).join(' ') || '';

        branches.push({
          name: branchName,
          isCurrent: branchName === currentBranchName,
          lastCommit: lastCommit.substring(0, 7),
          lastCommitMessage
        });
      }

      return branches;
    } catch (error) {
      logger.error('Failed to get Git branches', error as Error);
      return [];
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(projectPath: string, branchName: string, fromBranch?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return {
          success: false,
          message: 'Not a Git repository. Initialize Git first.'
        };
      }

      const args = ['checkout', '-b', branchName];
      if (fromBranch) {
        args.push(fromBranch);
      }

      const { stdout } = await execa('git', args, { cwd: projectPath });
      return {
        success: true,
        message: `Branch "${branchName}" created: ${stdout}`
      };
    } catch (error) {
      logger.error('Failed to create branch', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(projectPath: string, branchName: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return {
          success: false,
          message: 'Not a Git repository. Initialize Git first.'
        };
      }

      const { stdout } = await execa('git', ['checkout', branchName], { cwd: projectPath });
      return {
        success: true,
        message: `Switched to branch "${branchName}": ${stdout}`
      };
    } catch (error) {
      logger.error('Failed to switch branch', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stage files
   */
  async stageFiles(projectPath: string, files: string[]): Promise<{ success: boolean; message: string }> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return {
          success: false,
          message: 'Not a Git repository. Initialize Git first.'
        };
      }

      const args = ['add', ...files];
      const { stdout } = await execa('git', args, { cwd: projectPath });
      return {
        success: true,
        message: `Staged ${files.length} file(s): ${stdout || 'Success'}`
      };
    } catch (error) {
      logger.error('Failed to stage files', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Commit changes
   */
  async commit(projectPath: string, message: string, files?: string[]): Promise<{ success: boolean; commitHash?: string; message: string }> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return {
          success: false,
          message: 'Not a Git repository. Initialize Git first.'
        };
      }

      // Stage files if provided
      if (files && files.length > 0) {
        await this.stageFiles(projectPath, files);
      } else {
        // Stage all changes
        await execa('git', ['add', '.'], { cwd: projectPath });
      }

      // Commit
      const { stdout: commitOutput } = await execa('git', ['commit', '-m', message], { cwd: projectPath });
      
      // Get commit hash
      const { stdout: commitHash } = await execa('git', ['rev-parse', 'HEAD'], { cwd: projectPath });

      return {
        success: true,
        commitHash: commitHash.trim().substring(0, 7),
        message: `Committed: ${message}`
      };
    } catch (error) {
      logger.error('Failed to commit', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get GitHub repository info from project
   */
  async getGitHubInfo(projectPath: string): Promise<{ owner?: string; repo?: string; url?: string } | null> {
    try {
      if (!(await this.isGitRepository(projectPath))) {
        return null;
      }

      const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: projectPath });
      
      if (!remoteUrl) {
        return null;
      }

      // Parse GitHub URL (supports both HTTPS and SSH)
      const match = remoteUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?$/);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace('.git', ''),
          url: remoteUrl.trim()
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get GitHub info from project database
   */
  async getGitHubInfoFromProject(projectId: number): Promise<{ owner?: string; repo?: string; url?: string } | null> {
    try {
      const [project] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, projectId))
        .limit(1);

      if (!project || !project.githubUrl) {
        return null;
      }

      // Parse GitHub URL
      const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          url: project.githubUrl
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get GitHub info from project', error as Error);
      return null;
    }
  }

  /**
   * Create temporary workspace for Git operations
   */
  async createTempWorkspace(projectId: number): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp-git-workspaces', `project-${projectId}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Get project files from database
    const files = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.isActive, true)
        )
      );

    // Write files to temp directory
    for (const file of files) {
      const filePath = path.join(tempDir, file.filePath);
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, file.fileContent || '');
    }

    return tempDir;
  }

  /**
   * Clean up temporary workspace
   */
  async cleanupTempWorkspace(workspacePath: string): Promise<void> {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to cleanup temp workspace', error as Error);
    }
  }
}

export const gitService = new GitService();

