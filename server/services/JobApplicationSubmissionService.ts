import { db } from '../../db';
import { jobApplications, resumes } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';
import { resumePDFService } from './ResumePDFService';
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

      // Get resume text and generate PDF
      let resumeText = '';
      let pdfAttachment: Buffer | null = null;
      
      if (options?.resumeId || application.resumeId) {
        const resumeId = options?.resumeId || application.resumeId!;
        const [resume] = await db
          .select()
          .from(resumes)
          .where(eq(resumes.id, resumeId))
          .limit(1);

        if (resume) {
          resumeText = resume.rawText || '';
          
          // Generate PDF attachment
          try {
            // Extract structured data from resume text
            const parsedData = resume.parsedData as any;
            const structuredData = await resumePDFService.extractStructuredData(
              resumeText,
              parsedData,
              resume.filename
            );
            
            // Generate PDF
            pdfAttachment = await resumePDFService.generatePDF(structuredData, {
              template: 'modern',
              format: 'A4',
            });
            
            logger.info(`Generated PDF attachment for application ${application.id}`);
          } catch (error) {
            logger.warn(`Failed to generate PDF for application ${application.id}, sending as text only`, error as Error);
            // Continue without PDF attachment
          }
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

      // Add resume text to email body only if no PDF attachment
      if (!pdfAttachment && resumeText) {
        emailBody += '\n\n---\nCV:\n\n' + resumeText;
      }

      // Prepare attachments
      const attachments = pdfAttachment ? [{
        filename: `CV_${application.jobTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.pdf`,
        content: pdfAttachment.toString('base64'),
        contentType: 'application/pdf',
      }] : undefined;

      // Send email via Gmail plugin with PDF attachment
      const result = await gmailPlugin.executeAction(userId, 'send_email', {
        to: email,
        subject: subject,
        body: emailBody,
        attachments: attachments,
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
   * NOTE: This requires manual action - full automation would require web scraping/automation
   */
  private async submitViaWebsite(
    userId: string,
    application: typeof jobApplications.$inferSelect,
    options?: {
      jobUrl?: string;
    }
  ): Promise<SubmissionResult> {
    // Website/form submission requires manual action
    // Full automation would require:
    // - Web scraping to find form fields
    // - Form filling automation (Puppeteer/Playwright)
    // - File upload handling
    // - CAPTCHA solving (if needed)
    
    const jobUrl = options?.jobUrl || application.jobUrl;
    logger.info(`Application ${application.id} tracked for website submission at ${jobUrl}`);
    
    // Update application to indicate it needs manual submission
    await db
      .update(jobApplications)
      .set({
        applicationMethod: 'website',
        notes: jobUrl ? `Ansökan spårad. Besök ${jobUrl} för att ansöka manuellt.` : 'Ansökan spårad. Ansök manuellt via företagets webbplats.',
      })
      .where(eq(jobApplications.id, application.id));
    
    return {
      success: true,
      method: 'website',
      message: jobUrl 
        ? `Ansökan har sparats. Besök ${jobUrl} för att ansöka manuellt via företagets webbplats.`
        : 'Ansökan har sparats. Ansök manuellt via företagets webbplats.',
    };
  }

  /**
   * Submit application via LinkedIn
   * NOTE: This requires manual action - LinkedIn API integration not yet implemented
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
    
    logger.info(`Application ${application.id} tracked for LinkedIn submission`);
    
    // Update application to indicate it needs manual submission
    await db
      .update(jobApplications)
      .set({
        applicationMethod: 'linkedin',
        notes: 'Ansökan spårad. Ansök manuellt via LinkedIn.',
      })
      .where(eq(jobApplications.id, application.id));
    
    return {
      success: true,
      method: 'linkedin',
      message: 'Ansökan har sparats. Ansök manuellt via LinkedIn när du är redo.',
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

