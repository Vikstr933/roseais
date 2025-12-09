import { Router } from 'express';
import { userActivityService } from '../services/UserActivityService';
import { generationLockService } from '../services/GenerationLockService';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { db } from '../../db';
import { projectMembers } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const router = Router();

// GET /api/activity/project/:id - Get project activity status
router.get('/project/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Skip project access check for now (temporarily)
    // TODO: Re-enable proper authentication once user system is working

    const activityStatus =
      await userActivityService.getProjectActivityStatus(projectId);
    res.json(activityStatus);
  } catch (error) {
    console.error('Error fetching project activity:', error);
    res.status(500).json({ error: 'Failed to fetch project activity' });
  }
});

// POST /api/activity/track - Track user activity
router.post('/track', optionalAuth, async (req, res) => {
  try {
    const { projectId, activityType, lockType, metadata } = req.body;
    const userId = req.user?.id;

    if (!projectId || !activityType) {
      return res.status(400).json({
        error: 'Project ID and activity type are required',
      });
    }

    // Skip project access check for now (temporarily)
    // TODO: Re-enable proper authentication once user system is working

    const activity = await userActivityService.trackUserActivity(
      projectId,
      userId || 'anonymous',
      activityType,
      lockType,
      metadata
    );

    res.json({ success: true, activity });
  } catch (error) {
    console.error('Error tracking user activity:', error);
    res.status(500).json({ error: 'Failed to track user activity' });
  }
});

// POST /api/activity/update - Update user last seen
router.post('/update', optionalAuth, async (req, res) => {
  try {
    const { projectId, activityType } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!projectId || !activityType) {
      return res.status(400).json({
        error: 'Project ID and activity type are required',
      });
    }

    userActivityService.updateUserLastSeen(projectId, userId, activityType);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user activity:', error);
    res.status(500).json({ error: 'Failed to update user activity' });
  }
});

// DELETE /api/activity/remove - Remove user activity
router.delete('/remove', optionalAuth, async (req, res) => {
  try {
    const { projectId, activityType } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!projectId || !activityType) {
      return res.status(400).json({
        error: 'Project ID and activity type are required',
      });
    }

    userActivityService.removeUserActivity(projectId, userId, activityType);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing user activity:', error);
    res.status(500).json({ error: 'Failed to remove user activity' });
  }
});

// GET /api/activity/user/:userId - Get user activity summary
router.get('/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    // Users can only see their own activity or if they're in the same projects
    if (userId !== currentUserId) {
      // Check if users share any projects
      const sharedProjects = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.userId, currentUserId),
            eq(projectMembers.isActive, 1)
          )
        );

      const targetUserProjects = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(
          and(eq(projectMembers.userId, userId), eq(projectMembers.isActive, 1))
        );

      const sharedProjectIds = sharedProjects
        .map(p => p.projectId)
        .filter(id => targetUserProjects.some(tp => tp.projectId === id));

      if (sharedProjectIds.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const summary = userActivityService.getUserActivitySummary(userId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    res.status(500).json({ error: 'Failed to fetch user activity summary' });
  }
});

// GET /api/activity/locks/:projectId - Get generation locks for a project
router.get('/locks/:projectId', optionalAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const userId = req.user?.id;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user has access to project (if authenticated)
    if (userId) {
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
            eq(projectMembers.isActive, 1)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(403).json({ error: 'Access denied to project' });
      }
    }

    const locks = await generationLockService.getProjectLocks(projectId);
    res.json(locks);
  } catch (error) {
    console.error('Error fetching generation locks:', error);
    res.status(500).json({ error: 'Failed to fetch generation locks' });
  }
});

export default router;
