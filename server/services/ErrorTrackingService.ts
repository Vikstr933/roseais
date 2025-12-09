import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { eventLogs } from '../../db/schema-pg';
import { eq, and, desc, gte } from 'drizzle-orm';

const logger = new SimpleLogger('ErrorTrackingService');

export interface TrackedError {
  id: number;
  error: string;
  file?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectId?: number;
  userId: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
}

export interface ErrorStats {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byProject: Record<string, number>;
  recent: TrackedError[];
}

export class ErrorTrackingService {
  /**
   * Track an error
   */
  async trackError(
    userId: string,
    error: string,
    options?: {
      file?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      projectId?: number;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db.insert(eventLogs).values({
        userId,
        eventType: 'error',
        eventData: JSON.stringify({
          error,
          file: options?.file,
          severity: options?.severity || 'medium',
          projectId: options?.projectId
        }),
        createdAt: new Date()
      });

      logger.info(`Tracked error for user ${userId}: ${error.substring(0, 100)}`);

      return {
        success: true,
        message: 'Error tracked successfully'
      };
    } catch (error) {
      logger.error('Error tracking error', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(
    userId: string,
    projectId?: number,
    period: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<ErrorStats> {
    try {
      const conditions = [
        eq(eventLogs.userId, userId),
        eq(eventLogs.eventType, 'error')
      ];

      if (projectId) {
        // Filter by projectId in eventData
        // This is a simplified approach - in production, you might want a dedicated errors table
      }

      // Calculate date threshold
      let dateThreshold: Date | undefined;
      if (period === 'day') {
        dateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      } else if (period === 'week') {
        dateThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      if (dateThreshold) {
        conditions.push(gte(eventLogs.createdAt, dateThreshold));
      }

      const errors = await db
        .select()
        .from(eventLogs)
        .where(and(...conditions))
        .orderBy(desc(eventLogs.createdAt))
        .limit(100);

      const bySeverity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };

      const byProject: Record<string, number> = {};
      const recent: TrackedError[] = [];

      for (const error of errors) {
        const eventData = typeof error.eventData === 'string'
          ? JSON.parse(error.eventData)
          : error.eventData;

        const severity = eventData?.severity || 'medium';
        bySeverity[severity as keyof typeof bySeverity]++;

        if (eventData?.projectId) {
          byProject[eventData.projectId] = (byProject[eventData.projectId] || 0) + 1;
        }

        recent.push({
          id: error.id,
          error: eventData?.error || 'Unknown error',
          file: eventData?.file,
          severity: severity as 'low' | 'medium' | 'high' | 'critical',
          projectId: eventData?.projectId,
          userId: error.userId,
          count: 1,
          firstSeen: error.createdAt || new Date(),
          lastSeen: error.createdAt || new Date(),
          resolved: false
        });
      }

      return {
        total: errors.length,
        bySeverity,
        byProject,
        recent: recent.slice(0, 20)
      };
    } catch (error) {
      logger.error('Error getting error stats', error as Error);
      return {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byProject: {},
        recent: []
      };
    }
  }
}

export const errorTrackingService = new ErrorTrackingService();

