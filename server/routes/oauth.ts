import { Router } from 'express';
import { db } from '../../db';
import { users, sessions } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

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

    // Check if user exists with this OAuth provider
    let user = await db
      .select()
      .from(users as any)
      .where(eq((users as any).email, email))
      .limit(1)
      .then(rows => rows[0]);

    if (!user) {
      // Create new user
      const username = email.split('@')[0] + '_' + provider;
      const [newUser] = await db.insert(users as any).values({
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

      user = newUser;
      console.log(`✅ Created new OAuth user: ${email} via ${provider}`);
    } else {
      // Update last active
      await db
        .update(users as any)
        .set({ lastActive: new Date() })
        .where(eq((users as any).id, user.id));

      console.log(`✅ OAuth login: ${email} via ${provider}`);
    }

    // Create session (using session ID as token for PostgreSQL)
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await db.insert(sessions as any).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
    });

    // Return user data and session token (using session ID as token)
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
      sessionToken: sessionId,
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ 
      error: 'Failed to process OAuth authentication' 
    });
  }
});

export default router;

