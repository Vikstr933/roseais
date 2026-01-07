import axios from 'axios';
import { SimpleLogger } from '../utils/SimpleLogger';
import { JobListing } from './JobMatchingService';

const logger = new SimpleLogger('ReedJobService');

export interface ReedJobSearchOptions {
  keywords: string;
  location?: string;
  limit?: number;
}

export class ReedJobService {
  private apiKey?: string;
  private baseUrl = 'https://www.reed.co.uk/api/1.0';
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.REED_API_KEY;
    this.enabled = process.env.ENABLE_REED === 'true' && !!this.apiKey;
    
    if (this.enabled) {
      logger.info('Reed Job Service enabled');
    } else {
      logger.info('Reed Job Service disabled (set REED_API_KEY and ENABLE_REED=true)');
    }
  }

  /**
   * Check if Reed is configured and enabled
   */
  isConfigured(): boolean {
    return this.enabled;
  }

  /**
   * Search for jobs using Reed API
   * Documentation: https://www.reed.co.uk/developers
   * API Reference: https://www.reed.co.uk/api/jobseeker/search
   */
  async searchJobs(options: ReedJobSearchOptions): Promise<JobListing[]> {
    if (!this.isConfigured()) {
      logger.warn('Reed not configured. Set REED_API_KEY and ENABLE_REED=true');
      return [];
    }

    try {
      const params: any = {
        keywords: options.keywords,
        resultsToTake: Math.min(options.limit || 50, 100), // Max 100 per request
      };

      if (options.location) {
        params.locationName = options.location;
        // Optional: Set distance from location (default is 10 miles)
        // params.distanceFromLocation = 10;
      }

      // Reed API uses Basic Auth with API key as username and empty password
      const response = await axios.get(`${this.baseUrl}/search`, {
        params,
        auth: {
          username: this.apiKey!,
          password: '', // Reed API uses empty password
        },
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      // Transform Reed API response to JobListing format
      const jobs = this.transformReedJobs(response.data);
      
      logger.info(`Reed API returned ${jobs.length} jobs`);
      return jobs;
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.warn('Reed API authentication failed. Check your API key.');
      } else if (error.response?.status === 429) {
        logger.warn('Reed API rate limit exceeded.');
      } else {
        logger.error('Failed to search Reed jobs', error as Error);
        if (error.response?.data) {
          logger.error('Reed API error response:', error.response.data);
        }
      }
      return [];
    }
  }

  /**
   * Get job details by job ID
   * Documentation: https://www.reed.co.uk/developers
   */
  async getJobDetails(jobId: string): Promise<JobListing | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/jobs/${jobId}`, {
        auth: {
          username: this.apiKey!,
          password: '',
        },
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      return this.transformReedJobDetail(response.data);
    } catch (error: any) {
      logger.error(`Failed to get Reed job details for ID ${jobId}`, error as Error);
      return null;
    }
  }

  /**
   * Transform Reed API search response to JobListing format
   * Response structure: Array of jobs with: jobId, employerId, employerName, jobTitle, description, locationName, minimumSalary, maximumSalary
   */
  private transformReedJobs(data: any): JobListing[] {
    // Reed API returns an array directly, not wrapped in a results object
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((job: any) => {
      // Extract location
      const location = job.locationName || '';

      // Extract description
      const description = job.description || '';

      // Extract required skills from description (Reed doesn't provide structured skills)
      const requiredSkills: string[] = [];
      if (description) {
        // Simple skill extraction (can be improved)
        const commonSkills = [
          'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', '.NET',
          'PHP', 'Ruby', 'Rust', 'Swift', 'Kotlin', 'Dart', 'Flutter', 'Vue.js', 'Angular',
          'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Git', 'Docker', 'AWS', 'Azure',
        ];
        
        const descLower = description.toLowerCase();
        commonSkills.forEach(skill => {
          if (descLower.includes(skill.toLowerCase())) {
            requiredSkills.push(skill);
          }
        });
      }

      // Build application URL - Reed jobs are accessed via reed.co.uk
      const applicationUrl = `https://www.reed.co.uk/jobs/${job.jobId}`;

      return {
        id: job.jobId?.toString() || '',
        title: job.jobTitle || '',
        company: job.employerName || '',
        location: location || undefined,
        description: description,
        url: applicationUrl,
        applicationUrl: applicationUrl,
        applicationMethod: 'url',
        requiredSkills: [...new Set(requiredSkills)], // Remove duplicates
        // Note: Reed API doesn't provide publication date in search results
      } as JobListing;
    });
  }

  /**
   * Transform Reed API job detail response to JobListing format
   * Response structure: Single job object with detailed information
   */
  private transformReedJobDetail(job: any): JobListing | null {
    if (!job || !job.jobId) {
      return null;
    }

    const description = job.jobDescription || '';

    // Extract required skills from description
    const requiredSkills: string[] = [];
    if (description) {
      const commonSkills = [
        'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', '.NET',
        'PHP', 'Ruby', 'Rust', 'Swift', 'Kotlin', 'Dart', 'Flutter', 'Vue.js', 'Angular',
        'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Git', 'Docker', 'AWS', 'Azure',
      ];
      
      const descLower = description.toLowerCase();
      commonSkills.forEach(skill => {
        if (descLower.includes(skill.toLowerCase())) {
          requiredSkills.push(skill);
        }
      });
    }

    const applicationUrl = job.externalUrl || job.url || `https://www.reed.co.uk/jobs/${job.jobId}`;

    return {
      id: job.jobId?.toString() || '',
      title: job.jobTitle || '',
      company: job.employerName || '',
      location: job.locationName || undefined,
      description: description,
      url: applicationUrl,
      applicationUrl: applicationUrl,
      applicationMethod: job.externalUrl ? 'url' : 'url',
      requiredSkills: [...new Set(requiredSkills)],
      publicationDate: job.expirationDate ? new Date(job.expirationDate).toISOString() : undefined,
    } as JobListing;
  }
}

export const reedJobService = new ReedJobService();

