import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { pluginExecutionLogs, users } from '../../db/schema-pg';
import { eq, and, sql } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('PluginRateLimiter');

// In-memory rate limit tracking (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Tier-based execution limits
const EXECUTION_LIMITS = {
  free: {
    perMinute: 5,
    perHour: 50,
    perDay: 100,
  },
  pro: {
    perMinute: 20,
    perHour: 500,
    perDay: 1000,
  },
  team: {
    perMinute: 50,
    perHour: 2000,
    perDay: 10000,
  },
  enterprise: {
    perMinute: -1, // unlimited
    perHour: -1,
    perDay: -1,
  },
};

interface RateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  resetAt?: Date;
  reason?: string;
}

/**
 * Rate limiter for plugin executions
 */
export class PluginRateLimiter {
  /**
   * Check if user can execute plugin
   */
  static async checkLimit(
    userId: string,
    pluginId: string,
    window: 'minute' | 'hour' | 'day' = 'minute'
  ): Promise<RateLimitResult> {
    try {
      // Get user tier
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return {
          allowed: false,
          reason: 'User not found',
        };
      }

      const limits = EXECUTION_LIMITS[user.tier as keyof typeof EXECUTION_LIMITS] || EXECUTION_LIMITS.free;
      const limit = limits[`per${window.charAt(0).toUpperCase() + window.slice(1)}` as keyof typeof limits];

      // Unlimited
      if (limit === -1) {
        return { allowed: true };
      }

      // Get time window
      const now = new Date();
      let windowStart: Date;
      let resetAt: Date;

      switch (window) {
        case 'minute':
          windowStart = new Date(now.getTime() - 60 * 1000);
          resetAt = new Date(Math.ceil(now.getTime() / (60 * 1000)) * (60 * 1000));
          break;
        case 'hour':
          windowStart = new Date(now.getTime() - 60 * 60 * 1000);
          resetAt = new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
          break;
        case 'day':
          windowStart = new Date(now);
          windowStart.setHours(0, 0, 0, 0);
          resetAt = new Date(windowStart);
          resetAt.setDate(resetAt.getDate() + 1);
          break;
      }

      // Count executions in window
      const executions = await db
        .select({ count: sql<number>`count(*)` })
        .from(pluginExecutionLogs)
        .where(
          and(
            eq(pluginExecutionLogs.userId, userId),
            eq(pluginExecutionLogs.pluginId, pluginId),
            sql`${pluginExecutionLogs.createdAt} >= ${windowStart}`
          )
        );

      const count = Number(executions[0]?.count || 0);
      const remaining = Math.max(0, limit - count);

      if (count >= limit) {
        logger.warn(`Rate limit exceeded: userId=${userId}, pluginId=${pluginId}, window=${window}, count=${count}, limit=${limit}`);

        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt,
          reason: `Rate limit exceeded: ${count}/${limit} executions in the last ${window}`,
        };
      }

      return {
        allowed: true,
        limit,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)));
      // Fail safe: allow execution but log error
      return { allowed: true };
    }
  }

  /**
   * Express middleware for rate limiting
   */
  static middleware(window: 'minute' | 'hour' | 'day' = 'minute') {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.id;
      const pluginId = req.params.pluginId || req.body.pluginId;

      if (!pluginId) {
        return next();
      }

      const result = await PluginRateLimiter.checkLimit(userId, pluginId, window);

      // Set rate limit headers
      if (result.limit !== undefined) {
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
        if (result.resetAt) {
          res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
        }
      }

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt?.toISOString(),
          reason: result.reason,
        });
      }

      next();
    };
  }

  /**
   * Clean up old rate limit entries (call periodically)
   */
  static cleanup() {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Clean up every 5 minutes
setInterval(() => PluginRateLimiter.cleanup(), 5 * 60 * 1000);

export const pluginRateLimiter = PluginRateLimiter.middleware;
