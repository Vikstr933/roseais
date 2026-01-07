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
  private baseUrl = 'https://www.reed.co.uk/api/1.0/search';
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
      }

      // Reed API uses Basic Auth with API key as username and empty password
      const response = await axios.get(this.baseUrl, {
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
      }
      return [];
    }
  }

  /**
   * Transform Reed API job data to JobListing format
   */
  private transformReedJobs(data: any): JobListing[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((job: any) => {
      // Extract location
      let location = '';
      if (job.locationName) {
        location = job.locationName;
      }

      // Extract description
      let description = '';
      if (job.jobDescription) {
        description = typeof job.jobDescription === 'string' 
          ? job.jobDescription 
          : '';
      }

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

      // Build application URL
      const applicationUrl = job.jobUrl || `https://www.reed.co.uk/jobs/${job.jobId}`;

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
        publicationDate: job.date ? new Date(job.date).toISOString() : undefined,
      } as JobListing;
    });
  }
}

export const reedJobService = new ReedJobService();

