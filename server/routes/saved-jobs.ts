import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { savedJobsService } from '../services/SavedJobsService';

const router = Router();

/**
 * GET /api/saved-jobs
 * Get all saved jobs for the authenticated user
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const jobs = await savedJobsService.getSavedJobs(userId);

    res.json({
      success: true,
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/saved-jobs
 * Save a job
 */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const {
      jobTitle,
      company,
      location,
      jobUrl,
      jobId,
      jobDescription,
      matchPercentage,
      matchedSkills,
      notes,
    } = req.body;

    if (!jobTitle) {
      return res.status(400).json({
        success: false,
        error: 'Job title is required',
      });
    }

    const saved = await savedJobsService.saveJob(userId, {
      jobTitle,
      company,
      location,
      jobUrl,
      jobId,
      jobDescription,
      matchPercentage,
      matchedSkills,
      notes,
    });

    res.json({
      success: true,
      job: saved,
    });
  } catch (error) {
    console.error('Error saving job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/saved-jobs/check/:jobId
 * Check if a job is saved
 */
router.get('/check/:jobId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { jobId } = req.params;

    const isSaved = await savedJobsService.isJobSaved(userId, jobId);

    res.json({
      success: true,
      isSaved,
    });
  } catch (error) {
    console.error('Error checking if job is saved:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check if job is saved',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/saved-jobs/:jobId
 * Remove a saved job
 */
router.delete('/:jobId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { jobId } = req.params;

    const removed = await savedJobsService.removeSavedJob(userId, jobId);

    res.json({
      success: removed,
      message: removed ? 'Job removed from saved jobs' : 'Job not found',
    });
  } catch (error) {
    console.error('Error removing saved job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove saved job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/saved-jobs/:jobId/notes
 * Update notes for a saved job
 */
router.patch('/:jobId/notes', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { jobId } = req.params;
    const { notes } = req.body;

    const updated = await savedJobsService.updateJobNotes(userId, jobId, notes || '');

    res.json({
      success: true,
      job: updated,
    });
  } catch (error) {
    console.error('Error updating job notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job notes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

