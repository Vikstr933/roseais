import { google, calendar_v3 } from 'googleapis';
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

const logger = new SimpleLogger('GoogleCalendarPlugin');

interface UserCalendarState {
  oauth2Client: OAuth2Client;
  calendar: calendar_v3.Calendar;
  credentials: PluginCredentials;
}

/**
 * Google Calendar plugin for integrating calendar events
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Event synchronization
 * - AI-powered event analysis
 * - Create/update/delete events
 * - Find available time slots
 */
export class GoogleCalendarPlugin extends BaseProductivityPlugin {
  private oauth2Client?: OAuth2Client;
  private calendar?: calendar_v3.Calendar;
  private anthropic: Anthropic;
  private userStates: Map<string, UserCalendarState> = new Map();

  constructor() {
    const metadata: PluginMetadata = {
      id: 'google-calendar',
      name: 'Google Calendar',
      version: '1.0.0',
      description: 'Integrate Google Calendar for event management, scheduling, and availability tracking',
      author: 'AI Library Team',
      category: 'productivity',
      icon: '📅',
      requiresAuth: true,
      authType: 'oauth2',
      capabilities: [
        'list_events',
        'create_event',
        'update_event',
        'delete_event',
        'find_available_slots',
        'get_schedule'
      ],
      settings: {
        syncFrequency: 'hourly',
        maxEventsPerSync: 100,
        daysToSync: 30
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
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/plugins/google-calendar/callback'
      );

      this.updateStatus({ initialized: true });

      logger.info('Google Calendar plugin initialized', { userId });
    } catch (error) {
      logger.error(`Failed to initialize Google Calendar plugin: userId=${userId}`, error as Error);
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
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/plugins/google-calendar/callback'
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

      // Initialize Calendar API client
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Test connection
      await calendar.calendarList.list({ maxResults: 1 });

      // Store per-user state
      this.userStates.set(userId, {
        oauth2Client,
        calendar,
        credentials
      });

      // Also set on instance for backward compatibility
      this.oauth2Client = oauth2Client;
      this.calendar = calendar;

      this.updateStatus({
        enabled: true,
        authenticated: true,
        health: 'healthy'
      });

      logger.info('Google Calendar plugin enabled', { userId });

      this.emitInfo('Google Calendar plugin enabled successfully');
    } catch (error) {
      logger.error(`Failed to enable Google Calendar plugin: userId=${userId}`, error as Error);
      this.updateStatus({
        enabled: false,
        authenticated: false,
        health: 'error',
        healthMessage: 'Authentication failed'
      });
      throw error;
    }
  }

  private async getUserCalendar(userId: string): Promise<calendar_v3.Calendar> {
    let userState = this.userStates.get(userId);

    // If state doesn't exist, try to reload from database
    if (!userState) {
      logger.warn('Calendar state not found in cache, reloading from database', { userId });
      await this.reloadUserState(userId);
      userState = this.userStates.get(userId);

      if (!userState) {
        throw new Error(`Google Calendar not initialized for user ${userId}. Please reconnect your Google Calendar.`);
      }
    }

    // Check if token needs refresh
    await this.ensureValidToken(userId, userState);

    return userState.calendar;
  }

  private async reloadUserState(userId: string): Promise<void> {
    try {
      const { pluginRegistry } = await import('../services/PluginRegistry');
      await pluginRegistry.loadUserPlugins(userId);
      logger.info('Calendar state reloaded for user', { userId });
    } catch (error) {
      logger.error(`Failed to reload Calendar state: userId=${userId}`, error as Error);
      throw error;
    }
  }

  private async ensureValidToken(userId: string, userState: UserCalendarState): Promise<void> {
    const { oauth2Client } = userState;
    const tokens = oauth2Client.credentials;

    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    if (tokens.expiry_date && tokens.expiry_date < Date.now() + expiryBuffer) {
      logger.info('Token expired or expiring soon, refreshing', {
        userId,
        expiresAt: new Date(tokens.expiry_date)
      });

      if (!tokens.refresh_token) {
        logger.error(`No refresh token available: userId=${userId}`);
        throw new Error('Calendar token expired and no refresh token available. Please reconnect your Google Calendar.');
      }

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        userState.credentials.accessToken = credentials.access_token || userState.credentials.accessToken;
        userState.credentials.refreshToken = credentials.refresh_token || userState.credentials.refreshToken;
        userState.credentials.expiresAt = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : userState.credentials.expiresAt;

        await this.saveCredentialsToDatabase(userId, userState.credentials);

        logger.info('Token refreshed successfully', { userId, newExpiry: userState.credentials.expiresAt });
      } catch (error) {
        logger.error(`Failed to refresh token: userId=${userId}`, error as Error);
        throw new Error('Failed to refresh Calendar token. Please reconnect your Google Calendar.');
      }
    }
  }

  private async saveCredentialsToDatabase(userId: string, credentials: PluginCredentials): Promise<void> {
    try {
      const { db } = await import('../../db');
      const { pluginConfigs } = await import('../../db/schema-pg');
      const { eq, and } = await import('drizzle-orm');

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
      logger.error(`Failed to save credentials to database: userId=${userId}`, error as Error);
    }
  }

  public async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.userId = userId;
      this.updateStatus({ syncInProgress: true });

      const calendar = await this.getUserCalendar(userId);

      const daysToSync = this.metadata.settings?.daysToSync || 30;
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + daysToSync);

      logger.info('Starting Calendar sync', { userId, daysToSync });

      // Fetch events
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: options?.maxItems || this.metadata.settings?.maxEventsPerSync || 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      let syncedCount = 0;

      // Process each event
      for (const event of events) {
        try {
          await this.syncEvent(userId, event);
          syncedCount++;

          this.emitSyncProgress({
            current: syncedCount,
            total: events.length,
            message: `Synced ${syncedCount}/${events.length} events`
          });
        } catch (error) {
          logger.error(`Failed to sync event: userId=${userId}, eventId=${event.id}`, error as Error);
        }
      }

      const durationMs = Date.now() - startTime;
      const result: SyncResult = {
        success: true,
        itemsSynced: syncedCount,
        lastSyncTime: new Date(),
        metadata: {
          totalEvents: events.length,
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

      logger.info('Calendar sync completed', { userId, syncedCount, durationMs });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error('Calendar sync failed', error as Error, { userId });

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

  private async syncEvent(userId: string, event: calendar_v3.Schema$Event): Promise<void> {
    const title = event.summary || 'No Title';
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    const description = event.description || '';
    const location = event.location || '';
    const attendees = event.attendees?.map(a => a.email).join(', ') || '';

    // Use AI to analyze event
    const analysis = await this.analyzeEvent(title, description, start || '', attendees);

    // Store in knowledge base
    await db.insert(pluginKnowledge).values({
      userId,
      pluginId: this.metadata.id,
      externalId: event.id!,
      type: 'calendar_event',
      title,
      content: `${description}\nLocation: ${location}\nAttendees: ${attendees}`,
      metadata: {
        start,
        end,
        location,
        attendees: event.attendees,
        htmlLink: event.htmlLink,
        status: event.status,
        analysis
      },
      relevanceScore: this.calculateRelevanceScore(analysis, start || ''),
      timestamp: new Date(start || Date.now()),
      syncedAt: new Date()
    }).onConflictDoUpdate({
      target: [pluginKnowledge.userId, pluginKnowledge.pluginId, pluginKnowledge.externalId],
      set: {
        title,
        content: `${description}\nLocation: ${location}\nAttendees: ${attendees}`,
        metadata: {
          start,
          end,
          location,
          attendees: event.attendees,
          htmlLink: event.htmlLink,
          status: event.status,
          analysis
        },
        relevanceScore: this.calculateRelevanceScore(analysis, start || ''),
        syncedAt: new Date()
      }
    });
  }

  private async analyzeEvent(title: string, description: string, start: string, attendees: string): Promise<any> {
    try {
      const prompt = `Analyze this calendar event and provide:
1. Event type (meeting/call/reminder/deadline/personal/etc)
2. Priority level (high/medium/low)
3. Key topics or agenda items (if any)
4. Preparation needed (yes/no)

Event:
Title: ${title}
Start: ${start}
Description: ${description.substring(0, 500)}
Attendees: ${attendees}

Respond in JSON format with keys: eventType, priority, topics (array), preparationNeeded (boolean)`;

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
        eventType: 'meeting',
        priority: 'medium',
        topics: [],
        preparationNeeded: false
      };
    } catch (error) {
      logger.error('Failed to analyze event', error as Error);
      return {
        eventType: 'unknown',
        priority: 'medium',
        topics: [],
        preparationNeeded: false
      };
    }
  }

  private calculateRelevanceScore(analysis: any, start: string): number {
    let score = 0.5;

    // Increase score for high priority
    if (analysis.priority === 'high') score += 0.3;
    else if (analysis.priority === 'medium') score += 0.1;

    // Increase score for upcoming events (within 24 hours)
    const eventTime = new Date(start).getTime();
    const now = Date.now();
    const hoursUntil = (eventTime - now) / (1000 * 60 * 60);

    if (hoursUntil > 0 && hoursUntil < 24) {
      score += 0.2;
    } else if (hoursUntil < 0) {
      score -= 0.3; // Past event
    }

    // Increase if preparation needed
    if (analysis.preparationNeeded) score += 0.2;

    return Math.max(0, Math.min(1, score));
  }

  public getTools(): Tool[] {
    return [
      {
        name: 'list_calendar_events',
        description: 'Get upcoming calendar events for a specific timeframe',
        parameters: {
          type: 'object',
          properties: {
            timeframe: {
              type: 'string',
              description: 'Timeframe to query: today, tomorrow, this_week, next_week',
              enum: ['today', 'tomorrow', 'this_week', 'next_week']
            }
          },
          required: ['timeframe']
        },
        execute: async (params) => {
          if (!this.userId) {
            logger.error('list_calendar_events called without userId');
            throw new Error('Calendar plugin not initialized with user ID');
          }
          return this.listEvents(this.userId, params.timeframe);
        }
      },
      {
        name: 'create_calendar_event',
        description: 'Create a new calendar event',
        parameters: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Event title/summary'
            },
            start: {
              type: 'string',
              description: 'Start time in ISO format (e.g., 2024-01-15T10:00:00)'
            },
            end: {
              type: 'string',
              description: 'End time in ISO format'
            },
            description: {
              type: 'string',
              description: 'Event description (optional)'
            }
          },
          required: ['summary', 'start', 'end']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Calendar plugin not initialized with user ID');
          }
          return this.createEvent(this.userId, params.summary, params.start, params.end, params.description);
        }
      },
      {
        name: 'find_available_slots',
        description: 'Find available time slots for scheduling',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date to check (YYYY-MM-DD format)'
            },
            duration: {
              type: 'number',
              description: 'Duration in minutes'
            }
          },
          required: ['date', 'duration']
        },
        execute: async (params) => {
          if (!this.userId) {
            throw new Error('Calendar plugin not initialized with user ID');
          }
          return this.findAvailableSlots(this.userId, params.date, params.duration);
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
        type: 'calendar_event' as const,
        title: item.title,
        content: item.content || '',
        metadata: item.metadata as Record<string, any>,
        relevanceScore: item.relevanceScore || 0.5,
        timestamp: item.timestamp,
        source: this.metadata.name
      }));
    } catch (error) {
      logger.error(`Failed to get knowledge items: userId=${userId}`, error as Error);
      return [];
    }
  }

  public async executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    switch (action) {
      case 'list_calendar_events':
      case 'list_events':
        return this.listEvents(userId, params.timeframe);
      case 'create_calendar_event':
      case 'create_event':
        return this.createEvent(userId, params.summary, params.start, params.end, params.description);
      case 'find_available_slots':
        return this.findAvailableSlots(userId, params.date, params.duration);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async listEvents(userId: string, timeframe: string): Promise<any[]> {
    const calendar = await this.getUserCalendar(userId);

    const now = new Date();
    let timeMin: Date;
    let timeMax: Date;

    switch (timeframe) {
      case 'today':
        timeMin = new Date(now.setHours(0, 0, 0, 0));
        timeMax = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'tomorrow':
        timeMin = new Date(now.setDate(now.getDate() + 1));
        timeMin.setHours(0, 0, 0, 0);
        timeMax = new Date(timeMin);
        timeMax.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        timeMin = new Date(now.setHours(0, 0, 0, 0));
        timeMax = new Date(now.setDate(now.getDate() + 7));
        break;
      case 'next_week':
        timeMin = new Date(now.setDate(now.getDate() + 7));
        timeMax = new Date(now.setDate(now.getDate() + 7));
        break;
      default:
        timeMin = new Date();
        timeMax = new Date(now.setDate(now.getDate() + 7));
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items || [];
  }

  private async createEvent(
    userId: string,
    summary: string,
    start: string,
    end: string,
    description?: string
  ): Promise<any> {
    const calendar = await this.getUserCalendar(userId);

    const event = {
      summary,
      description,
      start: {
        dateTime: start,
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: end,
        timeZone: 'America/Los_Angeles'
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });

    logger.info('Calendar event created', { userId, eventId: response.data.id, summary });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink
    };
  }

  private async findAvailableSlots(userId: string, date: string, durationMinutes: number): Promise<any[]> {
    const calendar = await this.getUserCalendar(userId);

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(9, 0, 0, 0)); // 9 AM
    const endOfDay = new Date(targetDate.setHours(17, 0, 0, 0)); // 5 PM

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    const availableSlots: any[] = [];

    let currentTime = startOfDay.getTime();
    const endTime = endOfDay.getTime();
    const duration = durationMinutes * 60 * 1000;

    for (const event of events) {
      const eventStart = new Date(event.start?.dateTime || event.start?.date || '').getTime();
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || '').getTime();

      // Check if there's a gap before this event
      if (eventStart - currentTime >= duration) {
        availableSlots.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(currentTime + duration).toISOString()
        });
      }

      currentTime = Math.max(currentTime, eventEnd);
    }

    // Check remaining time after last event
    if (endTime - currentTime >= duration) {
      availableSlots.push({
        start: new Date(currentTime).toISOString(),
        end: new Date(currentTime + duration).toISOString()
      });
    }

    return availableSlots;
  }

  public async validateCredentials(userId: string): Promise<boolean> {
    try {
      const calendar = await this.getUserCalendar(userId);
      await calendar.calendarList.list({ maxResults: 1 });

      logger.info('Credentials validated successfully', { userId });
      return true;
    } catch (error) {
      logger.error(`Credential validation failed: userId=${userId}`, error as Error);
      return false;
    }
  }
}

export default GoogleCalendarPlugin;
