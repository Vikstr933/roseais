import { Router } from 'express';
import { db } from '../../db';
import { users, sessions } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { retryDbOperation } from '../utils/dbRetry';

const router = Router();

/**
 * Handle OAuth callback from Supabase
 * POST /api/auth/oauth
 */
router.post('/oauth', async (req, res) => {
  try {
    const { provider, providerId, email, displayName, avatarUrl } = req.body;

    if (!provider || !providerId || !email) {
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
    console.error('OAuth error:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = 
      errorMessage.includes('Connection terminated') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT');
    
    if (isConnectionError) {
      res.status(503).json({ 
        error: 'Database connection failed. Please try again in a moment.',
        retryable: true
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to process OAuth authentication',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
});

export default router;

