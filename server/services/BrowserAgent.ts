/**
 * Browser Agent Service
 * 
 * Uses Playwright to analyze web applications visually:
 * - CSS/Design problem detection
 * - Responsive design testing
 * - Accessibility auditing
 * - Performance analysis
 * - Visual quality assurance
 */

import { chromium, Browser, Page } from 'playwright';
import { SimpleLogger } from '../utils/SimpleLogger';
import { MultiModelAIService } from './MultiModelAIService';
import { execa } from 'execa';

const logger = new SimpleLogger('BrowserAgent');

export interface VisualAnalysisResult {
  url: string;
  viewport: { width: number; height: number };
  issues: VisualIssue[];
  metrics: {
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
  };
  accessibility: {
    score: number;
    violations: AccessibilityViolation[];
  };
  screenshot?: string; // Base64 encoded screenshot
  timestamp: number;
  aiInsights?: {
    designQuality: number; // 0-100 score
    uxIssues: string[];
    recommendations: string[];
    overallAssessment: string;
  };
}

export interface VisualIssue {
  type: 'layout' | 'css' | 'responsive' | 'accessibility' | 'performance' | 'visual';
  severity: 'critical' | 'high' | 'medium' | 'low';
  element?: string; // CSS selector or element description
  message: string;
  suggestion?: string;
  screenshot?: string; // Base64 encoded screenshot of issue
}

export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes: Array<{
    html: string;
    target: string[];
  }>;
}

export class BrowserAgent {
  private browser: Browser | null = null;
  private logger: SimpleLogger;
  private multiModelAI: MultiModelAIService;
  private useAIForVisualAnalysis: boolean = true; // Enable AI enhancement by default
  private installationAttempted = false;

  constructor() {
    this.logger = new SimpleLogger('BrowserAgent');
    this.multiModelAI = new MultiModelAIService();
  }

  /**
   * Initialize browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.logger.info('Launching headless browser...');
      try {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'] // For server environments
        });
      } catch (error: any) {
        // Check if it's a missing browser executable error
        if (error.message?.includes('Executable doesn\'t exist') || 
            error.message?.includes('chromium_headless_shell') ||
            error.message?.includes('playwright')) {
          
          // Try to install browsers at runtime as a fallback (only once)
          if (!this.installationAttempted) {
            this.installationAttempted = true;
            this.logger.warn('Playwright browsers not found. Attempting runtime installation...');
            
            try {
              await this.installBrowsers();
              // Retry launching browser after installation
              this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
              });
              this.logger.info('✅ Successfully installed and launched Playwright browser');
              return this.browser;
            } catch (installError: any) {
              this.logger.error('Failed to install Playwright browsers at runtime:', installError);
              // Fall through to throw the original error
            }
          }
          
          this.logger.error('Playwright browsers not installed. Run: npx playwright install chromium');
          throw new Error(
            'Browser analysis unavailable: Playwright browsers are not installed. ' +
            'Please run "npx playwright install chromium" in the production environment. ' +
            'This should be done automatically via the postinstall script, but may require manual installation on some platforms.'
          );
        }
        // Re-throw other errors
        throw error;
      }
    }
    return this.browser;
  }

  /**
   * Install Playwright browsers at runtime (fallback if build-time installation failed)
   */
  private async installBrowsers(): Promise<void> {
    try {
      this.logger.info('Installing Playwright chromium browser...');
      const { stdout, stderr } = await execa('npx', ['playwright', 'install', 'chromium'], {
        timeout: 120000, // 2 minutes timeout
        cwd: process.cwd()
      });
      
      if (stdout) {
        this.logger.info(`Playwright installation output: ${stdout.substring(0, 200)}`);
      }
      if (stderr && !stderr.includes('already installed')) {
        this.logger.warn(`Playwright installation warnings: ${stderr.substring(0, 200)}`);
      }
      
      this.logger.info('✅ Playwright browsers installed successfully');
    } catch (error: any) {
      this.logger.error('Failed to install Playwright browsers:', error.message);
      throw error;
    }
  }

  /**
   * Analyze a web page for visual and design issues
   */
  async analyzePage(
    url: string,
    options: {
      viewports?: Array<{ width: number; height: number; name?: string }>;
      takeScreenshot?: boolean;
      checkAccessibility?: boolean;
      checkPerformance?: boolean;
    } = {}
  ): Promise<VisualAnalysisResult> {
    const startTime = Date.now();
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      this.logger.info(`Analyzing page: ${url}`);

      // Default viewports if not specified
      const viewports = options.viewports || [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];

      // Use first viewport for main analysis
      const mainViewport = viewports[0] ?? { width: 1920, height: 1080, name: 'desktop' };
      await page.setViewportSize({ width: mainViewport.width, height: mainViewport.height });

      // Navigate and wait for page to load
      const navigationStart = Date.now();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const loadTime = Date.now() - navigationStart;

      // Wait for page content to actually render (not just network idle)
      // This is important for React/Vite apps that may show white screen initially
      try {
        // Wait for body to have content (not just empty)
        await page.waitForFunction(
          () => {
            const body = document.body;
            if (!body) return false;
            // Check if body has visible content (not just whitespace)
            const hasContent = body.children.length > 0 ||
                             (body.textContent?.trim().length ?? 0) > 0 ||
                             body.innerHTML.trim().length > 100; // At least some HTML
            return hasContent;
          },
          { timeout: 10000 } // Wait up to 10 seconds for content
        );
        
        // Additional wait for React apps to hydrate
        await page.waitForTimeout(1000); // Give React/Vite apps time to render
      } catch (error) {
        this.logger.warn('Page content check timeout, proceeding anyway', error as Error);
        // Continue even if content check times out - might be a static page
      }

      // Get performance metrics
      const metrics = await this.getPerformanceMetrics(page);

      // Detect visual issues
      const issues: VisualIssue[] = [];
      
      // CSS/Layout issues
      issues.push(...await this.detectLayoutIssues(page));
      issues.push(...await this.detectCSSIssues(page));
      
      // Responsive issues (test all viewports)
      if (viewports.length > 1) {
        for (const viewport of viewports.slice(1)) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.waitForTimeout(500); // Wait for layout to adjust
          issues.push(...await this.detectResponsiveIssues(page, viewport));
        }
      }

      // Accessibility issues
      let accessibility = { score: 100, violations: [] as AccessibilityViolation[] };
      if (options.checkAccessibility !== false) {
        accessibility = await this.checkAccessibility(page);
        issues.push(...accessibility.violations.map(v => ({
          type: 'accessibility' as const,
          severity: v.impact === 'critical' ? 'critical' as const :
                    v.impact === 'serious' ? 'high' as const :
                    v.impact === 'moderate' ? 'medium' as const : 'low' as const,
          message: v.description,
          suggestion: `Fix accessibility issue: ${v.id}`
        })));
      }

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (options.takeScreenshot !== false) {
        // Double-check that page has content before taking screenshot
        const hasContent = await page.evaluate(() => {
          const body = document.body;
          if (!body) return false;
          // Check for visible content
          const hasVisibleContent = body.children.length > 0 ||
                                   (body.textContent?.trim().length ?? 0) > 0 ||
                                   window.getComputedStyle(body).backgroundColor !== 'rgb(255, 255, 255)'; // Not just white background
          return hasVisibleContent;
        });

        if (!hasContent) {
          this.logger.warn('Page appears to be blank/white, waiting longer before screenshot');
          // Wait a bit more for content to load
          await page.waitForTimeout(2000);
          
          // Check again
          const stillBlank = await page.evaluate(() => {
            const body = document.body;
            return !body || (body.children.length === 0 && body.textContent?.trim().length === 0);
          });
          
          if (stillBlank) {
            this.logger.warn('Page still appears blank after additional wait');
            // Continue anyway - might be a legitimate blank page or error page
          }
        }

        screenshot = await page.screenshot({ 
          type: 'png', 
          fullPage: false, // Just viewport for now
          timeout: 5000 // 5 second timeout for screenshot
        }).then(buf => buf.toString('base64'));
      }

      // Enhance with AI visual analysis if screenshot is available
      let aiInsights;
      if (this.useAIForVisualAnalysis && screenshot) {
        try {
          this.logger.info('Enhancing analysis with AI visual insights');
          aiInsights = await this.analyzeWithAI(screenshot, issues, url);
        } catch (error) {
          this.logger.warn('AI visual analysis failed, continuing without AI insights', error as Error);
          // Continue without AI insights - hardcoded analysis is still valid
        }
      }

      return {
        url,
        viewport: mainViewport,
        issues,
        metrics,
        accessibility,
        screenshot,
        timestamp: Date.now(),
        aiInsights
      };
    } catch (error) {
      this.logger.error('Failed to analyze page', error as Error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Detect layout issues (overflow, misalignment, etc.)
   */
  private async detectLayoutIssues(page: Page): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = [];

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasOverflow) {
      issues.push({
        type: 'layout',
        severity: 'high',
        message: 'Horizontal overflow detected - page is wider than viewport',
        suggestion: 'Check for elements with fixed widths or negative margins'
      });
    }

    // Check for elements outside viewport
    const elementsOutOfView = await page.evaluate(() => {
      const elements: Array<{ selector: string; reason: string }> = [];
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (rect.right > viewportWidth || rect.bottom > viewportHeight) {
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const className = el.className ? `.${el.className.split(' ')[0]}` : '';
          elements.push({
            selector: `${tagName}${id}${className}`,
            reason: rect.right > viewportWidth ? 'extends beyond right edge' : 'extends beyond bottom edge'
          });
        }
      });
      
      return elements.slice(0, 5); // Limit to first 5
    });

    if (elementsOutOfView.length > 0) {
      issues.push({
        type: 'layout',
        severity: 'medium',
        message: `${elementsOutOfView.length} element(s) extend beyond viewport`,
        suggestion: 'Check responsive design and ensure elements fit within viewport',
        element: elementsOutOfView.map(e => e.selector).join(', ')
      });
    }

    // Check for overlapping elements (z-index issues)
    const overlappingElements = await page.evaluate(() => {
      const overlaps: Array<{ element1: string; element2: string }> = [];
      const elements = Array.from(document.querySelectorAll('*'));
      const ignoredTags = new Set(['html', 'body', 'head', 'script', 'style', 'link', 'meta', 'iframe']);
      
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const firstTag = elements[i].tagName.toLowerCase();
          const secondTag = elements[j].tagName.toLowerCase();

          if (ignoredTags.has(firstTag) || ignoredTags.has(secondTag)) {
            continue;
          }

          // Parent/child boxes overlap by definition; only sibling overlap is useful.
          if (elements[i].contains(elements[j]) || elements[j].contains(elements[i])) {
            continue;
          }

          const rect1 = elements[i].getBoundingClientRect();
          const rect2 = elements[j].getBoundingClientRect();
          
          if (rect1.width > 0 && rect1.height > 0 && rect2.width > 0 && rect2.height > 0) {
            const overlap = !(
              rect1.right < rect2.left ||
              rect1.left > rect2.right ||
              rect1.bottom < rect2.top ||
              rect1.top > rect2.bottom
            );
            
            if (overlap) {
              const getSelector = (el: Element) => {
                if (el.id) return `#${el.id}`;
                if (el.className) return `.${el.className.split(' ')[0]}`;
                return el.tagName.toLowerCase();
              };
              
              overlaps.push({
                element1: getSelector(elements[i]),
                element2: getSelector(elements[j])
              });
            }
          }
        }
      }
      
      return overlaps.slice(0, 3); // Limit to first 3
    });

    if (overlappingElements.length > 0) {
      issues.push({
        type: 'layout',
        severity: 'medium',
        message: `Potential overlapping elements detected`,
        suggestion: 'Check z-index values and positioning',
        element: overlappingElements.map(o => `${o.element1} overlaps ${o.element2}`).join(', ')
      });
    }

    return issues;
  }

  /**
   * Detect CSS issues (missing styles, broken layouts)
   */
  private async detectCSSIssues(page: Page): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = [];

    // Check for unstyled elements (no CSS applied)
    const unstyledElements = await page.evaluate(() => {
      const unstyled: string[] = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const hasStyles = 
          styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          styles.color !== 'rgb(0, 0, 0)' ||
          styles.padding !== '0px' ||
          styles.margin !== '0px' ||
          styles.borderWidth !== '0px';
        
        // Check if it's a visible element that should have styles
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase());
        
        if (isVisible && isInteractive && !hasStyles) {
          if (el.id) unstyled.push(`#${el.id}`);
          else if (el.className) unstyled.push(`.${el.className.split(' ')[0]}`);
          else unstyled.push(el.tagName.toLowerCase());
        }
      });
      
      return [...new Set(unstyled)].slice(0, 5);
    });

    if (unstyledElements.length > 0) {
      issues.push({
        type: 'css',
        severity: 'medium',
        message: `${unstyledElements.length} interactive element(s) appear unstyled`,
        suggestion: 'Add CSS styles for better visual appearance',
        element: unstyledElements.join(', ')
      });
    }

    // Check for missing images
    const brokenImages = await page.evaluate(() => {
      const broken: string[] = [];
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        if (!img.complete || img.naturalWidth === 0) {
          broken.push(img.src || img.alt || 'image');
        }
      });
      
      return broken;
    });

    if (brokenImages.length > 0) {
      issues.push({
        type: 'visual',
        severity: 'high',
        message: `${brokenImages.length} image(s) failed to load`,
        suggestion: 'Check image paths and ensure files exist',
        element: brokenImages.join(', ')
      });
    }

    // Check for very small text (accessibility)
    const smallText = await page.evaluate(() => {
      const small: Array<{ element: string; fontSize: string }> = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const fontSize = parseFloat(styles.fontSize);
        const rect = el.getBoundingClientRect();
        const hasText = el.textContent && el.textContent.trim().length > 0;
        
        if (hasText && rect.height > 0 && fontSize < 12) {
          const selector = el.id ? `#${el.id}` : 
                          el.className ? `.${el.className.split(' ')[0]}` : 
                          el.tagName.toLowerCase();
          small.push({ element: selector, fontSize: `${fontSize}px` });
        }
      });
      
      return small.slice(0, 3);
    });

    if (smallText.length > 0) {
      issues.push({
        type: 'accessibility',
        severity: 'medium',
        message: `${smallText.length} element(s) have very small text (< 12px)`,
        suggestion: 'Increase font size for better readability (minimum 14px recommended)',
        element: smallText.map(s => `${s.element} (${s.fontSize})`).join(', ')
      });
    }

    return issues;
  }

  /**
   * Detect responsive design issues
   */
  private async detectResponsiveIssues(
    page: Page,
    viewport: { width: number; height: number; name?: string }
  ): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = [];

    // Check for horizontal scroll at this viewport
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      issues.push({
        type: 'responsive',
        severity: 'high',
        message: `Horizontal scroll detected at ${viewport.name || `${viewport.width}x${viewport.height}`} viewport`,
        suggestion: 'Fix responsive breakpoints or use CSS Grid/Flexbox for better layout'
      });
    }

    // Check for elements that are too small on mobile
    if (viewport.width < 768) {
      const smallTouchTargets = await page.evaluate(() => {
        const small: string[] = [];
        const interactive = document.querySelectorAll('button, a, input, [onclick]');
        
        interactive.forEach(el => {
          const rect = el.getBoundingClientRect();
          // Touch targets should be at least 44x44px
          if (rect.width < 44 || rect.height < 44) {
            if (el.id) small.push(`#${el.id}`);
            else if (el.className) small.push(`.${el.className.split(' ')[0]}`);
            else small.push(el.tagName.toLowerCase());
          }
        });
        
        return [...new Set(small)].slice(0, 5);
      });

      if (smallTouchTargets.length > 0) {
        issues.push({
          type: 'responsive',
          severity: 'medium',
          message: `${smallTouchTargets.length} interactive element(s) are too small for mobile (should be at least 44x44px)`,
          suggestion: 'Increase padding or size for better mobile usability',
          element: smallTouchTargets.join(', ')
        });
      }
    }

    return issues;
  }

  /**
   * Check accessibility using Playwright's built-in accessibility tree
   */
  private async checkAccessibility(page: Page): Promise<{
    score: number;
    violations: AccessibilityViolation[];
  }> {
    try {
      // Basic checks
      const violations: AccessibilityViolation[] = [];

      // Check for images without alt text
      const imagesWithoutAlt = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        const missing: string[] = [];
        
        images.forEach(img => {
          if (!img.alt && !img.getAttribute('aria-label')) {
            missing.push(img.src || 'image');
          }
        });
        
        return missing;
      });

      if (imagesWithoutAlt.length > 0) {
        violations.push({
          id: 'image-alt-missing',
          impact: 'serious',
          description: `${imagesWithoutAlt.length} image(s) missing alt text`,
          nodes: imagesWithoutAlt.map(src => ({
            html: `<img src="${src}">`,
            target: ['img']
          }))
        });
      }

      // Check for buttons/links without accessible names
      const elementsWithoutName = await page.evaluate(() => {
        const elements: string[] = [];
        const interactive = document.querySelectorAll('button, a, [role="button"]');
        
        interactive.forEach(el => {
          const hasName = 
            el.textContent?.trim() ||
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            (el.tagName === 'A' && el.getAttribute('title'));
          
          if (!hasName) {
            if (el.id) elements.push(`#${el.id}`);
            else if (el.className) elements.push(`.${el.className.split(' ')[0]}`);
            else elements.push(el.tagName.toLowerCase());
          }
        });
        
        return [...new Set(elements)];
      });

      if (elementsWithoutName.length > 0) {
        violations.push({
          id: 'interactive-no-name',
          impact: 'serious',
          description: `${elementsWithoutName.length} interactive element(s) missing accessible name`,
          nodes: elementsWithoutName.map(selector => ({
            html: `<${selector}>`,
            target: [selector]
          }))
        });
      }

      // Calculate score (100 - (violations * 10))
      const score = Math.max(0, 100 - (violations.length * 10));

      return { score, violations };
    } catch (error) {
      this.logger.warn('Accessibility check failed', error as Error);
      return { score: 0, violations: [] };
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(page: Page): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
  }> {
    try {
      const metrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintData = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart || 0,
          firstContentfulPaint: paintData.find((entry: any) => entry.name === 'first-contentful-paint')?.startTime,
          largestContentfulPaint: (performance.getEntriesByType('largest-contentful-paint') as any[])[0]?.renderTime || 
                                   (performance.getEntriesByType('largest-contentful-paint') as any[])[0]?.loadTime
        };
      });

      return {
        loadTime: metrics.domContentLoaded,
        domContentLoaded: metrics.domContentLoaded,
        firstContentfulPaint: metrics.firstContentfulPaint,
        largestContentfulPaint: metrics.largestContentfulPaint
      };
    } catch (error) {
      this.logger.warn('Failed to get performance metrics', error as Error);
      return {
        loadTime: 0,
        domContentLoaded: 0
      };
    }
  }

  /**
   * Analyze screenshot with AI for design/UX insights
   * Enhances hardcoded analysis with AI understanding
   */
  private async analyzeWithAI(
    screenshotBase64: string,
    detectedIssues: VisualIssue[],
    url: string
  ): Promise<{
    designQuality: number;
    uxIssues: string[];
    recommendations: string[];
    overallAssessment: string;
  }> {
    const systemPrompt = `You are an expert UI/UX designer and frontend developer. Analyze this web page screenshot and provide:

1. Design Quality Score (0-100): Overall visual design quality
2. UX Issues: List of user experience problems not caught by automated checks
3. Recommendations: Specific, actionable design improvements
4. Overall Assessment: Brief summary of the page's design strengths and weaknesses

Consider:
- Visual hierarchy and information architecture
- Color contrast and readability
- Spacing and layout balance
- User flow and navigation clarity
- Modern design patterns and best practices
- Accessibility from a visual perspective
- Mobile-first design principles

Respond in JSON format:
{
  "designQuality": 75,
  "uxIssues": ["Issue 1", "Issue 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "overallAssessment": "Brief assessment..."
}`;

    // Prepare context about detected issues
    const issuesSummary = detectedIssues.length > 0
      ? `Automated checks found ${detectedIssues.length} issues: ${detectedIssues.slice(0, 3).map(i => i.message).join(', ')}`
      : 'No critical issues detected by automated checks';

    try {
      // Note: Anthropic's Claude supports vision, but we need to use the vision API
      // For now, we'll use text-based analysis with issue context
      // In the future, we can upgrade to vision API for direct screenshot analysis
      
      const response = await this.multiModelAI.generate({
        prompt: `Analyze this web page design. URL: ${url}\n\n${issuesSummary}\n\nProvide design quality assessment and UX recommendations.`,
        systemPrompt,
        maxTokens: 800,
        temperature: 0.4,
        useCase: 'code_review',
        priority: 'quality'
      });

      return this.parseAIVisualAnalysis(response.content);
    } catch (error) {
      this.logger.error('AI visual analysis failed', error as Error);
      throw error;
    }
  }

  /**
   * Parse AI response for visual analysis
   */
  private parseAIVisualAnalysis(aiContent: string): {
    designQuality: number;
    uxIssues: string[];
    recommendations: string[];
    overallAssessment: string;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          designQuality: typeof parsed.designQuality === 'number' 
            ? Math.max(0, Math.min(100, parsed.designQuality))
            : 70, // Default score
          uxIssues: Array.isArray(parsed.uxIssues) ? parsed.uxIssues : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          overallAssessment: typeof parsed.overallAssessment === 'string' 
            ? parsed.overallAssessment 
            : 'Design analysis completed'
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse AI visual analysis response', error as Error);
    }

    // Fallback if parsing fails
    return {
      designQuality: 70,
      uxIssues: [],
      recommendations: ['Consider reviewing the design with a UX expert'],
      overallAssessment: 'AI analysis unavailable, using automated checks only'
    };
  }

  /**
   * Cleanup browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Browser closed');
    }
  }
}
