import { WebClient } from '@slack/web-api';
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
import { pluginKnowledge, pluginSyncLogs, pluginConfigs } from '../../db/schema-pg';
import { eq, and, gte, desc } from 'drizzle-orm';
import { CredentialVault } from '../services/CredentialVault';

const logger = new SimpleLogger('SlackPlugin');

/**
 * Slack plugin for integrating team communication into the AI Library
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Message reading and sending
 * - Channel management
 * - AI-powered message analysis
 */
interface UserSlackState {
  client: WebClient;
  credentials: PluginCredentials;
  teamInfo?: {
    id: string;
    name: string;
  };
}

export class SlackPlugin extends BaseProductivityPlugin {
  private anthropic: Anthropic;
  private userStates: Map<string, UserSlackState> = new Map();
  private credentialVault: CredentialVault;

  constructor() {
    const metadata: PluginMetadata = {
      id: 'slack',
      name: 'Slack',
      version: '1.0.0',
      description: 'Integrate Slack for team communication, messaging, and channel management',
      author: 'AI Library Team',
      category: 'communication',
      icon: '💬',
      requiresAuth: true,
      authType: 'oauth2',
      capabilities: [
        'send_messages',
        'read_messages',
        'list_channels',
        'create_channels',
        'search_messages',
        'manage_channels'
      ],
      settings: {
        syncFrequency: 'hourly',
        maxMessagesPerSync: 100
      }
    };

    super(metadata);

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    this.credentialVault = new CredentialVault();
  }

  public async initialize(userId: string): Promise<void> {
    try {
      this.userId = userId;
      logger.info('Slack plugin initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize Slack plugin', error as Error, { userId });
      throw error;
    }
  }

  public async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      this.userId = userId;
      this.credentials = credentials;

      if (!credentials.accessToken) {
        throw new Error('Slack access token is required');
      }

      // Initialize Slack WebClient
      const client = new WebClient(credentials.accessToken);

      // Test connection by getting team info
      const teamInfo = await client.team.info();
      if (!teamInfo.ok || !teamInfo.team) {
        throw new Error('Failed to connect to Slack workspace');
      }

      // Store per-user state
      this.userStates.set(userId, {
        client,
        credentials,
        teamInfo: {
          id: teamInfo.team.id,
          name: teamInfo.team.name || 'Unknown'
        }
      });

      logger.info('Slack plugin enabled', {
        userId,
        teamId: teamInfo.team.id,
        teamName: teamInfo.team.name
      });

      this.updateStatus({ authenticated: true, health: 'healthy' });
    } catch (error) {
      logger.error('Failed to enable Slack plugin', error as Error, { userId });
      this.updateStatus({ authenticated: false, health: 'error' });
      throw error;
    }
  }

  public async disable(userId: string): Promise<void> {
    this.userStates.delete(userId);
    this.updateStatus({ authenticated: false });
    logger.info('Slack plugin disabled', { userId });
  }

  private async getUserSlack(userId: string): Promise<WebClient> {
    const state = this.userStates.get(userId);
    if (!state || !state.client) {
      // Try to reload from database
      const config = await db
        .select()
        .from(pluginConfigs)
        .where(and(
          eq(pluginConfigs.userId, userId),
          eq(pluginConfigs.pluginId, this.metadata.id)
        ))
        .limit(1);

      if (config.length === 0 || !config[0].credentials) {
        throw new Error('Slack plugin not enabled for user');
      }

      // Decrypt and reload credentials
      const credentials = await this.credentialVault.decrypt(config[0].credentials as any);
      await this.enable(userId, credentials);
      
      const newState = this.userStates.get(userId);
      if (!newState || !newState.client) {
        throw new Error('Failed to initialize Slack client');
      }
      return newState.client;
    }

    return state.client;
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.userId = userId;
      this.updateStatus({ syncInProgress: true });

      const client = await this.getUserSlack(userId);

      // Get recent messages from channels
      const channels = await client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 50
      });

      if (!channels.ok || !channels.channels) {
        throw new Error('Failed to fetch channels');
      }

      let syncedCount = 0;
      const maxMessages = options?.maxItems || 100;

      for (const channel of channels.channels.slice(0, 10)) { // Limit to 10 channels
        try {
          const messages = await client.conversations.history({
            channel: channel.id!,
            limit: Math.min(10, maxMessages - syncedCount)
          });

          if (messages.ok && messages.messages) {
            for (const message of messages.messages) {
              if (message.text && message.user) {
                await this.syncMessage(userId, message, channel);
                syncedCount++;
              }
            }
          }
        } catch (error) {
          logger.error('Failed to sync channel', error as Error, {
            userId,
            channelId: channel.id
          });
        }
      }

      const durationMs = Date.now() - startTime;
      const result: SyncResult = {
        success: true,
        itemsSynced: syncedCount,
        lastSyncTime: new Date(),
        metadata: {
          channelsProcessed: channels.channels.length,
          durationMs
        }
      };

      await db.insert(pluginSyncLogs).values({
        userId,
        pluginId: this.metadata.id,
        itemsSynced: syncedCount,
        status: 'completed',
        durationMs
      });

      this.updateStatus({ syncInProgress: false, lastSyncTime: new Date() });
      return result;
    } catch (error) {
      logger.error('Slack sync failed', error as Error, { userId });
      this.updateStatus({
        syncInProgress: false,
        health: 'error',
        healthMessage: 'Sync failed'
      });
      throw error;
    }
  }

  private async syncMessage(userId: string, message: any, channel: any): Promise<void> {
    try {
      // Use AI to analyze message
      const analysis = await this.analyzeMessage(message.text, channel.name);

      // Store in knowledge base
      await db.insert(pluginKnowledge).values({
        userId,
        pluginId: this.metadata.id,
        externalId: message.ts,
        type: 'message',
        title: `Message in #${channel.name}`,
        content: message.text,
        metadata: {
          channelId: channel.id,
          channelName: channel.name,
          userId: message.user,
          timestamp: message.ts,
          analysis
        },
        relevanceScore: this.calculateRelevanceScore(analysis),
        timestamp: new Date(parseFloat(message.ts) * 1000),
        syncedAt: new Date()
      }).onConflictDoUpdate({
        target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
        set: {
          content: message.text,
          metadata: {
            channelId: channel.id,
            channelName: channel.name,
            userId: message.user,
            timestamp: message.ts,
            analysis
          },
          relevanceScore: this.calculateRelevanceScore(analysis),
          syncedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to sync message', error as Error, { userId });
    }
  }

  private async analyzeMessage(text: string, channelName: string): Promise<any> {
    try {
      const prompt = `Analyze this Slack message and provide:
1. A concise summary
2. Key topics discussed
3. Action items (if any)
4. Urgency level (high/medium/low)
5. Category (work/personal/announcement/etc)

Message:
Channel: #${channelName}
Text: ${text.substring(0, 1000)}

Respond in JSON format with keys: summary, topics (array), actionItems (array), urgency, category`;

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
        summary: text.substring(0, 100),
        topics: [],
        actionItems: [],
        urgency: 'low',
        category: 'general'
      };
    } catch (error) {
      logger.error('Failed to analyze message', error as Error);
      return {
        summary: text.substring(0, 100),
        topics: [],
        actionItems: [],
        urgency: 'low',
        category: 'general'
      };
    }
  }

  private calculateRelevanceScore(analysis: any): number {
    let score = 0.5;

    if (analysis.urgency === 'high') score += 0.3;
    else if (analysis.urgency === 'medium') score += 0.1;

    if (analysis.actionItems && analysis.actionItems.length > 0) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  public getTools(): Tool[] {
    return [
      {
        name: 'send_slack_message',
        description: 'Send a message to a Slack channel or user',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel name (e.g., "#general") or user ID'
            },
            text: {
              type: 'string',
              description: 'Message text to send'
            }
          },
          required: ['channel', 'text']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Slack plugin not initialized with user ID');
          }
          return this.sendMessage(this.userId, params.channel, params.text);
        }
      },
      {
        name: 'read_slack_messages',
        description: 'Read recent messages from a Slack channel',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel name (e.g., "#general") or channel ID'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 10)'
            }
          },
          required: ['channel']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Slack plugin not initialized with user ID');
          }
          return this.readMessages(this.userId, params.channel, params.limit || 10);
        }
      },
      {
        name: 'list_slack_channels',
        description: 'List all Slack channels in the workspace',
        parameters: {
          type: 'object',
          properties: {}
        },
        execute: async () => {
          if (!this.userId) {
            throw new Error('Slack plugin not initialized with user ID');
          }
          return this.listChannels(this.userId);
        }
      },
      {
        name: 'search_slack_messages',
        description: 'Search for messages in Slack',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
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
            throw new Error('Slack plugin not initialized with user ID');
          }
          return this.searchMessages(this.userId, params.query, params.limit || 10);
        }
      }
    ];
  }

  private async sendMessage(userId: string, channel: string, text: string): Promise<any> {
    const client = await this.getUserSlack(userId);

    // Resolve channel name to ID if needed
    let channelId = channel;
    if (channel.startsWith('#')) {
      const channelName = channel.slice(1);
      const channels = await client.conversations.list({
        types: 'public_channel,private_channel'
      });
      const foundChannel = channels.channels?.find(c => c.name === channelName);
      if (!foundChannel) {
        throw new Error(`Channel ${channel} not found`);
      }
      channelId = foundChannel.id!;
    }

    const response = await client.chat.postMessage({
      channel: channelId,
      text
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.error}`);
    }

    return {
      success: true,
      message: {
        ts: response.ts,
        channel: response.channel,
        text
      }
    };
  }

  private async readMessages(userId: string, channel: string, limit: number): Promise<any[]> {
    const client = await this.getUserSlack(userId);

    // Resolve channel name to ID if needed
    let channelId = channel;
    if (channel.startsWith('#')) {
      const channelName = channel.slice(1);
      const channels = await client.conversations.list({
        types: 'public_channel,private_channel'
      });
      const foundChannel = channels.channels?.find(c => c.name === channelName);
      if (!foundChannel) {
        throw new Error(`Channel ${channel} not found`);
      }
      channelId = foundChannel.id!;
    }

    const response = await client.conversations.history({
      channel: channelId,
      limit
    });

    if (!response.ok || !response.messages) {
      throw new Error(`Failed to read messages: ${response.error}`);
    }

    return response.messages.map(msg => ({
      text: msg.text,
      user: msg.user,
      ts: msg.ts,
      channel: channelId
    }));
  }

  private async listChannels(userId: string): Promise<any[]> {
    const client = await this.getUserSlack(userId);

    const response = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100
    });

    if (!response.ok || !response.channels) {
      throw new Error(`Failed to list channels: ${response.error}`);
    }

    return response.channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      isArchived: channel.is_archived,
      memberCount: channel.num_members
    }));
  }

  private async searchMessages(userId: string, query: string, limit: number): Promise<any[]> {
    const client = await this.getUserSlack(userId);

    const response = await client.search.messages({
      query,
      count: limit
    });

    if (!response.ok || !response.messages) {
      throw new Error(`Failed to search messages: ${response.error}`);
    }

    return response.messages.matches?.map(match => ({
      text: match.text,
      user: match.user,
      ts: match.ts,
      channel: match.channel?.name
    })) || [];
  }

  public async getKnowledgeItems(userId: string, query: string, limit = 10): Promise<KnowledgeItem[]> {
    try {
      const items = await db
        .select()
        .from(pluginKnowledge)
        .where(
          and(
            eq(pluginKnowledge.userId, userId),
            eq(pluginKnowledge.pluginId, this.metadata.id),
            gte(pluginKnowledge.relevanceScore, 0.3)
          )
        )
        .orderBy(desc(pluginKnowledge.relevanceScore))
        .limit(limit);

      return items.map(item => ({
        id: item.externalId,
        type: 'message' as const,
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
      case 'send_message':
        return this.sendMessage(userId, params.channel, params.text);
      case 'read_messages':
        return this.readMessages(userId, params.channel, params.limit || 10);
      case 'list_channels':
        return this.listChannels(userId);
      case 'search_messages':
        return this.searchMessages(userId, params.query, params.limit || 10);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      const client = await this.getUserSlack(userId);
      const teamInfo = await client.team.info();
      return teamInfo.ok === true;
    } catch (error) {
      logger.error('Credential validation failed', error as Error, { userId });
      return false;
    }
  }
}

export default SlackPlugin;

