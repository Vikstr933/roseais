/**
 * Discord Service
 * Handles sending messages to Discord webhook for community engagement
 * 
 * NOTE: For reading messages and two-way communication, use DiscordBotService instead.
 * Webhooks can only send messages, not read them.
 */

import fetch from 'node-fetch';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_INVITE_LINK = process.env.DISCORD_INVITE_LINK;
const DISCORD_BOT_PERMISSIONS = '36703232';

export interface DiscordMessage {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    footer?: {
      text: string;
    };
    timestamp?: string;
  }>;
  username?: string;
  avatar_url?: string;
}

export class DiscordService {
  private static instance: DiscordService;

  static getInstance(): DiscordService {
    if (!DiscordService.instance) {
      DiscordService.instance = new DiscordService();
    }
    return DiscordService.instance;
  }

  /**
   * Send a message to Discord webhook
   */
  async sendMessage(message: DiscordMessage): Promise<boolean> {
    try {
      if (!DISCORD_WEBHOOK_URL) {
        console.warn('[DiscordService] DISCORD_WEBHOOK_URL is not configured');
        return false;
      }

      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: message.username || 'Elon AI',
          avatar_url: message.avatar_url,
          ...message,
        }),
      });

      if (!response.ok) {
        console.error(`[DiscordService] Failed to send message: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[DiscordService] Error sending message to Discord:', error);
      return false;
    }
  }

  /**
   * Send a user feedback or bug report to Discord
   */
  async sendUserFeedback(userId: string, userEmail: string, message: string, type: 'feedback' | 'bug' | 'feature' = 'feedback'): Promise<boolean> {
    const color = type === 'bug' ? 15158332 : type === 'feature' ? 3066993 : 3447003; // Red, Green, Blue

    return this.sendMessage({
      embeds: [
        {
          title: `${type === 'bug' ? '🐛 Bug Report' : type === 'feature' ? '💡 Feature Request' : '💬 Feedback'}`,
          description: message,
          color,
          fields: [
            {
              name: 'User ID',
              value: userId,
              inline: true,
            },
            {
              name: 'Email',
              value: userEmail || 'N/A',
              inline: true,
            },
            {
              name: 'Type',
              value: type,
              inline: true,
            },
          ],
          footer: {
            text: 'Elon AI Community',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  /**
   * Get Discord invite link
   */
  getInviteLink(): string {
    if (process.env.DISCORD_CLIENT_ID) {
      const scopes = encodeURIComponent('bot applications.commands');
      return `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${DISCORD_BOT_PERMISSIONS}&scope=${scopes}`;
    }

    return DISCORD_INVITE_LINK || '';
  }
}

export const discordService = DiscordService.getInstance();
