import { Client } from '@notionhq/client';
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
import { eq, and, desc } from 'drizzle-orm';

const logger = new SimpleLogger('NotionPlugin');

interface UserNotionState {
  client: Client;
  credentials: PluginCredentials;
}

/**
 * Notion plugin for integrating notes, tasks, and databases
 *
 * Features:
 * - API key authentication
 * - Page and database synchronization
 * - AI-powered content analysis
 * - Search across workspace
 * - Create/update pages
 */
export class NotionPlugin extends BaseProductivityPlugin {
  private notionClient?: Client;
  private anthropic: Anthropic;
  private userStates: Map<string, UserNotionState> = new Map();

  constructor() {
    const metadata: PluginMetadata = {
      id: 'notion',
      name: 'Notion',
      version: '1.0.0',
      description: 'Integrate Notion for notes, tasks, databases, and knowledge management',
      author: 'AI Library Team',
      category: 'productivity',
      icon: '📝',
      requiresAuth: true,
      authType: 'api_key',
      capabilities: [
        'search_pages',
        'create_page',
        'query_database',
        'update_page',
        'get_page_content'
      ],
      settings: {
        syncFrequency: 'hourly',
        maxPagesPerSync: 100
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
      logger.info('Notion plugin initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize Notion plugin', error as Error, { userId });
      this.updateStatus({ initialized: false, health: 'error', healthMessage: 'Initialization failed' });
      throw error;
    }
  }

  public async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      this.userId = userId;
      this.credentials = credentials;

      if (!credentials.apiKey) {
        throw new Error('Notion API key is required');
      }

      // Initialize Notion client
      const client = new Client({
        auth: credentials.apiKey
      });

      // Test connection by listing pages
      await client.search({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 1
      });

      // Store per-user state
      this.userStates.set(userId, {
        client,
        credentials
      });

      // Also set on instance for backward compatibility
      this.notionClient = client;

      this.updateStatus({
        enabled: true,
        authenticated: true,
        health: 'healthy'
      });

      logger.info('Notion plugin enabled', { userId });
      this.emitInfo('Notion plugin enabled successfully');
    } catch (error) {
      logger.error('Failed to enable Notion plugin', error as Error, { userId });
      this.updateStatus({
        enabled: false,
        authenticated: false,
        health: 'error',
        healthMessage: 'Authentication failed'
      });
      throw error;
    }
  }

  private getUserNotion(userId: string): Client {
    let userState = this.userStates.get(userId);

    if (!userState) {
      logger.warn('Notion state not found in cache, trying to reload', { userId });
      throw new Error(`Notion not initialized for user ${userId}. Please reconnect your Notion account.`);
    }

    return userState.client;
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.userId = userId;
      this.updateStatus({ syncInProgress: true });

      const client = this.getUserNotion(userId);

      logger.info('Starting Notion sync', { userId });

      // Search for all pages
      const response = await client.search({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: options?.maxItems || this.metadata.settings?.maxPagesPerSync || 100
      });

      const pages = response.results || [];
      let syncedCount = 0;

      // Process each page
      for (const page of pages) {
        try {
          await this.syncPage(userId, page);
          syncedCount++;

          this.emitSyncProgress({
            current: syncedCount,
            total: pages.length,
            message: `Synced ${syncedCount}/${pages.length} pages`
          });
        } catch (error) {
          logger.error('Failed to sync page', error as Error, {
            userId,
            pageId: page.id
          });
        }
      }

      const durationMs = Date.now() - startTime;
      const result: SyncResult = {
        success: true,
        itemsSynced: syncedCount,
        lastSyncTime: new Date(),
        metadata: {
          totalPages: pages.length,
          durationMs
        }
      };

      await db.insert(pluginSyncLogs).values({
        userId,
        pluginId: this.metadata.id,
        syncType: options?.fullSync ? 'full' : 'incremental',
        itemsSynced: syncedCount,
        itemsCreated: syncedCount,
        itemsUpdated: 0,
        itemsDeleted: 0,
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        metadata: result.metadata
      });

      this.updateStatus({
        syncInProgress: false,
        lastSync: new Date(),
        health: 'healthy'
      });

      logger.info('Notion sync completed', { userId, syncedCount, durationMs });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error('Notion sync failed', error as Error, { userId });

      await db.insert(pluginSyncLogs).values({
        userId,
        pluginId: this.metadata.id,
        syncType: options?.fullSync ? 'full' : 'incremental',
        itemsSynced: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs
      });

      this.updateStatus({
        syncInProgress: false,
        health: 'error',
        healthMessage: 'Sync failed'
      });

      throw error;
    }
  }

  private async syncPage(userId: string, page: any): Promise<void> {
    const client = this.getUserNotion(userId);

    // Get page title
    const title = this.extractTitle(page);

    // Get page content
    const blocks = await client.blocks.children.list({
      block_id: page.id
    });

    const content = this.extractContent(blocks.results);

    // Use AI to analyze page
    const analysis = await this.analyzePage(title, content);

    // Store in knowledge base
    await db.insert(pluginKnowledge).values({
      userId,
      pluginId: this.metadata.id,
      externalId: page.id,
      type: this.determineType(page, analysis),
      title,
      content,
      metadata: {
        url: page.url,
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        icon: page.icon,
        cover: page.cover,
        analysis
      },
      relevanceScore: this.calculateRelevanceScore(analysis),
      timestamp: new Date(page.last_edited_time),
      syncedAt: new Date()
    }).onConflictDoUpdate({
      target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
      set: {
        title,
        content,
        metadata: {
          url: page.url,
          createdTime: page.created_time,
          lastEditedTime: page.last_edited_time,
          icon: page.icon,
          cover: page.cover,
          analysis
        },
        relevanceScore: this.calculateRelevanceScore(analysis),
        timestamp: new Date(page.last_edited_time),
        syncedAt: new Date()
      }
    });
  }

  private extractTitle(page: any): string {
    const properties = page.properties;

    // Try to find title property
    for (const key in properties) {
      const prop = properties[key];
      if (prop.type === 'title' && prop.title && prop.title.length > 0) {
        return prop.title[0].plain_text || 'Untitled';
      }
    }

    return 'Untitled';
  }

  private extractContent(blocks: any[]): string {
    let content = '';

    for (const block of blocks) {
      const type = block.type;

      if (block[type]?.rich_text) {
        const text = block[type].rich_text
          .map((rt: any) => rt.plain_text)
          .join('');
        content += text + '\n';
      }
    }

    return content.trim();
  }

  private determineType(page: any, analysis: any): 'note' | 'task' | 'document' {
    // Check if page has database properties that indicate it's a task
    const properties = page.properties;

    for (const key in properties) {
      const prop = properties[key];
      if (prop.type === 'status' || prop.type === 'checkbox') {
        return 'task';
      }
    }

    // Use AI analysis
    if (analysis.contentType === 'task' || analysis.contentType === 'todo') {
      return 'task';
    }

    if (analysis.contentType === 'documentation' || analysis.contentType === 'article') {
      return 'document';
    }

    return 'note';
  }

  private async analyzePage(title: string, content: string): Promise<any> {
    try {
      const prompt = `Analyze this Notion page and provide:
1. Content type (note/task/documentation/article/todo/meeting-notes/etc)
2. Priority level (high/medium/low)
3. Key topics or tags (array of strings)
4. Action items if any (array of strings)

Page:
Title: ${title}
Content: ${content.substring(0, 1000)}

Respond in JSON format with keys: contentType, priority, topics (array), actionItems (array)`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        contentType: 'note',
        priority: 'medium',
        topics: [],
        actionItems: []
      };
    } catch (error) {
      logger.error('Failed to analyze page', error as Error);
      return {
        contentType: 'note',
        priority: 'medium',
        topics: [],
        actionItems: []
      };
    }
  }

  private calculateRelevanceScore(analysis: any): number {
    let score = 0.5;

    if (analysis.priority === 'high') score += 0.3;
    else if (analysis.priority === 'medium') score += 0.1;

    if (analysis.actionItems && analysis.actionItems.length > 0) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  public getTools(): Tool[] {
    return [
      {
        name: 'search_notion_pages',
        description: 'Search through Notion pages using keywords',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        },
        execute: async (params) => {
          if (!this.userId) {
            logger.error('search_notion_pages called without userId');
            throw new Error('Notion plugin not initialized with user ID');
          }
          return this.searchPages(this.userId, params.query);
        }
      },
      {
        name: 'create_notion_page',
        description: 'Create a new Notion page',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Page title'
            },
            content: {
              type: 'string',
              description: 'Page content (markdown or plain text)'
            }
          },
          required: ['title', 'content']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Notion plugin not initialized with user ID');
          }
          return this.createPage(this.userId, params.title, params.content);
        }
      },
      {
        name: 'get_recent_notion_pages',
        description: 'Get recently edited Notion pages',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of pages to return (default: 10)'
            }
          }
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Notion plugin not initialized with user ID');
          }
          return this.getRecentPages(this.userId, params.limit || 10);
        }
      }
    ];
  }

  public async getKnowledgeItems(
    userId: string,
    prompt: string,
    filters?: Record<string, any>
  ): Promise<KnowledgeItem[]> {
    try {
      const query = db
        .select()
        .from(pluginKnowledge)
        .where(
          and(
            eq(pluginKnowledge.userId, userId),
            eq(pluginKnowledge.pluginId, this.metadata.id)
          )
        )
        .orderBy(desc(pluginKnowledge.timestamp))
        .limit(filters?.limit || 20);

      const results = await query;

      return results.map(item => ({
        id: item.externalId,
        type: item.type as any,
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

  public async executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    switch (action) {
      case 'search_pages':
        return this.searchPages(userId, params.query);
      case 'create_page':
        return this.createPage(userId, params.title, params.content);
      case 'get_recent_pages':
        return this.getRecentPages(userId, params.limit || 10);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async searchPages(userId: string, query: string): Promise<any[]> {
    const client = this.getUserNotion(userId);

    const response = await client.search({
      query,
      filter: {
        property: 'object',
        value: 'page'
      }
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: this.extractTitle(page),
      url: page.url,
      lastEdited: page.last_edited_time
    }));
  }

  private async createPage(userId: string, title: string, content: string): Promise<any> {
    const client = this.getUserNotion(userId);

    // Convert content to Notion blocks (simple paragraph blocks)
    const contentBlocks = content.split('\n').filter(line => line.trim()).map(line => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: {
            content: line
          }
        }]
      }
    }));

    const response = await client.pages.create({
      parent: {
        type: 'page_id',
        page_id: process.env.NOTION_PARENT_PAGE_ID || '' // User needs to configure this
      },
      properties: {
        title: {
          title: [{
            text: {
              content: title
            }
          }]
        }
      },
      children: contentBlocks
    });

    logger.info('Notion page created', { userId, pageId: response.id, title });

    return {
      success: true,
      pageId: response.id,
      url: response.url
    };
  }

  private async getRecentPages(userId: string, limit: number): Promise<any[]> {
    const client = this.getUserNotion(userId);

    const response = await client.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: limit
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: this.extractTitle(page),
      url: page.url,
      lastEdited: page.last_edited_time
    }));
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      const client = this.getUserNotion(userId);

      await client.search({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 1
      });

      logger.info('Credentials validated successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Credential validation failed', error as Error, { userId });
      return false;
    }
  }
}

export default NotionPlugin;
