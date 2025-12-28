import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeScoringService');

export interface ResumeScore {
  overallScore: number;
  atsScore: number;
  contentScore: number;
  completenessScore: number;
  keywordScore: number;
  improvements: Array<{
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

export class ResumeScoringService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  /**
   * Analyze resume and calculate scores
   */
  async analyzeResume(resumeText: string, parsedData?: any): Promise<ResumeScore> {
    try {
      // Calculate ATS score (formatting, structure)
      const atsScore = this.calculateATSScore(resumeText);

      // Calculate completeness score
      const completenessScore = this.calculateCompletenessScore(parsedData);

      // Calculate keyword score (using AI for better results)
      const keywordScore = await this.calculateKeywordScore(resumeText);

      // Calculate content score (using AI)
      const contentScore = await this.calculateContentScore(resumeText);

      // Calculate overall score
      const overallScore = Math.round(
        (atsScore * 0.25 + contentScore * 0.35 + completenessScore * 0.20 + keywordScore * 0.20)
      );

      // Get AI-powered improvements
      const improvements = await this.generateImprovements(resumeText, {
        atsScore,
        contentScore,
        completenessScore,
        keywordScore,
      });

      return {
        overallScore,
        atsScore,
        contentScore,
        completenessScore,
        keywordScore,
        improvements,
      };
    } catch (error) {
      logger.error('Failed to analyze resume', error as Error);
      throw error;
    }
  }

  private calculateATSScore(text: string): number {
    let score = 100;

    // Check for problematic formatting
    // Tables (often problematic for ATS)
    if (/\|\s*\|/.test(text)) score -= 15;

    // Images or special characters
    if (/[^\x00-\x7F]/.test(text) && /[🖼️📷🖨️]/.test(text)) score -= 10;

    // Check for common ATS-friendly sections
    const hasName = /^[A-Z][a-z]+\s+[A-Z][a-z]+/m.test(text);
    const hasEmail = /[\w\.-]+@[\w\.-]+/.test(text);
    const hasPhone = /(\+46|0)[\s-]?\d/.test(text);

    if (!hasName) score -= 10;
    if (!hasEmail) score -= 10;
    if (!hasPhone) score -= 5;

    // Check for keywords section
    if (!/skills|kompetenser|färdigheter/i.test(text)) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateCompletenessScore(parsedData?: any): number {
    if (!parsedData) return 50;

    let score = 0;
    const maxScore = 100;

    // Check required sections
    if (parsedData.contactInfo?.email) score += 15;
    if (parsedData.contactInfo?.phone) score += 10;
    if (parsedData.sections?.summary) score += 15;
    if (parsedData.sections?.experience && parsedData.sections.experience.length > 0) score += 30;
    if (parsedData.sections?.education && parsedData.sections.education.length > 0) score += 15;
    if (parsedData.sections?.skills && parsedData.sections.skills.length > 0) score += 15;

    return score;
  }

  private async calculateKeywordScore(text: string): Promise<number> {
    // Basic keyword density check
    // Could be improved with industry-specific keywords
    const commonKeywords = [
      'erfarenhet', 'kompetens', 'färdighet', 'projekt', 'ledarskap',
      'kommunikation', 'team', 'resultat', 'ansvar', 'utveckling'
    ];

    const textLower = text.toLowerCase();
    const foundKeywords = commonKeywords.filter(keyword =>
      textLower.includes(keyword.toLowerCase())
    );

    // Score based on keyword density
    const keywordDensity = foundKeywords.length / commonKeywords.length;
    return Math.round(keywordDensity * 100);
  }

  private async calculateContentScore(text: string): Promise<number> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analysera CV-innehållet och ge ett score 0-100 baserat på:
1. Kvalitet på beskrivningar (action verbs, konkreta resultat)
2. Struktur och läsbarhet
3. Professionellt språk
4. Relevans och fokus

CV-text:
${text.substring(0, 3000)}

Svara ENDAST med ett nummer 0-100.`,
          },
        ],
      });

      const scoreText = response.content[0]?.type === 'text' ? response.content[0].text : '50';
      const score = parseInt(scoreText.trim().match(/\d+/)?.[0] || '50', 10);
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      logger.warn('Failed to calculate content score with AI, using fallback', error as Error);
      return 70; // Fallback score
    }
  }

  private async generateImprovements(
    resumeText: string,
    scores: { atsScore: number; contentScore: number; completenessScore: number; keywordScore: number }
  ): Promise<ResumeScore['improvements']> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Analysera detta CV och ge 3-5 specifika förbättringsförslag.

CV-text:
${resumeText.substring(0, 3000)}

Nuvarande scores:
- ATS Score: ${scores.atsScore}/100
- Content Score: ${scores.contentScore}/100
- Completeness Score: ${scores.completenessScore}/100
- Keyword Score: ${scores.keywordScore}/100

Ge förslag i JSON-format:
[
  {
    "type": "ats" | "content" | "completeness" | "keywords",
    "title": "Kort rubrik",
    "description": "Detaljerad beskrivning",
    "priority": "low" | "medium" | "high"
  }
]`,
          },
        ],
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      logger.warn('Failed to generate improvements with AI', error as Error);
      return [];
    }
  }
}

export const resumeScoringService = new ResumeScoringService();

