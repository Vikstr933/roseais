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
  private venvPath: string;
  private venvPython: string;
  private venvChecked: boolean = false;
  private venvExists: boolean = false;

  constructor() {
    // Use KB-Whisper Base model from KBLab
    this.modelPath = 'KBLab/kb-whisper-base';
    this.cacheDir = path.join(process.cwd(), 'cache', 'whisper-models');
    this.venvPath = path.join(process.cwd(), 'venv-whisper');
    this.venvPython = process.platform === 'win32' 
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python3');
  }

  /**
   * Check if faster-whisper is available
   * PRIORITET: venv-whisper (installerad i Docker) är primär metod
   * System Python kan inte användas i modern Python (3.11+) pga externally-managed-environment
   */
  async checkDependencies(): Promise<boolean> {
    // PRIORITET 1: Check venv-whisper first (installerad i Docker)
    // Use cached result if we've already checked (to avoid repeated file system calls)
    if (this.venvChecked && this.venvExists) {
      try {
        await execAsync(`"${this.venvPython}" -c "import faster_whisper"`);
        logger.info(`✅ faster-whisper found in venv (cached): ${this.venvPython}`);
        return true;
      } catch {
        // Venv might have been deleted, reset cache
        this.venvChecked = false;
        this.venvExists = false;
      }
    }
    
    try {
      // Check if venv Python executable exists using stat (more reliable than access)
      try {
        const stats = await fs.stat(this.venvPython);
        if (stats.isFile()) {
          // Venv Python exists, check if faster-whisper is installed
          await execAsync(`"${this.venvPython}" -c "import faster_whisper"`);
          await execAsync(`"${this.venvPython}" -c "from faster_whisper import WhisperModel"`);
          logger.info(`✅ faster-whisper found in venv: ${this.venvPython}`);
          this.venvChecked = true;
          this.venvExists = true;
          return true;
        }
      } catch (statError) {
        // Venv doesn't exist
        this.venvChecked = true;
        this.venvExists = false;
        logger.debug('Venv not found, checking system Python...');
      }
    } catch (venvError) {
      logger.debug('Venv check failed, checking system Python...', { error: venvError instanceof Error ? venvError.message : String(venvError) });
      this.venvChecked = true;
      this.venvExists = false;
    }
    
    // PRIORITET 2: Fallback to system Python (för development/local setups)
    // I Docker/Linux är python3 standard, inte py eller python
    // NOTE: Modern Python (3.11+) har externally-managed-environment, så detta fungerar oftast inte
    const systemPythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3']; // Only python3 in Linux/Docker - python and py don't exist
    
    for (const cmd of systemPythonCommands) {
      try {
        // Check if Python is available
        const versionResult = await execAsync(`${cmd} --version`);
        logger.info(`[WhisperService] Checking system Python: ${cmd} - ${versionResult.stdout.trim()}`);
        
        // Check if faster-whisper is installed in system Python
        try {
          await execAsync(`${cmd} -c "import faster_whisper"`);
          await execAsync(`${cmd} -c "from faster_whisper import WhisperModel"`);
          logger.info(`✅ faster-whisper found in system Python: ${cmd}`);
          return true;
        } catch (importError) {
          logger.debug(`faster-whisper not found in system Python (${cmd})`);
          // Try next
          continue;
        }
      } catch (versionError) {
        // Python command not found, try next
        continue;
      }
    }
    
    logger.warn('faster-whisper not found in venv or system Python. Install with: pip3 install faster-whisper');
    logger.warn('On Render, faster-whisper should be installed in venv-whisper during build. Check build logs.');
    return false;
  }

  /**
   * Install faster-whisper if not available
   * Tries multiple Python commands for cross-platform support
   */
  async installDependencies(): Promise<void> {
    // ALWAYS use venv - this is the preferred method
    
    // First, check if venv already exists and has faster-whisper
    try {
      const stats = await fs.stat(this.venvPython);
      if (stats.isFile()) {
        // Venv exists, check if faster-whisper is installed
        try {
          await execAsync(`"${this.venvPython}" -c "import faster_whisper"`);
          logger.info('✅ faster-whisper already available in venv');
          this.venvChecked = true;
          this.venvExists = true;
          return;
        } catch {
          // Venv exists but faster-whisper not installed, install it
          logger.info('Venv exists but faster-whisper not installed, installing...');
        }
      }
    } catch {
      // Venv doesn't exist, create it
      logger.info('Creating venv and installing faster-whisper...');
    }
    
    // Find Python command to create venv
    // In Docker/Linux, python3 is the standard
    const pythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3']; // Only python3 in Linux/Docker - python and py don't exist
    
    let venvCreated = false;
    for (const cmd of pythonCommands) {
      try {
        const versionResult = await execAsync(`${cmd} --version`);
        logger.info(`Creating venv using: ${cmd} (${versionResult.stdout.trim()})`);
        
        // Create venv using absolute path
        await execAsync(`${cmd} -m venv "${this.venvPath}"`);
        venvCreated = true;
        logger.info(`✅ Venv created successfully at: ${this.venvPath}`);
        // Reset cache since we just created venv
        this.venvChecked = false;
        this.venvExists = false;
        break;
      } catch (error) {
        logger.warn(`Venv creation failed with ${cmd}, trying next...`, { error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }
    
    if (!venvCreated) {
      throw new Error('Failed to create venv. No Python command found.');
    }
    
    // Install faster-whisper in venv
    try {
      logger.info(`Installing faster-whisper in venv at: ${this.venvPath}`);
      // Verify venv Python exists before installing
      const stats = await fs.stat(this.venvPython);
      if (!stats.isFile()) {
        throw new Error(`Venv Python not found at: ${this.venvPython}`);
      }
      
      await execAsync(`"${this.venvPython}" -m pip install --upgrade pip`);
      await execAsync(`"${this.venvPython}" -m pip install faster-whisper`);
      logger.info('✅ faster-whisper installed successfully in venv');
      // Update cache
      this.venvChecked = true;
      this.venvExists = true;
      return;
    } catch (error) {
      logger.error('Failed to install faster-whisper in venv', error instanceof Error ? error : new Error(String(error)));
      // Reset cache on error
      this.venvChecked = false;
      this.venvExists = false;
      throw new Error(`Failed to install faster-whisper in venv: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // Escape backslashes for Windows paths in Python string
    // Use raw strings (r"...") to handle Windows paths correctly
    const escapedAudioPath = audioFilePath.replace(/\\/g, '\\\\');
    const escapedCacheDir = this.cacheDir.replace(/\\/g, '\\\\');
    
    const pythonScript = `
import json
import sys
import os
from faster_whisper import WhisperModel

model_id = "${this.modelPath}"
audio_file = r"${escapedAudioPath}"
language = "${language}"
task = "${task}"
return_timestamps = ${returnTimestamps ? 'True' : 'False'}

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
        download_root=r"${escapedCacheDir}"
    )
    
    # Transcribe with speed optimizations
    # Note: Very permissive settings to catch all speech, even quiet or short audio
    segments, info = model.transcribe(
        audio_file,
        language=language if language != "auto" else None,
        task=task,
        condition_on_previous_text=False,  # Faster, no context dependency
        beam_size=1,  # Greedy decoding (fastest, slight quality trade-off)
        best_of=1,  # No beam search (faster)
        temperature=0,  # Deterministic (faster)
        compression_ratio_threshold=2.4,  # Default threshold
        log_prob_threshold=-1.0,  # Lower threshold for faster processing
        no_speech_threshold=0.1,  # Very low threshold to detect even quiet speech (was 0.3)
        vad_filter=False,  # DISABLE VAD to catch all audio (was True)
        # Removed vad_parameters since VAD is disabled
    )
    
    # Collect results
    text_parts = []
    segments_list = []
    segment_count = 0
    
    for segment in segments:
        segment_count += 1
        if segment.text and segment.text.strip():
            text_parts.append(segment.text.strip())
        if return_timestamps:
            segments_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
    
    # Log transcription info for debugging
    print(f"DEBUG: Found {segment_count} segments, language: {info.language}, probability: {info.language_probability}", file=sys.stderr)
    
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

    // PRIORITET: venv-whisper (installerad i Docker) är primär metod
    // System Python kan inte användas i modern Python (3.11+) pga externally-managed-environment
    let lastError: Error | null = null;
    
    // Helper function to execute Python script
    const executeScript = async (pythonCmd: string, description: string) => {
      logger.info(`[WhisperService] Using ${description}: ${pythonCmd}`);
      logger.info(`[WhisperService] Executing script: ${scriptPath}`);
      logger.info(`[WhisperService] Audio file: ${audioFilePath}`);
      
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(`"${pythonCmd}" "${scriptPath}"`, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
          timeout: 120000, // 2 minute timeout
        });
        const duration = Date.now() - startTime;
        
        logger.info(`[WhisperService] Python script completed in ${duration}ms`);
        
        // Log stderr for debugging (even if it's just warnings)
        if (stderr) {
          const stderrPreview = stderr.substring(0, 1000);
          if (!stderr.includes('WARNING') && !stderr.includes('INFO') && !stderr.includes('DEBUG')) {
            logger.warn(`[WhisperService] Python stderr (${description}):`, { stderr: stderrPreview });
          } else {
            logger.debug(`[WhisperService] Python stderr (${description}, warnings/info):`, { stderr: stderrPreview });
          }
        }

        if (!stdout || stdout.trim().length === 0) {
          logger.error(`[WhisperService] Python script returned empty output (${description})`);
          throw new Error('Python script returned empty output');
        }

        logger.info(`[WhisperService] Python stdout length: ${stdout.length}`);
        const result = JSON.parse(stdout.trim());
    
        if (result.error) {
          logger.error(`[WhisperService] Python script error (${description}):`, result.error);
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
      } catch (execError: any) {
        const duration = Date.now() - startTime;
        logger.error(`[WhisperService] Python script execution failed (${description}) after ${duration}ms`);
        
        // Log detailed error information
        if (execError.stdout) {
          logger.error(`[WhisperService] Python stdout: ${execError.stdout.substring(0, 500)}`);
        }
        if (execError.stderr) {
          logger.error(`[WhisperService] Python stderr: ${execError.stderr.substring(0, 1000)}`);
        }
        if (execError.message) {
          logger.error(`[WhisperService] Error message: ${execError.message}`);
        }
        
        // Re-throw with more context
        const errorMessage = execError.stderr 
          ? `${execError.message}\nPython stderr: ${execError.stderr.substring(0, 500)}`
          : execError.message;
        throw new Error(errorMessage);
      }
    };
    
    // PRIORITET 1: Try venv Python first (installerad i Docker)
    try {
      const stats = await fs.stat(this.venvPython);
      if (stats.isFile()) {
        // Verify faster-whisper is installed in venv before using it
        try {
          await execAsync(`"${this.venvPython}" -c "import faster_whisper"`);
          await execAsync(`"${this.venvPython}" -c "from faster_whisper import WhisperModel"`);
          logger.info(`[WhisperService] ✅ faster-whisper verified in venv`);
        } catch (importError) {
          logger.error(`[WhisperService] ❌ faster-whisper NOT found in venv at ${this.venvPython}`);
          logger.error(`[WhisperService] This should not happen - faster-whisper should be installed during Docker build`);
          throw new Error(`faster-whisper is not installed in venv-whisper. Please rebuild Docker image.`);
        }
        
        // Execute script with venv Python
        return await executeScript(this.venvPython, 'venv Python');
      }
    } catch (venvError) {
      const error = venvError instanceof Error ? venvError : new Error(String(venvError));
      
      // If venv exists but faster-whisper is missing, don't continue
      // This is a configuration error that needs to be fixed
      if (error.message.includes('faster-whisper is not installed in venv-whisper')) {
        logger.error('[WhisperService] ❌ Venv exists but faster-whisper is missing. This is a build error.');
        throw error; // Don't continue - this needs to be fixed
      }
      
      logger.warn('[WhisperService] Venv Python failed, trying system Python...', { 
        error: error.message,
        stack: error.stack?.substring(0, 200)
      });
      lastError = error;
    }
    
    // PRIORITET 2: Fallback to system Python (för development/local setups)
    // NOTE: Modern Python (3.11+) har externally-managed-environment, så detta fungerar oftast inte
    const systemPythonCommands = process.platform === 'win32' 
      ? ['py', 'python', 'python3']
      : ['python3']; // Only python3 in Linux/Docker
    
    for (const cmd of systemPythonCommands) {
      try {
        // Verify faster-whisper is installed in system Python
        await execAsync(`${cmd} -c "import faster_whisper"`);
        await execAsync(`${cmd} -c "from faster_whisper import WhisperModel"`);
        logger.info(`[WhisperService] ✅ faster-whisper verified in system Python: ${cmd}`);
        
        // Execute script with system Python
        return await executeScript(cmd, `system Python (${cmd})`);
      } catch (importError) {
        logger.debug(`[WhisperService] faster-whisper not found in system Python (${cmd}), trying next...`);
        continue;
      }
    }
    
    // If we get here, neither venv nor system Python worked
    // Clean up script on error
    await fs.unlink(scriptPath).catch(() => {});
    
    if (lastError instanceof Error) {
      throw new Error(`Failed to execute Whisper script. Tried: venv and system Python. Error: ${lastError.message}`);
    }
    
    throw new Error('Failed to execute Whisper script. No Python environment with faster-whisper found.');
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

