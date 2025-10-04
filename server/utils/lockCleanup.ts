import { generationLockService } from '../services/GenerationLockService';
import { userActivityService } from '../services/UserActivityService';

/**
 * Cleanup service for expired generation locks and stale user activities
 */
export class LockCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      console.log('Lock cleanup service is already running');
      return;
    }

    console.log('Starting lock cleanup service...');

    // Run cleanup immediately
    this.runCleanup();

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Lock cleanup service stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  private async runCleanup(): Promise<void> {
    try {
      console.log('Running lock cleanup...');

      // Clean up expired generation locks
      const expiredLocksCount =
        await generationLockService.cleanupExpiredLocks();

      // The UserActivityService handles its own cleanup internally
      // but we can trigger a manual cleanup if needed
      console.log(
        `Cleanup completed: ${expiredLocksCount} expired locks removed`
      );
    } catch (error) {
      console.error('Error during lock cleanup:', error);
    }
  }

  /**
   * Force cleanup of all expired locks and activities
   */
  async forceCleanup(): Promise<{ expiredLocks: number }> {
    try {
      const expiredLocksCount =
        await generationLockService.cleanupExpiredLocks();

      return {
        expiredLocks: expiredLocksCount,
      };
    } catch (error) {
      console.error('Error during force cleanup:', error);
      throw error;
    }
  }
}

export const lockCleanupService = new LockCleanupService();
