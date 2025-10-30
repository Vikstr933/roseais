import { db } from '../../db';
import { chatMessages } from '../../db/schema-pg';
import { lt, sql } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';

/**
 * Service to automatically clean up old chat messages
 * Deletes messages older than 24 hours
 */
export class ChatCleanupService {
  private logger: SimpleLogger;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
  private readonly MESSAGE_RETENTION_HOURS = 24;

  constructor() {
    this.logger = new SimpleLogger('ChatCleanupService');
  }

  /**
   * Start the automatic cleanup service
   */
  start() {
    if (this.cleanupInterval) {
      this.logger.warning('Cleanup service already running');
      return;
    }

    this.logger.info('Starting chat message cleanup service', {
      retentionHours: this.MESSAGE_RETENTION_HOURS,
      intervalMs: this.CLEANUP_INTERVAL_MS,
    });

    // Run immediately on start
    this.cleanup().catch(error => {
      this.logger.error('Initial cleanup failed', error);
    });

    // Then run on interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Scheduled cleanup failed', error);
      });
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the automatic cleanup service
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Chat message cleanup service stopped');
    }
  }

  /**
   * Run cleanup of old chat messages
   * Deletes messages older than 24 hours
   */
  async cleanup(): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.MESSAGE_RETENTION_HOURS);

      this.logger.info('Running chat message cleanup', {
        cutoffDate: cutoffDate.toISOString(),
      });

      // Delete messages older than the cutoff date
      const result = await db
        .delete(chatMessages)
        .where(lt(chatMessages.createdAt, cutoffDate))
        .returning({ id: chatMessages.id });

      const deletedCount = result.length;

      this.logger.info('Chat message cleanup completed', {
        deletedMessages: deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      });

      return { deleted: deletedCount };
    } catch (error) {
      this.logger.error('Chat message cleanup failed', error as Error);
      throw error;
    }
  }

  /**
   * Clean up orphaned chat messages
   * Removes messages that reference non-existent workspaces
   */
  async cleanupOrphaned(): Promise<{ deleted: number }> {
    try {
      this.logger.info('Running orphaned chat message cleanup');

      // Delete chat messages where the referenced workspace doesn't exist
      const result = await db.execute(sql`
        DELETE FROM chat_messages
        WHERE project_id NOT IN (SELECT id FROM workspaces)
        RETURNING id
      `);

      const deletedCount = result.rowCount || 0;

      this.logger.info('Orphaned chat message cleanup completed', {
        deletedMessages: deletedCount,
      });

      return { deleted: deletedCount };
    } catch (error) {
      this.logger.error('Orphaned chat message cleanup failed', error as Error);
      throw error;
    }
  }

  /**
   * Get statistics about chat messages
   */
  async getStats(): Promise<{
    totalMessages: number;
    messagesOlderThan24h: number;
    orphanedMessages: number;
  }> {
    try {
      // Count total messages
      const totalResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM chat_messages
      `);
      const totalMessages = Number(totalResult.rows[0]?.count || 0);

      // Count messages older than 24 hours
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.MESSAGE_RETENTION_HOURS);

      const oldResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM chat_messages
        WHERE created_at < ${cutoffDate.toISOString()}
      `);
      const messagesOlderThan24h = Number(oldResult.rows[0]?.count || 0);

      // Count orphaned messages
      const orphanedResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM chat_messages
        WHERE project_id NOT IN (SELECT id FROM workspaces)
      `);
      const orphanedMessages = Number(orphanedResult.rows[0]?.count || 0);

      return {
        totalMessages,
        messagesOlderThan24h,
        orphanedMessages,
      };
    } catch (error) {
      this.logger.error('Failed to get chat statistics', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const chatCleanupService = new ChatCleanupService();
