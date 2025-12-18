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
    const { audioData, audioFormat = 'wav', language = 'sv', task = 'transcribe', returnTimestamps = false } = req.body;

    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'No audio data provided. Send audioData as base64 string or buffer.',
      });
    }

    // Convert base64 to buffer if needed
    let audioBuffer: Buffer;
    if (typeof audioData === 'string') {
      // Remove data URL prefix if present (data:audio/wav;base64,...)
      const base64Data = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      audioBuffer = Buffer.from(base64Data, 'base64');
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
    logger.error('Transcription failed', error as Error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
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
    const isAvailable = await whisperService.checkDependencies();
    
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

