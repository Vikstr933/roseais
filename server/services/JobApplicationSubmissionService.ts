import { db } from '../../db';
import { jobApplications, resumes } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';
import type { ApplicationMethod } from './JobApplicationService';

const logger = new SimpleLogger('JobApplicationSubmissionService');

export interface SubmissionResult {
  success: boolean;
  method: ApplicationMethod;
  message?: string;
  error?: string;
  externalId?: string; // ID from external system (e.g., email message ID)
}

export class JobApplicationSubmissionService {
  /**
   * Submit a job application based on the application method
   */
  async submitApplication(
    userId: string,
    applicationId: number,
    method: ApplicationMethod,
    options?: {
      resumeId?: number;
      coverLetter?: string;
      recruiterEmail?: string;
      jobUrl?: string;
    }
  ): Promise<SubmissionResult> {
    try {
      logger.info(`Submitting application ${applicationId} for user ${userId} via ${method}`);

      // Get application from database
      const [application] = await db
        .select()
        .from(jobApplications)
        .where(and(
          eq(jobApplications.id, applicationId),
          eq(jobApplications.userId, userId)
        ))
        .limit(1);

      if (!application) {
        throw new Error('Application not found');
      }

      // Route to appropriate submission method
      switch (method) {
        case 'email':
          return await this.submitViaEmail(userId, application, options);
        
        case 'form':
        case 'website':
          return await this.submitViaWebsite(userId, application, options);
        
        case 'linkedin':
          return await this.submitViaLinkedIn(userId, application, options);
        
        case 'manual':
          return {
            success: true,
            method: 'manual',
            message: 'Application tracked manually - user will submit themselves',
          };
        
        default:
          throw new Error(`Unknown application method: ${method}`);
      }
    } catch (error) {
      logger.error('Error submitting application', error as Error);
      return {
        success: false,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit application via email
   */
  private async submitViaEmail(
    userId: string,
    application: typeof jobApplications.$inferSelect,
    options?: {
      resumeId?: number;
      coverLetter?: string;
      recruiterEmail?: string;
    }
  ): Promise<SubmissionResult> {
    try {
      const email = options?.recruiterEmail || application.recruiterEmail;
      
      if (!email) {
        throw new Error('No email address provided for application');
      }

      // Get Gmail plugin
      const { pluginRegistry } = await import('./PluginRegistry');
      const gmailPlugin = pluginRegistry.getPlugin('gmail');
      
      if (!gmailPlugin) {
        throw new Error('Gmail plugin not available. Please connect your Gmail account in settings.');
      }

      // Get resume text
      let resumeText = '';
      
      if (options?.resumeId || application.resumeId) {
        const resumeId = options?.resumeId || application.resumeId!;
        const [resume] = await db
          .select()
          .from(resumes)
          .where(eq(resumes.id, resumeId))
          .limit(1);

        if (resume) {
          resumeText = resume.rawText || '';
        }
      }

      // Build email content
      const coverLetter = options?.coverLetter || '';
      const subject = `Ansökan: ${application.jobTitle}${application.companyName ? ` vid ${application.companyName}` : ''}`;
      
      let emailBody = '';
      if (coverLetter) {
        emailBody = coverLetter;
      } else {
        // Default cover letter template
        emailBody = `Hej,

Jag är intresserad av positionen som ${application.jobTitle}${application.companyName ? ` hos ${application.companyName}` : ''}.

Jag har bifogat mitt CV för er granskning.

Med vänliga hälsningar`;
      }

      // Add resume text to email body
      if (resumeText) {
        emailBody += '\n\n---\nCV:\n\n' + resumeText;
      }

      // Send email via Gmail plugin
      // Note: Gmail plugin doesn't support attachments yet, so we include resume in body
      const result = await gmailPlugin.executeAction(userId, 'send_email', {
        to: email,
        subject: subject,
        body: emailBody,
      });

      // Update application in database
      await db
        .update(jobApplications)
        .set({
          emailSent: true,
          applicationMethod: 'email',
          recruiterEmail: email,
        })
        .where(eq(jobApplications.id, application.id));

      logger.info(`Application ${application.id} submitted via email to ${email}`);

      return {
        success: true,
        method: 'email',
        message: `Application sent via email to ${email}`,
        externalId: result.messageId,
      };
    } catch (error) {
      logger.error('Error submitting via email', error as Error);
      throw error;
    }
  }

  /**
   * Submit application via website/form
   * NOTE: This is a placeholder - full implementation would require web scraping/automation
   */
  private async submitViaWebsite(
    userId: string,
    application: typeof jobApplications.$inferSelect,
    options?: {
      jobUrl?: string;
    }
  ): Promise<SubmissionResult> {
    // For now, we just track that the application should be submitted via website
    // Full implementation would require:
    // - Web scraping to find form fields
    // - Form filling automation (Puppeteer/Playwright)
    // - File upload handling
    // - CAPTCHA solving (if needed)
    
    logger.info(`Application ${application.id} marked for website submission at ${options?.jobUrl || application.jobUrl}`);
    
    return {
      success: false,
      method: 'website',
      message: 'Website submission requires manual action. Please visit the job posting and submit your application.',
      error: 'Automated website submission not yet implemented. This feature requires web scraping and form automation.',
    };
  }

  /**
   * Submit application via LinkedIn
   * NOTE: This is a placeholder - requires LinkedIn API integration
   */
  private async submitViaLinkedIn(
    userId: string,
    application: typeof jobApplications.$inferSelect,
    options?: {}
  ): Promise<SubmissionResult> {
    // LinkedIn application requires:
    // - LinkedIn API access
    // - OAuth authentication
    // - Job posting ID from LinkedIn
    // - Profile data mapping
    
    logger.info(`Application ${application.id} marked for LinkedIn submission`);
    
    return {
      success: false,
      method: 'linkedin',
      message: 'LinkedIn submission requires manual action or LinkedIn API integration.',
      error: 'LinkedIn API integration not yet implemented.',
    };
  }

  /**
   * Check if user has required setup for a specific application method
   */
  async canSubmitViaMethod(userId: string, method: ApplicationMethod): Promise<boolean> {
    switch (method) {
      case 'email':
        // Check if Gmail plugin is connected
        try {
          const { pluginRegistry } = await import('./PluginRegistry');
          const gmailPlugin = pluginRegistry.getPlugin('gmail');
          if (!gmailPlugin) return false;
          
          // Check if user has Gmail configured
          const { pluginConfigs } = await import('../../db/schema-pg');
          const [config] = await db
            .select()
            .from(pluginConfigs)
            .where(and(
              eq(pluginConfigs.userId, userId),
              eq(pluginConfigs.pluginId, 'gmail'),
              eq(pluginConfigs.enabled, true)
            ))
            .limit(1);
          
          return !!config;
        } catch (error) {
          return false;
        }
      
      case 'form':
      case 'website':
        // Always available (but may require manual action)
        return true;
      
      case 'linkedin':
        // Check if LinkedIn plugin is connected (when implemented)
        return false;
      
      case 'manual':
        return true;
      
      default:
        return false;
    }
  }
}

export const jobApplicationSubmissionService = new JobApplicationSubmissionService();

