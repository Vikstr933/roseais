import express from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { userCredentials, oauthStates } from '../../db/schema-pg';
import { eq, and, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { getCredentialVault } from '../services/CredentialVault';
import { SimpleLogger } from '../utils/SimpleLogger';
import { authenticateUser } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();
const logger = new SimpleLogger('CredentialsAPI');
const vault = getCredentialVault();

// Validation schemas
const addCredentialSchema = z.object({
  serviceName: z.string().min(1),
  credentialType: z.enum(['api_key', 'oauth2', 'personal_access_token', 'custom']),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  credentials: z.record(z.any()),
});

const updateCredentialSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  credentials: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/credentials
 * Get all user's credentials (with masked sensitive data)
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const creds = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId))
      .orderBy(desc(userCredentials.createdAt));

    // Mask sensitive data before sending
    const maskedCreds = creds.map(cred => ({
      id: cred.id,
      serviceName: cred.serviceName,
      credentialType: cred.credentialType,
      displayName: cred.displayName,
      description: cred.description,
      isActive: cred.isActive,
      validationStatus: cred.validationStatus,
      lastUsedAt: cred.lastUsedAt,
      lastValidatedAt: cred.lastValidatedAt,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      // Don't send encrypted data or tokens
    }));

    res.json({
      credentials: maskedCreds,
      total: creds.length,
    });
  } catch (error) {
    logger.error('Failed to fetch credentials', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

/**
 * POST /api/credentials
 * Add new credentials
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = addCredentialSchema.parse(req.body);

    logger.info('Adding credential', { userId, serviceName: body.serviceName });

    // Validate credentials structure
    const validation = vault.validateCredentials(body.serviceName, body.credentials);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid credentials',
        details: validation.errors,
      });
    }

    // Encrypt credentials
    const encryptedData = vault.encrypt(body.credentials);

    // Check if credential already exists
    const existing = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.serviceName, body.serviceName),
        eq(userCredentials.displayName, body.displayName)
      )
    });

    let credential;
    if (existing) {
      // Update existing credential
      [credential] = await db
        .update(userCredentials)
        .set({
          credentialType: body.credentialType,
          description: body.description,
          encryptedData,
          lastModifiedIp: req.ip || req.socket.remoteAddress,
          validationStatus: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.id, existing.id))
        .returning();
      
      logger.info('Credential updated successfully', {
        userId,
        credentialId: credential.id,
        serviceName: body.serviceName,
      });
    } else {
      // Insert new credential
      [credential] = await db
        .insert(userCredentials)
        .values({
          userId,
          serviceName: body.serviceName,
          credentialType: body.credentialType,
          displayName: body.displayName,
          description: body.description,
          encryptedData,
          createdFromIp: req.ip || req.socket.remoteAddress,
          validationStatus: 'pending',
        })
        .returning();
      
      logger.info('Credential added successfully', {
        userId,
        credentialId: credential.id,
        serviceName: body.serviceName,
      });
    }

    logger.info('Credential added successfully', {
      userId,
      credentialId: credential.id,
      serviceName: body.serviceName,
    });

    res.json({
      success: true,
      credential: {
        id: credential.id,
        serviceName: credential.serviceName,
        credentialType: credential.credentialType,
        displayName: credential.displayName,
        description: credential.description,
      },
    });
  } catch (error) {
    logger.error('Failed to add credential', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Failed to add credential' });
  }
});

/**
 * PUT /api/credentials/:id
 * Update existing credential
 */
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const credentialId = parseInt(req.params.id);
    const body = updateCredentialSchema.parse(req.body);

    // Check if credential exists and belongs to user
    const existing = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.id, credentialId),
        eq(userCredentials.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const updates: any = {
      updatedAt: new Date(),
      lastModifiedIp: req.ip || req.socket.remoteAddress,
    };

    if (body.displayName) updates.displayName = body.displayName;
    if (body.description !== undefined) updates.description = body.description;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    // If updating credentials, encrypt them
    if (body.credentials) {
      const validation = vault.validateCredentials(existing.serviceName, body.credentials);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid credentials',
          details: validation.errors,
        });
      }
      updates.encryptedData = vault.encrypt(body.credentials);
      updates.validationStatus = 'pending';
    }

    await db
      .update(userCredentials)
      .set(updates)
      .where(eq(userCredentials.id, credentialId));

    logger.info('Credential updated', { userId, credentialId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update credential', error);
    res.status(500).json({ error: 'Failed to update credential' });
  }
});

/**
 * DELETE /api/credentials/:id
 * Delete credential
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const credentialId = parseInt(req.params.id);

    // Check if credential exists and belongs to user
    const existing = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.id, credentialId),
        eq(userCredentials.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    await db
      .delete(userCredentials)
      .where(eq(userCredentials.id, credentialId));

    logger.info('Credential deleted', { userId, credentialId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete credential', error);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

/**
 * POST /api/credentials/:id/test
 * Test credential validity
 */
router.post('/:id/test', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const credentialId = parseInt(req.params.id);

    const credential = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.id, credentialId),
        eq(userCredentials.userId, userId)
      ),
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Decrypt credentials
    const decrypted = vault.decrypt(credential.encryptedData);

    // Test based on service type
    let testResult = { valid: false, error: '' };

    try {
      switch (credential.serviceName.toLowerCase()) {
        case 'discord':
          testResult = await testDiscordCredentials(decrypted);
          break;
        case 'slack':
          testResult = await testSlackCredentials(decrypted);
          break;
        case 'trello':
          testResult = await testTrelloCredentials(decrypted);
          break;
        case 'notion':
          testResult = await testNotionCredentials(decrypted);
          break;
        case 'github':
          testResult = await testGitHubCredentials(decrypted);
          break;
        default:
          testResult = { valid: true, error: '' }; // Can't test custom services
      }
    } catch (error) {
      testResult = {
        valid: false,
        error: error instanceof Error ? error.message : 'Test failed',
      };
    }

    // Update validation status
    await db
      .update(userCredentials)
      .set({
        validationStatus: testResult.valid ? 'valid' : 'invalid',
        validationError: testResult.error || null,
        lastValidatedAt: new Date(),
      })
      .where(eq(userCredentials.id, credentialId));

    res.json({
      valid: testResult.valid,
      error: testResult.error,
    });
  } catch (error) {
    logger.error('Failed to test credential', error);
    res.status(500).json({ error: 'Failed to test credential' });
  }
});

/**
 * GET /api/credentials/oauth/:service/start
 * Start OAuth flow for a service
 */
router.get('/oauth/:service/start', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const serviceName = req.params.service;

    // Generate state token for CSRF protection
    const stateToken = crypto.randomBytes(32).toString('hex');

    // Store state
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

    await db.insert(oauthStates).values({
      stateToken,
      userId,
      serviceName,
      createdFromIp: req.ip || req.socket.remoteAddress,
      expiresAt,
    });

    // Get OAuth URL based on service
    const authUrl = getOAuthUrl(serviceName, stateToken);

    if (!authUrl) {
      return res.status(400).json({ error: 'OAuth not supported for this service' });
    }

    res.json({
      authUrl,
      state: stateToken,
    });
  } catch (error) {
    logger.error('Failed to start OAuth flow', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
});

/**
 * GET /api/credentials/oauth/:service/callback
 * OAuth callback handler
 */
router.get('/oauth/:service/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const serviceName = req.params.service;

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Verify state token
    const stateRecord = await db.query.oauthStates.findFirst({
      where: eq(oauthStates.stateToken, state as string),
    });

    if (!stateRecord) {
      return res.status(400).send('Invalid state token');
    }

    // Check expiry
    if (new Date() > stateRecord.expiresAt) {
      return res.status(400).send('State token expired');
    }

    // Exchange code for tokens
    const tokens = await exchangeOAuthCode(serviceName, code as string);

    if (!tokens) {
      return res.status(400).send('Failed to exchange code for tokens');
    }

    // Store credentials
    const encryptedData = vault.encrypt(tokens);

    await db.insert(userCredentials).values({
      userId: stateRecord.userId,
      serviceName,
      credentialType: 'oauth2',
      displayName: `${serviceName} OAuth`,
      encryptedData,
      oauthAccessToken: tokens.access_token,
      oauthRefreshToken: tokens.refresh_token,
      oauthExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      validationStatus: 'valid',
    });

    // Delete state
    await db.delete(oauthStates).where(eq(oauthStates.stateToken, state as string));

    // Redirect to success page
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/credentials?oauth=success&service=${serviceName}`);
  } catch (error) {
    logger.error('OAuth callback failed', error);
    res.status(500).send('OAuth callback failed');
  }
});

// Helper functions for testing credentials
async function testDiscordCredentials(creds: any): Promise<{ valid: boolean; error: string }> {
  // Test Discord bot token or OAuth
  if (creds.botToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bot ${creds.botToken}`,
      },
    });
    return {
      valid: response.ok,
      error: response.ok ? '' : 'Invalid bot token',
    };
  }
  return { valid: true, error: '' };
}

async function testSlackCredentials(creds: any): Promise<{ valid: boolean; error: string }> {
  if (creds.botToken) {
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        Authorization: `Bearer ${creds.botToken}`,
      },
    });
    const data = await response.json();
    return {
      valid: data.ok,
      error: data.ok ? '' : data.error || 'Invalid token',
    };
  }
  return { valid: true, error: '' };
}

async function testTrelloCredentials(creds: any): Promise<{ valid: boolean; error: string }> {
  if (creds.apiKey && creds.apiToken) {
    const response = await fetch(
      `https://api.trello.com/1/members/me?key=${creds.apiKey}&token=${creds.apiToken}`
    );
    return {
      valid: response.ok,
      error: response.ok ? '' : 'Invalid API key or token',
    };
  }
  return { valid: false, error: 'Missing API key or token' };
}

async function testNotionCredentials(creds: any): Promise<{ valid: boolean; error: string }> {
  if (creds.apiKey) {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });
    return {
      valid: response.ok,
      error: response.ok ? '' : 'Invalid API key',
    };
  }
  return { valid: false, error: 'Missing API key' };
}

async function testGitHubCredentials(creds: any): Promise<{ valid: boolean; error: string }> {
  if (creds.personalAccessToken) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${creds.personalAccessToken}`,
      },
    });
    return {
      valid: response.ok,
      error: response.ok ? '' : 'Invalid personal access token',
    };
  }
  return { valid: true, error: '' };
}

// Helper to get OAuth URLs
function getOAuthUrl(serviceName: string, state: string): string | null {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/credentials/oauth/${serviceName}/callback`;

  const configs: Record<string, string> = {
    discord: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=bot%20identify%20guilds&state=${state}`,
    slack: `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=channels:read,chat:write,users:read&state=${state}`,
    github: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${state}`,
  };

  return configs[serviceName.toLowerCase()] || null;
}

// Helper to exchange OAuth code for tokens
async function exchangeOAuthCode(serviceName: string, code: string): Promise<any> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/credentials/oauth/${serviceName}/callback`;

  try {
    let response;

    switch (serviceName.toLowerCase()) {
      case 'discord':
        response = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        });
        break;

      case 'slack':
        response = await fetch('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.SLACK_CLIENT_ID!,
            client_secret: process.env.SLACK_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
          }),
        });
        break;

      case 'github':
        response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        });
        break;

      default:
        return null;
    }

    if (!response.ok) {
      logger.error('OAuth token exchange failed', { serviceName, status: response.status });
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('OAuth token exchange error', error);
    return null;
  }
}

export default router;
