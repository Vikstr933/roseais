import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { jobApplicationService } from '../services/JobApplicationService';
import type { ApplicationStatus, ApplicationMethod } from '../services/JobApplicationService';

const router = Router();

/**
 * GET /api/job-applications
 * Get all job applications for the authenticated user
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { status, limit, offset, search } = req.query;

    const applications = await jobApplicationService.getUserApplications(userId, {
      status: status as ApplicationStatus | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      search: search as string | undefined,
    });

    res.json({
      success: true,
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job applications',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/job-applications/stats
 * Get statistics for user's job applications
 */
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;

    const stats = await jobApplicationService.getApplicationStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching application stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/job-applications/:id
 * Get a single job application by ID
 */
router.get('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const applicationId = parseInt(req.params.id);

    if (isNaN(applicationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid application ID',
      });
    }

    const application = await jobApplicationService.getApplication(applicationId, userId);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error fetching job application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job application',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/job-applications
 * Create a new job application
 */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const {
      resumeId,
      jobTitle,
      companyName,
      location,
      applicationMethod,
      jobUrl,
      recruiterEmail,
      notes,
      jobId,
    } = req.body;

    if (!jobTitle) {
      return res.status(400).json({
        success: false,
        error: 'Job title is required',
      });
    }

    const application = await jobApplicationService.createApplication({
      userId,
      resumeId,
      jobTitle,
      companyName,
      location,
      applicationMethod: applicationMethod as ApplicationMethod | undefined,
      jobUrl,
      recruiterEmail,
      notes,
      jobId,
    });

    res.status(201).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error creating job application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job application',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/job-applications/:id
 * Update a job application
 */
router.patch('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const applicationId = parseInt(req.params.id);
    const {
      status,
      notes,
      recruiterEmail,
      emailSent,
      emailOpened,
      emailReplied,
      interviewScheduled,
      interviewDate,
    } = req.body;

    if (isNaN(applicationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid application ID',
      });
    }

    const application = await jobApplicationService.updateApplication(applicationId, userId, {
      status: status as ApplicationStatus | undefined,
      notes,
      recruiterEmail,
      emailSent,
      emailOpened,
      emailReplied,
      interviewScheduled,
      interviewDate: interviewDate ? new Date(interviewDate) : undefined,
    });

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error updating job application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job application',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/job-applications/:id
 * Delete a job application
 */
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const applicationId = parseInt(req.params.id);

    if (isNaN(applicationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid application ID',
      });
    }

    const deleted = await jobApplicationService.deleteApplication(applicationId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }

    res.json({
      success: true,
      message: 'Application deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job application',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/job-applications/resume/:resumeId
 * Get all applications for a specific resume
 */
router.get('/resume/:resumeId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.resumeId);

    if (isNaN(resumeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resume ID',
      });
    }

    const applications = await jobApplicationService.getApplicationsByResume(resumeId, userId);

    res.json({
      success: true,
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('Error fetching applications by resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

