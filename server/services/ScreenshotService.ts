/**
 * Screenshot Service
 * 
 * Captures screenshots of deployed projects using BrowserAgent
 * Stores screenshots for public projects showcase
 */

import { BrowserAgent } from './BrowserAgent';
import { db } from '../../db';
import { workspaces } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';
import * as fs from 'fs';
import * as path from 'path';

const logger = new SimpleLogger('ScreenshotService');

export class ScreenshotService {
  private browserAgent: BrowserAgent;
  private screenshotsDir: string;

  constructor() {
    this.browserAgent = new BrowserAgent();
    // Create screenshots directory if it doesn't exist
    this.screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Capture screenshot for a project
   * @param projectId - The project ID
   * @param url - The URL to capture (vercelUrl or previewUrl)
   * @param force - Force recapture even if screenshot exists
   */
  async captureScreenshot(
    projectId: number,
    url: string,
    options: { force?: boolean; thumbnail?: boolean } = {}
  ): Promise<{ screenshotUrl?: string; thumbnailUrl?: string }> {
    try {
      logger.info(`Capturing screenshot for project ${projectId} from ${url}`);

      // Check if screenshot already exists
      const project = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, projectId))
        .limit(1);

      if (!project[0]) {
        throw new Error(`Project ${projectId} not found`);
      }

      if (!options.force && project[0].screenshotUrl) {
        logger.info(`Screenshot already exists for project ${projectId}`);
        return {
          screenshotUrl: project[0].screenshotUrl,
          thumbnailUrl: project[0].thumbnailUrl || undefined,
        };
      }

      // Analyze page and get screenshot
      const analysis = await this.browserAgent.analyzePage(url, {
        viewports: [
          { width: 1920, height: 1080, name: 'desktop' },
          { width: 375, height: 667, name: 'mobile' },
        ],
        takeScreenshot: true,
        checkAccessibility: false,
        checkPerformance: false,
      });

      if (!analysis.screenshot) {
        throw new Error('Failed to capture screenshot');
      }

      // Save full screenshot
      const screenshotBuffer = Buffer.from(analysis.screenshot, 'base64');
      const screenshotFilename = `project-${projectId}-${Date.now()}.png`;
      const screenshotPath = path.join(this.screenshotsDir, screenshotFilename);
      fs.writeFileSync(screenshotPath, screenshotBuffer);

      // Generate thumbnail (resize to 400x300)
      let thumbnailUrl: string | undefined;
      if (options.thumbnail !== false) {
        try {
          // For now, we'll use the same image as thumbnail
          // In production, you'd want to use sharp or similar to resize
          const thumbnailFilename = `project-${projectId}-thumb-${Date.now()}.png`;
          const thumbnailPath = path.join(this.screenshotsDir, thumbnailFilename);
          
          // Copy screenshot as thumbnail (in production, resize it)
          fs.writeFileSync(thumbnailPath, screenshotBuffer);
          
          thumbnailUrl = `/uploads/screenshots/${thumbnailFilename}`;
        } catch (error) {
          logger.warn('Failed to generate thumbnail', error as Error);
        }
      }

      const screenshotUrl = `/uploads/screenshots/${screenshotFilename}`;

      // Update project with screenshot URLs
      await db
        .update(workspaces)
        .set({
          screenshotUrl,
          thumbnailUrl: thumbnailUrl || null,
        })
        .where(eq(workspaces.id, projectId));

      logger.info(`✅ Screenshot captured and saved for project ${projectId}`);

      return {
        screenshotUrl,
        thumbnailUrl,
      };
    } catch (error) {
      logger.error(`Failed to capture screenshot for project ${projectId}`, error as Error);
      throw error;
    }
  }

  /**
   * Capture screenshot for a project using its vercelUrl or previewUrl
   */
  async captureProjectScreenshot(
    projectId: number,
    force: boolean = false
  ): Promise<{ screenshotUrl?: string; thumbnailUrl?: string }> {
    try {
      const project = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, projectId))
        .limit(1);

      if (!project[0]) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Try vercelUrl first, then previewUrl
      const url = project[0].vercelUrl || project[0].githubUrl;
      
      if (!url) {
        logger.warn(`No deployment URL found for project ${projectId}`);
        return {};
      }

      return await this.captureScreenshot(projectId, url, { force, thumbnail: true });
    } catch (error) {
      logger.error(`Failed to capture project screenshot`, error as Error);
      throw error;
    }
  }

  /**
   * Cleanup old screenshots (optional maintenance function)
   */
  async cleanupOldScreenshots(daysOld: number = 30): Promise<number> {
    try {
      const files = fs.readdirSync(this.screenshotsDir);
      const now = Date.now();
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(this.screenshotsDir, file);
        const stats = fs.statSync(filePath);
        const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageInDays > daysOld) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      logger.info(`Cleaned up ${deleted} old screenshots`);
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup old screenshots', error as Error);
      return 0;
    }
  }

  /**
   * Cleanup browser agent
   */
  async close(): Promise<void> {
    await this.browserAgent.close();
  }
}

export const screenshotService = new ScreenshotService();

