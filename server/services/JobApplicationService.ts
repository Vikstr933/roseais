import { db } from '../../db';
import { jobApplications, resumes } from '../../db/schema-pg';
import { eq, and, desc, sql, or, like, inArray } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';
import type { JobApplication, NewJobApplication } from '../../db/schema-pg';

const logger = new SimpleLogger('JobApplicationService');

export type ApplicationStatus = 'applied' | 'viewed' | 'interview' | 'rejected' | 'offer' | 'accepted' | 'declined';
export type ApplicationMethod = 'email' | 'form' | 'linkedin' | 'website' | 'manual';

export interface CreateApplicationInput {
  userId: string;
  resumeId?: number;
  jobTitle: string;
  companyName?: string;
  location?: string;
  applicationMethod?: ApplicationMethod;
  jobUrl?: string;
  recruiterEmail?: string;
  notes?: string;
  jobId?: number;
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  notes?: string;
  recruiterEmail?: string;
  emailSent?: boolean;
  emailOpened?: boolean;
  emailReplied?: boolean;
  interviewScheduled?: boolean;
  interviewDate?: Date;
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  byMethod: Record<ApplicationMethod, number>;
  recentApplications: number; // Last 30 days
  interviewRate: number; // Percentage
  offerRate: number; // Percentage
}

export class JobApplicationService {
  /**
   * Create a new job application
   */
  async createApplication(input: CreateApplicationInput): Promise<JobApplication> {
    try {
      logger.info(`Creating application for user ${input.userId}, job: ${input.jobTitle} at ${input.companyName}`);

      // Verify resume belongs to user if provided
      if (input.resumeId) {
        const [resume] = await db
          .select()
          .from(resumes)
          .where(and(eq(resumes.id, input.resumeId), eq(resumes.userId, input.userId)))
          .limit(1);

        if (!resume) {
          throw new Error(`Resume ${input.resumeId} not found or doesn't belong to user`);
        }
      }

      const newApplication: NewJobApplication = {
        userId: input.userId,
        resumeId: input.resumeId || null,
        jobId: input.jobId || null,
        status: 'applied',
        jobTitle: input.jobTitle,
        companyName: input.companyName || null,
        location: input.location || null,
        applicationMethod: input.applicationMethod || null,
        jobUrl: input.jobUrl || null,
        recruiterEmail: input.recruiterEmail || null,
        notes: input.notes || null,
      };

      const [application] = await db
        .insert(jobApplications)
        .values(newApplication)
        .returning();

      logger.info(`Created application ${application.id} for user ${input.userId}`);
      return application;
    } catch (error) {
      logger.error('Failed to create application', error as Error);
      throw error;
    }
  }

  /**
   * Get all applications for a user
   */
  async getUserApplications(
    userId: string,
    options?: {
      status?: ApplicationStatus;
      limit?: number;
      offset?: number;
      search?: string;
    }
  ): Promise<JobApplication[]> {
    try {
      const conditions = [eq(jobApplications.userId, userId)];

      if (options?.status) {
        conditions.push(eq(jobApplications.status, options.status));
      }

      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        conditions.push(
          or(
            like(jobApplications.jobTitle, searchTerm),
            like(jobApplications.companyName, searchTerm),
            like(jobApplications.location, searchTerm)
          )!
        );
      }

      const applications = await db
        .select()
        .from(jobApplications)
        .where(and(...conditions))
        .orderBy(desc(jobApplications.appliedAt))
        .limit(options?.limit || 100)
        .offset(options?.offset || 0);

      return applications;
    } catch (error) {
      logger.error('Failed to get user applications', error as Error);
      throw error;
    }
  }

  /**
   * Get a single application by ID
   */
  async getApplication(applicationId: number, userId: string): Promise<JobApplication | null> {
    try {
      const [application] = await db
        .select()
        .from(jobApplications)
        .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
        .limit(1);

      return application || null;
    } catch (error) {
      logger.error('Failed to get application', error as Error);
      throw error;
    }
  }

  /**
   * Update an application
   */
  async updateApplication(
    applicationId: number,
    userId: string,
    updates: UpdateApplicationInput
  ): Promise<JobApplication> {
    try {
      logger.info(`Updating application ${applicationId} for user ${userId}`);

      // Verify application belongs to user
      const existing = await this.getApplication(applicationId, userId);
      if (!existing) {
        throw new Error('Application not found or access denied');
      }

      const updateData: Partial<NewJobApplication> = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.recruiterEmail !== undefined) updateData.recruiterEmail = updates.recruiterEmail;
      if (updates.emailSent !== undefined) updateData.emailSent = updates.emailSent;
      if (updates.emailOpened !== undefined) {
        updateData.emailOpened = updates.emailOpened;
        if (updates.emailOpened) {
          updateData.emailOpenedAt = new Date();
        }
      }
      if (updates.emailReplied !== undefined) {
        updateData.emailReplied = updates.emailReplied;
        if (updates.emailReplied) {
          updateData.emailRepliedAt = new Date();
        }
      }
      if (updates.interviewScheduled !== undefined) updateData.interviewScheduled = updates.interviewScheduled;
      if (updates.interviewDate !== undefined) updateData.interviewDate = updates.interviewDate;

      const [updated] = await db
        .update(jobApplications)
        .set(updateData)
        .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
        .returning();

      logger.info(`Updated application ${applicationId}`);
      return updated;
    } catch (error) {
      logger.error('Failed to update application', error as Error);
      throw error;
    }
  }

  /**
   * Delete an application
   */
  async deleteApplication(applicationId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(jobApplications)
        .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
        .returning();

      return result.length > 0;
    } catch (error) {
      logger.error('Failed to delete application', error as Error);
      throw error;
    }
  }

  /**
   * Get statistics for a user's applications
   */
  async getApplicationStats(userId: string): Promise<ApplicationStats> {
    try {
      const allApplications = await this.getUserApplications(userId, { limit: 10000 });

      const stats: ApplicationStats = {
        total: allApplications.length,
        byStatus: {
          applied: 0,
          viewed: 0,
          interview: 0,
          rejected: 0,
          offer: 0,
          accepted: 0,
          declined: 0,
        },
        byMethod: {
          email: 0,
          form: 0,
          linkedin: 0,
          website: 0,
          manual: 0,
        },
        recentApplications: 0,
        interviewRate: 0,
        offerRate: 0,
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let interviewCount = 0;
      let offerCount = 0;

      for (const app of allApplications) {
        // Count by status
        if (app.status in stats.byStatus) {
          stats.byStatus[app.status as ApplicationStatus]++;
        }

        // Count by method
        if (app.applicationMethod && app.applicationMethod in stats.byMethod) {
          stats.byMethod[app.applicationMethod as ApplicationMethod]++;
        }

        // Count recent applications
        if (app.appliedAt && new Date(app.appliedAt) >= thirtyDaysAgo) {
          stats.recentApplications++;
        }

        // Count interviews and offers
        if (app.status === 'interview' || app.status === 'offer' || app.status === 'accepted') {
          interviewCount++;
        }
        if (app.status === 'offer' || app.status === 'accepted') {
          offerCount++;
        }
      }

      // Calculate rates
      if (allApplications.length > 0) {
        stats.interviewRate = Math.round((interviewCount / allApplications.length) * 100);
        stats.offerRate = Math.round((offerCount / allApplications.length) * 100);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get application stats', error as Error);
      throw error;
    }
  }

  /**
   * Get applications by resume
   */
  async getApplicationsByResume(resumeId: number, userId: string): Promise<JobApplication[]> {
    try {
      const applications = await db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.resumeId, resumeId),
            eq(jobApplications.userId, userId)
          )
        )
        .orderBy(desc(jobApplications.appliedAt));

      return applications;
    } catch (error) {
      logger.error('Failed to get applications by resume', error as Error);
      throw error;
    }
  }
}

export const jobApplicationService = new JobApplicationService();

