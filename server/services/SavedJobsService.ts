import { db } from '../../db';
import { savedJobs, type SavedJob } from '../../db/schema-pg';
import { eq, and, desc } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('SavedJobsService');

export class SavedJobsService {
  /**
   * Save a job for a user
   */
  async saveJob(userId: string, jobData: {
    jobTitle: string;
    company?: string;
    location?: string;
    jobUrl?: string;
    jobId?: string;
    jobDescription?: string;
    matchPercentage?: number;
    matchedSkills?: string[];
    notes?: string;
  }): Promise<SavedJob> {
    try {
      // Check if job already saved
      if (jobData.jobId) {
        const existing = await db
          .select()
          .from(savedJobs)
          .where(and(
            eq(savedJobs.userId, userId),
            eq(savedJobs.jobId, jobData.jobId)
          ))
          .limit(1);

        if (existing.length > 0) {
          logger.info(`Job ${jobData.jobId} already saved for user ${userId}`);
          return existing[0];
        }
      }

      const [saved] = await db
        .insert(savedJobs)
        .values({
          userId,
          jobTitle: jobData.jobTitle,
          company: jobData.company || null,
          location: jobData.location || null,
          jobUrl: jobData.jobUrl || null,
          jobId: jobData.jobId || null,
          jobDescription: jobData.jobDescription || null,
          matchPercentage: jobData.matchPercentage || null,
          matchedSkills: jobData.matchedSkills || [],
          notes: jobData.notes || null,
        })
        .returning();

      logger.info(`Saved job "${jobData.jobTitle}" for user ${userId}`);
      return saved;
    } catch (error) {
      logger.error('Error saving job', error as Error);
      throw error;
    }
  }

  /**
   * Get all saved jobs for a user
   */
  async getSavedJobs(userId: string): Promise<SavedJob[]> {
    try {
      const jobs = await db
        .select()
        .from(savedJobs)
        .where(eq(savedJobs.userId, userId))
        .orderBy(desc(savedJobs.savedAt));

      return jobs;
    } catch (error) {
      logger.error('Error fetching saved jobs', error as Error);
      throw error;
    }
  }

  /**
   * Check if a job is saved
   */
  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    try {
      const [saved] = await db
        .select()
        .from(savedJobs)
        .where(and(
          eq(savedJobs.userId, userId),
          eq(savedJobs.jobId, jobId)
        ))
        .limit(1);

      return !!saved;
    } catch (error) {
      logger.error('Error checking if job is saved', error as Error);
      return false;
    }
  }

  /**
   * Remove a saved job
   */
  async removeSavedJob(userId: string, jobId: string): Promise<boolean> {
    try {
      await db
        .delete(savedJobs)
        .where(and(
          eq(savedJobs.userId, userId),
          eq(savedJobs.jobId, jobId)
        ));

      logger.info(`Removed saved job ${jobId} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error removing saved job', error as Error);
      throw error;
    }
  }

  /**
   * Update notes for a saved job
   */
  async updateJobNotes(userId: string, jobId: string, notes: string): Promise<SavedJob> {
    try {
      const [updated] = await db
        .update(savedJobs)
        .set({
          notes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(savedJobs.userId, userId),
          eq(savedJobs.jobId, jobId)
        ))
        .returning();

      if (!updated) {
        throw new Error('Job not found');
      }

      return updated;
    } catch (error) {
      logger.error('Error updating job notes', error as Error);
      throw error;
    }
  }
}

export const savedJobsService = new SavedJobsService();

