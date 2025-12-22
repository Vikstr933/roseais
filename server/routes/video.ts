/**
 * Video Transcription API Routes
 * Endpoints for transcribing YouTube videos and converting to voice actor scripts
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { whisperService } from '../services/WhisperService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();
const logger = new SimpleLogger('VideoTranscriptionAPI');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Log router initialization
logger.info('[VideoRouter] Video transcription router initialized');

/**
 * Extract audio from YouTube video and transcribe it using Whisper
 * 
 * Uses yt-dlp (or youtube-dl if available) to download audio, then Whisper for transcription
 */
export async function transcribeYouTubeVideo(videoId: string): Promise<{ transcription: string; videoTitle?: string; videoDuration?: number }> {
  const tempDir = path.join(process.cwd(), 'temp', `video-${videoId}-${Date.now()}`);
  let audioPath: string | null = null;
  
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    logger.info(`[VideoTranscription] Processing video: ${videoId}`);

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Try to get video info and download audio using yt-dlp (more reliable than ytdl-core)
    // yt-dlp is a fork of youtube-dl with better support
    audioPath = path.join(tempDir, 'audio.wav');
    
    // Check if we have venv-whisper with yt-dlp installed
    // Try multiple possible paths (Docker /app, Render /opt/render/project/src, etc.)
    const cwd = process.cwd();
    const possibleVenvPaths = [
      path.join(cwd, 'venv-whisper'),
      path.join('/app', 'venv-whisper'), // Docker default
      path.join('/opt/render/project/src', 'venv-whisper'), // Render Node.js env
    ].filter((p, index, arr) => arr.indexOf(p) === index); // Remove duplicates
    
    let pythonCommand: string | null = null;
    let foundVenvPath: string | null = null;
    
    // Try each possible venv path
    for (const venvPath of possibleVenvPaths) {
      const venvPython = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python3');
      
      logger.info(`[VideoTranscription] Checking venv at: ${venvPython}`);
      
      try {
        // Use stat instead of access for better reliability
        const stats = await fs.stat(venvPython);
        if (stats.isFile()) {
          logger.info(`[VideoTranscription] ✅ Venv Python found at: ${venvPython}`);
          
          // Verify that yt-dlp is actually installed in the venv
          try {
            const checkYtdlp = await execAsync(`"${venvPython}" -c "import yt_dlp; print('OK')"`, {
              timeout: 5000
            });
            if (checkYtdlp.stdout.includes('OK')) {
              pythonCommand = venvPython;
              foundVenvPath = venvPath;
              logger.info(`[VideoTranscription] ✅ yt-dlp verified in venv, using: ${venvPython}`);
              break; // Found working venv, stop searching
            } else {
              logger.warn(`[VideoTranscription] Venv Python found but yt-dlp not installed at ${venvPython}`);
            }
          } catch (importError: any) {
            logger.warn(`[VideoTranscription] Venv Python found but yt-dlp import failed: ${importError instanceof Error ? importError.message : String(importError)}`);
            if (importError.stderr) {
              logger.debug(`[VideoTranscription] Import error stderr: ${importError.stderr.substring(0, 200)}`);
            }
          }
        }
      } catch (statError) {
        // Venv doesn't exist at this path, try next
        logger.debug(`[VideoTranscription] Venv not found at ${venvPython}, trying next path...`);
        continue;
      }
    }
    
    if (!pythonCommand) {
      logger.warn(`[VideoTranscription] ❌ No working venv with yt-dlp found. Tried paths: ${possibleVenvPaths.join(', ')}`);
      logger.warn(`[VideoTranscription] Current working directory: ${process.cwd()}`);
    }
    
    try {
      // Try yt-dlp first (recommended)
      logger.info(`[VideoTranscription] Attempting to download audio with yt-dlp...`);
      logger.info(`[VideoTranscription] Video URL: ${videoUrl}`);
      logger.info(`[VideoTranscription] Audio output path: ${audioPath}`);
      
      if (pythonCommand) {
        // Use Python module directly if venv is available
        const command = `"${pythonCommand}" -m yt_dlp -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`;
        logger.info(`[VideoTranscription] Executing: ${command}`);
        logger.info(`[VideoTranscription] Using venv from: ${foundVenvPath}`);
        const result = await execAsync(command, { 
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
          timeout: 300000, // 5 minute timeout
          cwd: foundVenvPath ? path.dirname(foundVenvPath) : undefined
        });
        logger.info(`[VideoTranscription] yt-dlp stdout: ${result.stdout.substring(0, 500)}`);
        if (result.stderr) {
          logger.debug(`[VideoTranscription] yt-dlp stderr: ${result.stderr.substring(0, 500)}`);
        }
      } else {
        // System yt-dlp should NOT be used in production - it should be in venv
        // This is a fallback that will fail, but gives a clear error message
        logger.error(`[VideoTranscription] ❌ Cannot use system yt-dlp - venv not found!`);
        logger.error(`[VideoTranscription] Searched paths: ${possibleVenvPaths.join(', ')}`);
        logger.error(`[VideoTranscription] Current working directory: ${process.cwd()}`);
        throw new Error('yt-dlp is not available. venv-whisper with yt-dlp should be installed during Docker build. Please check build logs and ensure yt-dlp is installed in venv-whisper.');
      }
      logger.info(`[VideoTranscription] ✅ Audio downloaded successfully with yt-dlp`);
    } catch (ytdlpError: any) {
      const errorMessage = ytdlpError instanceof Error ? ytdlpError.message : String(ytdlpError);
      const errorStdout = ytdlpError?.stdout || '';
      const errorStderr = ytdlpError?.stderr || '';
      
      logger.error(`[VideoTranscription] ❌ yt-dlp failed: ${errorMessage}`);
      if (errorStdout) {
        logger.error(`[VideoTranscription] yt-dlp stdout: ${errorStdout.substring(0, 1000)}`);
      }
      if (errorStderr) {
        logger.error(`[VideoTranscription] yt-dlp stderr: ${errorStderr.substring(0, 1000)}`);
      }
      
      // In production, yt-dlp should be installed during build
      // If it's not available, this is a configuration error
      const errorDetails = [
        `Error: ${errorMessage}`,
        `Searched venv paths: ${possibleVenvPaths.join(', ')}`,
        `Current working directory: ${process.cwd()}`,
        `Python command used: ${pythonCommand || 'none (system yt-dlp attempted)'}`,
      ];
      if (errorStdout) errorDetails.push(`stdout: ${errorStdout.substring(0, 500)}`);
      if (errorStderr) errorDetails.push(`stderr: ${errorStderr.substring(0, 500)}`);
      
      throw new Error(`yt-dlp is not available or failed to download audio. This should be installed during Docker build. ${errorDetails.join(' | ')}`);
    }

    // Check if audio file exists
    try {
      await fs.access(audioPath);
    } catch {
      throw new Error('Audio file was not created after download');
    }

    // Get video info (title, duration) if possible
    let videoTitle: string | undefined;
    let videoDuration: number | undefined;
    
    try {
      let infoCommand: string;
      if (pythonCommand) {
        infoCommand = `"${pythonCommand}" -m yt_dlp --get-title --get-duration "${videoUrl}" 2>/dev/null`;
      } else {
        infoCommand = `yt-dlp --get-title --get-duration "${videoUrl}" 2>/dev/null || youtube-dl --get-title --get-duration "${videoUrl}" 2>/dev/null || echo ""`;
      }
      
      const infoOutput = await execAsync(infoCommand);
      const lines = infoOutput.stdout.trim().split('\n');
      if (lines.length >= 1 && lines[0]) videoTitle = lines[0];
      if (lines.length >= 2 && lines[1]) {
        // Parse duration (format: HH:MM:SS or MM:SS)
        const durationStr = lines[1];
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 3) {
          videoDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          videoDuration = parts[0] * 60 + parts[1];
        }
      }
    } catch {
      // Info extraction failed, continue without it
      logger.warn(`[VideoTranscription] Could not extract video info`);
    }

    // Transcribe using Whisper
    logger.info(`[VideoTranscription] Starting Whisper transcription...`);
    const transcriptionResult = await whisperService.transcribe(audioPath, {
      language: 'auto', // Auto-detect language
      task: 'transcribe',
      returnTimestamps: false
    });

    const transcription = transcriptionResult.text || 'No transcription available';

    logger.info(`[VideoTranscription] Transcription complete, length: ${transcription.length} characters`);

    return {
      transcription,
      videoTitle: videoTitle || `Video ${videoId}`,
      videoDuration,
    };
  } catch (error) {
    logger.error(`[VideoTranscription] Error transcribing video: ${error}`);
    throw error;
  } finally {
    // Cleanup temp files
    try {
      if (audioPath) {
        await fs.unlink(audioPath).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
    } catch (cleanupError) {
      logger.warn(`[VideoTranscription] Failed to cleanup temp directory: ${cleanupError}`);
    }
  }
}

/**
 * Convert transcription to voice actor script
 */
export async function convertToScript(transcription: string, videoTitle?: string): Promise<string> {
  try {
    const prompt = `You are a professional script writer for voice actors. Convert the following video transcription into a well-structured voice actor script.

The script should be:
- Clear and easy to read for voice actors
- Include natural pauses and breathing points
- Format dialogue clearly
- Include any important context or tone indicators
- Be professional and ready for voiceover production

${videoTitle ? `Video Title: ${videoTitle}\n\n` : ''}Transcription:
${transcription}

Please format the script in a way that's easy for voice actors to read and perform. Include:
1. Clear scene/section markers if needed
2. Natural pauses marked with [PAUSE]
3. Emphasis markers where appropriate
4. Any tone or emotion indicators

Script:`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const script = message.content[0].type === 'text' ? message.content[0].text : '';
    return script || transcription; // Fallback to transcription if script generation fails
  } catch (error) {
    logger.error(`[VideoTranscription] Error converting to script: ${error}`);
    // Return transcription as fallback
    return transcription;
  }
}

/**
 * POST /api/video/transcribe
 * Transcribe YouTube video and convert to voice actor script
 */
router.post('/transcribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { youtubeUrl, videoId } = req.body;

    if (!youtubeUrl && !videoId) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL or video ID is required',
      });
    }

    const finalVideoId = videoId || (youtubeUrl ? youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] : null);

    if (!finalVideoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL or video ID',
      });
    }

    logger.info(`[VideoTranscription] Starting transcription for video: ${finalVideoId}`);

    // Transcribe video
    const { transcription, videoTitle, videoDuration } = await transcribeYouTubeVideo(finalVideoId);

    // Convert to script
    logger.info(`[VideoTranscription] Converting transcription to script...`);
    const script = await convertToScript(transcription, videoTitle);

    logger.info(`[VideoTranscription] Transcription and script generation complete`);

    res.json({
      success: true,
      transcription,
      script,
      videoTitle,
      videoDuration,
    });
  } catch (error: any) {
    logger.error(`[VideoTranscription] Error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe video',
    });
  }
});

export default router;

