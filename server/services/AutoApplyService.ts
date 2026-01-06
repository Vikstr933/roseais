import { db } from '../../db';
import { jobApplications, resumes, autoApplySettings } from '../../db/schema-pg';
import { eq, and, gte, lte } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';
import { jobMatchingService } from './JobMatchingService';
import { jobApplicationService } from './JobApplicationService';
import { resumeAdaptationService } from './ResumeAdaptationService';
import type { JobListing, JobMatch } from './JobMatchingService';

const logger = new SimpleLogger('AutoApplyService');

export interface AutoApplyCriteria {
  minMatchPercentage: number; // Minimum match percentage (e.g., 80)
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  companyTypes?: string[];
  excludeCompanies?: string[];
  jobTypes?: string[]; // 'fulltime', 'parttime', 'consultant'
  industries?: string[];
  experienceLevel?: string; // 'junior', 'mid', 'senior', 'lead'
}

export interface AutoApplySettings {
  userId: string;
  enabled: boolean;
  criteria: AutoApplyCriteria;
  maxApplicationsPerDay?: number;
  maxApplicationsPerWeek?: number;
  requireConfirmation: boolean; // If true, show jobs for review before applying
  resumeId: number; // Which resume to use for applications
  coverLetterTemplate?: string;
}

export class AutoApplyService {
  /**
   * Find matching jobs based on criteria
   */
  async findMatchingJobs(
    userId: string,
    resumeId: number,
    criteria: AutoApplyCriteria
  ): Promise<JobMatch[]> {
    try {
      // Get resume
      const [resume] = await db
        .select()
        .from(resumes)
        .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
        .limit(1);

      if (!resume) {
        throw new Error('Resume not found');
      }

      // Search for jobs from multiple sources
      const keywords = this.extractKeywordsFromResume(resume.rawText || '');
      
      // Determine which sources to search
      const sources = ['jobtech']; // Always search JobTech
      // LinkedIn integration is temporarily disabled
      // if (process.env.ENABLE_LINKEDIN_JOBS === 'true') {
      //   sources.push('linkedin');
      // }
      
      const jobs = await jobMatchingService.searchJobs(
        keywords,
        criteria.location,
        100, // Get more jobs to filter
        sources // Search from both JobTech and LinkedIn if enabled
      );

      // Match resume to jobs
      const matches = await jobMatchingService.matchResumeToJobs(resume, jobs);

      // Filter by criteria
      const filteredMatches = matches.filter(match => {
        // Match percentage filter
        if (match.matchPercentage < criteria.minMatchPercentage) {
          return false;
        }

        // Location filter
        if (criteria.location && match.job.location) {
          if (!match.job.location.toLowerCase().includes(criteria.location.toLowerCase())) {
            return false;
          }
        }

        // Exclude companies
        if (criteria.excludeCompanies && match.job.company) {
          const companyLower = match.job.company.toLowerCase();
          if (criteria.excludeCompanies.some(ex => companyLower.includes(ex.toLowerCase()))) {
            return false;
          }
        }

        // TODO: Add more filters (salary, job type, industry, experience level)

        return true;
      });

      // Sort by match percentage (highest first)
      filteredMatches.sort((a, b) => b.matchPercentage - a.matchPercentage);

      logger.info(`Found ${filteredMatches.length} matching jobs for user ${userId}`);
      return filteredMatches;
    } catch (error) {
      logger.error('Error finding matching jobs', error as Error);
      throw error;
    }
  }

  /**
   * Apply to a job automatically
   */
  async applyToJob(
    userId: string,
    resumeId: number,
    job: JobListing,
    coverLetter?: string
  ): Promise<any> {
    try {
      // Check if already applied
      const existing = await db
        .select()
        .from(jobApplications)
        .where(and(
          eq(jobApplications.userId, userId),
          eq(jobApplications.jobId, parseInt(job.id) || 0)
        ))
        .limit(1);

      if (existing.length > 0) {
        logger.info(`User ${userId} already applied to job ${job.id}`);
        return existing[0];
      }

      // Create application
      const application = await jobApplicationService.createApplication({
        userId,
        resumeId,
        jobTitle: job.title,
        companyName: job.company,
        location: job.location,
        jobUrl: job.url,
        applicationMethod: (job.applicationMethod as any) || 'manual',
        jobId: parseInt(job.id) || undefined,
        recruiterEmail: job.applicationEmail,
      });

      // Actually submit the application if method is email
      const applicationMethod = (job.applicationMethod as any) || 'manual';
      if (applicationMethod === 'email' && job.applicationEmail) {
        try {
          const { jobApplicationSubmissionService } = await import('./JobApplicationSubmissionService');
          const submissionResult = await jobApplicationSubmissionService.submitApplication(
            userId,
            application.id,
            'email',
            {
              resumeId,
              coverLetter,
              recruiterEmail: job.applicationEmail,
            }
          );

          if (submissionResult.success) {
            logger.info(`Application ${application.id} successfully submitted via email`);
          } else {
            logger.warn(`Failed to submit application ${application.id} via email: ${submissionResult.error}`);
          }
        } catch (error) {
          logger.error(`Error submitting application ${application.id} via email`, error as Error);
          // Don't throw - application is still tracked in database
        }
      }

      logger.info(`Auto-applied to job ${job.id} for user ${userId}`);
      return application;
    } catch (error) {
      logger.error('Error applying to job', error as Error);
      throw error;
    }
  }

  /**
   * Generate cover letter for a job
   */
  async generateCoverLetter(
    resumeId: number,
    job: JobListing,
    template?: string
  ): Promise<string> {
    try {
      // TODO: Implement AI cover letter generation
      // For now, return a basic template
      return `Hej,

Jag är intresserad av positionen som ${job.title} hos ${job.company}.

Baserat på min erfarenhet och färdigheter tror jag att jag skulle vara en bra match för denna roll.

Med vänliga hälsningar`;
    } catch (error) {
      logger.error('Error generating cover letter', error as Error);
      throw error;
    }
  }

  /**
   * Adapt resume for a specific job
   */
  async adaptResumeForJob(
    resumeId: number,
    job: JobListing
  ): Promise<string> {
    try {
      // Use existing ResumeAdaptationService
      const [resume] = await db
        .select()
        .from(resumes)
        .where(eq(resumes.id, resumeId))
        .limit(1);

      if (!resume) {
        throw new Error('Resume not found');
      }

      const adapted = await resumeAdaptationService.adaptResumeToJob(
        resume.rawText || '',
        {}, // parsedData - can be empty for now
        job.title,
        job.description || '',
        job.requiredSkills || [],
        []
      );

      return adapted.rawText;
    } catch (error) {
      logger.error('Error adapting resume', error as Error);
      throw error;
    }
  }

  /**
   * Extract keywords from resume text
   */
  private extractKeywordsFromResume(resumeText: string): string {
    // Simple keyword extraction - can be improved with NLP
    const words = resumeText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4) // Filter short words
      .filter(word => !['och', 'med', 'för', 'som', 'är', 'var', 'har', 'kan'].includes(word)); // Filter common Swedish words

    // Get most common words (simple approach)
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return sortedWords.join(' ');
  }

  /**
   * Get auto-apply settings for a user
   */
  async getSettings(userId: string): Promise<AutoApplySettings | null> {
    try {
      const [settings] = await db
        .select()
        .from(autoApplySettings)
        .where(eq(autoApplySettings.userId, userId))
        .limit(1);

      if (!settings) {
        return null;
      }

      return {
        userId: settings.userId,
        enabled: settings.enabled,
        criteria: (settings.criteria as any) || { minMatchPercentage: 80 },
        requireConfirmation: settings.requireConfirmation,
        resumeId: settings.resumeId || undefined,
        coverLetterTemplate: settings.coverLetterTemplate || undefined,
        maxApplicationsPerDay: (settings.criteria as any)?.maxApplicationsPerDay,
        maxApplicationsPerWeek: (settings.criteria as any)?.maxApplicationsPerWeek,
      };
    } catch (error) {
      logger.error('Error getting auto-apply settings', error as Error);
      return null;
    }
  }

  /**
   * Save auto-apply settings for a user
   */
  async saveSettings(settings: AutoApplySettings): Promise<AutoApplySettings> {
    try {
      const existing = await db
        .select()
        .from(autoApplySettings)
        .where(eq(autoApplySettings.userId, settings.userId))
        .limit(1);

      const settingsData = {
        userId: settings.userId,
        resumeId: settings.resumeId || null,
        enabled: settings.enabled,
        criteria: settings.criteria as any,
        requireConfirmation: settings.requireConfirmation,
        coverLetterTemplate: settings.coverLetterTemplate || null,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(autoApplySettings)
          .set(settingsData)
          .where(eq(autoApplySettings.userId, settings.userId))
          .returning();

        logger.info(`Updated auto-apply settings for user ${settings.userId}`);
        return {
          userId: updated.userId,
          enabled: updated.enabled,
          criteria: (updated.criteria as any) || { minMatchPercentage: 80 },
          requireConfirmation: updated.requireConfirmation,
          resumeId: updated.resumeId || undefined,
          coverLetterTemplate: updated.coverLetterTemplate || undefined,
          maxApplicationsPerDay: (updated.criteria as any)?.maxApplicationsPerDay,
          maxApplicationsPerWeek: (updated.criteria as any)?.maxApplicationsPerWeek,
        };
      } else {
        // Create new
        const [created] = await db
          .insert(autoApplySettings)
          .values(settingsData)
          .returning();

        logger.info(`Created auto-apply settings for user ${settings.userId}`);
        return {
          userId: created.userId,
          enabled: created.enabled,
          criteria: (created.criteria as any) || { minMatchPercentage: 80 },
          requireConfirmation: created.requireConfirmation,
          resumeId: created.resumeId || undefined,
          coverLetterTemplate: created.coverLetterTemplate || undefined,
          maxApplicationsPerDay: (created.criteria as any)?.maxApplicationsPerDay,
          maxApplicationsPerWeek: (created.criteria as any)?.maxApplicationsPerWeek,
        };
      }
    } catch (error) {
      logger.error('Error saving auto-apply settings', error as Error);
      throw error;
    }
  }

  /**
   * Get all enabled auto-apply settings (for scheduler)
   */
  async getAllEnabledSettings(): Promise<AutoApplySettings[]> {
    try {
      const allSettings = await db
        .select()
        .from(autoApplySettings)
        .where(eq(autoApplySettings.enabled, true));

      return allSettings.map(settings => ({
        userId: settings.userId,
        enabled: settings.enabled,
        criteria: (settings.criteria as any) || { minMatchPercentage: 80 },
        requireConfirmation: settings.requireConfirmation,
        resumeId: settings.resumeId || undefined,
        coverLetterTemplate: settings.coverLetterTemplate || undefined,
        maxApplicationsPerDay: (settings.criteria as any)?.maxApplicationsPerDay,
        maxApplicationsPerWeek: (settings.criteria as any)?.maxApplicationsPerWeek,
      }));
    } catch (error) {
      logger.error('Error getting all enabled settings', error as Error);
      return [];
    }
  }

  /**
   * Update last run time for a user's settings
   */
  async updateLastRun(userId: string, nextRunAt?: Date): Promise<void> {
    try {
      await db
        .update(autoApplySettings)
        .set({
          lastRunAt: new Date(),
          nextRunAt: nextRunAt || null,
          updatedAt: new Date(),
        })
        .where(eq(autoApplySettings.userId, userId));
    } catch (error) {
      logger.error('Error updating last run time', error as Error);
    }
  }

  /**
   * Check daily/weekly application limits
   */
  async checkApplicationLimits(
    userId: string,
    maxPerDay?: number,
    maxPerWeek?: number
  ): Promise<{ canApply: boolean; reason?: string }> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Count applications today
      if (maxPerDay) {
        const todayCount = await db
          .select()
          .from(jobApplications)
          .where(and(
            eq(jobApplications.userId, userId),
            gte(jobApplications.appliedAt, today)
          ));

        if (todayCount.length >= maxPerDay) {
          return {
            canApply: false,
            reason: `Du har nått din dagliga gräns på ${maxPerDay} ansökningar`,
          };
        }
      }

      // Count applications this week
      if (maxPerWeek) {
        const weekCount = await db
          .select()
          .from(jobApplications)
          .where(and(
            eq(jobApplications.userId, userId),
            gte(jobApplications.appliedAt, weekAgo)
          ));

        if (weekCount.length >= maxPerWeek) {
          return {
            canApply: false,
            reason: `Du har nått din veckovisa gräns på ${maxPerWeek} ansökningar`,
          };
        }
      }

      return { canApply: true };
    } catch (error) {
      logger.error('Error checking application limits', error as Error);
      return { canApply: true }; // Allow on error
    }
  }
}

export const autoApplyService = new AutoApplyService();

