import axios from 'axios';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('JobMatchingService');

// JobTech API response types
interface JobTechApiResponse {
  total?: {
    value: number;
  };
  hits?: any[];
}

export interface JobRequirements {
  drivingLicense?: string; // e.g., "B", "BE", "CE", etc.
  drivingLicenseRequired?: boolean;
  accessToOwnCar?: boolean;
  experienceRequired?: boolean;
  languages?: Array<{ language: string; level?: string }>;
  education?: string[];
  certifications?: string[];
  otherRequirements?: string[]; // Other specific requirements mentioned in description
}

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
  requirements?: JobRequirements;
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
  private useLinkedIn: boolean;

  constructor() {
    // JobTech API requires no API key for basic searches
    // LinkedIn integration is temporarily disabled
    this.useLinkedIn = false; // Disabled: process.env.ENABLE_LINKEDIN_JOBS === 'true';
  }

  /**
   * Search for jobs from multiple sources (JobTech and optionally LinkedIn)
   * API Documentation: https://jobtechdev.se/
   */
  async searchJobs(keywords: string, location?: string, limit: number = 100, sources?: string[]): Promise<JobListing[]> {
    try {
      const allJobs: JobListing[] = [];
      const searchSources = sources || ['jobtech']; // Default to JobTech only

      // Search JobTech (Swedish jobs)
      if (searchSources.includes('jobtech')) {
        const jobTechJobs = await this.searchJobsFromJobTech(keywords, location, limit);
        allJobs.push(...jobTechJobs);
        logger.info(`[JobMatchingService] JobTech returned ${jobTechJobs.length} jobs`);
      }

      // Search LinkedIn (if enabled and configured)
      if (searchSources.includes('linkedin') && this.useLinkedIn) {
        try {
          const { linkedInJobService } = await import('./LinkedInJobService');
          if (linkedInJobService.isConfigured()) {
            const linkedInJobs = await linkedInJobService.searchJobs({
              keywords,
              location,
              limit: Math.min(limit, 25), // LinkedIn typically limits to 25
            });
            allJobs.push(...linkedInJobs);
            logger.info(`[JobMatchingService] LinkedIn returned ${linkedInJobs.length} jobs`);
          } else {
            logger.warn('[JobMatchingService] LinkedIn not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.');
          }
        } catch (error) {
          logger.error('[JobMatchingService] LinkedIn search failed', error as Error);
          // Continue with JobTech results even if LinkedIn fails
        }
      }

      // Remove duplicates based on job title + company
      const uniqueJobs = this.removeDuplicateJobs(allJobs);
      
      // Sort by relevance (could be improved with better ranking)
      uniqueJobs.sort((a, b) => {
        // Prioritize jobs with application methods
        if (a.applicationMethod && !b.applicationMethod) return -1;
        if (!a.applicationMethod && b.applicationMethod) return 1;
        return 0;
      });

      // Limit results
      return uniqueJobs.slice(0, limit);
    } catch (error) {
      logger.error('Failed to search jobs', error as Error);
      return [];
    }
  }

  /**
   * Search for Swedish jobs using JobTech API
   * API Documentation: https://jobtechdev.se/
   */
  private async searchJobsFromJobTech(keywords: string, location?: string, limit: number = 100): Promise<JobListing[]> {
    try {
      // Simplify keywords - take first 2-3 keywords to avoid too specific searches
      const keywordArray = keywords.split(/\s+/).filter(k => k.length > 2);
      const simplifiedKeywords = keywordArray.slice(0, 3).join(' ');
      
      logger.info(`[JobMatchingService] Searching JobTech with keywords: "${simplifiedKeywords}" (original: "${keywords}")`);
      
      // JobTech API params
      const params: any = {
        q: simplifiedKeywords,
        limit: Math.min(limit, 100), // Max 100 per request
      };

      // Location can be added to query if needed
      if (location) {
        params.q = `${simplifiedKeywords} ${location}`;
      }

      const response = await axios.get<JobTechApiResponse>(this.jobTechBaseUrl, {
        params,
        headers: {
          'accept': 'application/json',
        },
        timeout: 10000,
      });

      // Transform JobTech API response to our format
      // Response structure: { total: { value: number }, hits: Array }
      const hits = response.data.hits || [];
      logger.info(`[JobMatchingService] JobTech API returned ${hits.length} hits (total: ${response.data.total?.value || 0})`);
      
      // Use transformHitToJobListing helper method
      const jobs: JobListing[] = hits.map((hit: any) => this.transformHitToJobListing(hit));

      // If no results with simplified keywords, try with even simpler search (first keyword only)
      if (jobs.length === 0 && keywordArray.length > 1) {
        logger.info(`[JobMatchingService] No results, trying with first keyword only: "${keywordArray[0]}"`);
        const fallbackParams: any = {
          q: keywordArray[0],
          limit: Math.min(limit, 100),
        };
        if (location) {
          fallbackParams.q = `${keywordArray[0]} ${location}`;
        }
        
        try {
          const fallbackResponse = await axios.get<JobTechApiResponse>(this.jobTechBaseUrl, {
            params: fallbackParams,
            headers: { 'accept': 'application/json' },
            timeout: 10000,
          });
          
          const fallbackHits = fallbackResponse.data.hits || [];
          logger.info(`[JobMatchingService] Fallback search returned ${fallbackHits.length} hits`);
          
          if (fallbackHits.length > 0) {
            return fallbackHits.map((hit: any) => this.transformHitToJobListing(hit));
          }
        } catch (fallbackError) {
          logger.error('Fallback search failed', fallbackError as Error);
        }
      }

      return jobs;
    } catch (error) {
      logger.error('Failed to search JobTech jobs', error as Error);
      return [];
    }
  }

  /**
   * Remove duplicate jobs based on title + company
   */
  private removeDuplicateJobs(jobs: JobListing[]): JobListing[] {
    const seen = new Set<string>();
    const unique: JobListing[] = [];

    for (const job of jobs) {
      const key = `${job.title.toLowerCase()}_${job.company?.toLowerCase() || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
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

      const response = await axios.get<JobTechApiResponse>(this.jobTechBaseUrl, {
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

      const response = await axios.get<JobTechApiResponse>(this.jobTechBaseUrl, {
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
      // Filter out "Go" unless it's clearly programming language
      const filteredSkills = extractedSkills.filter(skill => {
        const skillLower = skill.toLowerCase();
        if (skillLower === 'go') {
          // Only keep "Go" if it's in programming context
          const hasProgrammingContext = description.toLowerCase().includes('programming') ||
                                       description.toLowerCase().includes('developer') ||
                                       description.toLowerCase().includes('software') ||
                                       description.toLowerCase().includes('golang');
          return hasProgrammingContext;
        }
        return true;
      });
      requiredSkills.push(...filteredSkills);
    }

    // Extract structured requirements
    const requirements = this.extractJobRequirements(hit, description);

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
      requirements: requirements,
      coordinates: hit.workplace_address?.coordinates,
      publicationDate: hit.publication_date,
      applicationDeadline: hit.application_deadline,
    };
  }

  /**
   * Extract structured requirements from JobTech API hit
   */
  private extractJobRequirements(hit: any, description: string): JobRequirements {
    const requirements: JobRequirements = {};

    // Driving license from structured data
    if (hit.driving_license) {
      if (typeof hit.driving_license === 'string') {
        requirements.drivingLicense = hit.driving_license;
      } else if (hit.driving_license.label) {
        requirements.drivingLicense = hit.driving_license.label;
      }
      requirements.drivingLicenseRequired = true;
    } else if (hit.drivinglicenserequired !== undefined) {
      requirements.drivingLicenseRequired = hit.drivinglicenserequired;
    }

    // Access to own car
    if (hit.accesstoown_car !== undefined) {
      requirements.accessToOwnCar = hit.accesstoown_car;
    }

    // Experience required
    if (hit.experience_required !== undefined) {
      requirements.experienceRequired = hit.experience_required;
    }

    // Languages from must_have and nice_to_have
    const languages: Array<{ language: string; level?: string }> = [];
    
    if (hit.must_have?.languages) {
      hit.must_have.languages.forEach((lang: any) => {
        languages.push({
          language: lang.namn || lang.label || '',
          level: lang.erfarenhetsniva?.namn || lang.erfarenhetsniva?.label,
        });
      });
    }
    
    if (hit.nice_to_have?.languages) {
      hit.nice_to_have.languages.forEach((lang: any) => {
        if (!languages.some(l => l.language === (lang.namn || lang.label))) {
          languages.push({
            language: lang.namn || lang.label || '',
            level: lang.erfarenhetsniva?.namn || lang.erfarenhetsniva?.label,
          });
        }
      });
    }

    if (languages.length > 0) {
      requirements.languages = languages;
    }

    // Extract requirements from description text
    const extractedRequirements = this.extractRequirementsFromText(description);
    
    // Merge extracted requirements
    if (extractedRequirements.drivingLicense && !requirements.drivingLicense) {
      requirements.drivingLicense = extractedRequirements.drivingLicense;
      requirements.drivingLicenseRequired = true;
    }
    
    if (extractedRequirements.languages && extractedRequirements.languages.length > 0) {
      requirements.languages = [
        ...(requirements.languages || []),
        ...extractedRequirements.languages,
      ];
    }
    
    if (extractedRequirements.otherRequirements && extractedRequirements.otherRequirements.length > 0) {
      requirements.otherRequirements = extractedRequirements.otherRequirements;
    }

    return requirements;
  }

  /**
   * Extract requirements from job description text using pattern matching
   */
  private extractRequirementsFromText(description: string): Partial<JobRequirements> {
    const requirements: Partial<JobRequirements> = {};
    const lowerDesc = description.toLowerCase();
    const otherReqs: string[] = [];

    // Driving license patterns
    const drivingLicensePatterns = [
      /(?:körkort|körkortskrav|körkortstyp)[:\s]*([A-Z]+(?:\s+[A-Z]+)?)/gi,
      /(?:körkort\s+)([A-Z]+)/gi,
      /(?:driving\s+license|führerschein)[:\s]*([A-Z]+)/gi,
    ];

    for (const pattern of drivingLicensePatterns) {
      const match = description.match(pattern);
      if (match) {
        const licenseMatch = match[0].match(/([A-Z]+)/);
        if (licenseMatch) {
          requirements.drivingLicense = licenseMatch[1];
          requirements.drivingLicenseRequired = true;
          break;
        }
      }
    }

    // Access to own car
    if (/tillgång\s+.*?\s+egen\s+bil|access\s+.*?\s+own\s+car|tillgång\s+.*?\s+bil/i.test(description)) {
      requirements.accessToOwnCar = true;
    }

    // Experience requirements
    if (/erfarenhet.*krav|experience.*required|minst\s+\d+\s+år.*erfarenhet/i.test(description)) {
      requirements.experienceRequired = true;
    }

    // Languages from text
    const languagePatterns = [
      /(?:behärskar|flytande|god\s+kunskap|språk)[:\s]*(svenska|engelska|tyska|franska|spanska|norska|danska)/gi,
      /(?:language|språk)[:\s]*(svenska|engelska|tyska|franska|spanska|norska|danska)/gi,
    ];

    const foundLanguages: Array<{ language: string; level?: string }> = [];
    for (const pattern of languagePatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        const lang = match[1].toLowerCase();
        if (!foundLanguages.some(l => l.language === lang)) {
          foundLanguages.push({ language: lang });
        }
      }
    }

    if (foundLanguages.length > 0) {
      requirements.languages = foundLanguages;
    }

    // Other specific requirements
    const requirementKeywords = [
      /fysisk\s+förmåga|physical\s+ability/i,
      /visum|visum|work\s+permit/i,
      /flytta|relocation|flytta\s+till/i,
      /heltid|full\s+time|deltid|part\s+time/i,
      /resor|travel|resande/i,
      /nattarbete|night\s+work|nattpass/i,
      /helger|weekend|helgarbete/i,
    ];

    for (const pattern of requirementKeywords) {
      const match = description.match(pattern);
      if (match && !otherReqs.includes(match[0])) {
        otherReqs.push(match[0]);
      }
    }

    if (otherReqs.length > 0) {
      requirements.otherRequirements = otherReqs;
    }

    return requirements;
  }

  /**
   * Match resume against job listings
   */
  async matchResumeToJobs(
    resumeText: string,
    resumeSkills: string[],
    jobs: JobListing[],
    resumeParsedData?: any,
    resumeLocation?: string
  ): Promise<JobMatch[]> {
    const matches: JobMatch[] = [];

    // Normalize resume location for comparison
    const normalizedResumeLocation = resumeLocation?.toLowerCase().trim();

    for (const job of jobs) {
      const match = this.calculateMatch(resumeText, resumeSkills, job, resumeParsedData);
      
      // Location proximity bonus (0-10 points)
      let locationBonus = 0;
      if (normalizedResumeLocation && job.location) {
        const normalizedJobLocation = job.location.toLowerCase();
        
        // Exact match (city, municipality, or region)
        if (normalizedJobLocation.includes(normalizedResumeLocation) || 
            normalizedResumeLocation.includes(normalizedJobLocation.split(',')[0]?.trim())) {
          locationBonus = 10; // Strong location match
        } else {
          // Partial match (same region or nearby)
          const resumeCity = normalizedResumeLocation.split(',')[0]?.trim();
          const jobCity = normalizedJobLocation.split(',')[0]?.trim();
          if (resumeCity && jobCity && 
              (jobCity.includes(resumeCity) || resumeCity.includes(jobCity))) {
            locationBonus = 5; // Partial location match
          }
        }
      }
      
      // Add location bonus to match percentage (cap at 100)
      const adjustedMatchPercentage = Math.min(100, match.matchPercentage + locationBonus);
      
      matches.push({
        job,
        matchPercentage: adjustedMatchPercentage,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
      });
    }

    // Sort by match percentage (highest first)
    return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
  }


  private calculateMatch(
    resumeText: string,
    resumeSkills: string[],
    job: JobListing,
    resumeParsedData?: any
  ): { matchPercentage: number; matchedSkills: string[]; missingSkills: string[] } {
    // Use structured skills from JobTech API if available, otherwise extract from description
    const jobSkills = job.requiredSkills && job.requiredSkills.length > 0
      ? job.requiredSkills
      : this.extractSkills(job.description);

    // CRITICAL: Check profession/field mismatch first - this prevents cross-field matches
    const professionMatch = this.calculateProfessionMatch(resumeText, resumeParsedData, job.title, job.description);
    
    // If profession mismatch is severe (score < 0.5), heavily penalize the match
    // This prevents cross-field matches (e.g., ställverksmontör matching ekonomi jobs)
    if (professionMatch < 0.5) {
      // Maximum 35% match if professions don't align - this prevents "Stark matchning" (75%+) for wrong field
      return {
        matchPercentage: Math.min(35, Math.round(professionMatch * 100)),
        matchedSkills: this.filterRelevantSkills([], jobSkills), // Filter out languages and generic skills
        missingSkills: jobSkills,
      };
    }

    // Calculate skill match (base score)
    let skillMatchRatio = 0;
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];

    if (jobSkills.length > 0) {
      // Normalize skills for comparison
      const normalize = (skill: string) => skill.toLowerCase().trim().replace(/[^\w\s]/g, '');
      const normalizedResumeSkills = resumeSkills.map(normalize);
      const normalizedJobSkills = jobSkills.map(normalize);

      // Find matched skills (fuzzy matching)
      // IMPORTANT: Filter out languages and generic skills that don't indicate profession match
      normalizedJobSkills.forEach((jobSkill, index) => {
        // Skip languages - they're not relevant for profession matching
        if (this.isLanguageSkill(jobSkill)) {
          return; // Don't count languages as matched skills
        }
        
        // Skip "Go" unless it's clearly the programming language
        const jobSkillLower = jobSkill.toLowerCase();
        if (jobSkillLower === 'go' || (jobSkillLower.includes('go') && !jobSkillLower.includes('golang') && !jobSkillLower.includes('programming'))) {
          // Check if it's in a programming context in the job description
          const hasProgrammingContext = job.description?.toLowerCase().includes('programming') ||
                                       job.description?.toLowerCase().includes('developer') ||
                                       job.description?.toLowerCase().includes('software') ||
                                       job.description?.toLowerCase().includes('golang');
          if (!hasProgrammingContext) {
            return; // Skip "Go" if not in programming context
          }
        }
        
        const matched = normalizedResumeSkills.some(resumeSkill => {
          // Skip languages in resume too
          if (this.isLanguageSkill(resumeSkill)) {
            return false;
          }
          
          // Skip "Go" in resume unless it's clearly programming
          const resumeSkillLower = resumeSkill.toLowerCase();
          if (resumeSkillLower === 'go' || (resumeSkillLower.includes('go') && !resumeSkillLower.includes('golang') && !resumeSkillLower.includes('programming'))) {
            return false; // Don't match standalone "Go"
          }
          
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
      missingSkills = jobSkills.filter((skill) => !matchedSkills.includes(skill));
      skillMatchRatio = matchedSkills.length / jobSkills.length;
    } else {
      // If no skills found, use keyword overlap only
      skillMatchRatio = this.calculateKeywordOverlap(resumeText, job.description);
    }

    // Calculate requirements match score
    const requirementsMatchScore = this.calculateRequirementsMatch(
      resumeText,
      resumeParsedData,
      job.requirements
    );

    // Calculate keyword overlap in description
    const keywordOverlap = this.calculateKeywordOverlap(resumeText, job.description);

    // Calculate job title match (bonus for matching job titles)
    const jobTitleMatch = this.calculateJobTitleMatch(resumeText, resumeParsedData, job.title);

    // Adaptive weighting based on available data:
    // If we have good skill matches, prioritize skills
    // If skills are low but keywords are high, prioritize keywords
    let skillWeight = 50;
    let requirementsWeight = 30;
    let keywordWeight = 20;

    // If skill match is very low but keyword overlap is high, adjust weights
    if (skillMatchRatio < 0.3 && keywordOverlap > 0.4) {
      // More weight to keywords when skills don't match well
      skillWeight = 30;
      keywordWeight = 40;
    }

    // If we have no skills to match against, rely more on keywords and title
    if (jobSkills.length === 0) {
      skillWeight = 0;
      keywordWeight = 50;
      requirementsWeight = 30;
    }

    // Calculate base match percentage with adaptive weights
    let baseMatch = skillMatchRatio * skillWeight + 
                    requirementsMatchScore * requirementsWeight + 
                    keywordOverlap * keywordWeight;

    // Add job title match bonus (0-20 points)
    const titleBonus = jobTitleMatch * 20;
    baseMatch += titleBonus;

    // Apply profession match as a STRICT multiplier
    // If profession match is perfect (1.0), ensure high score regardless of other factors
    if (professionMatch >= 1.0) {
      // Perfect profession match - ensure minimum 70% match for same profession
      // Boost baseMatch and ensure it's at least 70%
      baseMatch = Math.max(70, Math.min(100, baseMatch * 1.3)); // Boost by 30% and ensure min 70%
    } else if (professionMatch >= 0.75) {
      // Very similar professions - good match
      baseMatch = baseMatch * (0.7 + professionMatch * 0.3); // Scale to 0.7-1.0 range
    } else if (professionMatch < 0.5) {
      // For different or uncertain fields, cap at 40% maximum to prevent "Stark matchning"
      baseMatch = Math.min(40, baseMatch * professionMatch);
    } else {
      // For same field but different professions, apply moderate multiplier
      baseMatch = baseMatch * (0.5 + professionMatch * 0.3); // Scale to 0.5-0.8 range
    }

    // Normalize to 0-100 range
    const matchPercentage = Math.round(Math.min(100, Math.max(0, baseMatch)));

    // Filter out languages and generic skills from matched skills
    const filteredMatchedSkills = this.filterRelevantSkills(matchedSkills, jobSkills);

    return {
      matchPercentage: Math.min(100, Math.max(0, matchPercentage)), // Clamp 0-100
      matchedSkills: [...new Set(filteredMatchedSkills)], // Remove duplicates and filter languages
      missingSkills: [...new Set(missingSkills)],
    };
  }

  /**
   * Calculate how well resume matches job requirements (driving license, languages, etc.)
   * Returns a score between 0 and 1
   */
  private calculateRequirementsMatch(
    resumeText: string,
    resumeParsedData: any,
    jobRequirements?: JobRequirements
  ): number {
    if (!jobRequirements) {
      return 1.0; // No requirements = perfect match (don't penalize)
    }

    const lowerResumeText = resumeText.toLowerCase();
    let totalWeight = 0;
    let matchedWeight = 0;

    // Driving license (high weight: 0.3)
    if (jobRequirements.drivingLicenseRequired) {
      totalWeight += 0.3;
      const hasLicense = this.checkDrivingLicense(resumeText, resumeParsedData, jobRequirements.drivingLicense);
      if (hasLicense) {
        matchedWeight += 0.3;
      }
    }

    // Access to own car (medium weight: 0.2)
    if (jobRequirements.accessToOwnCar) {
      totalWeight += 0.2;
      const hasCar = /egen\s+bil|own\s+car|tillgång.*bil/i.test(resumeText);
      if (hasCar) {
        matchedWeight += 0.2;
      }
    }

    // Languages (medium weight: 0.25)
    if (jobRequirements.languages && jobRequirements.languages.length > 0) {
      totalWeight += 0.25;
      const languageMatches = jobRequirements.languages.filter(lang => 
        this.checkLanguage(resumeText, resumeParsedData, lang.language, lang.level)
      );
      const languageMatchRatio = languageMatches.length / jobRequirements.languages.length;
      matchedWeight += 0.25 * languageMatchRatio;
    }

    // Experience required (low weight: 0.15)
    if (jobRequirements.experienceRequired) {
      totalWeight += 0.15;
      const hasExperience = this.checkExperience(resumeText, resumeParsedData);
      if (hasExperience) {
        matchedWeight += 0.15;
      }
    }

    // Other requirements (low weight: 0.1)
    if (jobRequirements.otherRequirements && jobRequirements.otherRequirements.length > 0) {
      totalWeight += 0.1;
      const otherMatches = jobRequirements.otherRequirements.filter(req => 
        lowerResumeText.includes(req.toLowerCase())
      );
      const otherMatchRatio = otherMatches.length / jobRequirements.otherRequirements.length;
      matchedWeight += 0.1 * otherMatchRatio;
    }

    // Return match ratio (0-1)
    if (totalWeight === 0) {
      return 1.0; // No requirements to match = perfect
    }

    return matchedWeight / totalWeight;
  }

  /**
   * Check if resume mentions driving license
   */
  private checkDrivingLicense(resumeText: string, parsedData: any, requiredLicense?: string): boolean {
    const lowerText = resumeText.toLowerCase();
    
    // Check for any driving license mention
    if (/körkort|driving\s+license|führerschein/i.test(lowerText)) {
      // If specific license required, try to match it
      if (requiredLicense) {
        const licensePattern = new RegExp(requiredLicense.replace(/\s+/g, '\\s*'), 'i');
        return licensePattern.test(resumeText);
      }
      return true; // Any license mentioned
    }
    
    return false;
  }

  /**
   * Check if resume mentions language at required level
   */
  private checkLanguage(resumeText: string, parsedData: any, language: string, level?: string): boolean {
    const lowerText = resumeText.toLowerCase();
    const langLower = language.toLowerCase();
    
    // Common Swedish language names
    const languageMap: Record<string, string[]> = {
      'svenska': ['svenska', 'swedish'],
      'engelska': ['engelska', 'english', 'engelska'],
      'tyska': ['tyska', 'german', 'deutsch'],
      'franska': ['franska', 'french', 'français'],
      'spanska': ['spanska', 'spanish', 'español'],
      'norska': ['norska', 'norwegian'],
      'danska': ['danska', 'danish'],
    };

    const langVariations = languageMap[langLower] || [langLower];
    const hasLanguage = langVariations.some(lang => lowerText.includes(lang));

    if (!hasLanguage) {
      return false;
    }

    // If level specified, check if it's mentioned or if we have high proficiency
    if (level) {
      const levelLower = level.toLowerCase();
      // High proficiency indicators
      const highProficiency = /flytande|native|modersmål|mother\s+tongue|professionell/i;
      if (highProficiency.test(lowerText)) {
        return true; // High proficiency covers any requirement
      }
      
      // Check if specific level is mentioned near the language
      const langIndex = lowerText.indexOf(langVariations.find(l => lowerText.includes(l)) || '');
      if (langIndex > 0) {
        const context = lowerText.substring(Math.max(0, langIndex - 50), langIndex + 100);
        if (context.includes(levelLower) || /god|good|bra/i.test(context)) {
          return true;
        }
      }
    }

    return hasLanguage; // Language mentioned, assume adequate level if not specified
  }

  /**
   * Check if resume shows relevant experience
   */
  private checkExperience(resumeText: string, parsedData: any): boolean {
    // Check if experience section exists
    if (parsedData?.sections?.experience && Array.isArray(parsedData.sections.experience)) {
      if (parsedData.sections.experience.length > 0) {
        return true; // Has work experience
      }
    }

    // Check text for experience indicators
    const experiencePatterns = [
      /erfarenhet.*\d+\s*år/i,
      /experience.*\d+\s*years/i,
      /arbetslivserfarenhet/i,
      /tidigare\s+anställning/i,
    ];

    return experiencePatterns.some(pattern => pattern.test(resumeText));
  }

  private extractSkills(text: string): string[] {
    // Common Swedish IT/tech skills (svenska och engelska)
    const commonSkills = [
      // Programming languages (be more specific for ambiguous ones)
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', '.NET',
      'PHP', 'Ruby', 'Rust', 'Swift', 'Kotlin', 'Dart', 'Flutter',
      // Go programming language - only match explicit "Golang" or "Go programming"
      'Golang', 'Go programming', 'Go language',
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
      // Languages
      'Swedish', 'English', 'Svenska', 'Engelska'
    ];

    const textLower = text.toLowerCase();
    const foundSkills: string[] = [];
    
    // Check each skill with context awareness
    for (const skill of commonSkills) {
      const skillLower = skill.toLowerCase();
      
      // NEVER match standalone "Go" - it's too ambiguous (could be "go" as in "go to", etc.)
      // Only match explicit programming language references
      if (skillLower === 'go' || (skillLower.includes('go') && !skillLower.includes('golang'))) {
        // Skip - don't match "Go" at all unless it's explicitly "Golang" or "Go programming"
        continue;
      } else if (textLower.includes(skillLower)) {
        foundSkills.push(skill);
      }
    }

    return foundSkills;
  }

  private calculateKeywordOverlap(text1: string, text2: string): number {
    // Enhanced keyword overlap calculation
    // Extract meaningful words (3+ characters, not common words)
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'can', 'och', 'i', 'på', 'för', 'med', 'som', 'av',
      'till', 'från', 'om', 'det', 'den', 'de', 'är', 'var', 'ska', 'kan',
      'samt', 'eller', 'men', 'också', 'även', 'både', 'vad', 'när', 'där',
    ]);

    const extractWords = (text: string): Set<string> => {
      return new Set(
        text.toLowerCase()
          .split(/\W+/)
          .filter(word => word.length >= 3 && !commonWords.has(word))
      );
    };

    const resumeWords = extractWords(text1);
    const jobWords = extractWords(text2);

    if (jobWords.size === 0) return 0.5; // Default if no words found

    // Calculate overlap ratio
    let matches = 0;
    jobWords.forEach(word => {
      if (resumeWords.has(word)) {
        matches++;
      } else {
        // Fuzzy match: check if any resume word contains this word or vice versa
        const fuzzyMatch = Array.from(resumeWords).some(resumeWord => 
          resumeWord.includes(word) || word.includes(resumeWord)
        );
        if (fuzzyMatch) {
          matches += 0.5; // Partial credit for fuzzy matches
        }
      }
    });

    const overlapRatio = matches / jobWords.size;
    
    // Boost score if there's significant overlap (more than 30% of words match)
    if (overlapRatio > 0.3) {
      return Math.min(1.0, overlapRatio * 1.2); // Boost by 20%
    }

    return Math.min(1.0, overlapRatio);
  }

  /**
   * Calculate how well the job title matches the resume
   * Returns a score between 0 and 1
   */
  private calculateJobTitleMatch(resumeText: string, parsedData: any, jobTitle: string): number {
    if (!jobTitle) return 0;

    const lowerResumeText = resumeText.toLowerCase();
    const lowerJobTitle = jobTitle.toLowerCase();

    // Extract main words from job title (remove common prefixes)
    const titleWords = lowerJobTitle
      .split(/\s+/)
      .filter(word => !['senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head', 
                       'ledande', 'chef', 'ansvarig', 'specialist', 'expert'].includes(word))
      .filter(word => word.length > 3);

    if (titleWords.length === 0) return 0;

    // Check if resume mentions similar job titles in experience section
    if (parsedData?.sections?.experience && Array.isArray(parsedData.sections.experience)) {
      for (const exp of parsedData.sections.experience) {
        if (exp.title) {
          const expTitleLower = exp.title.toLowerCase();
          // Check if any significant word from job title appears in experience title
          const matchingWords = titleWords.filter(word => expTitleLower.includes(word));
          if (matchingWords.length > 0) {
            // Strong match if multiple words match or if it's a close match
            return Math.min(1.0, matchingWords.length / titleWords.length + 0.3);
          }
        }
      }
    }

    // Check if job title words appear in resume text
    const matchingWords = titleWords.filter(word => lowerResumeText.includes(word));
    if (matchingWords.length > 0) {
      // Moderate match based on how many words match
      return Math.min(0.7, matchingWords.length / titleWords.length * 0.7);
    }

    return 0;
  }

  /**
   * Calculate profession/field match between resume and job
   * Returns a score between 0 and 1, where 0 = completely different fields, 1 = same field
   * This prevents cross-field matches (e.g., ställverksmontör matching ekonomiassistent jobs)
   */
  private calculateProfessionMatch(resumeText: string, parsedData: any, jobTitle: string, jobDescription: string): number {
    const lowerResumeText = resumeText.toLowerCase();
    const lowerJobTitle = jobTitle.toLowerCase();
    const lowerJobDesc = jobDescription.toLowerCase();

    // Extract profession from resume (from experience section or text)
    const resumeProfessions = this.extractProfessions(resumeText, parsedData);
    
    // Extract profession from job
    const jobProfessions = this.extractProfessionsFromJob(jobTitle, jobDescription);

    // If we can't determine professions, be very conservative
    if (resumeProfessions.length === 0 || jobProfessions.length === 0) {
      // If we can't determine, check field categories as fallback
      const resumeField = this.determineField([], lowerResumeText);
      const jobField = this.determineField([], lowerJobDesc);
      
      if (resumeField && jobField && resumeField === jobField) {
        return 0.5; // Same field category but uncertain - reduced from 0.6
      }
      
      // If we can't determine, be very conservative - don't give high scores
      return 0.3; // Reduced from 0.4 to be more strict
    }

    // Check for profession overlap
    let matchCount = 0;
    let exactMatch = false;
    
    for (const resumeProf of resumeProfessions) {
      for (const jobProf of jobProfessions) {
        // Exact match
        if (resumeProf === jobProf) {
          exactMatch = true;
          break;
        }
        // Contains match (e.g., "ekonom" matches "ekonomiassistent")
        // But be more strict - only if one is clearly a subset of the other
        if ((resumeProf.length > 5 && jobProf.includes(resumeProf)) || 
            (jobProf.length > 5 && resumeProf.includes(jobProf))) {
          matchCount++;
        }
      }
      if (exactMatch) break;
    }

    // If exact profession matches, return high score
    if (exactMatch) {
      return 1.0;
    }

    // If professions are similar (subset match), return good score
    if (matchCount > 0) {
      return 0.75; // Good match for similar professions
    }

    // Check for field categories (e.g., technical, finance, healthcare)
    const resumeField = this.determineField(resumeProfessions, lowerResumeText);
    const jobField = this.determineField(jobProfessions, lowerJobDesc);

    if (resumeField && jobField) {
      if (resumeField === jobField) {
        return 0.45; // Same field category but different professions - reduced from 0.5
      } else {
        // Different fields - return very low score (ställverksmontör vs ekonomi = different fields)
        return 0.1; // Very strict for different fields
      }
    }

    // Different fields or can't determine - return very low score
    return 0.1; // Very strict - assume mismatch if uncertain
  }

  /**
   * Extract professions from resume
   */
  private extractProfessions(resumeText: string, parsedData?: any): string[] {
    const professions: string[] = [];
    const lowerText = resumeText.toLowerCase();

    // Extract from experience section
    if (parsedData?.sections?.experience && Array.isArray(parsedData.sections.experience)) {
      parsedData.sections.experience.forEach((exp: any) => {
        if (exp.title) {
          const prof = this.normalizeProfession(exp.title);
          if (prof) professions.push(prof);
        }
      });
    }

    // Extract from text using profession patterns
    const professionPatterns = [
      /(?:jag\s+är|är|som|arbetar\s+som|yrke)\s+([a-zåäö]+(?:\s+[a-zåäö]+){0,2})/gi,
      /(?:ställverksmontör|ekonomiassistent|ekonom|redovisningsekonom|utvecklare|programmerare|sjuksköterska|lärare|säljare|inköpare|projektledare|administratör)/gi,
    ];

    for (const pattern of professionPatterns) {
      const matches = resumeText.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const prof = this.normalizeProfession(match[1]);
          if (prof) professions.push(prof);
        } else if (match[0]) {
          const prof = this.normalizeProfession(match[0]);
          if (prof) professions.push(prof);
        }
      }
    }

    // Common Swedish professions to check for (prioritize longer/more specific matches first)
    const commonProfessions = [
      // Technical/Electrical (check longer phrases first)
      'ställverksmontör', 'resemontör', 'elektriker', 'distributionselektriker',
      'montör', 'tekniker', 'elmontör', 'ställverksmontage',
      // Finance/Economics
      'ekonomiassistent', 'redovisningsekonom', 'ekonom', 'bokförare', 'revisor',
      'controller', 'ekonomist', 'kreditanalytiker', 'finansanalytiker',
      // IT/Tech
      'utvecklare', 'programmerare', 'systemutvecklare', 'systemarkitekt',
      // Healthcare
      'sjuksköterska', 'läkare', 'undersköterska',
      // Education
      'lärare', 'pedagog',
      // Sales/Marketing
      'säljare', 'inköpare', 'marknadsförare',
      // Management
      'projektledare', 'chef', 'ledare',
      // Administrative
      'administratör', 'kundtjänst',
    ];

    // Check for professions in order (longer/more specific first)
    for (const prof of commonProfessions) {
      if (lowerText.includes(prof)) {
        professions.push(prof);
        // If we found a specific profession, prioritize it
        break; // Don't add more generic ones if we found a specific match
      }
    }
    
    // Also check for compound profession patterns like "Resemontör/Ställverksmontör"
    const compoundPattern = /(?:resemontör|ställverksmontör|elektriker|ekonomiassistent|ekonom|redovisningsekonom|bokförare|utvecklare|programmerare)/gi;
    const compoundMatches = resumeText.match(compoundPattern);
    if (compoundMatches) {
      compoundMatches.forEach(match => {
        const normalized = match.toLowerCase();
        if (!professions.includes(normalized)) {
          professions.push(normalized);
        }
      });
    }

    return [...new Set(professions)]; // Remove duplicates
  }

  /**
   * Extract professions from job title and description
   */
  private extractProfessionsFromJob(jobTitle: string, jobDescription: string): string[] {
    const professions: string[] = [];
    const lowerTitle = jobTitle.toLowerCase();
    const lowerDesc = jobDescription.toLowerCase();
    const combinedText = `${lowerTitle} ${lowerDesc}`;

    // Normalize job title - this is the most reliable source
    const titleProf = this.normalizeProfession(jobTitle);
    if (titleProf && titleProf.length > 3) {
      professions.push(titleProf);
    }

    // Check for common professions in title and description (prioritize longer/more specific)
    const commonProfessions = [
      // Technical/Electrical (check longer phrases first)
      'ställverksmontör', 'resemontör', 'elektriker', 'distributionselektriker',
      'montör', 'tekniker', 'elmontör', 'ställverksmontage',
      // Finance/Economics (prioritize specific roles)
      'redovisningsekonom', 'ekonomiassistent', 'ekonom', 'bokförare', 'revisor',
      'controller', 'ekonomist', 'kreditanalytiker', 'finansanalytiker',
      // IT/Tech
      'systemutvecklare', 'utvecklare', 'programmerare', 'systemarkitekt',
      // Healthcare
      'sjuksköterska', 'läkare', 'undersköterska',
      // Education
      'lärare', 'pedagog',
      // Sales/Marketing
      'säljare', 'inköpare', 'marknadsförare',
      // Management
      'projektledare', 'chef', 'ledare',
      // Administrative
      'administratör', 'kundtjänst',
    ];

    // Check in order (longer/more specific first) - stop after first match to avoid generic matches
    for (const prof of commonProfessions) {
      if (combinedText.includes(prof)) {
        if (!professions.includes(prof)) {
          professions.push(prof);
        }
        // If we found a specific profession in title, prioritize it
        if (lowerTitle.includes(prof)) {
          break; // Title is most reliable, stop here
        }
      }
    }

    return [...new Set(professions)]; // Remove duplicates
  }

  /**
   * Normalize profession name (remove prefixes, keep core profession)
   */
  private normalizeProfession(title: string): string | null {
    const lower = title.toLowerCase();
    
    // Remove common prefixes
    const prefixes = ['senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head', 
                     'ledande', 'chef', 'ansvarig', 'specialist', 'expert', 'assistent'];
    const words = lower.split(/\s+/).filter(w => !prefixes.includes(w) && w.length > 3);
    
    if (words.length === 0) return null;
    
    // Return the most significant word (usually the last one)
    return words[words.length - 1];
  }

  /**
   * Check if a skill is a language (not relevant for profession matching)
   */
  private isLanguageSkill(skill: string): boolean {
    const lowerSkill = skill.toLowerCase().trim();
    const languageKeywords = [
      'svenska', 'swedish', 'engelska', 'english', 'tyska', 'german', 
      'franska', 'french', 'spanska', 'spanish', 'norska', 'norwegian',
      'danska', 'danish', 'språk', 'language', 'tal', 'skrift'
    ];
    return languageKeywords.some(keyword => lowerSkill.includes(keyword));
  }

  /**
   * Filter out languages and generic skills that don't indicate profession match
   */
  private filterRelevantSkills(skills: string[], allJobSkills: string[]): string[] {
    return skills.filter(skill => {
      // Remove languages
      if (this.isLanguageSkill(skill)) {
        return false;
      }
      
      // Remove very generic skills that don't indicate profession
      const lowerSkill = skill.toLowerCase().trim();
      const genericSkills = [
        'go', // Only if it's not clearly "Go programming language"
        'kommunikation', 'communication', 
        'samarbete', 'teamwork',
        'problem solving', 'problemlösning',
        'leadership', 'ledarskap'
      ];
      
      // Check if it's a generic skill (but allow "Go" if it's clearly the programming language)
      if (genericSkills.includes(lowerSkill)) {
        // Special case: "Go" is only valid if it's clearly the programming language
        if (lowerSkill === 'go') {
          // Check if it appears in a programming context in job skills
          const hasGoContext = allJobSkills.some(js => {
            const jsLower = js.toLowerCase();
            return jsLower.includes('golang') || 
                   jsLower.includes('go programming') ||
                   jsLower.includes('go language') ||
                   (jsLower === 'go' && allJobSkills.some(other => 
                     ['programming', 'developer', 'software', 'backend'].some(term => 
                       other.toLowerCase().includes(term))));
          });
          return hasGoContext; // Only keep if it's clearly the programming language
        }
        return false; // Remove other generic skills
      }
      
      return true;
    });
  }

  /**
   * Determine field category (technical, finance, healthcare, education, sales, etc.)
   */
  private determineField(professions: string[], text: string): string | null {
    const lowerText = text.toLowerCase();
    
    // Technical field
    const technicalKeywords = ['ställverksmontör', 'elektriker', 'montör', 'tekniker', 'utvecklare', 'programmerare', 'systemutvecklare', 'it', 'teknik', 'elektro'];
    if (professions.some(p => technicalKeywords.some(k => p.includes(k))) || 
        technicalKeywords.some(k => lowerText.includes(k))) {
      return 'technical';
    }

    // Finance field
    const financeKeywords = ['ekonomiassistent', 'ekonom', 'redovisningsekonom', 'bokförare', 'revisor', 'controller', 'ekonomi', 'redovisning', 'bokföring'];
    if (professions.some(p => financeKeywords.some(k => p.includes(k))) || 
        financeKeywords.some(k => lowerText.includes(k))) {
      return 'finance';
    }

    // Healthcare field
    const healthcareKeywords = ['sjuksköterska', 'läkare', 'undersköterska', 'vård', 'sjukvård', 'hälsa'];
    if (professions.some(p => healthcareKeywords.some(k => p.includes(k))) || 
        healthcareKeywords.some(k => lowerText.includes(k))) {
      return 'healthcare';
    }

    // Education field
    const educationKeywords = ['lärare', 'pedagog', 'utbildning', 'skola'];
    if (professions.some(p => educationKeywords.some(k => p.includes(k))) || 
        educationKeywords.some(k => lowerText.includes(k))) {
      return 'education';
    }

    // Sales/Marketing field
    const salesKeywords = ['säljare', 'inköpare', 'marknadsförare', 'sälj', 'marknadsföring'];
    if (professions.some(p => salesKeywords.some(k => p.includes(k))) || 
        salesKeywords.some(k => lowerText.includes(k))) {
      return 'sales';
    }

    return null;
  }
}

export const jobMatchingService = new JobMatchingService();

