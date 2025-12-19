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
    const pythonCommands = ['py', 'python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        // Check if Python is available
        await execAsync(`${cmd} --version`);
        // Check if faster-whisper is installed
        try {
          await execAsync(`${cmd} -c "import faster_whisper"`);
          logger.info(`✅ faster-whisper found using: ${cmd}`);
          return true;
        } catch {
          // Try next Python command
          continue;
        }
      } catch {
        // Try next Python command
        continue;
      }
    }
    
    logger.warn('faster-whisper not found. Install with: py -m pip install faster-whisper (Windows) or pip3 install faster-whisper (macOS/Linux)');
    return false;
  }

  /**
   * Install faster-whisper if not available
   * Tries multiple Python commands for cross-platform support
   */
  async installDependencies(): Promise<void> {
    const pythonCommands = ['py', 'python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        await execAsync(`${cmd} --version`);
        logger.info(`Installing faster-whisper using: ${cmd}`);
        await execAsync(`${cmd} -m pip install faster-whisper`);
        logger.info('✅ faster-whisper installed successfully');
        return;
      } catch {
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

    // Try multiple Python commands for cross-platform support
    const pythonCommands = ['py', 'python3', 'python'];
    let lastError: Error | null = null;
    
    for (const cmd of pythonCommands) {
      try {
        // Execute Python script
        const { stdout, stderr } = await execAsync(`${cmd} "${scriptPath}"`);
      
        if (stderr && !stderr.includes('WARNING')) {
          logger.warn('Whisper stderr', { stderr });
        }

        const result = JSON.parse(stdout.trim());
      
      if (result.error) {
        throw new Error(`Transcription failed: ${result.error}`);
      }

        // Clean up script
        await fs.unlink(scriptPath).catch(() => {});

        return {
          text: result.text,
          language: result.language,
          languageProbability: result.languageProbability,
          segments: result.segments || undefined,
        };
      } catch (error) {
        lastError = error as Error;
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
    } = {}
  ): Promise<TranscriptionResult> {
    // Save buffer to temporary file
    const tempDir = path.join(process.cwd(), 'temp', 'audio');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);
    
    try {
      await fs.writeFile(tempFilePath, audioBuffer);
      const result = await this.transcribe(tempFilePath, options);
      
      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {});
      
      return result;
    } catch (error) {
      // Clean up temp file on error
      await fs.unlink(tempFilePath).catch(() => {});
      throw error;
    }
  }
}

// Singleton instance
export const whisperService = new WhisperService();

