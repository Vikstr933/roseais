import { SimpleLogger } from '../utils/SimpleLogger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const logger = new SimpleLogger('ResumePDFService');

export interface ResumeData {
  personalInfo: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedIn?: string;
    website?: string;
  };
  summary?: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    description?: string;
    achievements?: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
    honors?: string[];
  }>;
  skills: Array<{
    category?: string;
    items: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
    expiryDate?: string;
  }>;
  languages?: Array<{
    language: string;
    level: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
  }>;
}

export interface PDFGenerationOptions {
  template?: 'modern' | 'classic' | 'minimal' | 'professional';
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  fontSize?: 'small' | 'medium' | 'large';
  colorScheme?: 'blue' | 'green' | 'purple' | 'gray';
}

export class ResumePDFService {
  private puppeteer: any = null;
  private templatesPath: string;

  constructor() {
    // Get templates directory path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.templatesPath = path.join(__dirname, '..', 'templates', 'resume');
  }

  /**
   * Lazy load Playwright to avoid startup issues
   */
  private async getPlaywright() {
    if (!this.puppeteer) {
      try {
        this.puppeteer = await import('playwright');
      } catch (error) {
        logger.error('Failed to load Playwright. Install with: npm install playwright', error as Error);
        throw new Error('Playwright not available. Please install: npm install playwright');
      }
    }
    return this.puppeteer;
  }

  /**
   * Install Playwright browsers at runtime (fallback if build-time installation failed)
   */
  private async installBrowsers(): Promise<void> {
    try {
      logger.info('Installing Playwright chromium browser...');
      const { execa } = await import('execa');
      const { stdout, stderr } = await execa('npx', ['playwright', 'install', 'chromium'], {
        timeout: 120000, // 2 minutes timeout
        cwd: process.cwd()
      });
      
      if (stdout) {
        logger.info(`Playwright installation output: ${stdout.substring(0, 200)}`);
      }
      if (stderr && !stderr.includes('already installed')) {
        logger.warn(`Playwright installation warnings: ${stderr.substring(0, 200)}`);
      }
      
      logger.info('✅ Playwright browsers installed successfully');
    } catch (error: any) {
      logger.error('Failed to install Playwright browsers:', error.message);
      throw error;
    }
  }

  /**
   * Generate PDF from structured resume data
   */
  async generatePDF(
    resumeData: ResumeData,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      const template = options.template || 'modern';
      const html = await this.renderTemplate(resumeData, template, options);
      
      const playwright = await this.getPlaywright();
      
      let browser;
      try {
        browser = await playwright.chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ],
        });
      } catch (launchError: any) {
        // If browser launch fails, try to install browsers and retry
        if (launchError.message?.includes('Executable doesn\'t exist') || 
            launchError.message?.includes('chromium') ||
            launchError.message?.includes('browser')) {
          logger.warn('Browser executable not found, attempting to install Playwright browsers...', launchError);
          await this.installBrowsers();
          
          // Retry launching browser
          browser = await playwright.chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu'
            ],
          });
        } else {
          throw launchError;
        }
      }

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });

        const pdfBuffer = await page.pdf({
          format: options.format || 'A4',
          margin: {
            top: options.margin?.top || '20mm',
            right: options.margin?.right || '15mm',
            bottom: options.margin?.bottom || '20mm',
            left: options.margin?.left || '15mm',
          },
          printBackground: true,
          preferCSSPageSize: true,
        });

        return Buffer.from(pdfBuffer);
      } finally {
        await browser.close();
      }
    } catch (error) {
      logger.error('Failed to generate PDF', error as Error);
      throw error;
    }
  }

  /**
   * Render HTML template with resume data
   */
  private async renderTemplate(
    resumeData: ResumeData,
    templateName: string,
    options: PDFGenerationOptions
  ): Promise<string> {
    // Try to load template from file, fallback to inline templates
    let template: string;
    
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.html`);
      template = await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      // Fallback to inline template
      logger.warn(`Template file not found, using inline template: ${templateName}`);
      template = this.getInlineTemplate(templateName);
    }

    // Replace template variables with data
    let html = this.populateTemplate(template, resumeData, options);
    
    // Handle conditional blocks (simple #if syntax)
    html = this.processConditionalBlocks(html, resumeData);
    
    return html;
  }

  /**
   * Process conditional blocks in template (#if syntax)
   */
  private processConditionalBlocks(html: string, data: ResumeData): string {
    // Simple conditional block processor
    // Pattern: {{#if field}}...{{/if}}
    const conditionalPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return html.replace(conditionalPattern, (match, field, content) => {
      // Check if field exists and has value
      const hasValue = this.hasFieldValue(data, field);
      return hasValue ? content : '';
    });
  }

  /**
   * Check if field has value in data
   */
  private hasFieldValue(data: ResumeData, field: string): boolean {
    const fieldMap: Record<string, any> = {
      'title': data.personalInfo.title,
      'email': data.personalInfo.email,
      'phone': data.personalInfo.phone,
      'location': data.personalInfo.location,
      'linkedIn': data.personalInfo.linkedIn,
      'website': data.personalInfo.website,
      'summary': data.summary,
      'projects': data.projects && data.projects.length > 0,
      'certifications': data.certifications && data.certifications.length > 0,
      'languages': data.languages && data.languages.length > 0,
    };
    
    const value = fieldMap[field];
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }

  /**
   * Get inline template (fallback if file doesn't exist)
   */
  private getInlineTemplate(templateName: string): string {
    const templates: Record<string, string> = {
      modern: this.getModernTemplate(),
      classic: this.getClassicTemplate(),
      minimal: this.getMinimalTemplate(),
      professional: this.getProfessionalTemplate(),
    };

    return templates[templateName] || templates.modern;
  }

  /**
   * Populate template with data
   */
  private populateTemplate(
    template: string,
    data: ResumeData,
    options: PDFGenerationOptions
  ): string {
    let html = template;

    // Replace color scheme
    const colorScheme = options.colorScheme || 'blue';
    const colors = this.getColorScheme(colorScheme);
    html = html.replace(/\{\{colorPrimary\}\}/g, colors.primary);
    html = html.replace(/\{\{colorSecondary\}\}/g, colors.secondary);
    html = html.replace(/\{\{colorAccent\}\}/g, colors.accent);

    // Replace font size
    const fontSize = options.fontSize || 'medium';
    const fontSizes = this.getFontSizes(fontSize);
    html = html.replace(/\{\{fontSizeBase\}\}/g, fontSizes.base);
    html = html.replace(/\{\{fontSizeHeading\}\}/g, fontSizes.heading);

    // Replace personal info
    html = html.replace(/\{\{name\}\}/g, this.escapeHtml(data.personalInfo.name));
    html = html.replace(/\{\{title\}\}/g, data.personalInfo.title ? this.escapeHtml(data.personalInfo.title) : '');
    html = html.replace(/\{\{email\}\}/g, data.personalInfo.email || '');
    html = html.replace(/\{\{phone\}\}/g, data.personalInfo.phone || '');
    html = html.replace(/\{\{location\}\}/g, data.personalInfo.location || '');
    html = html.replace(/\{\{linkedIn\}\}/g, data.personalInfo.linkedIn || '');
    html = html.replace(/\{\{website\}\}/g, data.personalInfo.website || '');

    // Replace summary - only render if it exists and is not empty
    // Also limit length to prevent layout issues and remove duplicates
    let summaryHtml = '';
    if (data.summary && data.summary.trim()) {
      // Clean up summary - remove duplicates and limit length
      let cleanSummary = data.summary.trim();
      
      // Remove if summary is just the name or title
      if (cleanSummary.toLowerCase() === data.personalInfo.name.toLowerCase() || 
          cleanSummary.length < 20) {
        summaryHtml = '';
      } else {
        // Additional deduplication check here as well
        // Normalize whitespace
        cleanSummary = cleanSummary.replace(/\s+/g, ' ').trim();
        
        // Check if summary is duplicated (same text twice) - more aggressive check
        const summaryLength = cleanSummary.length;
        if (summaryLength > 100) {
          // Check multiple split points
          const splitPoints = [0.45, 0.48, 0.5, 0.52, 0.55];
          let foundDuplicate = false;
          let bestSplitIndex = 0;
          
          for (const splitRatio of splitPoints) {
            const splitIndex = Math.floor(summaryLength * splitRatio);
            const firstPart = cleanSummary.substring(0, splitIndex).trim();
            const secondPart = cleanSummary.substring(splitIndex).trim();
            
            if (firstPart.length > 50 && secondPart.length > 50) {
              // Compare first 20 words
              const firstWords = firstPart.split(/\s+/).slice(0, 20).join(' ').toLowerCase();
              const secondWords = secondPart.split(/\s+/).slice(0, 20).join(' ').toLowerCase();
              
              if (firstWords === secondWords && firstWords.length > 40) {
                foundDuplicate = true;
                bestSplitIndex = splitIndex;
                break;
              }
              
              // Also check similarity
              const similarity = this.calculateSimilarity(firstPart, secondPart);
              if (similarity > 0.85) {
                foundDuplicate = true;
                bestSplitIndex = splitIndex;
                break;
              }
            }
          }
          
          if (foundDuplicate) {
            cleanSummary = cleanSummary.substring(0, bestSplitIndex).trim();
          } else {
            // Fallback: check 50/50 split
            const midPoint = Math.floor(summaryLength / 2);
            const firstHalf = cleanSummary.substring(0, midPoint).trim();
            const secondHalf = cleanSummary.substring(midPoint).trim();
            
            if (firstHalf.length > 50 && secondHalf.length > 50) {
              // Compare first 25 words
              const firstWords = firstHalf.split(/\s+/).slice(0, 25).join(' ').toLowerCase();
              const secondWords = secondHalf.split(/\s+/).slice(0, 25).join(' ').toLowerCase();
              
              if (firstWords === secondWords || this.calculateSimilarity(firstHalf, secondHalf) > 0.9) {
                cleanSummary = firstHalf;
              }
            }
          }
        }
        
        // Limit summary to reasonable length for PDF
        if (cleanSummary.length > 500) {
          cleanSummary = cleanSummary.substring(0, 497) + '...';
        }
        
        summaryHtml = `<div class="summary">${this.escapeHtml(cleanSummary)}</div>`;
      }
    }
    // Replace ALL occurrences of {{summary}} with the same content (only once)
    html = html.replace(/\{\{summary\}\}/g, summaryHtml);

    // Replace experience
    html = html.replace(/\{\{experience\}\}/g, this.renderExperience(data.experience));

    // Replace education
    html = html.replace(/\{\{education\}\}/g, this.renderEducation(data.education));

    // Replace skills
    html = html.replace(/\{\{skills\}\}/g, this.renderSkills(data.skills));

    // Replace certifications
    html = html.replace(/\{\{certifications\}\}/g, data.certifications ? this.renderCertifications(data.certifications) : '');

    // Replace languages
    html = html.replace(/\{\{languages\}\}/g, data.languages ? this.renderLanguages(data.languages) : '');

    // Replace projects
    html = html.replace(/\{\{projects\}\}/g, data.projects ? this.renderProjects(data.projects) : '');

    return html;
  }

  /**
   * Render experience section
   */
  private renderExperience(experience: ResumeData['experience']): string {
    if (!experience || experience.length === 0) return '';

    return experience.map(exp => {
      const dateRange = exp.current 
        ? `${this.formatDate(exp.startDate)} - Present`
        : `${this.formatDate(exp.startDate)} - ${this.formatDate(exp.endDate || '')}`;
      
      const location = exp.location ? ` • ${this.escapeHtml(exp.location)}` : '';
      const description = exp.description ? `<p class="job-description">${this.escapeHtml(exp.description)}</p>` : '';
      const achievements = exp.achievements && exp.achievements.length > 0
        ? `<ul class="achievements">${exp.achievements.map(a => `<li>${this.escapeHtml(a)}</li>`).join('')}</ul>`
        : '';

      return `
        <div class="experience-item">
          <div class="experience-header">
            <div>
              <h3 class="job-title">${this.escapeHtml(exp.title)}</h3>
              <p class="company">${this.escapeHtml(exp.company)}${location}</p>
            </div>
            <span class="date">${dateRange}</span>
          </div>
          ${description}
          ${achievements}
        </div>
      `;
    }).join('');
  }

  /**
   * Render education section
   */
  private renderEducation(education: ResumeData['education']): string {
    if (!education || education.length === 0) return '';

    return education.map(edu => {
      const dateRange = edu.startDate && edu.endDate
        ? `${this.formatDate(edu.startDate)} - ${this.formatDate(edu.endDate)}`
        : edu.endDate
        ? this.formatDate(edu.endDate)
        : '';
      
      const location = edu.location ? ` • ${this.escapeHtml(edu.location)}` : '';
      const gpa = edu.gpa ? ` • GPA: ${this.escapeHtml(edu.gpa)}` : '';
      const honors = edu.honors && edu.honors.length > 0
        ? `<p class="honors">${edu.honors.map(h => this.escapeHtml(h)).join(', ')}</p>`
        : '';

      return `
        <div class="education-item">
          <div class="education-header">
            <div>
              <h3 class="degree">${this.escapeHtml(edu.degree)}</h3>
              <p class="institution">${this.escapeHtml(edu.institution)}${location}${gpa}</p>
            </div>
            ${dateRange ? `<span class="date">${dateRange}</span>` : ''}
          </div>
          ${honors}
        </div>
      `;
    }).join('');
  }

  /**
   * Render skills section
   */
  private renderSkills(skills: ResumeData['skills']): string {
    if (!skills || skills.length === 0) return '';

    return skills.map(skillGroup => {
      const category = skillGroup.category 
        ? `<h4 class="skill-category">${this.escapeHtml(skillGroup.category)}</h4>`
        : '';
      const items = skillGroup.items.map(item => 
        `<span class="skill-tag">${this.escapeHtml(item)}</span>`
      ).join('');

      return `
        <div class="skill-group">
          ${category}
          <div class="skill-items">${items}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render certifications section
   */
  private renderCertifications(certifications: ResumeData['certifications']): string {
    if (!certifications || certifications.length === 0) return '';

    return certifications.map(cert => {
      const date = cert.date ? ` • ${this.formatDate(cert.date)}` : '';
      const expiry = cert.expiryDate ? ` (Expires: ${this.formatDate(cert.expiryDate)})` : '';
      
      return `
        <div class="certification-item">
          <h4 class="cert-name">${this.escapeHtml(cert.name)}</h4>
          <p class="cert-issuer">${this.escapeHtml(cert.issuer)}${date}${expiry}</p>
        </div>
      `;
    }).join('');
  }

  /**
   * Render languages section
   */
  private renderLanguages(languages: ResumeData['languages']): string {
    if (!languages || languages.length === 0) return '';

    return languages.map(lang => `
      <div class="language-item">
        <span class="language-name">${this.escapeHtml(lang.language)}</span>
        <span class="language-level">${this.escapeHtml(lang.level)}</span>
      </div>
    `).join('');
  }

  /**
   * Render projects section
   */
  private renderProjects(projects: ResumeData['projects']): string {
    if (!projects || projects.length === 0) return '';

    return projects.map(project => {
      const url = project.url 
        ? `<a href="${this.escapeHtml(project.url)}" class="project-url">${this.escapeHtml(project.url)}</a>`
        : '';
      const technologies = project.technologies && project.technologies.length > 0
        ? `<p class="project-tech">${project.technologies.map(t => this.escapeHtml(t)).join(' • ')}</p>`
        : '';

      return `
        <div class="project-item">
          <h4 class="project-name">${this.escapeHtml(project.name)}</h4>
          <p class="project-description">${this.escapeHtml(project.description)}</p>
          ${technologies}
          ${url}
        </div>
      `;
    }).join('');
  }

  /**
   * Get color scheme
   */
  private getColorScheme(scheme: string) {
    const schemes: Record<string, { primary: string; secondary: string; accent: string }> = {
      blue: { primary: '#2563eb', secondary: '#1e40af', accent: '#3b82f6' },
      green: { primary: '#059669', secondary: '#047857', accent: '#10b981' },
      purple: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#8b5cf6' },
      gray: { primary: '#374151', secondary: '#1f2937', accent: '#4b5563' },
    };
    return schemes[scheme] || schemes.blue;
  }

  /**
   * Get font sizes
   */
  private getFontSizes(size: string) {
    const sizes: Record<string, { base: string; heading: string }> = {
      small: { base: '11px', heading: '14px' },
      medium: { base: '12px', heading: '16px' },
      large: { base: '14px', heading: '18px' },
    };
    return sizes[size] || sizes.medium;
  }

  /**
   * Format date
   */
  private formatDate(date: string): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } catch {
      return date;
    }
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Modern template (redesigned from scratch - clean and professional)
   */
  private getModernTemplate(): string {
    return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #2c3e50;
      background: #fff;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 18mm !important;
      background: white;
      min-height: 100vh;
      max-height: 297mm; /* A4 height - force single page */
      overflow: hidden;
    }
    
    @media print {
      .container {
        padding: 12mm 18mm !important;
        max-height: 297mm !important;
        overflow: hidden !important;
      }
    }
    
    /* Header Section */
    .header {
      border-bottom: 2px solid {{colorPrimary}};
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 2px;
      letter-spacing: 0.2px;
      padding: 0;
      line-height: 1.1;
    }
    
    .header .title {
      font-size: 11px;
      color: #555;
      margin-bottom: 4px;
      font-weight: 500;
      padding: 0;
      line-height: 1.2;
    }
    
    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 8px;
      color: #666;
      padding: 0;
      line-height: 1.3;
    }
    
    .contact-info span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 0;
    }
    
    /* Summary */
    .summary {
      margin: 8px 0 12px 0;
      padding: 0;
      font-size: 9px;
      line-height: 1.4;
      color: #444;
      text-align: left;
    }
    
    /* Two Column Layout */
    .two-column {
      display: grid;
      grid-template-columns: 1.8fr 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    
    .main-column {
      /* Left: Experience, Projects */
    }
    
    .sidebar {
      /* Right: Skills, Education, Certifications, Languages */
    }
    
    /* Sections */
    .section {
      margin-bottom: 12px;
      padding: 0;
      page-break-inside: avoid;
    }
    
    .section:last-child {
      margin-bottom: 0;
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: {{colorPrimary}};
      margin-bottom: 6px;
      padding-bottom: 3px;
      padding-left: 0;
      padding-right: 0;
      border-bottom: 1.5px solid {{colorPrimary}};
      text-transform: uppercase;
      letter-spacing: 0.6px;
      line-height: 1.2;
    }
    
    /* Experience & Education Items */
    .experience-item, .education-item, .project-item {
      margin-bottom: 10px;
      padding-bottom: 8px;
      padding-left: 0;
      padding-right: 0;
      border-bottom: 1px solid #e8e8e8;
      page-break-inside: avoid;
    }
    
    .experience-item:last-child, .education-item:last-child, .project-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .experience-header, .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
      padding: 0;
    }
    
    .job-title, .degree {
      font-size: 10px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 2px;
      padding: 0;
      line-height: 1.2;
    }
    
    .company, .institution {
      font-size: 9px;
      color: #555;
      font-weight: 400;
      padding: 0;
      line-height: 1.2;
    }
    
    .date {
      font-size: 8px;
      color: #777;
      white-space: nowrap;
      font-weight: 400;
      padding: 0;
    }
    
    .job-description {
      margin: 5px 0 0 0;
      padding: 0;
      font-size: 8px;
      color: #444;
      line-height: 1.5;
    }
    
    .achievements {
      margin-top: 4px;
      padding-left: 14px;
      padding-right: 0;
    }
    
    .achievements li {
      margin-bottom: 2px;
      font-size: 8px;
      color: #555;
      line-height: 1.4;
      padding: 0;
    }
    
    /* Skills */
    .skill-group {
      margin-bottom: 8px;
      padding: 0;
    }
    
    .skill-category {
      font-size: 8px;
      font-weight: 600;
      color: #555;
      margin-bottom: 4px;
      padding: 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    
    .skill-items {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      padding: 0;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 2px 6px;
      background: #f0f4f8;
      color: #2c3e50;
      border: 1px solid #d1d9e0;
      border-radius: 2px;
      font-size: 7px;
      font-weight: 500;
      line-height: 1.2;
    }
    
    /* Certifications & Languages */
    .certification-item, .language-item {
      margin-bottom: 6px;
      padding: 0;
    }
    
    .cert-name, .language-name {
      font-weight: 600;
      font-size: 8px;
      color: #1a1a1a;
      margin-bottom: 1px;
      padding: 0;
      line-height: 1.2;
    }
    
    .cert-issuer, .language-level {
      font-size: 7px;
      color: #666;
      padding: 0;
      line-height: 1.2;
    }
    
    /* Projects */
    .project-name {
      font-weight: 600;
      font-size: 9px;
      color: #1a1a1a;
      margin-bottom: 3px;
      padding: 0;
      line-height: 1.2;
    }
    
    .project-description {
      font-size: 8px;
      color: #555;
      margin-bottom: 3px;
      padding: 0;
      line-height: 1.4;
    }
    
    .project-tech {
      font-size: 7px;
      color: #777;
      font-style: italic;
      padding: 0;
      line-height: 1.2;
    }
    
    .project-url {
      font-size: 9px;
      color: {{colorPrimary}};
      text-decoration: none;
      padding: 0;
    }
    
    /* Print Styles - Optimized for single page */
    @media print {
      .container {
        padding: 12mm 18mm !important;
        max-height: 297mm !important; /* A4 height - force single page */
        overflow: hidden !important;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
      
      .section {
        page-break-inside: avoid;
        margin-bottom: 10px !important;
      }
      
      .experience-item, .education-item, .project-item {
        page-break-inside: avoid;
        margin-bottom: 8px !important;
        padding-bottom: 6px !important;
      }
      
      .summary {
        margin: 6px 0 10px 0 !important;
        font-size: 8.5px !important;
        line-height: 1.4 !important;
      }
      
      .header {
        padding-bottom: 6px !important;
        margin-bottom: 8px !important;
      }
      
      .header h1 {
        font-size: 18px !important;
        margin-bottom: 1px !important;
        line-height: 1.1 !important;
      }
      
      .header .title {
        font-size: 10px !important;
        margin-bottom: 3px !important;
        line-height: 1.2 !important;
      }
      
      .contact-info {
        font-size: 7.5px !important;
        gap: 6px !important;
        line-height: 1.2 !important;
      }
      
      .two-column {
        gap: 14px !important;
        margin-top: 10px !important;
      }
      
      .section-title {
        font-size: 9px !important;
        margin-bottom: 5px !important;
        padding-bottom: 2px !important;
      }
      
      .job-title, .degree {
        font-size: 9px !important;
        line-height: 1.2 !important;
      }
      
      .company, .institution {
        font-size: 8px !important;
        line-height: 1.2 !important;
      }
      
      .date {
        font-size: 7px !important;
      }
      
      .job-description {
        font-size: 7.5px !important;
        line-height: 1.4 !important;
      }
    }
    
    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{name}}</h1>
      {{#if title}}<div class="title">{{title}}</div>{{/if}}
      <div class="contact-info">
        {{#if email}}<span>{{email}}</span>{{/if}}
        {{#if phone}}<span>{{phone}}</span>{{/if}}
        {{#if location}}<span>{{location}}</span>{{/if}}
        {{#if linkedIn}}<span>{{linkedIn}}</span>{{/if}}
        {{#if website}}<span>{{website}}</span>{{/if}}
      </div>
    </div>
    
    {{summary}}
    
    <div class="two-column">
      <div class="main-column">
        <div class="section">
          <h2 class="section-title">Erfarenhet</h2>
          {{experience}}
        </div>
        
        {{#if projects}}
        <div class="section">
          <h2 class="section-title">Projekt</h2>
          {{projects}}
        </div>
        {{/if}}
      </div>
      
      <div class="sidebar">
        <div class="section">
          <h2 class="section-title">Färdigheter</h2>
          {{skills}}
        </div>
        
        <div class="section">
          <h2 class="section-title">Utbildning</h2>
          {{education}}
        </div>
        
        {{#if certifications}}
        <div class="section">
          <h2 class="section-title">Certifieringar</h2>
          {{certifications}}
        </div>
        {{/if}}
        
        {{#if languages}}
        <div class="section">
          <h2 class="section-title">Språk</h2>
          {{languages}}
        </div>
        {{/if}}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Classic template (single column, traditional layout)
   */
  private getClassicTemplate(): string {
    return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', serif;
      font-size: {{fontSizeBase}};
      line-height: 1.6;
      color: #000;
      background: #fff;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm 25mm;
      background: white;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid {{colorPrimary}};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 24px;
      color: {{colorPrimary}};
      margin-bottom: 5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .header .title {
      font-size: {{fontSizeBase}};
      color: #333;
      margin-bottom: 10px;
      font-style: italic;
    }
    
    .contact-info {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 11px;
      color: #555;
    }
    
    .summary {
      margin: 25px 0 30px 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.7;
      text-align: left;
      color: #333;
    }
    
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 14px;
      color: {{colorPrimary}};
      font-weight: 700;
      margin-bottom: 18px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    
    .experience-item, .education-item {
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    
    .experience-item:last-child, .education-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .experience-header, .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    
    .job-title, .degree {
      font-weight: 600;
      font-size: 13px;
      color: #1a1a1a;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    
    .company, .institution {
      font-size: 12px;
      color: #555;
      font-weight: 400;
      margin-bottom: 2px;
    }
    
    .date {
      font-size: 11px;
      color: #777;
      white-space: nowrap;
      font-weight: 400;
    }
    
    .description {
      font-size: 11px;
      color: #444;
      margin-top: 10px;
      line-height: 1.7;
    }
    
    .skill-group {
      margin-bottom: 15px;
    }
    
    .skill-category {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .skill-items {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 5px 12px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 11px;
    }
    
    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{name}}</h1>
      {{#if title}}<div class="title">{{title}}</div>{{/if}}
      <div class="contact-info">
        {{#if email}}<span>📧 {{email}}</span>{{/if}}
        {{#if phone}}<span>📱 {{phone}}</span>{{/if}}
        {{#if location}}<span>📍 {{location}}</span>{{/if}}
      </div>
    </div>
    
    {{summary}}
    
    <div class="section">
      <h2 class="section-title">Erfarenhet</h2>
      {{experience}}
    </div>
    
    <div class="section">
      <h2 class="section-title">Utbildning</h2>
      {{education}}
    </div>
    
    <div class="section">
      <h2 class="section-title">Färdigheter</h2>
      {{skills}}
    </div>
    
    {{#if certifications}}
    <div class="section">
      <h2 class="section-title">Certifieringar</h2>
      {{certifications}}
    </div>
    {{/if}}
    
    {{#if languages}}
    <div class="section">
      <h2 class="section-title">Språk</h2>
      {{languages}}
    </div>
    {{/if}}
  </div>
</body>
</html>`;
  }

  /**
   * Minimal template (clean and simple)
   */
  private getMinimalTemplate(): string {
    return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: {{fontSizeBase}};
      line-height: 1.7;
      color: #2c3e50;
      background: #fff;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm 25mm;
      background: white;
    }
    
    .header {
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      color: #2c3e50;
      margin-bottom: 8px;
      font-weight: 300;
      letter-spacing: -0.5px;
    }
    
    .header .title {
      font-size: 14px;
      color: #7f8c8d;
      margin-bottom: 12px;
      font-weight: 300;
    }
    
    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 11px;
      color: #7f8c8d;
    }
    
    .summary {
      margin: 25px 0 30px 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.8;
      color: #34495e;
    }
    
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 14px;
      color: #2c3e50;
      font-weight: 400;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-bottom: 1px solid #ecf0f1;
      padding-bottom: 8px;
    }
    
    .experience-item, .education-item {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .experience-header, .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    
    .job-title, .degree {
      font-weight: 500;
      font-size: 13px;
      color: #2c3e50;
      margin-bottom: 2px;
    }
    
    .company, .institution {
      font-size: 11px;
      color: #7f8c8d;
    }
    
    .date {
      font-size: 10px;
      color: #95a5a6;
      white-space: nowrap;
    }
    
    .description {
      font-size: 11px;
      color: #34495e;
      margin-top: 6px;
      line-height: 1.6;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 3px 8px;
      background: #ecf0f1;
      color: #2c3e50;
      border-radius: 2px;
      font-size: 10px;
      margin: 3px 3px 3px 0;
    }
    
    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{name}}</h1>
      {{#if title}}<div class="title">{{title}}</div>{{/if}}
      <div class="contact-info">
        {{#if email}}<span>{{email}}</span>{{/if}}
        {{#if phone}}<span>{{phone}}</span>{{/if}}
        {{#if location}}<span>{{location}}</span>{{/if}}
      </div>
    </div>
    
    {{summary}}
    
    <div class="section">
      <h2 class="section-title">Erfarenhet</h2>
      {{experience}}
    </div>
    
    <div class="section">
      <h2 class="section-title">Utbildning</h2>
      {{education}}
    </div>
    
    <div class="section">
      <h2 class="section-title">Färdigheter</h2>
      {{skills}}
    </div>
    
    {{#if certifications}}
    <div class="section">
      <h2 class="section-title">Certifieringar</h2>
      {{certifications}}
    </div>
    {{/if}}
    
    {{#if languages}}
    <div class="section">
      <h2 class="section-title">Språk</h2>
      {{languages}}
    </div>
    {{/if}}
  </div>
</body>
</html>`;
  }

  /**
   * Professional template (corporate style with sidebar)
   */
  private getProfessionalTemplate(): string {
    return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: {{fontSizeBase}};
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: white;
      display: flex;
    }
    
    .sidebar {
      width: 70mm;
      background: {{colorPrimary}};
      color: white;
      padding: 20mm 15mm;
      page-break-inside: avoid;
    }
    
    .main-content {
      flex: 1;
      padding: 20mm 20mm;
    }
    
    .header {
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 24px;
      color: white;
      margin-bottom: 5px;
      font-weight: 600;
    }
    
    .header .title {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 15px;
    }
    
    .contact-info {
      margin-top: 20px;
    }
    
    .contact-info span {
      display: block;
      font-size: 10px;
      margin-bottom: 8px;
      color: rgba(255, 255, 255, 0.9);
    }
    
    .sidebar-section {
      margin-top: 25px;
      margin-bottom: 25px;
    }
    
    .sidebar-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      padding-bottom: 5px;
    }
    
    .main-section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .main-section-title {
      font-size: 16px;
      color: {{colorPrimary}};
      font-weight: 600;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid {{colorPrimary}};
      padding-bottom: 5px;
    }
    
    .summary {
      margin: 20px 0;
      padding: 15px;
      background: #f5f5f5;
      border-left: 4px solid {{colorPrimary}};
      font-size: 11px;
      line-height: 1.7;
      color: #333;
    }
    
    .experience-item, .education-item {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .experience-header, .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .job-title, .degree {
      font-weight: 600;
      font-size: 13px;
      color: #1a1a1a;
      margin-bottom: 3px;
    }
    
    .company, .institution {
      font-size: 11px;
      color: #555;
    }
    
    .date {
      font-size: 10px;
      color: #777;
      white-space: nowrap;
    }
    
    .description {
      font-size: 11px;
      color: #444;
      margin-top: 8px;
      line-height: 1.6;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 3px;
      font-size: 10px;
      margin: 3px 3px 3px 0;
    }
    
    .white-text {
      color: white;
      font-size: 11px;
    }
    
    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <div class="header">
        <h1>{{name}}</h1>
        {{#if title}}<div class="title">{{title}}</div>{{/if}}
      </div>
      
      <div class="contact-info">
        {{#if email}}<span>📧 {{email}}</span>{{/if}}
        {{#if phone}}<span>📱 {{phone}}</span>{{/if}}
        {{#if location}}<span>📍 {{location}}</span>{{/if}}
      </div>
      
      <div class="sidebar-section">
        <h3 class="sidebar-title">Färdigheter</h3>
        <div class="white-text">{{skills}}</div>
      </div>
      
      <div class="sidebar-section">
        <h3 class="sidebar-title">Utbildning</h3>
        <div class="white-text">{{education}}</div>
      </div>
      
      {{#if certifications}}
      <div class="sidebar-section">
        <h3 class="sidebar-title">Certifieringar</h3>
        <div class="white-text">{{certifications}}</div>
      </div>
      {{/if}}
      
      {{#if languages}}
      <div class="sidebar-section">
        <h3 class="sidebar-title">Språk</h3>
        <div class="white-text">{{languages}}</div>
      </div>
      {{/if}}
    </div>
    
    <div class="main-content">
      {{summary}}
      
      <div class="main-section">
        <h2 class="main-section-title">Erfarenhet</h2>
        {{experience}}
      </div>
      
      {{#if projects}}
      <div class="main-section">
        <h2 class="main-section-title">Projekt</h2>
        {{projects}}
      </div>
      {{/if}}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Extract structured data from resume text using AI
   */
  async extractStructuredData(resumeText: string, parsedData?: any): Promise<ResumeData> {
    // Extract name - try multiple sources
    let extractedName = parsedData?.contactInfo?.name || this.extractName(resumeText);
    
    // If name is still "Your Name" or similar placeholder, try to extract from filename or other sources
    if (!extractedName || extractedName.toLowerCase().includes('your name') || extractedName.toLowerCase().includes('namn')) {
      // Try to extract from parsedData filename if available
      if (parsedData?.filename) {
        const filenameMatch = parsedData.filename.match(/CV\s+([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)/i);
        if (filenameMatch) {
          extractedName = filenameMatch[1];
        }
      }
      // If still not found, use fallback
      if (!extractedName || extractedName.toLowerCase().includes('your name')) {
        extractedName = 'Your Name';
      }
    }
    
    // Use parsed data if available, otherwise extract from text
    const personalInfo = {
      name: extractedName,
      title: parsedData?.sections?.summary?.split('\n')[0] || this.extractTitle(resumeText) || '',
      email: parsedData?.contactInfo?.email || this.extractEmail(resumeText) || '',
      phone: parsedData?.contactInfo?.phone || this.extractPhone(resumeText) || '',
      location: parsedData?.contactInfo?.location || this.extractLocation(resumeText) || '',
      linkedIn: this.extractLinkedIn(resumeText) || '',
      website: this.extractWebsite(resumeText) || '',
    };

    // Extract experience
    let experience: ResumeData['experience'] = [];
    if (parsedData?.sections?.experience && Array.isArray(parsedData.sections.experience)) {
      experience = parsedData.sections.experience.map((exp: any) => ({
        title: exp.title || '',
        company: exp.company || '',
        location: exp.location || '',
        startDate: exp.startDate || exp.period?.split('-')[0]?.trim() || '',
        endDate: exp.endDate || (exp.period?.includes('-') ? exp.period.split('-')[1]?.trim() : ''),
        current: exp.current || exp.period?.toLowerCase().includes('present') || false,
        description: exp.description || '',
        achievements: exp.achievements || exp.responsibilities || [],
      }));
    }

    // Extract education
    let education: ResumeData['education'] = [];
    if (parsedData?.sections?.education && Array.isArray(parsedData.sections.education)) {
      education = parsedData.sections.education.map((edu: any) => ({
        degree: edu.degree || edu.program || '',
        institution: edu.institution || edu.school || '',
        location: edu.location || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || edu.graduationDate || '',
        gpa: edu.gpa || '',
        honors: edu.honors || [],
      }));
    }

    // Extract skills
    let skills: ResumeData['skills'] = [];
    if (parsedData?.sections?.skills && Array.isArray(parsedData.sections.skills)) {
      // Group skills by category if available
      if (typeof parsedData.sections.skills[0] === 'object') {
        skills = parsedData.sections.skills.map((skill: any) => ({
          category: skill.category || '',
          items: Array.isArray(skill.items) ? skill.items : [skill.name || skill],
        }));
      } else {
        skills = [{ items: parsedData.sections.skills }];
      }
    }

    // Extract summary - clean up duplicates and placeholders
    // IMPORTANT: For adapted resumes, extract summary from text first to avoid duplication
    // If summary appears in text (at the beginning), use that instead of parsedData
    let summary = '';
    
    // First, try to extract summary from the beginning of resumeText (for adapted resumes)
    // Look for summary/profil section at the start of text (before experience/education sections)
    // Pattern: Everything from start until we hit a section header (ERFARENHET, UTBILDNING, etc.)
    const sectionHeaders = /(?:^|\n\n)(ERFARENHET|UTBILDNING|FÄRDIGHETER|CERTIFIERINGAR|SPRÅK|PROJEKT|SAMMANFATTNING|PROFIL)/i;
    const sectionMatch = resumeText.match(sectionHeaders);
    
    if (sectionMatch && sectionMatch.index !== undefined && sectionMatch.index > 50) {
      // Extract text before first section header
      const textBeforeSection = resumeText.substring(0, sectionMatch.index).trim();
      
      // Remove name and contact info (they're usually at the very start)
      // Name is usually first line, then contact info
      const lines = textBeforeSection.split('\n').filter(line => line.trim().length > 0);
      
      // Skip first 2-3 lines (name, title, contact info)
      const potentialSummary = lines.slice(2).join(' ').trim();
      
      // Check if this looks like a summary (not just name/contact info)
      if (potentialSummary.length > 100 && 
          !potentialSummary.match(/^[A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+\s*$/) &&
          potentialSummary.length < 500) { // Reasonable summary length
        summary = potentialSummary;
      }
    }
    
    // If no summary found in text, use parsedData
    if (!summary) {
      summary = parsedData?.sections?.summary || parsedData?.sections?.profile || '';
    } else {
      // Summary was extracted from text - check if parsedData has a similar one
      // If they're very similar, we already have the one from text (more up-to-date for adapted resumes)
      const parsedSummary = parsedData?.sections?.summary || parsedData?.sections?.profile || '';
      if (parsedSummary && parsedSummary.length > 50) {
        // Check if they're similar (likely duplicates)
        const similarity = this.calculateSimilarity(summary.substring(0, 200), parsedSummary.substring(0, 200));
        if (similarity > 0.7) {
          // They're similar - use the one from text (it's more up-to-date for adapted resumes)
          // summary already set from text above, so we keep it
        }
      }
    }
    
    // Remove "Your Name" placeholder if it appears in summary
    if (summary) {
      summary = summary.replace(/Your Name/gi, extractedName || '');
      
      // First, normalize all whitespace to single spaces
      summary = summary.replace(/\s+/g, ' ').trim();
      
      // Check if the entire text is duplicated (same text appears twice)
      // This is the most common case - exact duplication
      const textLength = summary.length;
      
      if (textLength > 100) {
        // Try to find where duplication starts by checking if second half matches first half
        // Check multiple split points
        const splitPoints = [0.45, 0.48, 0.5, 0.52, 0.55];
        let foundDuplicate = false;
        let bestSplitIndex = 0;
        
        for (const splitRatio of splitPoints) {
          const splitIndex = Math.floor(textLength * splitRatio);
          const firstPart = summary.substring(0, splitIndex).trim();
          const secondPart = summary.substring(splitIndex).trim();
          
          if (firstPart.length > 50 && secondPart.length > 50) {
            // Get first 20 words of each part for comparison
            const firstWords = firstPart.split(/\s+/).slice(0, 20).join(' ').toLowerCase();
            const secondWords = secondPart.split(/\s+/).slice(0, 20).join(' ').toLowerCase();
            
            // If they start the same, it's likely a duplicate
            if (firstWords === secondWords && firstWords.length > 40) {
              foundDuplicate = true;
              bestSplitIndex = splitIndex;
              break;
            }
            
            // Also check similarity
            const similarity = this.calculateSimilarity(firstPart, secondPart);
            if (similarity > 0.88) {
              foundDuplicate = true;
              bestSplitIndex = splitIndex;
              break;
            }
          }
        }
        
        if (foundDuplicate) {
          summary = summary.substring(0, bestSplitIndex).trim();
        } else {
          // Check if it's a simple 50/50 split duplicate
          const midPoint = Math.floor(textLength / 2);
          const firstHalf = summary.substring(0, midPoint).trim();
          const secondHalf = summary.substring(midPoint).trim();
          
          if (firstHalf.length > 50 && secondHalf.length > 50) {
            // Compare first 25 words
            const firstWords = firstHalf.split(/\s+/).slice(0, 25).join(' ').toLowerCase();
            const secondWords = secondHalf.split(/\s+/).slice(0, 25).join(' ').toLowerCase();
            
            if (firstWords === secondWords || this.calculateSimilarity(firstHalf, secondHalf) > 0.92) {
              summary = firstHalf;
            }
          }
        }
      }
      
      // Remove duplicate lines (if summary has line breaks)
      const summaryLines = summary.split('\n');
      const uniqueLines: string[] = [];
      const seenLines = new Set<string>();
      
      for (const line of summaryLines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.length > 10) {
          const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
          if (!seenLines.has(normalized)) {
            seenLines.add(normalized);
            uniqueLines.push(trimmed);
          }
        } else if (trimmed.length <= 10) {
          uniqueLines.push(trimmed);
        }
      }
      
      summary = uniqueLines.join(' ').trim();
      
      // Final check: remove duplicate sentences
      const sentences = summary.split(/[.!?]\s+/).filter((s: string) => s.trim().length > 15);
      if (sentences.length > 1) {
        const uniqueSentences: string[] = [];
        const seenSentences = new Set<string>();
        
        for (const sentence of sentences) {
          const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
          if (!seenSentences.has(normalized)) {
            seenSentences.add(normalized);
            uniqueSentences.push(sentence.trim());
          }
        }
        
        if (uniqueSentences.length < sentences.length) {
          summary = uniqueSentences.join('. ').trim();
          if (summary && !summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
            summary += '.';
          }
        }
      }
    }

    return {
      personalInfo,
      summary,
      experience,
      education,
      skills,
      certifications: parsedData?.sections?.certifications || [],
      languages: parsedData?.sections?.languages || [],
      projects: parsedData?.sections?.projects || [],
    };
  }

  /**
   * Helper methods to extract data from text
   */
  private extractName(text: string): string | null {
    // Try multiple patterns to find name
    // Pattern 1: Name at the start of text (before "Your Name" or other placeholders)
    let nameMatch = text.match(/^([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)/m);
    if (nameMatch && !nameMatch[1].toLowerCase().includes('your name') && !nameMatch[1].toLowerCase().includes('namn')) {
      return nameMatch[1];
    }
    
    // Pattern 2: Look for common name patterns (First Last or First Middle Last)
    // Skip if it's "Your Name" or similar placeholders
    const namePatterns = [
      /(?:^|\n)([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+){1,2})(?:\s|$|,|\.)/m,
      /(?:CV|Resume|Curriculum Vitae)[\s:]+([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)/i,
    ];
    
    for (const pattern of namePatterns) {
      nameMatch = text.match(pattern);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        // Skip common placeholders
        if (!name.toLowerCase().includes('your name') && 
            !name.toLowerCase().includes('namn') &&
            !name.toLowerCase().includes('example') &&
            name.length > 3 && name.length < 50) {
          return name;
        }
      }
    }
    
    return null;
  }

  private extractTitle(text: string): string | null {
    const titleMatch = text.match(/(?:Titel|Title|Yrke|Profession)[:\s]+(.+)/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  private extractEmail(text: string): string | null {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch ? emailMatch[1] : null;
  }

  private extractPhone(text: string): string | null {
    const phoneMatch = text.match(/(?:\+46|0)[\s-]?[0-9\s-]{8,}/);
    return phoneMatch ? phoneMatch[0].trim() : null;
  }

  private extractLocation(text: string): string | null {
    const locationMatch = text.match(/([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)*)\s+\d{3}\s?\d{2}/);
    return locationMatch ? locationMatch[1] : null;
  }

  private extractLinkedIn(text: string): string | null {
    const linkedInMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)([a-zA-Z0-9-]+)/i);
    return linkedInMatch ? `linkedin.com/in/${linkedInMatch[1]}` : null;
  }

  private extractWebsite(text: string): string | null {
    const websiteMatch = text.match(/(https?:\/\/[^\s]+)/i);
    return websiteMatch ? websiteMatch[1] : null;
  }

  /**
   * Generate LaTeX CV from structured data
   */
  async generateLaTeX(data: ResumeData): Promise<string> {
    const escapeLaTeX = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\$/g, '\\$')
        .replace(/\&/g, '\\&')
        .replace(/#/g, '\\#')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/_/g, '\\_')
        .replace(/%/g, '\\%')
        .replace(/~/g, '\\textasciitilde{}');
    };

    let latex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[swedish]{babel}
\\usepackage[margin=1.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{hyperref}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=blue,
    pdftitle={${escapeLaTeX(data.personalInfo.name)} - CV},
    pdfauthor={${escapeLaTeX(data.personalInfo.name)}}
}

\\titleformat{\\section}
{\\Large\\bfseries\\color{blue!70!black}}
{}{0em}{}[\\titlerule]

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.5em}

\\begin{document}

\\begin{center}
{\\Huge\\bfseries ${escapeLaTeX(data.personalInfo.name)}}\\\\[0.5em]
`;

    if (data.personalInfo.title) {
      latex += `{\\large ${escapeLaTeX(data.personalInfo.title)}}\\\\[0.5em]\n`;
    }

    latex += `\\vspace{0.3em}\n`;

    // Contact information
    const contactInfo: string[] = [];
    if (data.personalInfo.email) contactInfo.push(`\\href{mailto:${data.personalInfo.email}}{${escapeLaTeX(data.personalInfo.email)}}`);
    if (data.personalInfo.phone) contactInfo.push(escapeLaTeX(data.personalInfo.phone));
    if (data.personalInfo.location) contactInfo.push(escapeLaTeX(data.personalInfo.location));
    if (data.personalInfo.linkedIn) contactInfo.push(`\\href{https://${data.personalInfo.linkedIn}}{${escapeLaTeX(data.personalInfo.linkedIn)}}`);
    if (data.personalInfo.website) contactInfo.push(`\\href{${data.personalInfo.website}}{${escapeLaTeX(data.personalInfo.website)}}`);

    if (contactInfo.length > 0) {
      latex += contactInfo.join(' $\\bullet$ ') + `\\\\[0.5em]\n`;
    }

    latex += `\\end{center}\n\n`;

    // Summary
    if (data.summary && data.summary.trim()) {
      latex += `\\section*{Sammanfattning}\n${escapeLaTeX(data.summary)}\n\n`;
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      latex += `\\section*{Erfarenhet}\n\\begin{itemize}[leftmargin=*,itemsep=0.3em]\n`;
      for (const exp of data.experience) {
        latex += `\\item[\\textbf{${escapeLaTeX(exp.title)}}] `;
        if (exp.company) {
          latex += `\\textit{${escapeLaTeX(exp.company)}}`;
          if (exp.location) latex += `, ${escapeLaTeX(exp.location)}`;
        }
        if (exp.startDate || exp.endDate) {
          latex += ` \\hfill `;
          if (exp.current) {
            latex += `${escapeLaTeX(exp.startDate)} -- Nuvarande`;
          } else {
            latex += `${escapeLaTeX(exp.startDate)} -- ${escapeLaTeX(exp.endDate || '')}`;
          }
        }
        latex += `\n`;
        if (exp.description) {
          latex += `\\begin{itemize}[leftmargin=1.5em]\n`;
          latex += `\\item ${escapeLaTeX(exp.description)}\n`;
          latex += `\\end{itemize}\n`;
        }
        if (exp.achievements && exp.achievements.length > 0) {
          latex += `\\begin{itemize}[leftmargin=1.5em]\n`;
          for (const achievement of exp.achievements) {
            latex += `\\item ${escapeLaTeX(achievement)}\n`;
          }
          latex += `\\end{itemize}\n`;
        }
      }
      latex += `\\end{itemize}\n\n`;
    }

    // Education
    if (data.education && data.education.length > 0) {
      latex += `\\section*{Utbildning}\n\\begin{itemize}[leftmargin=*,itemsep=0.3em]\n`;
      for (const edu of data.education) {
        latex += `\\item[\\textbf{${escapeLaTeX(edu.degree)}}] `;
        if (edu.institution) {
          latex += `\\textit{${escapeLaTeX(edu.institution)}}`;
          if (edu.location) latex += `, ${escapeLaTeX(edu.location)}`;
        }
        if (edu.endDate) {
          latex += ` \\hfill ${escapeLaTeX(edu.endDate)}`;
        }
        latex += `\n`;
        if (edu.honors && edu.honors.length > 0) {
          latex += `\\begin{itemize}[leftmargin=1.5em]\n`;
          for (const honor of edu.honors) {
            latex += `\\item ${escapeLaTeX(honor)}\n`;
          }
          latex += `\\end{itemize}\n`;
        }
      }
      latex += `\\end{itemize}\n\n`;
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      latex += `\\section*{Färdigheter}\n`;
      for (const skillGroup of data.skills) {
        if (skillGroup.category) {
          latex += `\\textbf{${escapeLaTeX(skillGroup.category)}}: `;
        }
        if (skillGroup.items && skillGroup.items.length > 0) {
          latex += skillGroup.items.map(item => escapeLaTeX(item)).join(', ') + `\\\\[0.3em]\n`;
        }
      }
      latex += `\n`;
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      latex += `\\section*{Certifieringar}\n\\begin{itemize}[leftmargin=*,itemsep=0.3em]\n`;
      for (const cert of data.certifications) {
        latex += `\\item[\\textbf{${escapeLaTeX(cert.name)}}] ${escapeLaTeX(cert.issuer)}`;
        if (cert.date) latex += ` (${escapeLaTeX(cert.date)})`;
        latex += `\n`;
      }
      latex += `\\end{itemize}\n\n`;
    }

    // Languages
    if (data.languages && data.languages.length > 0) {
      latex += `\\section*{Språk}\n\\begin{itemize}[leftmargin=*,itemsep=0.3em]\n`;
      for (const lang of data.languages) {
        latex += `\\item \\textbf{${escapeLaTeX(lang.language)}}: ${escapeLaTeX(lang.level)}\n`;
      }
      latex += `\\end{itemize}\n\n`;
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      latex += `\\section*{Projekt}\n\\begin{itemize}[leftmargin=*,itemsep=0.3em]\n`;
      for (const project of data.projects) {
        latex += `\\item[\\textbf{${escapeLaTeX(project.name)}}] `;
        if (project.description) {
          latex += `${escapeLaTeX(project.description)}`;
        }
        if (project.technologies && project.technologies.length > 0) {
          latex += ` \\textit{(${project.technologies.map(t => escapeLaTeX(t)).join(', ')})}`;
        }
        if (project.url) {
          latex += ` \\href{${project.url}}{Länk}`;
        }
        latex += `\n`;
      }
      latex += `\\end{itemize}\n\n`;
    }

    latex += `\\end{document}\n`;

    return latex;
  }
}

export const resumePDFService = new ResumePDFService();

