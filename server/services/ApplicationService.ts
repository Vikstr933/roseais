import { multiModelAI } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ApplicationService');

export interface ApplicationData {
  coverLetter: string;
  fullApplication: {
    coverLetter: string;
    resumeText: string;
    combinedText: string; // Cover letter + resume formatted
  };
}

export class ApplicationService {
  /**
   * Generate a personalized cover letter for a job application
   */
  async generateCoverLetter(
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    companyName: string
  ): Promise<string> {
    try {
      logger.info(`Generating cover letter for ${jobTitle} at ${companyName}`);

      const systemPrompt = `Du är en expert på att skriva personliga personliga brev för jobbansökningar på svenska.
Din uppgift är att skriva ett övertygande, professionellt personligt brev som:
1. Visar intresse för den specifika rollen och företaget
2. Höjdpunkter relevant erfarenhet och kompetens från CV:t
3. Förklarar varför kandidaten är rätt person för jobbet
4. Använder professionellt svenska språk
5. Är koncis men informativ (cirka 200-300 ord)

VIKTIGT: Skriv brevet i första person ("Jag", "Min", etc.) och var autentisk.`;

      const userPrompt = `Skriv ett personligt brev för följande jobbansökan:

JOBBTITEL: ${jobTitle}
FÖRETAG: ${companyName}

JOBBESKRIVNING:
${jobDescription.substring(0, 2000)}

KANDIDATENS CV:
${resumeText.substring(0, 3000)}

Skriv ett professionellt personligt brev på svenska som är anpassat till detta specifika jobb. Var koncis men övertygande.`;

      const response = await multiModelAI.generate({
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 1500,
        temperature: 0.7,
        useCase: 'code_generation',
        priority: 'quality',
      });

      if (!response.content) {
        throw new Error('AI did not return cover letter');
      }

      return response.content.trim();
    } catch (error) {
      logger.error('Failed to generate cover letter', error as Error);
      throw error;
    }
  }

  /**
   * Combine cover letter and resume into a full application document
   */
  formatFullApplication(coverLetter: string, resumeText: string): string {
    const date = new Date().toLocaleDateString('sv-SE');
    
    return `ANSOKNING

Datum: ${date}

---

PERSONLIGT BREV

${coverLetter}

---

CV

${resumeText}

---

Slut på ansökan`;
  }

  /**
   * Generate complete application (cover letter + resume)
   */
  async generateApplication(
    resumeText: string,
    jobTitle: string,
    jobDescription: string,
    companyName: string
  ): Promise<ApplicationData> {
    try {
      const coverLetter = await this.generateCoverLetter(
        resumeText,
        jobTitle,
        jobDescription,
        companyName
      );

      const combinedText = this.formatFullApplication(coverLetter, resumeText);

      return {
        coverLetter,
        fullApplication: {
          coverLetter,
          resumeText,
          combinedText,
        },
      };
    } catch (error) {
      logger.error('Failed to generate application', error as Error);
      throw error;
    }
  }
}

export const applicationService = new ApplicationService();

