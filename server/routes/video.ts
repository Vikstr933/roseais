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
    const venvPython = process.platform === 'win32'
      ? path.join(process.cwd(), 'venv-whisper', 'Scripts', 'python.exe')
      : path.join(process.cwd(), 'venv-whisper', 'bin', 'python3');
    
    let ytdlpCommand = 'yt-dlp';
    let pythonCommand: string | null = null;
    
    // Check if venv Python exists and has yt-dlp
    try {
      await fs.access(venvPython);
      // Try to use venv Python with yt-dlp module
      pythonCommand = venvPython;
      logger.info(`[VideoTranscription] Using venv Python: ${venvPython}`);
    } catch {
      logger.debug(`[VideoTranscription] Venv Python not found, using system yt-dlp`);
    }
    
    try {
      // Try yt-dlp first (recommended)
      logger.info(`[VideoTranscription] Attempting to download audio with yt-dlp...`);
      
      if (pythonCommand) {
        // Use Python module directly if venv is available
        await execAsync(`"${pythonCommand}" -m yt_dlp -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`);
      } else {
        // Try system yt-dlp command
        await execAsync(`yt-dlp -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`);
      }
      logger.info(`[VideoTranscription] Audio downloaded successfully with yt-dlp`);
    } catch (ytdlpError) {
      logger.warn(`[VideoTranscription] yt-dlp failed, trying youtube-dl...`);
      try {
        // Fallback to youtube-dl
        await execAsync(`youtube-dl -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`);
        logger.info(`[VideoTranscription] Audio downloaded successfully with youtube-dl`);
      } catch (youtubeDlError) {
        // If both fail, try installing yt-dlp in venv at runtime
        logger.warn(`[VideoTranscription] Both yt-dlp and youtube-dl failed, attempting runtime installation...`);
        try {
          if (pythonCommand) {
            await execAsync(`"${pythonCommand}" -m pip install yt-dlp --quiet`);
            await execAsync(`"${pythonCommand}" -m yt_dlp -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`);
            logger.info(`[VideoTranscription] Audio downloaded successfully after runtime installation`);
          } else {
            throw new Error('yt-dlp not available and cannot install at runtime');
          }
        } catch (installError) {
          logger.error(`[VideoTranscription] Runtime installation also failed`);
          throw new Error('Failed to download audio. Please install yt-dlp: pip install yt-dlp (or youtube-dl: pip install youtube-dl)');
        }
      }
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
      const infoOutput = await execAsync(`yt-dlp --get-title --get-duration "${videoUrl}" 2>/dev/null || youtube-dl --get-title --get-duration "${videoUrl}" 2>/dev/null || echo ""`);
      const lines = infoOutput.stdout.trim().split('\n');
      if (lines.length >= 1) videoTitle = lines[0];
      if (lines.length >= 2) {
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

