import { Redis } from '@upstash/redis';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import IORedis from 'ioredis';

/**
 * Rate Limiting Service
 * Prevents abuse and controls AI API costs
 * 
 * Supports both Upstash Redis (serverless) and standard Redis
 */
export class RateLimitService {
  private redis: IORedis | null = null;
  private upstashRedis: Redis | null = null;
  private aiCallLimiter: RateLimiterRedis | RateLimiterMemory;
  private buildLimiter: RateLimiterRedis | RateLimiterMemory;
  private apiLimiter: RateLimiterRedis | RateLimiterMemory;

  constructor() {
    // Try to connect to Redis if available, otherwise use in-memory
    try {
      // Prefer Upstash Redis for serverless environments
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        console.log('🔄 Connecting to Upstash Redis (serverless)...');
        this.upstashRedis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        
        // Upstash doesn't work with ioredis, so use in-memory for rate-limiter-flexible
        // The upstashRedis client can be used directly for other operations
        console.log('✅ Upstash Redis connected (using in-memory rate limiter for compatibility)');
        console.log('⚠️  Note: Rate limits are per-instance until we implement custom Upstash adapter');
        
        // Use in-memory for now (rate-limiter-flexible doesn't support HTTP Redis)
        this.redis = null;
        
        // Fallback to in-memory limiters
        this.aiCallLimiter = new RateLimiterMemory({
          points: 100,
          duration: 3600,
          blockDuration: 300,
        });

        this.buildLimiter = new RateLimiterMemory({
          points: 10,
          duration: 60,
          blockDuration: 60,
        });

        this.apiLimiter = new RateLimiterMemory({
          points: 100,
          duration: 60,
          blockDuration: 60,
        });
      } else {
        console.warn('⚠️ REDIS_URL not set, using in-memory rate limiting (not suitable for production)');
        
        // Fallback to in-memory (not recommended for production)
        this.aiCallLimiter = new RateLimiterMemory({
          points: 100,
          duration: 3600,
          blockDuration: 300,
        });

        this.buildLimiter = new RateLimiterMemory({
          points: 10,
          duration: 60,
          blockDuration: 60,
        });

        this.apiLimiter = new RateLimiterMemory({
          points: 100,
          duration: 60,
          blockDuration: 60,
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize rate limiter:', error);
      throw error;
    }
  }

  /**
   * Check if AI call is allowed
   * @param userId - User identifier (IP address or user ID)
   * @returns Promise<boolean> - True if allowed, throws error if blocked
   */
  async checkAICall(userId: string): Promise<void> {
    try {
      await this.aiCallLimiter.consume(userId, 1);
    } catch (error: any) {
      if (error.msBeforeNext) {
        throw new Error(
          `Rate limit exceeded. Too many AI requests. Please try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
        );
      }
      throw error;
    }
  }

  /**
   * Check if build is allowed
   * @param userId - User identifier
   */
  async checkBuild(userId: string): Promise<void> {
    try {
      await this.buildLimiter.consume(userId, 1);
    } catch (error: any) {
      if (error.msBeforeNext) {
        throw new Error(
          `Rate limit exceeded. Too many builds. Please try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
        );
      }
      throw error;
    }
  }

  /**
   * Check if API call is allowed
   * @param userId - User identifier
   */
  async checkAPI(userId: string): Promise<void> {
    try {
      await this.apiLimiter.consume(userId, 1);
    } catch (error: any) {
      if (error.msBeforeNext) {
        throw new Error(
          `Rate limit exceeded. Too many requests. Please try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
        );
      }
      throw error;
    }
  }

  /**
   * Get remaining points for AI calls
   */
  async getAICallsRemaining(userId: string): Promise<{ remaining: number; total: number; resetIn: number }> {
    try {
      const res = await this.aiCallLimiter.get(userId);
      if (!res) {
        return { remaining: 100, total: 100, resetIn: 3600 };
      }
      return {
        remaining: res.remainingPoints,
        total: 100,
        resetIn: Math.ceil(res.msBeforeNext / 1000),
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return { remaining: 100, total: 100, resetIn: 3600 };
    }
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetLimits(userId: string): Promise<void> {
    try {
      await this.aiCallLimiter.delete(userId);
      await this.buildLimiter.delete(userId);
      await this.apiLimiter.delete(userId);
      console.log(`✅ Rate limits reset for user: ${userId}`);
    } catch (error) {
      console.error('Error resetting rate limits:', error);
      throw error;
    }
  }

  /**
   * Premium user limits (higher quotas)
   */
  async checkAICallPremium(userId: string): Promise<void> {
    // Premium users get 1000 calls per hour instead of 100
    const premiumLimiter = this.redis
      ? new RateLimiterRedis({
          storeClient: this.redis,
          keyPrefix: 'rl:ai:premium',
          points: 1000,
          duration: 3600,
          blockDuration: 300,
        })
      : new RateLimiterMemory({
          points: 1000,
          duration: 3600,
          blockDuration: 300,
        });

    try {
      await premiumLimiter.consume(userId, 1);
    } catch (error: any) {
      if (error.msBeforeNext) {
        throw new Error(
          `Rate limit exceeded. Too many AI requests. Please try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds.`
        );
      }
      throw error;
    }
  }

  /**
   * Cleanup and close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      console.log('✅ Redis connection closed');
    }
  }
}

// Export singleton instance
export const rateLimitService = new RateLimitService();

