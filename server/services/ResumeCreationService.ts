/**
 * Resume Creation Service
 * Handles CV creation via conversational flow
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { resumeCreationSessions, resumes } from '../../db/schema-pg';
import { eq, and, lt } from 'drizzle-orm';
import { ResumeData } from './ResumePDFService';
import { resumeParserService } from './ResumeParserService';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new SimpleLogger('ResumeCreationService');

export interface ResumeCreationState {
  userId: string;
  sessionId: string;
  currentSection: 'personal' | 'experience' | 'education' | 'skills' | 'summary' | 'other' | 'complete';
  collectedData: Partial<ResumeData>;
  questionsAsked: string[];
  currentQuestionIndex: number;
  isComplete: boolean;
  profession?: string; // Used to adapt questions
}

class ResumeCreationService {
  private static instance: ResumeCreationService;

  static getInstance(): ResumeCreationService {
    if (!ResumeCreationService.instance) {
      ResumeCreationService.instance = new ResumeCreationService();
    }
    return ResumeCreationService.instance;
  }

  /**
   * Check if user has a resume
   */
  async checkIfResumeExists(userId: string): Promise<boolean> {
    try {
      const userResumes = await db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .limit(1);

      return userResumes.length > 0;
    } catch (error) {
      logger.error('Error checking if resume exists', error as Error);
      return false;
    }
  }

  /**
   * Get or create resume creation session
   */
  async getOrCreateSession(userId: string, sessionId: string): Promise<ResumeCreationState> {
    try {
      // Clean up expired sessions
      await this.cleanupExpiredSessions();

      // Try to get existing session
      const existing = await db
        .select()
        .from(resumeCreationSessions)
        .where(
          and(
            eq(resumeCreationSessions.userId, userId),
            eq(resumeCreationSessions.sessionId, sessionId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const state = existing[0].state as ResumeCreationState;
        // Update expiresAt
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await db
          .update(resumeCreationSessions)
          .set({ expiresAt, updatedAt: new Date() })
          .where(eq(resumeCreationSessions.id, existing[0].id));
        return state;
      }

      // Create new session
      const initialState: ResumeCreationState = {
        userId,
        sessionId,
        currentSection: 'personal',
        collectedData: {
          personalInfo: {},
          experience: [],
          education: [],
          skills: [],
        },
        questionsAsked: [],
        currentQuestionIndex: 0,
        isComplete: false,
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.insert(resumeCreationSessions).values({
        userId,
        sessionId,
        state: initialState as any,
        expiresAt,
      });

      return initialState;
    } catch (error) {
      logger.error('Error getting or creating session', error as Error);
      throw error;
    }
  }

  /**
   * Get next question based on current state
   */
  async getNextQuestion(state: ResumeCreationState): Promise<string> {
    const section = state.currentSection;
    const index = state.currentQuestionIndex;

    // Personal info questions
    if (section === 'personal') {
      if (index === 0) {
        return 'Vad heter du? (För- och efternamn)';
      } else if (index === 1 && !state.collectedData.personalInfo?.email) {
        return 'Vad är din e-postadress?';
      } else if (index === 2 && !state.collectedData.personalInfo?.phone) {
        return 'Vad är ditt telefonnummer? (valfritt)';
      } else if (index === 3 && !state.collectedData.personalInfo?.location) {
        return 'Var bor du? (stad, land)';
      } else if (index === 4 && !state.profession) {
        return 'Vad är ditt yrke eller profession? (t.ex. "Frontend-utvecklare", "Ekonom", "Ställverksmontör")';
      } else if (index === 5 && !state.collectedData.personalInfo?.linkedIn) {
        return 'Har du en LinkedIn-profil? (valfritt, skriv URL eller "nej")';
      } else {
        // Move to summary
        state.currentSection = 'summary';
        state.currentQuestionIndex = 0;
        return 'Berätta kort om dig själv. Vad är din professionella bakgrund och vad söker du efter? (Detta blir din CV-sammanfattning)';
      }
    }

    // Summary questions
    if (section === 'summary') {
      if (index === 0 && !state.collectedData.summary) {
        return 'Berätta kort om dig själv. Vad är din professionella bakgrund och vad söker du efter? (Detta blir din CV-sammanfattning)';
      } else {
        // Move to experience
        state.currentSection = 'experience';
        state.currentQuestionIndex = 0;
        return 'Låt oss gå igenom din arbetserfarenhet. Vad är ditt nuvarande eller senaste jobb? (Om du inte har arbetserfarenhet, skriv "ingen")';
      }
    }

    // Experience questions
    if (section === 'experience') {
      if (index === 0) {
        return 'Vad är ditt nuvarande eller senaste jobb? (Om du inte har arbetserfarenhet, skriv "ingen")';
      } else if (index === 1 && state.collectedData.experience && state.collectedData.experience.length > 0) {
        const lastExp = state.collectedData.experience[state.collectedData.experience.length - 1];
        if (!lastExp.company) {
          return `Vilket företag arbetade du på som ${lastExp.title}?`;
        }
      } else if (index === 2 && state.collectedData.experience && state.collectedData.experience.length > 0) {
        const lastExp = state.collectedData.experience[state.collectedData.experience.length - 1];
        if (!lastExp.startDate) {
          return 'När började du på detta jobb? (t.ex. "2020-03" eller "mars 2020")';
        }
      } else if (index === 3 && state.collectedData.experience && state.collectedData.experience.length > 0) {
        const lastExp = state.collectedData.experience[state.collectedData.experience.length - 1];
        if (!lastExp.endDate && !lastExp.current) {
          return 'När slutade du på detta jobb? (eller skriv "pågående" om det är ditt nuvarande jobb)';
        }
      } else if (index === 4 && state.collectedData.experience && state.collectedData.experience.length > 0) {
        const lastExp = state.collectedData.experience[state.collectedData.experience.length - 1];
        if (!lastExp.description) {
          return 'Beskriv kort vad du gjorde på detta jobb. (valfritt)';
        }
      } else {
        // Ask if they have more experience
        return 'Har du fler jobb att lägga till? (skriv "ja" eller "nej")';
      }
    }

    // Education questions
    if (section === 'education') {
      if (index === 0) {
        return 'Vad är din högsta utbildning? (t.ex. "Civilingenjör, Datateknik" eller "Gymnasieexamen")';
      } else if (index === 1 && state.collectedData.education && state.collectedData.education.length > 0) {
        const lastEdu = state.collectedData.education[state.collectedData.education.length - 1];
        if (!lastEdu.institution) {
          return 'Vilket universitet/skola gick du på?';
        }
      } else if (index === 2 && state.collectedData.education && state.collectedData.education.length > 0) {
        const lastEdu = state.collectedData.education[state.collectedData.education.length - 1];
        if (!lastEdu.endDate) {
          return 'När tog du examen? (t.ex. "2020" eller "2020-06")';
        }
      } else {
        // Ask if they have more education
        return 'Har du fler utbildningar att lägga till? (skriv "ja" eller "nej")';
      }
    }

    // Skills questions
    if (section === 'skills') {
      if (index === 0) {
        return 'Vilka färdigheter har du? (t.ex. "JavaScript, React, TypeScript, Git" eller "Microsoft Office, Kundservice")';
      } else {
        // Move to other/complete
        state.currentSection = 'other';
        state.currentQuestionIndex = 0;
        return 'Har du några certifieringar, projekt eller språk du vill lägga till? (skriv "nej" om du är klar)';
      }
    }

    // Other/complete
    if (section === 'other') {
      state.isComplete = true;
      state.currentSection = 'complete';
      return 'Perfekt! Jag har samlat in all information. Ska jag skapa ditt CV nu? (skriv "ja" för att skapa)';
    }

    // Default fallback
    return 'Tack för informationen! Ska jag skapa ditt CV nu?';
  }

  /**
   * Process answer and update state
   */
  async processAnswer(state: ResumeCreationState, answer: string): Promise<ResumeCreationState> {
    const section = state.currentSection;
    const index = state.currentQuestionIndex;
    const lowerAnswer = answer.toLowerCase().trim();

    // Personal info processing
    if (section === 'personal') {
      if (index === 0) {
        state.collectedData.personalInfo = {
          ...state.collectedData.personalInfo,
          name: answer.trim(),
        };
      } else if (index === 1) {
        state.collectedData.personalInfo = {
          ...state.collectedData.personalInfo,
          email: answer.trim(),
        };
      } else if (index === 2) {
        if (lowerAnswer !== 'nej' && lowerAnswer !== 'ingen' && lowerAnswer !== '') {
          state.collectedData.personalInfo = {
            ...state.collectedData.personalInfo,
            phone: answer.trim(),
          };
        }
      } else if (index === 3) {
        if (lowerAnswer !== 'nej' && lowerAnswer !== 'ingen' && lowerAnswer !== '') {
          state.collectedData.personalInfo = {
            ...state.collectedData.personalInfo,
            location: answer.trim(),
          };
        }
      } else if (index === 4) {
        state.profession = answer.trim();
        state.collectedData.personalInfo = {
          ...state.collectedData.personalInfo,
          title: answer.trim(),
        };
      } else if (index === 5) {
        if (lowerAnswer !== 'nej' && lowerAnswer !== 'ingen' && lowerAnswer !== '') {
          state.collectedData.personalInfo = {
            ...state.collectedData.personalInfo,
            linkedIn: answer.trim(),
          };
        }
      }
      state.currentQuestionIndex++;
    }

    // Summary processing
    if (section === 'summary') {
      if (index === 0) {
        state.collectedData.summary = answer.trim();
      }
      state.currentQuestionIndex++;
    }

    // Experience processing
    if (section === 'experience') {
      if (lowerAnswer === 'ingen' || lowerAnswer === 'nej') {
        // Skip to education
        state.currentSection = 'education';
        state.currentQuestionIndex = 0;
      } else if (index === 0) {
        // New job
        state.collectedData.experience = state.collectedData.experience || [];
        state.collectedData.experience.push({
          title: answer.trim(),
          company: '',
          startDate: '',
        });
        state.currentQuestionIndex++;
      } else if (index === 1) {
        const lastExp = state.collectedData.experience![state.collectedData.experience!.length - 1];
        lastExp.company = answer.trim();
        state.currentQuestionIndex++;
      } else if (index === 2) {
        const lastExp = state.collectedData.experience![state.collectedData.experience!.length - 1];
        lastExp.startDate = answer.trim();
        state.currentQuestionIndex++;
      } else if (index === 3) {
        const lastExp = state.collectedData.experience![state.collectedData.experience!.length - 1];
        if (lowerAnswer === 'pågående' || lowerAnswer === 'nuvarande') {
          lastExp.current = true;
        } else {
          lastExp.endDate = answer.trim();
        }
        state.currentQuestionIndex++;
      } else if (index === 4) {
        const lastExp = state.collectedData.experience![state.collectedData.experience!.length - 1];
        lastExp.description = answer.trim();
        state.currentQuestionIndex++;
      } else {
        // Check if more experience
        if (lowerAnswer === 'ja' || lowerAnswer === 'yes') {
          state.currentQuestionIndex = 0;
          // Will ask for next job
        } else {
          // Move to education
          state.currentSection = 'education';
          state.currentQuestionIndex = 0;
        }
      }
    }

    // Education processing
    if (section === 'education') {
      if (index === 0) {
        state.collectedData.education = state.collectedData.education || [];
        state.collectedData.education.push({
          degree: answer.trim(),
          institution: '',
        });
        state.currentQuestionIndex++;
      } else if (index === 1) {
        const lastEdu = state.collectedData.education![state.collectedData.education!.length - 1];
        lastEdu.institution = answer.trim();
        state.currentQuestionIndex++;
      } else if (index === 2) {
        const lastEdu = state.collectedData.education![state.collectedData.education!.length - 1];
        lastEdu.endDate = answer.trim();
        state.currentQuestionIndex++;
      } else {
        // Check if more education
        if (lowerAnswer === 'ja' || lowerAnswer === 'yes') {
          state.currentQuestionIndex = 0;
        } else {
          // Move to skills
          state.currentSection = 'skills';
          state.currentQuestionIndex = 0;
        }
      }
    }

    // Skills processing
    if (section === 'skills') {
      if (index === 0) {
        const skillsList = answer.split(',').map(s => s.trim()).filter(s => s.length > 0);
        state.collectedData.skills = [
          {
            items: skillsList,
          },
        ];
      }
      state.currentQuestionIndex++;
    }

    // Other/complete processing
    if (section === 'other') {
      if (lowerAnswer === 'ja' || lowerAnswer === 'yes') {
        // User wants to add more, but we'll move to complete anyway
        state.isComplete = true;
      } else {
        state.isComplete = true;
      }
    }

    // Save updated state
    await this.saveState(state);

    return state;
  }

  /**
   * Save state to database
   */
  private async saveState(state: ResumeCreationState): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db
        .update(resumeCreationSessions)
        .set({
          state: state as any,
          updatedAt: new Date(),
          expiresAt,
        })
        .where(
          and(
            eq(resumeCreationSessions.userId, state.userId),
            eq(resumeCreationSessions.sessionId, state.sessionId)
          )
        );
    } catch (error) {
      logger.error('Error saving state', error as Error);
      throw error;
    }
  }

  /**
   * Generate resume from collected data
   */
  async generateResume(state: ResumeCreationState): Promise<number> {
    try {
      // Ensure we have minimum required data
      if (!state.collectedData.personalInfo?.name) {
        throw new Error('Namn krävs för att skapa CV');
      }

      // Create ResumeData object
      const resumeData: ResumeData = {
        personalInfo: {
          name: state.collectedData.personalInfo.name,
          title: state.collectedData.personalInfo.title || state.profession || undefined,
          email: state.collectedData.personalInfo.email,
          phone: state.collectedData.personalInfo.phone,
          location: state.collectedData.personalInfo.location,
          linkedIn: state.collectedData.personalInfo.linkedIn,
        },
        summary: state.collectedData.summary,
        experience: state.collectedData.experience || [],
        education: state.collectedData.education || [],
        skills: state.collectedData.skills || [],
        certifications: state.collectedData.certifications,
        languages: state.collectedData.languages,
        projects: state.collectedData.projects,
      };

      // Convert ResumeData to raw text for storage
      const rawText = this.resumeDataToText(resumeData);

      // Create parsed data structure
      const parsedData = {
        sections: {
          personal: resumeData.personalInfo,
          summary: resumeData.summary,
          experience: resumeData.experience,
          education: resumeData.education,
          skills: resumeData.skills,
          certifications: resumeData.certifications,
          languages: resumeData.languages,
          projects: resumeData.projects,
        },
      };

      // Generate unique filename
      const resumeId = uuidv4();
      const filename = `CV_${resumeData.personalInfo.name.replace(/\s+/g, '_')}_${Date.now()}.txt`;
      const filePath = `resumes/${state.userId}/${resumeId}.txt`;

      // Upload to local storage
      const uploadDir = path.join(process.cwd(), 'uploads', 'resumes', state.userId);
      await fs.mkdir(uploadDir, { recursive: true });
      const localPath = path.join(uploadDir, `${resumeId}.txt`);
      await fs.writeFile(localPath, rawText, 'utf-8');
      const storageUrl = `/uploads/resumes/${state.userId}/${resumeId}.txt`;

      // Save to database
      const [resume] = await db
        .insert(resumes)
        .values({
          userId: state.userId,
          filename: filename,
          filePath: storageUrl,
          fileSize: Buffer.byteLength(rawText, 'utf-8'),
          fileType: 'txt',
          parsedData: parsedData as any,
          rawText: rawText,
        })
        .returning();

      // Delete session
      await db
        .delete(resumeCreationSessions)
        .where(
          and(
            eq(resumeCreationSessions.userId, state.userId),
            eq(resumeCreationSessions.sessionId, state.sessionId)
          )
        );

      logger.info(`Successfully generated resume from conversation: ${resume.id}`);
      return resume.id;
    } catch (error) {
      logger.error('Error generating resume', error as Error);
      throw error;
    }
  }

  /**
   * Convert ResumeData to text format
   */
  private resumeDataToText(data: ResumeData): string {
    let text = '';

    // Personal info
    text += `${data.personalInfo.name}\n`;
    if (data.personalInfo.title) {
      text += `${data.personalInfo.title}\n`;
    }
    text += '\n';

    if (data.personalInfo.email) text += `Email: ${data.personalInfo.email}\n`;
    if (data.personalInfo.phone) text += `Telefon: ${data.personalInfo.phone}\n`;
    if (data.personalInfo.location) text += `Plats: ${data.personalInfo.location}\n`;
    if (data.personalInfo.linkedIn) text += `LinkedIn: ${data.personalInfo.linkedIn}\n`;
    text += '\n';

    // Summary
    if (data.summary) {
      text += `SAMMANFATTNING\n${data.summary}\n\n`;
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      text += `ERFARENHET\n`;
      for (const exp of data.experience) {
        text += `${exp.title}\n`;
        text += `${exp.company}\n`;
        if (exp.startDate) {
          text += `${exp.startDate} - ${exp.current ? 'Pågående' : exp.endDate || ''}\n`;
        }
        if (exp.description) {
          text += `${exp.description}\n`;
        }
        text += '\n';
      }
    }

    // Education
    if (data.education && data.education.length > 0) {
      text += `UTBILDNING\n`;
      for (const edu of data.education) {
        text += `${edu.degree}\n`;
        text += `${edu.institution}\n`;
        if (edu.endDate) {
          text += `${edu.endDate}\n`;
        }
        text += '\n';
      }
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      text += `FÄRDIGHETER\n`;
      for (const skillGroup of data.skills) {
        if (skillGroup.category) {
          text += `${skillGroup.category}: `;
        }
        text += `${skillGroup.items.join(', ')}\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      await db
        .delete(resumeCreationSessions)
        .where(lt(resumeCreationSessions.expiresAt, now));
    } catch (error) {
      logger.warn('Error cleaning up expired sessions', error as Error);
    }
  }
}

export const resumeCreationService = ResumeCreationService.getInstance();

