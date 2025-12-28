import { multiModelAI } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeAdaptationService');

export interface AdaptedResume {
  rawText: string;
  parsedData: {
    contactInfo?: any;
    sections?: {
      summary?: string;
      experience?: Array<{
        title: string;
        company: string;
        dates?: string;
        description?: string;
      }>;
      education?: Array<{
        degree: string;
        school: string;
        dates?: string;
      }>;
      skills?: string[];
    };
  };
  improvements: string[];
  adaptationNotes: string;
}

export class ResumeAdaptationService {
  /**
   * Adapt a resume to match a specific job description
   */
  async adaptResumeToJob(
    originalResumeText: string,
    originalParsedData: any,
    jobTitle: string,
    jobDescription: string,
    requiredSkills: string[],
    missingSkills: string[]
  ): Promise<AdaptedResume> {
    try {
      logger.info(`Adapting resume for job: ${jobTitle}`);

      const systemPrompt = `Du är en expert på att anpassa CV:n till specifika jobbannonser. 
Din uppgift är att anpassa ett CV så att det matchar bättre med en jobbannons genom att:
1. Lägga till relevanta nyckelord från jobbannonsen
2. Förbättra beskrivningar av erfarenhet för att matcha jobbkrav
3. Anpassa sammanfattningen (summary) till jobbets fokus
4. Föreslå konkreta förbättringar utan att ändra fakta

VIKTIGT: Ändra INTE fakta, datum, företagsnamn eller utbildningar. Fokusera på att förbättra beskrivningar och lägga till relevanta nyckelord.`;

      const userPrompt = `Anpassa följande CV till jobbannonsen nedan.

ORIGINAL CV:
${originalResumeText.substring(0, 4000)}

JOBBANNONS:
Titel: ${jobTitle}

Beskrivning:
${jobDescription.substring(0, 2000)}

REQUIRED SKILLS:
${requiredSkills.join(', ')}

${missingSkills.length > 0 ? `\nMISSING SKILLS (försök inkludera dessa om relevant):\n${missingSkills.join(', ')}` : ''}

Anpassa CV:et enligt följande:
1. Förbättra sammanfattningen (summary) för att matcha jobbets fokus
2. Lägg till relevanta nyckelord i erfarenhetsbeskrivningar
3. Förbättra bullet points för att matcha jobbkraven
4. Behåll all fakta (datum, företag, utbildningar) oförändrad
5. Lägg INTE till erfarenhet eller utbildning som inte finns i original CV

Returnera resultatet i JSON-format:
{
  "adaptedText": "Den anpassade CV-texten (fullständig)",
  "summary": "Förbättrad sammanfattning",
  "improvements": ["Lista med specifika förbättringar som gjorts"],
  "adaptationNotes": "Kortfattade anteckningar om anpassningen"
}`;

      const response = await multiModelAI.generate({
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 4000,
        temperature: 0.4,
        useCase: 'code_generation',
        priority: 'quality',
      });

      if (!response.content) {
        throw new Error('AI did not return adapted resume');
      }

      // Parse JSON response
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }

      const adaptedData = JSON.parse(jsonMatch[0]);

      // Reconstruct parsed data with adapted content
      const adaptedParsedData = {
        ...originalParsedData,
        sections: {
          ...originalParsedData.sections,
          summary: adaptedData.summary || originalParsedData.sections?.summary,
        },
      };

      return {
        rawText: adaptedData.adaptedText || originalResumeText,
        parsedData: adaptedParsedData,
        improvements: adaptedData.improvements || [],
        adaptationNotes: adaptedData.adaptationNotes || 'CV anpassat till jobbannonsen',
      };
    } catch (error) {
      logger.error('Failed to adapt resume', error as Error);
      throw error;
    }
  }

  /**
   * Generate improvement suggestions for adapting resume
   */
  async generateAdaptationSuggestions(
    resumeText: string,
    jobDescription: string,
    requiredSkills: string[]
  ): Promise<string[]> {
    try {
      const response = await multiModelAI.generate({
        prompt: `Ge 5-7 konkreta förslag för hur CV:et kan anpassas till följande jobb:

CV:
${resumeText.substring(0, 2000)}

Jobbannons:
${jobDescription.substring(0, 1500)}

Krav:
${requiredSkills.join(', ')}

Ge korta, konkreta förslag (en mening per förslag). Returnera som JSON array: ["förslag 1", "förslag 2", ...]`,
        systemPrompt: 'Du är en expert på CV-optimering. Ge konkreta, åtgärdbara förslag.',
        maxTokens: 1000,
        temperature: 0.5,
        useCase: 'code_review',
        priority: 'speed',
      });

      const content = response.content?.trim() || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      logger.warn('Failed to generate adaptation suggestions', error as Error);
      return [];
    }
  }
}

export const resumeAdaptationService = new ResumeAdaptationService();

