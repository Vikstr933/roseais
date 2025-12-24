import { Router } from 'express';
import { db } from '../../db';
import { users, sessions } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { retryDbOperation } from '../utils/dbRetry';

const router = Router();

/**
 * Handle OPTIONS preflight for OAuth endpoint
 * OPTIONS /api/auth/oauth
 */
router.options('/oauth', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

/**
 * Catch-all for unsupported methods on /oauth endpoint
 * This helps debug routing issues
 */
router.all('/oauth', (req, res, next) => {
  if (req.method === 'POST') {
    // Let POST handler process it
    return next();
  }
  if (req.method === 'OPTIONS') {
    // Already handled above
    return next();
  }
  // Log unsupported methods for debugging
  console.warn(`[OAuth] Unsupported method ${req.method} for /oauth endpoint`);
  res.status(405).json({
    error: `Method ${req.method} not allowed. Use POST.`,
    allowedMethods: ['POST', 'OPTIONS']
  });
});

/**
 * Handle OAuth callback from Supabase
 * POST /api/auth/oauth
 */
router.post('/oauth', async (req, res) => {
  try {
    // Log request details for debugging
    console.log('[OAuth] Received OAuth request:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
      hasBody: !!req.body,
    });

    const { provider, providerId, email, displayName, avatarUrl } = req.body;

    console.log('[OAuth] OAuth data:', { provider, providerId, email: email?.substring(0, 10) + '...' });

    if (!provider || !providerId || !email) {
      console.error('[OAuth] Missing required fields:', { provider: !!provider, providerId: !!providerId, email: !!email });
      return res.status(400).json({ 
        error: 'Missing required fields: provider, providerId, email' 
      });
    }

    // Check if user exists with this OAuth provider (with retry logic)
    let user = await retryDbOperation(async () => {
      const rows = await db
        .select()
        .from(users as any)
        .where(eq((users as any).email, email))
        .limit(1);
      return rows[0];
    });

    if (!user) {
      // Create new user (with retry logic)
      const username = email.split('@')[0] + '_' + provider;
      try {
        const insertResult = await retryDbOperation(async () => {
          return await db.insert(users as any).values({
            id: randomUUID(),
            username,
            email,
            displayName: displayName || username,
            // OAuth users don't have a password
            passwordHash: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date(),
            lastActive: new Date(),
            isActive: true,
          }).returning();
        });
        const newUser = Array.isArray(insertResult) ? insertResult[0] : null;
        if (!newUser) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
        user = newUser;
        console.log(`✅ Created new OAuth user: ${email} via ${provider}`);
      } catch (insertError: any) {
        // If user was created between our check and insert (race condition), fetch it
        if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate') || insertError.code === '23505') {
          console.log(`⚠️ User already exists (race condition), fetching existing user: ${email}`);
          const existingUser = await retryDbOperation(async () => {
            const rows = await db
              .select()
              .from(users as any)
              .where(eq((users as any).email, email))
              .limit(1);
            return rows[0];
          });
          if (existingUser) {
            user = existingUser;
            console.log(`✅ Found existing user after race condition: ${email}`);
          } else {
            throw insertError; // Re-throw if we can't find the user
          }
        } else {
          throw insertError; // Re-throw other errors
        }
      }
    } else {
      // Update last active (with retry logic)
      await retryDbOperation(async () => {
        return await db
          .update(users as any)
          .set({ lastActive: new Date() })
          .where(eq((users as any).id, user.id));
      });

      console.log(`✅ OAuth login: ${email} via ${provider}`);
    }

    // Create session (using session ID as token for PostgreSQL) (with retry logic)
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await retryDbOperation(async () => {
      return await db.insert(sessions as any).values({
        id: sessionId,
        userId: user.id,
        expiresAt,
      });
    });

    // Invalidate workspace cache when user logs in to ensure fresh data
    const { performanceService } = await import('../services/PerformanceService');
    const cache = performanceService.getCache();
    cache.deletePattern('/api/workspaces');
    console.log(`[OAuth] Invalidated workspace cache for user ${user.id} on login`);

    // Return user data and session token (using session ID as token)
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        preferences: user.preferences || {},
      },
      sessionToken: sessionId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode = (error as any)?.code;
    
    console.error('[OAuth] Error processing OAuth:', {
      message: errorMessage,
      code: errorCode,
      stack: errorStack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
    });
    
    // Provide more specific error messages
    const isConnectionError = 
      errorMessage.includes('Connection terminated') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('Connection') ||
      errorMessage.includes('database') ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ETIMEDOUT';
    
    const isUniqueConstraintError = 
      errorMessage.includes('unique') ||
      errorMessage.includes('duplicate') ||
      errorCode === '23505';
    
    if (isConnectionError) {
      console.error('[OAuth] Database connection error');
      res.status(503).json({ 
        error: 'Database connection failed. Please try again in a moment.',
        retryable: true,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    } else if (isUniqueConstraintError) {
      console.error('[OAuth] Unique constraint error - user may already exist');
      // Try to fetch existing user and return success
      try {
        const existingUser = await retryDbOperation(async () => {
          const rows = await db
            .select()
            .from(users as any)
            .where(eq((users as any).email, req.body.email))
            .limit(1);
          return rows[0];
        });
        
        if (existingUser) {
          // User exists, create session and return
          const sessionId = randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          await retryDbOperation(async () => {
            return await db.insert(sessions as any).values({
              id: sessionId,
              userId: existingUser.id,
              expiresAt,
            });
          });
          
          console.log(`[OAuth] ✅ User already exists, created session: ${existingUser.email}`);
          
          return res.json({
            user: {
              id: existingUser.id,
              username: existingUser.username,
              email: existingUser.email,
              displayName: existingUser.displayName,
              role: existingUser.role || 'user',
              createdAt: existingUser.createdAt,
              lastActive: existingUser.lastActive,
              preferences: existingUser.preferences || {},
            },
            sessionToken: sessionId,
          });
        }
      } catch (fetchError) {
        console.error('[OAuth] Failed to fetch existing user after unique constraint error:', fetchError);
      }
      
      res.status(409).json({ 
        error: 'User already exists with this email',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    } else {
      console.error('[OAuth] Unknown error:', errorMessage);
      res.status(500).json({ 
        error: 'Failed to process OAuth authentication',
        details: process.env.NODE_ENV === 'development' ? {
          message: errorMessage,
          code: errorCode,
          stack: errorStack?.split('\n').slice(0, 10).join('\n')
        } : undefined
      });
    }
  }
});

export default router;

