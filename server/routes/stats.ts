import { Router } from 'express';
import { db } from '../../db';
import { workspaces, users, projectFiles } from '../../db/schema-pg';
import { sql, count } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/stats/platform
 * Returns platform-wide statistics for homepage
 */
router.get('/platform', async (req, res) => {
  try {
    // Get total users
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get total projects
    const totalProjectsResult = await db.select({ count: count() }).from(workspaces);
    const totalProjects = totalProjectsResult[0]?.count || 0;

    // Get total files generated
    const totalFilesResult = await db.select({ count: count() }).from(projectFiles);
    const totalFiles = totalFilesResult[0]?.count || 0;

    // Get active projects (projects with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeProjectsResult = await db
      .select({ count: count() })
      .from(workspaces)
      .where(sql`${workspaces.lastActivity} > ${thirtyDaysAgo}`);
    const activeProjects = activeProjectsResult[0]?.count || 0;

    // Get recent projects with files (for showcase)
    const recentProjects = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        projectType: workspaces.projectType,
        createdAt: workspaces.createdAt,
        fileCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${projectFiles} 
          WHERE ${projectFiles.projectId} = ${workspaces.id} 
          AND ${projectFiles.isActive} = true
        )`,
      })
      .from(workspaces)
      .where(sql`${workspaces.projectStatus} = 'active'`)
      .orderBy(sql`${workspaces.createdAt} DESC`)
      .limit(12);

    // Filter projects that have files
    const projectsWithFiles = recentProjects.filter(p => p.fileCount > 0);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProjects,
        totalFiles,
        activeProjects,
        projectsCreatedToday: 0, // TODO: Add query for today's projects
      },
      showcaseProjects: projectsWithFiles.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.projectType || 'web_app',
        fileCount: p.fileCount,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform statistics',
      message: error.message,
    });
  }
});

export default router;

