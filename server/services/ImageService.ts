import { SimpleLogger } from '../utils/SimpleLogger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../../db';
import { projectFiles } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

// Type declaration for sharp (optional dependency)
type SharpModule = typeof import('sharp');

const logger = new SimpleLogger('ImageService');

export interface ImageProcessResult {
  success: boolean;
  message: string;
  outputPath?: string;
  originalSize?: number;
  newSize?: number;
  width?: number;
  height?: number;
  extractedText?: string;
}

export class ImageService {
  /**
   * Process an image (resize, crop, optimize, or extract text)
   */
  async processImage(
    projectId: number,
    imagePath: string,
    operation: 'resize' | 'crop' | 'optimize' | 'extract-text',
    options?: {
      width?: number;
      height?: number;
      quality?: number;
    }
  ): Promise<ImageProcessResult> {
    try {
      // Get project files to find the image
      const files = await db
        .select()
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.isActive, true),
            eq(projectFiles.filePath, imagePath)
          )
        )
        .limit(1);

      if (files.length === 0) {
        return {
          success: false,
          message: `Image file "${imagePath}" not found in project`
        };
      }

      const file = files[0];
      if (!file.fileContent) {
        return {
          success: false,
          message: 'Image file is empty'
        };
      }

      // Convert base64 to buffer if needed, or use file content directly
      let imageBuffer: Buffer;
      if (file.fileContent.startsWith('data:')) {
        // Base64 data URL
        const base64Data = file.fileContent.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Assume it's already binary or base64
        imageBuffer = Buffer.from(file.fileContent, 'base64');
      }

      const originalSize = imageBuffer.length;
      let processedBuffer: Buffer;
      let newWidth: number | undefined;
      let newHeight: number | undefined;

      // Process image based on operation
      // Note: Image processing requires 'sharp' package to be installed
      let sharpModule: SharpModule;
      try {
        sharpModule = await import('sharp');
      } catch {
        return {
          success: false,
          message: 'Image processing requires the "sharp" package to be installed. Please install it with: npm install sharp'
        };
      }
      
      const sharp = sharpModule.default || sharpModule;

      switch (operation) {
        case 'resize':
          if (!options?.width && !options?.height) {
            return {
              success: false,
              message: 'Width or height required for resize operation'
            };
          }
          processedBuffer = await sharp(imageBuffer)
            .resize(options.width, options.height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();
          const metadata = await sharp(processedBuffer).metadata();
          newWidth = metadata.width;
          newHeight = metadata.height;
          break;

        case 'crop':
          if (!options?.width || !options?.height) {
            return {
              success: false,
              message: 'Width and height required for crop operation'
            };
          }
          processedBuffer = await sharp(imageBuffer)
            .resize(options.width, options.height, {
              fit: 'cover'
            })
            .toBuffer();
          newWidth = options.width;
          newHeight = options.height;
          break;

        case 'optimize':
          processedBuffer = await sharp(imageBuffer)
            .jpeg({ quality: options?.quality || 80 })
            .png({ quality: options?.quality || 80 })
            .webp({ quality: options?.quality || 80 })
            .toBuffer();
          break;

        case 'extract-text':
          // OCR would require additional library like Tesseract.js
          // For now, return a placeholder
          return {
            success: false,
            message: 'Text extraction (OCR) is not yet implemented. This feature requires additional libraries.',
            extractedText: undefined
          };

        default:
          return {
            success: false,
            message: `Unknown operation: ${operation}`
          };
      }

      // Convert processed buffer back to base64
      const processedBase64 = processedBuffer.toString('base64');
      const newSize = processedBuffer.length;

      // Update file in database
      await db
        .update(projectFiles)
        .set({
          fileContent: `data:image/${path.extname(imagePath).slice(1)};base64,${processedBase64}`,
          updatedAt: new Date()
        })
        .where(eq(projectFiles.id, file.id));

      return {
        success: true,
        message: `Image ${operation} completed successfully`,
        outputPath: imagePath,
        originalSize,
        newSize,
        width: newWidth,
        height: newHeight
      };
    } catch (error) {
      logger.error('Error processing image', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const imageService = new ImageService();

