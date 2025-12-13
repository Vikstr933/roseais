import { db } from '../../db';
import {
  users,
  userUsage,
  rateLimitBuckets,
  subscriptionPlans,
  userAPIKeys,
  type User,
  type UserUsage,
  type RateLimitBucket,
  type SubscriptionPlan,
} from '../../db/schema-pg';
import { eq, and, gte, lte, desc, sum, count } from 'drizzle-orm';
import crypto from 'crypto';

export interface RateLimitConfig {
  free: {
    monthlyTokens: number;
    features: string[];
  };
  pro: {
    monthlyTokens: number;
    features: string[];
  };
  team: {
    monthlyTokens: number;
    features: string[];
  };
  enterprise: {
    monthlyTokens: number; // -1 for unlimited
    features: string[];
    allowOwnAPIKeys: boolean;
  };
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  tokensUsedThisMonth: number;
  remainingTokens: number;
  monthlyTokenLimit: number;
  usagePercentage: number;
}

export interface APIKeyResult {
  apiKey: string;
  source: 'user' | 'system';
  serviceName: string;
}

export class MonetizationService {
  private encryptionKey: string;
  private rateLimitConfig: RateLimitConfig;

  constructor() {
    this.encryptionKey =
      process.env.API_KEY_ENCRYPTION_KEY ||
      'default-encryption-key-change-in-production';
    this.rateLimitConfig = {
      free: {
        monthlyTokens: 100000, // 100K tokens per month
        features: [
          'basic_component_generation',
          'basic_chat',
          'standard_agents',
        ],
      },
      pro: {
        monthlyTokens: 1000000, // 1M tokens per month
        features: [
          'advanced_component_generation',
          'advanced_chat',
          'custom_templates',
          'priority_support',
          'custom_agents',
          'team_collaboration',
        ],
      },
      team: {
        monthlyTokens: 3000000, // 3M tokens per month
        features: [
          'advanced_component_generation',
          'advanced_chat',
          'custom_templates',
          'priority_support',
          'custom_agents',
          'team_collaboration',
          'custom_knowledge_bases',
          'advanced_analytics',
          'team_workspaces',
          'custom_integrations',
        ],
      },
      enterprise: {
        monthlyTokens: -1, // unlimited tokens
        features: [
          'unlimited_generation',
          'custom_api_keys',
          'white_label',
          'dedicated_support',
          'custom_deployments',
          'advanced_security',
          'sla_guarantee',
          'on_premise_options',
        ],
        allowOwnAPIKeys: true,
      },
    };
  }

  /**
   * Get API key for a request, checking user's tier and token limits
   */
  async getAPIKeyForRequest(
    userId: string,
    serviceName: string,
    requestType: string,
    estimatedTokens?: number
  ): Promise<APIKeyResult> {
    const user = await this.getUserWithTier(userId);
    const userTier = user.tier ?? 'free';

    // Estimate tokens if not provided
    const tokensToCheck =
      estimatedTokens || this.estimateTokenUsage(requestType);

    // Check rate limits first
    const canMakeRequest = await this.checkRateLimit(
      userId,
      userTier,
      requestType,
      tokensToCheck
    );
    if (!canMakeRequest.allowed) {
      throw new Error(`Token limit exceeded. ${canMakeRequest.message}`);
    }

    // Enterprise users can use their own API keys
    if (
      userTier === 'enterprise' &&
      this.rateLimitConfig.enterprise.allowOwnAPIKeys
    ) {
      const userKey = await this.getUserAPIKey(userId, serviceName);
      if (userKey) {
        return {
          apiKey: userKey,
          source: 'user',
          serviceName,
        };
      }
    }

    // Fall back to system API key
    const systemKey = this.getSystemAPIKey(serviceName);
    if (!systemKey) {
      throw new Error(`No API key available for service: ${serviceName}`);
    }

    return {
      apiKey: systemKey,
      source: 'system',
      serviceName,
    };
  }

  /**
   * Track usage for billing and analytics
   */
  async trackUsage(
    userId: string,
    serviceName: string,
    requestType: string,
    tokensUsed: number,
    sessionId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const model = metadata?.model || undefined;
    const cost = this.calculateCost(serviceName, tokensUsed, model);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Insert or update usage for today
    await db.insert(userUsage).values({
      userId,
      date: today,
      tokensUsed,
      aiRequests: 1,
      cost,
    });

    // Update rate limit buckets
    await this.updateRateLimitBuckets(userId, requestType);
  }

  /**
   * Check if user can make a request based on their tier and current token usage
   */
  async checkRateLimit(
    userId: string,
    tier: string,
    requestType: string,
    estimatedTokens: number = 1000 // Default estimate for token usage
  ): Promise<{ allowed: boolean; message?: string; remaining?: number }> {
    const config = this.rateLimitConfig[tier as keyof RateLimitConfig];
    if (!config) {
      return { allowed: false, message: 'Invalid user tier' };
    }

    // Enterprise users have unlimited access
    if (tier === 'enterprise' || config.monthlyTokens === -1) {
      return { allowed: true };
    }

    // Check monthly token limits
    const monthlyTokenUsage = await this.getMonthlyTokenUsage(userId);
    const totalUsageAfterRequest = monthlyTokenUsage + estimatedTokens;

    if (totalUsageAfterRequest > config.monthlyTokens) {
      return {
        allowed: false,
        message: `Monthly token limit of ${config.monthlyTokens.toLocaleString()} tokens exceeded. You have used ${monthlyTokenUsage.toLocaleString()} tokens. Upgrade your plan for more tokens.`,
        remaining: Math.max(0, config.monthlyTokens - monthlyTokenUsage),
      };
    }

    const remaining = config.monthlyTokens - monthlyTokenUsage;
    return { allowed: true, remaining };
  }

  /**
   * Get user's usage statistics
   */
  async getUserUsageStats(userId: string): Promise<UsageStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total usage
    const totalUsage = await db
      .select({
        totalRequests: count(),
        totalTokens: sum(userUsage.tokensUsed),
        totalCost: sum(userUsage.cost),
      })
      .from(userUsage)
      .where(eq(userUsage.userId, userId));

    // Get this month's token usage
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthTokenUsage = await db
      .select({ tokensUsed: sum(userUsage.tokensUsed) })
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          gte(userUsage.date, monthStartStr)
        )
      );

    const user = await this.getUserWithTier(userId);
    const userTier = user.tier ?? 'free';
    const config = this.rateLimitConfig[userTier as keyof RateLimitConfig];
    const tokensUsedThisMonth = Number(monthTokenUsage[0]?.tokensUsed) || 0;
    const monthlyTokenLimit = config.monthlyTokens;
    const remainingTokens =
      monthlyTokenLimit === -1
        ? -1
        : Math.max(0, monthlyTokenLimit - tokensUsedThisMonth);
    const usagePercentage =
      monthlyTokenLimit === -1
        ? 0
        : (tokensUsedThisMonth / monthlyTokenLimit) * 100;

    return {
      totalRequests: totalUsage[0]?.totalRequests || 0,
      totalTokens: Number(totalUsage[0]?.totalTokens) || 0,
      totalCost: Number(totalUsage[0]?.totalCost) || 0,
      tokensUsedThisMonth,
      remainingTokens,
      monthlyTokenLimit,
      usagePercentage,
    };
  }

  /**
   * Get user with tier information
   */
  private async getUserWithTier(userId: string): Promise<User> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) {
      throw new Error('User not found');
    }

    return user[0];
  }

  /**
   * Get user's API key (decrypted)
   */
  private async getUserAPIKey(
    userId: string,
    serviceName: string
  ): Promise<string | null> {
    // Note: userAPIKeys table has 'provider' not 'serviceName', and 'apiKeyHash' not 'encryptedKey'
    // For now, return null as this table structure doesn't match the expected usage
    // TODO: Update to use correct table (apiKeys) or fix userAPIKeys schema usage
    console.warn(`getUserAPIKey: userAPIKeys table structure mismatch - serviceName: ${serviceName}`);
    return null;
  }

  /**
   * Get system API key from environment
   */
  private getSystemAPIKey(serviceName: string): string | null {
    switch (serviceName.toLowerCase()) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || null;
      case 'openai':
        return process.env.OPENAI_API_KEY || null;
      default:
        return null;
    }
  }

  /**
   * Calculate cost based on service and tokens
   */
  private calculateCost(
    serviceName: string,
    tokensUsed: number,
    model?: string
  ): number {
    // Updated cost estimates (per 1M tokens)
    const costs = {
      anthropic: {
        claude_3_5_sonnet: 0.003, // $3 per 1M input tokens
        claude_3_5_haiku: 0.001, // $1 per 1M input tokens
        claude_3_opus: 0.015, // $15 per 1M input tokens
      },
      openai: {
        gpt_4: 0.03, // $30 per 1M input tokens
        gpt_4_turbo: 0.01, // $10 per 1M input tokens
        gpt_3_5_turbo: 0.001, // $1 per 1M input tokens
      },
      deepseek: {
        deepseek_coder: 0.0005, // $0.5 per 1M input tokens
      },
    };

    const serviceCosts = costs[serviceName.toLowerCase() as keyof typeof costs];
    if (!serviceCosts) return 0;

    // Use specific model cost if available, otherwise use average
    let costPerMillion = 0;
    if (model && serviceCosts[model as keyof typeof serviceCosts]) {
      costPerMillion = serviceCosts[model as keyof typeof serviceCosts];
    } else {
      // Use average cost for the service
      costPerMillion =
        Object.values(serviceCosts).reduce((a, b) => a + b, 0) /
        Object.values(serviceCosts).length;
    }

    return (tokensUsed / 1000000) * costPerMillion;
  }

  /**
   * Estimate token usage for different request types
   */
  estimateTokenUsage(
    requestType: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): number {
    const estimates = {
      component_generation: {
        simple: 2000, // Simple component
        medium: 5000, // Medium complexity component
        complex: 15000, // Complex component with multiple files
      },
      chat: {
        simple: 500, // Short chat message
        medium: 1500, // Medium conversation
        complex: 5000, // Long conversation with context
      },
      agent_generation: {
        simple: 3000, // Simple agent
        medium: 8000, // Medium complexity agent
        complex: 25000, // Complex agent with orchestration
      },
      code_review: {
        simple: 1000, // Simple code review
        medium: 3000, // Medium code review
        complex: 8000, // Complex code review
      },
    };

    const typeEstimates = estimates[requestType as keyof typeof estimates];
    if (!typeEstimates) return 1000; // Default estimate

    return typeEstimates[complexity] || typeEstimates.medium;
  }

  /**
   * Get monthly token usage
   */
  private async getMonthlyTokenUsage(userId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const result = await db
      .select({ tokensUsed: sum(userUsage.tokensUsed) })
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          gte(userUsage.date, monthStartStr)
        )
      );

    return Number(result[0]?.tokensUsed) || 0;
  }

  /**
   * Update rate limit buckets
   */
  private async updateRateLimitBuckets(
    userId: string,
    requestType: string
  ): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Update daily bucket
    await this.updateBucket(
      userId,
      'daily',
      today.toISOString(),
      now.toISOString()
    );

    // Update monthly bucket
    await this.updateBucket(
      userId,
      'monthly',
      monthStart.toISOString(),
      now.toISOString()
    );
  }

  /**
   * Update or create a rate limit bucket
   */
  private async updateBucket(
    userId: string,
    bucketType: string,
    windowStart: string,
    windowEnd: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(rateLimitBuckets)
      .where(
        and(
          eq(rateLimitBuckets.userId, userId),
          eq(rateLimitBuckets.bucketType, bucketType)
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(rateLimitBuckets)
        .set({
          currentCount: (existing[0].currentCount ?? 0) + 1,
          resetAt: new Date(windowEnd),
        })
        .where(eq(rateLimitBuckets.id, existing[0].id));
    } else {
      await db.insert(rateLimitBuckets).values({
        userId,
        bucketType,
        currentCount: 1,
        resetAt: new Date(windowEnd),
      });
    }
  }

  /**
   * Encrypt API key
   */
  private encryptKey(key: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt API key
   */
  private decryptKey(encryptedKey: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.priceMonthly);
  }

  /**
   * Update user tier
   */
  async updateUserTier(
    userId: string,
    tier: string,
    subscriptionId?: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        tier,
        subscriptionId,
        subscriptionStatus: tier === 'free' ? 'inactive' : 'active',
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): RateLimitConfig {
    return this.rateLimitConfig;
  }
}

export const monetizationService = new MonetizationService();
