/**
 * Browser Analysis Routes
 * 
 * Handles visual analysis requests for generated web applications
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { BrowserAgent } from '../services/BrowserAgent';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('BrowserAPI');
const browserAgent = new BrowserAgent();

/**
 * POST /api/browser/analyze
 * Analyze a web page for visual, CSS, layout, and design issues
 */
router.post('/analyze', authenticateUser, async (req, res) => {
  try {
    const { url, viewports, checkAccessibility } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    logger.info(`Analyzing page: ${url}`);

    const result = await browserAgent.analyzePage(url, {
      viewports: viewports || [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ],
      checkAccessibility: checkAccessibility !== false,
      takeScreenshot: true
    });

    // Format result for frontend consumption
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
      summary: generateSummary(result),
      screenshot: result.screenshot,
      formattedMessage: formatMessageForUser(result)
    };

    res.json({
      success: true,
      analysis: formattedResult
    });
  } catch (error) {
    logger.error('Browser analysis failed', error as Error);
    
    // Check if it's a Playwright browser missing error
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze page';
    const isPlaywrightError = errorMessage.includes('Playwright browsers are not installed') ||
                               errorMessage.includes('Executable doesn\'t exist') ||
                               errorMessage.includes('chromium_headless_shell');
    
    res.status(500).json({
      success: false,
      error: isPlaywrightError 
        ? 'Browser analysis is currently unavailable. Playwright browsers need to be installed in the production environment. This feature will be available after the next deployment.'
        : errorMessage
    });
  }
});

function generateSummary(result: any): string {
  const critical = result.issues.filter((i: any) => i.severity === 'critical').length;
  const high = result.issues.filter((i: any) => i.severity === 'high').length;
  const medium = result.issues.filter((i: any) => i.severity === 'medium').length;
  const low = result.issues.filter((i: any) => i.severity === 'low').length;

  if (result.issues.length === 0) {
    return '✅ No issues found! Page looks great.';
  }

  let summary = `Found ${result.issues.length} issue(s): `;
  if (critical > 0) summary += `${critical} critical, `;
  if (high > 0) summary += `${high} high, `;
  if (medium > 0) summary += `${medium} medium, `;
  if (low > 0) summary += `${low} low. `;
  
  summary += `Accessibility score: ${result.accessibility.score}/100. `;
  summary += `Load time: ${result.metrics.loadTime}ms.`;

  return summary;
}

function formatMessageForUser(result: any): string {
  const critical = result.issues.filter((i: any) => i.severity === 'critical').length;
  const high = result.issues.filter((i: any) => i.severity === 'high').length;
  const medium = result.issues.filter((i: any) => i.severity === 'medium').length;
  const low = result.issues.filter((i: any) => i.severity === 'low').length;

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
    .sort((a: any, b: any) => {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 3);

  if (topIssues.length > 0) {
    message += `**Top Issues:**\n`;
    topIssues.forEach((issue: any, i: number) => {
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

export default router;

