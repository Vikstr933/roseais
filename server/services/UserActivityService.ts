import { db } from '../../db';
import { projectMembers, users, type User } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export interface UserActivity {
  userId: string;
  username: string;
  displayName: string;
  activityType: 'generating' | 'chatting' | 'viewing' | 'editing';
  lockType?: 'component_generation' | 'agent_generation' | 'code_generation';
  projectId: number;
  startedAt: string;
  lastSeen: string;
  metadata?: any;
}

export interface ProjectActivityStatus {
  projectId: number;
  activeUsers: UserActivity[];
  hasActiveGeneration: boolean;
  hasActiveChat: boolean;
  generationLocks: Array<{
    userId: string;
    username: string;
    displayName: string;
    lockType: string;
    startedAt: string;
  }>;
}

export class UserActivityService {
  private activeUsers: Map<string, UserActivity> = new Map();
  private readonly ACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Track user activity in a project
   */
  async trackUserActivity(
    projectId: number,
    userId: string,
    activityType: UserActivity['activityType'],
    lockType?: UserActivity['lockType'],
    metadata?: any
  ): Promise<UserActivity> {
    try {
      // Get user info
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date().toISOString();
      const activityKey = `${projectId}-${userId}-${activityType}`;

      const activity: UserActivity = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        activityType,
        lockType,
        projectId,
        startedAt: now,
        lastSeen: now,
        metadata,
      };

      this.activeUsers.set(activityKey, activity);

      // Clean up old activities
      this.cleanupExpiredActivities();

      console.log(
        `Tracked user activity: ${user.displayName} ${activityType} in project ${projectId}`
      );
      return activity;
    } catch (error) {
      console.error('Error tracking user activity:', error);
      throw error;
    }
  }

  /**
   * Update user's last seen timestamp
   */
  updateUserLastSeen(
    projectId: number,
    userId: string,
    activityType: UserActivity['activityType']
  ): void {
    const activityKey = `${projectId}-${userId}-${activityType}`;
    const activity = this.activeUsers.get(activityKey);

    if (activity) {
      activity.lastSeen = new Date().toISOString();
      this.activeUsers.set(activityKey, activity);
    }
  }

  /**
   * Remove user activity
   */
  removeUserActivity(
    projectId: number,
    userId: string,
    activityType: UserActivity['activityType']
  ): void {
    const activityKey = `${projectId}-${userId}-${activityType}`;
    this.activeUsers.delete(activityKey);

    console.log(
      `Removed user activity: ${userId} ${activityType} in project ${projectId}`
    );
  }

  /**
   * Get all active users for a project
   */
  getProjectActiveUsers(projectId: number): UserActivity[] {
    const projectActivities: UserActivity[] = [];

    for (const [key, activity] of this.activeUsers.entries()) {
      if (activity.projectId === projectId && this.isActivityActive(activity)) {
        projectActivities.push(activity);
      }
    }

    return projectActivities.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  /**
   * Get project activity status including generation locks
   */
  async getProjectActivityStatus(
    projectId: number
  ): Promise<ProjectActivityStatus> {
    try {
      const activeUsers = this.getProjectActiveUsers(projectId);

      // Get generation locks from database
      const { generationLockService } = await import('./GenerationLockService');
      const projectLocks =
        await generationLockService.getProjectLocks(projectId);

      // Get user info for locks
      const generationLocks = await Promise.all(
        projectLocks.map(async lock => {
          const [user] = await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, lock.userId))
            .limit(1);

          return {
            userId: lock.userId,
            username: user?.username || 'Unknown',
            displayName: user?.displayName || 'Unknown User',
            lockType: lock.lockType,
            startedAt: lock.startedAt,
          };
        })
      );

      const hasActiveGeneration = projectLocks.length > 0;
      const hasActiveChat = activeUsers.some(
        user => user.activityType === 'chatting'
      );

      return {
        projectId,
        activeUsers,
        hasActiveGeneration,
        hasActiveChat,
        generationLocks,
      };
    } catch (error) {
      console.error('Error getting project activity status:', error);
      return {
        projectId,
        activeUsers: [],
        hasActiveGeneration: false,
        hasActiveChat: false,
        generationLocks: [],
      };
    }
  }

  /**
   * Check if user is currently active in a project
   */
  isUserActiveInProject(projectId: number, userId: string): boolean {
    for (const [key, activity] of this.activeUsers.entries()) {
      if (
        activity.projectId === projectId &&
        activity.userId === userId &&
        this.isActivityActive(activity)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all active users across all projects
   */
  getAllActiveUsers(): UserActivity[] {
    const allActivities: UserActivity[] = [];

    for (const activity of this.activeUsers.values()) {
      if (this.isActivityActive(activity)) {
        allActivities.push(activity);
      }
    }

    return allActivities.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  /**
   * Check if an activity is still active (not expired)
   */
  private isActivityActive(activity: UserActivity): boolean {
    const now = new Date().getTime();
    const lastSeen = new Date(activity.lastSeen).getTime();
    return now - lastSeen < this.ACTIVITY_TIMEOUT_MS;
  }

  /**
   * Clean up expired activities
   */
  private cleanupExpiredActivities(): void {
    const now = new Date().getTime();
    const expiredKeys: string[] = [];

    for (const [key, activity] of this.activeUsers.entries()) {
      const lastSeen = new Date(activity.lastSeen).getTime();
      if (now - lastSeen >= this.ACTIVITY_TIMEOUT_MS) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.activeUsers.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired user activities`);
    }
  }

  /**
   * Get activity summary for a user
   */
  getUserActivitySummary(userId: string): {
    activeProjects: number[];
    currentActivities: UserActivity[];
  } {
    const userActivities: UserActivity[] = [];
    const projectIds = new Set<number>();

    for (const activity of this.activeUsers.values()) {
      if (activity.userId === userId && this.isActivityActive(activity)) {
        userActivities.push(activity);
        projectIds.add(activity.projectId);
      }
    }

    return {
      activeProjects: Array.from(projectIds),
      currentActivities: userActivities,
    };
  }
}

export const userActivityService = new UserActivityService();
