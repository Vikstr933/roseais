import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { linkedInAWLIService } from '../services/LinkedInAWLIService';
import { db } from '../../db';
import { users } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/linkedin/awli/status
 * Check if LinkedIn AWLI is available
 */
router.get('/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const available = linkedInAWLIService.isAvailable();
    res.json({
      success: true,
      available,
      message: available
        ? 'LinkedIn AWLI is configured and ready'
        : 'LinkedIn AWLI is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.',
    });
  } catch (error) {
    console.error('Error checking LinkedIn AWLI status:', error);
    res.status(500).json({
      success: false,
      available: false,
      error: 'Failed to check LinkedIn AWLI status',
    });
  }
});

/**
 * POST /api/linkedin/awli/initiate
 * Initiate OAuth flow for Apply with LinkedIn
 */
router.post('/initiate', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { jobId, jobTitle, companyName, redirectUrl } = req.body;

    if (!linkedInAWLIService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'LinkedIn AWLI is not configured',
        message: 'LinkedIn AWLI requires LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to be set.',
      });
    }

    // Generate state for CSRF protection
    const state = linkedInAWLIService.generateState();
    
    // Store state in session or database (for verification in callback)
    // For now, we'll include job info in state (in production, use secure session storage)
    const stateData = {
      userId,
      jobId,
      jobTitle,
      companyName,
      redirectUrl,
      timestamp: Date.now(),
    };
    
    // In production, store this in Redis or database with expiration
    // For now, we'll encode it in the state (not ideal, but works for MVP)
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64url');
    
    // Generate OAuth URL
    const authUrl = linkedInAWLIService.generateAuthUrl(encodedState, jobId);

    if (!authUrl) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate OAuth URL',
      });
    }

    res.json({
      success: true,
      authUrl,
      state: encodedState, // Return state for client to verify
    });
  } catch (error) {
    console.error('Error initiating LinkedIn AWLI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate LinkedIn AWLI',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/linkedin/awli/callback
 * OAuth callback handler for LinkedIn AWLI
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/?linkedin_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/?linkedin_error=missing_code_or_state');
    }

    // Decode state to get job info
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString('utf-8'));
    } catch (error) {
      return res.redirect('/?linkedin_error=invalid_state');
    }

    // Verify state hasn't expired (5 minutes)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return res.redirect('/?linkedin_error=state_expired');
    }

    // Exchange code for access token
    const accessToken = await linkedInAWLIService.exchangeCodeForToken(code as string);
    if (!accessToken) {
      return res.redirect('/?linkedin_error=token_exchange_failed');
    }

    // Fetch profile data
    const profileData = await linkedInAWLIService.fetchProfileData(accessToken);

    // Store LinkedIn profile data for user (optional - for future use)
    if (stateData.userId) {
      try {
        await db
          .update(users)
          .set({
            // Store LinkedIn profile data in user metadata if needed
            // For now, we'll just log it
          })
          .where(eq(users.id, stateData.userId));
      } catch (error) {
        console.error('Failed to store LinkedIn profile data:', error);
        // Continue anyway - profile data is returned to client
      }
    }

    // Redirect back to application page with profile data
    // In production, use secure session storage or encrypted query params
    const profileDataParam = Buffer.from(JSON.stringify(profileData)).toString('base64url');
    const redirectUrl = stateData.redirectUrl || '/';
    
    res.redirect(`${redirectUrl}?linkedin_profile=${profileDataParam}&job_id=${stateData.jobId || ''}`);
  } catch (error) {
    console.error('Error in LinkedIn AWLI callback:', error);
    res.redirect('/?linkedin_error=callback_failed');
  }
});

/**
 * GET /api/linkedin/awli/profile
 * Get LinkedIn profile data (after OAuth callback)
 * This endpoint can be used to fetch profile data stored during callback
 */
router.get('/profile', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const { profileData } = req.query;

    if (!profileData) {
      return res.status(400).json({
        success: false,
        error: 'Profile data not provided',
      });
    }

    // Decode profile data
    try {
      const decoded = JSON.parse(Buffer.from(profileData as string, 'base64url').toString('utf-8'));
      res.json({
        success: true,
        profileData: decoded,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid profile data format',
      });
    }
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch LinkedIn profile',
    });
  }
});

export default router;

