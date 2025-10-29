import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
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

const logger = new SimpleLogger('GmailPlugin');

/**
 * Gmail plugin for integrating email into the AI Library
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Email synchronization
 * - AI-powered email analysis (summaries, action items, sentiment)
 * - Search and retrieval
 * - Send emails through AI agents
 */
interface UserGmailState {
  oauth2Client: OAuth2Client;
  gmail: gmail_v1.Gmail;
  credentials: PluginCredentials;
}

export class GmailPlugin extends BaseProductivityPlugin {
  private oauth2Client?: OAuth2Client;
  private gmail?: gmail_v1.Gmail;
  private anthropic: Anthropic;
  private userStates: Map<string, UserGmailState> = new Map();

  constructor() {
    const metadata: PluginMetadata = {
      id: 'gmail',
      name: 'Gmail',
      version: '1.0.0',
      description: 'Integrate Gmail for email management, searching, and AI-powered insights',
      author: 'AI Library Team',
      category: 'communication',
      icon: '📧',
      requiresAuth: true,
      authType: 'oauth2',
      capabilities: [
        'read_emails',
        'send_emails',
        'search_emails',
        'analyze_emails',
        'extract_action_items',
        'summarize_threads'
      ],
      settings: {
        syncFrequency: 'hourly',
        maxEmailsPerSync: 100,
        analyzeSentiment: true,
        extractActionItems: true
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

      // Initialize OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/plugins/gmail/callback'
      );

      this.updateStatus({ initialized: true });

      logger.info('Gmail plugin initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize Gmail plugin', error as Error, { userId });
      this.updateStatus({ initialized: false, health: 'error', healthMessage: 'Initialization failed' });
      throw error;
    }
  }

  public async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      this.userId = userId;
      this.credentials = credentials;

      // Create OAuth2 client for this user
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/plugins/gmail/callback'
      );

      // Set credentials
      // Handle expiresAt which might be a Date, string, or number
      let expiryDate: number | undefined;
      if (credentials.expiresAt) {
        if (credentials.expiresAt instanceof Date) {
          expiryDate = credentials.expiresAt.getTime();
        } else if (typeof credentials.expiresAt === 'string') {
          expiryDate = new Date(credentials.expiresAt).getTime();
        } else if (typeof credentials.expiresAt === 'number') {
          expiryDate = credentials.expiresAt;
        }
      }

      oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: expiryDate
      });

      // Initialize Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Test connection
      await gmail.users.getProfile({ userId: 'me' });

      // Store per-user state
      this.userStates.set(userId, {
        oauth2Client,
        gmail,
        credentials
      });

      // Also set on instance for backward compatibility
      this.oauth2Client = oauth2Client;
      this.gmail = gmail;

      this.updateStatus({
        enabled: true,
        authenticated: true,
        health: 'healthy'
      });

      logger.info('Gmail plugin enabled', { userId });

      this.emitInfo('Gmail plugin enabled successfully');
    } catch (error) {
      logger.error('Failed to enable Gmail plugin', error as Error, { userId });
      this.updateStatus({
        enabled: false,
        authenticated: false,
        health: 'error',
        healthMessage: 'Authentication failed'
      });
      throw error;
    }
  }

  private async getUserGmail(userId: string): Promise<gmail_v1.Gmail> {
    let userState = this.userStates.get(userId);

    // If state doesn't exist, try to reload from database
    if (!userState) {
      logger.warn('Gmail state not found in cache, reloading from database', { userId });
      await this.reloadUserState(userId);
      userState = this.userStates.get(userId);

      if (!userState) {
        throw new Error(`Gmail not initialized for user ${userId}. Please reconnect your Gmail account.`);
      }
    }

    // Check if token needs refresh
    await this.ensureValidToken(userId, userState);

    return userState.gmail;
  }

  /**
   * Reload user state from database (used when in-memory state is lost)
   */
  private async reloadUserState(userId: string): Promise<void> {
    try {
      const { pluginRegistry } = await import('../services/PluginRegistry');
      await pluginRegistry.loadUserPlugins(userId);
      logger.info('Gmail state reloaded for user', { userId });
    } catch (error) {
      logger.error('Failed to reload Gmail state', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  private async ensureValidToken(userId: string, userState: UserGmailState): Promise<void> {
    const { oauth2Client } = userState;
    const tokens = oauth2Client.credentials;

    // Check if token is expired or about to expire (within 5 minutes)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    if (tokens.expiry_date && tokens.expiry_date < Date.now() + expiryBuffer) {
      logger.info('Token expired or expiring soon, refreshing', {
        userId,
        expiresAt: new Date(tokens.expiry_date)
      });

      if (!tokens.refresh_token) {
        logger.error('No refresh token available', { userId });
        throw new Error('Gmail token expired and no refresh token available. Please reconnect your Gmail account.');
      }

      try {
        // Refresh the token
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        // Update in user state
        userState.credentials.accessToken = credentials.access_token || userState.credentials.accessToken;
        userState.credentials.refreshToken = credentials.refresh_token || userState.credentials.refreshToken;
        userState.credentials.expiresAt = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : userState.credentials.expiresAt;

        // Save to database
        await this.saveCredentialsToDatabase(userId, userState.credentials);

        logger.info('Token refreshed successfully', { userId, newExpiry: userState.credentials.expiresAt });
      } catch (error) {
        logger.error('Failed to refresh token', error as Error, { userId });
        throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.');
      }
    }
  }

  /**
   * Save updated credentials to database
   */
  private async saveCredentialsToDatabase(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      const { db } = await import('../../db');
      const { pluginConfigs } = await import('../../db/schema-pg');
      const { eq, and } = await import('drizzle-orm');

      // Import PluginRegistry to use its encryption method
      const { pluginRegistry } = await import('../services/PluginRegistry');
      const encryptedCredentials = (pluginRegistry as any).encryptCredentials(credentials);

      await db.update(pluginConfigs)
        .set({
          credentials: encryptedCredentials,
          updatedAt: new Date()
        })
        .where(and(
          eq(pluginConfigs.userId, userId),
          eq(pluginConfigs.pluginId, this.metadata.id)
        ));

      logger.info('Credentials saved to database', { userId, pluginId: this.metadata.id });
    } catch (error) {
      logger.error('Failed to save credentials to database', error as Error, { userId });
      // Don't throw - the token is still refreshed in memory
    }
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.userId = userId;
      this.updateStatus({ syncInProgress: true });

      const gmail = await this.getUserGmail(userId);

      const maxResults = options?.maxItems || this.metadata.settings?.maxEmailsPerSync || 100;
      const query = this.buildSearchQuery(options);

      logger.info('Starting Gmail sync', { userId, maxResults, query });

      // Fetch emails
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query
      });

      const messages = response.data.messages || [];
      let syncedCount = 0;

      // Process each email
      for (const message of messages) {
        try {
          await this.syncEmail(userId, message.id!);
          syncedCount++;

          this.emitSyncProgress({
            current: syncedCount,
            total: messages.length,
            message: `Synced ${syncedCount}/${messages.length} emails`
          });
        } catch (error) {
          logger.error('Failed to sync email', error as Error, {
            userId,
            messageId: message.id
          });
        }
      }

      const durationMs = Date.now() - startTime;
      const result: SyncResult = {
        success: true,
        itemsSynced: syncedCount,
        lastSyncTime: new Date(),
        metadata: {
          totalMessages: messages.length,
          durationMs
        }
      };

      // Log sync to database
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

      logger.info('Gmail sync completed', { userId, syncedCount, durationMs });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error('Gmail sync failed', error as Error, { userId });

      // Log failed sync
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

  private async syncEmail(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getUserGmail(userId);

    // Fetch full email
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    // Extract headers
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    // Extract body
    const body = this.extractEmailBody(message.payload);

    // Use AI to analyze email
    const analysis = await this.analyzeEmail(subject, from, body);

    // Store in knowledge base
    await db.insert(pluginKnowledge).values({
      userId,
      pluginId: this.metadata.id,
      externalId: messageId,
      type: 'email',
      title: subject,
      content: body,
      metadata: {
        from,
        to,
        date,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        analysis
      },
      relevanceScore: this.calculateRelevanceScore(analysis),
      timestamp: new Date(parseInt(message.internalDate || '0')),
      syncedAt: new Date()
    }).onConflictDoUpdate({
      target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
      set: {
        title: subject,
        content: body,
        metadata: {
          from,
          to,
          date,
          threadId: message.threadId,
          labelIds: message.labelIds,
          snippet: message.snippet,
          analysis
        },
        relevanceScore: this.calculateRelevanceScore(analysis),
        syncedAt: new Date()
      }
    });
  }

  private extractEmailBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }

      // Fallback to HTML if no plain text
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return '';
  }

  private async analyzeEmail(subject: string, from: string, body: string): Promise<any> {
    try {
      const prompt = `Analyze this email and provide:
1. A concise summary (2-3 sentences)
2. Key action items (if any)
3. Sentiment (positive/neutral/negative)
4. Priority level (high/medium/low)
5. Category (work/personal/newsletter/spam/etc)

Email:
Subject: ${subject}
From: ${from}
Body: ${body.substring(0, 2000)}

Respond in JSON format with keys: summary, actionItems (array), sentiment, priority, category`;

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
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
        summary: subject,
        actionItems: [],
        sentiment: 'neutral',
        priority: 'medium',
        category: 'unknown'
      };
    } catch (error) {
      logger.error('Failed to analyze email', error as Error);
      return {
        summary: subject,
        actionItems: [],
        sentiment: 'neutral',
        priority: 'medium',
        category: 'unknown'
      };
    }
  }

  private calculateRelevanceScore(analysis: any): number {
    let score = 0.5; // Base score

    // Increase score for high priority
    if (analysis.priority === 'high') score += 0.3;
    else if (analysis.priority === 'medium') score += 0.1;

    // Increase score if has action items
    if (analysis.actionItems && analysis.actionItems.length > 0) {
      score += 0.2;
    }

    // Decrease score for newsletters/spam
    if (analysis.category === 'newsletter') score -= 0.2;
    if (analysis.category === 'spam') score -= 0.4;

    return Math.max(0, Math.min(1, score));
  }

  private buildSearchQuery(options?: SyncOptions): string {
    const parts: string[] = [];

    if (options?.since) {
      const dateStr = options.since.toISOString().split('T')[0].replace(/-/g, '/');
      parts.push(`after:${dateStr}`);
    }

    if (options?.until) {
      const dateStr = options.until.toISOString().split('T')[0].replace(/-/g, '/');
      parts.push(`before:${dateStr}`);
    }

    if (options?.filters?.label) {
      parts.push(`label:${options.filters.label}`);
    }

    if (options?.filters?.from) {
      parts.push(`from:${options.filters.from}`);
    }

    return parts.join(' ') || 'in:inbox';
  }

  public getTools(): Tool[] {
    return [
      {
        name: 'search_emails',
        description: 'Search through emails using natural language or Gmail query syntax',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "emails from john about project")'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return'
            }
          },
          required: ['query']
        },
        execute: async (params) => {
          if (!this.userId) {
            logger.error('search_emails called without userId');
            throw new Error('Gmail plugin not initialized with user ID');
          }
          return this.searchEmails(this.userId, params.query, params.maxResults);
        }
      },
      {
        name: 'send_email',
        description: 'Send an email via Gmail',
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient email address'
            },
            subject: {
              type: 'string',
              description: 'Email subject'
            },
            body: {
              type: 'string',
              description: 'Email body content'
            }
          },
          required: ['to', 'subject', 'body']
        },
        execute: async (params) => {
          return this.sendEmail(this.userId!, params.to, params.subject, params.body);
        }
      },
      {
        name: 'get_unread_count',
        description: 'Get the count of unread emails',
        parameters: {
          type: 'object',
          properties: {}
        },
        execute: async () => {
          if (!this.userId) {
            logger.error('get_unread_count called without userId');
            throw new Error('Gmail plugin not initialized with user ID');
          }
          return this.getUnreadCount(this.userId);
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
      // Query database for relevant emails
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
        type: 'email' as const,
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
      case 'send_email':
        return this.sendEmail(userId, params.to, params.subject, params.body);
      case 'search_emails':
        return this.searchEmails(userId, params.query, params.maxResults);
      case 'get_unread_count':
        return this.getUnreadCount(userId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async sendEmail(userId: string, to: string, subject: string, body: string): Promise<any> {
    const gmail = await this.getUserGmail(userId);

    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    logger.info('Email sent', { userId, to, subject, messageId: response.data.id });

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    };
  }

  private async searchEmails(userId: string, query: string, maxResults = 10): Promise<any[]> {
    const gmail = await this.getUserGmail(userId);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    });

    const messages = response.data.messages || [];
    const results: any[] = [];

    for (const message of messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date']
      });

      results.push({
        id: fullMessage.data.id,
        threadId: fullMessage.data.threadId,
        snippet: fullMessage.data.snippet,
        headers: fullMessage.data.payload?.headers
      });
    }

    return results;
  }

  private async getUnreadCount(userId: string): Promise<number> {
    const gmail = await this.getUserGmail(userId);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1
    });

    return response.data.resultSizeEstimate || 0;
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      // getUserGmail already handles token refresh and validation
      const gmail = await this.getUserGmail(userId);

      // Try to get profile to test connection
      await gmail.users.getProfile({ userId: 'me' });

      logger.info('Credentials validated successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Credential validation failed', error as Error, { userId });
      return false;
    }
  }
}

export default GmailPlugin;
