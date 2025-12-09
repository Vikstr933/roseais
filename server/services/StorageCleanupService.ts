import { r2StorageService } from './R2StorageService';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Service to clean up old project files from storage
 * Prevents unlimited storage growth
 */
export class StorageCleanupService {
  private cleanupIntervalHours: number;
  private maxFileAgeHours: number;

  constructor() {
    // Clean up files older than 24 hours by default
    this.maxFileAgeHours = parseInt(process.env.MAX_FILE_AGE_HOURS || '24');
    // Run cleanup every 6 hours
    this.cleanupIntervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '6');
  }

  /**
   * Start automatic cleanup on interval
   */
  startAutomaticCleanup() {
    // Run cleanup immediately on startup
    this.runCleanup().catch(console.error);

    // Then run periodically
    setInterval(() => {
      this.runCleanup().catch(console.error);
    }, this.cleanupIntervalHours * 60 * 60 * 1000);

    console.log(`✅ Storage cleanup enabled: Files older than ${this.maxFileAgeHours}h will be deleted every ${this.cleanupIntervalHours}h`);
  }

  /**
   * Run cleanup process
   */
  private async runCleanup() {
    console.log('🧹 Starting storage cleanup...');

    try {
      // Cleanup R2 storage
      if (r2StorageService.isEnabled()) {
        await this.cleanupR2Storage();
      }

      // Cleanup local workspaces
      await this.cleanupLocalWorkspaces();

      console.log('✅ Storage cleanup completed');
    } catch (error) {
      console.error('❌ Storage cleanup failed:', error);
    }
  }

  /**
   * Clean up old files from R2
   */
  private async cleanupR2Storage() {
    try {
      // List all files in R2
      const allFiles = await r2StorageService.listFiles('');
      const now = Date.now();
      let deletedCount = 0;

      for (const filePath of allFiles) {
        // Extract timestamp from path (format: userId/componentname-timestamp/file.tsx)
        const match = filePath.match(/-(\d{13})\//);
        if (match) {
          const timestamp = parseInt(match[1]);
          const ageHours = (now - timestamp) / (1000 * 60 * 60);

          if (ageHours > this.maxFileAgeHours) {
            await r2StorageService.deleteFile(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️  Deleted ${deletedCount} old files from R2`);
      }
    } catch (error) {
      console.error('Error cleaning up R2 storage:', error);
    }
  }

  /**
   * Clean up old local workspace directories
   */
  private async cleanupLocalWorkspaces() {
    try {
      const workspacesDir = path.join(process.cwd(), 'workspaces');

      // Check if workspaces directory exists
      try {
        await fs.access(workspacesDir);
      } catch {
        return; // Directory doesn't exist, nothing to clean
      }

      const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
      const now = Date.now();
      let deletedCount = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Extract timestamp from directory name
        const match = entry.name.match(/(\d{13})$/);
        if (match) {
          const timestamp = parseInt(match[1]);
          const ageHours = (now - timestamp) / (1000 * 60 * 60);

          if (ageHours > this.maxFileAgeHours) {
            const dirPath = path.join(workspacesDir, entry.name);
            await fs.rm(dirPath, { recursive: true, force: true });
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️  Deleted ${deletedCount} old workspace directories`);
      }
    } catch (error) {
      console.error('Error cleaning up local workspaces:', error);
    }
  }

  /**
   * Manually trigger cleanup (useful for testing or admin endpoints)
   */
  async manualCleanup(): Promise<{ r2Deleted: number; localDeleted: number }> {
    await this.runCleanup();
    return { r2Deleted: 0, localDeleted: 0 }; // TODO: track counts
  }
}

// Export singleton
export const storageCleanupService = new StorageCleanupService();
