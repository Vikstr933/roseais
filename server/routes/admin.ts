import { Router } from 'express';
import { db } from '../../db';
import { chatMessages, codeGenerationSessions, workspaces } from '../../db/schema-pg';
import { sql } from 'drizzle-orm';
import { chatCleanupService } from '../services/ChatCleanupService';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('AdminRoutes');

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

export default router;
