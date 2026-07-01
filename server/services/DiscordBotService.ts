/**
 * Discord Bot Service
 * Handles Discord bot functionality for reading and sending messages
 * Uses discord.js library for bot interactions
 */

import { Client, GatewayIntentBits, Message, TextChannel, EmbedBuilder, Events, Attachment, AttachmentBuilder } from 'discord.js';
import { SimpleLogger } from '../utils/SimpleLogger';
import { personalAssistantAgent } from '../agents/PersonalAssistantAgent';
import { getCredentialVault } from './CredentialVault';
import { db } from '../../db';
import { userCredentials, discordUserMappings } from '../../db/schema-pg';
import { eq, and, sql } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';
import { discordMusicService, ParsedMusicCommand } from './DiscordMusicService';
import { registerDiscordApplicationCommands } from './DiscordCommandRegistry';
import { discordLavalinkService } from './DiscordLavalinkService';

const logger = new SimpleLogger('DiscordBotService');

export interface DiscordBotConfig {
  botToken: string;
  channelId?: string; // Optional: specific channel to monitor
  serverId?: string; // Optional: specific server (guild) to monitor
  userId?: string; // User ID who owns this bot configuration
}

export class DiscordBotService {
  private static instance: DiscordBotService;
  private client: Client | null = null;
  private isConnected: boolean = false;
  private config: DiscordBotConfig | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private registeredCommandTargets = new Set<string>();

  private constructor() {
    // Use singleton instance to avoid circular dependency
  }

  static getInstance(): DiscordBotService {
    if (!DiscordBotService.instance) {
      DiscordBotService.instance = new DiscordBotService();
    }
    return DiscordBotService.instance;
  }

  /**
   * Initialize and connect Discord bot
   */
  async connect(config: DiscordBotConfig): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        logger.info('Bot already connected, disconnecting first...');
        await this.disconnect();
      }

      this.config = config;

      // Create new Discord client
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildVoiceStates,
        ],
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Login to Discord
      await this.client.login(config.botToken);
      this.isConnected = true;
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      logger.info('Discord bot connected successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect Discord bot', error as Error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect Discord bot
   */
  async disconnect(): Promise<void> {
    try {
      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      this.isConnected = false;
      this.reconnectAttempts = 0;
      logger.info('Discord bot disconnected');
    } catch (error) {
      logger.error('Error disconnecting Discord bot', error as Error);
    }
  }

  /**
   * Set up Discord event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    // Bot ready event
    this.client.once(Events.ClientReady, async (readyClient) => {
      logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
      
      // Log all servers the bot is a member of
      const guilds = readyClient.guilds.cache;
      logger.info(`Bot is a member of ${guilds.size} server(s):`);
      guilds.forEach((guild) => {
        logger.info(`  - ${guild.name} (ID: ${guild.id})`);
      });
      
      // If no serverId is configured, bot will listen to all servers
      if (!this.config?.serverId) {
        logger.info('No serverId configured - bot will listen to messages from ALL servers it is a member of');
      } else {
        logger.info(`Server filter active - bot will only listen to server: ${this.config.serverId}`);
      }

      await this.registerSlashCommands(readyClient);
      try {
        await discordLavalinkService.initialize(readyClient);
      } catch (error) {
        logger.error('Failed to initialize Lavalink on Discord ready', error as Error);
      }
    });

    this.client.on(Events.Raw, (data) => {
      void discordLavalinkService.sendRawData(data);
    });

    // Message handler
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages (including our own)
        if (message.author.bot) {
          logger.debug(`Ignoring bot message from ${message.author.tag}`);
          return;
        }

        // Check if message mentions the bot or is a direct message FIRST
        // This allows mentions/DMs from any channel/server (if configured)
        const botUser = this.client!.user;
        if (!botUser) {
          logger.warn('Bot user not available');
          return;
        }

        const isMentioned = message.mentions.has(botUser.id) || 
                           message.mentions.users.has(botUser.id) ||
                           message.content.toLowerCase().includes(botUser.username.toLowerCase()) ||
                           message.content.includes(`<@${botUser.id}>`) ||
                           message.content.includes(`<@!${botUser.id}>`);
        
        const isDirectMessage = !message.guild;

        logger.info(`Message received: ${message.content.substring(0, 50)}... | Mentioned: ${isMentioned} | DM: ${isDirectMessage} | Channel: ${message.channel.id} | Server: ${message.guild?.id || 'DM'}`);

        // Only respond to mentions or DMs
        if (!isMentioned && !isDirectMessage) {
          logger.debug('Message ignored - not a mention or DM');
          return;
        }

        // For mentions/DMs: Check server filter if configured, but allow DMs always
        // NOTE: If serverId is not configured, bot will listen to ALL servers it's a member of
        // This allows the bot to work across multiple Discord servers
        if (!isDirectMessage && this.config?.serverId && message.guild?.id !== this.config.serverId) {
          logger.debug(`Message from different server: ${message.guild?.id} (expected: ${this.config.serverId})`);
          return;
        }

        // For non-DM mentions: If channelId is specified, only process from that channel
        // BUT: Always allow DMs regardless of channel config
        if (!isDirectMessage && this.config?.channelId && message.channel.id !== this.config.channelId) {
          logger.debug(`Mention from different channel: ${message.channel.id} (expected: ${this.config.channelId}) - ignoring`);
          return;
        }

        // Process message with Elon
        await this.handleDiscordMessage(message);
      } catch (error) {
        logger.error('Error in message handler', error as Error);
      }
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      logger.error('Discord bot error', error);
      // Attempt to reconnect on error
      this.handleReconnect();
    });

    // Disconnect event - attempt to reconnect
    this.client.on(Events.ShardDisconnect, () => {
      logger.warn('Discord bot disconnected, attempting to reconnect...');
      this.isConnected = false;
      this.handleReconnect();
    });

    // Reconnect event
    this.client.on(Events.ShardReconnecting, () => {
      logger.info('Discord bot reconnecting...');
    });

    // Warn event
    this.client.on(Events.Warn, (warning) => {
      logger.warn(`Discord bot warning: ${warning}`);
    });

    // Debug logging for connection issues
    this.client.on(Events.Debug, (info) => {
      if (info.includes('MESSAGE_CONTENT') || info.includes('intent')) {
        logger.info(`Discord debug: ${info}`);
      }
    });
  }

  private async registerSlashCommands(readyClient: Client<true>): Promise<void> {
    if (!this.config?.botToken) return;

    const clientId = process.env.DISCORD_CLIENT_ID || readyClient.user.id;
    const guildId = process.env.DISCORD_GUILD_ID || this.config.serverId;
    const targetKey = guildId ? `guild:${guildId}` : 'global';

    if (this.registeredCommandTargets.has(targetKey)) {
      logger.info(`Discord slash commands already registered for ${targetKey}`);
      return;
    }

    try {
      await registerDiscordApplicationCommands({
        botToken: this.config.botToken,
        clientId,
        guildId,
      });
      this.registeredCommandTargets.add(targetKey);
    } catch (error) {
      logger.error('Failed to register Discord slash commands on bot startup', error as Error);
    }
  }

  /**
   * Handle automatic reconnection when bot disconnects
   */
  private async handleReconnect(): Promise<void> {
    if (!this.config) {
      logger.warn('No config available for reconnection');
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection attempts.`);
      this.reconnectAttempts = 0; // Reset after a while
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff: 5s, 10s, 20s, 40s, 60s, then 60s intervals
    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 60000);

    logger.info(`Attempting to reconnect Discord bot (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.isConnected && this.config) {
        try {
          const connected = await this.connect(this.config);
          if (connected) {
            logger.info('Discord bot reconnected successfully');
            this.reconnectAttempts = 0; // Reset on successful connection
          } else {
            logger.error('Failed to reconnect Discord bot, will retry later');
            this.handleReconnect(); // Retry
          }
        } catch (error) {
          logger.error('Error during reconnection attempt', error as Error);
          this.handleReconnect(); // Retry
        }
      }
    }, delay);
  }

  /**
   * Detect language from user message and generate localized registration message
   */
  private async generateLocalizedRegistrationMessage(
    userMessage: string,
    discordUsername: string,
    discordUserId: string
  ): Promise<string> {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || ''
      });

      // First, detect the language
      const detectResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Detect the language of this message and respond with ONLY the ISO 639-1 language code (e.g., "en", "sv", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh", "ar"). If uncertain, default to "en".\n\nMessage: "${userMessage}"`
        }]
      });

      const detectedLang = detectResponse.content[0].type === 'text' 
        ? detectResponse.content[0].text.trim().toLowerCase().replace(/[^a-z]/g, '')
        : 'en';

      // Generate localized message
      const messageResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Generate a helpful registration message in the language with ISO code "${detectedLang}". The message should:

1. Greet the user by their username: ${discordUsername}
2. Explain that they need to link their Discord account to their account on the web app
3. Provide step-by-step instructions:
   - Step 1: Log in to the web app: https://newai-sigma.vercel.app
   - Step 2: Go to Settings → Integrations → Discord
   - Step 3: Paste their Discord User ID: ${discordUserId}
   - Step 4: Click "Link Discord Account"
4. Explain how to find their Discord User ID:
   - Open Discord → Settings → Advanced
   - Enable "Developer Mode"
   - Right-click on their name → "Copy ID"
5. End with encouragement and include the registration link: https://newai-sigma.vercel.app

Use Discord markdown formatting (**bold**, etc.) and emojis appropriately. Write naturally in the detected language.`
        }]
      });

      return messageResponse.content[0].type === 'text' 
        ? messageResponse.content[0].text 
        : `Hello ${discordUsername}! 👋\n\nTo help you with your projects, you need to link your Discord account to your account on our web app.\n\n**How to do it:**\n1. Log in to our web app: **https://newai-sigma.vercel.app**\n2. Go to Settings → Integrations → Discord\n3. Paste your Discord User ID: \`${discordUserId}\`\n4. Click "Link Discord Account"\n\n🔗 **Register here:** https://newai-sigma.vercel.app`;
    } catch (error) {
      logger.error('Error generating localized message, using English fallback', error as Error);
      // Fallback to English
      return `Hello ${discordUsername}! 👋\n\nTo help you with your projects, you need to link your Discord account to your account on our web app.\n\n**How to do it:**\n1. Log in to our web app: **https://newai-sigma.vercel.app**\n2. Go to Settings → Integrations → Discord\n3. Paste your Discord User ID: \`${discordUserId}\`\n4. Click "Link Discord Account"\n\n**How do I find my Discord User ID?**\n1. Open Discord → Settings → Advanced\n2. Enable "Developer Mode"\n3. Right-click on your name → "Copy ID"\n\nAfter linking your account, I can help you with your projects! 😊\n\n🔗 **Register here:** https://newai-sigma.vercel.app`;
    }
  }

  /**
   * Send status message to Discord with rate limiting (max 1 per 3 seconds)
   */
  private lastStatusMessageTime: Map<string, number> = new Map();
  private async sendStatusMessage(
    message: Message,
    content: string,
    delayMs: number = 0
  ): Promise<void> {
    const channelKey = message.channel.id;
    const now = Date.now();
    const lastTime = this.lastStatusMessageTime.get(channelKey) || 0;
    
    // Rate limit: max 1 status message per 3 seconds per channel
    if (now - lastTime < 3000) {
      return; // Skip to avoid spam
    }

    // Don't send empty messages
    const trimmedContent = content?.trim() || '';
    if (!trimmedContent) {
      logger.warn('Empty status message, skipping');
      return;
    }

    try {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Show typing indicator
      if (message.channel instanceof TextChannel) {
        message.channel.sendTyping();
      }
      
      await message.reply(trimmedContent);
      this.lastStatusMessageTime.set(channelKey, Date.now());
    } catch (error) {
      logger.warn('Failed to send status message', error as Error);
    }
  }

  /**
   * Generate natural status message using AI
   */
  private async generateNaturalStatusMessage(
    context: string,
    userMessage: string,
    detectedLanguage?: string
  ): Promise<string> {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || ''
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Generate a brief, natural status message in ${detectedLanguage || 'the same language as the user'}. Keep it conversational and friendly. Maximum 100 characters.

Context: ${context}
User message: "${userMessage}"

Examples:
- "Analyserar repot nu... 🔍"
- "Hittar rätt agenter för detta projekt... 🤖"
- "Kollar vilka språk som används... 💻"

Generate ONLY the status message, nothing else.`
        }]
      });

      return response.content[0].type === 'text' 
        ? response.content[0].text.trim()
        : context;
    } catch (error) {
      logger.warn('Failed to generate natural status message', error as Error);
      return context; // Fallback to original context
    }
  }

  /**
   * Handle incoming Discord message and generate response using Elon
   */
  private async handleDiscordMessage(message: Message): Promise<void> {
    try {
      const botUser = this.client!.user;
      if (!botUser) {
        logger.error('Bot user not available when handling message');
        return;
      }

      // Remove bot mentions from message
      let userMessage = message.content
        .replace(`<@${botUser.id}>`, '')
        .replace(`<@!${botUser.id}>`, '')
        .trim();
      
      // Also remove bot username if mentioned
      if (userMessage.toLowerCase().includes(botUser.username.toLowerCase())) {
        userMessage = userMessage.replace(new RegExp(botUser.username, 'gi'), '').trim();
      }
      
      logger.info(`Processing message from ${message.author.tag}: "${userMessage}"`);

      const musicCommand = discordMusicService.parseMusicCommand(userMessage);
      if (musicCommand) {
        await discordMusicService.handleMessageCommand(message, musicCommand);
        return;
      }
      
      // Get user ID from Discord
      const discordUserId = message.author.id;
      const discordUsername = message.author.username;
      
      // Try to find system user ID by looking up Discord user mapping
      let systemUserId: string | null = null;
      
      try {
        const mapping = await db
          .select()
          .from(discordUserMappings)
          .where(eq(discordUserMappings.discordUserId, discordUserId))
          .limit(1);

        if (mapping.length > 0) {
          systemUserId = mapping[0].systemUserId;
          // Update last used timestamp
          await db
            .update(discordUserMappings)
            .set({ lastUsedAt: new Date() })
            .where(eq(discordUserMappings.id, mapping[0].id));
          
          logger.info(`Found Discord user mapping for ${discordUsername} -> system user ${systemUserId}`);
        } else {
          // No mapping found - user needs to link their account
          logger.warn(`No Discord user mapping found for ${discordUsername} (${discordUserId})`);
          
          // Check for attachments even without mapping - we can still inform them
          if (message.attachments && message.attachments.size > 0) {
            const resumeAttachments = Array.from(message.attachments.values()).filter(att => {
              const ext = att.name?.toLowerCase().split('.').pop();
              return ext === 'pdf' || ext === 'docx' || ext === 'tex' || 
                     att.contentType === 'application/pdf' ||
                     att.contentType?.includes('wordprocessingml') ||
                     att.contentType === 'application/x-latex' ||
                     att.contentType === 'text/x-latex';
            });

            if (resumeAttachments.length > 0) {
              const linkMessage = await this.generateLocalizedRegistrationMessage(
                userMessage,
                discordUsername,
                discordUserId
              );
              await message.reply(`📎 Jag ser att du har laddat upp en CV-fil, men du behöver länka ditt konto först.\n\n${linkMessage}`);
              return;
            }
          }
          
          // Generate localized message based on user's language
          const linkMessage = await this.generateLocalizedRegistrationMessage(
            userMessage,
            discordUsername,
            discordUserId
          );
          
          await message.reply(linkMessage);
          return; // Don't process the message further
        }
      } catch (error) {
        logger.error('Error looking up Discord user mapping', error as Error);
        // Fallback: use generic Discord ID (no project access)
        systemUserId = `discord_${discordUserId}`;
      }

      // Check for file attachments (resume files) - after we have systemUserId
      if (message.attachments && message.attachments.size > 0 && systemUserId && !systemUserId.startsWith('discord_')) {
        const resumeAttachments = Array.from(message.attachments.values()).filter(att => {
          const ext = att.name?.toLowerCase().split('.').pop();
          return ext === 'pdf' || ext === 'docx' || ext === 'tex' || 
                 att.contentType === 'application/pdf' ||
                 att.contentType?.includes('wordprocessingml') ||
                 att.contentType === 'application/x-latex' ||
                 att.contentType === 'text/x-latex';
        });

        if (resumeAttachments.length > 0) {
          // Process the first resume attachment
          const attachment = resumeAttachments[0];
          try {
            const result = await this.processDiscordAttachment(attachment, systemUserId, message);
            if (result.success && result.resumeId) {
              await message.reply(`✅ Jag har laddat upp ditt CV! (ID: ${result.resumeId}). Du kan nu be mig hitta jobb eller förbättra ditt CV.`);
              // Continue processing the message text if any
              if (!userMessage || userMessage.trim().length === 0) {
                return;
              }
            } else {
              await message.reply(`❌ Kunde inte ladda upp CV-filen: ${result.error || 'Okänt fel'}`);
            }
          } catch (error) {
            logger.error('Error processing Discord attachment', error as Error);
            await message.reply('❌ Ett fel uppstod när jag försökte ladda upp din CV-fil.');
          }
        }
      }
      
      if (!userMessage) {
        await message.reply('Hej! Hur kan jag hjälpa dig?');
        return;
      }

      // Show typing indicator
      if (message.channel instanceof TextChannel) {
        message.channel.sendTyping();
      }


      // Load user's projects if we have a system user ID
      let playgroundContext: any = undefined;
      if (systemUserId && systemUserId.startsWith('discord_') === false) {
        try {
          const ProjectServiceModule = await import('./ProjectService');
          const projectService = ProjectServiceModule.projectService;
          const userProjects = await projectService.getUserProjects(systemUserId);
          
          if (userProjects.length > 0) {
            // Use the most recently active project
            const activeProject = userProjects[0];
            const projectFiles = await projectService.getProjectFiles(activeProject.id);
            
            playgroundContext = {
              currentProject: activeProject.name,
              projectId: activeProject.id.toString(),
              filesCount: projectFiles.length,
              filePaths: projectFiles.map(f => f.filePath),
              hasLivePreview: false,
              currentComponent: undefined,
              recentErrors: [],
              isGenerating: false,
            };
            
            logger.info(`Loaded playground context for user ${systemUserId}: project "${activeProject.name}" with ${projectFiles.length} files`);
          }
        } catch (error) {
          logger.warn(`Could not load user projects for Discord context (userId: ${systemUserId}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Detect GitHub repository URLs in message
      let repoAnalysis: any = null;
      let matchedAgents: any[] = [];
      let detectedLanguage: string | undefined;

      try {
        const { GitHubRepoAnalysisService } = await import('./GitHubRepoAnalysisService');
        const repoAnalysisService = new GitHubRepoAnalysisService();
        
        const repoUrl = repoAnalysisService.extractRepoUrl(userMessage);
        if (repoUrl) {
          // Detect user's language for natural status messages
          try {
            const detectResponse = await new Anthropic({
              apiKey: process.env.ANTHROPIC_API_KEY || ''
            }).messages.create({
              model: 'claude-sonnet-4-5-20250929',
              max_tokens: 10,
              messages: [{
                role: 'user',
                content: `Detect the language of this message and respond with ONLY the ISO 639-1 language code (e.g., "en", "sv", "es"). Message: "${userMessage}"`
              }]
            });
            detectedLanguage = detectResponse.content[0].type === 'text' 
              ? detectResponse.content[0].text.trim().toLowerCase().replace(/[^a-z]/g, '')
              : undefined;
          } catch {
            // Language detection failed, continue anyway
          }

          // Send initial status message
          const initialStatus = await this.generateNaturalStatusMessage(
            'Analyserar GitHub repository...',
            userMessage,
            detectedLanguage
          );
          await this.sendStatusMessage(message, initialStatus, 300);

          // Analyze repository
          repoAnalysis = await repoAnalysisService.analyzeRepository(repoUrl.owner, repoUrl.repo);
          
          // Send status about languages detected
          const languagesList = Object.entries(repoAnalysis.languages as Record<string, number>)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([lang, pct]) => `${lang} (${(pct as number).toFixed(1)}%)`)
            .join(', ');
          
          const languageStatus = await this.generateNaturalStatusMessage(
            `Repot använder: ${languagesList}. Letar efter matchande agenter...`,
            userMessage,
            detectedLanguage
          );
          await this.sendStatusMessage(message, languageStatus, 500);

          // Find matching agents
          const realUserId = systemUserId.startsWith('discord_') ? undefined : systemUserId;
          matchedAgents = await repoAnalysisService.findMatchingAgents(repoAnalysis, realUserId);

          if (matchedAgents.length > 0) {
            // Send status about matched agents
            const topAgents = matchedAgents.slice(0, 2).map(a => a.name).join(', ');
            const agentStatus = await this.generateNaturalStatusMessage(
              `Hittade ${matchedAgents.length} matchande agent${matchedAgents.length > 1 ? 'er' : ''}: ${topAgents}. Använder dessa för bästa möjliga hjälp!`,
              userMessage,
              detectedLanguage
            );
            await this.sendStatusMessage(message, agentStatus, 500);
          } else {
            // No matching agents found - send recommendation
            const recommendationStatus = await this.generateNaturalStatusMessage(
              `Inga specifika agenter hittades för detta projekt. Jag kan fortfarande hjälpa dig, men för bästa resultat rekommenderar jag att du skapar en custom agent på plattformen som matchar detta projekt.`,
              userMessage,
              detectedLanguage
            );
            await this.sendStatusMessage(message, recommendationStatus, 500);
          }

          logger.info(`Analyzed repo ${repoUrl.owner}/${repoUrl.repo}: ${repoAnalysis.primaryLanguage}, found ${matchedAgents.length} matching agents`);
        }
      } catch (error) {
        logger.warn('GitHub repo analysis failed, continuing without it', error as Error);
        // Continue processing even if repo analysis fails
      }

      // Determine if this is a public channel or private DM
      const isPublicChannel = !message.guild || (message.channel instanceof TextChannel && !message.channel.isDMBased());
      const isPrivateDM = !message.guild;

      // Create a unique session ID for this Discord conversation
      // Use channel ID to separate conversations in different channels/DMs
      const discordSessionId = `discord-${systemUserId}-${message.channel.id}`;

      // Enhance user message with repo context if available
      let enhancedMessage = userMessage;
      if (repoAnalysis && matchedAgents.length > 0) {
        const agentNames = matchedAgents.slice(0, 3).map(a => a.name).join(', ');
        enhancedMessage = `${userMessage}\n\n[Context: GitHub repo ${repoAnalysis.owner}/${repoAnalysis.repo} uses ${repoAnalysis.primaryLanguage} (${Object.entries(repoAnalysis.languages as Record<string, number>).slice(0, 3).map(([l, p]) => `${l} ${(p as number).toFixed(1)}%`).join(', ')}). Using specialized agents: ${agentNames} for best results.]`;
      } else if (repoAnalysis && matchedAgents.length === 0) {
        // Add context that no specific agents were found but we can still help
        enhancedMessage = `${userMessage}\n\n[Context: GitHub repo ${repoAnalysis.owner}/${repoAnalysis.repo} uses ${repoAnalysis.primaryLanguage}. No specific agents found in database, but I can still help. Recommend creating a custom agent for best results.]`;
      }

      // Process message with PersonalAssistantAgent (using singleton instance)
      // Pass Discord context to ensure security and proper user identification
      const response = await personalAssistantAgent.processRequest(
        systemUserId,
        enhancedMessage,
        {
          sessionId: discordSessionId, // Use Discord-specific session ID
          includeContext: true,
          maxContextItems: 5,
          playgroundContext: playgroundContext,
          discordContext: {
            isPublicChannel,
            isPrivateDM,
            channelId: message.channel.id,
            channelName: message.channel instanceof TextChannel ? message.channel.name : 'DM',
            serverId: message.guild?.id,
            serverName: message.guild?.name,
            discordUserId: discordUserId,
            discordUsername: discordUsername,
          } as any
        }
      );

      // Send response back to Discord
      // Split long messages into chunks (Discord has 2000 char limit)
      const responseText = response.response?.trim() || '';
      
      // Don't send empty messages
      if (!responseText || responseText.length === 0) {
        logger.warn('Empty response from agent, skipping Discord message');
        return;
      }
      
      if (responseText.length > 1900) {
        // Split into chunks
        const chunks = this.splitMessage(responseText, 1900);
        for (const chunk of chunks) {
          if (chunk.trim().length > 0) {
            await message.reply(chunk);
          }
        }
      } else {
        await message.reply(responseText);
      }

      logger.info(`Responded to Discord message from ${message.author.tag}`);
    } catch (error) {
      logger.error('Error handling Discord message', error as Error);
      try {
        await message.reply('Ursäkta, jag stötte på ett fel. Försök igen senare.');
      } catch (replyError) {
        logger.error('Failed to send error reply', replyError as Error);
      }
    }
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(channelId: string, content: string, embed?: EmbedBuilder): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot send message');
        return false;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.error(`Channel ${channelId} not found or is not a text channel`);
        return false;
      }

      // Don't send empty messages unless there's an embed
      const trimmedContent = content?.trim() || '';
      if (!trimmedContent && !embed) {
        logger.warn('Cannot send empty message without embed');
        return false;
      }

      const messageOptions: any = {};
      if (trimmedContent) {
        messageOptions.content = trimmedContent;
      }
      if (embed) {
        messageOptions.embeds = [embed];
      }

      await channel.send(messageOptions);
      logger.info(`Message sent to Discord channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error('Error sending message to Discord', error as Error);
      return false;
    }
  }

  async handleMusicInteraction(interaction: any, command: ParsedMusicCommand): Promise<void> {
    if (!this.isBotConnected()) {
      logger.warn('Discord bot is not connected for music interaction; attempting env reconnect');
      await this.connectFromEnvironment();
    }

    await discordMusicService.handleInteractionCommand(this.client, interaction, command);
  }

  private async connectFromEnvironment(): Promise<boolean> {
    if (this.isBotConnected()) {
      return true;
    }

    const envConfig = DiscordBotService.loadConfigFromEnvironment();
    if (!envConfig) {
      logger.warn('Cannot auto-connect Discord bot: DISCORD_BOT_TOKEN is not configured');
      return false;
    }

    return this.connect(envConfig);
  }

  /**
   * Read recent messages from a Discord channel
   */
  async readMessages(channelId: string, limit: number = 10): Promise<Message[]> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot read messages');
        return [];
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.error(`Channel ${channelId} not found or is not a text channel`);
        return [];
      }

      const messages = await channel.messages.fetch({ limit });
      return Array.from(messages.values());
    } catch (error) {
      logger.error('Error reading messages from Discord', error as Error);
      return [];
    }
  }

  /**
   * Process Discord attachment (resume file) and upload it
   */
  private async processDiscordAttachment(
    attachment: Attachment,
    userId: string,
    message: Message
  ): Promise<{ success: boolean; resumeId?: number; error?: string }> {
    try {
      // Validate file size (max 5MB)
      if (attachment.size && attachment.size > 5 * 1024 * 1024) {
        return {
          success: false,
          error: 'Filen är för stor. Max storlek är 5MB.',
        };
      }

      // Validate file type
      const ext = attachment.name?.toLowerCase().split('.').pop();
      const isValidType = ext === 'pdf' || ext === 'docx' || ext === 'tex' ||
                         attachment.contentType === 'application/pdf' ||
                         attachment.contentType?.includes('wordprocessingml') ||
                         attachment.contentType === 'application/x-latex' ||
                         attachment.contentType === 'text/x-latex';

      if (!isValidType) {
        return {
          success: false,
          error: 'Ogiltig filtyp. Endast PDF, DOCX och TEX filer är tillåtna.',
        };
      }

      // Download file from Discord CDN
      logger.info(`Downloading attachment ${attachment.name} from ${attachment.url}`);
      const response = await fetch(attachment.url);
      if (!response.ok) {
        return {
          success: false,
          error: 'Kunde inte ladda ner filen från Discord.',
        };
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const filename = attachment.name || `resume.${ext}`;

      // Import resume services
      const { resumeParserService } = await import('./ResumeParserService');
      const { db } = await import('../../db');
      const { resumes } = await import('../../db/schema-pg');
      const uuidModule = await import('uuid');
      const uuidv4 = uuidModule.v4;
      const fs = await import('fs/promises');
      const path = await import('path');

      // Parse resume
      const parsedData = await resumeParserService.parseResume(
        fileBuffer,
        attachment.contentType || 'application/pdf',
        filename
      );

      // Generate unique filename
      const resumeId = uuidv4();
      const fileExtension = ext || 'pdf';
      const uniqueFilename = `${resumeId}.${fileExtension}`;
      const filePath = `resumes/${userId}/${uniqueFilename}`;

      // Upload to local storage
      const uploadDir = path.join(process.cwd(), 'uploads', 'resumes', userId);
      await fs.mkdir(uploadDir, { recursive: true });
      const localPath = path.join(uploadDir, uniqueFilename);
      await fs.writeFile(localPath, fileBuffer);
      const storageUrl = `/uploads/resumes/${userId}/${uniqueFilename}`;

      // Save to database
      const [resume] = await db
        .insert(resumes)
        .values({
          userId,
          filename: filename,
          filePath: storageUrl,
          fileSize: attachment.size || fileBuffer.length,
          fileType: fileExtension,
          parsedData: parsedData as any,
          rawText: parsedData.rawText,
        })
        .returning();

      logger.info(`Successfully uploaded resume from Discord attachment: ${resume.id}`);
      return {
        success: true,
        resumeId: resume.id,
      };
    } catch (error) {
      logger.error('Error processing Discord attachment', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Okänt fel',
      };
    }
  }

  /**
   * Send a file as attachment to Discord channel
   */
  async sendFileAsAttachment(
    channelId: string,
    fileBuffer: Buffer,
    filename: string,
    message?: string
  ): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot send file');
        return false;
      }

      // Validate file size (Discord max 25MB)
      if (fileBuffer.length > 25 * 1024 * 1024) {
        logger.error(`File too large for Discord: ${fileBuffer.length} bytes`);
        return false;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.error(`Channel ${channelId} not found or is not a text channel`);
        return false;
      }

      const attachment = new AttachmentBuilder(fileBuffer, { name: filename });
      const messageOptions: any = { files: [attachment] };
      if (message) {
        messageOptions.content = message;
      }

      await channel.send(messageOptions);
      logger.info(`File sent to Discord channel ${channelId}: ${filename}`);
      return true;
    } catch (error) {
      logger.error('Error sending file to Discord', error as Error);
      return false;
    }
  }

  /**
   * Find a server (guild) by name (case-insensitive partial match)
   */
  async findServerByName(serverName: string): Promise<{ id: string; name: string } | null> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot find server');
        return null;
      }

      const guilds = this.client.guilds.cache;
      const searchName = serverName.toLowerCase().trim();

      // Collect all matching servers with priority scores
      const matches: Array<{ guild: any; score: number }> = [];

      for (const guild of guilds.values()) {
        const guildNameLower = guild.name.toLowerCase();
        
        // Calculate match score (higher = better match)
        let score = 0;
        
        // Exact match gets highest priority
        if (guildNameLower === searchName) {
          score = 100;
        }
        // Starts with search term gets high priority
        else if (guildNameLower.startsWith(searchName)) {
          score = 80;
        }
        // Ends with search term gets medium-high priority
        else if (guildNameLower.endsWith(searchName)) {
          score = 60;
        }
        // Contains search term gets medium priority
        else if (guildNameLower.includes(searchName)) {
          score = 40;
        }
        // Search term contains server name gets low priority
        else if (searchName.includes(guildNameLower)) {
          score = 20;
        }
        
        if (score > 0) {
          matches.push({ guild, score });
        }
      }

      if (matches.length === 0) {
        logger.warn(`Server "${serverName}" not found`);
        return null;
      }

      // Sort by score (highest first) and return the best match
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0].guild;
      
      logger.info(`Found server "${bestMatch.name}" for search "${serverName}" (score: ${matches[0].score}, total matches: ${matches.length})`);
      
      return {
        id: bestMatch.id,
        name: bestMatch.name
      };
    } catch (error) {
      logger.error('Error finding server by name', error as Error);
      return null;
    }
  }

  /**
   * Find a channel by name (case-insensitive partial match)
   */
  async findChannelByName(channelName: string, serverId?: string): Promise<{ id: string; name: string; serverId: string; serverName: string } | null> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot find channel');
        return null;
      }

      const targetServerId = serverId || this.config?.serverId;
      if (!targetServerId) {
        logger.warn('No server ID available to search for channel');
        return null;
      }

      const guild = await this.client.guilds.fetch(targetServerId);
      if (!guild) {
        logger.error(`Server ${targetServerId} not found`);
        return null;
      }

      const channels = await guild.channels.fetch();
      const searchName = channelName.toLowerCase().trim();

      // Collect all matching channels with priority scores
      const matches: Array<{ channel: TextChannel; score: number }> = [];

      for (const channel of channels.values()) {
        if (channel instanceof TextChannel) {
          const channelNameLower = channel.name.toLowerCase();
          
          // Calculate match score (higher = better match)
          let score = 0;
          
          // Exact match gets highest priority
          if (channelNameLower === searchName) {
            score = 100;
          }
          // Starts with search term gets high priority
          else if (channelNameLower.startsWith(searchName)) {
            score = 80;
          }
          // Ends with search term gets medium-high priority
          else if (channelNameLower.endsWith(searchName)) {
            score = 60;
          }
          // Contains search term gets medium priority
          else if (channelNameLower.includes(searchName)) {
            score = 40;
          }
          // Search term contains channel name gets low priority
          else if (searchName.includes(channelNameLower)) {
            score = 20;
          }
          
          if (score > 0) {
            matches.push({ channel, score });
          }
        }
      }

      if (matches.length === 0) {
        logger.warn(`Channel "${channelName}" not found in server ${guild.name}`);
        return null;
      }

      // Sort by score (highest first) and return the best match
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0].channel;
      
      logger.info(`Found channel "${bestMatch.name}" for search "${channelName}" (score: ${matches[0].score}, total matches: ${matches.length})`);
      
      return {
        id: bestMatch.id,
        name: bestMatch.name,
        serverId: guild.id,
        serverName: guild.name
      };
    } catch (error) {
      logger.error('Error finding channel by name', error as Error);
      return null;
    }
  }

  /**
   * Get all text channels in the server
   */
  async getAllChannels(serverId?: string): Promise<Array<{ id: string; name: string; serverId: string; serverName: string }>> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot get channels');
        return [];
      }

      const targetServerId = serverId || this.config?.serverId;
      if (!targetServerId) {
        logger.warn('No server ID available to get channels');
        return [];
      }

      const guild = await this.client.guilds.fetch(targetServerId);
      if (!guild) {
        logger.error(`Server ${targetServerId} not found`);
        return [];
      }

      const channels = await guild.channels.fetch();
      const textChannels: Array<{ id: string; name: string; serverId: string; serverName: string }> = [];

      for (const channel of channels.values()) {
        if (channel instanceof TextChannel) {
          textChannels.push({
            id: channel.id,
            name: channel.name,
            serverId: guild.id,
            serverName: guild.name
          });
        }
      }

      return textChannels.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting all channels', error as Error);
      return [];
    }
  }

  /**
   * Get all Discord servers (guilds) the bot is a member of
   */
  async getAllServers(): Promise<Array<{ id: string; name: string }>> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot get servers');
        return [];
      }

      const guilds = this.client.guilds.cache;
      const servers: Array<{ id: string; name: string }> = [];

      for (const guild of guilds.values()) {
        servers.push({
          id: guild.id,
          name: guild.name
        });
      }

      return servers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting all servers', error as Error);
      return [];
    }
  }

  /**
   * Read messages from multiple channels or all channels in server
   */
  async readMessagesFromServer(limitPerChannel: number = 5, channelIds?: string[]): Promise<Array<{ channelId: string; channelName: string; messages: Message[] }>> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Discord bot not connected, cannot read messages');
        return [];
      }

      const targetServerId = this.config?.serverId;
      if (!targetServerId) {
        logger.warn('No server ID available to read messages from server');
        return [];
      }

      let channelsToRead: Array<{ id: string; name: string }> = [];

      if (channelIds && channelIds.length > 0) {
        // Read from specific channels
        for (const channelId of channelIds) {
          try {
            const channel = await this.client!.channels.fetch(channelId);
            if (channel instanceof TextChannel) {
              channelsToRead.push({ id: channel.id, name: channel.name });
            }
          } catch (error) {
            logger.warn(`Could not fetch channel ${channelId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } else {
        // Read from all channels in server
        const allChannels = await this.getAllChannels(targetServerId);
        channelsToRead = allChannels;
      }

      const results: Array<{ channelId: string; channelName: string; messages: Message[] }> = [];

      for (const channelInfo of channelsToRead) {
        try {
          const messages = await this.readMessages(channelInfo.id, limitPerChannel);
          if (messages.length > 0) {
            results.push({
              channelId: channelInfo.id,
              channelName: channelInfo.name,
              messages: messages
            });
          }
        } catch (error) {
          logger.warn(`Could not read messages from channel ${channelInfo.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return results;
    } catch (error) {
      logger.error('Error reading messages from server', error as Error);
      return [];
    }
  }

  /**
   * Get bot connection status
   * Checks both the internal flag and the actual Discord client ready state
   */
  isBotConnected(): boolean {
    if (!this.isConnected || !this.client) {
      return false;
    }
    // Also check if the Discord client is actually ready
    // The client can exist but not be fully connected yet
    return this.client.isReady();
  }

  /**
   * Get bot user info
   */
  getBotUser() {
    return this.client?.user || null;
  }

  /**
   * Get current bot configuration
   */
  getConfig(): DiscordBotConfig | null {
    return this.config;
  }

  /**
   * Split long message into chunks
   */
  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = text.split('\n');
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        // If single line is too long, split it
        if (line.length > maxLength) {
          let remainingLine = line;
          while (remainingLine.length > maxLength) {
            chunks.push(remainingLine.substring(0, maxLength));
            remainingLine = remainingLine.substring(maxLength);
          }
          currentChunk = remainingLine;
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }

  /**
   * Load all active Discord bot configurations from database
   * Used for auto-connecting bots on server startup
   */
  static async loadAllActiveConfigs(): Promise<Array<{ userId: string; config: DiscordBotConfig }>> {
    try {
      // Use SQL to handle both boolean and integer types for is_active
      const results = await db
        .select()
        .from(userCredentials)
        .where(
          and(
            eq(userCredentials.serviceName, 'discord'),
            // Handle both boolean (true) and integer (1) for is_active
            // Cast to integer when comparing with 1 to avoid type mismatch
            sql`(${userCredentials.isActive} = true OR (${userCredentials.isActive}::integer = 1))`
          )
        );

      const configs: Array<{ userId: string; config: DiscordBotConfig }> = [];
      const vault = getCredentialVault();

      for (const credential of results) {
        try {
          const decrypted = vault.decrypt(credential.encryptedData);
          if (decrypted.botToken) {
            configs.push({
              userId: credential.userId,
              config: {
                botToken: decrypted.botToken,
                channelId: decrypted.channelId,
                serverId: decrypted.serverId,
                userId: credential.userId,
              },
            });
          }
        } catch (error) {
          logger.error(`Failed to decrypt credentials for user ${credential.userId}`, error as Error);
        }
      }

      return configs;
    } catch (error) {
      logger.error('Error loading all Discord configs from database', error as Error);
      return [];
    }
  }

  private static loadConfigFromEnvironment(): DiscordBotConfig | null {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return null;
    }

    return {
      botToken,
      channelId: process.env.DISCORD_CHANNEL_ID,
      serverId: process.env.DISCORD_GUILD_ID || process.env.DISCORD_SERVER_ID,
      userId: 'environment',
    };
  }

  /**
   * Auto-connect all active Discord bots on startup
   * This ensures bots stay online even after server restarts
   */
  static async autoConnectAllBots(): Promise<void> {
    try {
      logger.info('Auto-connecting Discord bots on startup...');
      const configs = await DiscordBotService.loadAllActiveConfigs();
      const envConfig = DiscordBotService.loadConfigFromEnvironment();

      if (configs.length === 0 && envConfig) {
        logger.info('No active Discord bot configuration found in database; using DISCORD_BOT_TOKEN from environment');
        configs.push({
          userId: envConfig.userId || 'environment',
          config: envConfig,
        });
      }

      if (configs.length === 0) {
        logger.info('No active Discord bot configurations found in database or environment');
        return;
      }

      logger.info(`Found ${configs.length} active Discord bot configuration(s)`);

      // Connect the first bot (Discord only allows one bot connection per instance)
      // In the future, we could support multiple bots with separate instances
      if (configs.length > 0) {
        const { config } = configs[0];
        const service = DiscordBotService.getInstance();
        const connected = await service.connect(config);
        
        if (connected) {
          logger.info(`Successfully auto-connected Discord bot for user ${config.userId}`);
        } else {
          logger.error(`Failed to auto-connect Discord bot for user ${config.userId}`);
        }

        // Log warning if multiple bots are configured (only one can be active)
        if (configs.length > 1) {
          logger.warn(`Multiple Discord bot configurations found (${configs.length}). Only the first one is connected. Consider using separate bot instances for multiple servers.`);
        }
      }
    } catch (error) {
      logger.error('Error during auto-connect of Discord bots', error as Error);
    }
  }

  /**
   * Load Discord bot configuration from database for a user
   */
  static async loadConfigFromDatabase(userId: string): Promise<DiscordBotConfig | null> {
    try {
      const result = await db
        .select()
        .from(userCredentials)
          .where(
            and(
              eq(userCredentials.userId, userId),
              eq(userCredentials.serviceName, 'discord'),
              // Handle both boolean (true) and integer (1) for is_active
              // Cast to integer when comparing with 1 to avoid type mismatch
              sql`(${userCredentials.isActive} = true OR (${userCredentials.isActive}::integer = 1))`
            )
          )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const credential = result[0];
      const vault = getCredentialVault();
      const decrypted = vault.decrypt(credential.encryptedData);

      if (!decrypted.botToken) {
        logger.warn('Discord credentials found but no botToken');
        return null;
      }

      return {
        botToken: decrypted.botToken,
        channelId: decrypted.channelId,
        serverId: decrypted.serverId,
        userId: userId,
      };
    } catch (error) {
      logger.error('Error loading Discord config from database', error as Error);
      return null;
    }
  }
}

export const discordBotService = DiscordBotService.getInstance();
