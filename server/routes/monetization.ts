import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { monetizationService } from '../services/MonetizationService';
import { db } from '../../db';
import { users, subscriptionPlans } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/monetization/usage
 * Get current user's usage statistics
 */
router.get('/usage', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const usageStats = await monetizationService.getUserUsageStats(userId);

    res.json({
      success: true,
      data: usageStats,
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
    });
  }
});

/**
 * GET /api/monetization/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await monetizationService.getSubscriptionPlans();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans',
    });
  }
});

/**
 * GET /api/monetization/rate-limits
 * Get rate limit configuration
 */
router.get('/rate-limits', async (req, res) => {
  try {
    const config = monetizationService.getRateLimitConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching rate limit config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit configuration',
    });
  }
});

/**
 * POST /api/monetization/check-limit
 * Check if user can make a request
 */
router.post('/check-limit', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { requestType } = req.body;

    if (!requestType) {
      return res.status(400).json({
        success: false,
        error: 'Request type is required',
      });
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user[0]) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const result = await monetizationService.checkRateLimit(
      userId,
      user[0].tier || 'free', // Default to 'free' if tier is null
      requestType
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking rate limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check rate limit',
    });
  }
});

/**
 * POST /api/monetization/upgrade
 * Upgrade user to a different tier (placeholder for Stripe integration)
 */
router.post('/upgrade', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { tier, subscriptionId } = req.body;

    if (!tier || !['pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier specified',
      });
    }

    await monetizationService.updateUserTier(userId, tier, subscriptionId);

    res.json({
      success: true,
      message: `Successfully upgraded to ${tier} tier`,
    });
  } catch (error) {
    console.error('Error upgrading user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade user',
    });
  }
});

/**
 * POST /api/monetization/downgrade
 * Downgrade user to free tier
 */
router.post('/downgrade', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    await monetizationService.updateUserTier(userId, 'free');

    res.json({
      success: true,
      message: 'Successfully downgraded to free tier',
    });
  } catch (error) {
    console.error('Error downgrading user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to downgrade user',
    });
  }
});

export default router;
