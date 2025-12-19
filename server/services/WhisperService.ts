/**
 * KB-Whisper Service
 * Integration with KBLab's KB-Whisper Base model for Swedish speech recognition
 * Uses faster-whisper for efficient inference
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SimpleLogger } from '../utils/SimpleLogger';

const execAsync = promisify(exec);
const logger = new SimpleLogger('WhisperService');

export interface TranscriptionResult {
  text: string;
  language: string;
  languageProbability: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export class WhisperService {
  private modelPath: string;
  private cacheDir: string;
  private isInitialized: boolean = false;

  constructor() {
    // Use KB-Whisper Base model from KBLab
    this.modelPath = 'KBLab/kb-whisper-base';
    this.cacheDir = path.join(process.cwd(), 'cache', 'whisper-models');
  }

  /**
   * Check if faster-whisper is available
   * Tries multiple Python commands (py, python3, python) for cross-platform support
   */
  async checkDependencies(): Promise<boolean> {
    // Try multiple Python commands in order of preference
    // On Render/Linux: python3 is most common
    // On Windows: py or python
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3', 'python', 'py'];
    
    // First, try checking if faster-whisper is available in system Python
    for (const cmd of pythonCommands) {
      try {
        // Check if Python is available
        const versionResult = await execAsync(`${cmd} --version`);
        logger.info(`Python found: ${cmd} - ${versionResult.stdout.trim()}`);
        
        // Check if faster-whisper is installed
        try {
          await execAsync(`${cmd} -c "import faster_whisper"`);
          logger.info(`✅ faster-whisper found using: ${cmd}`);
          return true;
        } catch (importError) {
          // Try checking in virtual environment if it exists
          const venvPath = process.cwd() + '/venv-whisper';
          try {
            const venvPython = process.platform === 'win32' 
              ? `${venvPath}/Scripts/python.exe`
              : `${venvPath}/bin/python3`;
            await execAsync(`${venvPython} -c "import faster_whisper"`);
            logger.info(`✅ faster-whisper found in venv: ${venvPython}`);
            return true;
          } catch {
            // Continue to next Python command
          }
          logger.warn(`faster-whisper not found with ${cmd}, trying next...`);
          // Try next Python command
          continue;
        }
      } catch (versionError) {
        // Python command not found, try next
        continue;
      }
    }
    
    logger.warn('faster-whisper not found. Install with: py -m pip install faster-whisper (Windows) or pip3 install faster-whisper (macOS/Linux)');
    logger.warn('On Render, faster-whisper should be installed during build. Check build logs.');
    return false;
  }

  /**
   * Install faster-whisper if not available
   * Tries multiple Python commands for cross-platform support
   */
  async installDependencies(): Promise<void> {
    // Try multiple Python commands in order of preference
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3', 'python', 'py'];
    
    // First, try to use existing virtual environment if it exists
    const venvPath = process.cwd() + '/venv-whisper';
    const venvPython = process.platform === 'win32' 
      ? `${venvPath}/Scripts/python.exe`
      : `${venvPath}/bin/python3`;
    
    try {
      // Check if venv exists and has faster-whisper
      await execAsync(`${venvPython} -c "import faster_whisper"`);
      logger.info('✅ faster-whisper already available in venv');
      return;
    } catch {
      // Venv doesn't exist or doesn't have faster-whisper, try to create/install
      try {
        // Try to create venv and install
        for (const cmd of pythonCommands) {
          try {
            const versionResult = await execAsync(`${cmd} --version`);
            logger.info(`Creating venv and installing faster-whisper using: ${cmd} (${versionResult.stdout.trim()})`);
            
            // Create venv
            await execAsync(`${cmd} -m venv venv-whisper`);
            
            // Install faster-whisper in venv
            await execAsync(`${venvPython} -m pip install --upgrade pip`);
            await execAsync(`${venvPython} -m pip install faster-whisper`);
            
            logger.info('✅ faster-whisper installed successfully in venv');
            return;
          } catch (error) {
            logger.warn(`Venv creation/installation failed with ${cmd}, trying next...`, error instanceof Error ? error : new Error(String(error)));
            continue;
          }
        }
      } catch (error) {
        logger.warn('Venv installation failed, trying system installation with --break-system-packages...', error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    // Fallback: Try system installation with --break-system-packages (for externally managed environments)
    for (const cmd of pythonCommands) {
      try {
        const versionResult = await execAsync(`${cmd} --version`);
        logger.info(`Installing faster-whisper using: ${cmd} (${versionResult.stdout.trim()}) with --break-system-packages`);
        // Use --break-system-packages for externally managed environments (like Render)
        await execAsync(`${cmd} -m pip install --break-system-packages faster-whisper`);
        logger.info('✅ faster-whisper installed successfully');
        return;
      } catch (error) {
        logger.warn(`Installation failed with ${cmd}, trying next...`, error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }
    
    throw new Error('Failed to install faster-whisper. Please install manually: py -m pip install faster-whisper (Windows) or pip3 install faster-whisper (macOS/Linux)');
  }

  /**
   * Transcribe audio file using KB-Whisper
   */
  async transcribe(
    audioFilePath: string,
    options: {
      language?: string;
      task?: 'transcribe' | 'translate';
      returnTimestamps?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    const { language = 'sv', task = 'transcribe', returnTimestamps = false } = options;

    // Check if audio file exists
    try {
      await fs.access(audioFilePath);
    } catch {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Check dependencies
    const hasDependencies = await this.checkDependencies();
    if (!hasDependencies) {
      throw new Error('faster-whisper is not installed. Please install it first.');
    }

    // Create Python script for transcription
    const scriptPath = path.join(process.cwd(), 'scripts', 'whisper_transcribe.py');
    const scriptDir = path.dirname(scriptPath);
    await fs.mkdir(scriptDir, { recursive: true });

    const pythonScript = `
import json
import sys
from faster_whisper import WhisperModel

model_id = "${this.modelPath}"
audio_file = "${audioFilePath}"
language = "${language}"
task = "${task}"
return_timestamps = ${returnTimestamps}

try:
    # Load model (will download on first use)
    # Optimized for speed and cost:
    # - int8 quantization: faster inference, less memory
    # - cpu device: no GPU required (free)
    # - condition_on_previous_text=False: faster, no context dependency
    model = WhisperModel(
        model_id,
        device="cpu",  # Use "cuda" if GPU available (faster but requires GPU)
        compute_type="int8",  # Fastest CPU inference, 4x faster than float32
        download_root="${this.cacheDir}"
    )
    
    # Transcribe with speed optimizations
    segments, info = model.transcribe(
        audio_file,
        language=language if language != "auto" else None,
        task=task,
        condition_on_previous_text=False,  # Faster, no context dependency
        beam_size=1,  # Greedy decoding (fastest, slight quality trade-off)
        best_of=1,  # No beam search (faster)
        temperature=0,  # Deterministic (faster)
        compression_ratio_threshold=2.4,  # Skip silence detection (faster)
        log_prob_threshold=-1.0,  # Lower threshold for faster processing
        no_speech_threshold=0.6,  # Skip empty audio faster
        vad_filter=True,  # Voice activity detection (skip silence)
        vad_parameters=dict(min_silence_duration_ms=500)  # Skip short silences
    )
    
    # Collect results
    text_parts = []
    segments_list = []
    
    for segment in segments:
        text_parts.append(segment.text)
        if return_timestamps:
            segments_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
    
    result = {
        "text": " ".join(text_parts).strip(),
        "language": info.language,
        "languageProbability": info.language_probability,
        "segments": segments_list if return_timestamps else None
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "error": str(e),
        "text": "",
        "language": "",
        "languageProbability": 0.0
    }
    print(json.dumps(error_result))
    sys.exit(1)
`;

    await fs.writeFile(scriptPath, pythonScript);

    // First, try to use venv Python if it exists
    const venvPath = process.cwd() + '/venv-whisper';
    const venvPython = process.platform === 'win32' 
      ? `${venvPath}/Scripts/python.exe`
      : `${venvPath}/bin/python3`;
    
    let lastError: Error | null = null;
    
    // Try venv Python first
    try {
      await fs.access(venvPython);
      logger.info(`[WhisperService] Using venv Python: ${venvPython}`);
      logger.info(`[WhisperService] Executing script: ${scriptPath}`);
      logger.info(`[WhisperService] Audio file: ${audioFilePath}`);
      
      const { stdout, stderr } = await execAsync(`"${venvPython}" "${scriptPath}"`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        timeout: 120000, // 2 minute timeout
      });
      
      if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO')) {
        logger.warn('[WhisperService] Python stderr:', { stderr: stderr.substring(0, 500) });
      }

      if (!stdout || stdout.trim().length === 0) {
        throw new Error('Python script returned empty output');
      }

      logger.info(`[WhisperService] Python stdout length: ${stdout.length}`);
      const result = JSON.parse(stdout.trim());
    
      if (result.error) {
        logger.error('[WhisperService] Python script error:', result.error);
        throw new Error(`Transcription failed: ${result.error}`);
      }

      if (!result.text) {
        logger.warn('[WhisperService] No text in result, but no error either');
      }

      // Clean up script
      await fs.unlink(scriptPath).catch(() => {});

      logger.info(`[WhisperService] Transcription successful, text: "${result.text?.substring(0, 50)}..."`);

      return {
        text: result.text || '',
        language: result.language || language,
        languageProbability: result.languageProbability || 0,
        segments: result.segments || undefined,
      };
    } catch (venvError) {
      const error = venvError instanceof Error ? venvError : new Error(String(venvError));
      logger.warn('[WhisperService] Venv Python failed, trying system Python...', { 
        error: error.message,
        stack: error.stack?.substring(0, 200)
      });
      lastError = error;
    }

    // Fallback to system Python commands
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3', 'python', 'py'];
    
    for (const cmd of pythonCommands) {
      try {
        logger.info(`[WhisperService] Trying system Python: ${cmd}`);
        // Execute Python script
        const { stdout, stderr } = await execAsync(`${cmd} "${scriptPath}"`, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 120000, // 2 minute timeout
        });
      
        if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO')) {
          logger.warn('[WhisperService] Python stderr:', { stderr: stderr.substring(0, 500) });
        }

        if (!stdout || stdout.trim().length === 0) {
          throw new Error('Python script returned empty output');
        }

        logger.info(`[WhisperService] Python stdout length: ${stdout.length}`);
        const result = JSON.parse(stdout.trim());
      
        if (result.error) {
          logger.error('[WhisperService] Python script error:', result.error);
          throw new Error(`Transcription failed: ${result.error}`);
        }

        if (!result.text) {
          logger.warn('[WhisperService] No text in result, but no error either');
        }

        // Clean up script
        await fs.unlink(scriptPath).catch(() => {});

        logger.info(`[WhisperService] Transcription successful, text: "${result.text?.substring(0, 50)}..."`);

        return {
          text: result.text || '',
          language: result.language || language,
          languageProbability: result.languageProbability || 0,
          segments: result.segments || undefined,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn(`[WhisperService] ${cmd} failed:`, { error: err.message, command: cmd });
        lastError = err;
        // Try next Python command
        continue;
      }
    }
    
    // Clean up script on error
    await fs.unlink(scriptPath).catch(() => {});
    
    if (lastError instanceof Error) {
      if (lastError.message.includes('JSON')) {
        logger.error('Failed to parse Whisper output', lastError);
        throw new Error('Failed to parse transcription result. Check Python/faster-whisper installation.');
      }
      throw new Error(`Failed to execute Whisper script. Tried: ${pythonCommands.join(', ')}. Error: ${lastError.message}`);
    }
    throw new Error(`Failed to execute Whisper script. Tried: ${pythonCommands.join(', ')}. Unknown error.`);
  }

  /**
   * Transcribe audio buffer (from frontend)
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    options: {
      language?: string;
      task?: 'transcribe' | 'translate';
      returnTimestamps?: boolean;
      audioFormat?: string;
    } = {}
  ): Promise<TranscriptionResult> {
    const { audioFormat = 'webm' } = options;
    
    logger.info(`[WhisperService] transcribeBuffer called, buffer size: ${audioBuffer.length}, format: ${audioFormat}`);
    
    // Save buffer to temporary file with correct extension
    const tempDir = path.join(process.cwd(), 'temp', 'audio');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Use the provided format or default to webm (MediaRecorder default)
    const extension = audioFormat === 'webm' ? 'webm' : audioFormat === 'ogg' ? 'ogg' : 'wav';
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.${extension}`);
    
    logger.info(`[WhisperService] Saving audio to temp file: ${tempFilePath}`);
    
    try {
      await fs.writeFile(tempFilePath, audioBuffer);
      logger.info(`[WhisperService] Audio file saved, size: ${audioBuffer.length} bytes`);
      
      const result = await this.transcribe(tempFilePath, options);
      
      logger.info(`[WhisperService] Transcription completed, text: "${result.text?.substring(0, 50)}..."`);
      
      // Clean up temp file
      await fs.unlink(tempFilePath).catch((err) => {
        logger.warn('[WhisperService] Failed to delete temp file', err);
      });
      
      return result;
    } catch (error) {
      logger.error('[WhisperService] transcribeBuffer error', error instanceof Error ? error : new Error(String(error)));
      // Clean up temp file on error
      await fs.unlink(tempFilePath).catch(() => {});
      throw error;
    }
  }
}

// Singleton instance
export const whisperService = new WhisperService();

