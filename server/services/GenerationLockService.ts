import { db } from '../../db';
import { generationLocks } from '../../db/schema-pg';
import { eq, and, lt } from 'drizzle-orm';

// Infer types from schema
type GenerationLock = typeof generationLocks.$inferSelect;
type InsertGenerationLock = typeof generationLocks.$inferInsert;

export type LockType =
  | 'component_generation'
  | 'agent_generation'
  | 'code_generation';
export type LockStatus = 'active' | 'completed' | 'failed' | 'expired';

export interface CreateLockData {
  projectId: number;
  userId: string;
  lockType: LockType;
  sessionId?: string;
  metadata?: any;
  durationMinutes?: number; // Default: 30 minutes
}

export interface LockResult {
  success: boolean;
  lock?: GenerationLock;
  error?: string;
  existingLock?: GenerationLock;
}

export class GenerationLockService {
  private readonly DEFAULT_LOCK_DURATION_MINUTES = 30;
  private readonly MAX_LOCK_DURATION_MINUTES = 120; // 2 hours max

  /**
   * Create a generation lock for a project
   */
  async createLock(data: CreateLockData): Promise<LockResult> {
    try {
      const {
        projectId,
        userId,
        lockType,
        sessionId,
        metadata = {},
        durationMinutes,
      } = data;

      // Check if there's already an active lock for this project and type
      const existingLock = await this.getActiveLock(projectId, lockType);
      if (existingLock) {
        return {
          success: false,
          error: `Another user is currently generating ${this.getLockTypeDisplayName(lockType)} for this project`,
          existingLock,
        };
      }

      // Calculate expiration time
      const duration = Math.min(
        durationMinutes || this.DEFAULT_LOCK_DURATION_MINUTES,
        this.MAX_LOCK_DURATION_MINUTES
      );
      const expiresAt = new Date(
        Date.now() + duration * 60 * 1000
      ).toISOString();

      // Create the lock
      const lockData: InsertGenerationLock = {
        projectId,
        userId,
        lockType,
        sessionId,
        expiresAt,
        status: 'active',
        metadata: JSON.stringify(metadata),
      };

      const [newLock] = await db
        .insert(generationLocks)
        .values(lockData)
        .returning();

      console.log(
        `Created generation lock for project ${projectId}, user ${userId}, type ${lockType}`
      );

      return {
        success: true,
        lock: newLock,
      };
    } catch (error) {
      console.error('Error creating generation lock:', error);
      return {
        success: false,
        error: 'Failed to create generation lock',
      };
    }
  }

  /**
   * Get active lock for a project and type
   */
  async getActiveLock(
    projectId: number,
    lockType: LockType
  ): Promise<GenerationLock | null> {
    try {
      const now = new Date(); // Use Date object for timestamp comparison

      const [lock] = await db
        .select()
        .from(generationLocks)
        .where(
          and(
            eq(generationLocks.projectId, projectId),
            eq(generationLocks.lockType, lockType),
            eq(generationLocks.status, 'active'),
            lt(now, generationLocks.expiresAt) // Not expired
          )
        )
        .limit(1);

      return lock || null;
    } catch (error) {
      console.error('Error getting active lock:', error);
      return null;
    }
  }

  /**
   * Release a generation lock
   */
  async releaseLock(
    lockId: number,
    status: LockStatus = 'completed'
  ): Promise<boolean> {
    try {
      const [updatedLock] = await db
        .update(generationLocks)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(generationLocks.id, lockId))
        .returning();

      if (updatedLock) {
        console.log(`Released generation lock ${lockId} with status ${status}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error releasing generation lock:', error);
      return false;
    }
  }

  /**
   * Release lock by project, user, and type
   */
  async releaseLockByProject(
    projectId: number,
    userId: string,
    lockType: LockType,
    status: LockStatus = 'completed'
  ): Promise<boolean> {
    try {
      const [updatedLock] = await db
        .update(generationLocks)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationLocks.projectId, projectId),
            eq(generationLocks.userId, userId),
            eq(generationLocks.lockType, lockType),
            eq(generationLocks.status, 'active')
          )
        )
        .returning();

      if (updatedLock) {
        console.log(
          `Released generation lock for project ${projectId}, user ${userId}, type ${lockType}`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error releasing generation lock by project:', error);
      return false;
    }
  }

  /**
   * Extend a lock's expiration time
   */
  async extendLock(
    lockId: number,
    additionalMinutes: number = 15
  ): Promise<boolean> {
    try {
      const [lock] = await db
        .select()
        .from(generationLocks)
        .where(eq(generationLocks.id, lockId))
        .limit(1);

      if (!lock || lock.status !== 'active') {
        return false;
      }

      const currentExpiry = new Date(lock.expiresAt);
      const newExpiry = new Date(
        currentExpiry.getTime() + additionalMinutes * 60 * 1000
      );

      // Don't extend beyond max duration
      const maxExpiry = new Date(lock.startedAt);
      maxExpiry.setMinutes(
        maxExpiry.getMinutes() + this.MAX_LOCK_DURATION_MINUTES
      );

      const finalExpiry = newExpiry > maxExpiry ? maxExpiry : newExpiry;

      await db
        .update(generationLocks)
        .set({
          expiresAt: finalExpiry.toISOString(),
          updatedAt: new Date(),
        })
        .where(eq(generationLocks.id, lockId));

      console.log(
        `Extended generation lock ${lockId} by ${additionalMinutes} minutes`
      );
      return true;
    } catch (error) {
      console.error('Error extending generation lock:', error);
      return false;
    }
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const now = new Date(); // Use Date object, not string

      // Add timeout to prevent hanging on slow connections
      const cleanupQuery = db
        .update(generationLocks)
        .set({
          status: 'expired',
          updatedAt: now,
        })
        .where(
          and(
            eq(generationLocks.status, 'active'),
            lt(generationLocks.expiresAt, now)
          )
        )
        .returning();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Lock cleanup query timeout after 10 seconds')), 10000)
      );

      const result = await Promise.race([cleanupQuery, timeoutPromise]);
      const cleanedCount = result.length;
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired generation locks`);
      }

      return cleanedCount;
    } catch (error) {
      // Handle database connection errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND');

      if (isConnectionError) {
        console.warn('Lock cleanup skipped due to database connection issue:', errorMessage);
        return 0; // Return 0, don't throw
      }

      console.error('Error cleaning up expired locks:', error);
      return 0; // Return 0 on any error (graceful degradation)
    }
  }

  /**
   * Get all active locks for a project
   */
  async getProjectLocks(projectId: number): Promise<GenerationLock[]> {
    try {
      const now = new Date(); // Use Date object for timestamp comparison

      return await db
        .select()
        .from(generationLocks)
        .where(
          and(
            eq(generationLocks.projectId, projectId),
            eq(generationLocks.status, 'active'),
            lt(now, generationLocks.expiresAt)
          )
        )
        .orderBy(generationLocks.startedAt);
    } catch (error) {
      console.error('Error getting project locks:', error);
      return [];
    }
  }

  /**
   * Check if a user can start generation for a project
   */
  async canStartGeneration(
    projectId: number,
    userId: string,
    lockType: LockType
  ): Promise<{
    canStart: boolean;
    reason?: string;
    existingLock?: GenerationLock;
  }> {
    try {
      const existingLock = await this.getActiveLock(projectId, lockType);

      if (!existingLock) {
        return { canStart: true };
      }

      // If the existing lock belongs to the same user, they can continue
      if (existingLock.userId === userId) {
        return { canStart: true };
      }

      return {
        canStart: false,
        reason: `Another user is currently generating ${this.getLockTypeDisplayName(lockType)} for this project`,
        existingLock,
      };
    } catch (error) {
      console.error('Error checking if user can start generation:', error);
      return {
        canStart: false,
        reason: 'Error checking generation status',
      };
    }
  }

  /**
   * Get user-friendly display name for lock type
   */
  private getLockTypeDisplayName(lockType: LockType): string {
    switch (lockType) {
      case 'component_generation':
        return 'components';
      case 'agent_generation':
        return 'agents';
      case 'code_generation':
        return 'code';
      default:
        return 'content';
    }
  }

  /**
   * Get lock status information for a project
   */
  async getProjectLockStatus(projectId: number): Promise<{
    hasActiveLocks: boolean;
    locks: GenerationLock[];
    lockTypes: LockType[];
  }> {
    try {
      const locks = await this.getProjectLocks(projectId);
      const lockTypes = locks.map(lock => lock.lockType);

      return {
        hasActiveLocks: locks.length > 0,
        locks,
        lockTypes,
      };
    } catch (error) {
      console.error('Error getting project lock status:', error);
      return {
        hasActiveLocks: false,
        locks: [],
        lockTypes: [],
      };
    }
  }
}

export const generationLockService = new GenerationLockService();
