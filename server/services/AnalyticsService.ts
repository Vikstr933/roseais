import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { workspaces, projectFiles, eventLogs } from '../../db/schema-pg';
import { eq, and, gte, count, sql } from 'drizzle-orm';

const logger = new SimpleLogger('AnalyticsService');

export interface UsageStats {
  projects: {
    total: number;
    active: number;
    files: number;
  };
  deployments: {
    total: number;
    recent: number;
  };
  activity: {
    codeGenerations: number;
    fileEdits: number;
    testRuns: number;
  };
  period: 'day' | 'week' | 'month' | 'all';
}

export class AnalyticsService {
  /**
   * Get usage statistics for a user
   */
  async getUsageStats(
    userId: string,
    projectId?: number,
    period: 'day' | 'week' | 'month' | 'all' = 'all'
  ): Promise<UsageStats> {
    try {
      // Calculate date threshold
      let dateThreshold: Date | undefined;
      if (period === 'day') {
        dateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      } else if (period === 'week') {
        dateThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get project stats
      const projectConditions = [eq(workspaces.ownerId, userId)];
      if (projectId) {
        projectConditions.push(eq(workspaces.id, projectId));
      }

      const [projectStats] = await db
        .select({
          total: count(),
          active: sql<number>`COUNT(CASE WHEN ${workspaces.lastActivity} >= ${dateThreshold || new Date(0)} THEN 1 END)`
        })
        .from(workspaces)
        .where(and(...projectConditions));

      // Get file count
      const fileConditions = projectId 
        ? [eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, true)]
        : [
            sql`${projectFiles.projectId} IN (SELECT id FROM ${workspaces} WHERE owner_id = ${userId})`,
            eq(projectFiles.isActive, true)
          ];

      const [fileStats] = await db
        .select({ count: count() })
        .from(projectFiles)
        .where(and(...fileConditions));

      // Get activity stats from event logs
      const activityConditions = [eq(eventLogs.userId, userId)];
      if (dateThreshold) {
        activityConditions.push(gte(eventLogs.createdAt, dateThreshold));
      }

      const activities = await db
        .select()
        .from(eventLogs)
        .where(and(...activityConditions));

      const codeGenerations = activities.filter(a => a.eventType === 'code_generation').length;
      const fileEdits = activities.filter(a => a.eventType === 'file_edit' || a.eventType === 'file_modified').length;
      const testRuns = activities.filter(a => a.eventType === 'test_run').length;

      // Get deployment stats (from workspaces with vercelUrl)
      const deploymentConditions = [eq(workspaces.ownerId, userId)];
      if (projectId) {
        deploymentConditions.push(eq(workspaces.id, projectId));
      }

      const deployments = await db
        .select()
        .from(workspaces)
        .where(and(...deploymentConditions));

      const totalDeployments = deployments.filter(w => w.vercelUrl).length;
      const recentDeployments = dateThreshold
        ? deployments.filter(w => w.vercelUrl && w.lastActivity && w.lastActivity >= dateThreshold).length
        : totalDeployments;

      return {
        projects: {
          total: projectStats?.total || 0,
          active: projectStats?.active || 0,
          files: fileStats?.count || 0
        },
        deployments: {
          total: totalDeployments,
          recent: recentDeployments
        },
        activity: {
          codeGenerations,
          fileEdits,
          testRuns
        },
        period
      };
    } catch (error) {
      logger.error('Error getting usage stats', error as Error);
      return {
        projects: { total: 0, active: 0, files: 0 },
        deployments: { total: 0, recent: 0 },
        activity: { codeGenerations: 0, fileEdits: 0, testRuns: 0 },
        period
      };
    }
  }
}

export const analyticsService = new AnalyticsService();

