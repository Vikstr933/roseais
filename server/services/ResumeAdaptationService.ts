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

VIKTIGT: Returnera ENDAST JSON, utan ytterligare text eller förklaringar före eller efter.

Returnera resultatet i följande JSON-format (ingen annan text):
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

      // Parse JSON response with multiple strategies
      let content = response.content.trim();
      
      // Strategy 1: Remove markdown code blocks (more aggressive)
      if (content.includes('```')) {
        // Try to extract content between first and last ```
        const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          content = codeBlockMatch[1].trim();
        } else {
          // Fallback: remove all ``` markers
          content = content.replace(/```(?:json)?/g, '').trim();
        }
      }

      // Strategy 2: Remove common AI explanatory text before JSON
      content = content.replace(/^(?:Here's?|Here is|I've created|I have created|Below is).*?\n/gim, '');

      // Strategy 3: Try multiple JSON extraction patterns
      let jsonMatch = null;
      
      // 3a: Try to find JSON object with greedy matching
      jsonMatch = content.match(/\{[\s\S]*\}/);
      
      // 3b: If that fails, try to find JSON between first { and last }
      if (!jsonMatch) {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonMatch = [content.substring(firstBrace, lastBrace + 1)];
        }
      }

      if (!jsonMatch) {
        // Log the content for debugging
        logger.error(`No JSON found in AI response. Content: ${content.substring(0, 500)}`);
        logger.error(`Full response length: ${response.content.length} chars`);
        
        // Fallback: return original resume with a note
        logger.warn('Using fallback: returning original resume with adaptation note');
        return {
          rawText: originalResumeText,
          parsedData: originalParsedData,
          improvements: ['AI-anpassning kunde inte slutföras. CV:et returneras oförändrat.'],
          adaptationNotes: 'Kunde inte parsa AI-svar. Original CV returneras.',
        };
      }

      try {
        let jsonStr = jsonMatch[0];
        
        // Strategy 4: Try to fix common JSON issues
        // Remove trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        
        const adaptedData = JSON.parse(jsonStr);
        
        // Validate required fields
        if (!adaptedData.adaptedText && !adaptedData.summary) {
          logger.warn('AI response missing adaptedText, using original');
          adaptedData.adaptedText = originalResumeText;
        }

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
      } catch (parseError) {
        logger.error(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        logger.error(`Failed to parse JSON. Content: ${jsonMatch[0].substring(0, 500)}`);
        
        // Instead of throwing, return fallback with original resume
        logger.warn('JSON parsing failed, returning original resume as fallback');
        return {
          rawText: originalResumeText,
          parsedData: originalParsedData,
          improvements: ['AI-anpassning kunde inte slutföras. CV:et returneras oförändrat.'],
          adaptationNotes: 'Kunde inte parsa AI-svar. Original CV returneras.',
        };
      }
    } catch (error) {
      logger.error('Failed to adapt resume', error as Error);
      
      // Return fallback instead of throwing to prevent API errors
      logger.warn('Error during adaptation, returning original resume as fallback');
      return {
        rawText: originalResumeText,
        parsedData: originalParsedData,
        improvements: ['AI-anpassning kunde inte slutföras. CV:et returneras oförändrat.'],
        adaptationNotes: 'Kunde inte parsa AI-svar. Original CV returneras.',
      };
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

