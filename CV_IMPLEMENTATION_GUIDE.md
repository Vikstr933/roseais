# CV-Analys Implementation Guide

## 🎯 Quick Start - Implementera CV-funktionalitet

Detta dokument visar exakt hur ni implementerar CV-analysfunktionaliteten steg för steg.

---

## Steg 1: Installera Dependencies

```bash
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

---

## Steg 2: Installera LaTeX Dependencies

```bash
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse

# För LaTeX-stöd (optional, kan användas för .tex fil parsing)
# Notera: LaTeX parsing kan vara komplext, vi fokuserar på PDF/DOCX först
# men stödjer LaTeX-genererade PDF:er genom pdf-parse
```

## Steg 3: Database Migration

Skapa en ny migration fil: `migrations/add_resume_tables.sql`

```sql
-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50), -- 'pdf', 'docx', 'doc'
  parsed_data JSONB DEFAULT '{}'::jsonb,
  raw_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_created_at ON resumes(created_at DESC);

-- Resume analyses table
CREATE TABLE IF NOT EXISTS resume_analyses (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  ats_score INTEGER NOT NULL CHECK (ats_score >= 0 AND ats_score <= 100),
  content_score INTEGER NOT NULL CHECK (content_score >= 0 AND content_score <= 100),
  completeness_score INTEGER NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
  keyword_score INTEGER NOT NULL CHECK (keyword_score >= 0 AND keyword_score <= 100),
  improvements JSONB DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resume_analyses_resume_id ON resume_analyses(resume_id);
CREATE INDEX idx_resume_analyses_overall_score ON resume_analyses(overall_score DESC);

-- Job matches table
CREATE TABLE IF NOT EXISTS job_matches (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  match_percentage INTEGER NOT NULL CHECK (match_percentage >= 0 AND match_percentage <= 100),
  job_description TEXT,
  job_url TEXT,
  job_id TEXT, -- External job ID från API
  required_skills JSONB DEFAULT '[]'::jsonb,
  matched_skills JSONB DEFAULT '[]'::jsonb,
  matched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_matches_resume_id ON job_matches(resume_id);
CREATE INDEX idx_job_matches_match_percentage ON job_matches(match_percentage DESC);
```

---

## Steg 4: Uppdatera Drizzle Schema

Lägg till i `db/schema-pg.ts`:

```typescript
export const resumes = pgTable('resumes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  fileType: text('file_type'), // 'pdf', 'docx', 'doc'
  parsedData: jsonb('parsed_data').default({}),
  rawText: text('raw_text'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const resumeAnalyses = pgTable('resume_analyses', {
  id: serial('id').primaryKey(),
  resumeId: integer('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score').notNull(),
  atsScore: integer('ats_score').notNull(),
  contentScore: integer('content_score').notNull(),
  completenessScore: integer('completeness_score').notNull(),
  keywordScore: integer('keyword_score').notNull(),
  improvements: jsonb('improvements').default([]),
  analyzedAt: timestamp('analyzed_at').defaultNow(),
});

export const jobMatches = pgTable('job_matches', {
  id: serial('id').primaryKey(),
  resumeId: integer('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  jobTitle: text('job_title').notNull(),
  company: text('company'),
  location: text('location'),
  matchPercentage: integer('match_percentage').notNull(),
  jobDescription: text('job_description'),
  jobUrl: text('job_url'),
  jobId: text('job_id'), // External job ID
  requiredSkills: jsonb('required_skills').default([]),
  matchedSkills: jsonb('matched_skills').default([]),
  matchedAt: timestamp('matched_at').defaultNow(),
});

// Types
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;
export type NewResumeAnalysis = typeof resumeAnalyses.$inferInsert;
export type JobMatch = typeof jobMatches.$inferSelect;
export type NewJobMatch = typeof jobMatches.$inferInsert;
```

---

## Steg 5: Resume Parser Service (med LaTeX-stöd)

Skapa `server/services/ResumeParserService.ts`:

```typescript
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../utils/logger';

export interface ParsedResumeData {
  rawText: string;
  contactInfo: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  sections: {
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
  metadata?: {
    isLatexSource?: boolean;
  };
}

export class ResumeParserService {
  /**
   * Parse a resume file (PDF or DOCX)
   */
  async parseResume(fileBuffer: Buffer, fileType: string, fileName?: string): Promise<ParsedResumeData> {
    let rawText: string;
    let isLatexSource = false;

    try {
      // Check if it's a LaTeX source file (.tex)
      if (fileName && fileName.toLowerCase().endsWith('.tex')) {
        rawText = await this.parseLaTeX(fileBuffer);
        isLatexSource = true;
      } else if (fileType === 'application/pdf' || fileType === 'pdf') {
        rawText = await this.parsePDF(fileBuffer);
        // Check if PDF might be generated from LaTeX (heuristic)
        isLatexSource = this.detectLatexPDF(rawText);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'docx'
      ) {
        rawText = await this.parseDOCX(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: ${fileType}. Supported: PDF, DOCX, TEX`);
      }

      // Extract structured data
      const parsedData = this.extractStructuredData(rawText);

      return {
        rawText,
        ...parsedData,
        metadata: {
          isLatexSource,
        },
      };
    } catch (error) {
      logger.error('Failed to parse resume', error as Error);
      throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      // pdf-parse hanterar både vanliga PDF:er och LaTeX-genererade PDF:er
      // Eftersom LaTeX kompileras till PDF, behöver vi bara extrahera texten
      let text = data.text;
      
      // Cleanup LaTeX-artifacts som kan finnas kvar i texten
      // (LaTeX-kommandon visas ibland som text i PDF:er)
      text = this.cleanLaTeXArtifacts(text);
      
      return text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean LaTeX artifacts från extraherad text
   * Tar bort LaTeX-kommandon som kan ha leakats genom till PDF
   */
  private cleanLaTeXArtifacts(text: string): string {
    // Remove common LaTeX commands that might appear in text
    return text
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // Replace \command{text} with text
      .replace(/\\[a-zA-Z]+/g, '') // Remove standalone LaTeX commands
      .replace(/\{[^}]*\}/g, '') // Remove LaTeX groups
      .replace(/\$[^$]*\$/g, '') // Remove inline math
      .replace(/\\&/g, '&') // Unescape ampersand
      .replace(/\\%/g, '%') // Unescape percent
      .replace(/\\#/g, '#') // Unescape hash
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse LaTeX source file (.tex)
   * Extraherar text från LaTeX-kommandon
   */
  private async parseLaTeX(buffer: Buffer): Promise<string> {
    try {
      const latexContent = buffer.toString('utf-8');
      
      // Remove comments
      let text = latexContent.replace(/(?<!\\)%.*$/gm, '');
      
      // Extract text content from common LaTeX environments
      // Remove document class and packages
      text = text.replace(/\\documentclass\{[^}]*\}/g, '');
      text = text.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
      text = text.replace(/\\begin\{document\}/g, '');
      text = text.replace(/\\end\{document\}/g, '');
      
      // Extract section titles
      text = text.replace(/\\section\*?\{([^}]*)\}/g, '\n## $1\n');
      text = text.replace(/\\subsection\*?\{([^}]*)\}/g, '\n### $1\n');
      
      // Extract itemize/enumerate items
      text = text.replace(/\\item\s+([^\n]*)/g, '• $1');
      
      // Remove LaTeX commands but keep content
      text = text.replace(/\\textbf\{([^}]*)\}/g, '$1');
      text = text.replace(/\\textit\{([^}]*)\}/g, '$1');
      text = text.replace(/\\emph\{([^}]*)\}/g, '$1');
      
      // Remove other common LaTeX commands
      text = text.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
      text = text.replace(/\\[a-zA-Z]+/g, '');
      
      // Clean up braces and special characters
      text = text.replace(/\{|\}/g, '');
      text = text.replace(/\\&/g, '&');
      text = text.replace(/\\%/g, '%');
      text = text.replace(/\\#/g, '#');
      
      // Remove math environments (they don't add useful text for CV parsing)
      text = text.replace(/\$[^$]*\$/g, '');
      text = text.replace(/\\begin\{equation\}[^]*?\\end\{equation\}/g, '');
      
      // Normalize whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      return text;
    } catch (error) {
      throw new Error(`LaTeX parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect if PDF might be generated from LaTeX
   * Uses heuristics like font usage, structure patterns, etc.
   */
  private detectLatexPDF(text: string): boolean {
    // Common LaTeX indicators in PDF text:
    // - References to LaTeX packages
    // - Specific formatting patterns
    // - Common LaTeX-generated content markers
    
    const latexIndicators = [
      /\\documentclass/i,
      /\\usepackage/i,
      /Computer Modern/i, // Default LaTeX font
      /LaTeX/i,
      /\{.*\\textbf.*\}/, // LaTeX command patterns that leaked
    ];
    
    return latexIndicators.some(pattern => pattern.test(text));
  }

  private extractStructuredData(text: string): ParsedResumeData {
    // Extract email
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
    const emailMatch = text.match(emailRegex);
    const email = emailMatch ? emailMatch[0] : undefined;

    // Extract phone (Swedish format)
    const phoneRegex = /(\+46|0)[\s-]?(\d{1,3})[\s-]?(\d{3,4})[\s-]?(\d{3,4})/;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : undefined;

    // Extract LinkedIn
    const linkedinRegex = /linkedin\.com\/in\/[\w-]+/i;
    const linkedinMatch = text.match(linkedinRegex);
    const linkedin = linkedinMatch ? linkedinMatch[0] : undefined;

    // Basic section extraction (kan förbättras med AI)
    const sections = this.extractSections(text);

    return {
      contactInfo: {
        email,
        phone,
        linkedin,
      },
      sections,
    };
  }

  private extractSections(text: string): ParsedResumeData['sections'] {
    // This is a basic implementation - för bättre resultat, använd AI
    const sections: ParsedResumeData['sections'] = {};

    // Extract skills (common patterns)
    const skillsRegex = /(?:Skills|Kompetenser|Färdigheter):\s*(.+?)(?:\n\n|\n[A-Z])/i;
    const skillsMatch = text.match(skillsRegex);
    if (skillsMatch) {
      sections.skills = skillsMatch[1]
        .split(/[,;•\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    // Extract summary
    const summaryRegex = /(?:Summary|Sammanfattning|Profil):\s*(.+?)(?:\n\n|\n(?:Experience|Erfarenhet|Education|Utbildning))/i;
    const summaryMatch = text.match(summaryRegex);
    if (summaryMatch) {
      sections.summary = summaryMatch[1].trim();
    }

    return sections;
  }
}

export const resumeParserService = new ResumeParserService();
```

---

## Steg 5: Resume Scoring Service

Skapa `server/services/ResumeScoringService.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

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
```

---

## Steg 6: Job Matching Service

Skapa `server/services/JobMatchingService.ts`:

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  requiredSkills?: string[];
  coordinates?: number[]; // [latitude, longitude] for mapping
  publicationDate?: string;
  applicationDeadline?: string;
}

export interface JobMatch {
  job: JobListing;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
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

    // Extract application URL
    let jobUrl = '';
    if (hit.application_details?.url) {
      jobUrl = hit.application_details.url;
    } else if (hit.webpage_url) {
      jobUrl = hit.webpage_url;
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

    return {
      id: hit.id || hit.external_id || '',
      title: hit.headline || '',
      company: hit.employer?.name || '',
      location: location,
      description: description,
      url: jobUrl,
      requiredSkills: [...new Set(requiredSkills)],
      coordinates: hit.workplace_address?.coordinates,
      publicationDate: hit.publication_date,
      applicationDeadline: hit.application_deadline,
    };
  }

  /**
   * Match resume against job listings
   */
  async matchResumeToJobs(
    resumeText: string,
    resumeSkills: string[],
    jobs: JobListing[]
  ): Promise<JobMatch[]> {
    const matches: JobMatch[] = [];

    for (const job of jobs) {
      const match = this.calculateMatch(resumeText, resumeSkills, job);
      matches.push({
        job,
        ...match,
      });
    }

    // Sort by match percentage (highest first)
    return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  private calculateMatch(
    resumeText: string,
    resumeSkills: string[],
    job: JobListing
  ): { matchPercentage: number; matchedSkills: string[]; missingSkills: string[] } {
    // Use structured skills from JobTech API if available, otherwise extract from description
    const jobSkills = job.requiredSkills && job.requiredSkills.length > 0
      ? job.requiredSkills
      : this.extractSkills(job.description);

    if (jobSkills.length === 0) {
      // If no skills found, use keyword overlap only
      const keywordOverlap = this.calculateKeywordOverlap(resumeText, job.description);
      return {
        matchPercentage: Math.round(keywordOverlap * 100),
        matchedSkills: [],
        missingSkills: [],
      };
    }

    // Normalize skills for comparison
    const normalize = (skill: string) => skill.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const normalizedResumeSkills = resumeSkills.map(normalize);
    const normalizedJobSkills = jobSkills.map(normalize);

    // Find matched skills (fuzzy matching)
    const matchedSkills: string[] = [];
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
    const missingSkills = jobSkills.filter((skill, index) => 
      !matchedSkills.includes(skill)
    );

    // Calculate match percentage
    // Based on: skill overlap (70%) + keyword overlap in description (30%)
    const skillMatchRatio = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0;
    const keywordOverlap = this.calculateKeywordOverlap(resumeText, job.description);

    const matchPercentage = Math.round(
      skillMatchRatio * 70 + keywordOverlap * 30
    );

    return {
      matchPercentage: Math.min(100, Math.max(0, matchPercentage)), // Clamp 0-100
      matchedSkills: [...new Set(matchedSkills)], // Remove duplicates
      missingSkills: [...new Set(missingSkills)],
    };
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
```

---

## Steg 7: Resume Routes

Skapa `server/routes/resumes.ts`:

```typescript
import { Router } from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth';
import { db } from '../../db';
import { resumes, resumeAnalyses, jobMatches } from '../../db/schema-pg';
import { eq, desc } from 'drizzle-orm';
import { resumeParserService } from '../services/ResumeParserService';
import { resumeScoringService } from '../services/ResumeScoringService';
import { jobMatchingService } from '../services/JobMatchingService';
import { r2StorageService } from '../services/R2StorageService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/x-latex', // LaTeX source
      'text/x-latex', // LaTeX source (alternative MIME)
      'text/plain', // .tex files are often plain text
    ];
    const allowedExtensions = ['.pdf', '.docx', '.tex'];
    const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TEX files are allowed.'));
    }
  },
});

// POST /api/resumes/upload
router.post('/upload', authenticateUser, upload.single('resume'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse resume (pass filename for LaTeX detection)
    const parsedData = await resumeParserService.parseResume(file.buffer, file.mimetype, file.originalname);

    // Generate unique filename
    const resumeId = uuidv4();
    const fileExtension = file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const filename = `${resumeId}.${fileExtension}`;
    const filePath = `resumes/${userId}/${filename}`;

    // Upload to R2 or local storage
    let storageUrl: string;
    if (r2StorageService.isEnabled()) {
      storageUrl = await r2StorageService.uploadFile(
        filePath,
        file.buffer,
        file.mimetype
      );
    } else {
      // Fallback to local storage
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'uploads', 'resumes', userId);
      await fs.mkdir(uploadDir, { recursive: true });
      const localPath = path.join(uploadDir, filename);
      await fs.writeFile(localPath, file.buffer);
      storageUrl = `/uploads/resumes/${userId}/${filename}`;
    }

    // Save to database
    const [resume] = await db
      .insert(resumes)
      .values({
        userId,
        filename: file.originalname,
        filePath: storageUrl,
        fileSize: file.size,
        fileType: fileExtension === 'tex' ? 'tex' : fileExtension,
        parsedData: parsedData as any,
        rawText: parsedData.rawText,
      })
      .returning();

    res.json({
      success: true,
      resume: {
        id: resume.id,
        filename: resume.filename,
        createdAt: resume.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload resume',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/resumes
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const userResumes = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.createdAt));

    res.json({
      resumes: userResumes.map(r => ({
        id: r.id,
        filename: r.filename,
        fileType: r.fileType,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// GET /api/resumes/:id
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(req.params.id);

    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ resume });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// POST /api/resumes/:id/analyze
router.post('/:id/analyze', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(req.params.id);

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (!resume.rawText) {
      return res.status(400).json({ error: 'Resume text not available' });
    }

    // Analyze resume
    const score = await resumeScoringService.analyzeResume(
      resume.rawText,
      resume.parsedData as any
    );

    // Save analysis
    const [analysis] = await db
      .insert(resumeAnalyses)
      .values({
        resumeId,
        overallScore: score.overallScore,
        atsScore: score.atsScore,
        contentScore: score.contentScore,
        completenessScore: score.completenessScore,
        keywordScore: score.keywordScore,
        improvements: score.improvements as any,
      })
      .returning();

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error analyzing resume:', error);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// GET /api/resumes/:id/job-matches
router.get('/:id/job-matches', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(req.params.id);
    const { keywords, location } = req.query;

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Search for jobs (JobTech API allows up to 100 results per request)
    const searchKeywords = (keywords as string) || 'utvecklare';
    const jobs = await jobMatchingService.searchJobs(
      searchKeywords,
      location as string | undefined,
      100 // Max allowed by JobTech API
    );

    // Match resume to jobs
    const parsedData = resume.parsedData as any;
    const resumeSkills = parsedData?.sections?.skills || [];
    const matches = await jobMatchingService.matchResumeToJobs(
      resume.rawText || '',
      resumeSkills,
      jobs
    );

    // Save top matches to database
    const topMatches = matches.slice(0, 10);
    for (const match of topMatches) {
      await db.insert(jobMatches).values({
        resumeId,
        jobTitle: match.job.title,
        company: match.job.company,
        location: match.job.location,
        matchPercentage: match.matchPercentage,
        jobDescription: match.job.description,
        jobUrl: match.job.url,
        jobId: match.job.id,
        requiredSkills: match.job.requiredSkills as any,
        matchedSkills: match.matchedSkills as any,
      });
    }

    res.json({
      matches: topMatches,
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    res.status(500).json({ error: 'Failed to match jobs' });
  }
});

// DELETE /api/resumes/:id
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(req.params.id);

    // Check ownership
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Delete from database (cascade will delete analyses and matches)
    await db.delete(resumes).where(eq(resumes.id, resumeId));

    // TODO: Delete file from R2/local storage

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

export default router;
```

---

## Steg 8: Registrera Routes

I `server/index.ts` eller `server/routes.ts`:

```typescript
import resumeRoutes from './routes/resumes';

// ...
app.use('/api/resumes', resumeRoutes);
```

---

## Nästa Steg

1. ✅ Kör migration i Supabase SQL Editor
2. ✅ Installera dependencies
3. ✅ Testa file upload
4. ✅ Testa parsing
5. ✅ Testa scoring
6. ✅ Bygg frontend components

Se `CV_PLATFORM_INTEGRATION_ANALYSIS.md` för fullständig översikt.

