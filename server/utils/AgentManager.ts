import path from 'path';
import { promises as fs } from 'fs';
import { db } from '../../db';
import { agents } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { AgentVersionControl } from './AgentVersionControl';
import { Logger } from './Logger';

interface DirectoryStructure {
  workspaces: string;
  agents: string;
  templates: string;
  shared: string;
  logs: string;
}

export class AgentManager {
  private baseDir: string;
  private structure: DirectoryStructure;
  private activeAgents: Map<number, boolean>;
  private versionControl: AgentVersionControl;
  private logger: Logger;

  constructor(baseDirectory: string) {
    this.baseDir = baseDirectory;
    this.structure = {
      workspaces: path.join(this.baseDir, 'workspaces'),
      agents: path.join(this.baseDir, 'agents'),
      templates: path.join(this.baseDir, 'templates'),
      shared: path.join(this.baseDir, 'shared'),
      logs: path.join(this.baseDir, 'logs')
    };
    this.activeAgents = new Map();
    this.versionControl = new AgentVersionControl(baseDirectory);
    this.logger = new Logger(baseDirectory);
  }

  /**
   * Initialize the directory structure for agent management
   */
  async initialize(): Promise<void> {
    try {
      // Create main directories if they don't exist
      await Promise.all(
        Object.values(this.structure).map(dir => 
          fs.mkdir(dir, { recursive: true })
        )
      );

      // Create necessary subdirectories
      const subdirs = {
        configs: path.join(this.structure.agents, 'configs'),
        state: path.join(this.structure.agents, 'state'),
        backups: path.join(this.structure.agents, 'backups'),
        communication: path.join(this.structure.shared, 'communication'),
        resources: path.join(this.structure.shared, 'resources')
      };

      await Promise.all(
        Object.values(subdirs).map(dir => 
          fs.mkdir(dir, { recursive: true })
        )
      );

      // Initialize version control
      await this.versionControl.initialize();

      // Verify database synchronization
      await this.syncWithDatabase();

      // Initialize default agent if no agents exist
      const activeAgents = await db.select().from(agents).where(eq(agents.isActive, true));
      if (activeAgents.length === 0) {
        await this.initializeDefaultAgent();
      }

      await this.logger.info('AgentManager', 'Initialized successfully', {
        directories: Object.keys(this.structure)
      });
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', 'Failed to initialize', { error: err.message });
      throw error;
    }
  }

  /**
   * Save a new version of an agent configuration
   */
  async saveAgentVersion(
    agentId: number,
    config: any,
    message?: string,
    author?: string
  ): Promise<string> {
    try {
      const versionId = await this.versionControl.saveVersion(agentId, config, message, author);
      await this.logger.info('AgentManager', `Saved new version for agent ${agentId}`, {
        versionId,
        message,
        author
      });
      return versionId;
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', `Failed to save version for agent ${agentId}`, {
        error: err.message
      });
      throw error;
    }
  }

  /**
   * Get all versions of an agent
   */
  async getAgentVersions(agentId: number): Promise<any[]> {
    return this.versionControl.getVersions(agentId);
  }

  /**
   * Get a specific version of an agent
   */
  async getAgentVersion(agentId: number, versionId: string): Promise<any> {
    const version = await this.versionControl.getVersion(agentId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for agent ${agentId}`);
    }
    return version;
  }

  /**
   * Revert an agent to a specific version
   */
  async revertAgent(agentId: number, versionId: string): Promise<void> {
    try {
      const version = await this.versionControl.revertToVersion(agentId, versionId);
      
      // Update agent in database with reverted configuration
      await db
        .update(agents)
        .set(version.config)
        .where(eq(agents.id, agentId));

      await this.logger.info('AgentManager', `Reverted agent ${agentId} to version ${versionId}`, {
        config: version.config
      });
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', `Failed to revert agent ${agentId} to version ${versionId}`, {
        error: err.message
      });
      throw error;
    }
  }

  /**
   * Compare two versions of an agent
   */
  async compareAgentVersions(
    agentId: number,
    versionId1: string,
    versionId2: string
  ): Promise<{
    added: string[];
    removed: string[];
    modified: string[];
  }> {
    return this.versionControl.compareVersions(agentId, versionId1, versionId2);
  }

  /**
   * Tag a specific version
   */
  async tagAgentVersion(
    agentId: number,
    versionId: string,
    tag: string
  ): Promise<void> {
    await this.versionControl.tagVersion(agentId, versionId, tag);
  }

  /**
   * Get all versions with a specific tag
   */
  async getAgentVersionsByTag(
    agentId: number,
    tag: string
  ): Promise<any[]> {
    return this.versionControl.getVersionsByTag(agentId, tag);
  }

  /**
   * Create a new project directory
   */
  async createProjectDirectory(projectName: string): Promise<string> {
    try {
      const projectDir = path.join(this.structure.workspaces, projectName);
      await fs.mkdir(projectDir, { recursive: true });

    // Create standard project structure
    const subdirs = [
      'src',
      'src/components',
      'src/utils',
      'src/hooks',
      'src/styles',
      'src/types',
      'tests',
      'docs'
    ];

    await Promise.all(
      subdirs.map(dir => fs.mkdir(path.join(projectDir, dir), { recursive: true }))
    );

      await this.logger.info('AgentManager', `Created new project directory: ${projectName}`, {
        path: projectDir,
        subdirectories: subdirs
      });

      return projectDir;
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', `Failed to create project directory: ${projectName}`, {
        error: err.message
      });
      throw error;
    }
  }


  /**
   * Sync with database
   */
  private async syncWithDatabase(): Promise<void> {
    try {
      // Get all active agents from database
      const activeAgents = await db.select().from(agents).where(eq(agents.isActive, true));
      
      // Update active agents map
      this.activeAgents.clear();
      activeAgents.forEach(agent => {
        this.activeAgents.set(agent.id, true);
      });

      // Ensure each active agent has a state directory
      await Promise.all(
        activeAgents.map(async agent => {
          const stateDir = path.join(this.structure.agents, 'state', agent.id.toString());
          await fs.mkdir(stateDir, { recursive: true });
        })
      );
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', 'Failed to sync with database', { error: err.message });
      throw error;
    }
  }

  /**
   * Get the path to a specific directory
   */
  getDirectoryPath(type: keyof DirectoryStructure): string {
    return this.structure[type];
  }

  /**
   * Check if an agent is active
   */
  isAgentActive(agentId: number): boolean {
    return this.activeAgents.get(agentId) || false;
  }

  /**
   * Initialize default agent if none exists
   */
  private async initializeDefaultAgent(): Promise<void> {
    try {
      const defaultAgent = {
        name: 'Default Component Generator',
        description: 'Default agent for generating React components',
        role: 'Component Generator',
        model: 'claude-3-sonnet-20240229',
        systemPrompt: `You are a specialized agent for generating React components. You focus on:
- Creating clean, maintainable React components
- Implementing TypeScript types and interfaces
- Following React best practices
- Ensuring code quality and readability`,
        temperature: '0.7',
        capabilities: ['component generation', 'typescript', 'react'],
        expertise: ['React', 'TypeScript', 'Component Design'],
        frameworks: ['React'],
        libraries: ['react-dom'],
        bestPractices: [
          'Clean Code',
          'Type Safety',
          'Component Composition',
          'React Hooks'
        ],
        isActive: true
      };

      const [agent] = await db.insert(agents).values(defaultAgent).returning();
      
      // Create state directory for the new agent
      const stateDir = path.join(this.structure.agents, 'state', agent.id.toString());
      await fs.mkdir(stateDir, { recursive: true });

      await this.logger.info('AgentManager', 'Initialized default agent', {
        agentId: agent.id,
        name: agent.name
      });
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', 'Failed to initialize default agent', {
        error: err.message
      });
      throw error;
    }
  }

  /**
   * Clean up old workspaces
   */
  async cleanupOldWorkspaces(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const workspaces = await fs.readdir(this.structure.workspaces);
      const now = Date.now();
      const deletedWorkspaces: string[] = [];

      await Promise.all(
        workspaces.map(async workspace => {
          const workspacePath = path.join(this.structure.workspaces, workspace);
          const stats = await fs.stat(workspacePath);
          
          if (now - stats.ctimeMs > maxAge) {
            await fs.rm(workspacePath, { recursive: true, force: true });
            deletedWorkspaces.push(workspace);
          }
        })
      );

      if (deletedWorkspaces.length > 0) {
        await this.logger.info('AgentManager', 'Cleaned up old workspaces', {
          deletedCount: deletedWorkspaces.length,
          deletedWorkspaces
        });
      }
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentManager', 'Failed to cleanup old workspaces', {
        error: err.message
      });
      throw error;
    }
  }
}
