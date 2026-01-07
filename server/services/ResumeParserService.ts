import { SimpleLogger } from '../utils/SimpleLogger';
import { multiModelAI, AIRequest } from './MultiModelAIService';

const logger = new SimpleLogger('ResumeParserService');

// Lazy load CommonJS modules - these are externalized by esbuild
let pdfParse: any;
let mammoth: any;

async function getPdfParse() {
  if (!pdfParse) {
    const module = await import('pdf-parse');
    
    // pdf-parse v2.x exports PDFParse as a class (not a function)
    const PDFParseClass = (module as any).PDFParse;
    
    if (PDFParseClass && typeof PDFParseClass === 'function') {
      // PDFParse is a class constructor - return it so we can use 'new PDFParse()'
      pdfParse = PDFParseClass;
    } else {
      // Fallback: try default export
      pdfParse = (module as any).default;
    }
    
    // Final check - must be a constructor function (class)
    if (typeof pdfParse !== 'function') {
      const PDFParseType = PDFParseClass ? typeof PDFParseClass : 'undefined';
      logger.error(`pdf-parse: PDFParse type: ${PDFParseType}, available keys: ${Object.keys(module).join(', ')}`);
      throw new Error(`pdf-parse PDFParse is not a class/function. Type: ${PDFParseType}. Available keys: ${Object.keys(module).join(', ')}`);
    }
  }
  return pdfParse;
}

async function getMammoth() {
  if (!mammoth) {
    const module = await import('mammoth');
    logger.info(`mammoth module type: ${typeof module}, keys: ${Object.keys(module).join(', ')}`);
    
    // mammoth exports an object with extractRawText method
    mammoth = (module as any).default || module;
    
    // If it's not the right structure, try accessing .default.default
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      if (mammoth && typeof (mammoth as any).default === 'object') {
        mammoth = (mammoth as any).default;
      }
    }
    
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      logger.error(`mammoth export type: ${typeof mammoth}, has extractRawText: ${mammoth && typeof (mammoth as any).extractRawText}`);
      throw new Error('mammoth module export is invalid - extractRawText not found');
    }
  }
  return mammoth;
}

export interface ParsedResumeData {
  rawText: string;
  formattedText?: string; // AI-formaterad text med korrekta radbrytningar
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
    aiFormatted?: boolean; // Om texten är AI-formaterad
    aiStructured?: boolean; // Om structured data är AI-genererad
  };
}

export class ResumeParserService {
  /**
   * Parse a resume file (PDF, DOCX, or LaTeX)
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

      // Ensure no null bytes in rawText (PostgreSQL JSONB doesn't support \u0000)
      rawText = rawText.replace(/\0/g, '');
      
      // Pre-process text with rule-based formatting (fast, no AI cost)
      const preprocessedText = this.preprocessTextWithRules(rawText);
      
      // Extract structured data (try rule-based first, enhance with AI if needed)
      const parsedData = await this.extractStructuredDataHybrid(preprocessedText);
      
      // Format text with AI for better readability (optional but recommended)
      let formattedText: string | undefined;
      let aiFormatted = false;
      try {
        formattedText = await this.formatTextWithAI(preprocessedText);
        aiFormatted = true;
        logger.info('Successfully AI-formatted CV text');
      } catch (error) {
        logger.warn('AI formatting failed, using rule-based formatting', error as Error);
        // Fallback to rule-based formatting
        formattedText = preprocessedText;
      }

      return {
        rawText,
        formattedText,
        ...parsedData,
        metadata: {
          isLatexSource,
          aiFormatted,
          aiStructured: parsedData.metadata?.aiStructured || false,
        },
      };
    } catch (error) {
      logger.error('Failed to parse resume', error as Error);
      throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const PDFParseClass = await getPdfParse();
      
      // pdf-parse v2.x requires creating an instance and calling getText()
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      
      // Extract text from result
      let text = result.text || '';
      
      // Remove null bytes (PostgreSQL JSONB doesn't support \u0000)
      text = text.replace(/\0/g, '');
      
      // Cleanup LaTeX-artifacts that might remain in the text
      // (LaTeX commands sometimes appear as text in PDFs)
      text = this.cleanLaTeXArtifacts(text);
      
      // Cleanup parser resources
      await parser.destroy();
      
      return text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const mammothLib = await getMammoth();
      const result = await mammothLib.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse LaTeX source file (.tex)
   * Extracts text from LaTeX commands
   */
  private async parseLaTeX(buffer: Buffer): Promise<string> {
    try {
      let latexContent = buffer.toString('utf-8');
      
      // Remove null bytes (PostgreSQL JSONB doesn't support \u0000)
      latexContent = latexContent.replace(/\0/g, '');
      
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
   * Clean LaTeX artifacts from extracted text
   * Removes LaTeX commands that might have leaked through to PDF
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

  /**
   * Rule-based text preprocessing for better structure
   */
  private preprocessTextWithRules(text: string): string {
    // Identifiera sektionsrubriker (vanligtvis versaler eller specifika ord)
    const sections = [
      'ARBETSLIVSERFARENHET', 'WORK EXPERIENCE', 'ERFARENHET',
      'UTBILDNING', 'EDUCATION', 
      'KOMPETENSER', 'SKILLS', 'FÄRDIGHETER',
      'SPRÅK', 'LANGUAGES',
      'CERTIFIERINGAR', 'CERTIFICATES', 'SAMMANFATTNING', 'SUMMARY'
    ];
    
    // Lägg till dubbla radbrytningar före sektioner
    for (const section of sections) {
      text = text.replace(new RegExp(`(${section})`, 'gi'), '\n\n$1\n');
    }
    
    // Detektera datumintervall (troligen nya arbetserfarenheter)
    // Format: "2020-2023" eller "Jan 2020 - Dec 2023"
    text = text.replace(/(\d{4}\s*-\s*\d{4})/g, '\n\n$1');
    text = text.replace(/([A-ZÅÄÖ][a-zåäö]{2}\s+\d{4}\s*-\s*[A-ZÅÄÖ][a-zåäö]{2}\s+\d{4})/g, '\n\n$1');
    
    // Lägg till radbrytning efter meningar som följs av versal (nya meningar)
    text = text.replace(/\.\s+([A-ZÅÄÖ])/g, '.\n$1');
    
    // Ta bort flera på varandra följande radbrytningar
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  }

  /**
   * Format text with AI for better readability
   */
  private async formatTextWithAI(rawText: string): Promise<string> {
    const prompt = `Din uppgift är att ta emot oformaterad CV-text och returnera den välformaterad med korrekta radbrytningar.

Regler:
- Behåll allt innehåll exakt som det är
- Lägg till radbrytningar där det är logiskt (efter meningar, mellan sektioner, mellan listpunkter)
- Identifiera och strukturera sektioner (Arbetslivserfarenhet, Utbildning, etc)
- Gör INGA innehållsmässiga ändringar
- Behåll datum, namn och all faktainformation exakt

CV-text:
${rawText.substring(0, 8000)}${rawText.length > 8000 ? '\n\n[... texten är trunkerad ...]' : ''}

Returnera den formaterade texten direkt utan kommentarer.`;

    try {
      const response = await multiModelAI.generate({
        prompt,
        systemPrompt: 'Du är en expert på att formatera CV-text med korrekta radbrytningar och struktur.',
        maxTokens: 4000,
        temperature: 0.3,
        useCase: 'explanation',
        priority: 'quality',
      });

      if (!response.content) {
        throw new Error('AI did not return formatted text');
      }

      return response.content.trim();
    } catch (error) {
      logger.error('Failed to format text with AI', error as Error);
      throw error;
    }
  }

  /**
   * Parse text directly (for pasted text, not file uploads)
   */
  async parseText(text: string): Promise<ParsedResumeData> {
    try {
      // Ensure no null bytes
      const cleanText = text.replace(/\0/g, '').trim();
      
      // Pre-process text with rule-based formatting
      const preprocessedText = this.preprocessTextWithRules(cleanText);
      
      // Extract structured data (try rule-based first, enhance with AI if needed)
      const parsedData = await this.extractStructuredDataHybrid(preprocessedText);
      
      // Format text with AI for better readability
      let formattedText: string | undefined;
      let aiFormatted = false;
      try {
        formattedText = await this.formatTextWithAI(preprocessedText);
        aiFormatted = true;
        logger.info('Successfully AI-formatted pasted text');
      } catch (error) {
        logger.warn('AI formatting failed for pasted text, using rule-based formatting', error as Error);
        formattedText = preprocessedText;
      }

      return {
        rawText: cleanText,
        formattedText,
        ...parsedData,
        metadata: {
          aiFormatted,
          aiStructured: parsedData.metadata?.aiStructured || false,
          source: 'pasted_text',
        },
      };
    } catch (error) {
      logger.error('Failed to parse text', error as Error);
      throw new Error(`Failed to parse text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Hybrid approach: Try rule-based first, enhance with AI if needed
   */
  private async extractStructuredDataHybrid(text: string): Promise<Omit<ParsedResumeData, 'rawText' | 'formattedText' | 'metadata'> & { metadata?: { aiStructured?: boolean } }> {
    // First, try rule-based extraction
    const ruleBasedData = this.extractStructuredData(text);

    // Check if we have enough structured data
    const hasExperience = ruleBasedData.sections.experience && ruleBasedData.sections.experience.length > 0;
    const hasEducation = ruleBasedData.sections.education && ruleBasedData.sections.education.length > 0;
    const hasSkills = ruleBasedData.sections.skills && ruleBasedData.sections.skills.length > 0;

    // If we have good structured data, return it
    if (hasExperience || (hasEducation && hasSkills)) {
      return ruleBasedData;
    }

    // Otherwise, try AI enhancement (optional, can be expensive)
    try {
      logger.info('Rule-based extraction insufficient, trying AI enhancement');
      const aiEnhanced = await this.extractStructuredDataWithAI(text);
      return {
        ...aiEnhanced,
        metadata: { aiStructured: true },
      };
    } catch (error) {
      logger.warn('AI enhancement failed, using rule-based data', error as Error);
      return ruleBasedData;
    }
  }

  /**
   * Extract structured data using AI
   */
  private async extractStructuredDataWithAI(text: string): Promise<Omit<ParsedResumeData, 'rawText' | 'formattedText' | 'metadata'>> {
    const prompt = `Extrahera strukturerad information från detta CV. Returnera ENDAST valid JSON utan markdown-formatering.

Följ exakt denna struktur:
{
  "contactInfo": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "sections": {
    "summary": "",
    "experience": [
      {
        "title": "",
        "company": "",
        "dates": "",
        "description": ""
      }
    ],
    "education": [
      {
        "degree": "",
        "school": "",
        "dates": ""
      }
    ],
    "skills": []
  }
}

CV-text:
${text.substring(0, 6000)}${text.length > 6000 ? '\n\n[... texten är trunkerad ...]' : ''}`;

    try {
      const response = await multiModelAI.generate({
        prompt,
        systemPrompt: 'Du är en expert på att extrahera strukturerad data från CV-text. Returnera endast valid JSON.',
        maxTokens: 4000,
        temperature: 0.2, // Lower temperature for more consistent JSON
        useCase: 'explanation',
        priority: 'quality',
      });

      if (!response.content) {
        throw new Error('AI did not return structured data');
      }

      // Parse JSON from response
      let jsonText = response.content.trim();
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*|\s*```/g, '');
      jsonText = jsonText.replace(/```/g, '');

      const structured = JSON.parse(jsonText);
      
      return {
        contactInfo: structured.contactInfo || {},
        sections: structured.sections || {},
      };
    } catch (error) {
      logger.error('Failed to extract structured data with AI', error as Error);
      throw error;
    }
  }

  private extractStructuredData(text: string): Omit<ParsedResumeData, 'rawText' | 'formattedText' | 'metadata'> {
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

    // Basic section extraction
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
    // This is a basic implementation - for better results, use AI
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

