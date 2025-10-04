import { db } from '../../db';
import { userUsage } from '../../db/schema';
import { eq, gte, lte, sum, count, desc, and } from 'drizzle-orm';

export interface CostAlert {
  id: string;
  type: 'daily_limit' | 'monthly_limit' | 'user_limit' | 'service_limit';
  threshold: number;
  currentValue: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface CostMetrics {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  costPerUser: number;
  costPerRequest: number;
  topUsers: Array<{
    userId: string;
    totalCost: number;
    requestCount: number;
  }>;
  costByService: Array<{
    serviceName: string;
    totalCost: number;
    requestCount: number;
  }>;
}

export class CostMonitoringService {
  private dailyLimit: number;
  private monthlyLimit: number;
  private userDailyLimit: number;
  private userMonthlyLimit: number;

  constructor() {
    // Set cost limits (in USD)
    this.dailyLimit = parseFloat(process.env.DAILY_COST_LIMIT || '100');
    this.monthlyLimit = parseFloat(process.env.MONTHLY_COST_LIMIT || '2000');
    this.userDailyLimit = parseFloat(process.env.USER_DAILY_COST_LIMIT || '10');
    this.userMonthlyLimit = parseFloat(
      process.env.USER_MONTHLY_COST_LIMIT || '100'
    );
  }

  /**
   * Get current cost metrics
   */
  async getCostMetrics(): Promise<CostMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total cost
    const totalCostResult = await db
      .select({ totalCost: sum(userUsage.cost) })
      .from(userUsage);

    // Get today's cost
    const dailyCostResult = await db
      .select({ dailyCost: sum(userUsage.cost) })
      .from(userUsage)
      .where(gte(userUsage.createdAt, today.toISOString()));

    // Get this month's cost
    const monthlyCostResult = await db
      .select({ monthlyCost: sum(userUsage.cost) })
      .from(userUsage)
      .where(gte(userUsage.createdAt, monthStart.toISOString()));

    // Get total requests
    const totalRequestsResult = await db
      .select({ totalRequests: count() })
      .from(userUsage);

    // Get top users by cost
    const topUsersResult = await db
      .select({
        userId: userUsage.userId,
        totalCost: sum(userUsage.cost),
        requestCount: count(),
      })
      .from(userUsage)
      .groupBy(userUsage.userId)
      .orderBy(desc(sum(userUsage.cost)))
      .limit(10);

    // Get cost by service
    const costByServiceResult = await db
      .select({
        serviceName: userUsage.serviceName,
        totalCost: sum(userUsage.cost),
        requestCount: count(),
      })
      .from(userUsage)
      .groupBy(userUsage.serviceName)
      .orderBy(desc(sum(userUsage.cost)));

    const totalCost = totalCostResult[0]?.totalCost || 0;
    const totalRequests = totalRequestsResult[0]?.totalRequests || 0;

    return {
      totalCost: Number(totalCost),
      dailyCost: Number(dailyCostResult[0]?.dailyCost) || 0,
      monthlyCost: Number(monthlyCostResult[0]?.monthlyCost) || 0,
      costPerUser: Number(totalCost) / Math.max(topUsersResult.length, 1),
      costPerRequest: totalRequests > 0 ? Number(totalCost) / totalRequests : 0,
      topUsers: topUsersResult.map(user => ({
        userId: user.userId,
        totalCost: Number(user.totalCost) || 0,
        requestCount: user.requestCount || 0,
      })),
      costByService: costByServiceResult.map(service => ({
        serviceName: service.serviceName,
        totalCost: Number(service.totalCost) || 0,
        requestCount: service.requestCount || 0,
      })),
    };
  }

  /**
   * Check for cost alerts
   */
  async checkCostAlerts(): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];
    const metrics = await this.getCostMetrics();
    const now = new Date();

    // Check daily limit
    if (metrics.dailyCost > this.dailyLimit) {
      alerts.push({
        id: `daily_limit_${now.getTime()}`,
        type: 'daily_limit',
        threshold: this.dailyLimit,
        currentValue: metrics.dailyCost,
        message: `Daily cost limit exceeded: $${metrics.dailyCost.toFixed(2)} > $${this.dailyLimit}`,
        severity:
          metrics.dailyCost > this.dailyLimit * 1.5 ? 'critical' : 'high',
        timestamp: now,
      });
    }

    // Check monthly limit
    if (metrics.monthlyCost > this.monthlyLimit) {
      alerts.push({
        id: `monthly_limit_${now.getTime()}`,
        type: 'monthly_limit',
        threshold: this.monthlyLimit,
        currentValue: metrics.monthlyCost,
        message: `Monthly cost limit exceeded: $${metrics.monthlyCost.toFixed(2)} > $${this.monthlyLimit}`,
        severity:
          metrics.monthlyCost > this.monthlyLimit * 1.2 ? 'critical' : 'high',
        timestamp: now,
      });
    }

    // Check individual user limits
    for (const user of metrics.topUsers) {
      if (user.totalCost > this.userMonthlyLimit) {
        alerts.push({
          id: `user_limit_${user.userId}_${now.getTime()}`,
          type: 'user_limit',
          threshold: this.userMonthlyLimit,
          currentValue: user.totalCost,
          message: `User ${user.userId} exceeded monthly limit: $${user.totalCost.toFixed(2)} > $${this.userMonthlyLimit}`,
          severity:
            user.totalCost > this.userMonthlyLimit * 2 ? 'high' : 'medium',
          timestamp: now,
        });
      }
    }

    return alerts;
  }

  /**
   * Get cost trends over time
   */
  async getCostTrends(days: number = 30): Promise<
    Array<{
      date: string;
      cost: number;
      requests: number;
    }>
  > {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // This is a simplified implementation
    // In a real system, you'd want to aggregate by day
    const result = await db
      .select({
        date: userUsage.createdAt,
        cost: userUsage.cost,
        requests: count(),
      })
      .from(userUsage)
      .where(gte(userUsage.createdAt, startDate.toISOString()))
      .groupBy(userUsage.createdAt)
      .orderBy(userUsage.createdAt);

    return result.map(row => ({
      date: row.date,
      cost: row.cost || 0,
      requests: row.requests || 0,
    }));
  }

  /**
   * Get user cost breakdown
   */
  async getUserCostBreakdown(userId: string): Promise<{
    totalCost: number;
    dailyCost: number;
    monthlyCost: number;
    costByService: Array<{
      serviceName: string;
      cost: number;
      requests: number;
    }>;
    recentActivity: Array<{
      date: string;
      cost: number;
      serviceName: string;
      requestType: string;
    }>;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total cost for user
    const totalCostResult = await db
      .select({ totalCost: sum(userUsage.cost) })
      .from(userUsage)
      .where(eq(userUsage.userId, userId));

    // Get daily cost for user
    const dailyCostResult = await db
      .select({ dailyCost: sum(userUsage.cost) })
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          gte(userUsage.createdAt, today.toISOString())
        )
      );

    // Get monthly cost for user
    const monthlyCostResult = await db
      .select({ monthlyCost: sum(userUsage.cost) })
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          gte(userUsage.createdAt, monthStart.toISOString())
        )
      );

    // Get cost by service for user
    const costByServiceResult = await db
      .select({
        serviceName: userUsage.serviceName,
        cost: sum(userUsage.cost),
        requests: count(),
      })
      .from(userUsage)
      .where(eq(userUsage.userId, userId))
      .groupBy(userUsage.serviceName);

    // Get recent activity
    const recentActivityResult = await db
      .select({
        createdAt: userUsage.createdAt,
        cost: userUsage.cost,
        serviceName: userUsage.serviceName,
        requestType: userUsage.requestType,
      })
      .from(userUsage)
      .where(eq(userUsage.userId, userId))
      .orderBy(desc(userUsage.createdAt))
      .limit(20);

    return {
      totalCost: Number(totalCostResult[0]?.totalCost) || 0,
      dailyCost: Number(dailyCostResult[0]?.dailyCost) || 0,
      monthlyCost: Number(monthlyCostResult[0]?.monthlyCost) || 0,
      costByService: costByServiceResult.map(service => ({
        serviceName: service.serviceName,
        cost: Number(service.cost) || 0,
        requests: service.requests || 0,
      })),
      recentActivity: recentActivityResult.map(activity => ({
        date: activity.createdAt,
        cost: Number(activity.cost) || 0,
        serviceName: activity.serviceName,
        requestType: activity.requestType,
      })),
    };
  }

  /**
   * Set cost limits
   */
  setCostLimits(limits: {
    daily?: number;
    monthly?: number;
    userDaily?: number;
    userMonthly?: number;
  }): void {
    if (limits.daily !== undefined) this.dailyLimit = limits.daily;
    if (limits.monthly !== undefined) this.monthlyLimit = limits.monthly;
    if (limits.userDaily !== undefined) this.userDailyLimit = limits.userDaily;
    if (limits.userMonthly !== undefined)
      this.userMonthlyLimit = limits.userMonthly;
  }

  /**
   * Get current cost limits
   */
  getCostLimits(): {
    daily: number;
    monthly: number;
    userDaily: number;
    userMonthly: number;
  } {
    return {
      daily: this.dailyLimit,
      monthly: this.monthlyLimit,
      userDaily: this.userDailyLimit,
      userMonthly: this.userMonthlyLimit,
    };
  }
}

export const costMonitoringService = new CostMonitoringService();
