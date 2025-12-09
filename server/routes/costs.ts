import { Router } from 'express';
import { costMonitoringService } from '../services/CostMonitoringService';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/costs/metrics
 * Get current cost metrics
 */
router.get('/metrics', authenticateUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.tier !== 'admin' && req.user?.tier !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = await costMonitoringService.getCostMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting cost metrics:', error);
    res.status(500).json({ error: 'Failed to get cost metrics' });
  }
});

/**
 * GET /api/costs/alerts
 * Get current cost alerts
 */
router.get('/alerts', authenticateUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.tier !== 'admin' && req.user?.tier !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const alerts = await costMonitoringService.checkCostAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Error checking cost alerts:', error);
    res.status(500).json({ error: 'Failed to check cost alerts' });
  }
});

/**
 * GET /api/costs/trends
 * Get cost trends over time
 */
router.get('/trends', authenticateUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.tier !== 'admin' && req.user?.tier !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const trends = await costMonitoringService.getCostTrends(days);
    res.json(trends);
  } catch (error) {
    console.error('Error getting cost trends:', error);
    res.status(500).json({ error: 'Failed to get cost trends' });
  }
});

/**
 * GET /api/costs/user/:userId
 * Get cost breakdown for a specific user
 */
router.get('/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only see their own costs, admins can see all
    if (req.user?.id !== userId && req.user?.tier !== 'admin' && req.user?.tier !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const breakdown = await costMonitoringService.getUserCostBreakdown(userId);
    res.json(breakdown);
  } catch (error) {
    console.error('Error getting user cost breakdown:', error);
    res.status(500).json({ error: 'Failed to get user cost breakdown' });
  }
});

/**
 * GET /api/costs/my-usage
 * Get current user's cost breakdown
 */
router.get('/my-usage', authenticateUser, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const breakdown = await costMonitoringService.getUserCostBreakdown(req.user.id);
    res.json(breakdown);
  } catch (error) {
    console.error('Error getting user cost breakdown:', error);
    res.status(500).json({ error: 'Failed to get cost breakdown' });
  }
});

/**
 * GET /api/costs/limits
 * Get current cost limits
 */
router.get('/limits', authenticateUser, async (req, res) => {
  try {
    const limits = costMonitoringService.getCostLimits();
    res.json(limits);
  } catch (error) {
    console.error('Error getting cost limits:', error);
    res.status(500).json({ error: 'Failed to get cost limits' });
  }
});

/**
 * PUT /api/costs/limits
 * Update cost limits (admin only)
 */
router.put('/limits', authenticateUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.tier !== 'admin' && req.user?.tier !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { daily, monthly, userDaily, userMonthly } = req.body;
    
    costMonitoringService.setCostLimits({
      daily,
      monthly,
      userDaily,
      userMonthly,
    });

    res.json({
      message: 'Cost limits updated',
      limits: costMonitoringService.getCostLimits(),
    });
  } catch (error) {
    console.error('Error updating cost limits:', error);
    res.status(500).json({ error: 'Failed to update cost limits' });
  }
});

export default router;
