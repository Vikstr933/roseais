/**
 * Browser Plugin
 * 
 * Provides tools for visual analysis of web applications:
 * - analyze_page: Analyze a web page for CSS/design issues
 * - check_responsive: Test responsive design at different viewports
 * - check_accessibility: Audit accessibility compliance
 * - take_screenshot: Capture page screenshots
 */

import { BaseProductivityPlugin, PluginMetadata, PluginCredentials, Tool, SyncResult } from './BaseProductivityPlugin';
import { BrowserAgent, VisualAnalysisResult } from '../services/BrowserAgent';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('BrowserPlugin');

export class BrowserPlugin extends BaseProductivityPlugin {
  private browserAgent: BrowserAgent;

  constructor() {
    const metadata: PluginMetadata = {
      id: 'browser-agent',
      name: 'Browser Agent',
      description: 'Visual analysis and design quality assurance for web applications',
      version: '1.0.0',
      author: 'system',
      category: 'custom',
      requiresAuth: false,
      capabilities: ['visual_analysis', 'css_detection', 'responsive_testing', 'accessibility_audit']
    };
    super(metadata);
    this.browserAgent = new BrowserAgent();
  }

  getTools(): Tool[] {
    return [
      {
        name: 'analyze_page',
        description: 'Analyze a web page for visual, CSS, layout, and design issues. Detects problems like overflow, missing styles, broken layouts, accessibility issues, and responsive design problems.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the web page to analyze (e.g., https://example.webcontainer.app or http://localhost:5173)'
            },
            viewports: {
              type: 'array',
              description: 'Optional: Array of viewport sizes to test. Default: desktop (1920x1080), tablet (768x1024), mobile (375x667)'
            },
            checkAccessibility: {
              type: 'boolean',
              description: 'Whether to check accessibility (default: true)'
            }
          },
          required: ['url']
        },
        execute: async (params: any) => {
          return await this.analyzePage(params.url, {
            viewports: params.viewports,
            checkAccessibility: params.checkAccessibility !== false,
            takeScreenshot: true
          });
        }
      },
      {
        name: 'check_responsive',
        description: 'Test responsive design at multiple viewport sizes. Identifies layout breaks, overflow issues, and touch target problems.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to test'
            },
            viewports: {
              type: 'array',
              description: 'Viewport sizes to test'
            }
          },
          required: ['url']
        },
        execute: async (params: any) => {
          return await this.checkResponsive(params.url, params.viewports);
        }
      },
      {
        name: 'take_screenshot',
        description: 'Capture a screenshot of a web page at a specific viewport size. Useful for visual documentation or comparison.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to screenshot'
            },
            viewport: {
              type: 'object',
              description: 'Viewport size (default: 1920x1080)'
            },
            fullPage: {
              type: 'boolean',
              description: 'Whether to capture full page (default: false)'
            }
          },
          required: ['url']
        },
        execute: async (params: any) => {
          return await this.takeScreenshot(
            params.url,
            params.viewport || { width: 1920, height: 1080 },
            params.fullPage || false
          );
        }
      }
    ];
  }

  // Required BaseProductivityPlugin methods
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.status.initialized = true;
    logger.info('Browser plugin initialized', { userId });
  }

  async enable(userId: string, credentials?: PluginCredentials): Promise<void> {
    this.userId = userId;
    this.status.enabled = true;
    this.status.authenticated = true; // No auth needed for browser plugin
    logger.info('Browser plugin enabled', { userId });
  }

  async disable(userId: string): Promise<void> {
    this.status.enabled = false;
    this.status.authenticated = false;
    logger.info('Browser plugin disabled', { userId });
  }

  async sync(userId: string): Promise<SyncResult> {
    // Browser plugin doesn't sync data (it's stateless)
    return {
      success: true,
      itemsSynced: 0,
      lastSyncTime: new Date()
    };
  }

  private async analyzePage(
    url: string,
    options?: {
      viewports?: Array<{ width: number; height: number; name?: string }>;
      checkAccessibility?: boolean;
      takeScreenshot?: boolean;
    }
  ): Promise<any> {
    logger.info(`Analyzing page: ${url}`);
    const result = await this.browserAgent.analyzePage(url, options || {});
    
    // Format result for agent consumption with visual-friendly format
    const formattedResult = {
      url: result.url,
      viewport: result.viewport,
      issuesFound: result.issues.length,
      issues: result.issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        element: issue.element,
        suggestion: issue.suggestion
      })),
      metrics: {
        loadTime: `${result.metrics.loadTime}ms`,
        firstContentfulPaint: result.metrics.firstContentfulPaint ? `${result.metrics.firstContentfulPaint}ms` : 'N/A'
      },
      accessibility: {
        score: result.accessibility.score,
        violations: result.accessibility.violations.length
      },
      summary: this.generateSummary(result),
      screenshot: result.screenshot, // Include screenshot for visual display
      // Add a formatted message for the agent to show users
      formattedMessage: this.formatMessageForUser(result)
    };
    
    return formattedResult;
  }

  private formatMessageForUser(result: VisualAnalysisResult): string {
    const critical = result.issues.filter(i => i.severity === 'critical').length;
    const high = result.issues.filter(i => i.severity === 'high').length;
    const medium = result.issues.filter(i => i.severity === 'medium').length;
    const low = result.issues.filter(i => i.severity === 'low').length;

    if (result.issues.length === 0) {
      return `✅ **Visual Analysis Complete**\n\nNo issues found! Your page looks great. 🎉\n\n**Performance:**\n- Load time: ${result.metrics.loadTime}ms\n- Accessibility score: ${result.accessibility.score}/100`;
    }

    let message = `🔍 **Visual Analysis Results**\n\n`;
    message += `Found **${result.issues.length} issue(s)**: `;
    if (critical > 0) message += `${critical} critical, `;
    if (high > 0) message += `${high} high, `;
    if (medium > 0) message += `${medium} medium, `;
    if (low > 0) message += `${low} low. `;
    message += `\n\n`;

    // Top 3 most critical issues
    const topIssues = result.issues
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 3);

    if (topIssues.length > 0) {
      message += `**Top Issues:**\n`;
      topIssues.forEach((issue, i) => {
        message += `${i + 1}. **[${issue.severity.toUpperCase()}]** ${issue.message}\n`;
        if (issue.suggestion) {
          message += `   💡 ${issue.suggestion}\n`;
        }
      });
      message += `\n`;
    }

    message += `**Performance:**\n`;
    message += `- Load time: ${result.metrics.loadTime}ms\n`;
    if (result.metrics.firstContentfulPaint) {
      message += `- First Contentful Paint: ${result.metrics.firstContentfulPaint}ms\n`;
    }
    message += `- Accessibility score: ${result.accessibility.score}/100\n`;

    message += `\n📸 A screenshot has been captured. Check the detailed results below for all issues and suggestions.`;

    return message;
  }

  private async checkResponsive(
    url: string,
    viewports?: Array<{ width: number; height: number; name?: string }>
  ): Promise<any> {
    const defaultViewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    const viewportsToTest = viewports || defaultViewports;
    const results: any[] = [];

    for (const viewport of viewportsToTest) {
      const result = await this.browserAgent.analyzePage(url, {
        viewports: [viewport],
        checkAccessibility: false,
        takeScreenshot: false
      });

      results.push({
        viewport: viewport.name || `${viewport.width}x${viewport.height}`,
        issues: result.issues.filter(i => i.type === 'responsive' || i.type === 'layout'),
        hasHorizontalScroll: result.issues.some(i => 
          i.message.includes('Horizontal scroll') || i.message.includes('overflow')
        )
      });
    }

    return {
      url,
      viewports: results,
      summary: this.generateResponsiveSummary(results)
    };
  }

  private async takeScreenshot(
    url: string,
    viewport: { width: number; height: number },
    fullPage: boolean
  ): Promise<{ url: string; viewport: { width: number; height: number }; screenshot: string }> {
    const result = await this.browserAgent.analyzePage(url, {
      viewports: [viewport],
      takeScreenshot: true,
      checkAccessibility: false
    });

    return {
      url,
      viewport,
      screenshot: result.screenshot || ''
    };
  }

  private generateSummary(result: VisualAnalysisResult): string {
    const critical = result.issues.filter(i => i.severity === 'critical').length;
    const high = result.issues.filter(i => i.severity === 'high').length;
    const medium = result.issues.filter(i => i.severity === 'medium').length;
    const low = result.issues.filter(i => i.severity === 'low').length;

    let summary = `Found ${result.issues.length} issue(s): `;
    if (critical > 0) summary += `${critical} critical, `;
    if (high > 0) summary += `${high} high, `;
    if (medium > 0) summary += `${medium} medium, `;
    if (low > 0) summary += `${low} low. `;
    
    summary += `Accessibility score: ${result.accessibility.score}/100. `;
    summary += `Load time: ${result.metrics.loadTime}ms.`;

    if (result.issues.length === 0) {
      summary = '✅ No issues found! Page looks good.';
    }

    return summary;
  }

  private generateResponsiveSummary(results: any[]): string {
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const viewportsWithIssues = results.filter(r => r.issues.length > 0).length;

    if (totalIssues === 0) {
      return '✅ All viewports look good! No responsive design issues found.';
    }

    return `Found ${totalIssues} responsive issue(s) across ${viewportsWithIssues} viewport(s). Check individual viewport results for details.`;
  }

  async getKnowledgeItems(
    userId: string,
    prompt: string,
    filters?: Record<string, any>
  ): Promise<any[]> {
    // Browser plugin doesn't store knowledge items
    return [];
  }

  async executeAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    // Route actions to appropriate methods
    switch (action) {
      case 'analyze_page':
        return await this.analyzePage(params.url, params.options);
      case 'check_responsive':
        return await this.checkResponsive(params.url, params.viewports);
      case 'take_screenshot':
        return await this.takeScreenshot(
          params.url,
          params.viewport || { width: 1920, height: 1080 },
          params.fullPage || false
        );
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async validateCredentials(userId: string): Promise<boolean> {
    // Browser plugin doesn't require credentials
    return true;
  }

  async cleanup(): Promise<void> {
    await this.browserAgent.close();
    logger.info('Browser plugin cleaned up');
  }
}

