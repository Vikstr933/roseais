/**
 * KB-Whisper API Routes
 * Endpoints for Swedish speech recognition using KB-Whisper Base
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { whisperService } from '../services/WhisperService';
import { SimpleLogger } from '../utils/SimpleLogger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Request, Response } from 'express';

const router = Router();
const logger = new SimpleLogger('WhisperAPI');

/**
 * POST /api/whisper/transcribe
 * Transcribe audio file using KB-Whisper
 * Accepts audio as base64 or binary in request body
 */
router.post('/transcribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { audioData, audioFormat = 'webm', language = 'sv', task = 'transcribe', returnTimestamps = false } = req.body;

    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'No audio data provided. Send audioData as base64 string or buffer.',
      });
    }

    logger.info(`[WhisperAPI] Transcribe request received, audioFormat: ${audioFormat}, language: ${language}`);

    // Convert base64 to buffer if needed
    let audioBuffer: Buffer;
    if (typeof audioData === 'string') {
      // Remove data URL prefix if present (data:audio/wav;base64,...)
      const base64Data = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      audioBuffer = Buffer.from(base64Data, 'base64');
      logger.info(`[WhisperAPI] Decoded base64 audio, size: ${audioBuffer.length} bytes`);
    } else {
      audioBuffer = Buffer.from(audioData);
      logger.info(`[WhisperAPI] Received binary audio, size: ${audioBuffer.length} bytes`);
    }

    if (audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Audio buffer is empty',
      });
    }

    logger.info(`[WhisperAPI] Starting transcription, buffer size: ${audioBuffer.length} bytes, language: ${language}`);

    // Check if faster-whisper is available first
    const isAvailable = await whisperService.checkDependencies();
    if (!isAvailable) {
      logger.warn('[WhisperAPI] faster-whisper not available, attempting installation...');
      try {
        await whisperService.installDependencies();
        const checkAgain = await whisperService.checkDependencies();
        if (!checkAgain) {
          throw new Error('faster-whisper installation failed');
        }
        logger.info('[WhisperAPI] ✅ faster-whisper installed successfully');
      } catch (installError) {
        logger.error('[WhisperAPI] Installation failed', installError as Error);
        return res.status(503).json({
          success: false,
          error: 'faster-whisper is not available and installation failed',
          message: 'Please use Web Speech API as fallback or contact support',
        });
      }
    }

    const result = await whisperService.transcribeBuffer(audioBuffer, {
      language,
      task: task as 'transcribe' | 'translate',
      returnTimestamps: returnTimestamps === 'true' || returnTimestamps === true,
      audioFormat: audioFormat || 'webm', // Default to webm for MediaRecorder
    });

    logger.info(`[WhisperAPI] Transcription successful, text length: ${result.text?.length || 0}`);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[WhisperAPI] Transcription failed', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    logger.error('[WhisperAPI] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: errorMessage,
      message: 'Failed to transcribe audio. Make sure faster-whisper is installed: pip install faster-whisper',
    });
  }
});

/**
 * POST /api/whisper/transcribe-buffer
 * Transcribe audio from buffer (base64 or binary)
 */
router.post('/transcribe-buffer', authenticateUser, async (req, res) => {
  try {
    const { audioData, audioFormat = 'wav', language = 'sv', task = 'transcribe', returnTimestamps = false } = req.body;

    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'No audio data provided',
      });
    }

    // Convert base64 to buffer if needed
    let audioBuffer: Buffer;
    if (typeof audioData === 'string') {
      // Assume base64
      audioBuffer = Buffer.from(audioData, 'base64');
    } else {
      audioBuffer = Buffer.from(audioData);
    }

    logger.info(`Transcribing audio buffer, size: ${audioBuffer.length} bytes, language: ${language}`);

    const result = await whisperService.transcribeBuffer(audioBuffer, {
      language,
      task: task as 'transcribe' | 'translate',
      returnTimestamps: returnTimestamps === 'true' || returnTimestamps === true,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Buffer transcription failed', error as Error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
    });
  }
});

/**
 * GET /api/whisper/status
 * Check if KB-Whisper is available
 */
router.get('/status', authenticateUser, async (req, res) => {
  try {
    logger.info('Checking KB-Whisper status for user:', req.user?.id);
    let isAvailable = await whisperService.checkDependencies();
    
    // If not available, try to install it (runtime installation as fallback)
    if (!isAvailable) {
      logger.info('faster-whisper not found, attempting runtime installation...');
      try {
        await whisperService.installDependencies();
        // Check again after installation
        isAvailable = await whisperService.checkDependencies();
        if (isAvailable) {
          logger.info('✅ faster-whisper installed successfully at runtime');
        }
      } catch (installError) {
        logger.warn('Runtime installation failed (this is OK if faster-whisper is not available on this system)', installError);
      }
    }
    
    logger.info('KB-Whisper status check result:', { available: isAvailable, userId: req.user?.id });
    
    res.json({
      success: true,
      available: isAvailable,
      model: 'KBLab/kb-whisper-base',
      language: 'Swedish (sv)',
      message: isAvailable 
        ? 'KB-Whisper is ready to use'
        : 'KB-Whisper requires faster-whisper. Install with: pip install faster-whisper',
    });
  } catch (error) {
    logger.error('Status check failed', error as Error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    });
  }
});

export default router;

