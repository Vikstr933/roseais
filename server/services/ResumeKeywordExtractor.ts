import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeKeywordExtractor');

export class ResumeKeywordExtractor {
  /**
   * Extract relevant search keywords from resume for job matching
   */
  extractJobSearchKeywords(resumeText: string, parsedData?: any): string {
    const keywords: string[] = [];

    // Extract job titles from experience section
    if (parsedData?.sections?.experience) {
      parsedData.sections.experience.forEach((exp: any) => {
        if (exp.title) {
          // Extract main job title keywords (e.g., "Senior Software Engineer" -> ["Software", "Engineer"])
          const titleWords = this.extractTitleKeywords(exp.title);
          keywords.push(...titleWords);
        }
      });
    }

    // Extract skills
    if (parsedData?.sections?.skills && Array.isArray(parsedData.sections.skills)) {
      const skills = parsedData.sections.skills;
      // Add top 5-7 most relevant skills
      keywords.push(...skills.slice(0, 7));
    }

    // Extract technologies and keywords from resume text
    const techKeywords = this.extractTechnologyKeywords(resumeText);
    keywords.push(...techKeywords);

    // Extract occupation-related keywords from text
    const occupationKeywords = this.extractOccupationKeywords(resumeText);
    keywords.push(...occupationKeywords);

    // Remove duplicates and filter out common words
    const uniqueKeywords = Array.from(new Set(keywords))
      .filter(kw => kw && kw.length > 2)
      .filter(kw => !this.isCommonWord(kw));

    // Build search query (prioritize job titles and skills)
    if (uniqueKeywords.length === 0) {
      return 'utvecklare'; // Fallback
    }

    // Take top 3-5 keywords for search
    const searchKeywords = uniqueKeywords.slice(0, 5).join(' ');

    logger.info(`Extracted keywords from resume: ${searchKeywords}`);

    return searchKeywords;
  }

  /**
   * Extract keywords from job title
   */
  private extractTitleKeywords(title: string): string[] {
    const commonTitleWords = ['senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head'];
    const words = title.toLowerCase().split(/\s+/);
    
    // Filter out common title prefixes and keep meaningful words
    return words
      .filter(word => !commonTitleWords.includes(word))
      .filter(word => word.length > 3)
      .slice(0, 3); // Max 3 keywords from title
  }

  /**
   * Extract technology keywords from resume text
   */
  private extractTechnologyKeywords(text: string): string[] {
    const techPatterns = [
      // Programming languages
      /\b(?:javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin|dart|scala)\b/gi,
      // Frameworks
      /\b(?:react|vue|angular|svelte|next\.js|nuxt|express|django|flask|spring|laravel|symfony|asp\.net|node\.js)\b/gi,
      // Databases
      /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|sqlite|oracle|sql server)\b/gi,
      // Tools & Platforms
      /\b(?:docker|kubernetes|aws|azure|gcp|git|jenkins|terraform|ansible|linux|unix)\b/gi,
    ];

    const foundTech: string[] = [];
    
    techPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        foundTech.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return Array.from(new Set(foundTech)).slice(0, 5);
  }

  /**
   * Extract occupation-related keywords from resume text
   */
  private extractOccupationKeywords(text: string): string[] {
    const occupationPatterns = [
      // Swedish job titles
      /\b(?:utvecklare|programmerare|arkitekt|konsult|ingenjör|designer|analytiker|projektledare|chef|manager|ledare)\b/gi,
      // English job titles
      /\b(?:developer|programmer|architect|consultant|engineer|designer|analyst|manager|lead|director)\b/gi,
      // Specialized roles
      /\b(?:fullstack|full stack|frontend|front-end|backend|back-end|devops|sre|qa|tester|test engineer)\b/gi,
    ];

    const foundOccupations: string[] = [];

    occupationPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        foundOccupations.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return Array.from(new Set(foundOccupations)).slice(0, 3);
  }

  /**
   * Check if word is a common word that shouldn't be used for job search
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'can', 'var', 'let', 'const', 'function', 'class',
      'interface', 'type', 'export', 'import', 'from', 'this', 'that',
    ];

    return commonWords.includes(word.toLowerCase());
  }
}

export const resumeKeywordExtractor = new ResumeKeywordExtractor();

