import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface Version {
  id: string;
  timestamp: string;
  config: any;
  hash: string;
  author?: string;
  message?: string;
  tags?: string[];
}

interface VersionMetadata {
  id: string;
  timestamp: string;
  hash: string;
  author?: string;
  message?: string;
  tags?: string[];
}

export class AgentVersionControl {
  private versionsDir: string;
  private versionFile: string;
  private backupDir: string;

  constructor(baseDirectory: string) {
    this.versionsDir = path.join(baseDirectory, 'agents', 'versions');
    this.versionFile = path.join(this.versionsDir, 'versions.json');
    this.backupDir = path.join(baseDirectory, 'agents', 'backups');
  }

  async initialize(): Promise<void> {
    try {
      // Create version control directories
      await fs.mkdir(this.versionsDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });

      // Initialize version tracking file if it doesn't exist
      try {
        await fs.access(this.versionFile);
      } catch {
        await fs.writeFile(
          this.versionFile,
          JSON.stringify(
            {
              agents: {},
              lastUpdate: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }

      console.log('Agent Version Control initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Version Control:', error);
      throw error;
    }
  }

  private generateHash(content: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  async saveVersion(
    agentId: number,
    config: any,
    message: string = '',
    author: string = 'system',
    tags: string[] = []
  ): Promise<string> {
    const versionId = `v${Date.now()}`;
    const timestamp = new Date().toISOString();
    const hash = this.generateHash(config);

    const version: Version = {
      id: versionId,
      timestamp,
      config,
      hash,
      author,
      message,
      tags,
    };

    try {
      // Read current versions
      const versions = JSON.parse(await fs.readFile(this.versionFile, 'utf-8'));

      if (!versions.agents[agentId]) {
        versions.agents[agentId] = [];
      }

      // Add new version
      versions.agents[agentId].push({
        id: versionId,
        timestamp,
        hash,
        author,
        message,
        tags,
      });

      // Keep only last 10 versions in the main file
      if (versions.agents[agentId].length > 10) {
        versions.agents[agentId] = versions.agents[agentId].slice(-10);
      }

      versions.lastUpdate = timestamp;

      // Save version metadata
      await fs.writeFile(this.versionFile, JSON.stringify(versions, null, 2));

      // Save full version data
      const versionPath = path.join(
        this.versionsDir,
        `${agentId}_${versionId}.json`
      );
      await fs.writeFile(versionPath, JSON.stringify(version, null, 2));

      // Create backup
      const backupPath = path.join(
        this.backupDir,
        `${agentId}_${versionId}_backup.json`
      );
      await fs.writeFile(backupPath, JSON.stringify(version, null, 2));

      return versionId;
    } catch (error) {
      console.error('Failed to save version:', error);
      throw error;
    }
  }

  async getVersions(agentId: number): Promise<VersionMetadata[]> {
    try {
      const versions = JSON.parse(await fs.readFile(this.versionFile, 'utf-8'));
      return versions.agents[agentId] || [];
    } catch (error) {
      console.error('Failed to get versions:', error);
      throw error;
    }
  }

  async getVersion(
    agentId: number,
    versionId: string
  ): Promise<Version | null> {
    try {
      const versionPath = path.join(
        this.versionsDir,
        `${agentId}_${versionId}.json`
      );
      const content = await fs.readFile(versionPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Try backup if main version file is not found
      try {
        const backupPath = path.join(
          this.backupDir,
          `${agentId}_${versionId}_backup.json`
        );
        const content = await fs.readFile(backupPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        console.error('Version not found:', error);
        return null;
      }
    }
  }

  async compareVersions(
    agentId: number,
    versionId1: string,
    versionId2: string
  ): Promise<{
    added: string[];
    removed: string[];
    modified: string[];
  }> {
    const v1 = await this.getVersion(agentId, versionId1);
    const v2 = await this.getVersion(agentId, versionId2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const keys1 = new Set(Object.keys(v1.config));
    const keys2 = new Set(Object.keys(v2.config));

    const added = Array.from(keys2).filter(k => !keys1.has(k));
    const removed = Array.from(keys1).filter(k => !keys2.has(k));
    const common = Array.from(keys1).filter(k => keys2.has(k));
    const modified = common.filter(
      k => JSON.stringify(v1.config[k]) !== JSON.stringify(v2.config[k])
    );

    return {
      added,
      removed,
      modified,
    };
  }

  async revertToVersion(agentId: number, versionId: string): Promise<Version> {
    const version = await this.getVersion(agentId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Create a new version with the reverted config
    const newVersionId = await this.saveVersion(
      agentId,
      version.config,
      `Reverted to version ${versionId}`,
      'system',
      ['revert', `from-${versionId}`]
    );

    return this.getVersion(agentId, newVersionId) as Promise<Version>;
  }

  async tagVersion(
    agentId: number,
    versionId: string,
    tag: string
  ): Promise<void> {
    const versions = JSON.parse(await fs.readFile(this.versionFile, 'utf-8'));

    const versionIndex = versions.agents[agentId]?.findIndex(
      (v: VersionMetadata) => v.id === versionId
    );

    if (versionIndex === -1) {
      throw new Error(`Version ${versionId} not found`);
    }

    if (!versions.agents[agentId][versionIndex].tags) {
      versions.agents[agentId][versionIndex].tags = [];
    }

    if (!versions.agents[agentId][versionIndex].tags.includes(tag)) {
      versions.agents[agentId][versionIndex].tags.push(tag);
    }

    await fs.writeFile(this.versionFile, JSON.stringify(versions, null, 2));
  }

  async getVersionsByTag(
    agentId: number,
    tag: string
  ): Promise<VersionMetadata[]> {
    const versions = await this.getVersions(agentId);
    return versions.filter(v => v.tags?.includes(tag));
  }
}
