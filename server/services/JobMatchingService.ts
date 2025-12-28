import axios from 'axios';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('JobMatchingService');

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  applicationEmail?: string; // Email for application
  applicationUrl?: string; // Direct application URL
  applicationMethod?: string; // 'url', 'email', 'via_af', or 'other'
  requiredSkills?: string[];
  coordinates?: number[]; // [latitude, longitude] for mapping
  publicationDate?: string;
  applicationDeadline?: string;
}

export interface JobMatch {
  job: JobListing;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export class JobMatchingService {
  private jobTechBaseUrl = 'https://jobsearch.api.jobtechdev.se/search';

  constructor() {
    // JobTech API requires no API key for basic searches
  }

  /**
   * Search for Swedish jobs using JobTech API
   * API Documentation: https://jobtechdev.se/
   */
  async searchJobs(keywords: string, location?: string, limit: number = 100): Promise<JobListing[]> {
    try {
      // JobTech API params
      const params: any = {
        q: keywords,
        limit: Math.min(limit, 100), // Max 100 per request
      };

      // Location can be added to query if needed
      if (location) {
        params.q = `${keywords} ${location}`;
      }

      const response = await axios.get(this.jobTechBaseUrl, {
        params,
        headers: {
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      // Transform JobTech API response to our format
      // Response structure: { total: { value: number }, hits: Array }
      const hits = response.data.hits || [];
      
      // Use transformHitToJobListing helper method
      const jobs: JobListing[] = hits.map((hit: any) => this.transformHitToJobListing(hit));

      return jobs;
    } catch (error) {
      logger.error('Failed to search jobs', error as Error);
      return [];
    }
  }

  /**
   * Get total number of job matches (without fetching all jobs)
   */
  async getJobCount(keywords: string, location?: string): Promise<number> {
    try {
      const params: any = {
        q: keywords,
        limit: 0, // limit: 0 returns no ads, just the total count
      };

      if (location) {
        params.q = `${keywords} ${location}`;
      }

      const response = await axios.get(this.jobTechBaseUrl, {
        params,
        headers: {
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      return response.data.total?.value || 0;
    } catch (error) {
      logger.error('Failed to get job count', error as Error);
      return 0;
    }
  }

  /**
   * Search jobs with pagination support
   */
  async searchJobsPaginated(
    keywords: string,
    options?: {
      location?: string;
      limit?: number;
      offset?: number;
      remote?: boolean;
      occupationField?: string; // Taxonomy conceptId
      municipality?: string; // Municipality code or conceptId
      region?: string; // Region code or conceptId
    }
  ): Promise<{ jobs: JobListing[]; total: number; offset: number }> {
    try {
      const params: any = {
        q: keywords,
        limit: Math.min(options?.limit || 100, 100),
        offset: options?.offset || 0,
      };

      // Add location to query if specified
      if (options?.location) {
        params.q = `${keywords} ${options.location}`;
      }

      // Add filters
      if (options?.remote) {
        params.remote = 'true';
      }
      if (options?.occupationField) {
        params['occupation-field'] = options.occupationField;
      }
      if (options?.municipality) {
        params.municipality = options.municipality;
      }
      if (options?.region) {
        params.region = options.region;
      }

      const response = await axios.get(this.jobTechBaseUrl, {
        params,
        headers: {
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      const hits = response.data.hits || [];
      const total = response.data.total?.value || 0;

      // Transform hits to JobListing format using helper method
      const jobs: JobListing[] = hits.map((hit: any) => this.transformHitToJobListing(hit));

      return {
        jobs,
        total,
        offset: options?.offset || 0,
      };
    } catch (error) {
      logger.error('Failed to search jobs with pagination', error as Error);
      return { jobs: [], total: 0, offset: 0 };
    }
  }

  /**
   * Transform a JobTech API hit to JobListing format
   */
  private transformHitToJobListing(hit: any): JobListing {
    // Extract description
    let description = '';
    if (hit.description) {
      if (typeof hit.description === 'string') {
        description = hit.description;
      } else if (hit.description.text) {
        description = hit.description.text;
      } else if (hit.description.text_formatted) {
        description = hit.description.text_formatted;
      }
    }

    // Extract location
    let location = '';
    if (hit.workplace_address) {
      const addr = hit.workplace_address;
      const locationParts = [
        addr.street_address,
        addr.postcode,
        addr.city,
        addr.municipality,
        addr.region,
      ].filter(Boolean);
      location = locationParts.join(', ');
    }

    // Extract application URL and email
    let jobUrl = '';
    let applicationEmail = '';
    let applicationUrl = '';
    let applicationMethod = 'other';

    if (hit.application_details?.url) {
      applicationUrl = hit.application_details.url;
      jobUrl = applicationUrl;
      applicationMethod = 'url';
    } else if (hit.webpage_url) {
      jobUrl = hit.webpage_url;
      applicationUrl = hit.webpage_url;
      applicationMethod = 'url';
    }

    if (hit.application_details?.email) {
      applicationEmail = hit.application_details.email;
      if (!applicationUrl) {
        applicationMethod = 'email';
      }
    }

    if (hit.application_details?.via_af) {
      applicationMethod = 'via_af';
    }

    // Extract required skills from must_have and nice_to_have
    const requiredSkills: string[] = [];
    
    if (hit.must_have?.skills) {
      hit.must_have.skills.forEach((skill: any) => {
        if (skill.namn) requiredSkills.push(skill.namn);
        if (skill.label) requiredSkills.push(skill.label);
      });
    }
    
    if (hit.nice_to_have?.skills) {
      hit.nice_to_have.skills.forEach((skill: any) => {
        if (skill.namn) requiredSkills.push(skill.namn);
        if (skill.label) requiredSkills.push(skill.label);
      });
    }
    
    // Fallback: extract from description
    if (requiredSkills.length === 0) {
      const extractedSkills = this.extractSkills(description);
      requiredSkills.push(...extractedSkills);
    }

    return {
      id: hit.id || hit.external_id || '',
      title: hit.headline || '',
      company: hit.employer?.name || '',
      location: location,
      description: description,
      url: jobUrl,
      applicationEmail: applicationEmail || undefined,
      applicationUrl: applicationUrl || jobUrl,
      applicationMethod: applicationMethod,
      requiredSkills: [...new Set(requiredSkills)],
      coordinates: hit.workplace_address?.coordinates,
      publicationDate: hit.publication_date,
      applicationDeadline: hit.application_deadline,
    };
  }

  /**
   * Match resume against job listings
   */
  async matchResumeToJobs(
    resumeText: string,
    resumeSkills: string[],
    jobs: JobListing[]
  ): Promise<JobMatch[]> {
    const matches: JobMatch[] = [];

    for (const job of jobs) {
      const match = this.calculateMatch(resumeText, resumeSkills, job);
      matches.push({
        job,
        ...match,
      });
    }

    // Sort by match percentage (highest first)
    return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  private calculateMatch(
    resumeText: string,
    resumeSkills: string[],
    job: JobListing
  ): { matchPercentage: number; matchedSkills: string[]; missingSkills: string[] } {
    // Use structured skills from JobTech API if available, otherwise extract from description
    const jobSkills = job.requiredSkills && job.requiredSkills.length > 0
      ? job.requiredSkills
      : this.extractSkills(job.description);

    if (jobSkills.length === 0) {
      // If no skills found, use keyword overlap only
      const keywordOverlap = this.calculateKeywordOverlap(resumeText, job.description);
      return {
        matchPercentage: Math.round(keywordOverlap * 100),
        matchedSkills: [],
        missingSkills: [],
      };
    }

    // Normalize skills for comparison
    const normalize = (skill: string) => skill.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const normalizedResumeSkills = resumeSkills.map(normalize);
    const normalizedJobSkills = jobSkills.map(normalize);

    // Find matched skills (fuzzy matching)
    const matchedSkills: string[] = [];
    normalizedJobSkills.forEach((jobSkill, index) => {
      const matched = normalizedResumeSkills.some(resumeSkill => {
        // Exact match
        if (resumeSkill === jobSkill) return true;
        // Contains match (e.g., "javascript" matches "javascript developer")
        if (resumeSkill.includes(jobSkill) || jobSkill.includes(resumeSkill)) return true;
        // Word boundary match for common variations
        const jobWords = jobSkill.split(/\s+/);
        const resumeWords = resumeSkill.split(/\s+/);
        return jobWords.some(word => resumeWords.includes(word));
      });
      
      if (matched) {
        matchedSkills.push(jobSkills[index]); // Use original skill name
      }
    });

    // Find missing skills
    const missingSkills = jobSkills.filter((skill, index) => 
      !matchedSkills.includes(skill)
    );

    // Calculate match percentage
    // Based on: skill overlap (70%) + keyword overlap in description (30%)
    const skillMatchRatio = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0;
    const keywordOverlap = this.calculateKeywordOverlap(resumeText, job.description);

    const matchPercentage = Math.round(
      skillMatchRatio * 70 + keywordOverlap * 30
    );

    return {
      matchPercentage: Math.min(100, Math.max(0, matchPercentage)), // Clamp 0-100
      matchedSkills: [...new Set(matchedSkills)], // Remove duplicates
      missingSkills: [...new Set(missingSkills)],
    };
  }

  private extractSkills(text: string): string[] {
    // Common Swedish IT/tech skills (svenska och engelska)
    const commonSkills = [
      // Programming languages
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', '.NET',
      'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'Dart', 'Flutter',
      // Frameworks & Libraries
      'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Express', 'Django', 'Flask',
      'Spring', 'Laravel', 'Symfony', 'ASP.NET',
      // Databases
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
      // Tools & DevOps
      'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Jenkins',
      'Terraform', 'Ansible', 'Linux', 'Unix',
      // Methodologies
      'Agile', 'Scrum', 'Kanban', 'DevOps', 'TDD', 'BDD',
      // Soft skills (på svenska och engelska)
      'Project Management', 'Leadership', 'Communication', 'Problem Solving',
      'Teamwork', 'Projektledning', 'Ledarskap', 'Kommunikation',
      'Problemlösning', 'Teamarbete',
      // Languages
      'Swedish', 'English', 'Svenska', 'Engelska'
    ];

    const textLower = text.toLowerCase();
    const foundSkills = commonSkills.filter(skill =>
      textLower.includes(skill.toLowerCase())
    );

    return foundSkills;
  }

  private calculateKeywordOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

export const jobMatchingService = new JobMatchingService();

