# AI Library → Personal AI Assistant Platform
## Strategic Transformation Plan

## Vision

Transform the AI Library from a **code generation platform** into a **comprehensive AI assistant** that combines:
- ✅ Existing code generation capabilities
- 🆕 Personal productivity management (Gmail, Calendar, Tasks)
- 🆕 Intelligent task automation
- 🆕 Context-aware assistance based on your daily activities

---

## Executive Summary

### Current State
- **Strong Foundation**: Multi-agent orchestration, knowledge base, real-time updates
- **Focus**: React component generation with specialized AI agents
- **Extensibility**: ToolRegistry, BaseAgent pattern, SharedMemory communication

### Target State
- **Dual-Mode System**: Code Generation + Personal Assistant
- **Plugin Architecture**: Easy integration of external services
- **Unified Intelligence**: AI agents that understand both code AND your personal context
- **Proactive Assistance**: Agents that anticipate needs and suggest actions

### Timeline
**6-8 weeks** for full implementation of productivity integrations

---

## Architecture Design

### Phase 1: Plugin System Foundation (Week 1-2)

#### 1.1 Create Plugin Interface

**File**: `server/plugins/BaseProductivityPlugin.ts`

```typescript
import { Tool } from '../utils/ToolRegistry';
import { KnowledgeItem } from '../services/KnowledgeService';

export interface PluginConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'productivity' | 'communication' | 'storage' | 'analytics';
  icon: string;

  // OAuth configuration
  oauth?: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId: string;
    redirectUri: string;
  };

  // API configuration
  api?: {
    baseUrl: string;
    rateLimit: number;
    timeout: number;
  };

  // User-configurable settings
  settings?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'select';
      label: string;
      default: any;
      options?: string[];
      required?: boolean;
    };
  };
}

export interface PluginCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  metadata?: Record<string, any>;
}

export interface SyncOptions {
  since?: Date;
  limit?: number;
  filters?: Record<string, any>;
  incremental?: boolean;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errors: Array<{ item: string; error: string }>;
  nextSyncToken?: string;
  lastSyncTime: Date;
}

export interface ExtractedItem {
  id: string;
  type: 'email' | 'task' | 'event' | 'note' | 'contact';
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  tags?: string[];
  metadata: Record<string, any>;
  sourceUrl?: string;
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseProductivityPlugin {
  public readonly config: PluginConfig;
  protected logger: any;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  /**
   * Initialize the plugin for a specific user
   */
  abstract initialize(userId: string): Promise<void>;

  /**
   * Enable the plugin for a user (called after OAuth)
   */
  abstract enable(userId: string, credentials: PluginCredentials): Promise<void>;

  /**
   * Disable the plugin for a user
   */
  abstract disable(userId: string): Promise<void>;

  /**
   * Get current credentials for a user
   */
  abstract getCredentials(userId: string): Promise<PluginCredentials | null>;

  /**
   * Refresh expired access token
   */
  abstract refreshCredentials(userId: string): Promise<PluginCredentials>;

  /**
   * Synchronize data from the external service
   */
  abstract sync(userId: string, options?: SyncOptions): Promise<SyncResult>;

  /**
   * Get AI agent tools provided by this plugin
   */
  abstract getTools(): Tool[];

  /**
   * Get knowledge items relevant to a user's prompt
   */
  abstract getKnowledgeItems(userId: string, prompt: string): Promise<KnowledgeItem[]>;

  /**
   * Extract actionable items from raw data
   */
  abstract extractItems(userId: string, rawData: any[]): Promise<ExtractedItem[]>;

  /**
   * Execute a plugin-specific action
   */
  abstract executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any>;

  /**
   * Validate plugin configuration
   */
  validate(): boolean {
    return !!(
      this.config.id &&
      this.config.name &&
      this.config.version
    );
  }

  /**
   * Check if credentials are valid and not expired
   */
  protected isCredentialsValid(credentials: PluginCredentials): boolean {
    if (!credentials.accessToken) return false;
    if (credentials.expiresAt && credentials.expiresAt < new Date()) return false;
    return true;
  }
}
```

#### 1.2 Create Plugin Registry

**File**: `server/plugins/PluginRegistry.ts`

```typescript
import { BaseProductivityPlugin } from './BaseProductivityPlugin';
import { SimpleLogger } from '../utils/SimpleLogger';

export class PluginRegistry {
  private plugins = new Map<string, BaseProductivityPlugin>();
  private logger = new SimpleLogger('PluginRegistry');
  private enabledPlugins = new Map<string, Set<string>>(); // userId -> pluginIds

  /**
   * Register a new plugin
   */
  register(plugin: BaseProductivityPlugin): void {
    if (!plugin.validate()) {
      throw new Error(`Invalid plugin configuration: ${plugin.config.id}`);
    }

    if (this.plugins.has(plugin.config.id)) {
      throw new Error(`Plugin already registered: ${plugin.config.id}`);
    }

    this.plugins.set(plugin.config.id, plugin);
    this.logger.info(`Registered plugin: ${plugin.config.name} (${plugin.config.id})`);
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): BaseProductivityPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): BaseProductivityPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   */
  getByCategory(category: string): BaseProductivityPlugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.config.category === category
    );
  }

  /**
   * Get enabled plugins for a user
   */
  getEnabledForUser(userId: string): BaseProductivityPlugin[] {
    const enabledIds = this.enabledPlugins.get(userId) || new Set();
    return Array.from(enabledIds)
      .map(id => this.plugins.get(id))
      .filter((p): p is BaseProductivityPlugin => !!p);
  }

  /**
   * Mark a plugin as enabled for a user
   */
  setEnabled(userId: string, pluginId: string, enabled: boolean): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (!this.enabledPlugins.has(userId)) {
      this.enabledPlugins.set(userId, new Set());
    }

    const userPlugins = this.enabledPlugins.get(userId)!;
    if (enabled) {
      userPlugins.add(pluginId);
    } else {
      userPlugins.delete(pluginId);
    }
  }

  /**
   * Check if a plugin is enabled for a user
   */
  isEnabled(userId: string, pluginId: string): boolean {
    return this.enabledPlugins.get(userId)?.has(pluginId) ?? false;
  }
}

export const pluginRegistry = new PluginRegistry();
```

#### 1.3 Database Schema Additions

**File**: `migrations/2010_add_productivity_plugins.sql`

```sql
-- Plugin configurations per user
CREATE TABLE IF NOT EXISTS user_plugin_configs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,

  -- OAuth credentials (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP,
  scopes TEXT[], -- Array of granted scopes

  -- Plugin-specific settings (JSON)
  settings JSONB DEFAULT '{}'::jsonb,

  -- Sync metadata
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  sync_token TEXT, -- For incremental sync
  sync_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, plugin_id)
);

CREATE INDEX idx_user_plugin_configs_user_id ON user_plugin_configs(user_id);
CREATE INDEX idx_user_plugin_configs_enabled ON user_plugin_configs(enabled) WHERE enabled = true;

-- Sync logs for debugging and monitoring
CREATE TABLE IF NOT EXISTS plugin_sync_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,

  status VARCHAR(20) NOT NULL, -- 'success', 'partial', 'failed'
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_deleted INTEGER DEFAULT 0,

  errors JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER,

  sync_started_at TIMESTAMP NOT NULL,
  sync_completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plugin_sync_logs_user_plugin ON plugin_sync_logs(user_id, plugin_id);
CREATE INDEX idx_plugin_sync_logs_created_at ON plugin_sync_logs(created_at DESC);

-- Extracted items from external services
CREATE TABLE IF NOT EXISTS plugin_extracted_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,

  -- Source identification
  source_id VARCHAR(500) NOT NULL, -- ID from external service
  source_url TEXT,

  -- Item data
  item_type VARCHAR(50) NOT NULL, -- 'email', 'task', 'event', 'note', 'contact'
  title TEXT NOT NULL,
  description TEXT,

  -- Metadata
  priority VARCHAR(20), -- 'low', 'medium', 'high', 'urgent'
  status VARCHAR(50), -- 'pending', 'in_progress', 'completed', 'cancelled'
  due_date TIMESTAMP,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,

  -- AI enrichment
  ai_summary TEXT,
  ai_action_items TEXT[],
  ai_category VARCHAR(100),
  ai_sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative', 'urgent'

  -- Flags
  is_actionable BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  -- Timestamps
  source_created_at TIMESTAMP,
  source_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, plugin_id, source_id)
);

CREATE INDEX idx_extracted_items_user_plugin ON plugin_extracted_items(user_id, plugin_id);
CREATE INDEX idx_extracted_items_type ON plugin_extracted_items(item_type);
CREATE INDEX idx_extracted_items_actionable ON plugin_extracted_items(is_actionable) WHERE is_actionable = true;
CREATE INDEX idx_extracted_items_due_date ON plugin_extracted_items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_extracted_items_ai_category ON plugin_extracted_items(ai_category);

-- Action execution history
CREATE TABLE IF NOT EXISTS plugin_action_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,

  action_name VARCHAR(100) NOT NULL,
  action_params JSONB DEFAULT '{}'::jsonb,

  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  result JSONB,
  error TEXT,

  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_action_history_user ON plugin_action_history(user_id);
CREATE INDEX idx_action_history_created_at ON plugin_action_history(created_at DESC);
```

---

### Phase 2: Gmail Integration (Week 3-4)

#### 2.1 Gmail Plugin Implementation

**File**: `server/plugins/GmailPlugin.ts`

```typescript
import { google } from 'googleapis';
import { BaseProductivityPlugin, PluginConfig, PluginCredentials, SyncResult, ExtractedItem } from './BaseProductivityPlugin';
import { Tool } from '../utils/ToolRegistry';
import { KnowledgeItem } from '../services/KnowledgeService';
import { db } from '../../db';
import { userPluginConfigs, pluginExtractedItems } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const GMAIL_CONFIG: PluginConfig = {
  id: 'gmail',
  name: 'Gmail',
  description: 'Integrate with Gmail for email management and AI-powered action item extraction',
  version: '1.0.0',
  category: 'communication',
  icon: '📧',
  oauth: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: `${process.env.APP_URL}/api/oauth/callback/gmail`,
  },
  api: {
    baseUrl: 'https://gmail.googleapis.com',
    rateLimit: 250, // requests per user per second
    timeout: 30000,
  },
  settings: {
    syncFrequency: {
      type: 'select',
      label: 'Sync Frequency',
      default: '15min',
      options: ['5min', '15min', '30min', '1hour', '4hour'],
      required: true,
    },
    maxEmails: {
      type: 'number',
      label: 'Max emails per sync',
      default: 50,
      required: true,
    },
    autoExtractTasks: {
      type: 'boolean',
      label: 'Auto-extract tasks from emails',
      default: true,
    },
    labels: {
      type: 'string',
      label: 'Labels to sync (comma-separated)',
      default: 'INBOX,IMPORTANT',
    },
  },
};

export class GmailPlugin extends BaseProductivityPlugin {
  private anthropic: Anthropic;

  constructor() {
    super(GMAIL_CONFIG);
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async initialize(userId: string): Promise<void> {
    // Check if user config exists, create if not
    const existing = await db.query.userPluginConfigs.findFirst({
      where: (configs, { eq, and }) =>
        and(eq(configs.userId, userId), eq(configs.pluginId, this.config.id)),
    });

    if (!existing) {
      await db.insert(userPluginConfigs).values({
        userId,
        pluginId: this.config.id,
        enabled: false,
        settings: this.config.settings
          ? Object.entries(this.config.settings).reduce((acc, [key, setting]) => {
              acc[key] = setting.default;
              return acc;
            }, {} as Record<string, any>)
          : {},
      });
    }
  }

  async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    // Encrypt and store credentials
    const encrypted = await this.encryptCredentials(credentials);

    await db
      .update(userPluginConfigs)
      .set({
        enabled: true,
        accessTokenEncrypted: encrypted.accessToken,
        refreshTokenEncrypted: encrypted.refreshToken,
        tokenExpiresAt: credentials.expiresAt,
        scopes: credentials.scope,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPluginConfigs.userId, userId),
          eq(userPluginConfigs.pluginId, this.config.id)
        )
      );

    // Perform initial sync
    await this.sync(userId, { limit: 100, incremental: false });
  }

  async disable(userId: string): Promise<void> {
    await db
      .update(userPluginConfigs)
      .set({
        enabled: false,
        syncEnabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPluginConfigs.userId, userId),
          eq(userPluginConfigs.pluginId, this.config.id)
        )
      );
  }

  async getCredentials(userId: string): Promise<PluginCredentials | null> {
    const config = await db.query.userPluginConfigs.findFirst({
      where: (configs, { eq, and }) =>
        and(eq(configs.userId, userId), eq(configs.pluginId, this.config.id)),
    });

    if (!config || !config.accessTokenEncrypted) return null;

    const decrypted = await this.decryptCredentials({
      accessToken: config.accessTokenEncrypted,
      refreshToken: config.refreshTokenEncrypted,
    });

    return {
      accessToken: decrypted.accessToken,
      refreshToken: decrypted.refreshToken,
      expiresAt: config.tokenExpiresAt || undefined,
      scope: config.scopes || undefined,
    };
  }

  async refreshCredentials(userId: string): Promise<PluginCredentials> {
    const current = await this.getCredentials(userId);
    if (!current?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.config.oauth!.clientId,
      process.env.GOOGLE_CLIENT_SECRET,
      this.config.oauth!.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: current.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const newCredentials: PluginCredentials = {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || current.refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      scope: credentials.scope?.split(' '),
    };

    // Update in database
    const encrypted = await this.encryptCredentials(newCredentials);
    await db
      .update(userPluginConfigs)
      .set({
        accessTokenEncrypted: encrypted.accessToken,
        refreshTokenEncrypted: encrypted.refreshToken,
        tokenExpiresAt: newCredentials.expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPluginConfigs.userId, userId),
          eq(userPluginConfigs.pluginId, this.config.id)
        )
      );

    return newCredentials;
  }

  async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      errors: [],
      lastSyncTime: new Date(),
    };

    try {
      let credentials = await this.getCredentials(userId);
      if (!credentials) {
        throw new Error('No credentials found');
      }

      // Check if token is expired
      if (!this.isCredentialsValid(credentials)) {
        credentials = await this.refreshCredentials(userId);
      }

      // Create Gmail client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: credentials.accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get user settings
      const config = await db.query.userPluginConfigs.findFirst({
        where: (configs, { eq, and }) =>
          and(eq(configs.userId, userId), eq(configs.pluginId, this.config.id)),
      });

      const settings = config?.settings || {};
      const maxResults = options?.limit || settings.maxEmails || 50;
      const labels = settings.labels?.split(',').map((l: string) => l.trim()) || ['INBOX'];

      // Fetch emails
      const query = options?.since
        ? `after:${Math.floor(options.since.getTime() / 1000)}`
        : 'is:unread OR label:important';

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        labelIds: labels,
      });

      const messages = listResponse.data.messages || [];
      result.itemsProcessed = messages.length;

      // Process each email
      for (const message of messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          // Extract email data
          const headers = fullMessage.data.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value;
          const body = this.extractEmailBody(fullMessage.data);

          // Check if email already exists
          const existing = await db.query.pluginExtractedItems.findFirst({
            where: (items, { eq, and }) =>
              and(
                eq(items.userId, userId),
                eq(items.pluginId, this.config.id),
                eq(items.sourceId, message.id!)
              ),
          });

          if (existing) {
            result.itemsUpdated++;
            continue;
          }

          // Use AI to analyze email
          let aiAnalysis = null;
          if (settings.autoExtractTasks) {
            aiAnalysis = await this.analyzeEmailWithAI(subject, from, body);
          }

          // Store extracted item
          await db.insert(pluginExtractedItems).values({
            userId,
            pluginId: this.config.id,
            sourceId: message.id!,
            sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
            itemType: 'email',
            title: subject,
            description: body.substring(0, 1000),
            metadata: {
              from,
              date,
              labels: fullMessage.data.labelIds,
              threadId: fullMessage.data.threadId,
            },
            aiSummary: aiAnalysis?.summary,
            aiActionItems: aiAnalysis?.actionItems,
            aiCategory: aiAnalysis?.category,
            aiSentiment: aiAnalysis?.sentiment,
            isActionable: aiAnalysis?.isActionable || false,
            isRead: fullMessage.data.labelIds?.includes('UNREAD') === false,
            sourceCreatedAt: date ? new Date(date) : new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          result.itemsCreated++;
        } catch (error) {
          result.errors.push({
            item: message.id!,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update sync metadata
      await db
        .update(userPluginConfigs)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userPluginConfigs.userId, userId),
            eq(userPluginConfigs.pluginId, this.config.id)
          )
        );

      result.success = true;
      return result;
    } catch (error) {
      result.errors.push({
        item: 'sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return result;
    } finally {
      // Log sync
      const duration = Date.now() - startTime;
      console.log(`Gmail sync completed in ${duration}ms:`, result);
    }
  }

  getTools(): Tool[] {
    return [
      {
        name: 'gmail-search',
        description: 'Search user\'s Gmail for specific emails',
        execute: async (userId: string, query: string) => {
          return await this.searchEmails(userId, query);
        },
      },
      {
        name: 'gmail-get-unread',
        description: 'Get unread emails for user',
        execute: async (userId: string, limit: number = 10) => {
          return await this.getUnreadEmails(userId, limit);
        },
      },
      {
        name: 'gmail-mark-read',
        description: 'Mark email as read',
        execute: async (userId: string, emailId: string) => {
          return await this.markAsRead(userId, emailId);
        },
      },
      {
        name: 'gmail-create-draft',
        description: 'Create a draft email',
        execute: async (
          userId: string,
          to: string,
          subject: string,
          body: string
        ) => {
          return await this.createDraft(userId, to, subject, body);
        },
      },
    ];
  }

  async getKnowledgeItems(userId: string, prompt: string): Promise<KnowledgeItem[]> {
    // Check if prompt mentions emails, inbox, messages, etc.
    const emailKeywords = ['email', 'inbox', 'message', 'mail', 'unread', 'gmail'];
    const hasEmailContext = emailKeywords.some(keyword =>
      prompt.toLowerCase().includes(keyword)
    );

    if (!hasEmailContext) return [];

    // Get recent actionable emails
    const items = await db.query.pluginExtractedItems.findMany({
      where: (items, { eq, and }) =>
        and(
          eq(items.userId, userId),
          eq(items.pluginId, this.config.id),
          eq(items.isActionable, true)
        ),
      limit: 5,
      orderBy: (items, { desc }) => [desc(items.sourceCreatedAt)],
    });

    return items.map(item => ({
      id: item.id.toString(),
      source: 'Gmail',
      title: item.title,
      content: item.aiSummary || item.description || '',
      relevance: 0.9,
      category: item.aiCategory || 'email',
      metadata: {
        from: item.metadata.from,
        actionItems: item.aiActionItems,
        sentiment: item.aiSentiment,
        url: item.sourceUrl,
      },
    }));
  }

  async extractItems(userId: string, rawData: any[]): Promise<ExtractedItem[]> {
    // Not used in this implementation - extraction happens in sync()
    return [];
  }

  async executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    switch (action) {
      case 'search':
        return await this.searchEmails(userId, params.query);
      case 'get-unread':
        return await this.getUnreadEmails(userId, params.limit);
      case 'mark-read':
        return await this.markAsRead(userId, params.emailId);
      case 'create-draft':
        return await this.createDraft(
          userId,
          params.to,
          params.subject,
          params.body
        );
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // Private helper methods

  private async analyzeEmailWithAI(subject: string, from: string, body: string) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Analyze this email and extract key information:

Subject: ${subject}
From: ${from}
Body: ${body.substring(0, 2000)}

Provide a JSON response with:
1. summary: A brief 1-2 sentence summary
2. actionItems: Array of action items (if any)
3. category: The category (work, personal, finance, travel, etc.)
4. sentiment: The tone (positive, neutral, negative, urgent)
5. isActionable: Boolean indicating if this requires action
6. priority: low, medium, high, or urgent

Respond ONLY with valid JSON.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return null;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return null;
    }
  }

  private extractEmailBody(messageData: any): string {
    if (messageData.payload?.body?.data) {
      return Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
    }

    if (messageData.payload?.parts) {
      for (const part of messageData.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return '';
  }

  private async encryptCredentials(credentials: PluginCredentials) {
    // Use existing APIKeyService encryption
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY || '', 'hex');

    const encrypt = (text: string) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    };

    return {
      accessToken: encrypt(credentials.accessToken),
      refreshToken: credentials.refreshToken ? encrypt(credentials.refreshToken) : undefined,
    };
  }

  private async decryptCredentials(encrypted: { accessToken: string; refreshToken?: string | null }) {
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY || '', 'hex');

    const decrypt = (text: string) => {
      const parts = text.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    };

    return {
      accessToken: decrypt(encrypted.accessToken),
      refreshToken: encrypted.refreshToken ? decrypt(encrypted.refreshToken) : undefined,
    };
  }

  private async searchEmails(userId: string, query: string) {
    // Implementation
    return { results: [] };
  }

  private async getUnreadEmails(userId: string, limit: number) {
    // Implementation
    return { emails: [] };
  }

  private async markAsRead(userId: string, emailId: string) {
    // Implementation
    return { success: true };
  }

  private async createDraft(userId: string, to: string, subject: string, body: string) {
    // Implementation
    return { draftId: 'draft_123' };
  }
}
```

---

### Phase 3: Personal Assistant Agent (Week 5-6)

#### 3.1 Create Personal Assistant Agent

**File**: `server/agents/PersonalAssistantAgent.ts`

```typescript
import { BaseAgent } from './BaseAgent';
import { pluginRegistry } from '../plugins/PluginRegistry';
import { ToolRegistry } from '../utils/ToolRegistry';
import { SharedMemory } from '../utils/SharedMemory';
import Anthropic from '@anthropic-ai/sdk';

export class PersonalAssistantAgent extends BaseAgent {
  private anthropic: Anthropic;

  constructor() {
    super('personal-assistant');
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  protected async setup(): Promise<void> {
    this.logger.info('Personal Assistant Agent initialized');
  }

  async initialize(toolRegistry: ToolRegistry): Promise<void> {
    // Register all plugin tools
    const plugins = pluginRegistry.getAll();
    for (const plugin of plugins) {
      const tools = plugin.getTools();
      tools.forEach(tool => {
        toolRegistry.registerTool(tool);
        this.logger.info(`Registered tool: ${tool.name} from plugin: ${plugin.config.name}`);
      });
    }

    await this.setup();
  }

  async executeTask(task: string | {
    prompt: string;
    userId: string;
    sharedMemory?: SharedMemory;
    context?: string;
  }): Promise<any> {
    const taskData = typeof task === 'string'
      ? { prompt: task, userId: 'unknown' }
      : task;

    this.logger.info(`Personal Assistant processing: ${taskData.prompt}`);

    try {
      // Get user's enabled plugins
      const enabledPlugins = pluginRegistry.getEnabledForUser(taskData.userId);

      // Gather knowledge from all enabled plugins
      const knowledgePromises = enabledPlugins.map(plugin =>
        plugin.getKnowledgeItems(taskData.userId, taskData.prompt)
      );
      const knowledgeResults = await Promise.all(knowledgePromises);
      const allKnowledge = knowledgeResults.flat();

      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(enabledPlugins, allKnowledge);
      const userPrompt = this.buildUserPrompt(taskData.prompt, taskData.context, allKnowledge);

      // Call AI with full context
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Parse AI response
      const content = response.content[0];
      if (content.type === 'text') {
        return {
          response: content.text,
          knowledgeUsed: allKnowledge.length,
          pluginsUsed: enabledPlugins.map(p => p.config.name),
        };
      }

      return { response: 'No response generated' };
    } catch (error) {
      this.logger.error('Personal Assistant execution failed', error as Error);
      throw error;
    }
  }

  private buildSystemPrompt(plugins: any[], knowledge: any[]): string {
    const pluginNames = plugins.map(p => p.config.name).join(', ');

    return `You are a personal AI assistant with access to the user's productivity data.

Available integrations: ${pluginNames}

You have access to:
- User's emails and action items from Gmail
- Calendar events and schedule
- Tasks and todos
- Code generation capabilities

Your role:
1. Help manage the user's daily tasks and priorities
2. Extract action items from emails and messages
3. Suggest optimal times for tasks based on calendar
4. Generate code when requested
5. Provide context-aware assistance based on user's current activities

When responding:
- Be concise and actionable
- Prioritize urgent items
- Reference specific emails, events, or tasks when relevant
- Suggest next steps
- Use the user's actual data from integrated services

Current context includes ${knowledge.length} relevant items from the user's connected services.`;
  }

  private buildUserPrompt(prompt: string, context: string | undefined, knowledge: any[]): string {
    let userPrompt = prompt;

    if (context) {
      userPrompt = `Context: ${context}\n\nRequest: ${prompt}`;
    }

    if (knowledge.length > 0) {
      userPrompt += `\n\nRelevant information from your connected services:\n`;
      knowledge.forEach((item, index) => {
        userPrompt += `\n${index + 1}. [${item.source}] ${item.title}`;
        if (item.content) {
          userPrompt += `\n   ${item.content.substring(0, 200)}...`;
        }
        if (item.metadata?.actionItems) {
          userPrompt += `\n   Action items: ${item.metadata.actionItems.join(', ')}`;
        }
      });
    }

    return userPrompt;
  }
}
```

---

### Phase 4: UI Integration (Week 6-7)

#### 4.1 Plugin Settings Page

**File**: `client/src/pages/Integrations.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  enabled: boolean;
  lastSync?: string;
  status: 'connected' | 'error' | 'not_configured';
}

export function IntegrationsPage() {
  const { toast } = useToast();

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await fetch('/api/plugins');
      return res.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (pluginId: string) => {
      const res = await fetch(`/api/plugins/${pluginId}/connect`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to OAuth flow
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
      const res = await fetch(`/api/plugins/${pluginId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Plugin status updated',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const categories = ['productivity', 'communication', 'storage', 'analytics'];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your favorite apps to enhance your AI assistant's capabilities
        </p>
      </div>

      {categories.map(category => {
        const categoryPlugins = plugins?.filter((p: Plugin) => p.category === category);
        if (!categoryPlugins?.length) return null;

        return (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 capitalize">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPlugins.map((plugin: Plugin) => (
                <Card key={plugin.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{plugin.icon}</span>
                        <div>
                          <CardTitle>{plugin.name}</CardTitle>
                          <Badge variant={
                            plugin.status === 'connected' ? 'default' :
                            plugin.status === 'error' ? 'destructive' : 'secondary'
                          }>
                            {plugin.status === 'connected' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {plugin.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {plugin.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={plugin.enabled}
                        onCheckedChange={(enabled) =>
                          toggleMutation.mutate({ pluginId: plugin.id, enabled })
                        }
                        disabled={plugin.status === 'not_configured'}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">
                      {plugin.description}
                    </CardDescription>
                    {plugin.status === 'not_configured' && (
                      <Button
                        onClick={() => connectMutation.mutate(plugin.id)}
                        className="w-full"
                      >
                        Connect {plugin.name}
                      </Button>
                    )}
                    {plugin.lastSync && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last synced: {new Date(plugin.lastSync).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

#### 4.2 Personal Assistant Chat Interface

**File**: `client/src/pages/Assistant.tsx`

```typescript
import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Loader2, Send, Mail, Calendar, CheckSquare, Code } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    pluginsUsed?: string[];
    knowledgeUsed?: number;
  };
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: {
          pluginsUsed: data.pluginsUsed,
          knowledgeUsed: data.knowledgeUsed,
        },
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    sendMutation.mutate(input);
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="container mx-auto p-6 h-screen flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Personal AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask me anything about your emails, calendar, tasks, or request code generation
        </p>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">How can I help you today?</h3>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  <Button variant="outline" onClick={() => setInput('What urgent emails do I have?')}>
                    <Mail className="w-4 h-4 mr-2" />
                    Check emails
                  </Button>
                  <Button variant="outline" onClick={() => setInput('What\'s on my calendar today?')}>
                    <Calendar className="w-4 h-4 mr-2" />
                    View calendar
                  </Button>
                  <Button variant="outline" onClick={() => setInput('What tasks are due soon?')}>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Check tasks
                  </Button>
                  <Button variant="outline" onClick={() => setInput('Generate a React component')}>
                    <Code className="w-4 h-4 mr-2" />
                    Generate code
                  </Button>
                </div>
              </div>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.metadata && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {message.metadata.pluginsUsed?.map(plugin => (
                      <Badge key={plugin} variant="secondary" className="text-xs">
                        {plugin}
                      </Badge>
                    ))}
                    {message.metadata.knowledgeUsed > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {message.metadata.knowledgeUsed} items referenced
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sendMutation.isPending && (
            <div className="flex justify-start mb-4">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              disabled={sendMutation.isPending}
            />
            <Button onClick={handleSend} disabled={sendMutation.isPending || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

---

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create BaseProductivityPlugin interface
- [ ] Implement PluginRegistry
- [ ] Add database tables and migrations
- [ ] Set up OAuth routes for Gmail
- [ ] Test plugin registration system

### Week 3-4: Gmail Integration
- [ ] Implement GmailPlugin
- [ ] Set up Google Cloud OAuth credentials
- [ ] Test email syncing
- [ ] Implement AI-powered email analysis
- [ ] Test action item extraction

### Week 5-6: Personal Assistant
- [ ] Create PersonalAssistantAgent
- [ ] Integrate with PluginRegistry
- [ ] Build context-aware prompting
- [ ] Test dual-mode (code + assistant)

### Week 7-8: UI & Polish
- [ ] Build Integrations page
- [ ] Build Assistant chat interface
- [ ] Add plugin status indicators
- [ ] Implement sync scheduling
- [ ] Write documentation
- [ ] Test end-to-end flows

---

## Next Plugins to Add

### Calendar Plugin (Google Calendar)
- Sync events
- Find free time slots
- Suggest meeting times
- Detect scheduling conflicts

### Tasks Plugin (Google Tasks / Microsoft To Do)
- Aggregate tasks from multiple sources
- Auto-create tasks from emails
- Priority management
- Due date tracking

### Notion Plugin
- Access databases
- Create pages
- Search notes
- Knowledge retrieval

---

## Success Metrics

1. **User Engagement**
   - Daily active users of assistant mode
   - Number of plugins connected per user
   - Messages sent to personal assistant

2. **Productivity Impact**
   - Action items extracted from emails
   - Tasks auto-created
   - Time saved on manual organization

3. **Technical Metrics**
   - Plugin sync success rate
   - API response times
   - OAuth connection stability
   - AI accuracy for email analysis

---

## Summary

This plan transforms your AI Library into a **dual-purpose platform**:

1. **Code Generation Mode** (existing) - Continue generating React components
2. **Personal Assistant Mode** (new) - Manage daily tasks with AI

**Key Benefits**:
- ✅ Builds on existing architecture
- ✅ Maintains backward compatibility
- ✅ Clean plugin system for extensibility
- ✅ Secure credential management
- ✅ AI-powered intelligence across all data sources

**Estimated Timeline**: 6-8 weeks for full Gmail integration + Personal Assistant

Ready to start with Phase 1?
