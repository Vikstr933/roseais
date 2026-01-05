import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { autoApplyService } from '../services/AutoApplyService';
import type { AutoApplySettings, AutoApplyCriteria } from '../services/AutoApplyService';

const router = Router();

/**
 * GET /api/auto-apply/settings
 * Get auto-apply settings for user
 */
router.get('/settings', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    
    // TODO: Store settings in database
    // For now, return default settings
    res.json({
      success: true,
      settings: {
        enabled: false,
        criteria: {
          minMatchPercentage: 80,
        },
        requireConfirmation: true,
      },
    });
  } catch (error) {
    console.error('Error fetching auto-apply settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auto-apply settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-apply/settings
 * Update auto-apply settings
 */
router.post('/settings', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const settings: AutoApplySettings = req.body;

    // TODO: Save settings to database
    // For now, just validate and return

    res.json({
      success: true,
      message: 'Auto-apply settings saved',
      settings,
    });
  } catch (error) {
    console.error('Error saving auto-apply settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save auto-apply settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-apply/find-jobs
 * Find matching jobs based on criteria
 */
router.post('/find-jobs', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { resumeId, criteria } = req.body;

    if (!resumeId) {
      return res.status(400).json({
        success: false,
        error: 'Resume ID is required',
      });
    }

    const matches = await autoApplyService.findMatchingJobs(
      userId,
      resumeId,
      criteria || { minMatchPercentage: 80 }
    );

    res.json({
      success: true,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Error finding matching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find matching jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-apply/apply
 * Apply to a job automatically
 */
router.post('/apply', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { resumeId, job, coverLetter } = req.body;

    if (!resumeId || !job) {
      return res.status(400).json({
        success: false,
        error: 'Resume ID and job are required',
      });
    }

    // Check application limits
    const limits = await autoApplyService.checkApplicationLimits(userId, 10, 50);
    if (!limits.canApply) {
      return res.status(429).json({
        success: false,
        error: limits.reason,
      });
    }

    const application = await autoApplyService.applyToJob(
      userId,
      resumeId,
      job,
      coverLetter
    );

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error applying to job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply to job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-apply/generate-cover-letter
 * Generate cover letter for a job
 */
router.post('/generate-cover-letter', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resumeId, job, template } = req.body;

    if (!resumeId || !job) {
      return res.status(400).json({
        success: false,
        error: 'Resume ID and job are required',
      });
    }

    const coverLetter = await autoApplyService.generateCoverLetter(
      resumeId,
      job,
      template
    );

    res.json({
      success: true,
      coverLetter,
    });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cover letter',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

