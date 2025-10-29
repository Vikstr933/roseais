import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { Logger } from '../utils/Logger';

const logger = new Logger(process.cwd());

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * Middleware to check if user has enough credits for AI generation
 */
export async function checkUsageCredits(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to use AI generation'
      });
    }

    // Get user's current credit status
    const result = await db.query(
      `SELECT
        credits_remaining,
        subscription_plan,
        subscription_status,
        subscription_period_end
      FROM users
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const creditsRemaining = user.credits_remaining || 0;
    const subscriptionPlan = user.subscription_plan || 'free';
    const subscriptionStatus = user.subscription_status;
    const periodEnd = user.subscription_period_end;

    // Check if subscription is active
    if (subscriptionPlan !== 'free') {
      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
        return res.status(402).json({
          error: 'Subscription inactive',
          message: 'Your subscription is not active. Please update your payment method.',
          plan: subscriptionPlan,
          status: subscriptionStatus,
          creditsRemaining
        });
      }

      // Check if subscription has expired
      if (periodEnd && new Date(periodEnd) < new Date()) {
        return res.status(402).json({
          error: 'Subscription expired',
          message: 'Your subscription has expired. Please renew to continue.',
          plan: subscriptionPlan,
          creditsRemaining
        });
      }
    }

    // Check if user has credits remaining
    if (creditsRemaining <= 0) {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: 'You have run out of AI generation credits. Please upgrade your plan to continue.',
        plan: subscriptionPlan,
        creditsRemaining: 0,
        upgradeUrl: '/pricing'
      });
    }

    // Store credit info in request for later use
    (req as any).userCredits = {
      remaining: creditsRemaining,
      plan: subscriptionPlan
    };

    logger.info('UsageCheck', 'Credits verified', {
      userId,
      plan: subscriptionPlan,
      creditsRemaining
    });

    next();
  } catch (error) {
    logger.error('UsageCheck', 'Failed to check credits', { error });
    res.status(500).json({
      error: 'Failed to verify credits',
      message: 'An error occurred while checking your usage limits'
    });
  }
}

/**
 * Deduct credits after successful AI generation
 */
export async function deductCredits(userId: string, amount: number = 1): Promise<boolean> {
  try {
    const result = await db.query(
      `UPDATE users
       SET credits_remaining = GREATEST(credits_remaining - $1, 0),
           last_active = NOW()
       WHERE id = $2
       RETURNING credits_remaining, subscription_plan`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      logger.error('UsageCheck', 'User not found for credit deduction', { userId });
      return false;
    }

    const { credits_remaining, subscription_plan } = result.rows[0];

    logger.info('UsageCheck', 'Credits deducted', {
      userId,
      amount,
      remaining: credits_remaining,
      plan: subscription_plan
    });

    // Track usage in usage_tracking table
    await db.query(
      `INSERT INTO usage_tracking (user_id, action_type, credits_used, credits_remaining)
       VALUES ($1, 'ai_generation', $2, $3)`,
      [userId, amount, credits_remaining]
    );

    return true;
  } catch (error) {
    logger.error('UsageCheck', 'Failed to deduct credits', { error, userId, amount });
    return false;
  }
}

/**
 * Get user's current credit status
 */
export async function getUserCredits(userId: string): Promise<{
  creditsRemaining: number;
  plan: string;
  status: string;
  periodEnd: Date | null;
} | null> {
  try {
    const result = await db.query(
      `SELECT
        credits_remaining,
        subscription_plan,
        subscription_status,
        subscription_period_end
      FROM users
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      creditsRemaining: user.credits_remaining || 0,
      plan: user.subscription_plan || 'free',
      status: user.subscription_status || 'active',
      periodEnd: user.subscription_period_end
    };
  } catch (error) {
    logger.error('UsageCheck', 'Failed to get user credits', { error, userId });
    return null;
  }
}
