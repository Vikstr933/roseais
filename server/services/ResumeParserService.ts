import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('ResumeParserService');

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
      // pdf-parse handles both regular PDFs and LaTeX-generated PDFs
      // Since LaTeX is compiled to PDF, we just need to extract the text
      let text = data.text;
      
      // Cleanup LaTeX-artifacts that might remain in the text
      // (LaTeX commands sometimes appear as text in PDFs)
      text = this.cleanLaTeXArtifacts(text);
      
      return text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * Extracts text from LaTeX commands
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

    // Basic section extraction (can be improved with AI)
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

