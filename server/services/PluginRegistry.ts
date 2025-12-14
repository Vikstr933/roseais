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
import { pluginConfigs, pluginKnowledge, pluginInstallations, userGeneratedPlugins } from '../../db/schema-pg';
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

      // Encrypt credentials before storing
      const encryptedCredentials = this.encryptCredentials(credentials);
      logger.info('Encrypting credentials for storage', {
        userId,
        pluginId,
        credentialsLength: encryptedCredentials.length,
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken
      });

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
            credentials: encryptedCredentials,
            updatedAt: new Date()
          })
          .where(and(
            eq(pluginConfigs.userId, userId),
            eq(pluginConfigs.pluginId, pluginId)
          ));
        logger.info('Updated plugin config with credentials', { userId, pluginId });
      } else {
        // Insert new config
        await db.insert(pluginConfigs).values({
          userId,
          pluginId,
          enabled: true,
          credentials: encryptedCredentials,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
        logger.info('Inserted new plugin config with credentials', { userId, pluginId });
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
    logger.info('getAvailableTools called', { userId });
    const tools: Tool[] = [];

    // Load user plugins from database if not already loaded
    if (!this.userPlugins.has(userId) || this.userPlugins.get(userId)!.size === 0) {
      logger.info('Loading user plugins (not cached)', { userId });
      await this.loadUserPlugins(userId);
    } else {
      logger.info('Using cached user plugins', { 
        userId, 
        pluginCount: this.userPlugins.get(userId)?.size || 0 
      });
    }

    const enabledPlugins = this.userPlugins.get(userId) || new Set();

    // Load tools from registered plugins
    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          // Ensure plugin is initialized with userId before getting tools
          // Some plugins need userId to be set for their tools to work correctly
          if (typeof plugin.initialize === 'function') {
            try {
              await plugin.initialize(userId);
            } catch (initError) {
              // If initialization fails, log but continue - plugin might already be initialized
              logger.debug('Plugin initialization (may already be initialized)', {
                userId,
                pluginId,
                error: initError instanceof Error ? initError.message : 'Unknown'
              });
            }
          }
          
          const pluginTools = plugin.getTools();
          
          // Log all tools from this plugin for debugging
          logger.info('Plugin tools retrieved', {
            userId,
            pluginId,
            toolCount: pluginTools.length,
            toolNames: pluginTools.map(t => t?.name).filter(Boolean)
          });

          // Wrap each tool to inject userId context
          // Filter out invalid tools (missing name, description, or parameters)
          const wrappedTools = pluginTools
            .filter(tool => {
              const isValid = tool && 
                tool.name && 
                typeof tool.name === 'string' && 
                tool.name.trim().length > 0 &&
                tool.description && 
                typeof tool.description === 'string' &&
                tool.parameters &&
                typeof tool.parameters === 'object' &&
                tool.execute &&
                typeof tool.execute === 'function';
              
              if (!isValid) {
                logger.warn('Filtering out invalid tool from plugin', {
                  userId,
                  pluginId,
                  toolName: tool?.name || 'undefined',
                  hasName: !!tool?.name,
                  hasDescription: !!tool?.description,
                  hasParameters: !!tool?.parameters,
                  hasExecute: !!tool?.execute
                });
              }
              
              return isValid;
            })
            .map(tool => ({
              ...tool,
              execute: async (params: Record<string, any>) => {
                // Check tool permission before execution
                const permission = await this.checkToolPermission(userId, pluginId, tool.name);
                
                if (permission === 'deny') {
                  throw new Error(`Permission denied: Tool "${tool.name}" is not allowed for plugin "${pluginId}"`);
                }
                
                if (permission === 'ask') {
                  // In a real implementation, this would trigger a user prompt
                  // For now, we'll log and allow (can be enhanced with user confirmation)
                  logger.info('Tool requires user confirmation', {
                    userId,
                    pluginId,
                    toolName: tool.name,
                  });
                  // TODO: Implement user confirmation flow
                }
                
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

          logger.info('Wrapped tools from plugin', {
            userId,
            pluginId,
            wrappedCount: wrappedTools.length,
            wrappedToolNames: wrappedTools.map(t => t.name)
          });

          tools.push(...wrappedTools);
        } catch (error) {
          logger.error('Failed to get tools from plugin', error as Error, {
            userId,
            pluginId
          });
        }
      }
    }

    // Load tools from user-generated plugins
    try {
      logger.info('Loading user-generated plugins for tools', { userId });
      
      const installations = await db.query.pluginInstallations.findMany({
        where: and(
          eq(pluginInstallations.userId, userId),
          eq(pluginInstallations.status, 'active')
        )
      });

      logger.info('Found user-generated plugin installations', {
        userId,
        count: installations.length,
        pluginIds: installations.map(i => i.pluginId)
      });

      for (const installation of installations) {
        // Load plugin separately to ensure we get the data
        const plugin = await db.query.userGeneratedPlugins.findFirst({
          where: eq(userGeneratedPlugins.pluginId, installation.pluginId)
        });

        if (!plugin) {
          logger.warn('Plugin not found for installation', {
            userId,
            installationId: installation.id,
            pluginId: installation.pluginId
          });
          continue;
        }
        
        logger.info('Processing user-generated plugin', {
          userId,
          pluginId: plugin.pluginId,
          pluginName: plugin.name,
          pluginStatus: plugin.status
        });
        
        // Skip if plugin is not approved/active
        if (plugin.status !== 'approved' && plugin.status !== 'active') {
          logger.warn('Skipping plugin with invalid status', {
            userId,
            pluginId: plugin.pluginId,
            status: plugin.status
          });
          continue;
        }

        // Create tools from plugin capabilities
        const capabilities = (plugin.capabilities as string[]) || [];
        
        // Create a generic tool for the plugin that uses executeAction
        // Use a more descriptive name based on service name
        const serviceName = (plugin.serviceName || plugin.name || 'plugin').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const pluginTool: Tool = {
          name: `use_${serviceName}`,
          description: `${plugin.description || `Interact with ${plugin.name}`}. This plugin allows you to ${capabilities.length > 0 ? capabilities.join(', ') : 'send messages and read data'} from ${plugin.serviceName}.`,
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: `Action to perform. Available actions: ${capabilities.length > 0 ? capabilities.join(', ') : 'send_message, read_messages'}. For Discord: use 'send_message' to send a message or 'read_messages' to read unread messages.`,
              },
              ...(capabilities.length > 0 ? {} : {
                message: {
                  type: 'string',
                  description: 'Message content to send (required for send_message action)',
                },
                channel: {
                  type: 'string',
                  description: 'Channel ID or name (optional, defaults to webhook channel)',
                }
              })
            },
            required: ['action']
          },
          execute: async (params: Record<string, any>) => {
            logger.info('Executing user-generated plugin action', {
              userId,
              pluginId: plugin.pluginId,
              action: params.action,
              params
            });
            
            // Use the executeAction method which handles user-generated plugins
            return this.executeAction(userId, plugin.pluginId, params.action || 'default', params);
          }
        };

        // Validate tool before adding
        if (pluginTool.name && pluginTool.description && pluginTool.parameters && pluginTool.execute) {
          tools.push(pluginTool);
          logger.info('Created tool for user-generated plugin', {
            userId,
            pluginId: plugin.pluginId,
            toolName: pluginTool.name,
            serviceName
          });
        } else {
          logger.warn('Skipping invalid user-generated plugin tool', {
            userId,
            pluginId: plugin.pluginId,
            hasName: !!pluginTool.name,
            hasDescription: !!pluginTool.description,
            hasParameters: !!pluginTool.parameters,
            hasExecute: !!pluginTool.execute
          });
        }
      }
      
      logger.info('User-generated plugin tools loaded', {
        userId,
        toolCount: tools.length,
        toolNames: tools.map(t => t.name)
      });
    } catch (error) {
      logger.error('Failed to load user-generated plugin tools', error as Error, { userId });
    }

    logger.info('Total tools available for user', {
      userId,
      totalTools: tools.length,
      toolNames: tools.map(t => t.name)
    });

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
    // Check if this is a user-generated plugin
    const isUserGenerated = pluginId.startsWith('plugin_');
    
    if (isUserGenerated) {
      // Handle user-generated plugins
      return this.executeUserGeneratedPlugin(userId, pluginId, action, params);
    }

    // Handle regular plugins
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
   * Execute a user-generated plugin action
   */
  private async executeUserGeneratedPlugin(
    userId: string,
    pluginId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      // Check if plugin is installed for this user
      const installation = await db.query.pluginInstallations.findFirst({
        where: and(
          eq(pluginInstallations.pluginId, pluginId),
          eq(pluginInstallations.userId, userId),
          eq(pluginInstallations.status, 'active')
        ),
        with: {
          plugin: true
        }
      });

      if (!installation || !installation.plugin) {
        throw new Error(`Plugin ${pluginId} is not installed or not found`);
      }

      const plugin = installation.plugin;

      // Get credentials from installation
      const credentials = installation.credentials || {};

      // Import PluginSandbox for safe execution
      const { PluginSandbox } = await import('./PluginSandbox');
      const sandbox = new PluginSandbox();

      // Parse generatedCode if it's a JSON string (some databases store it as JSON)
      let rawCode = plugin.generatedCode;
      if (typeof rawCode === 'string' && rawCode.startsWith('"') && rawCode.endsWith('"')) {
        try {
          rawCode = JSON.parse(rawCode);
        } catch (e) {
          // Not JSON, use as-is
        }
      }

      // Validate code is not empty or truncated
      if (!rawCode || rawCode.length < 100) {
        throw new Error(`Plugin code is empty or too short (${rawCode?.length || 0} chars). Code may have been truncated during storage.`);
      }

      // Check if code appears truncated (ends mid-string or mid-statement)
      const endsWithCompleteStatement = /[;}\]]\s*$/.test(rawCode.trim());
      const hasUnclosedBraces = (rawCode.match(/{/g) || []).length !== (rawCode.match(/}/g) || []).length;
      const hasUnclosedQuotes = (rawCode.match(/'/g) || []).length % 2 !== 0 || (rawCode.match(/"/g) || []).length % 2 !== 0;
      
      logger.info('Loading plugin code', {
        userId,
        pluginId,
        codeLength: rawCode.length,
        codePreview: rawCode.substring(0, 200),
        codeEnd: rawCode.substring(Math.max(0, rawCode.length - 200)),
        appearsTruncated: !endsWithCompleteStatement || hasUnclosedBraces || hasUnclosedQuotes,
        endsWithCompleteStatement,
        hasUnclosedBraces,
        hasUnclosedQuotes
      });
      
      if (!endsWithCompleteStatement || hasUnclosedBraces || hasUnclosedQuotes) {
        logger.error('Plugin code appears to be truncated or corrupted in database', {
          userId,
          pluginId,
          codeLength: rawCode.length,
          lastChars: rawCode.substring(Math.max(0, rawCode.length - 100))
        });
        throw new Error(`Plugin code appears to be truncated or corrupted. Code length: ${rawCode.length}. Please regenerate the plugin.`);
      }

      // The generated plugin code is a class, so we need to wrap it to make it executable
      // Wrap the plugin code in a function that instantiates the class and calls executeAction
      // Escape any backticks in the generated code to prevent template literal issues
      const escapedCode = rawCode.replace(/`/g, '\\`').replace(/\${/g, '\\${');
      
      const wrappedCode = `
${escapedCode}

// Export a wrapper function that can be called by the sandbox
function execute(userId, params, credentials) {
  try {
    // The plugin code uses CommonJS exports, so check module.exports first
    let PluginClass = null;
    
    if (typeof module !== 'undefined' && module.exports) {
      const exported = module.exports;
      
      // Check if it's the class directly
      if (exported && typeof exported === 'function' && exported.prototype) {
        // Check for executeAction or getTools method (plugins have these)
        if (typeof exported.prototype.executeAction === 'function' || typeof exported.prototype.getTools === 'function') {
          PluginClass = exported;
        }
      }
      
      // Check for exports.DiscordPlugin or similar
      if (!PluginClass && exported && typeof exported === 'object') {
        for (const key in exported) {
          const value = exported[key];
          if (value && typeof value === 'function' && value.prototype) {
            if (typeof value.prototype.executeAction === 'function' || typeof value.prototype.getTools === 'function') {
              PluginClass = value;
              break;
            }
          }
        }
      }
    }
    
    // Fallback: Look for class in global scope
    if (!PluginClass) {
      const globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : this);
      const globalKeys = Object.getOwnPropertyNames(globalObj);
      
      for (const key of globalKeys) {
        try {
          const obj = globalObj[key];
          if (obj && typeof obj === 'function' && obj.prototype) {
            if (typeof obj.prototype.executeAction === 'function' || typeof obj.prototype.getTools === 'function') {
              PluginClass = obj;
              break;
            }
          }
        } catch (e) {
          // Skip if we can't access the property
          continue;
        }
      }
    }
    
    if (!PluginClass) {
      throw new Error('Could not find plugin class in generated code. Expected a class with executeAction or getTools method. Module exports: ' + (typeof module !== 'undefined' && module.exports ? JSON.stringify(Object.keys(module.exports || {})).substring(0, 200) : 'undefined'));
    }
    
    // Instantiate the plugin
    const pluginInstance = new PluginClass();
    
    // Initialize if method exists
    if (typeof pluginInstance.initialize === 'function') {
      await pluginInstance.initialize(userId);
    }
    
    // Enable if method exists and credentials provided
    if (typeof pluginInstance.enable === 'function' && credentials && Object.keys(credentials).length > 0) {
      await pluginInstance.enable(userId, credentials);
    }
    
    // Get the action from params
    const actionName = params.action || 'default';
    
    // Call executeAction
    const result = pluginInstance.executeAction(userId, actionName, params);
    
    // Handle both sync and async results
    if (result && typeof result.then === 'function') {
      return result;
    }
    
    return result;
  } catch (error) {
    const errorMsg = error && error.message ? error.message : String(error);
    throw new Error('Plugin execution error: ' + errorMsg);
  }
}
`;

      // Execute plugin code in sandbox with the wrapper function
      let sandboxResult;
      try {
        // Validate wrapped code is complete (check for balanced braces/brackets)
        const openBraces = (wrappedCode.match(/{/g) || []).length;
        const closeBraces = (wrappedCode.match(/}/g) || []).length;
        const openBrackets = (wrappedCode.match(/\[/g) || []).length;
        const closeBrackets = (wrappedCode.match(/\]/g) || []).length;
        const openParens = (wrappedCode.match(/\(/g) || []).length;
        const closeParens = (wrappedCode.match(/\)/g) || []).length;
        
        if (openBraces !== closeBraces || openBrackets !== closeBrackets || openParens !== closeParens) {
          logger.error('Code appears to be truncated or malformed', {
            userId,
            pluginId,
            action,
            codeLength: wrappedCode.length,
            braces: { open: openBraces, close: closeBraces },
            brackets: { open: openBrackets, close: closeBrackets },
            parens: { open: openParens, close: closeParens },
            codeEnd: wrappedCode.substring(wrappedCode.length - 500)
          });
          throw new Error(`Plugin code appears to be truncated or malformed. Code length: ${wrappedCode.length}, braces: ${openBraces}/${closeBraces}, brackets: ${openBrackets}/${closeBrackets}`);
        }

        logger.info('Executing plugin in sandbox', {
          userId,
          pluginId,
          action,
          codeLength: wrappedCode.length,
          codePreview: wrappedCode.substring(0, 300),
          codeEnd: wrappedCode.substring(wrappedCode.length - 300)
        });
        
        sandboxResult = await sandbox.execute(
          wrappedCode,
          'execute',
          [userId, { ...params, action }, credentials],
          plugin.sandboxConfig as any
        );
      } catch (sandboxError) {
        logger.error('Sandbox execution threw an error', sandboxError as Error, {
          userId,
          pluginId,
          action,
          errorMessage: sandboxError instanceof Error ? sandboxError.message : String(sandboxError),
          errorStack: sandboxError instanceof Error ? sandboxError.stack : undefined
        });
        throw sandboxError;
      }

      if (!sandboxResult || !sandboxResult.success) {
        const errorMsg = sandboxResult?.error || 'Plugin execution failed';
        const errorDetails = (sandboxResult as any)?.details;
        
        logger.error('Sandbox execution failed', { 
          userId, 
          pluginId, 
          action, 
          error: errorMsg,
          details: errorDetails,
          sandboxResult: JSON.stringify(sandboxResult, null, 2).substring(0, 1000)
        });
        
        // Include error details in the thrown error for better debugging
        let fullError = errorMsg;
        if (errorDetails) {
          fullError += `\n\nError Details:\n${JSON.stringify(errorDetails, null, 2)}`;
          if (errorDetails.codeSample) {
            fullError += `\n\nCode Sample (around error):\n${errorDetails.codeSample}`;
          }
          if (errorDetails.lineNumber) {
            fullError += `\n\nError at line: ${errorDetails.lineNumber}`;
          }
        }
        throw new Error(fullError);
      }

      const result = sandboxResult;

      logger.info('User-generated plugin action executed', {
        userId,
        pluginId,
        action,
        executionTime: result.metrics.executionTimeMs,
        resultType: typeof result.result,
        hasResult: result.result !== undefined && result.result !== null,
        resultKeys: result.result && typeof result.result === 'object' ? Object.keys(result.result) : 'N/A',
        resultString: typeof result.result === 'string' ? result.result.substring(0, 200) : 'N/A'
      });

      // Ensure result is serializable
      if (result.result === undefined || result.result === null) {
        logger.warn('Plugin returned undefined/null result', { userId, pluginId, action });
        return { message: 'Plugin executed successfully but returned no result' };
      }

      // If result is a Promise, await it
      if (result.result && typeof result.result.then === 'function') {
        logger.info('Plugin returned a Promise, awaiting it', { userId, pluginId, action });
        const awaitedResult = await result.result;
        
        // Ensure the awaited result is serializable
        try {
          JSON.stringify(awaitedResult);
          return awaitedResult;
        } catch (serializeError) {
          logger.error('Failed to serialize awaited result', serializeError as Error, {
            userId,
            pluginId,
            action
          });
          return { 
            error: 'Plugin returned non-serializable result',
            message: 'The plugin executed successfully but returned data that cannot be serialized'
          };
        }
      }

      // Ensure result is serializable before returning
      try {
        // Try to stringify to check if it's serializable
        const serialized = JSON.stringify(result.result);
        logger.info('Result is serializable', { 
          userId, 
          pluginId, 
          action,
          serializedLength: serialized.length 
        });
        
        // Return the result
        return result.result;
      } catch (serializeError) {
        logger.error('Failed to serialize result', serializeError as Error, {
          userId,
          pluginId,
          action,
          resultType: typeof result.result,
          resultConstructor: result.result?.constructor?.name,
          errorMessage: serializeError instanceof Error ? serializeError.message : String(serializeError)
        });
        
        // Try to return a safe representation
        if (typeof result.result === 'string') {
          return { message: result.result };
        }
        
        return {
          error: 'Plugin returned non-serializable result',
          message: 'The plugin executed successfully but returned data that cannot be serialized',
          resultType: typeof result.result
        };
      }
    } catch (error) {
      logger.error('User-generated plugin action failed', error as Error, {
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

      // Initialize user plugins set
      if (!this.userPlugins.has(userId)) {
        this.userPlugins.set(userId, new Set());
      }

      // Load regular plugin configurations
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

          // Handle credentials - can be string (encrypted) or object (if JSONB wrapped it)
          let credentialsString: string | null = null;
          if (config.credentials) {
            if (typeof config.credentials === 'string') {
              // If it's a string, it might be:
              // 1. Direct encrypted string
              // 2. JSON-wrapped string (from JSONB) - need to parse it
              const trimmed = config.credentials.trim();
              if (trimmed !== '') {
                // Try to parse as JSON first (in case JSONB wrapped it)
                try {
                  const parsed = JSON.parse(trimmed);
                  // If it parsed to a string, use that (it was double-wrapped)
                  if (typeof parsed === 'string') {
                    credentialsString = parsed;
                  } else {
                    // If it parsed to an object, it was stored incorrectly
                    logger.warn('Credentials stored as object instead of encrypted string', {
                      userId,
                      pluginId: config.pluginId
                    });
                    // Try to stringify it back (though this won't work for decryption)
                    credentialsString = trimmed;
                  }
                } catch {
                  // Not JSON, use as-is (direct encrypted string)
                  credentialsString = trimmed;
                }
              }
            } else if (typeof config.credentials === 'object' && config.credentials !== null) {
              // If it's already an object, it might be stored incorrectly
              // This shouldn't happen, but handle it gracefully
              logger.warn('Credentials stored as object - may need to reconnect plugin', {
                userId,
                pluginId: config.pluginId,
                credentialsKeys: Object.keys(config.credentials)
              });
              // Can't decrypt an object, so skip
            }
          }

          if (credentialsString) {
            try {
              const decryptedCredentials = this.decryptCredentials(credentialsString);

              // Log credential details (without sensitive data)
              logger.info('Enabling plugin with credentials', {
                userId,
                pluginId: config.pluginId,
                hasAccessToken: !!decryptedCredentials.accessToken,
                hasRefreshToken: !!decryptedCredentials.refreshToken,
                expiresAt: decryptedCredentials.expiresAt
              });

              await plugin.enable(userId, decryptedCredentials);
            } catch (enableError) {
              // Check if it's an OAuth token expiration error (can come from decryptCredentials OR plugin.enable)
              const errorMessage = enableError instanceof Error ? enableError.message : String(enableError);
              const errorResponse = (enableError as any)?.response;
              const isOAuthError = enableError instanceof Error && (
                errorMessage.includes('invalid_grant') ||
                errorMessage.includes('Token has been expired') ||
                errorMessage.includes('Token has been revoked') ||
                errorResponse?.data?.error === 'invalid_grant' ||
                (enableError as any)?.code === 400 && errorResponse?.data?.error === 'invalid_grant'
              );
              
              if (isOAuthError) {
                logger.warn('OAuth token expired or revoked - disabling plugin', {
                  userId,
                  pluginId: config.pluginId,
                  error: errorMessage,
                  errorCode: (enableError as any)?.code,
                  errorStatus: (enableError as any)?.status
                });
                
                // Disable the plugin since credentials are invalid
                try {
                  await db.update(pluginConfigs)
                    .set({ enabled: false })
                    .where(and(
                      eq(pluginConfigs.userId, userId),
                      eq(pluginConfigs.pluginId, config.pluginId)
                    ));
                  logger.info('Disabled plugin due to expired OAuth token', { userId, pluginId: config.pluginId });
                } catch (updateError) {
                  logger.error('Failed to disable plugin after OAuth error', updateError as Error, { userId, pluginId: config.pluginId });
                }
              } else {
                // Check if it's a decryption error vs enable error
                const isDecryptError = errorMessage.includes('decrypt') || errorMessage.includes('credentials');
                if (isDecryptError) {
                  logger.error('Failed to decrypt credentials for plugin', enableError as Error, {
                    userId,
                    pluginId: config.pluginId,
                    credentialsLength: credentialsString.length,
                    credentialsPreview: credentialsString.substring(0, 50)
                  });
                } else {
                  logger.error('Failed to enable plugin', enableError as Error, {
                    userId,
                    pluginId: config.pluginId,
                    errorMessage
                  });
                }
              }
              // Continue without enabling - plugin will be loaded but not enabled
            }
          } else {
            logger.warn('No credentials found for plugin or invalid format', {
              userId,
              pluginId: config.pluginId,
              credentialsType: typeof config.credentials,
              hasCredentials: !!config.credentials,
              credentialsValue: config.credentials ? (typeof config.credentials === 'object' ? '[object]' : String(config.credentials).substring(0, 50)) : 'null'
            });
          }

          // Track enabled plugin
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

      // Load user-generated plugins from installations
      const installations = await db.query.pluginInstallations.findMany({
        where: and(
          eq(pluginInstallations.userId, userId),
          eq(pluginInstallations.status, 'active')
        )
      });

      logger.info('Found user-generated plugin installations for loading', {
        userId,
        count: installations.length,
        pluginIds: installations.map(i => i.pluginId)
      });

      for (const installation of installations) {
        // Load plugin separately to ensure we get the data
        const plugin = await db.query.userGeneratedPlugins.findFirst({
          where: eq(userGeneratedPlugins.pluginId, installation.pluginId)
        });

        if (!plugin) {
          logger.warn('Plugin not found for installation during load', {
            userId,
            installationId: installation.id,
            pluginId: installation.pluginId
          });
          continue;
        }
        
        // Skip if plugin is not approved/active
        if (plugin.status !== 'approved' && plugin.status !== 'active') {
          continue;
        }

        // Track user-generated plugin as enabled
        this.userPlugins.get(userId)!.add(plugin.pluginId);

        logger.info('User-generated plugin loaded', {
          userId,
          pluginId: plugin.pluginId,
          pluginName: plugin.name
        });
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

  /**
   * Check tool permission for a user
   * Returns 'allow', 'ask', or 'deny'
   * Default is 'ask' if no permission is set
   */
  private async checkToolPermission(
    userId: string,
    pluginId: string,
    toolId: string
  ): Promise<'allow' | 'ask' | 'deny'> {
    try {
      const [permission] = await db
        .select()
        .from(toolPermissions)
        .where(
          and(
            eq(toolPermissions.userId, userId),
            eq(toolPermissions.pluginId, pluginId),
            eq(toolPermissions.toolId, toolId)
          )
        )
        .limit(1);

      if (permission) {
        return permission.permission as 'allow' | 'ask' | 'deny';
      }

      // Default: ask
      return 'ask';
    } catch (error) {
      logger.error('Error checking tool permission', error as Error, {
        userId,
        pluginId,
        toolId,
      });
      // On error, default to 'ask' for safety
      return 'ask';
    }
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry();
export default pluginRegistry;
