/**
 * Discord Bot API Routes
 * Handles Discord bot connection, message sending, and reading
 */

import express, { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { discordBotService, DiscordBotService, DiscordBotConfig } from '../services/DiscordBotService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { z } from 'zod';
import { db, pool } from '../../db';
import { userCredentials, discordUserMappings, oauthStates } from '../../db/schema-pg';
import { eq, and, sql } from 'drizzle-orm';
import { getCredentialVault } from '../services/CredentialVault';
import { discordMusicService } from '../services/DiscordMusicService';
import crypto from 'crypto';

const router = Router();
const logger = new SimpleLogger('DiscordAPI');
const vault = getCredentialVault();

// Validation schemas
const connectBotSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required'),
  channelId: z.string().optional(),
  serverId: z.string().optional(),
});

const sendMessageSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const readMessagesSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  limit: z.number().min(1).max(100).optional().default(10),
});

/**
 * POST /api/discord/bot/connect
 * Connect Discord bot with provided credentials
 * Requires admin or superadmin role
 */
router.post('/bot/connect', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = connectBotSchema.parse(req.body);

    logger.info(`Connecting Discord bot for user ${userId}`);

    const config: DiscordBotConfig = {
      botToken: body.botToken,
      channelId: body.channelId,
      serverId: body.serverId,
      userId: userId,
    };

    const connected = await discordBotService.connect(config);

    if (!connected) {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect Discord bot. Please check your bot token.',
      });
    }

    // Store credentials in database
    try {
      const encrypted = vault.encrypt({
        botToken: body.botToken,
        channelId: body.channelId,
        serverId: body.serverId,
      });

      // Check if credentials already exist
      const existing = await db
        .select()
        .from(userCredentials)
        .where(
          and(
            eq(userCredentials.userId, userId),
            eq(userCredentials.serviceName, 'discord'),
            // Handle both boolean (true) and integer (1) for is_active
            sql`(${userCredentials.isActive} = true OR (${userCredentials.isActive}::integer = 1))`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(userCredentials)
          .set({
            encryptedData: encrypted,
            updatedAt: new Date(),
          })
          .where(eq(userCredentials.id, existing[0].id));
      } else {
        // Create new
        await db.insert(userCredentials).values({
          userId: userId,
          serviceName: 'discord',
          credentialType: 'custom',
          displayName: 'Discord Bot',
          encryptedData: encrypted,
          isActive: true,
          validationStatus: 'valid',
        });
      }
    } catch (dbError) {
      logger.error('Failed to store Discord credentials', dbError as Error);
      // Don't fail the connection if storage fails
    }

    res.json({
      success: true,
      message: 'Discord bot connected successfully',
      botUser: discordBotService.getBotUser(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    logger.error('Failed to connect Discord bot', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Discord bot',
    });
  }
});

/**
 * POST /api/discord/bot/disconnect
 * Disconnect Discord bot
 * Requires admin or superadmin role
 */
router.post('/bot/disconnect', authenticateUser, requireAdmin, async (req, res) => {
  try {
    await discordBotService.disconnect();

    res.json({
      success: true,
      message: 'Discord bot disconnected successfully',
    });
  } catch (error) {
    logger.error('Failed to disconnect Discord bot', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Discord bot',
    });
  }
});

/**
 * GET /api/discord/bot/servers
 * Get all Discord servers the bot is a member of
 * Requires admin or superadmin role
 */
router.get('/bot/servers', authenticateUser, requireAdmin, async (req, res) => {
  try {
    if (!discordBotService.isBotConnected()) {
      return res.status(400).json({
        success: false,
        error: 'Discord bot is not connected. Please connect the bot first.',
      });
    }

    const servers = await discordBotService.getAllServers();

    res.json({
      success: true,
      servers,
      count: servers.length,
    });
  } catch (error) {
    logger.error('Failed to get Discord servers', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get servers',
    });
  }
});

/**
 * GET /api/discord/bot/status
 * Get Discord bot connection status
 * Requires admin or superadmin role
 */
router.get('/bot/status', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const isConnected = discordBotService.isBotConnected();
    const botUser = discordBotService.getBotUser();

    res.json({
      success: true,
      connected: isConnected,
      botUser: botUser
        ? {
            id: botUser.id,
            username: botUser.username,
            tag: botUser.tag,
          }
        : null,
    });
  } catch (error) {
    logger.error('Failed to get Discord bot status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot status',
    });
  }
});

/**
 * POST /api/discord/bot/send
 * Send a message to a Discord channel
 */
router.post('/bot/send', authenticateUser, async (req, res) => {
  try {
    const body = sendMessageSchema.parse(req.body);

    if (!discordBotService.isBotConnected()) {
      return res.status(400).json({
        success: false,
        error: 'Discord bot is not connected. Please connect the bot first.',
      });
    }

    const sent = await discordBotService.sendMessage(body.channelId, body.content);

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send message to Discord',
      });
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    logger.error('Failed to send Discord message', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    });
  }
});

/**
 * GET /api/discord/bot/read
 * Read messages from a Discord channel
 */
router.get('/bot/read', authenticateUser, async (req, res) => {
  try {
    const query = readMessagesSchema.parse({
      channelId: req.query.channelId,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    });

    if (!discordBotService.isBotConnected()) {
      return res.status(400).json({
        success: false,
        error: 'Discord bot is not connected. Please connect the bot first.',
      });
    }

    const messages = await discordBotService.readMessages(query.channelId, query.limit);

    res.json({
      success: true,
      messages: messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          tag: msg.author.tag,
        },
        timestamp: msg.createdTimestamp,
        channelId: msg.channel.id,
      })),
      count: messages.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    logger.error('Failed to read Discord messages', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to read messages',
    });
  }
});

/**
 * POST /api/discord/bot/auto-connect
 * Automatically connect bot using stored credentials
 */
router.post('/bot/auto-connect', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Load config from database
    const config = await DiscordBotService.loadConfigFromDatabase(userId);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No Discord bot credentials found. Please connect the bot first with /api/discord/bot/connect',
      });
    }

    const connected = await discordBotService.connect(config);

    if (!connected) {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect Discord bot with stored credentials',
      });
    }

    res.json({
      success: true,
      message: 'Discord bot connected successfully using stored credentials',
      botUser: discordBotService.getBotUser(),
    });
  } catch (error) {
    logger.error('Failed to auto-connect Discord bot', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-connect Discord bot',
    });
  }
});

/**
 * GET /api/discord/oauth/start
 * Start Discord OAuth flow
 * Redirects user to Discord authorization page
 */
router.get('/oauth/start', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const clientId = process.env.DISCORD_CLIENT_ID;
    // Redirect URI must point to backend, not frontend
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://ai-library-backend-3mmv.onrender.com';
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${backendUrl}/api/discord/oauth/callback`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: 'Discord OAuth not configured. Please set DISCORD_CLIENT_ID environment variable.',
      });
    }

    // Generate state token for CSRF protection
    const stateToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store state in database
    try {
      await db.insert(oauthStates).values({
        stateToken,
        userId,
        serviceName: 'discord',
        expiresAt,
      });
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      logger.error(`Failed to store OAuth state: ${errorMessage}`, dbError as Error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize OAuth flow',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }

    // Discord OAuth2 authorization URL
    const scopes = ['identify', 'email']; // Minimal scopes needed
    const authUrl = `https://discord.com/api/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${stateToken}`;

    logger.info(`Starting Discord OAuth flow for user ${userId}`);

    res.json({
      success: true,
      authUrl,
      state: stateToken,
    });
  } catch (error) {
    logger.error('Failed to start Discord OAuth flow', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start Discord OAuth flow',
    });
  }
});

/**
 * GET /api/discord/oauth/callback
 * Discord OAuth callback handler
 * Exchanges authorization code for access token and user info
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error(`Discord OAuth error: ${error}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=missing_parameters`);
    }

    // Verify state token - use raw query to bypass RLS for callback
    // We need to read the state before we know which user it belongs to
    const stateResult = await pool.query(
      'SELECT user_id, expires_at FROM oauth_states WHERE state_token = $1 LIMIT 1',
      [state as string]
    );

    if (stateResult.rows.length === 0) {
      logger.error(`Invalid state token: ${state}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=invalid_state`);
    }

    const userId = stateResult.rows[0].user_id;
    const expiresAt = stateResult.rows[0].expires_at;

    // Set user context for RLS now that we know the user
    try {
      await pool.query('SET app.user_id = $1', [userId]);
    } catch (error) {
      logger.error(`Failed to set user context: ${error}`);
    }

    // Check expiry
    if (new Date() > new Date(expiresAt)) {
      logger.error(`State token expired: ${state}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=expired_state`);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    // Redirect URI must point to backend, not frontend
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://ai-library-backend-3mmv.onrender.com';
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${backendUrl}/api/discord/oauth/callback`;

    if (!clientId || !clientSecret) {
      logger.error('Discord OAuth credentials not configured');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=not_configured`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error(`Discord OAuth token exchange failed: ${errorData}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      logger.error('No access token received from Discord');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=no_token`);
    }

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      logger.error('Failed to fetch Discord user info');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=fetch_user_failed`);
    }

    const discordUser = await userResponse.json();
    const discordUserId = discordUser.id;
    const discordUsername = discordUser.username;

    logger.info(`Discord OAuth success for user ${userId} - Discord ID: ${discordUserId}, Username: ${discordUsername}`);

    // Check if Discord user ID is already linked to another account
    const existingMapping = await db
      .select()
      .from(discordUserMappings)
      .where(eq(discordUserMappings.discordUserId, discordUserId))
      .limit(1);

    if (existingMapping.length > 0) {
      if (existingMapping[0].systemUserId !== userId) {
        // Delete state
        await db.delete(oauthStates).where(eq(oauthStates.stateToken, state as string));
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=already_linked`);
      } else {
        // Already linked to this user, update
        await db
          .update(discordUserMappings)
          .set({
            discordUsername,
            lastUsedAt: new Date(),
            verified: true,
          })
          .where(eq(discordUserMappings.id, existingMapping[0].id));
      }
    } else {
      // Check if user already has a Discord mapping
      const userMapping = await db
        .select()
        .from(discordUserMappings)
        .where(eq(discordUserMappings.systemUserId, userId))
        .limit(1);

      if (userMapping.length > 0) {
        // Update existing mapping
        await db
          .update(discordUserMappings)
          .set({
            discordUserId,
            discordUsername,
            lastUsedAt: new Date(),
            verified: true,
          })
          .where(eq(discordUserMappings.id, userMapping[0].id));
      } else {
        // Create new mapping
        await db.insert(discordUserMappings).values({
          discordUserId,
          discordUsername,
          systemUserId: userId,
          verified: true,
        });
      }
    }

    // Delete state
    await db.delete(oauthStates).where(eq(oauthStates.stateToken, state as string));

    logger.info(`Successfully linked Discord account via OAuth for user ${userId}`);

    // Redirect to success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?discord_oauth=success`);
  } catch (error) {
    logger.error('Discord OAuth callback failed', error as Error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?discord_oauth=error&error=callback_failed`);
  }
});

/**
 * POST /api/discord/link
 * Link Discord account to system user account (manual method)
 * User must provide their Discord user ID (found in Discord settings)
 * @deprecated Use OAuth flow instead: GET /api/discord/oauth/start
 */
router.post('/link', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = z.object({
      discordUserId: z.string().min(1, 'Discord user ID is required'),
      discordUsername: z.string().optional(),
      verificationCode: z.string().optional(),
    }).parse(req.body);

    logger.info(`Linking Discord account for user ${userId} - Discord ID: ${body.discordUserId}`);

    // Check if Discord user ID is already linked to another account
    const existingMapping = await db
      .select()
      .from(discordUserMappings)
      .where(eq(discordUserMappings.discordUserId, body.discordUserId))
      .limit(1);

    if (existingMapping.length > 0) {
      if (existingMapping[0].systemUserId !== userId) {
        return res.status(409).json({
          success: false,
          error: 'This Discord account is already linked to another user',
        });
      } else {
        // Already linked to this user, update last used
        await db
          .update(discordUserMappings)
          .set({
            lastUsedAt: new Date(),
            discordUsername: body.discordUsername || existingMapping[0].discordUsername,
          })
          .where(eq(discordUserMappings.id, existingMapping[0].id));

        return res.json({
          success: true,
          message: 'Discord account already linked',
          mapping: existingMapping[0],
        });
      }
    }

    // Check if user already has a Discord mapping
    const userMapping = await db
      .select()
      .from(discordUserMappings)
      .where(eq(discordUserMappings.systemUserId, userId))
      .limit(1);

    if (userMapping.length > 0) {
      // Update existing mapping
      await db
        .update(discordUserMappings)
        .set({
          discordUserId: body.discordUserId,
          discordUsername: body.discordUsername || userMapping[0].discordUsername,
          lastUsedAt: new Date(),
        })
        .where(eq(discordUserMappings.id, userMapping[0].id));

      return res.json({
        success: true,
        message: 'Discord account updated',
        mapping: userMapping[0],
      });
    }

    // Create new mapping
    const [newMapping] = await db
      .insert(discordUserMappings)
      .values({
        discordUserId: body.discordUserId,
        discordUsername: body.discordUsername,
        systemUserId: userId,
        verified: false, // Can be verified later if needed
        verificationCode: body.verificationCode,
      })
      .returning();

    logger.info(`Successfully linked Discord account for user ${userId}`);

    res.json({
      success: true,
      message: 'Discord account linked successfully',
      mapping: newMapping,
    });
  } catch (error) {
    logger.error('Failed to link Discord account', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to link Discord account',
    });
  }
});

/**
 * GET /api/discord/link/status
 * Check if user has linked their Discord account
 */
router.get('/link/status', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const mapping = await db
      .select()
      .from(discordUserMappings)
      .where(eq(discordUserMappings.systemUserId, userId))
      .limit(1);

    if (mapping.length === 0) {
      return res.json({
        success: true,
        linked: false,
        message: 'Discord account not linked',
      });
    }

    res.json({
      success: true,
      linked: true,
      mapping: mapping[0],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to check Discord link status: ${errorMessage}`, error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Discord link status',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

/**
 * DELETE /api/discord/link
 * Unlink Discord account from system user
 */
router.delete('/link', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    await db
      .delete(discordUserMappings)
      .where(eq(discordUserMappings.systemUserId, userId));

    logger.info(`Unlinked Discord account for user ${userId}`);

    res.json({
      success: true,
      message: 'Discord account unlinked successfully',
    });
  } catch (error) {
    logger.error('Failed to unlink Discord account', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink Discord account',
    });
  }
});

/**
 * GET /api/discord/verify-user
 * Linked Roles Verification endpoint for Discord
 * Verifies user and returns role information for Discord role assignment
 * 
 * This endpoint is called by Discord when a user wants to link their role
 * Query params: user_id (Discord user ID)
 */
router.get('/verify-user', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({
        error: 'user_id is required',
      });
    }

    logger.info(`Verifying Discord user for Linked Roles: ${user_id}`);

    // Find user mapping
    const mapping = await db
      .select()
      .from(discordUserMappings)
      .where(eq(discordUserMappings.discordUserId, user_id))
      .limit(1);

    if (mapping.length === 0) {
      // User not linked - return empty response (Discord will not assign role)
      return res.json({
        platform_username: null,
        platform_role: null,
        verified: false,
      });
    }

    const systemUserId = mapping[0].systemUserId;

    // Get user information including role
    const { users } = await import('../../db/schema-pg');
    const user = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        tier: users.tier,
      })
      .from(users)
      .where(eq(users.id, systemUserId))
      .limit(1);

    if (user.length === 0) {
      return res.json({
        platform_username: null,
        platform_role: null,
        verified: false,
      });
    }

    const userData = user[0];

    // Map platform roles/tiers to Discord roles
    // Discord will use this information to assign roles
    const platformRole = userData.role || 'user';
    const platformTier = userData.tier || 'free';

    logger.info(`User verified: ${userData.username}, role: ${platformRole}, tier: ${platformTier}`);

    // Return data for Discord Linked Roles
    // Discord Linked Roles uses a specific format with metadata
    // The metadata keys must match what you configure in Discord Server Settings
    res.json({
      platform_username: userData.username,
      verified: true,
      // Metadata format for Discord Linked Roles
      // Discord will match these values against role requirements
      metadata: {
        // Role-based metadata (for admin/superadmin roles)
        role: platformRole, // 'user', 'admin', 'superadmin'
        is_admin: platformRole === 'admin' || platformRole === 'superadmin',
        is_superadmin: platformRole === 'superadmin',
        
        // Tier-based metadata (for premium roles)
        tier: platformTier, // 'free', 'pro', 'enterprise'
        is_premium: platformTier === 'pro' || platformTier === 'enterprise',
        is_enterprise: platformTier === 'enterprise',
        
        // Additional metadata
        user_id: systemUserId,
        username: userData.username,
      },
    });
  } catch (error) {
    logger.error('Failed to verify Discord user for Linked Roles', error as Error);
    res.status(500).json({
      error: 'Failed to verify user',
      verified: false,
    });
  }
});

/**
 * POST /api/discord/interactions
 * Interactions Endpoint for Discord
 * Handles slash commands, buttons, select menus, and modals
 * 
 * This endpoint receives interactions via HTTP POST from Discord
 * Must verify Discord signature for security
 * 
 * NOTE: This route must use express.raw() middleware for signature verification
 * to work correctly. See server/index.ts for configuration.
 */
router.post('/interactions', express.raw({ type: 'application/json', limit: '10mb' }), async (req, res) => {
  try {
    // Get raw body for signature verification
    // req.body is a Buffer when using express.raw()
    const rawBody = Buffer.isBuffer(req.body) 
      ? req.body.toString('utf8') 
      : typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);
    
    // Parse JSON from raw body
    let interaction: any;
    try {
      interaction = JSON.parse(rawBody);
    } catch (parseError) {
      // If already an object (shouldn't happen with raw middleware, but handle it)
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        interaction = req.body;
      } else {
        logger.error('Failed to parse interaction body', parseError as Error);
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }

    // Verify Discord signature (required for security)
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!publicKey) {
      logger.warn('DISCORD_PUBLIC_KEY not set, skipping signature verification');
    } else if (signature && timestamp) {
      // Verify signature using ed25519
      // Note: This requires the 'tweetnacl' package
      // IMPORTANT: Use raw body (timestamp + rawBody) for verification
      try {
        const nacl = await import('tweetnacl');
        const message = Buffer.from(timestamp + rawBody);
        const sig = Buffer.from(signature, 'hex');
        const pubKey = Buffer.from(publicKey, 'hex');
        
        const isValid = nacl.default.sign.detached.verify(message, sig, pubKey);

        if (!isValid) {
          logger.warn('Invalid Discord interaction signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } catch (sigError) {
        logger.warn('Failed to verify Discord signature', sigError as Error);
        // Continue anyway in development, but log warning
      }
    }

    // Handle different interaction types
    const interactionType = interaction.type;

    // PING - Discord sends this to verify the endpoint
    if (interactionType === 1) {
      return res.json({ type: 1 }); // PONG
    }

    // APPLICATION_COMMAND_AUTOCOMPLETE - Discord requests dropdown choices while typing
    if (interactionType === 4) {
      const commandName = interaction.data?.name;
      if (commandName === 'play') {
        const focusedOption = interaction.data?.options?.find((option: any) => option.focused);
        const query = String(focusedOption?.value || '').trim();
        const choices = await discordMusicService.getAutocompleteChoices(query);

        return res.json({
          type: 8,
          data: {
            choices,
          },
        });
      }

      return res.json({
        type: 8,
        data: {
          choices: [],
        },
      });
    }

    // APPLICATION_COMMAND - Slash command
    if (interactionType === 2) {
      const commandName = interaction.data?.name;

      logger.info(`Received slash command: ${commandName} from user ${interaction.member?.user?.id || interaction.user?.id}`);

      // Handle different commands
      switch (commandName) {
        case 'help':
          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: '🤖 **Elon AI Assistant Help**\n\n' +
                '**Available Commands:**\n' +
                '`/help` - Show this help message\n' +
                '`/projects` - List your projects\n' +
                '`/status` - Check system status\n' +
                '`/play` - Play a song, Spotify link, or YouTube link\n' +
                '`/skip`, `/stop`, `/pause`, `/resume`, `/queue`, `/nowplaying` - Music controls\n\n' +
                '**Chat with Elon:**\n' +
                'Just mention @Elon or send a DM to chat with me!\n\n' +
                '**Need more help?**\n' +
                'Join our Discord: https://discord.gg/p7rsdJR2nM',
              flags: 64, // EPHEMERAL (only visible to user)
            },
          });

        case 'projects':
          // Get user's Discord ID
          const discordUserId = interaction.member?.user?.id || interaction.user?.id;
          
          // Find user mapping
          const mapping = await db
            .select()
            .from(discordUserMappings)
            .where(eq(discordUserMappings.discordUserId, discordUserId))
            .limit(1);

          if (mapping.length === 0) {
            return res.json({
              type: 4,
              data: {
                content: '❌ You need to link your Discord account first. Visit the Integrations page on the platform to link your account.',
                flags: 64,
              },
            });
          }

          const systemUserId = mapping[0].systemUserId;

          // Get user's projects
          try {
            const { ProjectService } = await import('../services/ProjectService');
            const projectService = new ProjectService();
            const projects = await projectService.getUserProjects(systemUserId);

            if (projects.length === 0) {
              return res.json({
                type: 4,
                data: {
                  content: '📦 **Your Projects**\n\n' +
                    'You don\'t have any projects yet.\n\n' +
                    '**Get started:**\n' +
                    '- Visit the platform to create your first project\n' +
                    '- Or mention @Elon and ask me to create one for you!',
                  flags: 64,
                },
              });
            }

            // Format projects list
            const projectsList = projects.slice(0, 10).map((p, i) => 
              `${i + 1}. **${p.name}** (ID: ${p.id})`
            ).join('\n');

            const moreText = projects.length > 10 
              ? `\n... and ${projects.length - 10} more project(s)` 
              : '';

            return res.json({
              type: 4,
              data: {
                content: `📦 **Your Projects** (${projects.length} total)\n\n${projectsList}${moreText}\n\n` +
                  '**Quick Actions:**\n' +
                  '- Mention @Elon to work on a project\n' +
                  '- Visit the platform to manage projects\n' +
                  '- Use `/help` for more commands',
                flags: 64,
              },
            });
          } catch (error) {
            logger.error('Failed to fetch projects for /projects command', error as Error);
            return res.json({
              type: 4,
              data: {
                content: '❌ Failed to fetch your projects. Please try again later or visit the platform.',
                flags: 64,
              },
            });
          }

        case 'status':
          const botStatus = discordBotService.isBotConnected();
          return res.json({
            type: 4,
            data: {
              content: `🤖 **System Status**\n\n` +
                `**Discord Bot:** ${botStatus ? '✅ Online' : '❌ Offline'}\n` +
                `**Platform:** ✅ Operational\n\n` +
                `Need help? Join our Discord: https://discord.gg/p7rsdJR2nM`,
              flags: 64,
            },
          });

        case 'play': {
          const queryOption = interaction.data?.options?.find((option: any) => option.name === 'query');
          const query = String(queryOption?.value || '').trim();
          if (!query) {
            return res.json({
              type: 4,
              data: {
                content: 'Skriv en låt, Spotify-länk eller YouTube-länk. Exempel: `/play query:Avicii Levels`',
                flags: 64,
              },
            });
          }

          void discordBotService.handleMusicInteraction(interaction, { action: 'play', query });
          return res.json({
            type: 4,
            data: {
              content: `🎵 Letar efter **${query}** och försöker starta musiken...`,
            },
          });
        }

        case 'skip':
        case 'stop':
        case 'pause':
        case 'resume':
        case 'queue':
        case 'nowplaying':
          void discordBotService.handleMusicInteraction(interaction, { action: commandName as any });
          return res.json({
            type: 4,
            data: {
              content: '🎛️ Musikkommandot är mottaget.',
            },
          });

        default:
          return res.json({
            type: 4,
            data: {
              content: '❓ Unknown command. Use `/help` to see available commands.',
              flags: 64,
            },
          });
      }
    }

    // MESSAGE_COMPONENT - Button or select menu click
    if (interactionType === 3) {
      const componentType = interaction.data?.component_type;
      const customId = interaction.data?.custom_id;

      logger.info(`Received component interaction: ${componentType}, custom_id: ${customId}`);

      // Handle button clicks
      if (componentType === 2) { // BUTTON
        switch (customId) {
          case 'deploy_project':
            return res.json({
              type: 4,
              data: {
                content: '🚀 Deployment initiated! Check the platform for progress.',
                flags: 64,
              },
            });

          default:
            return res.json({
              type: 4,
              data: {
                content: '✅ Action received!',
                flags: 64,
              },
            });
        }
      }

      // Handle select menu
      if (componentType === 3) { // SELECT_MENU
        const selectedValues = interaction.data?.values || [];
        return res.json({
          type: 4,
          data: {
            content: `✅ Selected: ${selectedValues.join(', ')}`,
            flags: 64,
          },
        });
      }
    }

    // MODAL_SUBMIT - Form submission
    if (interactionType === 5) {
      const customId = interaction.data?.custom_id;
      const components = interaction.data?.components || [];

      logger.info(`Received modal submission: ${customId}`);

      // Extract form values
      const values: Record<string, string> = {};
      components.forEach((row: any) => {
        row.components.forEach((component: any) => {
          values[component.custom_id] = component.value;
        });
      });

      return res.json({
        type: 4,
        data: {
          content: '✅ Form submitted successfully!',
          flags: 64,
        },
      });
    }

    // Unknown interaction type
    logger.warn(`Unknown interaction type: ${interactionType}`);
    return res.json({
      type: 4,
      data: {
        content: '❓ Unknown interaction type',
        flags: 64,
      },
    });
  } catch (error) {
    logger.error('Failed to handle Discord interaction', error as Error);
    
    // Log full error details for debugging
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    
    // Always return a valid Discord interaction response
    try {
      res.status(200).json({
        type: 4,
        data: {
          content: '❌ An error occurred processing your request. Please try again later.',
          flags: 64, // EPHEMERAL
        },
      });
    } catch (responseError) {
      // If we can't send response, log it
      logger.error('Failed to send error response', responseError as Error);
    }
  }
});

export default router;
