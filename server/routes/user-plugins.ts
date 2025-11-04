import express from 'express';
import { z } from 'zod';
import { db } from '../../db';
import {
  userGeneratedPlugins,
  pluginGenerationRequests,
  pluginInstallations,
  pluginExecutionLogs,
  pluginReviews,
  users,
} from '../../db/schema-pg';
import { eq, and, desc, sql } from 'drizzle-orm';
import { PluginGeneratorAgent } from '../agents/PluginGeneratorAgent';
import { SimpleLogger } from '../utils/SimpleLogger';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();
const logger = new SimpleLogger('UserPluginsAPI');

// Initialize the plugin generator agent
const pluginGeneratorAgent = new PluginGeneratorAgent();

// Tier-based limits
const TIER_LIMITS = {
  free: {
    maxCustomPlugins: 2,
    generationsPerDay: 3,
    executionsPerDay: 100,
    maxPluginComplexity: 'simple' as const,
  },
  pro: {
    maxCustomPlugins: 10,
    generationsPerDay: 20,
    executionsPerDay: 1000,
    maxPluginComplexity: 'medium' as const,
  },
  team: {
    maxCustomPlugins: 50,
    generationsPerDay: 100,
    executionsPerDay: 10000,
    maxPluginComplexity: 'complex' as const,
  },
  enterprise: {
    maxCustomPlugins: -1, // unlimited
    generationsPerDay: -1,
    executionsPerDay: -1,
    maxPluginComplexity: 'complex' as const,
  },
};

// Validation schemas
const generatePluginSchema = z.object({
  prompt: z.string().min(10).max(2000),
  serviceName: z.string().optional(),
  requiredCapabilities: z.array(z.string()).default([]),
  estimatedComplexity: z.enum(['simple', 'medium', 'complex']).optional(),
});

const installPluginSchema = z.object({
  credentials: z.record(z.any()).optional(),
  customConfig: z.record(z.any()).optional(),
});

const testPluginSchema = z.object({
  action: z.string(),
  parameters: z.record(z.any()).default({}),
});

/**
 * POST /api/user-plugins/generate
 * Generate a new custom plugin using AI
 */
router.post('/generate', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = generatePluginSchema.parse(req.body);

    logger.info('Plugin generation request', { userId, serviceName: body.serviceName });

    // Check user tier and quotas
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tierLimits = TIER_LIMITS[user.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    // Check daily generation quota
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysGenerations = await db
      .select({ count: sql<number>`count(*)` })
      .from(pluginGenerationRequests)
      .where(
        and(
          eq(pluginGenerationRequests.userId, userId),
          sql`${pluginGenerationRequests.createdAt} >= ${today}`
        )
      );

    const generationCount = Number(todaysGenerations[0]?.count || 0);

    if (tierLimits.generationsPerDay !== -1 && generationCount >= tierLimits.generationsPerDay) {
      return res.status(429).json({
        error: 'Generation quota exceeded',
        limit: tierLimits.generationsPerDay,
        used: generationCount,
        resetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Check total plugin count
    const userPlugins = await db
      .select({ count: sql<number>`count(*)` })
      .from(userGeneratedPlugins)
      .where(
        and(
          eq(userGeneratedPlugins.userId, userId),
          sql`${userGeneratedPlugins.status} != 'rejected'`
        )
      );

    const pluginCount = Number(userPlugins[0]?.count || 0);

    if (tierLimits.maxCustomPlugins !== -1 && pluginCount >= tierLimits.maxCustomPlugins) {
      return res.status(429).json({
        error: 'Plugin limit exceeded',
        limit: tierLimits.maxCustomPlugins,
        current: pluginCount,
      });
    }

    // Check complexity restriction
    if (body.estimatedComplexity &&
        tierLimits.maxPluginComplexity !== 'complex' &&
        body.estimatedComplexity === 'complex') {
      return res.status(403).json({
        error: 'Complex plugins require Pro tier or higher',
        userTier: user.tier,
        requiredTier: 'pro',
      });
    }

    // Generate the plugin
    const startTime = Date.now();
    const result = await pluginGeneratorAgent.generatePlugin({
      userId,
      prompt: body.prompt,
      serviceName: body.serviceName || '',
      requiredCapabilities: body.requiredCapabilities,
      estimatedComplexity: body.estimatedComplexity,
      userTier: user.tier,
    });

    const generationTime = Date.now() - startTime;

    // Record generation request
    await db.insert(pluginGenerationRequests).values({
      userId,
      prompt: body.prompt,
      serviceName: body.serviceName,
      requestedCapabilities: body.requiredCapabilities,
      tokensUsed: result.estimatedCost,
      generationTimeMs: generationTime,
      modelUsed: 'claude-3-5-sonnet-20241022',
      status: result.status === 'blocked' ? 'blocked' :
              result.status === 'rejected' ? 'rejected' : 'success',
      rejectionReason: result.rejectionReason,
      pluginId: result.pluginId || null,
      userTier: user.tier,
      quotaUsed: generationCount + 1,
      quotaLimit: tierLimits.generationsPerDay,
    });

    // If blocked or rejected, don't create plugin record
    if (result.status === 'blocked' || result.status === 'rejected') {
      return res.status(400).json({
        success: false,
        status: result.status,
        reason: result.rejectionReason,
        securityScore: result.securityScore,
        issues: result.flaggedIssues,
      });
    }

    // Create plugin record
    await db.insert(userGeneratedPlugins).values({
      pluginId: result.pluginId,
      userId,
      name: result.metadata.pluginName,
      description: result.metadata.description,
      serviceName: body.serviceName || 'custom',
      generatedCode: result.generatedCode,
      pluginTemplate: 'base',
      capabilities: result.metadata.capabilities,
      securityScore: result.securityScore,
      securityIssues: result.flaggedIssues,
      sandboxConfig: {
        maxMemoryMB: 128,
        maxCpuSeconds: 5,
        maxNetworkCalls: 10,
        timeout: 30000,
      },
      status: result.status,
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
      resourceLimits: {
        maxMemoryMB: 128,
        maxCpuSeconds: 5,
        maxNetworkCalls: 10,
      },
      requiresAuth: result.metadata.requiresAuth,
      authType: result.metadata.authType,
      authConfig: null,
      credentialsRequired: result.metadata.credentialsRequired,
      version: '1.0.0',
    });

    logger.info('Plugin generated successfully', {
      userId,
      pluginId: result.pluginId,
      status: result.status,
      securityScore: result.securityScore,
    });

    res.json({
      success: true,
      pluginId: result.pluginId,
      status: result.status,
      securityScore: result.securityScore,
      reviewRequired: result.reviewRequired,
      metadata: result.metadata,
      issues: result.flaggedIssues.filter(i => i.severity === 'high' || i.severity === 'critical'),
      generationTime,
      tokensUsed: result.estimatedCost,
    });
  } catch (error) {
    logger.error('Plugin generation failed', error);
    res.status(500).json({
      error: 'Plugin generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/user-plugins/my-plugins
 * Get all user's custom plugins
 */
router.get('/my-plugins', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    let query = db
      .select()
      .from(userGeneratedPlugins)
      .where(eq(userGeneratedPlugins.userId, userId))
      .orderBy(desc(userGeneratedPlugins.createdAt));

    if (status) {
      query = query.where(
        and(
          eq(userGeneratedPlugins.userId, userId),
          eq(userGeneratedPlugins.status, status)
        )
      );
    }

    const plugins = await query;

    // Get installation status for each plugin
    const pluginsWithStatus = await Promise.all(
      plugins.map(async (plugin) => {
        const installation = await db.query.pluginInstallations.findFirst({
          where: and(
            eq(pluginInstallations.pluginId, plugin.pluginId),
            eq(pluginInstallations.userId, userId)
          ),
        });

        return {
          ...plugin,
          installed: !!installation,
          installationStatus: installation?.status,
          lastUsed: installation?.lastUsedAt,
        };
      })
    );

    res.json({
      plugins: pluginsWithStatus,
      total: plugins.length,
    });
  } catch (error) {
    logger.error('Failed to fetch plugins', error);
    res.status(500).json({ error: 'Failed to fetch plugins' });
  }
});

/**
 * GET /api/user-plugins/:pluginId
 * Get specific plugin details
 */
router.get('/:pluginId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pluginId } = req.params;

    const plugin = await db.query.userGeneratedPlugins.findFirst({
      where: and(
        eq(userGeneratedPlugins.pluginId, pluginId),
        eq(userGeneratedPlugins.userId, userId)
      ),
    });

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    // Get installation status
    const installation = await db.query.pluginInstallations.findFirst({
      where: and(
        eq(pluginInstallations.pluginId, pluginId),
        eq(pluginInstallations.userId, userId)
      ),
    });

    // Get recent execution logs
    const recentExecutions = await db
      .select()
      .from(pluginExecutionLogs)
      .where(
        and(
          eq(pluginExecutionLogs.pluginId, pluginId),
          eq(pluginExecutionLogs.userId, userId)
        )
      )
      .orderBy(desc(pluginExecutionLogs.createdAt))
      .limit(10);

    res.json({
      plugin,
      installation,
      recentExecutions,
    });
  } catch (error) {
    logger.error('Failed to fetch plugin details', error);
    res.status(500).json({ error: 'Failed to fetch plugin details' });
  }
});

/**
 * POST /api/user-plugins/:pluginId/install
 * Install a plugin to user's account
 */
router.post('/:pluginId/install', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pluginId } = req.params;
    const body = installPluginSchema.parse(req.body);

    // Check if plugin exists and is approved
    const plugin = await db.query.userGeneratedPlugins.findFirst({
      where: eq(userGeneratedPlugins.pluginId, pluginId),
    });

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    if (plugin.status !== 'approved' && plugin.status !== 'active') {
      return res.status(403).json({
        error: 'Plugin not approved',
        status: plugin.status,
      });
    }

    // Check if already installed
    const existing = await db.query.pluginInstallations.findFirst({
      where: and(
        eq(pluginInstallations.pluginId, pluginId),
        eq(pluginInstallations.userId, userId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Plugin already installed' });
    }

    // Install plugin
    await db.insert(pluginInstallations).values({
      pluginId,
      userId,
      status: 'active',
      credentials: body.credentials || null,
      customConfig: body.customConfig || null,
      useCount: 0,
    });

    // Update plugin install count
    await db
      .update(userGeneratedPlugins)
      .set({
        installCount: sql`${userGeneratedPlugins.installCount} + 1`,
      })
      .where(eq(userGeneratedPlugins.pluginId, pluginId));

    logger.info('Plugin installed', { userId, pluginId });

    res.json({
      success: true,
      message: 'Plugin installed successfully',
    });
  } catch (error) {
    logger.error('Plugin installation failed', error);
    res.status(500).json({ error: 'Plugin installation failed' });
  }
});

/**
 * POST /api/user-plugins/:pluginId/uninstall
 * Uninstall a plugin from user's account
 */
router.post('/:pluginId/uninstall', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pluginId } = req.params;

    const installation = await db.query.pluginInstallations.findFirst({
      where: and(
        eq(pluginInstallations.pluginId, pluginId),
        eq(pluginInstallations.userId, userId)
      ),
    });

    if (!installation) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    // Update status to uninstalled
    await db
      .update(pluginInstallations)
      .set({
        status: 'uninstalled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pluginInstallations.pluginId, pluginId),
          eq(pluginInstallations.userId, userId)
        )
      );

    logger.info('Plugin uninstalled', { userId, pluginId });

    res.json({
      success: true,
      message: 'Plugin uninstalled successfully',
    });
  } catch (error) {
    logger.error('Plugin uninstall failed', error);
    res.status(500).json({ error: 'Plugin uninstall failed' });
  }
});

/**
 * DELETE /api/user-plugins/:pluginId
 * Delete a plugin (only owner can delete)
 */
router.delete('/:pluginId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pluginId } = req.params;

    const plugin = await db.query.userGeneratedPlugins.findFirst({
      where: and(
        eq(userGeneratedPlugins.pluginId, pluginId),
        eq(userGeneratedPlugins.userId, userId)
      ),
    });

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    // Delete plugin (cascade will handle related records)
    await db
      .delete(userGeneratedPlugins)
      .where(eq(userGeneratedPlugins.pluginId, pluginId));

    logger.info('Plugin deleted', { userId, pluginId });

    res.json({
      success: true,
      message: 'Plugin deleted successfully',
    });
  } catch (error) {
    logger.error('Plugin deletion failed', error);
    res.status(500).json({ error: 'Plugin deletion failed' });
  }
});

/**
 * GET /api/user-plugins/marketplace
 * Browse public marketplace plugins
 */
router.get('/marketplace/browse', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const plugins = await db
      .select()
      .from(userGeneratedPlugins)
      .where(
        and(
          eq(userGeneratedPlugins.isPublic, true),
          eq(userGeneratedPlugins.marketplaceApproved, true),
          eq(userGeneratedPlugins.status, 'approved')
        )
      )
      .orderBy(desc(userGeneratedPlugins.installCount))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(userGeneratedPlugins)
      .where(
        and(
          eq(userGeneratedPlugins.isPublic, true),
          eq(userGeneratedPlugins.marketplaceApproved, true)
        )
      );

    res.json({
      plugins,
      pagination: {
        page,
        limit,
        total: Number(total[0]?.count || 0),
        pages: Math.ceil(Number(total[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch marketplace plugins', error);
    res.status(500).json({ error: 'Failed to fetch marketplace plugins' });
  }
});

/**
 * GET /api/user-plugins/stats
 * Get user's plugin statistics
 */
router.get('/stats/overview', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [totalPlugins, activePlugins, totalExecutions, todaysGenerations] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(userGeneratedPlugins)
        .where(eq(userGeneratedPlugins.userId, userId)),

      db.select({ count: sql<number>`count(*)` })
        .from(userGeneratedPlugins)
        .where(
          and(
            eq(userGeneratedPlugins.userId, userId),
            eq(userGeneratedPlugins.status, 'active')
          )
        ),

      db.select({ count: sql<number>`count(*)` })
        .from(pluginExecutionLogs)
        .where(eq(pluginExecutionLogs.userId, userId)),

      db.select({ count: sql<number>`count(*)` })
        .from(pluginGenerationRequests)
        .where(
          and(
            eq(pluginGenerationRequests.userId, userId),
            sql`DATE(${pluginGenerationRequests.createdAt}) = CURRENT_DATE`
          )
        ),
    ]);

    // Get user tier limits
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const tierLimits = TIER_LIMITS[user?.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    res.json({
      totalPlugins: Number(totalPlugins[0]?.count || 0),
      activePlugins: Number(activePlugins[0]?.count || 0),
      totalExecutions: Number(totalExecutions[0]?.count || 0),
      todaysGenerations: Number(todaysGenerations[0]?.count || 0),
      limits: tierLimits,
    });
  } catch (error) {
    logger.error('Failed to fetch stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
