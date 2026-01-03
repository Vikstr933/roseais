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
    // Also limit length to prevent layout issues
    let summaryHtml = '';
    if (data.summary && data.summary.trim()) {
      // Clean up summary - remove duplicates and limit length
      let cleanSummary = data.summary.trim();
      // Remove if summary is just the name or title
      if (cleanSummary.toLowerCase() === data.personalInfo.name.toLowerCase() || 
          cleanSummary.length < 20) {
        summaryHtml = '';
      } else {
        // Limit summary to reasonable length for PDF
        if (cleanSummary.length > 500) {
          cleanSummary = cleanSummary.substring(0, 497) + '...';
        }
        summaryHtml = `<div class="summary">${this.escapeHtml(cleanSummary)}</div>`;
      }
    }
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
   * Modern template (two-column layout)
   */
  private getModernTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: {{fontSizeBase}};
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm 15mm;
      background: white;
      page-break-inside: avoid;
    }
    
    .header {
      border-bottom: 3px solid {{colorPrimary}};
      padding-bottom: 12px;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    
    .header h1 {
      font-size: {{fontSizeHeading}};
      color: {{colorPrimary}};
      margin-bottom: 4px;
      font-weight: 700;
      line-height: 1.2;
    }
    
    .header .title {
      font-size: {{fontSizeBase}};
      color: #666;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    
    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 10px;
      color: #555;
      line-height: 1.4;
    }
    
    .contact-info span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .summary {
      margin: 15px 0;
      padding: 12px;
      background: #f8f9fa;
      border-left: 4px solid {{colorPrimary}};
      font-style: italic;
      color: #555;
      font-size: 11px;
      line-height: 1.5;
      page-break-inside: avoid;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 25px;
      margin-top: 20px;
    }
    
    .main-column {
      /* Left column - experience, projects */
      page-break-inside: avoid;
    }
    
    .sidebar {
      /* Right column - skills, education, certifications */
      page-break-inside: avoid;
    }
    
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .section:last-child {
      margin-bottom: 0;
    }
    
    .section-title {
      font-size: {{fontSizeHeading}};
      color: {{colorPrimary}};
      font-weight: 600;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 2px solid {{colorPrimary}};
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .experience-item, .education-item, .project-item {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .experience-item:last-child, .education-item:last-child, .project-item:last-child {
      border-bottom: none;
    }
    
    .experience-header, .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .job-title, .degree {
      font-size: {{fontSizeBase}};
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 3px;
    }
    
    .company, .institution {
      color: #6b7280;
      font-size: 11px;
    }
    
    .date {
      font-size: 10px;
      color: #9ca3af;
      white-space: nowrap;
      margin-left: 10px;
    }
    
    .job-description {
      margin: 8px 0;
      color: #555;
      font-size: 11px;
    }
    
    .achievements {
      margin-top: 8px;
      padding-left: 20px;
    }
    
    .achievements li {
      margin-bottom: 4px;
      font-size: 11px;
      color: #555;
    }
    
    .skill-group {
      margin-bottom: 15px;
    }
    
    .skill-category {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    
    .skill-items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 4px 10px;
      background: {{colorPrimary}};
      color: white;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;
    }
    
    .certification-item, .language-item {
      margin-bottom: 12px;
    }
    
    .cert-name, .language-name {
      font-weight: 600;
      font-size: 11px;
      color: #1f2937;
    }
    
    .cert-issuer, .language-level {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
    
    .project-name {
      font-weight: 600;
      font-size: 11px;
      color: #1f2937;
      margin-bottom: 5px;
    }
    
    .project-description {
      font-size: 11px;
      color: #555;
      margin-bottom: 5px;
    }
    
    .project-tech {
      font-size: 10px;
      color: #6b7280;
      font-style: italic;
    }
    
    .project-url {
      font-size: 10px;
      color: {{colorPrimary}};
      text-decoration: none;
    }
    
    @media print {
      .container {
        padding: 0;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      .experience-item, .education-item {
        page-break-inside: avoid;
      }
      
      .two-column {
        page-break-inside: avoid;
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
        {{#if email}}<span>📧 {{email}}</span>{{/if}}
        {{#if phone}}<span>📱 {{phone}}</span>{{/if}}
        {{#if location}}<span>📍 {{location}}</span>{{/if}}
        {{#if linkedIn}}<span>💼 {{linkedIn}}</span>{{/if}}
        {{#if website}}<span>🌐 {{website}}</span>{{/if}}
      </div>
    </div>
    
    {{summary}}
    
    <div class="two-column">
      <div class="main-column">
        <div class="section">
          <h2 class="section-title">Experience</h2>
          {{experience}}
        </div>
        
        {{#if projects}}
        <div class="section">
          <h2 class="section-title">Projects</h2>
          {{projects}}
        </div>
        {{/if}}
      </div>
      
      <div class="sidebar">
        <div class="section">
          <h2 class="section-title">Skills</h2>
          {{skills}}
        </div>
        
        <div class="section">
          <h2 class="section-title">Education</h2>
          {{education}}
        </div>
        
        {{#if certifications}}
        <div class="section">
          <h2 class="section-title">Certifications</h2>
          {{certifications}}
        </div>
        {{/if}}
        
        {{#if languages}}
        <div class="section">
          <h2 class="section-title">Languages</h2>
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
   * Classic template (single column)
   */
  private getClassicTemplate(): string {
    return this.getModernTemplate(); // Simplified for now
  }

  /**
   * Minimal template
   */
  private getMinimalTemplate(): string {
    return this.getModernTemplate(); // Simplified for now
  }

  /**
   * Professional template
   */
  private getProfessionalTemplate(): string {
    return this.getModernTemplate(); // Simplified for now
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
    let summary = parsedData?.sections?.summary || parsedData?.sections?.profile || '';
    
    // Remove "Your Name" placeholder if it appears in summary
    if (summary) {
      summary = summary.replace(/Your Name/gi, extractedName || '');
      // Remove duplicate summary if it appears twice
      const summaryLines = summary.split('\n');
      const uniqueLines: string[] = [];
      const seen = new Set<string>();
      for (const line of summaryLines) {
        const trimmed = line.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          uniqueLines.push(line);
        }
      }
      summary = uniqueLines.join('\n').trim();
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
}

export const resumePDFService = new ResumePDFService();

