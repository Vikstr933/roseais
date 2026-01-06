import { autoApplyService } from './AutoApplyService';
import { SimpleLogger } from '../utils/SimpleLogger';
import type { AutoApplySettings } from './AutoApplyService';

const logger = new SimpleLogger('AutoApplySchedulerService');

export class AutoApplySchedulerService {
  private static instance: AutoApplySchedulerService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // Run every hour

  private constructor() {
    logger.info('AutoApplySchedulerService initialized');
  }

  public static getInstance(): AutoApplySchedulerService {
    if (!AutoApplySchedulerService.instance) {
      AutoApplySchedulerService.instance = new AutoApplySchedulerService();
    }
    return AutoApplySchedulerService.instance;
  }

  /**
   * Start the scheduler service
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Auto-apply scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting auto-apply scheduler service', {
      intervalMs: this.INTERVAL_MS,
      intervalHours: this.INTERVAL_MS / (60 * 60 * 1000),
    });

    // Run immediately on start (after a short delay to let server fully start)
    setTimeout(() => {
      this.processAutoApply().catch(error => {
        logger.error('Initial auto-apply check failed', error as Error);
      });
    }, 30000); // Wait 30 seconds after server start

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.processAutoApply().catch(error => {
        logger.error('Auto-apply check failed', error as Error);
      });
    }, this.INTERVAL_MS);
  }

  /**
   * Stop the scheduler service
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Auto-apply scheduler service stopped');
  }

  /**
   * Process auto-apply for all enabled users
   */
  private async processAutoApply(): Promise<void> {
    try {
      logger.info('Starting auto-apply process for all enabled users');

      // Get all enabled settings
      const allSettings = await autoApplyService.getAllEnabledSettings();

      if (allSettings.length === 0) {
        logger.info('No users with auto-apply enabled');
        return;
      }

      logger.info(`Processing auto-apply for ${allSettings.length} user(s)`);

      // Process each user's auto-apply
      for (const settings of allSettings) {
        try {
          await this.processUserAutoApply(settings);
        } catch (error) {
          logger.error(`Failed to process auto-apply for user ${settings.userId}`, error as Error);
          // Continue with next user even if one fails
        }
      }

      logger.info('Auto-apply process completed');
    } catch (error) {
      logger.error('Error in auto-apply process', error as Error);
    }
  }

  /**
   * Process auto-apply for a single user
   */
  private async processUserAutoApply(settings: AutoApplySettings): Promise<void> {
    try {
      if (!settings.enabled || !settings.resumeId) {
        logger.info(`Skipping user ${settings.userId} - auto-apply disabled or no resume`);
        return;
      }

      logger.info(`Processing auto-apply for user ${settings.userId}`, {
        resumeId: settings.resumeId,
        criteria: settings.criteria,
      });

      // Check application limits
      const limits = await autoApplyService.checkApplicationLimits(
        settings.userId,
        settings.criteria.maxApplicationsPerDay,
        settings.criteria.maxApplicationsPerWeek
      );

      if (!limits.canApply) {
        logger.info(`User ${settings.userId} has reached application limits: ${limits.reason}`);
        return;
      }

      // Find matching jobs
      const matches = await autoApplyService.findMatchingJobs(
        settings.userId,
        settings.resumeId,
        settings.criteria
      );

      if (matches.length === 0) {
        logger.info(`No matching jobs found for user ${settings.userId}`);
        await autoApplyService.updateLastRun(settings.userId);
        return;
      }

      logger.info(`Found ${matches.length} matching jobs for user ${settings.userId}`);

      // Apply to jobs (respecting limits)
      let appliedCount = 0;
      const maxPerDay = settings.criteria.maxApplicationsPerDay || 10;
      const maxPerWeek = settings.criteria.maxApplicationsPerWeek || 50;

      for (const match of matches) {
        // Check if we've reached daily limit
        const currentLimits = await autoApplyService.checkApplicationLimits(
          settings.userId,
          maxPerDay,
          maxPerWeek
        );

        if (!currentLimits.canApply) {
          logger.info(`User ${settings.userId} reached limits after ${appliedCount} applications`);
          break;
        }

        try {
          // Generate cover letter if needed
          let coverLetter: string | undefined;
          if (settings.coverLetterTemplate) {
            coverLetter = await autoApplyService.generateCoverLetter(
              settings.resumeId,
              match.job,
              settings.coverLetterTemplate
            );
          }

          // Apply to job
          await autoApplyService.applyToJob(
            settings.userId,
            settings.resumeId,
            match.job,
            coverLetter
          );

          appliedCount++;
          logger.info(`Auto-applied to job ${match.job.id} for user ${settings.userId}`);

          // Small delay between applications to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Failed to apply to job ${match.job.id} for user ${settings.userId}`, error as Error);
          // Continue with next job
        }
      }

      // Update last run time
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + 1); // Next run in 1 hour
      await autoApplyService.updateLastRun(settings.userId, nextRun);

      logger.info(`Completed auto-apply for user ${settings.userId}: ${appliedCount} applications`);
    } catch (error) {
      logger.error(`Error processing auto-apply for user ${settings.userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Manually trigger auto-apply for a specific user (for testing)
   */
  public async triggerForUser(userId: string): Promise<void> {
    const settings = await autoApplyService.getSettings(userId);
    if (!settings || !settings.enabled) {
      throw new Error('Auto-apply not enabled for this user');
    }
    await this.processUserAutoApply(settings);
  }
}

export const autoApplySchedulerService = AutoApplySchedulerService.getInstance();

