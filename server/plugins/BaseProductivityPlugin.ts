import { EventEmitter } from 'events';

/**
 * Tool interface for AI agent capabilities
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  execute: (params: Record<string, any>) => Promise<any>;
}

/**
 * Knowledge item returned from plugin queries
 */
export interface KnowledgeItem {
  id: string;
  type: 'email' | 'calendar_event' | 'task' | 'document' | 'contact' | 'note';
  title: string;
  content: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  timestamp: Date;
  source: string; // Plugin name
}

/**
 * Plugin credentials for OAuth or API keys
 */
export interface PluginCredentials {
  type: 'oauth2' | 'api_key' | 'basic_auth';
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  expiresAt?: Date;
  scope?: string[];
  metadata?: Record<string, any>;
}

/**
 * Sync options for plugin data synchronization
 */
export interface SyncOptions {
  fullSync?: boolean;
  since?: Date;
  until?: Date;
  maxItems?: number;
  filters?: Record<string, any>;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  lastSyncTime: Date;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Plugin metadata and configuration
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'productivity' | 'communication' | 'storage' | 'custom';
  icon?: string;
  requiresAuth: boolean;
  authType?: 'oauth2' | 'api_key' | 'basic_auth';
  capabilities: string[];
  settings?: Record<string, any>;
}

/**
 * Plugin status information
 */
export interface PluginStatus {
  enabled: boolean;
  initialized: boolean;
  authenticated: boolean;
  lastSync?: Date;
  health: 'healthy' | 'warning' | 'error';
  healthMessage?: string;
  syncInProgress: boolean;
}

/**
 * Base abstract class for all productivity plugins
 *
 * Plugins extend this class to integrate external services (Gmail, Calendar, etc.)
 * with the AI Library platform and make their data/capabilities available to AI agents.
 */
export abstract class BaseProductivityPlugin extends EventEmitter {
  protected userId?: string;
  protected credentials?: PluginCredentials;
  protected status: PluginStatus = {
    enabled: false,
    initialized: false,
    authenticated: false,
    health: 'healthy',
    syncInProgress: false
  };

  constructor(protected metadata: PluginMetadata) {
    super();
    this.setMaxListeners(50); // Support multiple listeners
  }

  /**
   * Get plugin metadata
   */
  public getMetadata(): PluginMetadata {
    return this.metadata;
  }

  /**
   * Get current plugin status
   */
  public getStatus(): PluginStatus {
    return { ...this.status };
  }

  /**
   * Initialize the plugin for a specific user
   * Called when plugin is first set up for a user
   */
  public abstract initialize(userId: string): Promise<void>;

  /**
   * Enable the plugin with user credentials
   * @param userId - User ID
   * @param credentials - Authentication credentials (OAuth tokens, API keys, etc.)
   */
  public abstract enable(userId: string, credentials: PluginCredentials): Promise<void>;

  /**
   * Disable the plugin for a user
   */
  public async disable(userId: string): Promise<void> {
    this.userId = userId;
    this.status.enabled = false;
    this.status.authenticated = false;
    this.emit('disabled', { userId });
  }

  /**
   * Synchronize data from external service
   * @param userId - User ID
   * @param options - Sync options (full sync, date range, filters)
   */
  public abstract sync(userId: string, options?: SyncOptions): Promise<SyncResult>;

  /**
   * Get tools/capabilities that this plugin provides to AI agents
   * These tools can be invoked by agents during task execution
   */
  public abstract getTools(): Tool[];

  /**
   * Query plugin's knowledge base for relevant information
   * Used by AI agents to retrieve context from external service
   *
   * @param userId - User ID
   * @param prompt - Natural language query from user/agent
   * @param filters - Optional filters to narrow results
   */
  public abstract getKnowledgeItems(
    userId: string,
    prompt: string,
    filters?: Record<string, any>
  ): Promise<KnowledgeItem[]>;

  /**
   * Execute a specific action through this plugin
   * @param userId - User ID
   * @param action - Action name (e.g., 'send_email', 'create_event')
   * @param params - Action parameters
   */
  public abstract executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any>;

  /**
   * Validate credentials (check if still valid, refresh if needed)
   */
  public abstract validateCredentials(userId: string): Promise<boolean>;

  /**
   * Health check - verify plugin is operational
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.status.initialized) {
        return { healthy: false, message: 'Plugin not initialized' };
      }

      if (!this.status.authenticated && this.metadata.requiresAuth) {
        return { healthy: false, message: 'Plugin not authenticated' };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cleanup resources when plugin is being removed
   */
  public async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.status.enabled = false;
    this.status.initialized = false;
  }

  /**
   * Update plugin status
   */
  protected updateStatus(updates: Partial<PluginStatus>): void {
    this.status = { ...this.status, ...updates };
    this.emit('status_changed', this.status);
  }

  /**
   * Emit sync progress event
   */
  protected emitSyncProgress(progress: {
    current: number;
    total: number;
    message?: string;
  }): void {
    this.emit('sync_progress', {
      userId: this.userId,
      ...progress
    });
  }

  /**
   * Emit error event
   */
  protected emitError(error: Error, context?: Record<string, any>): void {
    this.emit('error', {
      userId: this.userId,
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Emit info event
   */
  protected emitInfo(message: string, metadata?: Record<string, any>): void {
    this.emit('info', {
      userId: this.userId,
      message,
      ...metadata
    });
  }
}

/**
 * Plugin configuration stored in database
 */
export interface PluginConfig {
  userId: string;
  pluginId: string;
  enabled: boolean;
  credentials?: PluginCredentials;
  settings?: Record<string, any>;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default BaseProductivityPlugin;
