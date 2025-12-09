import { Router } from 'express';
import { db } from '../../db';
import { chatMessages, codeGenerationSessions, workspaces, userCredentials, users, agents } from '../../db/schema-pg';
import { sql, eq, desc } from 'drizzle-orm';
import { chatCleanupService } from '../services/ChatCleanupService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { authenticateUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
const logger = new SimpleLogger('AdminRoutes');

// All admin routes require admin authentication
router.use(authenticateUser);
router.use(requireAdmin);

/**
 * POST /api/admin/cleanup/orphaned
 * Cleans up all orphaned references in the database
 * - Removes chat messages referencing non-existent workspaces
 * - Removes code generation sessions referencing non-existent workspaces
 */
router.post('/cleanup/orphaned', async (req, res) => {
  try {
    logger.info('Starting comprehensive orphaned data cleanup');

    const results = {
      chatMessages: 0,
      codeSessions: 0,
      timestamp: new Date().toISOString()
    };

    // Clean up orphaned chat messages
    try {
      const chatResult = await chatCleanupService.cleanupOrphaned();
      results.chatMessages = chatResult.deleted;
      logger.info(`Cleaned up ${chatResult.deleted} orphaned chat messages`);
    } catch (error) {
      logger.error('Failed to clean up orphaned chat messages', error as Error);
    }

    // Clean up orphaned code generation sessions
    try {
      const sessionResult = await db.execute(sql`
        DELETE FROM code_generation_sessions
        WHERE workspace_id IS NOT NULL
        AND workspace_id NOT IN (SELECT id FROM workspaces)
        RETURNING id
      `);
      results.codeSessions = sessionResult.rowCount || 0;
      logger.info(`Cleaned up ${results.codeSessions} orphaned code generation sessions`);
    } catch (error) {
      logger.error('Failed to clean up orphaned code sessions', error as Error);
    }

    logger.info('Orphaned data cleanup completed', results);
    res.json({
      success: true,
      message: 'Orphaned data cleanup completed',
      results
    });
  } catch (error) {
    logger.error('Orphaned data cleanup failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up orphaned data',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/cleanup/old-messages
 * Manually trigger cleanup of messages older than 24 hours
 */
router.post('/cleanup/old-messages', async (req, res) => {
  try {
    logger.info('Manually triggering chat message cleanup');
    const result = await chatCleanupService.cleanup();

    res.json({
      success: true,
      message: `Cleaned up ${result.deleted} old chat messages`,
      deleted: result.deleted
    });
  } catch (error) {
    logger.error('Manual chat cleanup failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up old messages',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/stats/chat
 * Get statistics about chat messages
 */
router.get('/stats/chat', async (req, res) => {
  try {
    const stats = await chatCleanupService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get chat statistics', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/stats/database
 * Get overall database statistics
 */
router.get('/stats/database', async (req, res) => {
  try {
    logger.info('Fetching database statistics');

    // Count total workspaces
    const workspaceResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workspaces
    `);
    const totalWorkspaces = Number(workspaceResult.rows[0]?.count || 0);

    // Count total code sessions
    const sessionResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM code_generation_sessions
    `);
    const totalSessions = Number(sessionResult.rows[0]?.count || 0);

    // Count orphaned sessions
    const orphanedSessionResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM code_generation_sessions
      WHERE workspace_id IS NOT NULL
      AND workspace_id NOT IN (SELECT id FROM workspaces)
    `);
    const orphanedSessions = Number(orphanedSessionResult.rows[0]?.count || 0);

    // Get chat stats
    const chatStats = await chatCleanupService.getStats();

    res.json({
      success: true,
      stats: {
        workspaces: totalWorkspaces,
        codeSessions: {
          total: totalSessions,
          orphaned: orphanedSessions
        },
        chatMessages: chatStats
      }
    });
  } catch (error) {
    logger.error('Failed to get database statistics', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database statistics',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/stats
 * Get comprehensive system-wide statistics
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Fetching comprehensive system statistics');

    // Get counts of all major entities
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [agentsCount] = await db.select({ count: sql<number>`count(*)` }).from(agents);
    const [workspacesCount] = await db.select({ count: sql<number>`count(*)` }).from(workspaces);
    const [credentialsCount] = await db.select({ count: sql<number>`count(*)` }).from(userCredentials);

    // Count system vs user agents
    const [systemAgentsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(eq(agents.isSystem, 1));

    const [userAgentsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(eq(agents.isSystem, 0));

    // Count users by role
    const usersByRole = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`
      })
      .from(users)
      .groupBy(users.role);

    // Count users by tier
    const usersByTier = await db
      .select({
        tier: users.tier,
        count: sql<number>`count(*)`
      })
      .from(users)
      .groupBy(users.tier);

    const stats = {
      users: {
        total: Number(usersCount.count),
        byRole: usersByRole.reduce((acc, { role, count }) => {
          acc[role] = Number(count);
          return acc;
        }, {} as Record<string, number>),
        byTier: usersByTier.reduce((acc, { tier, count }) => {
          acc[tier] = Number(count);
          return acc;
        }, {} as Record<string, number>)
      },
      agents: {
        total: Number(agentsCount.count),
        system: Number(systemAgentsCount.count),
        user: Number(userAgentsCount.count)
      },
      workspaces: {
        total: Number(workspacesCount.count),
      },
      credentials: {
        total: Number(credentialsCount.count)
      }
    };

    logger.info('System stats fetched successfully');
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats', error as Error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

/**
 * GET /api/admin/users
 * Get all users with detailed information
 */
router.get('/users', async (req, res) => {
  try {
    logger.info('Fetching all users');

    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // Remove sensitive data
    const sanitizedUsers = allUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tier: user.tier,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId ? 'CONFIGURED' : null,
    }));

    logger.info(`Fetched ${sanitizedUsers.length} users`);
    res.json(sanitizedUsers);
  } catch (error) {
    logger.error('Error fetching users', error as Error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Update a user's role
 */
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        validRoles: ['user', 'admin', 'superadmin']
      });
    }

    logger.info(`Updating user ${userId} role to ${role}`);

    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`Updated user ${userId} role to ${role}`);
    res.json({ success: true, user: updated[0] });
  } catch (error) {
    logger.error('Error updating user role', error as Error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/**
 * PUT /api/admin/users/:userId/tier
 * Update a user's tier
 */
router.put('/users/:userId/tier', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        validTiers: ['free', 'pro', 'enterprise']
      });
    }

    logger.info(`Updating user ${userId} tier to ${tier}`);

    const updated = await db
      .update(users)
      .set({ tier })
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`Updated user ${userId} tier to ${tier}`);
    res.json({ success: true, user: updated[0] });
  } catch (error) {
    logger.error('Error updating user tier', error as Error);
    res.status(500).json({ error: 'Failed to update user tier' });
  }
});

/**
 * GET /api/admin/workspaces
 * Get all workspaces with owner information
 */
router.get('/workspaces', async (req, res) => {
  try {
    logger.info('Fetching all workspaces');

    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.createdAt));

    logger.info(`Fetched ${allWorkspaces.length} workspaces`);
    res.json(allWorkspaces);
  } catch (error) {
    logger.error('Error fetching workspaces', error as Error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

/**
 * GET /api/admin/agents
 * Get all agents with ownership metadata
 */
router.get('/agents', async (req, res) => {
  try {
    logger.info('Fetching all agents');

    const allAgents = await db.select().from(agents);

    // Transform and add ownership metadata
    const transformedAgents = allAgents.map(agent => ({
      ...agent,
      capabilities:
        typeof agent.capabilities === 'string'
          ? JSON.parse(agent.capabilities)
          : agent.capabilities,
      expertise:
        typeof agent.expertise === 'string'
          ? JSON.parse(agent.expertise)
          : agent.expertise,
      frameworks:
        typeof agent.frameworks === 'string'
          ? JSON.parse(agent.frameworks)
          : agent.frameworks,
      libraries:
        typeof agent.libraries === 'string'
          ? JSON.parse(agent.libraries)
          : agent.libraries,
      bestPractices:
        typeof agent.bestPractices === 'string'
          ? JSON.parse(agent.bestPractices)
          : agent.bestPractices,
      customInstructions: agent.customInstructions
        ? typeof agent.customInstructions === 'string'
          ? JSON.parse(agent.customInstructions)
          : agent.customInstructions
        : null,
      enabledPlugins:
        typeof agent.enabledPlugins === 'string'
          ? JSON.parse(agent.enabledPlugins)
          : agent.enabledPlugins || [],
      isActive: Boolean(agent.isActive),
      _isSystemAgent: agent.isSystem === 1,
      _ownerUserId: agent.userId || null,
    }));

    logger.info(`Fetched ${transformedAgents.length} total agents`);
    res.json(transformedAgents);
  } catch (error) {
    logger.error('Error fetching all agents', error as Error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/admin/user/:userId/details
 * Get detailed information about a specific user
 */
router.get('/user/:userId/details', async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info(`Fetching details for user ${userId}`);

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's agents
    const userAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId));

    // Get user's workspaces
    const userWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));

    // Get user's credentials count
    const [credentialsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));

    const details = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        tier: user.tier,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId ? 'CONFIGURED' : null,
      },
      stats: {
        agentsCount: userAgents.length,
        workspacesCount: userWorkspaces.length,
        credentialsCount: Number(credentialsCount.count),
      },
      recentAgents: userAgents.slice(0, 5),
      recentWorkspaces: userWorkspaces.slice(0, 5),
    };

    res.json(details);
  } catch (error) {
    logger.error('Error fetching user details', error as Error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

export default router;
