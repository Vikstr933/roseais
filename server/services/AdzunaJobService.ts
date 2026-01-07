import axios from 'axios';
import { SimpleLogger } from '../utils/SimpleLogger';
import { JobListing } from './JobMatchingService';

const logger = new SimpleLogger('AdzunaJobService');

export interface AdzunaJobSearchOptions {
  keywords: string;
  location?: string;
  limit?: number;
  country?: string; // 'se' for Sweden
}

export class AdzunaJobService {
  private appId?: string;
  private appKey?: string;
  private baseUrl = 'https://api.adzuna.com/v1/api/jobs';
  private enabled: boolean;

  constructor() {
    this.appId = process.env.ADZUNA_APP_ID;
    this.appKey = process.env.ADZUNA_APP_KEY;
    this.enabled = process.env.ENABLE_ADZUNA === 'true' && !!this.appId && !!this.appKey;
    
    if (this.enabled) {
      logger.info('Adzuna Job Service enabled');
    } else {
      logger.info('Adzuna Job Service disabled (set ADZUNA_APP_ID, ADZUNA_APP_KEY, and ENABLE_ADZUNA=true)');
    }
  }

  /**
   * Check if Adzuna is configured and enabled
   */
  isConfigured(): boolean {
    return this.enabled;
  }

  /**
   * Search for jobs using Adzuna API
   * Documentation: https://developer.adzuna.com/
   */
  async searchJobs(options: AdzunaJobSearchOptions): Promise<JobListing[]> {
    if (!this.isConfigured()) {
      logger.warn('Adzuna not configured. Set ADZUNA_APP_ID, ADZUNA_APP_KEY, and ENABLE_ADZUNA=true');
      return [];
    }

    try {
      const country = options.country || 'se'; // Default to Sweden
      const apiUrl = `${this.baseUrl}/${country}/search/1`; // Page 1
      
      const params: any = {
        app_id: this.appId,
        app_key: this.appKey,
        results_per_page: Math.min(options.limit || 50, 50), // Max 50 per page
        what: options.keywords,
      };

      if (options.location) {
        params.where = options.location;
      }

      const response = await axios.get(apiUrl, {
        params,
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      // Transform Adzuna API response to JobListing format
      const jobs = this.transformAdzunaJobs(response.data);
      
      logger.info(`Adzuna API returned ${jobs.length} jobs`);
      return jobs;
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.warn('Adzuna API authentication failed. Check your API credentials.');
      } else if (error.response?.status === 429) {
        logger.warn('Adzuna API rate limit exceeded. Free tier allows 1000 requests/month.');
      } else {
        logger.error('Failed to search Adzuna jobs', error as Error);
      }
      return [];
    }
  }

  /**
   * Transform Adzuna API job data to JobListing format
   */
  private transformAdzunaJobs(data: any): JobListing[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((job: any) => {
      // Extract location
      let location = '';
      if (job.location) {
        const locationParts = [
          job.location.display_name,
          job.location.area,
          job.location.city,
        ].filter(Boolean);
        location = locationParts.join(', ');
      }

      // Extract description
      let description = '';
      if (job.description) {
        description = typeof job.description === 'string' 
          ? job.description 
          : job.description.text || '';
      }

      // Extract required skills from description (Adzuna doesn't provide structured skills)
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

      return {
        id: job.id?.toString() || '',
        title: job.title || '',
        company: job.company?.display_name || '',
        location: location || undefined,
        description: description,
        url: job.redirect_url || job.adref || '',
        applicationUrl: job.redirect_url || undefined,
        applicationMethod: job.redirect_url ? 'url' : 'other',
        requiredSkills: [...new Set(requiredSkills)], // Remove duplicates
        publicationDate: job.created ? new Date(job.created).toISOString() : undefined,
      } as JobListing;
    });
  }
}

export const adzunaJobService = new AdzunaJobService();

