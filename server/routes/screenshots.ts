/**
 * Screenshot Routes
 * 
 * API endpoints for capturing and managing project screenshots
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { screenshotService } from '../services/ScreenshotService';
import { db } from '../../db';
import { workspaces } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/screenshots/:projectId/capture
 * Capture screenshot for a project
 */
router.post('/:projectId/capture', authenticateUser, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { force, url } = req.body;

    // Verify user owns the project
    const project = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, projectId))
      .limit(1);

    if (!project[0]) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (project[0].ownerId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to capture screenshots for this project',
      });
    }

    // Use provided URL or project's vercelUrl
    const screenshotUrl = url || project[0].vercelUrl;
    
    if (!screenshotUrl) {
      return res.status(400).json({
        success: false,
        error: 'No deployment URL found. Please deploy your project first.',
      });
    }

    const result = await screenshotService.captureScreenshot(
      projectId,
      screenshotUrl,
      { force: force === true, thumbnail: true }
    );

    res.json({
      success: true,
      screenshotUrl: result.screenshotUrl,
      thumbnailUrl: result.thumbnailUrl,
    });
  } catch (error: any) {
    console.error('Failed to capture screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture screenshot',
      message: error.message,
    });
  }
});

/**
 * POST /api/screenshots/:projectId/auto-capture
 * Automatically capture screenshot using project's deployment URL
 */
router.post('/:projectId/auto-capture', authenticateUser, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { force } = req.body;

    // Verify user owns the project
    const project = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, projectId))
      .limit(1);

    if (!project[0]) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (project[0].ownerId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to capture screenshots for this project',
      });
    }

    const result = await screenshotService.captureProjectScreenshot(
      projectId,
      force === true
    );

    if (!result.screenshotUrl) {
      return res.status(400).json({
        success: false,
        error: 'No deployment URL found. Please deploy your project first.',
      });
    }

    res.json({
      success: true,
      screenshotUrl: result.screenshotUrl,
      thumbnailUrl: result.thumbnailUrl,
    });
  } catch (error: any) {
    console.error('Failed to auto-capture screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture screenshot',
      message: error.message,
    });
  }
});

export default router;

