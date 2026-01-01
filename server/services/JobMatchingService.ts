import axios from 'axios';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('JobMatchingService');

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
  tier: 1 | 2 | 3; // Tier classification: 1=strong match, 2=partial match, 3=potential match
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
    resumeParsedData?: any
  ): Promise<JobMatch[]> {
    const matches: JobMatch[] = [];

    for (const job of jobs) {
      const match = this.calculateMatch(resumeText, resumeSkills, job, resumeParsedData);
      const tier = this.calculateTier(match.matchPercentage);
      matches.push({
        job,
        ...match,
        tier,
      });
    }

    // Sort by tier first (1 > 2 > 3), then by match percentage within each tier
    return matches.sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier; // Tier 1 before Tier 2 before Tier 3
      }
      return b.matchPercentage - a.matchPercentage; // Higher match % first within same tier
    });
  }

  /**
   * Calculate tier based on match percentage
   * Tier 1: Strong match (>= 70%) - Ready to apply
   * Tier 2: Partial match (40-69%) - Can become match with AI adaptation
   * Tier 3: Potential match (20-39%) - Worth exploring/adapting CV for
   */
  private calculateTier(matchPercentage: number): 1 | 2 | 3 {
    if (matchPercentage >= 70) {
      return 1;
    } else if (matchPercentage >= 40) {
      return 2;
    } else {
      return 3;
    }
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

    // Normalize to 0-100 range
    const matchPercentage = Math.round(Math.min(100, Math.max(0, baseMatch)));

    return {
      matchPercentage: Math.min(100, Math.max(0, matchPercentage)), // Clamp 0-100
      matchedSkills: [...new Set(matchedSkills)], // Remove duplicates
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

