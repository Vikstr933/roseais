import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeKeywordExtractor');

export class ResumeKeywordExtractor {
  /**
   * Extract location from resume (city, municipality, region)
   */
  extractLocation(resumeText: string, parsedData?: any): string | null {
    // PRIORITY 1: Check contactInfo.location if available
    if (parsedData?.contactInfo?.location && typeof parsedData.contactInfo.location === 'string') {
      const location = parsedData.contactInfo.location.trim();
      if (location.length > 0) {
        logger.info(`Extracted location from contactInfo: ${location}`);
        return location;
      }
    }

    // PRIORITY 2: Extract from address pattern in text
    // Swedish address patterns: "Stockholm", "123 45 Stockholm", "Göteborg, Västra Götaland"
    const addressPatterns = [
      /(?:Adress|Address|Plats|Location)[:]\s*([^\n]+)/i,
      /([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)*)\s+\d{3}\s?\d{2}/, // "Stockholm 123 45"
      /(\d{3}\s?\d{2})\s+([A-ZÅÄÖ][a-zåäö]+)/, // "123 45 Stockholm"
      /([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)*),\s*([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)*)/, // "Stockholm, Södermanland"
    ];

    for (const pattern of addressPatterns) {
      const match = resumeText.match(pattern);
      if (match) {
        // Extract the location part (usually the last match group)
        const location = match[match.length - 1]?.trim();
        if (location && location.length > 2 && location.length < 50) {
          // Filter out common non-location words
          const excluded = ['Sverige', 'Sweden', 'Email', 'Telefon', 'Phone', 'Mobil'];
          if (!excluded.includes(location)) {
            logger.info(`Extracted location from text pattern: ${location}`);
            return location;
          }
        }
      }
    }

    // PRIORITY 3: Look for common Swedish cities/regions in text
    const swedishCities = [
      'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping',
      'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås',
      'Eskilstuna', 'Södertälje', 'Karlstad', 'Täby', 'Växjö', 'Halmstad', 'Sundsvall',
      'Luleå', 'Trollhättan', 'Östersund', 'Borlänge', 'Falun', 'Kalmar', 'Kristianstad',
      'Skövde', 'Karlskrona', 'Skellefteå', 'Uddevalla', 'Lidingö', 'Motala', 'Piteå'
    ];

    const lowerText = resumeText.toLowerCase();
    for (const city of swedishCities) {
      if (lowerText.includes(city.toLowerCase())) {
        logger.info(`Extracted location from known city: ${city}`);
        return city;
      }
    }

    return null;
  }

  /**
   * Extract relevant search keywords from resume for job matching
   */
  extractJobSearchKeywords(resumeText: string, parsedData?: any): string {
    const keywords: string[] = [];

    // PRIORITY 1: Extract job titles from experience section (most reliable)
    if (parsedData?.sections?.experience && Array.isArray(parsedData.sections.experience)) {
      parsedData.sections.experience.forEach((exp: any) => {
        if (exp.title && typeof exp.title === 'string') {
          // Keep the full job title or extract key parts
          const title = exp.title.trim();
          // For Swedish job titles, prioritize the main occupation word
          // e.g., "Ekonomiassistent" -> "ekonomiassistent"
          // e.g., "Senior Software Engineer" -> "software engineer" 
          const normalizedTitle = this.normalizeJobTitle(title);
          if (normalizedTitle) {
            keywords.push(normalizedTitle);
          }
        }
      });
    }

    // PRIORITY 2: Extract from summary section if it contains job title
    if (parsedData?.sections?.summary && typeof parsedData.sections.summary === 'string') {
      const summary = parsedData.sections.summary.toLowerCase();
      // Look for common patterns like "Jag är [job title]" or "[Job title] med X års erfarenhet"
      const titleMatch = summary.match(/(?:jag är|är|som|arbetar som)\s+([a-zåäö]+(?:\s+[a-zåäö]+){0,3})/i);
      if (titleMatch && titleMatch[1]) {
        const foundTitle = titleMatch[1].trim();
        if (foundTitle.length > 3 && !this.isCommonWord(foundTitle)) {
          keywords.push(foundTitle);
        }
      }
    }

    // PRIORITY 3: Extract job titles directly from raw text using pattern matching
    const titleFromText = this.extractJobTitleFromText(resumeText);
    if (titleFromText) {
      keywords.push(titleFromText);
    }

    // PRIORITY 4: Extract skills (but only if we don't have good job titles)
    if (keywords.length < 2 && parsedData?.sections?.skills && Array.isArray(parsedData.sections.skills)) {
      const skills = parsedData.sections.skills;
      // Add top 3-5 most relevant skills
      keywords.push(...skills.slice(0, 5).filter((s: any) => s && typeof s === 'string' && s.length > 3));
    }

    // Remove duplicates and filter out common words
    const uniqueKeywords = Array.from(new Set(keywords))
      .filter(kw => kw && kw.length > 2)
      .filter(kw => !this.isCommonWord(kw))
      .filter(kw => !this.isGenericWord(kw));

    // Build search query (prioritize job titles)
    if (uniqueKeywords.length === 0) {
      // Last resort: try to extract ANY meaningful word from text
      const fallbackKeywords = this.extractFallbackKeywords(resumeText);
      if (fallbackKeywords.length > 0) {
        logger.warn(`Using fallback keywords: ${fallbackKeywords.join(' ')}`);
        return fallbackKeywords.slice(0, 3).join(' ');
      }
      logger.error('Could not extract any keywords from resume');
      return ''; // Return empty instead of wrong default
    }

    // Take top 2-3 keywords for search (prioritize job titles)
    const searchKeywords = uniqueKeywords.slice(0, 3).join(' ');

    logger.info(`Extracted keywords from resume: ${searchKeywords}`);

    return searchKeywords;
  }

  /**
   * Normalize job title for search (remove prefixes, keep main occupation)
   */
  private normalizeJobTitle(title: string): string {
    const commonPrefixes = ['senior', 'junior', 'lead', 'principal', 'associate', 'staff', 'head', 
                           'senior', 'junior', 'ledande', 'chef', 'ansvarig'];
    const words = title.toLowerCase().split(/\s+/);
    
    // Filter out common prefixes
    const meaningfulWords = words.filter(word => 
      !commonPrefixes.includes(word) && word.length > 3
    );
    
    // Return the most meaningful word(s) - usually 1-2 words
    if (meaningfulWords.length === 0) {
      return words[words.length - 1]; // Fallback to last word
    }
    
    return meaningfulWords.slice(0, 2).join(' '); // Max 2 words
  }

  /**
   * Extract job title directly from resume text using patterns
   */
  private extractJobTitleFromText(text: string): string | null {
    const lowerText = text.toLowerCase();
    
    // Pattern 1: Look for common Swedish job title patterns
    // "Ekonomiassistent", "Ekonom", "Redovisningsekonom", etc.
    const swedishJobTitles = [
      'ekonomiassistent', 'ekonom', 'redovisningsekonom', 'business controller',
      'ekonomiansvarig', 'ekonomist', 'revisor', 'revisorsassistent',
      'kreditanalytiker', 'finansanalytiker', 'budgetanalytiker',
      'bokförare', 'kassör', 'inköpare', 'säljare', 'säljchef',
      'marknadsförare', 'projektledare', 'projektchef', 'hr-specialist',
      'administratör', 'kundtjänst', 'logistik', 'produktionsledare',
      'lärare', 'lärare', 'kurator', 'psykolog', 'sjuksköterska',
      'utvecklare', 'programmerare', 'systemarkitekt', 'testare',
      'designer', 'grafiker', 'författare', 'journalist',
    ];
    
    for (const title of swedishJobTitles) {
      if (lowerText.includes(title)) {
        return title;
      }
    }
    
    // Pattern 2: Look for "Jag är [title]" or similar patterns
    const patternMatches = [
      /jag\s+är\s+([a-zåäö]+(?:\s+[a-zåäö]+){0,2})/i,
      /arbetar\s+som\s+([a-zåäö]+(?:\s+[a-zåäö]+){0,2})/i,
      /yrke[:\s]+([a-zåäö]+(?:\s+[a-zåäö]+){0,2})/i,
    ];
    
    for (const pattern of patternMatches) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const found = match[1].trim().toLowerCase();
        if (found.length > 3 && !this.isCommonWord(found)) {
          return found;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract fallback keywords when no clear job title found
   */
  private extractFallbackKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Look for any capitalized words that might be job titles or skills
    const capitalizedWords = text.match(/\b[A-ZÅÄÖ][a-zåäö]{4,}\b/g);
    if (capitalizedWords) {
      // Filter out common non-job words
      const excluded = ['Sverige', 'Stockholm', 'Göteborg', 'Malmö', 'Email', 'Telefon', 
                       'Adress', 'LinkedIn', 'Utbildning', 'Erfarenhet', 'Kompetens'];
      const meaningful = capitalizedWords
        .filter(w => !excluded.includes(w))
        .map(w => w.toLowerCase())
        .slice(0, 3);
      keywords.push(...meaningful);
    }
    
    return keywords;
  }

  /**
   * Check if word is generic and shouldn't be used for job search
   */
  private isGenericWord(word: string): boolean {
    const genericWords = [
      'arbete', 'arbetsliv', 'yrke', 'karriär', 'erfarenhet', 'kompetens',
      'färdigheter', 'kunskaper', 'projekt', 'uppdrag', 'ansvar', 'arbetsuppgifter',
      'företag', 'organisation', 'bransch', 'sektor',
    ];
    return genericWords.includes(word.toLowerCase());
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

