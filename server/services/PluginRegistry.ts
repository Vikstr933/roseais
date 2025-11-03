import { EventEmitter } from 'events';
import {
  BaseProductivityPlugin,
  PluginMetadata,
  PluginCredentials,
  SyncOptions,
  SyncResult,
  Tool,
  KnowledgeItem
} from '../plugins/BaseProductivityPlugin';
import { SimpleLogger } from '../utils/SimpleLogger';
import { CredentialVault } from './CredentialVault';
import { db } from '../../db';
import { pluginConfigs, pluginKnowledge } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const logger = new SimpleLogger('PluginRegistry');

/**
 * Central registry for managing all productivity plugins
 *
 * Responsibilities:
 * - Plugin registration and lifecycle management
 * - User-specific plugin configuration
 * - Credential management and encryption
 * - Knowledge aggregation from multiple plugins
 * - Tool aggregation for AI agents
 */
export class PluginRegistry extends EventEmitter {
  private plugins = new Map<string, BaseProductivityPlugin>();
  private userPlugins = new Map<string, Set<string>>(); // userId -> Set<pluginId>
  private credentialVault: CredentialVault;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.credentialVault = new CredentialVault();
  }

  /**
   * Register a new plugin
   */
  public registerPlugin(plugin: BaseProductivityPlugin): void {
    const metadata = plugin.getMetadata();

    if (this.plugins.has(metadata.id)) {
      logger.warn('Plugin already registered', { pluginId: metadata.id });
      return;
    }

    this.plugins.set(metadata.id, plugin);

    // Listen to plugin events
    plugin.on('status_changed', (status) => {
      this.emit('plugin_status_changed', { pluginId: metadata.id, status });
    });

    plugin.on('sync_progress', (progress) => {
      this.emit('plugin_sync_progress', { pluginId: metadata.id, ...progress });
    });

    plugin.on('error', (error) => {
      logger.error('Plugin error', new Error(error.error), {
        pluginId: metadata.id,
        userId: error.userId
      });
      this.emit('plugin_error', { pluginId: metadata.id, ...error });
    });

    plugin.on('info', (info) => {
      logger.info('Plugin info', info.message, {
        pluginId: metadata.id,
        userId: info.userId
      });
    });

    logger.info('Plugin registered', { pluginId: metadata.id, name: metadata.name });
  }

  /**
   * Unregister a plugin
   */
  public async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      logger.warn('Plugin not found for unregistration', { pluginId });
      return;
    }

    await plugin.cleanup();
    this.plugins.delete(pluginId);

    logger.info('Plugin unregistered', { pluginId });
  }

  /**
   * Get all registered plugins
   */
  public getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(p => p.getMetadata());
  }

  /**
   * Get a specific plugin
   */
  public getPlugin(pluginId: string): BaseProductivityPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Enable a plugin for a user
   */
  public async enablePlugin(
    userId: string,
    pluginId: string,
    credentials: PluginCredentials
  ): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      // Initialize plugin for user
      await plugin.initialize(userId);

      // Enable with credentials
      await plugin.enable(userId, credentials);

      // Store configuration in database
      const existingConfig = await db.query.pluginConfigs.findFirst({
        where: (configs, { eq, and }) => and(
          eq(configs.userId, userId),
          eq(configs.pluginId, pluginId)
        )
      });

      if (existingConfig) {
        // Update existing config
        await db.update(pluginConfigs)
          .set({
            enabled: true,
            credentials: this.encryptCredentials(credentials),
            updatedAt: new Date()
          })
          .where(and(
            eq(pluginConfigs.userId, userId),
            eq(pluginConfigs.pluginId, pluginId)
          ));
      } else {
        // Insert new config
        await db.insert(pluginConfigs).values({
          userId,
          pluginId,
          enabled: true,
          credentials: this.encryptCredentials(credentials),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Track user's enabled plugins
      if (!this.userPlugins.has(userId)) {
        this.userPlugins.set(userId, new Set());
      }
      this.userPlugins.get(userId)!.add(pluginId);

      logger.info('Plugin enabled for user', { userId, pluginId });

      // Emit event
      this.emit('plugin_enabled', { userId, pluginId });

      // Trigger initial sync in background (don't block OAuth callback)
      this.syncPlugin(userId, pluginId).catch(error => {
        logger.error('Background sync failed after plugin enable', error as Error, { userId, pluginId });
      });
    } catch (error) {
      logger.error('Failed to enable plugin', error as Error, { userId, pluginId });
      throw error;
    }
  }

  /**
   * Disable a plugin for a user
   */
  public async disablePlugin(userId: string, pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      await plugin.disable(userId);

      // Update database
      await db.update(pluginConfigs)
        .set({
          enabled: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(pluginConfigs.userId, userId),
          eq(pluginConfigs.pluginId, pluginId)
        ));

      // Remove from tracking
      this.userPlugins.get(userId)?.delete(pluginId);

      logger.info('Plugin disabled for user', { userId, pluginId });

      this.emit('plugin_disabled', { userId, pluginId });
    } catch (error) {
      logger.error('Failed to disable plugin', error as Error, { userId, pluginId });
      throw error;
    }
  }

  /**
   * Sync a specific plugin for a user
   */
  public async syncPlugin(
    userId: string,
    pluginId: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      logger.info('Starting plugin sync', { userId, pluginId });

      const result = await plugin.sync(userId, options);

      // Update last sync time in database
      await db.update(pluginConfigs)
        .set({
          lastSync: result.lastSyncTime,
          updatedAt: new Date()
        })
        .where(and(
          eq(pluginConfigs.userId, userId),
          eq(pluginConfigs.pluginId, pluginId)
        ));

      logger.info('Plugin sync completed', {
        userId,
        pluginId,
        itemsSynced: result.itemsSynced
      });

      this.emit('plugin_synced', { userId, pluginId, result });

      return result;
    } catch (error) {
      logger.error('Plugin sync failed', error as Error, { userId, pluginId });
      throw error;
    }
  }

  /**
   * Sync all enabled plugins for a user
   */
  public async syncAllPlugins(userId: string, options?: SyncOptions): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    for (const pluginId of enabledPlugins) {
      try {
        const result = await this.syncPlugin(userId, pluginId, options);
        results.set(pluginId, result);
      } catch (error) {
        logger.error('Failed to sync plugin', error as Error, { userId, pluginId });
        results.set(pluginId, {
          success: false,
          itemsSynced: 0,
          lastSyncTime: new Date(),
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    return results;
  }

  /**
   * Get all tools from enabled plugins for a user
   * Used by AI agents to discover available capabilities
   */
  public async getAvailableTools(userId: string): Promise<Tool[]> {
    const tools: Tool[] = [];

    // Load user plugins from database if not already loaded
    if (!this.userPlugins.has(userId) || this.userPlugins.get(userId)!.size === 0) {
      await this.loadUserPlugins(userId);
    }

    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          const pluginTools = plugin.getTools();

          // Wrap each tool to inject userId context
          const wrappedTools = pluginTools.map(tool => ({
            ...tool,
            execute: async (params: Record<string, any>) => {
              // Check if plugin has executeAction method for user-specific execution
              if (typeof (plugin as any).executeAction === 'function') {
                logger.info('Executing plugin action with userId', {
                  userId,
                  pluginId,
                  toolName: tool.name,
                  params
                });
                return (plugin as any).executeAction(userId, tool.name, params);
              } else {
                // Fallback to tool's own execute if no executeAction method
                return tool.execute(params);
              }
            }
          }));

          tools.push(...wrappedTools);
        } catch (error) {
          logger.error('Failed to get tools from plugin', error as Error, {
            userId,
            pluginId
          });
        }
      }
    }

    return tools;
  }

  /**
   * Query knowledge from all enabled plugins
   * Used by AI agents to retrieve relevant context
   */
  public async queryKnowledge(
    userId: string,
    prompt: string,
    filters?: {
      pluginIds?: string[];
      types?: string[];
      since?: Date;
      limit?: number;
    }
  ): Promise<KnowledgeItem[]> {
    const allKnowledge: KnowledgeItem[] = [];

    // Load user plugins from database if not already loaded
    if (!this.userPlugins.has(userId) || this.userPlugins.get(userId)!.size === 0) {
      await this.loadUserPlugins(userId);
    }

    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    // Determine which plugins to query
    const pluginsToQuery = filters?.pluginIds
      ? filters.pluginIds.filter(id => enabledPlugins.has(id))
      : Array.from(enabledPlugins);

    // Query each plugin in parallel
    const queries = pluginsToQuery.map(async (pluginId) => {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) return [];

      try {
        const items = await plugin.getKnowledgeItems(userId, prompt, filters);
        return items;
      } catch (error) {
        logger.error('Failed to query plugin knowledge', error as Error, {
          userId,
          pluginId
        });
        return [];
      }
    });

    const results = await Promise.all(queries);
    results.forEach(items => allKnowledge.push(...items));

    // Sort by relevance score (descending)
    allKnowledge.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit if specified
    if (filters?.limit) {
      return allKnowledge.slice(0, filters.limit);
    }

    return allKnowledge;
  }

  /**
   * Execute an action on a specific plugin
   */
  public async executeAction(
    userId: string,
    pluginId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Load user plugins from database if not already loaded
    if (!this.userPlugins.has(userId) || this.userPlugins.get(userId)!.size === 0) {
      await this.loadUserPlugins(userId);
    }

    // Verify user has this plugin enabled
    if (!this.userPlugins.get(userId)?.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not enabled for user`);
    }

    try {
      logger.info('Executing plugin action', { userId, pluginId, action });

      const result = await plugin.executeAction(userId, action, params);

      logger.info('Plugin action executed', { userId, pluginId, action });

      this.emit('plugin_action_executed', { userId, pluginId, action, result });

      return result;
    } catch (error) {
      logger.error('Plugin action failed', error as Error, {
        userId,
        pluginId,
        action
      });
      throw error;
    }
  }

  /**
   * Load user's plugin configurations from database
   */
  public async loadUserPlugins(userId: string): Promise<void> {
    try {
      logger.info('Loading plugins for user from database', { userId });

      const configs = await db.query.pluginConfigs.findMany({
        where: (configs, { eq }) => eq(configs.userId, userId)
      });

      logger.info('Found plugin configurations', {
        userId,
        configCount: configs.length,
        enabledCount: configs.filter(c => c.enabled).length
      });

      for (const config of configs) {
        if (!config.enabled) {
          logger.info('Skipping disabled plugin', { userId, pluginId: config.pluginId });
          continue;
        }

        const plugin = this.plugins.get(config.pluginId);
        if (!plugin) {
          logger.warn('Plugin not found in registry', { pluginId: config.pluginId });
          continue;
        }

        try {
          logger.info('Initializing plugin for user', { userId, pluginId: config.pluginId });
          await plugin.initialize(userId);

          if (config.credentials) {
            const decryptedCredentials = this.decryptCredentials(config.credentials);

            // Log credential details (without sensitive data)
            logger.info('Enabling plugin with credentials', {
              userId,
              pluginId: config.pluginId,
              hasAccessToken: !!decryptedCredentials.accessToken,
              hasRefreshToken: !!decryptedCredentials.refreshToken,
              expiresAt: decryptedCredentials.expiresAt
            });

            await plugin.enable(userId, decryptedCredentials);
          } else {
            logger.warn('No credentials found for plugin', { userId, pluginId: config.pluginId });
          }

          // Track enabled plugin
          if (!this.userPlugins.has(userId)) {
            this.userPlugins.set(userId, new Set());
          }
          this.userPlugins.get(userId)!.add(config.pluginId);

          logger.info('Plugin loaded successfully', { userId, pluginId: config.pluginId });
        } catch (error) {
          logger.error('Failed to load plugin for user', error as Error, {
            userId,
            pluginId: config.pluginId,
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to load user plugins', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get plugin status for a user
   */
  public getUserPluginStatus(userId: string): Map<string, any> {
    const status = new Map<string, any>();
    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        status.set(pluginId, {
          metadata: plugin.getMetadata(),
          status: plugin.getStatus()
        });
      }
    }

    return status;
  }

  /**
   * Validate all credentials for a user
   */
  public async validateUserCredentials(userId: string): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          const isValid = await plugin.validateCredentials(userId);
          results.set(pluginId, isValid);
        } catch (error) {
          logger.error('Failed to validate credentials', error as Error, {
            userId,
            pluginId
          });
          results.set(pluginId, false);
        }
      }
    }

    return results;
  }

  /**
   * Encrypt credentials before storing in database
   * Uses AES-256-GCM encryption via CredentialVault
   */
  private encryptCredentials(credentials: PluginCredentials): string {
    try {
      return this.credentialVault.encrypt(credentials as Record<string, any>);
    } catch (error) {
      logger.error('Failed to encrypt credentials', error);
      throw new Error('Credential encryption failed');
    }
  }

  /**
   * Decrypt credentials from database
   * Uses AES-256-GCM decryption via CredentialVault
   */
  private decryptCredentials(encryptedCredentials: string): PluginCredentials {
    try {
      return this.credentialVault.decrypt(encryptedCredentials) as PluginCredentials;
    } catch (error) {
      logger.error('Failed to decrypt credentials', error);
      throw new Error('Credential decryption failed');
    }
  }

  /**
   * Cleanup all plugins
   */
  public async cleanup(): Promise<void> {
    for (const [pluginId, plugin] of this.plugins) {
      try {
        await plugin.cleanup();
      } catch (error) {
        logger.error('Failed to cleanup plugin', error as Error, { pluginId });
      }
    }

    this.plugins.clear();
    this.userPlugins.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry();
export default pluginRegistry;
