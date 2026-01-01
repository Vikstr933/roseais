import { multiModelAI } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeImprovementService');

export interface ImprovementAction {
  type: 'add_section' | 'update_text' | 'add_keywords' | 'fix_contact';
  section?: string;
  content: string;
  position?: 'before' | 'after';
  targetSection?: string;
}

export class ResumeImprovementService {
  /**
   * Apply a specific improvement suggestion to the resume
   */
  async applyImprovement(
    resumeText: string,
    parsedData: any,
    improvementType: string,
    improvementDescription: string
  ): Promise<{ updatedText: string; updatedParsedData: any }> {
    try {
      logger.info(`Applying improvement: ${improvementType}`);

      let updatedText = resumeText;
      let updatedParsedData = { ...parsedData };

      switch (improvementType.toLowerCase()) {
        case 'add_education':
        case 'lägg till utbildning':
          const educationAddition = await this.generateEducationSection(resumeText, parsedData);
          updatedText = this.insertSection(updatedText, 'UTBILDNING', educationAddition);
          break;

        case 'fix_contact':
        case 'komplettera kontaktinformation':
          updatedText = await this.fixContactInformation(updatedText, parsedData);
          break;

        case 'add_keywords':
        case 'utöka nyckelordstäckning':
          updatedText = await this.addKeywords(updatedText, improvementDescription, parsedData);
          break;

        case 'improve_summary':
        case 'förbättra sammanfattningen':
          updatedText = await this.improveSummary(updatedText, parsedData);
          break;

        case 'add_languages':
        case 'lägg till språkkunskaper':
          const languagesAddition = await this.generateLanguagesSection(resumeText, parsedData);
          updatedText = this.insertSection(updatedText, 'SPRÅKKUNSKAPER', languagesAddition);
          break;

        default:
          // Generic AI-powered improvement
          updatedText = await this.applyGenericImprovement(updatedText, improvementDescription);
      }

      // Re-parse the updated text to get fresh parsedData
      // For now, we'll try to merge manually
      updatedParsedData = this.mergeParsedData(parsedData, updatedText);

      return { updatedText, updatedParsedData };
    } catch (error) {
      logger.error('Failed to apply improvement', error as Error);
      throw error;
    }
  }

  /**
   * Generate education section using AI
   */
  private async generateEducationSection(resumeText: string, parsedData: any): Promise<string> {
    const prompt = `Baserat på följande CV-text, generera en UTBILDNING sektion på svenska. 
Om ingen utbildning nämns explicit, skapa en realistisk utbildning som passar för yrket.
CV-text:
${resumeText.substring(0, 2000)}

Generera en kort UTBILDNING sektion (2-4 rader) på svenska.`;

    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: 'Du är expert på att skriva CV-sektioner på svenska. Var kortfattad och professionell.',
      maxTokens: 300,
      temperature: 0.7,
      useCase: 'code_generation',
      priority: 'quality',
    });

    return response.content.trim();
  }

  /**
   * Generate languages section using AI
   */
  private async generateLanguagesSection(resumeText: string, parsedData: any): Promise<string> {
    const prompt = `Baserat på följande CV-text, generera en SPRÅKKUNSKAPER sektion på svenska.
CV-text:
${resumeText.substring(0, 2000)}

Generera en kort SPRÅKKUNSKAPER sektion (2-3 rader) med språk och nivåer.`;

    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: 'Du är expert på att skriva CV-sektioner på svenska.',
      maxTokens: 200,
      temperature: 0.7,
      useCase: 'code_generation',
      priority: 'quality',
    });

    return response.content.trim();
  }

  /**
   * Fix contact information
   */
  private async fixContactInformation(resumeText: string, parsedData: any): Promise<string> {
    // Extract what needs to be fixed from parsedData
    const emailRegex = /E-post[:]?\s*([^\n]*)/i;
    const linkedinRegex = /LinkedIn[:]?\s*([^\n]*)/i;

    let updatedText = resumeText;

    // Fix incomplete email
    if (emailRegex.test(updatedText) && !/@/.test(updatedText.match(emailRegex)?.[1] || '')) {
      updatedText = updatedText.replace(emailRegex, (match) => {
        // Keep placeholder but improve format
        return match.replace(/E-post[:]?\s*/i, 'E-post: [lägg till din e-postadress]');
      });
    }

    // Fix incomplete LinkedIn
    if (linkedinRegex.test(updatedText) && !/linkedin\.com/.test(updatedText.match(linkedinRegex)?.[1] || '')) {
      updatedText = updatedText.replace(linkedinRegex, (match) => {
        return match.replace(/LinkedIn[:]?\s*/i, 'LinkedIn: [lägg till din LinkedIn-profil]');
      });
    }

    return updatedText;
  }

  /**
   * Add keywords to resume
   */
  private async addKeywords(resumeText: string, improvementDescription: string, parsedData: any): Promise<string> {
    // Extract suggested keywords from improvement description
    const keywordMatch = improvementDescription.match(/'([^']+)'/g);
    const suggestedKeywords = keywordMatch ? keywordMatch.map(k => k.replace(/'/g, '')) : [];

    if (suggestedKeywords.length === 0) {
      return resumeText; // No keywords to add
    }

    // Find skills section or add one
    const skillsSectionRegex = /(?:Skills|Kompetenser|Färdigheter)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-ZÅÄÖ])/i;
    
    if (skillsSectionRegex.test(resumeText)) {
      // Add to existing skills section
      updatedText = resumeText.replace(skillsSectionRegex, (match, skills) => {
        const existingSkills = skills.split(/[,;•\n]/).map((s: string) => s.trim()).filter(Boolean);
        const newSkills = [...new Set([...existingSkills, ...suggestedKeywords])];
        return match.replace(skills, newSkills.join(', '));
      });
      return updatedText;
    } else {
      // Add new skills section after summary or at beginning
      const newSkillsSection = `KOMPETENSER\n${suggestedKeywords.join(', ')}\n\n`;
      const summaryEnd = resumeText.search(/(?:Summary|Sammanfattning|Profil)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-ZÅÄÖ])/i);
      if (summaryEnd > 0) {
        const insertPos = resumeText.indexOf('\n\n', summaryEnd);
        return resumeText.slice(0, insertPos + 2) + newSkillsSection + resumeText.slice(insertPos + 2);
      }
      return newSkillsSection + resumeText;
    }
  }

  /**
   * Improve summary section
   */
  private async improveSummary(resumeText: string, parsedData: any): Promise<string> {
    const summaryRegex = /(?:Summary|Sammanfattning|Profil)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n(?:Experience|Erfarenhet|Education|Utbildning|Skills|Kompetenser))/i;
    const summaryMatch = resumeText.match(summaryRegex);

    if (!summaryMatch) {
      // No summary found, generate one
      const newSummary = await this.generateSummary(resumeText, parsedData);
      const contactEnd = resumeText.search(/(?:Email|E-post|Telefon|Phone)[:\s]*[^\n]+/i);
      if (contactEnd > 0) {
        const insertPos = resumeText.indexOf('\n', contactEnd);
        return resumeText.slice(0, insertPos + 1) + '\n' + newSummary + '\n\n' + resumeText.slice(insertPos + 1);
      }
      return newSummary + '\n\n' + resumeText;
    }

    const currentSummary = summaryMatch[1];
    const prompt = `Förbättra följande CV-sammanfattning. Gör den mer specifik, inkludera färdigheter och branschexpertis. 3-4 meningar.
Nuvarande sammanfattning:
${currentSummary}

CV-text (för kontext):
${resumeText.substring(0, 1500)}

Generera förbättrad sammanfattning på svenska:`;

    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: 'Du är expert på att skriva CV-sammanfattningar på svenska. Var specifik och professionell.',
      maxTokens: 300,
      temperature: 0.7,
      useCase: 'code_generation',
      priority: 'quality',
    });

    const improvedSummary = 'SAMMANFATTNING\n' + response.content.trim();
    return resumeText.replace(summaryMatch[0], improvedSummary);
  }

  /**
   * Generate summary section
   */
  private async generateSummary(resumeText: string, parsedData: any): Promise<string> {
    const prompt = `Baserat på följande CV-text, generera en professionell SAMMANFATTNING sektion på svenska (3-4 meningar).
CV-text:
${resumeText.substring(0, 2000)}`;

    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: 'Du är expert på att skriva CV-sammanfattningar på svenska.',
      maxTokens: 300,
      temperature: 0.7,
      useCase: 'code_generation',
      priority: 'quality',
    });

    return 'SAMMANFATTNING\n' + response.content.trim();
  }

  /**
   * Apply generic improvement using AI
   */
  private async applyGenericImprovement(resumeText: string, improvementDescription: string): Promise<string> {
    const prompt = `Förbättra följande CV-text enligt beskrivningen. Behåll all befintlig information och struktur.
Beskrivning av förbättringen:
${improvementDescription}

Nuvarande CV-text:
${resumeText.substring(0, 3000)}

Generera förbättrad CV-text på svenska:`;

    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: 'Du är expert på att förbättra CV:n på svenska. Behåll all information men gör den bättre.',
      maxTokens: 2000,
      temperature: 0.7,
      useCase: 'code_generation',
      priority: 'quality',
    });

    return response.content.trim();
  }

  /**
   * Insert a new section into resume text
   */
  private insertSection(text: string, sectionName: string, content: string, position: 'before' | 'after' = 'after', targetSection?: string): string {
    const sectionHeader = `${sectionName.toUpperCase()}\n${content}\n\n`;

    if (targetSection) {
      const targetRegex = new RegExp(`(${targetSection}[:\s]*[^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-ZÅÄÖ])`, 'i');
      const match = text.match(targetRegex);
      if (match) {
        const insertPos = position === 'after' 
          ? match.index! + match[0].length
          : match.index!;
        return text.slice(0, insertPos) + (position === 'before' ? sectionHeader : '\n\n' + sectionHeader) + text.slice(insertPos);
      }
    }

    // Default: insert after contact info or at beginning
    const contactEnd = text.search(/(?:Email|E-post|Telefon|Phone|LinkedIn)[:\s]*[^\n]+/i);
    if (contactEnd > 0) {
      const insertPos = text.indexOf('\n\n', contactEnd) || text.indexOf('\n', contactEnd);
      return text.slice(0, insertPos + 1) + '\n' + sectionHeader + text.slice(insertPos + 1);
    }

    return sectionHeader + text;
  }

  /**
   * Merge parsed data (simplified - would need proper re-parsing in production)
   */
  private mergeParsedData(original: any, updatedText: string): any {
    // This is a simplified version - in production, you'd re-parse the text
    return original;
  }
}

export const resumeImprovementService = new ResumeImprovementService();

