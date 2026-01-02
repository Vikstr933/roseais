import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeScoringService');

export interface ScoreFeedback {
  positives: string[];
  negatives: string[];
  tips: string[];
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  percentage: number;
  feedback: ScoreFeedback;
}

export interface ResumeScore {
  overallScore: number;
  atsScore: number; // 0-25, displayed as 0-100
  contentScore: number; // 0-30, displayed as 0-100
  keywordScore: number; // 0-20, displayed as 0-100
  presentationScore: number; // 0-15, displayed as 0-100
  completenessScore: number; // Keep for backwards compatibility, map to presentationScore
  improvements: Array<{
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  detailedFeedback?: {
    ats: CategoryScore;
    content: CategoryScore;
    keywords: CategoryScore;
    presentation: CategoryScore;
  };
}

export class ResumeScoringService {
  /**
   * Analyze resume and calculate scores using new 4-category system
   * Total: 90 points (25 ATS + 30 Content + 20 Keywords + 15 Presentation)
   */
  async analyzeResume(resumeText: string, parsedData?: any, fileType?: string): Promise<ResumeScore> {
    try {
      const fullText = resumeText || '';
      const parsed = parsedData || {};

      // Calculate all category scores
      const atsResult = this.calculateATSScore(fullText, parsed, fileType);
      const contentResult = this.calculateContentQualityScore(fullText, parsed);
      const keywordResult = this.calculateKeywordCoverageScore(fullText, parsed);
      const presentationResult = this.calculatePresentationScore(fullText, parsed);

      // Calculate overall score (convert to 0-100 scale)
      const totalPoints = atsResult.score + contentResult.score + keywordResult.score + presentationResult.score;
      const overallScore = Math.round((totalPoints / 90) * 100);

      // Generate improvements from feedback
      const improvements = this.generateImprovementsFromFeedback({
        ats: atsResult,
        content: contentResult,
        keywords: keywordResult,
        presentation: presentationResult,
      });

      return {
        overallScore,
        atsScore: Math.round((atsResult.score / 25) * 100), // Convert to 0-100 scale
        contentScore: Math.round((contentResult.score / 30) * 100),
        keywordScore: Math.round((keywordResult.score / 20) * 100),
        presentationScore: Math.round((presentationResult.score / 15) * 100),
        completenessScore: Math.round((presentationResult.score / 15) * 100), // Backwards compat
        improvements,
        detailedFeedback: {
          ats: atsResult,
          content: contentResult,
          keywords: keywordResult,
          presentation: presentationResult,
        },
      };
    } catch (error) {
      logger.error('Failed to analyze resume', error as Error);
      throw error;
    }
  }

  /**
   * 1. ATS-vänlighet (25 poäng max)
   */
  private calculateATSScore(text: string, parsedData: any, fileType?: string): CategoryScore {
    let score = 0;
    const feedback: ScoreFeedback = { positives: [], negatives: [], tips: [] };

    // A. Dokumentstruktur (10p)
    const sections = parsedData.sections || {};
    const requiredSections = {
      contact: { name: 'Kontaktuppgifter', points: 1, key: 'contactInfo' },
      experience: { name: 'Arbetslivserfarenhet', points: 1, key: 'experience' },
      education: { name: 'Utbildning', points: 1, key: 'education' },
      skills: { name: 'Kompetenser', points: 1, key: 'skills' },
      languages: { name: 'Språk', points: 1, key: 'languages' },
    };

    // Check for sections
    let sectionsFound = 0;
    for (const [key, info] of Object.entries(requiredSections)) {
      const sectionKey = info.key as keyof typeof sections;
      if (sections[sectionKey] && (
        Array.isArray(sections[sectionKey]) ? sections[sectionKey].length > 0 : true
      )) {
        score += info.points;
        sectionsFound++;
        feedback.positives.push(`${info.name} sektion identifierad`);
      } else {
        feedback.negatives.push(`${info.name} sektion saknas eller svår att identifiera`);
        feedback.tips.push(`Lägg till tydlig rubrik för ${info.name}`);
      }
    }

    // Logisk ordning (5p)
    const textLower = text.toLowerCase();
    const sectionKeywords = {
      contact: ['kontakt', 'telefon', 'email', 'adress', 'mobil'],
      experience: ['erfarenhet', 'arbete', 'anställning', 'anställd'],
      education: ['utbildning', 'skola', 'universitet', 'examen'],
      skills: ['kompetenser', 'färdigheter', 'skills', 'kunskaper'],
    };

    // Find section positions in text
    const sectionPositions: { [key: string]: number } = {};
    for (const [key, keywords] of Object.entries(sectionKeywords)) {
      for (const keyword of keywords) {
        const index = textLower.indexOf(keyword);
        if (index !== -1 && (!sectionPositions[key] || index < sectionPositions[key])) {
          sectionPositions[key] = index;
        }
      }
    }

    // Contact first (2p)
    const contactPos = sectionPositions.contact ?? Infinity;
    const otherFirstPos = Math.min(
      sectionPositions.experience ?? Infinity,
      sectionPositions.education ?? Infinity,
      sectionPositions.skills ?? Infinity
    );
    if (contactPos < otherFirstPos) {
      score += 2;
      feedback.positives.push('Kontaktuppgifter placerade först');
    }

    // Experience before/after education based on seniority (2p)
    const experiencePos = sectionPositions.experience ?? Infinity;
    const educationPos = sectionPositions.education ?? Infinity;
    const yearsExp = this.estimateYearsOfExperience(parsedData);
    if (yearsExp > 3 && experiencePos < educationPos) {
      score += 2;
      feedback.positives.push('Erfarenhet placerad före utbildning (senior)');
    } else if (yearsExp <= 3 && educationPos < experiencePos) {
      score += 2;
      feedback.positives.push('Utbildning placerad före erfarenhet (junior)');
    }

    // Skills easy to find (1p)
    const skillsPos = sectionPositions.skills ?? Infinity;
    const textLength = text.length;
    if (skillsPos > textLength * 0.3) { // In last 70% of text
      score += 1;
      feedback.positives.push('Kompetenser lätt att hitta');
    }

    // B. Formateringsenkelheten (8p)
    // Text-based parsing (4p)
    if (text.trim().length > 100) {
      score += 2;
      feedback.positives.push('Text kan extraheras korrekt');
    } else {
      feedback.negatives.push('Textextraktion problematisk');
      feedback.tips.push('Undvik skannade dokument - använd digitalt skapade PDF:er');
    }

    // Check for tables
    const hasTables = /\|\s*\|/.test(text) || /┌.*┐/.test(text);
    if (!hasTables) {
      score += 2;
      feedback.positives.push('Inga komplexa tabeller');
    } else {
      feedback.negatives.push('Komplexa tabeller kan förvirra ATS');
      feedback.tips.push('Ersätt tabeller med enkel punktlista');
    }

    // Font and style (4p) - Simplified check
    const standardFonts = ['arial', 'calibri', 'times', 'helvetica', 'georgia'];
    const hasStandardFormatting = text.length > 0; // Assume standard if text is parseable
    if (hasStandardFormatting) {
      score += 2;
      feedback.positives.push('Standardformatering används');
    } else {
      feedback.tips.push('Använd standardfonter som Arial eller Calibri');
    }

    // Check for text in images (simplified - check for special characters that might indicate images)
    const hasImageText = /[🖼️📷🖨️]/.test(text) || text.length < 500; // Heuristic
    if (!hasImageText) {
      score += 2;
      feedback.positives.push('Ingen text i bilder');
    } else {
      feedback.negatives.push('Text i bilder kan inte läsas av ATS');
      feedback.tips.push('Flytta all text från bilder till vanlig text');
    }

    // C. Filformat (4p)
    const fileFormat = (fileType || 'pdf').toLowerCase();
    if (fileFormat === 'pdf' && text.length > 200) {
      score += 4; // Assume PDF with text layer if we have substantial text
      feedback.positives.push('PDF med text-layer');
    } else if (fileFormat === 'docx') {
      score += 4;
      feedback.positives.push('DOCX-format används');
    } else if (fileFormat === 'pdf' && text.length < 200) {
      score += 1;
      feedback.negatives.push('PDF verkar vara skannad');
      feedback.tips.push('Använd PDF med text-layer eller DOCX');
    } else if (fileFormat === 'tex') {
      score += 3;
      feedback.positives.push('LaTeX-format (konverterat korrekt)');
    }

    // D. Specifikationskrav (3p)
    // Check for columns (simplified)
    const hasColumns = text.includes('│') || (text.match(/\s{10,}/g)?.length ?? 0) > 10;
    if (!hasColumns) {
      score += 1;
      feedback.positives.push('Enkel layoutstruktur');
    } else {
      feedback.negatives.push('Text i kolumner kan läsas fel av ATS');
      feedback.tips.push('Använd enkolumnslayout');
    }

    // Check for header/footer (simplified - look for page numbers or repeated headers)
    const hasHeaderFooter = /^\d+\s*$/m.test(text) || (text.match(/^[A-Z\s]{20,}$/gm)?.length ?? 0) > 3;
    if (!hasHeaderFooter) {
      score += 1;
    } else {
      feedback.negatives.push('Viktig information i sidhuvud/sidfot');
      feedback.tips.push('Flytta kontaktuppgifter till dokumentets början');
    }

    // Date formats (1p)
    const dateFormats = this.extractDateFormats(text);
    if (dateFormats.size <= 2) {
      score += 1;
      feedback.positives.push('Konsekvent datumformatering');
    } else {
      feedback.tips.push("Använd samma datumformat överallt (t.ex. 'Jan 2020 - Dec 2023')");
    }

    return {
      score: Math.min(score, 25),
      maxScore: 25,
      percentage: Math.round((score / 25) * 100),
      feedback,
    };
  }

  /**
   * 2. Innehållskvalitet (30 poäng max)
   */
  private calculateContentQualityScore(text: string, parsedData: any): CategoryScore {
    let score = 0;
    const feedback: ScoreFeedback = { positives: [], negatives: [], tips: [] };

    const textLower = text.toLowerCase();
    const experienceText = this.extractExperienceText(text, parsedData);

    // A. Mätbara resultat (12p)
    const achievements = this.extractAchievementsWithMetrics(experienceText);
    const quantifiedCount = achievements.length;
    const metricsPoints = Math.min(quantifiedCount, 8);
    score += metricsPoints;

    if (quantifiedCount >= 5) {
      feedback.positives.push(`Bra användning av mätbara resultat (${quantifiedCount} hittade)`);
    } else if (quantifiedCount > 0) {
      feedback.negatives.push(`Endast ${quantifiedCount} mätbara resultat`);
      feedback.tips.push('Lägg till siffror: Hur många? Hur mycket? Hur stor förbättring?');
    } else {
      feedback.negatives.push('Inga kvantifierade prestationer');
      feedback.tips.push("Exempel: 'Ökade försäljningen med 25%' istället för 'Ökade försäljningen'");
    }

    // Konkreta exempel (4p)
    const concreteExamples = this.extractConcreteProjects(experienceText);
    score += Math.min(concreteExamples.length, 4);

    if (concreteExamples.length < 2) {
      feedback.tips.push('Nämn specifika projekt eller initiativ du drivit');
    }

    // B. Aktiva verb (8p)
    const strongVerbs = [
      'utvecklade', 'ledde', 'implementerade', 'ökade', 'förbättrade',
      'skapade', 'byggde', 'optimerade', 'koordinerade', 'etablerade',
      'lanserade', 'drev', 'genomförde', 'utformade', 'initierade',
      'genomför', 'utvecklar', 'leder', 'implementerar', 'förbättrar',
    ];

    let verbCount = 0;
    for (const verb of strongVerbs) {
      const regex = new RegExp(`\\b${verb}\\w*\\b`, 'gi');
      const matches = experienceText.match(regex);
      if (matches) verbCount += matches.length;
    }

    if (verbCount >= 10) {
      score += 5;
      feedback.positives.push('Bra användning av aktiva verb');
    } else if (verbCount >= 7) {
      score += 4;
    } else if (verbCount >= 4) {
      score += 3;
      feedback.tips.push("Använd fler aktiva verb som 'utvecklade', 'ledde', 'implementerade'");
    } else if (verbCount >= 1) {
      score += 2;
      feedback.negatives.push('Få aktiva verb används');
      feedback.tips.push("Börja meningar med starka verb istället för 'Ansvarig för'");
    } else {
      feedback.negatives.push('Inga starka aktiva verb');
      feedback.tips.push('Använd kraftfulla verb: Utvecklade, Ledde, Ökade, Förbättrade');
    }

    // Undvik svaga formuleringar (3p)
    const weakPhrases = ['ansvarig för', 'hjälpte till med', 'arbetade med', 'delade ansvar'];
    let weakCount = 0;
    for (const phrase of weakPhrases) {
      const regex = new RegExp(phrase, 'gi');
      const matches = experienceText.match(regex);
      if (matches) weakCount += matches.length;
    }

    if (weakCount === 0) {
      score += 2;
      feedback.positives.push('Undviker svaga formuleringar');
    } else {
      feedback.negatives.push(`Använder svaga fraser (${weakCount} gånger)`);
      feedback.tips.push("Ersätt 'Ansvarig för X' med 'Ledde X' eller 'Utvecklade X'");
    }

    // Passiv röst (1p)
    const passiveIndicators = ['blev', 'var ansvarig', 'har varit', 'var involverad'];
    let passiveCount = 0;
    for (const indicator of passiveIndicators) {
      const regex = new RegExp(indicator, 'gi');
      const matches = experienceText.match(regex);
      if (matches) passiveCount += matches.length;
    }

    if (passiveCount <= 2) {
      score += 1;
    }

    // C. Branschrelevans (6p) - Simplified, assumes general industry
    const industryKeywords = this.getIndustryKeywords('general');
    const matchedKeywords = industryKeywords.filter(kw => textLower.includes(kw.toLowerCase()));
    const relevanceScore = Math.min(matchedKeywords.length / 10, 1.0);
    const industryPoints = Math.round(relevanceScore * 4);
    score += industryPoints;

    if (industryPoints >= 3) {
      feedback.positives.push('Bra branschrelevanta termer');
    } else {
      feedback.negatives.push('Få branschspecifika termer');
      feedback.tips.push('Inkludera fler relevanta branschtermer');
    }

    // Professionell ton (2p)
    const informalWords = ['typ', 'liksom', 'massa', 'ganska', 'rätt så', 'super'];
    let informalCount = 0;
    for (const word of informalWords) {
      if (textLower.includes(word)) informalCount++;
    }

    if (informalCount === 0) {
      score += 1;
    } else {
      feedback.tips.push('Undvik informellt språk i CV:t');
    }

    if (matchedKeywords.length > 0) {
      score += 1;
    }

    // D. Karriärsprogression (4p)
    const positions = parsedData.sections?.experience || [];
    if (positions.length >= 2) {
      const seniorityLevels: { [key: string]: number } = {
        junior: 1, medarbetare: 2, senior: 3,
        specialist: 3, lead: 4, chef: 5, manager: 4,
        director: 5, vd: 6, ceo: 6, 'chief': 5,
      };

      const positionLevels: number[] = [];
      for (const pos of positions) {
        const title = (pos.title || pos.position || '').toLowerCase();
        const level = Object.entries(seniorityLevels).find(([key]) => title.includes(key))?.[1] || 2;
        positionLevels.push(level);
      }

      positionLevels.reverse(); // Newest first in CV

      let progression = true;
      for (let i = 0; i < positionLevels.length - 1; i++) {
        if (positionLevels[i] > positionLevels[i + 1]) {
          progression = false;
          break;
        }
      }

      if (progression) {
        score += 2;
        feedback.positives.push('Tydlig karriärsutveckling');
      } else {
        feedback.tips.push('Försök visa tydlig karriärsprogression i dina roller');
      }

      // Logisk progression (2p)
      const industries = positions.map((p: any) => p.industry || p.sector || '').filter(Boolean);
      if (new Set(industries).size <= 2) {
        score += 1;
        feedback.positives.push('Konsekvent branschfokus');
      }

      score += 1; // Assume no major gaps
    }

    return {
      score: Math.min(score, 30),
      maxScore: 30,
      percentage: Math.round((score / 30) * 100),
      feedback,
    };
  }

  /**
   * 3. Nyckelordstäckning (20 poäng max)
   */
  private calculateKeywordCoverageScore(text: string, parsedData: any): CategoryScore {
    let score = 0;
    const feedback: ScoreFeedback = { positives: [], negatives: [], tips: [] };

    const textLower = text.toLowerCase();
    const skills = (parsedData.sections?.skills || []).map((s: any) => 
      typeof s === 'string' ? s.toLowerCase() : (s.name || s).toLowerCase()
    );

    // A. Tekniska kompetenser (8p)
    const techKeywords = this.getTechKeywords('general');
    const matchedTech = techKeywords.filter(kw => 
      textLower.includes(kw.toLowerCase()) || skills.some((s: string) => s.includes(kw.toLowerCase()))
    );
    const techScore = Math.min(matchedTech.length, 8);
    score += techScore;

    if (techScore >= 6) {
      feedback.positives.push(`Bra täckning av tekniska kompetenser (${matchedTech.length} hittade)`);
    } else if (techScore >= 3) {
      feedback.negatives.push(`Endast ${matchedTech.length} tekniska nyckelord`);
      feedback.tips.push('Lägg till fler relevanta verktyg och teknologier');
    } else {
      feedback.negatives.push('Få tekniska nyckelord');
      feedback.tips.push("Var specifik med verktyg: 'Python, React, AWS' istället för 'programmering'");
    }

    // B. Mjuka kompetenser (4p)
    const softSkills = [
      'ledarskap', 'leadership', 'kommunikation', 'problemlösning',
      'teamwork', 'analytisk', 'kreativ', 'strategisk', 'projektledning',
      'samarbete', 'flexibilitet', 'initiativ',
    ];

    const matchedSoft = softSkills.filter(skill => textLower.includes(skill));
    const softScore = Math.min(matchedSoft.length, 4);
    score += softScore;

    if (softScore >= 3) {
      feedback.positives.push('Bra balans av mjuka kompetenser');
    } else {
      feedback.tips.push('Inkludera relevanta mjuka kompetenser som ledarskap eller kommunikation');
    }

    // C. Certifieringar (4p)
    const certifications = this.extractCertifications(text, parsedData);
    if (certifications.length >= 3) {
      score += 3;
      feedback.positives.push(`${certifications.length} certifieringar listade`);
    } else if (certifications.length > 0) {
      score += certifications.length;
      feedback.tips.push('Fler branschrelevanta certifieringar stärker CV:t');
    } else {
      feedback.negatives.push('Inga certifieringar nämnda');
      feedback.tips.push('Lägg till relevanta certifieringar om du har några');
    }

    // Utmärkelser (1p)
    const awards = this.extractAwards(text);
    if (awards.length > 0) {
      score += 1;
      feedback.positives.push('Utmärkelser inkluderade');
    }

    // D. Branschterminologi (4p)
    const industryTerms = this.getIndustryTerminology('general');
    const matchedTerms = industryTerms.filter(term => textLower.includes(term.toLowerCase()));
    const terminologyScore = Math.min(Math.floor(matchedTerms.length / 3), 4);
    score += terminologyScore;

    if (terminologyScore >= 3) {
      feedback.positives.push('Använder branschspecifik terminologi');
    } else {
      feedback.tips.push('Använd mer branschspecifika termer');
    }

    return {
      score: Math.min(score, 20),
      maxScore: 20,
      percentage: Math.round((score / 20) * 100),
      feedback,
    };
  }

  /**
   * 4. Professionell Presentation (15 poäng max)
   */
  private calculatePresentationScore(text: string, parsedData: any): CategoryScore {
    let score = 0;
    const feedback: ScoreFeedback = { positives: [], negatives: [], tips: [] };

    // A. Längd (4p)
    const yearsExp = this.estimateYearsOfExperience(parsedData);
    const estimatedPages = Math.ceil(text.length / 2000); // Rough estimate: ~2000 chars per page

    if (yearsExp <= 5) {
      if (estimatedPages === 1) {
        score += 4;
        feedback.positives.push('Optimal längd för din erfarenhetsnivå (1 sida)');
      } else if (estimatedPages === 2) {
        score += 2;
        feedback.tips.push('För din erfarenhetsnivå bör CV:t vara 1 sida');
      }
    } else if (yearsExp <= 10) {
      if (estimatedPages === 2) {
        score += 4;
        feedback.positives.push('Optimal längd (2 sidor)');
      } else if (estimatedPages === 1) {
        score += 2;
        feedback.tips.push('Överväg att utöka till 2 sidor');
      } else if (estimatedPages >= 3) {
        score += 1;
        feedback.tips.push('CV:t är långt - överväg att förkorta');
      }
    } else {
      if (estimatedPages >= 2 && estimatedPages <= 3) {
        score += 4;
        feedback.positives.push('Optimal längd (2-3 sidor)');
      } else if (estimatedPages === 1) {
        score += 1;
        feedback.tips.push('Överväg att utöka CV:t');
      }
    }

    // B. Formatering och layout (5p)
    // Konsistent formatering (3p) - Simplified checks
    const hasConsistentHeaders = /^[A-ZÅÄÖ\s]{3,}$/gm.test(text);
    if (hasConsistentHeaders) {
      score += 1;
      feedback.positives.push('Konsekvent rubrikformatering');
    }

    const bulletPoints = (text.match(/^[\s]*[•\-\*]\s/gm) || []).length;
    if (bulletPoints > 0) {
      score += 1;
      feedback.positives.push('Använder punktlistor konsekvent');
    }

    score += 1; // Assume consistent spacing
    feedback.positives.push('Konsekvent spacing');

    // White space (2p)
    const lineCount = text.split('\n').length;
    const avgLineLength = text.length / lineCount;
    if (avgLineLength > 40 && avgLineLength < 80) {
      score += 2;
      feedback.positives.push('Lagom med whitespace');
    } else {
      score += 1;
      feedback.tips.push('Se till att ha lagom med whitespace');
    }

    // C. Språklig kvalitet (4p)
    // Spelling and grammar (3p) - Simplified: check for common errors
    const commonErrors = ['försäljning', 'försäljning', 'ansvarig']; // Placeholder
    let errorCount = 0;
    // In a real implementation, use a spell checker
    // For now, assume minimal errors if text is substantial
    if (text.length > 500) {
      score += 2; // Assume reasonable quality
      feedback.positives.push('God språklig kvalitet');
    } else {
      errorCount = 1;
      score += 1;
    }

    // Swedish language (1p)
    const hasSwedish = /[åäöÅÄÖ]/.test(text) || text.toLowerCase().includes('och') || text.toLowerCase().includes('är');
    if (hasSwedish) {
      score += 1;
    }

    // D. Visuell hierarki (2p)
    // Easy to scan (1p)
    if (bulletPoints > 5 || hasConsistentHeaders) {
      score += 1;
      feedback.positives.push('Lätt att skanna');
    }

    // Logical information flow (1p)
    score += 1;
    feedback.positives.push('Logiskt informationsflöde');

    return {
      score: Math.min(score, 15),
      maxScore: 15,
      percentage: Math.round((score / 15) * 100),
      feedback,
    };
  }

  // Helper methods
  private estimateYearsOfExperience(parsedData: any): number {
    const experiences = parsedData.sections?.experience || [];
    if (experiences.length === 0) return 0;

    // Try to parse dates and calculate
    let totalMonths = 0;
    for (const exp of experiences) {
      const dates = exp.dates || exp.period || '';
      // Simple heuristic: if dates exist, assume at least 12 months
      if (dates) totalMonths += 12;
      else totalMonths += 6; // Default
    }

    return Math.floor(totalMonths / 12);
  }

  private extractExperienceText(text: string, parsedData: any): string {
    const experiences = parsedData.sections?.experience || [];
    if (experiences.length > 0) {
      return experiences.map((e: any) => {
        // Handle description/responsibilities - can be string or array
        let desc = e.description || e.responsibilities || '';
        if (Array.isArray(desc)) {
          desc = desc.join(' ');
        } else if (typeof desc !== 'string') {
          desc = String(desc || '');
        }
        return desc;
      }).join(' ');
    }
    
    // Fallback: extract from text
    const expMatch = text.match(/(?:erfarenhet|arbete|anställning)[\s\S]{0,2000}/i);
    return expMatch ? expMatch[0] : text;
  }

  private extractAchievementsWithMetrics(text: string): string[] {
    // Look for patterns like "increased by X%", "led team of X", numbers with units
    const patterns = [
      /\d+\s*%/g,
      /\d+\s*(personer|människor|kunder|projekt|år|månader)/gi,
      /(ökade|förbättrade|reducerade)\s+.*?\d+/gi,
    ];

    const achievements: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) achievements.push(...matches);
    }

    return achievements;
  }

  private extractConcreteProjects(text: string): string[] {
    // Look for project names, initiatives
    const projectKeywords = ['projekt', 'initiativ', 'kampanj', 'system', 'plattform'];
    const projects: string[] = [];
    
    for (const keyword of projectKeywords) {
      const regex = new RegExp(`${keyword}[^.]{0,100}`, 'gi');
      const matches = text.match(regex);
      if (matches) projects.push(...matches.slice(0, 2));
    }

    return projects.slice(0, 4);
  }

  private extractCertifications(text: string, parsedData: any): string[] {
    const certs: string[] = [];
    const certKeywords = ['certifierad', 'certifikat', 'certifiering', 'licens'];
    
    for (const keyword of certKeywords) {
      const regex = new RegExp(`${keyword}[^.]{0,100}`, 'gi');
      const matches = text.match(regex);
      if (matches) certs.push(...matches);
    }

    return certs;
  }

  private extractAwards(text: string): string[] {
    const awards: string[] = [];
    const awardKeywords = ['utmärkelse', 'pris', 'award', 'recognition'];
    
    for (const keyword of awardKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        awards.push(keyword);
      }
    }

    return awards;
  }

  private extractDateFormats(text: string): Set<string> {
    const formats = new Set<string>();
    const patterns = [
      /\d{4}-\d{2}-\d{2}/g,
      /\d{2}\/\d{4}/g,
      /\d{4}/g,
      /[A-Za-z]{3}\s+\d{4}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) formats.add(pattern.source);
    }

    return formats;
  }

  private getIndustryKeywords(industry: string): string[] {
    const keywords: { [key: string]: string[] } = {
      tech: ['python', 'java', 'react', 'aws', 'agile', 'scrum', 'api', 'docker'],
      marketing: ['seo', 'kampanj', 'content', 'social media', 'analytics'],
      sales: ['försäljning', 'kundrelationer', 'crm', 'b2b'],
      general: ['projekt', 'team', 'utveckling', 'samarbete', 'kommunikation'],
    };
    return keywords[industry] || keywords.general;
  }

  private getTechKeywords(industry: string): string[] {
    const keywords: { [key: string]: string[] } = {
      tech: ['python', 'java', 'javascript', 'react', 'node.js', 'aws', 'sql', 'git'],
      marketing: ['google analytics', 'seo', 'photoshop', 'canva'],
      sales: ['salesforce', 'crm', 'hubspot'],
      general: ['microsoft office', 'excel', 'powerpoint', 'google workspace'],
    };
    return keywords[industry] || keywords.general;
  }

  private getIndustryTerminology(industry: string): string[] {
    const terms: { [key: string]: string[] } = {
      tech: ['agile', 'scrum', 'ci/cd', 'microservices', 'devops'],
      marketing: ['content marketing', 'conversion rate', 'lead generation'],
      sales: ['b2b', 'pipeline', 'customer success'],
      general: ['stakeholder', 'kpi', 'roi', 'budget'],
    };
    return terms[industry] || terms.general;
  }

  private generateImprovementsFromFeedback(feedback: {
    ats: CategoryScore;
    content: CategoryScore;
    keywords: CategoryScore;
    presentation: CategoryScore;
  }): ResumeScore['improvements'] {
    const improvements: ResumeScore['improvements'] = [];

    // Convert feedback to improvements
    const categories = [
      { key: 'ats', name: 'ATS-vänlighet', score: feedback.ats },
      { key: 'content', name: 'Innehållskvalitet', score: feedback.content },
      { key: 'keywords', name: 'Nyckelordstäckning', score: feedback.keywords },
      { key: 'presentation', name: 'Professionell presentation', score: feedback.presentation },
    ];

    for (const category of categories) {
      const tips = category.score.feedback.tips;
      const negatives = category.score.feedback.negatives;

      // High priority if score < 50%
      const priority: 'low' | 'medium' | 'high' = 
        category.score.percentage < 50 ? 'high' : 
        category.score.percentage < 70 ? 'medium' : 'low';

      // Add top 2 tips as improvements
      for (let i = 0; i < Math.min(2, tips.length); i++) {
        improvements.push({
          type: category.key,
          title: `${category.name}: ${tips[i].substring(0, 50)}`,
          description: tips[i],
          priority,
        });
      }

      // Add negatives as high priority improvements
      for (const negative of negatives.slice(0, 1)) {
        improvements.push({
          type: category.key,
          title: `${category.name}: ${negative.substring(0, 50)}`,
          description: negative,
          priority: 'high',
        });
      }
    }

    return improvements.slice(0, 10); // Max 10 improvements
  }
}

export const resumeScoringService = new ResumeScoringService();
