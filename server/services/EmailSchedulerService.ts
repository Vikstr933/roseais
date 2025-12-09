import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { scheduledEmails } from '../../db/schema-pg';
import { eq, and, lte } from 'drizzle-orm';
import { GmailPlugin } from '../plugins/GmailPlugin';

const logger = new SimpleLogger('EmailSchedulerService');

export class EmailSchedulerService {
  private static instance: EmailSchedulerService;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
  private gmailPlugin: GmailPlugin | null = null;

  private constructor() {
    logger.info('EmailSchedulerService initialized');
  }

  public static getInstance(): EmailSchedulerService {
    if (!EmailSchedulerService.instance) {
      EmailSchedulerService.instance = new EmailSchedulerService();
    }
    return EmailSchedulerService.instance;
  }

  public setGmailPlugin(plugin: GmailPlugin): void {
    this.gmailPlugin = plugin;
  }

  /**
   * Start the scheduler service
   */
  public start(): void {
    if (this.checkInterval) {
      logger.warning('Email scheduler already running');
      return;
    }

    logger.info('Starting email scheduler service', {
      checkIntervalMs: this.CHECK_INTERVAL_MS
    });

    // Run immediately on start
    this.checkAndSendScheduledEmails().catch(error => {
      logger.error('Initial scheduled email check failed', error as Error);
    });

    // Then run on interval
    this.checkInterval = setInterval(() => {
      this.checkAndSendScheduledEmails().catch(error => {
        logger.error('Scheduled email check failed', error as Error);
      });
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduler service
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Email scheduler service stopped');
    }
  }

  /**
   * Schedule an email to be sent at a specific time
   */
  public async scheduleEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    scheduledFor: Date
  ): Promise<number> {
    try {
      const result = await db.insert(scheduledEmails).values({
        userId,
        to,
        subject,
        body,
        scheduledFor,
        sent: false
      }).returning({ id: scheduledEmails.id });

      const scheduledEmailId = result[0]?.id;
      if (!scheduledEmailId) {
        throw new Error('Failed to create scheduled email');
      }

      logger.info('Email scheduled', {
        userId,
        scheduledEmailId,
        to,
        scheduledFor: scheduledFor.toISOString()
      });

      return scheduledEmailId;
    } catch (error) {
      logger.error('Failed to schedule email', error as Error, { userId, to });
      throw error;
    }
  }

  /**
   * Check for scheduled emails that are due and send them
   */
  private async checkAndSendScheduledEmails(): Promise<void> {
    try {
      const now = new Date();

      // Find all unsent emails that are due
      const dueEmails = await db
        .select()
        .from(scheduledEmails)
        .where(
          and(
            eq(scheduledEmails.sent, false),
            lte(scheduledEmails.scheduledFor, now)
          )
        );

      if (dueEmails.length === 0) {
        return;
      }

      logger.info(`Found ${dueEmails.length} scheduled email(s) due for sending`);

      for (const email of dueEmails) {
        try {
          await this.sendScheduledEmail(email);
        } catch (error) {
          logger.error('Failed to send scheduled email', error as Error, {
            scheduledEmailId: email.id,
            userId: email.userId
          });

          // Update error in database
          await db
            .update(scheduledEmails)
            .set({
              error: error instanceof Error ? error.message : String(error)
            })
            .where(eq(scheduledEmails.id, email.id));
        }
      }
    } catch (error) {
      logger.error('Error checking scheduled emails', error as Error);
    }
  }

  /**
   * Send a scheduled email
   */
  private async sendScheduledEmail(email: typeof scheduledEmails.$inferSelect): Promise<void> {
    if (!this.gmailPlugin) {
      throw new Error('Gmail plugin not available');
    }

    logger.info('Sending scheduled email', {
      scheduledEmailId: email.id,
      userId: email.userId,
      to: email.to
    });

    try {
      // Use Gmail plugin to send the email
      await this.gmailPlugin.executeAction(email.userId, 'send_email', {
        to: email.to,
        subject: email.subject,
        body: email.body
      });

      // Mark as sent
      await db
        .update(scheduledEmails)
        .set({
          sent: true,
          sentAt: new Date(),
          error: null
        })
        .where(eq(scheduledEmails.id, email.id));

      logger.info('Scheduled email sent successfully', {
        scheduledEmailId: email.id,
        userId: email.userId
      });
    } catch (error) {
      logger.error('Failed to send scheduled email via Gmail plugin', error as Error, {
        scheduledEmailId: email.id
      });
      throw error;
    }
  }

  /**
   * Get scheduled emails for a user
   */
  public async getScheduledEmails(userId: string, includeSent = false): Promise<typeof scheduledEmails.$inferSelect[]> {
    try {
      const conditions = [eq(scheduledEmails.userId, userId)];
      if (!includeSent) {
        conditions.push(eq(scheduledEmails.sent, false));
      }

      return await db
        .select()
        .from(scheduledEmails)
        .where(and(...conditions))
        .orderBy(scheduledEmails.scheduledFor);
    } catch (error) {
      logger.error('Failed to get scheduled emails', error as Error, { userId });
      return [];
    }
  }

  /**
   * Cancel a scheduled email
   */
  public async cancelScheduledEmail(scheduledEmailId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(scheduledEmails)
        .where(
          and(
            eq(scheduledEmails.id, scheduledEmailId),
            eq(scheduledEmails.userId, userId),
            eq(scheduledEmails.sent, false)
          )
        );

      logger.info('Scheduled email cancelled', { scheduledEmailId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel scheduled email', error as Error, { scheduledEmailId, userId });
      return false;
    }
  }
}

export const emailSchedulerService = EmailSchedulerService.getInstance();

