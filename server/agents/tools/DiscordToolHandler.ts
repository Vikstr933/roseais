/**
 * Discord Tool Handler
 * 
 * Handles Discord message sending and reading
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';
import { discordService } from '../../services/DiscordService';

export class DiscordToolHandler extends BaseToolHandler {
  constructor() {
    super('discord');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'send_discord_message',
      description: 'Send a message to the user\'s Discord community via the Discord bot. Use this when the user asks you to post, share, or announce something in Discord. You can post updates about projects, share progress, announce features, or communicate with the community. The bot must be connected for this to work. You can specify either a channel name (e.g., "gonattis") or a channel ID. If the user mentions a server name (e.g., "Elon server"), use serverName to find the correct server first.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message content to post in Discord. Can include Discord markdown formatting (bold **text**, italic *text*, code blocks, etc.)'
          },
          channelId: {
            type: 'string',
            description: 'Optional Discord channel ID. If not provided, uses the default channel from bot configuration.'
          },
          channelName: {
            type: 'string',
            description: 'Optional Discord channel name (e.g., "gonattis", "general"). If provided, will search for a channel with this name. Takes precedence over channelId if both are provided.'
          },
          serverName: {
            type: 'string',
            description: 'Optional Discord server name (e.g., "Elon", "Extend Media"). If the user mentions a specific server, use this to find the correct server first, then search for the channel within that server. If not provided, uses the default server from bot configuration.'
          }
        },
        required: ['message']
      },
      execute: async (params: Record<string, any>) => {
        return await this.execute(params, context);
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const message = params.message as string;

    if (!message) {
      return {
        success: false,
        error: 'Message is required',
        retryable: false
      };
    }

    try {
      // Use DiscordBotService if available (same as PersonalAssistantAgent does)
      const { discordBotService } = await import('../../services/DiscordBotService');
      
      if (discordBotService.isBotConnected()) {
        try {
          let targetChannelId = params.channelId;
          let targetServerId: string | undefined = undefined;
          
          // If serverName is provided, find the server first
          if (params.serverName) {
            const foundServer = await discordBotService.findServerByName(params.serverName);
            if (foundServer) {
              targetServerId = foundServer.id;
            } else {
              return {
                success: false,
                error: `Could not find server named "${params.serverName}"`,
                retryable: false
              };
            }
          }
          
          if (params.channelName) {
            const foundChannel = await discordBotService.findChannelByName(params.channelName, targetServerId);
            if (foundChannel) {
              targetChannelId = foundChannel.id;
            } else {
              return {
                success: false,
                error: `Could not find channel named "${params.channelName}"`,
                retryable: false
              };
            }
          }

          if (targetChannelId) {
            const success = await discordBotService.sendMessage(targetChannelId, message, undefined);
            if (success) {
              return {
                success: true,
                data: {
                  message: 'Message posted to Discord successfully',
                  channelId: targetChannelId
                }
              };
            }
          }
        } catch (botError) {
          // Fall through to webhook
        }
      }

      // Fallback to webhook
      const success = await discordService.sendMessage({
        content: message
      });

      if (success) {
        return {
          success: true,
          data: {
            message: 'Message sent to Discord via webhook'
          }
        };
      }

      return {
        success: false,
        error: 'Failed to send Discord message',
        retryable: true,
        fallbackSuggestion: 'Discord bot might not be connected. Check if the bot is properly configured and connected to the server.'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    // Check if Discord service is available
    try {
      // Simple check - in reality you might want to verify bot connection
      return discordService !== null;
    } catch {
      return false;
    }
  }

  getDescription(): string {
    return 'Send messages to Discord channels. Can post updates, announcements, or communicate with the community.';
  }

  getUsageExamples(): string[] {
    return [
      'Post an update to Discord',
      'Send a message to the gonattis channel',
      'Announce a new feature in Discord'
    ];
  }
}

export class ReadDiscordMessagesToolHandler extends BaseToolHandler {
  constructor() {
    super('read_discord_messages');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'read_discord_messages',
      description: 'Read recent messages from Discord channels. Use this when the user asks you to check what\'s happening in Discord, read new messages, see what people are talking about, or get updates from Discord channels. You can read from a specific channel, multiple channels, or all channels in the server.',
      parameters: {
        type: 'object',
        properties: {
          channelName: {
            type: 'string',
            description: 'Optional channel name to read from (e.g., "gonattis", "general"). If not provided, reads from all channels.'
          },
          channelId: {
            type: 'string',
            description: 'Optional channel ID to read from. If not provided, reads from all channels.'
          },
          limit: {
            type: 'number',
            description: 'Number of messages to read per channel (default: 10, max: 50)'
          },
          readAllChannels: {
            type: 'boolean',
            description: 'If true, reads messages from all channels in the server. Default: false if channelName or channelId is provided, true otherwise.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.execute(params, context);
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    try {
      // Use DiscordBotService to read messages
      const { discordBotService } = await import('../../services/DiscordBotService');
      
      if (!discordBotService.isBotConnected()) {
        return {
          success: false,
          error: 'Discord bot is not connected',
          retryable: false,
          fallbackSuggestion: 'The Discord bot needs to be connected to read messages. Please check the bot configuration.'
        };
      }

      let targetChannelId = params.channelId;
      
      // Find channel by name if provided
      if (params.channelName && !targetChannelId) {
        const foundChannel = await discordBotService.findChannelByName(params.channelName);
        if (foundChannel) {
          targetChannelId = foundChannel.id;
        }
      }

      const limit = Math.min(params.limit || 10, 50);
      const readAllChannels = params.readAllChannels || (!targetChannelId && !params.channelName);

      if (readAllChannels) {
        // Read from all channels using readMessagesFromServer
        const results = await discordBotService.readMessagesFromServer(Math.min(limit, 50));
        
        const allMessages: any[] = [];
        for (const result of results) {
          allMessages.push(...result.messages.map((msg: any) => ({
            ...msg,
            channelName: result.channelName,
            channelId: result.channelId
          })));
        }

        return {
          success: true,
          data: {
            messages: allMessages,
            messageCount: allMessages.length,
            channelsRead: results.length
          }
        };
      } else if (targetChannelId) {
        // Read from specific channel using readMessages
        const messages = await discordBotService.readMessages(targetChannelId, Math.min(limit, 50));
        
        // Try to get channel name from readMessagesFromServer result
        let channelNameResult = params.channelName || 'Unknown';
        try {
          // Get channel info by reading from server and finding the channel
          const allResults = await discordBotService.readMessagesFromServer(1, [targetChannelId]);
          if (allResults.length > 0 && allResults[0].channelName) {
            channelNameResult = allResults[0].channelName;
          }
        } catch (e) {
          // Use provided name or default
        }
        
        return {
          success: true,
          data: {
            messages,
            channelId: targetChannelId,
            channelName: channelNameResult,
            messageCount: messages.length
          }
        };
      } else {
        return {
          success: false,
          error: 'No channel specified and readAllChannels is false',
          retryable: false
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    try {
      return discordService !== null;
    } catch {
      return false;
    }
  }

  getDescription(): string {
    return 'Read recent messages from Discord channels. Check what\'s happening, see new messages, or get updates.';
  }

  getUsageExamples(): string[] {
    return [
      'Check what\'s happening in Discord',
      'Read messages from the gonattis channel',
      'See recent messages in Discord'
    ];
  }
}

