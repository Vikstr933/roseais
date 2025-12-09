import { Router } from 'express';
import { db } from '../../db';
import { workspaces, users, projectFiles, projectRemixes, projectVotes, projectViews } from '../../db/schema-pg';
import { sql, eq, and, desc, count, or, ilike, inArray } from 'drizzle-orm';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { screenshotService } from '../services/ScreenshotService';

const router = Router();

/**
 * Convert relative screenshot URLs to absolute URLs
 * This ensures screenshots work when frontend is on different domain
 */
function ensureAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // If already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Convert relative URL to absolute
  const backendUrl = process.env.BACKEND_URL || 
                    process.env.RENDER_EXTERNAL_URL || 
                    'https://ai-library-backend.onrender.com';
  
  // Ensure URL starts with /
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${backendUrl}${path}`;
}

/**
 * GET /api/public-projects
 * Get all public projects with filtering and sorting
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      featured, 
      category, 
      sort = 'popular', // popular, recent, votes, remixes
      limit = 20,
      offset = 0,
      search 
    } = req.query;

    // Build where conditions
    const whereConditions = [
      eq(workspaces.isPublic, true),
      eq(workspaces.projectStatus, 'active'),
    ];
    
    if (featured === 'true') {
      whereConditions.push(eq(workspaces.featured, true));
    }
    if (category) {
      whereConditions.push(eq(workspaces.projectType, category as string));
    }
    if (search) {
      whereConditions.push(ilike(workspaces.name, `%${search}%`));
    }

    // Build order by
    let orderByClause;
    switch (sort) {
      case 'recent':
        orderByClause = desc(workspaces.createdAt);
        break;
      case 'votes':
        orderByClause = desc(workspaces.voteCount);
        break;
      case 'remixes':
        orderByClause = desc(workspaces.remixCount);
        break;
      case 'popular':
      default:
        // Popular = combination of votes, remixes, and views
        orderByClause = desc(sql`(${workspaces.voteCount} * 3 + ${workspaces.remixCount} * 2 + ${workspaces.viewCount})`);
        break;
    }

    const projects = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        projectType: workspaces.projectType,
        screenshotUrl: workspaces.screenshotUrl,
        thumbnailUrl: workspaces.thumbnailUrl,
        remixCount: workspaces.remixCount,
        voteCount: workspaces.voteCount,
        viewCount: workspaces.viewCount,
        featured: workspaces.featured,
        tags: workspaces.tags,
        createdAt: workspaces.createdAt,
        ownerId: workspaces.ownerId,
        ownerName: sql<string>`(SELECT display_name FROM users WHERE id = ${workspaces.ownerId})`,
        fileCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${projectFiles} 
          WHERE ${projectFiles.projectId} = ${workspaces.id} 
          AND ${projectFiles.isActive} = true
        )`,
      })
      .from(workspaces)
      .where(and(...whereConditions))
      .orderBy(orderByClause)
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.isPublic, true),
          eq(workspaces.projectStatus, 'active'),
          featured === 'true' ? eq(workspaces.featured, true) : undefined,
          category ? eq(workspaces.projectType, category as string) : undefined,
          search ? ilike(workspaces.name, `%${search}%`) : undefined
        )
      );

    // Convert screenshot URLs to absolute URLs
    const projectsWithAbsoluteUrls = projects.map(project => ({
      ...project,
      screenshotUrl: ensureAbsoluteUrl(project.screenshotUrl),
      thumbnailUrl: ensureAbsoluteUrl(project.thumbnailUrl),
    }));

    res.json({
      success: true,
      projects: projectsWithAbsoluteUrls,
      total: totalResult[0]?.count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error('Error fetching public projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public projects',
      message: error.message,
    });
  }
});

/**
 * GET /api/public-projects/:id
 * Get a single public project with details
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    const project = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        projectType: workspaces.projectType,
        screenshotUrl: workspaces.screenshotUrl,
        thumbnailUrl: workspaces.thumbnailUrl,
        remixCount: workspaces.remixCount,
        voteCount: workspaces.voteCount,
        viewCount: workspaces.viewCount,
        featured: workspaces.featured,
        tags: workspaces.tags,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        ownerId: workspaces.ownerId,
        ownerName: sql<string>`(SELECT display_name FROM users WHERE id = ${workspaces.ownerId})`,
        ownerAvatar: sql<string | null>`NULL`, // Avatar not currently stored in users table
        fileCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${projectFiles} 
          WHERE ${projectFiles.projectId} = ${workspaces.id} 
          AND ${projectFiles.isActive} = true
        )`,
      })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, projectId),
          eq(workspaces.isPublic, true)
        )
      )
      .limit(1);

    if (!project[0]) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or not public',
      });
    }

    // Track view (optional auth)
    const userId = req.user?.id || null;

    await db.insert(projectViews).values({
      projectId,
      userId: userId || null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get('user-agent') || null,
    });

    // Update view count
    await db
      .update(workspaces)
      .set({ viewCount: sql`${workspaces.viewCount} + 1` })
      .where(eq(workspaces.id, projectId));

    // Convert screenshot URLs to absolute URLs
    const projectWithAbsoluteUrls = {
      ...project[0],
      screenshotUrl: ensureAbsoluteUrl(project[0].screenshotUrl),
      thumbnailUrl: ensureAbsoluteUrl(project[0].thumbnailUrl),
    };

    res.json({
      success: true,
      project: projectWithAbsoluteUrls,
    });
  } catch (error: any) {
    console.error('Error fetching public project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
      message: error.message,
    });
  }
});

/**
 * POST /api/public-projects/:id/remix
 * Create a remix of a public project
 */
router.post('/:id/remix', authenticateUser, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get original project
    const original = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, projectId),
          eq(workspaces.isPublic, true)
        )
      )
      .limit(1);

    if (!original[0]) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or not public',
      });
    }

    // Create new project as remix
    const [newProject] = await db
      .insert(workspaces)
      .values({
        name: `${original[0].name} (Remix)`,
        description: original[0].description,
        projectType: original[0].projectType,
        ownerId: userId,
        status: 'active', // Explicitly set status
        isPublic: false, // Remixes start as private
        projectStatus: 'active',
      })
      .returning();
    
    console.log(`[Remix] Created project ${newProject.id} for user ${userId}, ownerId: ${newProject.ownerId}`);

    // Copy files from original
    const originalFiles = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.isActive, true)
        )
      );

    console.log(`[Remix] Found ${originalFiles.length} files to copy from project ${projectId} to project ${newProject.id}`);

    if (originalFiles.length > 0) {
      const copiedFiles = await db.insert(projectFiles).values(
        originalFiles.map(file => ({
          projectId: newProject.id,
          filePath: file.filePath,
          fileContent: file.fileContent,
          isActive: true,
        }))
      ).returning();
      
      console.log(`[Remix] Successfully copied ${copiedFiles.length} files to project ${newProject.id}`);
    } else {
      console.warn(`[Remix] No files found to copy from project ${projectId}`);
    }

    // Record remix relationship
    await db.insert(projectRemixes).values({
      originalProjectId: projectId,
      remixedProjectId: newProject.id,
      remixedBy: userId,
    });

    // Verify files were copied
    const copiedFilesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, newProject.id),
          eq(projectFiles.isActive, true)
        )
      );

    const fileCount = copiedFilesCount[0]?.count || 0;
    console.log(`[Remix] Verification: Project ${newProject.id} now has ${fileCount} files`);

    res.json({
      success: true,
      project: {
        ...newProject,
        fileCount, // Include file count in response
      },
      message: 'Project remixed successfully',
      filesCopied: fileCount,
    });
  } catch (error: any) {
    console.error('Error remixing project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remix project',
      message: error.message,
    });
  }
});

/**
 * POST /api/public-projects/:id/vote
 * Vote for a public project
 */
router.post('/:id/vote', authenticateUser, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check if project exists and is public
    const project = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, projectId),
          eq(workspaces.isPublic, true)
        )
      )
      .limit(1);

    if (!project[0]) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or not public',
      });
    }

    // Check if already voted
    const existingVote = await db
      .select()
      .from(projectVotes)
      .where(
        and(
          eq(projectVotes.projectId, projectId),
          eq(projectVotes.userId, userId)
        )
      )
      .limit(1);

    if (existingVote.length > 0) {
      // Remove vote
      await db
        .delete(projectVotes)
        .where(
          and(
            eq(projectVotes.projectId, projectId),
            eq(projectVotes.userId, userId)
          )
        );

      return res.json({
        success: true,
        voted: false,
        message: 'Vote removed',
      });
    }

    // Add vote
    await db.insert(projectVotes).values({
      projectId,
      userId,
    });

    res.json({
      success: true,
      voted: true,
      message: 'Vote added',
    });
  } catch (error: any) {
    console.error('Error voting for project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to vote',
      message: error.message,
    });
  }
});

/**
 * GET /api/public-projects/:id/vote-status
 * Check if current user has voted
 */
router.get('/:id/vote-status', optionalAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.json({
        success: true,
        voted: false,
      });
    }

    const vote = await db
      .select()
      .from(projectVotes)
      .where(
        and(
          eq(projectVotes.projectId, projectId),
          eq(projectVotes.userId, userId)
        )
      )
      .limit(1);

    res.json({
      success: true,
      voted: vote.length > 0,
    });
  } catch (error: any) {
    console.error('Error checking vote status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check vote status',
      message: error.message,
    });
  }
});

export default router;

