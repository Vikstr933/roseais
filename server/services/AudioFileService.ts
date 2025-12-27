import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from '../utils/Logger';

const logger = new Logger(process.cwd());

/**
 * Service to manage audio files extracted from YouTube videos
 * Handles file storage, cleanup, and size limits
 */
export class AudioFileService {
  private readonly audioDir: string;
  private readonly maxFileSizeMB: number;
  private readonly maxFileAgeHours: number;

  constructor() {
    // Use temp directory for audio files
    this.audioDir = path.join(process.cwd(), 'temp', 'audio');
    this.maxFileSizeMB = parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB || '500');
    this.maxFileAgeHours = parseInt(process.env.MAX_AUDIO_FILE_AGE_HOURS || '24');
    
    // Ensure audio directory exists
    this.ensureAudioDirectory();
  }

  /**
   * Ensure audio directory exists
   */
  private async ensureAudioDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      logger.error('AudioFileService', 'Failed to create audio directory', error as Error);
    }
  }

  /**
   * Generate a unique file path for an audio file
   * @param videoId - YouTube video ID
   * @param format - Audio format (mp3, wav, etc.)
   */
  getAudioFilePath(videoId: string, format: string = 'mp3'): string {
    const timestamp = Date.now();
    const filename = `${videoId}-${timestamp}.${format}`;
    return path.join(this.audioDir, filename);
  }

  /**
   * Get audio file path by ID
   * @param audioId - Audio file ID (format: videoId-timestamp or upload-timestamp-random)
   * @returns Full path to audio file or null if not found
   */
  async getAudioFileById(audioId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.audioDir);
      
      // Search for file that starts with audioId
      // audioId format can be: videoId-timestamp or upload-timestamp-random
      // File format: audioId.extension
      const matchingFile = files.find(file => {
        const fileWithoutExt = path.parse(file).name;
        return fileWithoutExt === audioId || fileWithoutExt.startsWith(audioId);
      });
      
      if (matchingFile) {
        return path.join(this.audioDir, matchingFile);
      }
      
      // Fallback: try common extensions
      const extensions = ['mp3', 'wav', 'ogg', 'webm', 'm4a'];
      for (const ext of extensions) {
        const testPath = path.join(this.audioDir, `${audioId}.${ext}`);
        if (await this.fileExists(testPath)) {
          return testPath;
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('AudioFileService', `Failed to find audio file by ID: ${audioId}`, error as Error);
      return null;
    }
  }

  /**
   * Check if audio file exists and is readable
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      // Normalize the path to handle both absolute and relative paths
      const normalizedPath = path.isAbsolute(filePath) 
        ? path.normalize(filePath)
        : path.resolve(filePath);
      
      // Check if file exists
      await fs.access(normalizedPath);
      
      // Also verify it's actually a file (not a directory) and has size > 0
      const stats = await fs.stat(normalizedPath);
      if (!stats.isFile() || stats.size === 0) {
        return false;
      }
      
      return true;
    } catch {
      // If access fails, also try the original path (in case normalization changed it incorrectly)
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        if (!stats.isFile() || stats.size === 0) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get file size in MB
   */
  async getFileSizeMB(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size / (1024 * 1024);
    } catch {
      return 0;
    }
  }

  /**
   * Validate file size
   */
  async validateFileSize(filePath: string): Promise<{ valid: boolean; sizeMB: number; error?: string }> {
    const sizeMB = await this.getFileSizeMB(filePath);
    if (sizeMB > this.maxFileSizeMB) {
      return {
        valid: false,
        sizeMB,
        error: `File size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${this.maxFileSizeMB}MB)`
      };
    }
    return { valid: true, sizeMB };
  }

  /**
   * Delete an audio file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('AudioFileService', `Deleted audio file: ${filePath}`);
    } catch (error) {
      logger.warn('AudioFileService', `Failed to delete audio file: ${filePath}`, error as Error);
    }
  }

  /**
   * Clean up old audio files
   */
  async cleanupOldFiles(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      const files = await fs.readdir(this.audioDir);
      const now = Date.now();
      const maxAge = this.maxFileAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            await this.deleteFile(filePath);
            deleted++;
          }
        } catch (error) {
          errors++;
          logger.warn('AudioFileService', `Error checking file age: ${filePath}`, error as Error);
        }
      }

      if (deleted > 0) {
        logger.info('AudioFileService', `Cleaned up ${deleted} old audio files`);
      }
    } catch (error) {
      logger.error('AudioFileService', 'Failed to cleanup old files', error as Error);
    }

    return { deleted, errors };
  }

  /**
   * Start automatic cleanup on interval
   */
  startAutomaticCleanup(): void {
    // Run cleanup immediately
    this.cleanupOldFiles().catch(console.error);

    // Then run every 6 hours
    const intervalMs = 6 * 60 * 60 * 1000;
    setInterval(() => {
      this.cleanupOldFiles().catch(console.error);
    }, intervalMs);

    logger.info('AudioFileService', `Automatic cleanup enabled: Files older than ${this.maxFileAgeHours}h will be deleted every 6h`);
  }

  /**
   * Get audio directory path
   */
  getAudioDirectory(): string {
    return this.audioDir;
  }
}

// Export singleton
export const audioFileService = new AudioFileService();

