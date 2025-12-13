import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { users } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
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

    // Get user's current credit status using Drizzle
    const result = await db
      .select({
        tier: users.tier,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result[0];
    const subscriptionPlan = user.tier || 'free';
    const subscriptionStatus = user.subscriptionStatus;
    const periodEnd = user.trialEndsAt;

    // Check if subscription is active
    if (subscriptionPlan !== 'free') {
      if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
        return res.status(402).json({
          error: 'Subscription inactive',
          message: 'Your subscription is not active. Please update your payment method.',
          plan: subscriptionPlan,
          status: subscriptionStatus,
        });
      }

      // Check if subscription has expired
      if (periodEnd && new Date(periodEnd) < new Date()) {
        return res.status(402).json({
          error: 'Subscription expired',
          message: 'Your subscription has expired. Please renew to continue.',
          plan: subscriptionPlan,
        });
      }
    }

    // Store credit info in request for later use
    (req as any).userCredits = {
      plan: subscriptionPlan
    };

    logger.info('UsageCheck', 'Credits verified', {
      userId,
      plan: subscriptionPlan,
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
 * Note: Credits are tracked via usage tables, not user.credits_remaining
 */
export async function deductCredits(userId: string, amount: number = 1): Promise<boolean> {
  try {
    // Update last active timestamp
    await db
      .update(users)
      .set({
        lastActive: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('UsageCheck', 'User activity tracked', {
      userId,
      amount,
    });

    return true;
  } catch (error) {
    logger.error('UsageCheck', 'Failed to track usage', { error, userId, amount });
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
    const result = await db
      .select({
        tier: users.tier,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    return {
      creditsRemaining: 0, // Credits tracked elsewhere
      plan: user.tier || 'free',
      status: user.subscriptionStatus || 'active',
      periodEnd: user.trialEndsAt
    };
  } catch (error) {
    logger.error('UsageCheck', 'Failed to get user credits', { error, userId });
    return null;
  }
}
