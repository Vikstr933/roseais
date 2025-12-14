import { Router } from 'express';
import { z } from 'zod';
import { SimpleLogger } from '../utils/SimpleLogger';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const logger = new SimpleLogger('PluginsAPI');

let pluginRegistry: any;
let personalAssistantAgent: any;
let google: any;
let pluginsInitialized = false;

/**
 * Get frontend URL, handling cases where FRONTEND_URL might contain multiple values
 */
const getFrontendUrl = (): string => {
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  // Take only the first URL if multiple are provided (comma-separated)
  if (frontendUrl.includes(',')) {
    frontendUrl = frontendUrl.split(',')[0].trim();
  }
  // Ensure URL doesn't have trailing slash
  frontendUrl = frontendUrl.replace(/\/+$/, '');
  return frontendUrl;
};

// Initialize plugins with error handling
const initializePlugins = async () => {
  try {
    if (!pluginRegistry) {
      const registry = await import('../services/PluginRegistry');
      pluginRegistry = registry.pluginRegistry;
    }

    if (!google) {
      const googleapis = await import('googleapis');
      google = googleapis.google;
    }

    if (!pluginsInitialized) {
      // Register Gmail plugin
      try {
        const { default: GmailPlugin } = await import('../plugins/GmailPlugin');
        const gmailPlugin = new GmailPlugin();
        pluginRegistry.registerPlugin(gmailPlugin);
        logger.info('Gmail plugin registered');
      } catch (error) {
        logger.error('Failed to register Gmail plugin', error as Error);
      }

      // Register Calendar plugin
      try {
        const { default: GoogleCalendarPlugin } = await import('../plugins/GoogleCalendarPlugin');
        const calendarPlugin = new GoogleCalendarPlugin();
        pluginRegistry.registerPlugin(calendarPlugin);
        logger.info('Google Calendar plugin registered');
      } catch (error) {
        logger.error('Failed to register Calendar plugin', error as Error);
      }

      // Register Notion plugin
      try {
        const { default: NotionPlugin } = await import('../plugins/NotionPlugin');
        const notionPlugin = new NotionPlugin();
        pluginRegistry.registerPlugin(notionPlugin);
        logger.info('Notion plugin registered');
      } catch (error) {
        logger.error('Failed to register Notion plugin', error as Error);
      }

      // Register GitHub plugin
      try {
        const { default: GitHubPlugin } = await import('../plugins/GitHubPlugin');
        const githubPlugin = new GitHubPlugin();
        pluginRegistry.registerPlugin(githubPlugin);
        logger.info('GitHub plugin registered');
      } catch (error) {
        logger.error('Failed to register GitHub plugin', error as Error);
      }

      // Register Slack plugin
      try {
        const { default: SlackPlugin } = await import('../plugins/SlackPlugin');
        const slackPlugin = new SlackPlugin();
        pluginRegistry.registerPlugin(slackPlugin);
        logger.info('Slack plugin registered');
      } catch (error) {
        logger.error('Failed to register Slack plugin', error as Error);
      }

      // Register Browser plugin (for visual analysis)
      try {
        const { BrowserPlugin } = await import('../plugins/BrowserPlugin');
        const browserPlugin = new BrowserPlugin();
        pluginRegistry.registerPlugin(browserPlugin);
        logger.info('Browser plugin registered');
      } catch (error) {
        logger.error('Failed to register Browser plugin', error as Error);
      }

      pluginsInitialized = true;
      logger.info('Plugin registration complete');
    }
  } catch (error) {
    logger.error('Failed to initialize plugin system', error as Error);
  }

  try {
    if (!personalAssistantAgent) {
      const assistantModule = await import('../agents/PersonalAssistantAgent');
      personalAssistantAgent = assistantModule.personalAssistantAgent;
      logger.info('Personal assistant agent initialized');
    }
  } catch (error) {
    logger.error('Failed to initialize personal assistant agent', error as Error);
  }
};

// Initialize on first import
initializePlugins();

/**
 * Debug endpoint - check plugin registration
 */
router.get('/debug', async (req, res) => {
  try {
    await initializePlugins();

    const allPlugins = pluginRegistry ? pluginRegistry.getAllPlugins() : [];

    res.json({
      success: true,
      pluginsInitialized,
      registryExists: !!pluginRegistry,
      pluginCount: allPlugins.length,
      plugins: allPlugins
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Get all available plugins (system + user-generated) with pagination
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    // Ensure plugins are initialized
    await initializePlugins();

    if (!pluginRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not available'
      });
    }

    const systemPlugins = pluginRegistry.getAllPlugins();

    // Fetch user's custom plugins from database with pagination
    const { db: database } = await import('../../db');
    const { userGeneratedPlugins, pluginInstallations } = await import('../../db/schema-pg');
    const { eq, and } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');

    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Get total count of user plugins
    const totalResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(userGeneratedPlugins)
      .where(
        and(
          eq(userGeneratedPlugins.userId, userId),
          eq(userGeneratedPlugins.status, 'approved')
        )
      );

    const userPluginsTotal = Number(totalResult[0]?.count || 0);

    // Get paginated user plugins
    const userPlugins = await database
      .select()
      .from(userGeneratedPlugins)
      .where(
        and(
          eq(userGeneratedPlugins.userId, userId),
          eq(userGeneratedPlugins.status, 'approved')
        )
      )
      .orderBy(sql`${userGeneratedPlugins.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // Get installation status for user plugins
    const userPluginsWithStatus = await Promise.all(
      userPlugins.map(async (plugin) => {
        const installation = await database.query.pluginInstallations.findFirst({
          where: and(
            eq(pluginInstallations.userId, userId),
            eq(pluginInstallations.pluginId, plugin.pluginId)
          ),
        });

        return {
          id: plugin.pluginId,
          name: plugin.name,
          description: plugin.description,
          category: 'custom',
          icon: '🔌',
          requiresAuth: plugin.requiresAuth || false,
          authType: plugin.credentialsRequired ? 'api_key' : undefined,
          capabilities: plugin.capabilities || [],
          isUserGenerated: true,
          securityScore: plugin.securityScore,
          installed: !!installation,
          credentialsRequired: plugin.credentialsRequired || {},
        };
      })
    );

    // Combine system and user plugins
    const allPlugins = [
      ...systemPlugins.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        icon: p.icon,
        requiresAuth: p.requiresAuth,
        authType: p.authType,
        capabilities: p.capabilities,
        isUserGenerated: false,
      })),
      ...userPluginsWithStatus,
    ];

    const total = systemPlugins.length + userPluginsTotal;

    res.json({
      success: true,
      plugins: allPlugins,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get plugins', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugins'
    });
  }
});

/**
 * Get plugin status for current user (system + user-generated)
 */
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Ensure plugins are initialized
    await initializePlugins();

    if (!pluginRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not available'
      });
    }

    // Get system plugin status
    const status = pluginRegistry.getUserPluginStatus(userId);
    
    // Also check database for enabled plugins to ensure we include all connected plugins
    const { db: database } = await import('../../db');
    const { pluginConfigs, userGeneratedPlugins, pluginInstallations } = await import('../../db/schema-pg');
    const { eq, and } = await import('drizzle-orm');
    
    const enabledConfigs = await database
      .select()
      .from(pluginConfigs)
      .where(
        and(
          eq(pluginConfigs.userId, userId),
          eq(pluginConfigs.enabled, true)
        )
      );
    
    // Also get ALL plugin configs (enabled and disabled) to check if plugin exists in DB
    const allConfigs = await database
      .select()
      .from(pluginConfigs)
      .where(eq(pluginConfigs.userId, userId));
    
    // Build status array from in-memory status
    const systemStatusArray = Array.from(status.entries()).map((entry) => {
      const [pluginId, data] = entry as [string, any];
      return {
        pluginId,
        ...data
      };
    });
    
    // Create sets for quick lookup
    const enabledPluginIds = new Set(enabledConfigs.map(c => c.pluginId));
    const allPluginIds = new Set(allConfigs.map(c => c.pluginId));
    
    // Filter out plugins that are disabled in the database
    // Only keep plugins that are either:
    // 1. Enabled in the database, OR
    // 2. Not in the database at all (new plugins that haven't been configured yet)
    const filteredSystemStatus = systemStatusArray.filter(statusItem => {
      // If plugin is enabled in DB, keep it
      if (enabledPluginIds.has(statusItem.pluginId)) {
        return true;
      }
      // If plugin exists in DB but is disabled, exclude it
      if (allPluginIds.has(statusItem.pluginId)) {
        return false; // Plugin is disabled in DB, exclude it
      }
      // Plugin not in DB at all, check in-memory status
      // Only include if it's actually enabled and authenticated in memory
      return statusItem.status?.enabled === true && statusItem.status?.authenticated === true;
    });
    
    // Ensure all enabled plugins from database are included
    for (const config of enabledConfigs) {
      const existingStatus = filteredSystemStatus.find(s => s.pluginId === config.pluginId);
      if (!existingStatus) {
        // Plugin is enabled in DB but not in memory - add it
        const plugin = pluginRegistry.getPlugin(config.pluginId);
        if (plugin) {
          filteredSystemStatus.push({
            pluginId: config.pluginId,
            metadata: plugin.getMetadata(),
            status: {
              ...plugin.getStatus(),
              enabled: true, // Ensure enabled is true if in database
              authenticated: true // If enabled in DB, assume authenticated
            }
          });
        }
      } else {
        // Update existing status to ensure enabled/authenticated match database
        existingStatus.status.enabled = true;
        existingStatus.status.authenticated = true;
      }
    }

    // Get user-generated plugin status
    // SECURITY: Query pluginInstallations first to get plugins INSTALLED by this user
    // (not plugins CREATED by this user). Each user only sees their own installations.
    const userInstallations = await database
      .select()
      .from(pluginInstallations)
      .where(
        and(
          eq(pluginInstallations.userId, userId),
          eq(pluginInstallations.status, 'active')
        )
      );

    const userPluginStatus = await Promise.all(
      userInstallations.map(async (installation) => {
        // Get plugin details for this installation
        const plugin = await database.query.userGeneratedPlugins.findFirst({
          where: and(
            eq(userGeneratedPlugins.pluginId, installation.pluginId),
            eq(userGeneratedPlugins.status, 'approved')
          ),
        });

        if (!plugin) {
          // Plugin was deleted or rejected, skip it
          return null;
        }

        return {
          pluginId: plugin.pluginId,
          metadata: {
            id: plugin.pluginId,
            name: plugin.name,
            description: plugin.description,
            category: 'custom',
            icon: '🔌',
            requiresAuth: plugin.requiresAuth || false,
            authType: plugin.credentialsRequired ? 'api_key' : undefined,
            capabilities: plugin.capabilities || [],
          },
          status: {
            enabled: installation.status === 'active',
            initialized: true,
            authenticated: installation.status === 'active',
            health: installation.status === 'active' ? 'healthy' : 'warning',
            healthMessage: undefined,
            lastSync: installation.lastUsedAt,
            syncInProgress: false,
          },
        };
      })
    );

    // Filter out null entries (plugins that were deleted/rejected)
    const validUserPluginStatus = userPluginStatus.filter((status): status is NonNullable<typeof status> => status !== null);

    // Combine system and user plugin status
    const allStatus = [...filteredSystemStatus, ...validUserPluginStatus];

    res.json({
      success: true,
      plugins: allStatus
    });
  } catch (error) {
    logger.error('Failed to get plugin status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plugin status'
    });
  }
});

/**
 * Validate plugin connection (tests credentials and refreshes if needed)
 */
router.post('/:pluginId/validate', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pluginId } = req.params;

    // Ensure plugins are initialized
    await initializePlugins();

    if (!pluginRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Plugin system not available'
      });
    }

    const plugin = pluginRegistry.getPlugin(pluginId);
    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    // Validate credentials (will auto-refresh if needed)
    const isValid = await plugin.validateCredentials(userId);

    res.json({
      success: true,
      valid: isValid,
      message: isValid
        ? 'Connection is valid and tokens are up to date'
        : 'Connection failed. Please reconnect your account.'
    });
  } catch (error) {
    logger.error('Failed to validate plugin', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate plugin connection'
    });
  }
});

/**
 * OAuth callback for Gmail
 */
router.get('/gmail/auth/start', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Determine backend URL dynamically
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    // Use explicit redirect URI from env, or construct from backend URL
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/gmail/callback`;

    logger.info('Starting Gmail OAuth', {
      userId,
      backendUrl,
      redirectUri,
      hasExplicitRedirect: !!process.env.GOOGLE_REDIRECT_URI,
      envVars: {
        BACKEND_URL: process.env.BACKEND_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
      }
    });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent screen to always get refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      state: userId // Pass userId in state for callback
    });

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('Failed to start Gmail auth', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start authentication'
    });
  }
});

/**
 * OAuth callback handler for Gmail
 */
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    if (!code || !userId) {
      return res.status(400).send('Invalid callback parameters');
    }

    // Determine backend URL dynamically (must match the one used in /auth/start)
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    // Use explicit redirect URI from env, or construct from backend URL
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/gmail/callback`;

    logger.info('Gmail OAuth callback received', {
      userId,
      backendUrl,
      redirectUri,
      hasCode: !!code,
      envVars: {
        BACKEND_URL: process.env.BACKEND_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
      }
    });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    // Verify we got a refresh token
    if (!tokens.refresh_token) {
      logger.error(`No refresh token received from Google: userId=${userId}`);
      throw new Error('Failed to obtain refresh token. Please try reconnecting.');
    }

    logger.info('Gmail OAuth tokens received', {
      userId,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : 'unknown'
    });

    // Enable plugin with credentials
    await pluginRegistry.enablePlugin(userId, 'gmail', {
      type: 'oauth2',
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope ? [tokens.scope] : []
    });

    // Send HTML that closes the popup and notifies the parent window
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connected</title>
        </head>
        <body>
          <h2>Gmail connected successfully!</h2>
          <p>You can close this window now.</p>
          <script>
            // Notify parent window and close
            if (window.opener) {
              window.opener.postMessage({ type: 'gmail-connected', success: true }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              // If not a popup, redirect to integrations
              window.location.href = '${frontendUrl}/integrations?success=gmail';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Gmail OAuth callback failed', error as Error);
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <h2>Failed to connect Gmail</h2>
          <p>Please try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'gmail-connected', success: false }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '${frontendUrl}/integrations?error=gmail';
            }
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * Slack OAuth routes
 */
router.get('/slack/auth/start', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Determine backend URL dynamically
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    const redirectUri = process.env.SLACK_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/slack/callback`;

    const clientId = process.env.SLACK_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: 'Slack OAuth not configured. Please set SLACK_CLIENT_ID in environment variables.'
      });
    }

    const scopes = [
      'chat:write',
      'channels:read',
      'channels:write',
      'users:read',
      'search:read'
    ].join(',');

    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${userId}`;

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('Failed to start Slack auth', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start authentication'
    });
  }
});

router.get('/slack/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    if (!code || !userId) {
      return res.status(400).send('Invalid callback parameters');
    }

    // Determine backend URL dynamically
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    const redirectUri = process.env.SLACK_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/slack/callback`;

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok || !tokenData.authed_user?.access_token) {
      logger.warn(`Slack OAuth token exchange failed: error=${tokenData.error}, error_description=${tokenData.error_description}`);
      throw new Error(tokenData.error || 'Failed to obtain access token');
    }

    logger.info('Slack OAuth tokens received', {
      userId,
      hasAccessToken: !!tokenData.authed_user.access_token,
      teamId: tokenData.team?.id
    });

    // Enable plugin with credentials
    await pluginRegistry.enablePlugin(userId, 'slack', {
      type: 'oauth2',
      accessToken: tokenData.authed_user.access_token,
      scope: tokenData.authed_user.scope?.split(',') || []
    });

    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Slack Connected</title>
        </head>
        <body>
          <h2>Slack connected successfully!</h2>
          <p>You can close this window now.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'slack-connected', success: true }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '${frontendUrl}/integrations?success=slack';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Slack OAuth callback failed', error as Error);
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <h2>Failed to connect Slack</h2>
          <p>${error instanceof Error ? error.message : 'Please try again.'}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'slack-connected', success: false }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '${frontendUrl}/integrations?error=slack';
            }
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * OAuth callback for Google Calendar
 */
router.get('/google-calendar/auth/start', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI_CALENDAR || 'http://localhost:3001/api/plugins/google-calendar/callback'
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: userId
    });

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('Failed to start Calendar auth', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start authentication'
    });
  }
});

router.get('/google-calendar/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    if (!code || !userId) {
      return res.status(400).send('Invalid callback parameters');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI_CALENDAR || 'http://localhost:3001/api/plugins/google-calendar/callback'
    );

    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.refresh_token) {
      logger.error(`No refresh token received from Google Calendar: userId=${userId}`);
      throw new Error('Failed to obtain refresh token. Please try reconnecting.');
    }

    logger.info('Calendar OAuth tokens received', {
      userId,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : 'unknown'
    });

    await pluginRegistry.enablePlugin(userId, 'google-calendar', {
      type: 'oauth2',
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope ? [tokens.scope] : []
    });

    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
        </head>
        <body>
          <h2>Google Calendar connected successfully!</h2>
          <p>You can close this window now.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'calendar-connected', success: true }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '${frontendUrl}/integrations?success=calendar';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Calendar OAuth callback failed', error as Error);
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <h2>Failed to connect Google Calendar</h2>
          <p>Please try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'calendar-connected', success: false }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '${frontendUrl}/integrations?error=calendar';
            }
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * Configure Notion with API key
 */
router.post('/notion/configure', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    // Enable plugin with API key
    await pluginRegistry.enablePlugin(userId, 'notion', {
      type: 'api_key',
      apiKey
    });

    res.json({
      success: true,
      message: 'Notion connected successfully'
    });
  } catch (error) {
    logger.error('Failed to configure Notion', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Notion'
    });
  }
});

/**
 * OAuth flow for GitHub
 */
router.get('/github/auth/start', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Determine backend URL dynamically
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/github/callback`;

    const clientId = process.env.GITHUB_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in environment variables.'
      });
    }

    // GitHub OAuth URL with required scopes for repository access
    const scopes = [
      'repo',          // Full control of private repositories
      'read:user',     // Read user profile data
      'user:email'     // Access user email addresses
    ].join(' ');

    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${userId}`;

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('Failed to start GitHub auth', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start authentication'
    });
  }
});

/**
 * OAuth callback handler for GitHub
 */
router.get('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    if (!code || !userId) {
      return res.status(400).send('Invalid callback parameters');
    }

    // Determine backend URL dynamically
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.VERCEL_URL) {
      backendUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!backendUrl) {
      backendUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    }
    
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 
                      `${backendUrl}/api/plugins/github/callback`;

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      logger.warn(`GitHub OAuth token exchange failed: error=${tokenData.error}, error_description=${tokenData.error_description}`);
      throw new Error(tokenData.error_description || 'Failed to obtain access token');
    }

    logger.info('GitHub OAuth tokens received', {
      userId,
      hasAccessToken: !!tokenData.access_token,
      scope: tokenData.scope
    });

    // Enable plugin with credentials
    await pluginRegistry.enablePlugin(userId, 'github', {
      type: 'oauth2',
      accessToken: tokenData.access_token,
      scope: tokenData.scope ? [tokenData.scope] : []
    });

    // Send HTML that closes the popup and notifies the parent window
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Connected</title>
        </head>
        <body>
          <h2>GitHub connected successfully!</h2>
          <p>You can close this window now.</p>
          <script>
            // Notify parent window and close
            if (window.opener) {
              window.opener.postMessage({ type: 'github-connected', success: true }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              // If not a popup, redirect to integrations
              window.location.href = '${frontendUrl}/integrations?success=github';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('GitHub OAuth callback failed', error as Error);
    const frontendUrl = getFrontendUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <h2>Failed to connect GitHub</h2>
          <p>${error instanceof Error ? error.message : 'Please try again.'}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'github-connected', success: false }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '${frontendUrl}/integrations?error=github';
            }
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * Enable a plugin
 */
const enablePluginSchema = z.object({
  pluginId: z.string(),
  credentials: z.object({
    type: z.enum(['oauth2', 'api_key', 'basic_auth']),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    apiKey: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional()
  })
});

router.post('/enable', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pluginId, credentials } = enablePluginSchema.parse(req.body);

    await pluginRegistry.enablePlugin(userId, pluginId, credentials);

    res.json({
      success: true,
      message: `Plugin ${pluginId} enabled successfully`
    });
  } catch (error) {
    logger.error('Failed to enable plugin', error as Error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to enable plugin'
    });
  }
});

/**
 * Disable a plugin
 */
router.post('/:pluginId/disable', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pluginId } = req.params;

    await pluginRegistry.disablePlugin(userId, pluginId);

    res.json({
      success: true,
      message: `Plugin ${pluginId} disabled successfully`
    });
  } catch (error) {
    logger.error('Failed to disable plugin', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable plugin'
    });
  }
});

/**
 * Sync a plugin
 */
router.post('/:pluginId/sync', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pluginId } = req.params;
    const { fullSync, since, until, maxItems } = req.body;

    const options = {
      fullSync,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      maxItems
    };

    const result = await pluginRegistry.syncPlugin(userId, pluginId, options);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Failed to sync plugin', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync plugin'
    });
  }
});

/**
 * Execute plugin action
 */
router.post('/:pluginId/action', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { pluginId } = req.params;
    const { action, params } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required'
      });
    }

    const result = await pluginRegistry.executeAction(userId, pluginId, action, params || {});

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Failed to execute plugin action', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute action'
    });
  }
});

/**
 * Get available tools from all enabled plugins
 */
router.get('/tools', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tools = await pluginRegistry.getAvailableTools(userId);

    res.json({
      success: true,
      tools: tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    });
  } catch (error) {
    logger.error('Failed to get tools', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tools'
    });
  }
});

/**
 * Query knowledge from plugins
 */
router.post('/knowledge/query', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { prompt, pluginIds, types, since, limit } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const filters = {
      pluginIds,
      types,
      since: since ? new Date(since) : undefined,
      limit
    };

    const knowledge = await pluginRegistry.queryKnowledge(userId, prompt, filters);

    res.json({
      success: true,
      knowledge
    });
  } catch (error) {
    logger.error('Failed to query knowledge', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to query knowledge'
    });
  }
});

/**
 * Personal assistant chat endpoint
 */
const assistantMessageSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
  includeContext: z.boolean().optional(),
  maxContextItems: z.number().optional(),
  stream: z.boolean().optional() // New: enable streaming
});

router.post('/assistant/chat', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const data = assistantMessageSchema.parse(req.body);

    // Ensure plugins are initialized
    await initializePlugins();

    if (!personalAssistantAgent) {
      return res.status(503).json({
        success: false,
        error: 'Personal assistant not available'
      });
    }

    // If streaming is requested, use streaming endpoint
    if (data.stream) {
      return handleStreamingChat(req, res, userId, data);
    }

    // Non-streaming (original behavior)
    const result = await personalAssistantAgent.processRequest(userId, data.message, {
      sessionId: data.sessionId,
      includeContext: data.includeContext,
      maxContextItems: data.maxContextItems
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to process assistant message', error as Error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * Handle streaming chat with Server-Sent Events (SSE)
 * Streams the response word-by-word for live user experience
 */
async function handleStreamingChat(
  req: any,
  res: any,
  userId: string,
  data: { message: string; sessionId?: string; includeContext?: boolean; maxContextItems?: number }
) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const sendSSE = (type: string, data: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } catch (error) {
      // Client disconnected
      logger.warn('SSE write failed, client likely disconnected');
    }
  };

  // Clean up on client disconnect
  req.on('close', () => {
    res.end();
  });

  try {
    // Send initial connection message
    sendSSE('connected', { message: 'Streaming started' });

    // Process request with agent (this handles all the complex logic)
    const result = await personalAssistantAgent.processRequest(userId, data.message, {
      sessionId: data.sessionId,
      includeContext: data.includeContext,
      maxContextItems: data.maxContextItems
    });

    // Stream the response word-by-word for live effect
    const response = result.response;
    const words = response.split(/(\s+)/); // Split by whitespace but keep it
    let currentText = '';

    // Send tools used immediately
    if (result.toolsUsed && result.toolsUsed.length > 0) {
      sendSSE('tools_used', { tools: result.toolsUsed });
    }

    // Stream words with a small delay for natural reading speed
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentText += word;
      
      // Send chunk (every word or every few words for better performance)
      sendSSE('chunk', { text: word });
      
      // Small delay to simulate typing (adjust for faster/slower)
      if (i % 3 === 0) { // Every 3 words, add a tiny delay
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Send completion with full response and metadata
    sendSSE('complete', {
      response: result.response,
      toolsUsed: result.toolsUsed || [],
      contextUsed: result.contextUsed || [],
      suggestions: result.suggestions || []
    });

    res.end();
  } catch (error) {
    logger.error('Streaming chat error', error as Error);
    sendSSE('error', {
      message: error instanceof Error ? error.message : 'Failed to process message'
    });
    res.end();
  }
}

/**
 * Get daily summary
 */
router.get('/assistant/daily-summary', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Ensure plugins are initialized
    await initializePlugins();

    if (!personalAssistantAgent) {
      return res.status(503).json({
        success: false,
        error: 'Personal assistant not available'
      });
    }

    const summary = await personalAssistantAgent.getDailySummary(userId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Failed to get daily summary', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get daily summary'
    });
  }
});

/**
 * Clear assistant conversation history
 */
router.post('/assistant/clear-history', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { sessionId } = req.body;
    personalAssistantAgent.clearHistory(sessionId || userId);

    res.json({
      success: true,
      message: 'Conversation history cleared'
    });
  } catch (error) {
    logger.error('Failed to clear history', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear history'
    });
  }
});

export default router;
