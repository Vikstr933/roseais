/**
 * Video Transcription API Routes
 * Endpoints for transcribing YouTube videos and converting to voice actor scripts
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SimpleLogger } from '../utils/SimpleLogger';
import { whisperService } from '../services/WhisperService';
import { audioFileService } from '../services/AudioFileService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';

const execAsync = promisify(exec);
const router = Router();
const logger = new SimpleLogger('VideoTranscriptionAPI');

// Track in-flight transcriptions to prevent duplicate processing
const inFlightTranscriptions = new Map<string, Promise<any>>();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Log router initialization
logger.info('[VideoRouter] Video transcription router initialized');

/**
 * Get transcript using youtube-transcript.io API (paid service, more reliable)
 * Falls back to Python youtube-transcript-api if API key not available
 * @param videoId - YouTube video ID
 * @param languageCode - Optional language code (e.g., 'en', 'sv', 'auto')
 * @returns Transcript text or null if not available
 */
async function getYouTubeTranscript(videoId: string, languageCode: string = 'auto'): Promise<string | null> {
  // First, try youtube-transcript.io API if API key is available (most reliable)
  const transcriptIoApiKey = process.env.YOUTUBE_TRANSCRIPT_IO_API_KEY;
  
  if (transcriptIoApiKey) {
    try {
      logger.info(`[VideoTranscription] Attempting to get transcript via youtube-transcript.io API for video: ${videoId}`);
      
      const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${transcriptIoApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: [videoId],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // API returns array of results, find our video
        if (data && Array.isArray(data) && data.length > 0) {
          const videoData = data.find((item: any) => item.id === videoId || item.videoId === videoId);
          
          if (videoData && videoData.transcript) {
            // Transcript can be string or array of snippets
            let transcriptText: string;
            
            if (typeof videoData.transcript === 'string') {
              transcriptText = videoData.transcript;
            } else if (Array.isArray(videoData.transcript)) {
              // Array of snippets with text, start, duration
              transcriptText = videoData.transcript
                .map((snippet: any) => snippet.text || snippet)
                .filter(Boolean)
                .join(' ');
            } else {
              logger.warn(`[VideoTranscription] Unexpected transcript format from API`);
              throw new Error('Unexpected transcript format');
            }
            
            if (transcriptText && transcriptText.trim()) {
              logger.info(`[VideoTranscription] ✅ Successfully retrieved transcript via youtube-transcript.io API (${transcriptText.length} characters)`);
              return transcriptText.trim();
            }
          }
        }
        
        logger.info(`[VideoTranscription] Transcript not found in API response for video: ${videoId}`);
      } else if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        logger.warn(`[VideoTranscription] Rate limited by youtube-transcript.io API. Retry after: ${retryAfter}s`);
      } else {
        logger.warn(`[VideoTranscription] youtube-transcript.io API returned status ${response.status}`);
      }
    } catch (error) {
      logger.warn(`[VideoTranscription] Error calling youtube-transcript.io API: ${error instanceof Error ? error.message : String(error)}`);
      // Continue to fallback method
    }
  }

  // Fallback to Python youtube-transcript-api (often fails on cloud providers due to IP blocking)
  return await getYouTubeTranscriptPython(videoId, languageCode);
}

/**
 * Get transcript directly from YouTube using youtube-transcript-api Python library
 * This often fails on cloud providers due to IP blocking, but we try it as fallback
 * @param videoId - YouTube video ID
 * @param languageCode - Optional language code (e.g., 'en', 'sv', 'auto')
 * @returns Transcript text or null if not available
 */
async function getYouTubeTranscriptPython(videoId: string, languageCode: string = 'auto'): Promise<string | null> {
  try {
    logger.info(`[VideoTranscription] Attempting to get transcript directly from YouTube for video: ${videoId}`);
    
    // Note: youtube-transcript-api often fails on cloud providers due to IP blocking
    // This is a best-effort attempt, but we don't rely on it
    
    // Find venv Python
    const cwd = process.cwd();
    const possibleVenvPaths = [
      path.join(cwd, 'venv-whisper'),
      path.join('/app', 'venv-whisper'),
      path.join('/opt/render/project/src', 'venv-whisper'),
    ];

    let pythonCommand: string | null = null;

    for (const venvPath of possibleVenvPaths) {
      const venvPython = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python3');

      try {
        const stats = await fs.stat(venvPython);
        if (stats.isFile()) {
          // Check if youtube-transcript-api is installed
          const checkApi = await execAsync(`"${venvPython}" -c "import youtube_transcript_api; print('OK')"`, {
            timeout: 5000
          });
          if (checkApi.stdout.includes('OK')) {
            pythonCommand = venvPython;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!pythonCommand) {
      logger.info('[VideoTranscription] youtube-transcript-api not available, will use audio extraction');
      return null;
    }

    // Get YouTube API key if available (optional - for better rate limits)
    const youtubeApiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY || process.env.YOUTUBE_API_KEY;
    
    // Create Python script to get transcript
    // Using the correct API syntax: fetch() returns FetchedTranscript object                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
    const script = `
import sys
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

video_id = "${videoId}"
language_code = "${languageCode}"

try:
    # Create API instance
    ytt_api = YouTubeTranscriptApi()
    
    # Try to fetch transcript directly
    # fetch() returns a FetchedTranscript object (iterable, has snippets)
    fetched_transcript = None
    
    try:
        if language_code and language_code != 'auto':
            # Try specific language first
            fetched_transcript = ytt_api.fetch(video_id, languages=[language_code])
        else:
            # Try English first, then any available
            try:
                fetched_transcript = ytt_api.fetch(video_id, languages=['en'])
            except:
                # Fallback to any available language (no languages param)
                fetched_transcript = ytt_api.fetch(video_id)
    except Exception as fetch_error:
        # If direct fetch fails, try listing available transcripts
        try:
            transcript_list = ytt_api.list(video_id)
            
            # Find transcript in requested language using find_transcript()
            if language_code and language_code != 'auto':
                # Try specific language, fallback to English
                try:
                    transcript = transcript_list.find_transcript([language_code, 'en'])
                except:
                    transcript = transcript_list.find_transcript(['en'])
            else:
                # Try English first
                try:
                    transcript = transcript_list.find_transcript(['en'])
                except:
                    # Fallback to any available transcript
                    transcript = transcript_list.find_transcript(['en'])
            
            # Fetch the actual transcript data (returns FetchedTranscript)
            fetched_transcript = transcript.fetch()
        except Exception as list_error:
            raise Exception(f"Could not get transcript: {str(list_error)}")
    
    # Format transcript as plain text using TextFormatter
    # FetchedTranscript is iterable and can be formatted directly
    formatter = TextFormatter()
    transcript_text = formatter.format_transcript(fetched_transcript)
    
    print(transcript_text)
    sys.exit(0)
except Exception as e:
    error_msg = str(e)
    error_type = type(e).__name__
    
    # Check for specific error types
    if 'NoTranscriptFound' in error_type or 'NoTranscriptFound' in error_msg or 'could not retrieve a transcript' in error_msg.lower() or 'No transcript found' in error_msg:
        print(f"ERROR: No transcript found for video {video_id}", file=sys.stderr)
    elif 'TranscriptsDisabled' in error_type or 'TranscriptsDisabled' in error_msg or 'transcripts are disabled' in error_msg.lower():
        print(f"ERROR: Transcripts are disabled for video {video_id}", file=sys.stderr)
    elif 'RequestBlocked' in error_type or 'IpBlocked' in error_type or 'blocked' in error_msg.lower():
        print(f"ERROR: Request blocked by YouTube. Your IP may be blocked. Consider using proxies. Error: {error_msg}", file=sys.stderr)
    elif 'has no attribute' in error_msg.lower():
        print(f"ERROR: API method not found. This may be a version issue with youtube-transcript-api. Error: {error_msg}", file=sys.stderr)
    else:
        print(f"ERROR: {error_msg}", file=sys.stderr)
    sys.exit(1)
`;

    // Write script to temp file
    const tempScriptPath = path.join(process.cwd(), 'temp', `get_transcript_${Date.now()}.py`);
    await fs.mkdir(path.dirname(tempScriptPath), { recursive: true });
    await fs.writeFile(tempScriptPath, script, 'utf-8');

    try {
      // Execute Python script
      const result = await execAsync(`"${pythonCommand}" "${tempScriptPath}"`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000, // 30 second timeout
      });

      // Clean up temp script
      await fs.unlink(tempScriptPath).catch(() => {});

      if (result.stdout && result.stdout.trim()) {
        logger.info(`[VideoTranscription] ✅ Successfully retrieved transcript directly from YouTube (${result.stdout.length} characters)`);
        return result.stdout.trim();
      }

      return null;
    } catch (execError: any) {
      // Clean up temp script
      await fs.unlink(tempScriptPath).catch(() => {});
      
      const errorMsg = execError.stderr || execError.message || String(execError);
      
      // These are expected errors - not a problem, just use audio extraction
      if (errorMsg.includes('NoTranscriptFound') || 
          errorMsg.includes('TranscriptsDisabled') ||
          errorMsg.includes('No transcript found')) {
        logger.info(`[VideoTranscription] Transcript not available for this video, will use audio extraction`);
      } 
      // IP blocking is common on cloud providers - not a critical error
      else if (errorMsg.includes('RequestBlocked') || 
               errorMsg.includes('IpBlocked') || 
               errorMsg.includes('blocked')) {
        logger.info(`[VideoTranscription] YouTube blocked transcript API request (common on cloud providers), will use audio extraction`);
      } 
      // Other errors - log but don't fail
      else {
        logger.info(`[VideoTranscription] Transcript API unavailable: ${errorMsg.substring(0, 150)}. Will use audio extraction.`);
      }
      return null;
    }
  } catch (error) {
    // Don't log as error - this is expected to fail often on cloud providers
    logger.info(`[VideoTranscription] Transcript API not available, will use audio extraction: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Fetch WebShare proxy for yt-dlp
 * Returns proxy string in format: http://username:password@ip:port
 */
async function getWebShareProxy(): Promise<string | null> {
  const proxyApiKey = process.env.WEBSHARE_PROXY_API_KEY || process.env.PROXY_API_KEY;
  
  if (!proxyApiKey) {
    return null;
  }

  try {
    logger.info('[VideoTranscription] Fetching proxy from WebShare API...');
    
    const proxyListUrl = 'https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page_size=100';
    
    const response = await fetch(proxyListUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${proxyApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`[VideoTranscription] WebShare API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      logger.warn('[VideoTranscription] No proxies available from WebShare API');
      return null;
    }

    // Randomly select a proxy from the list
    const randomProxy = data.results[Math.floor(Math.random() * data.results.length)];
    
    let proxyServer: string;
    
    if (randomProxy.proxy_address) {
      proxyServer = randomProxy.proxy_address.includes('://') 
        ? randomProxy.proxy_address 
        : `http://${randomProxy.proxy_address}`;
    } else if (randomProxy.ip && randomProxy.port) {
      const protocol = randomProxy.type === 'socks5' ? 'socks5' : randomProxy.type || 'http';
      proxyServer = `${protocol}://${randomProxy.ip}:${randomProxy.port}`;
    } else {
      return null;
    }

    // Build proxy string with authentication if available
    let proxyString = proxyServer;
    if (randomProxy.username && randomProxy.password) {
      // Format: http://username:password@ip:port
      const url = new URL(proxyServer);
      url.username = randomProxy.username;
      url.password = randomProxy.password;
      proxyString = url.toString();
    }

    logger.info(`[VideoTranscription] ✅ Using WebShare proxy: ${randomProxy.ip || 'proxy'}`);
    return proxyString;
  } catch (error) {
    logger.warn(`[VideoTranscription] Failed to fetch proxy from WebShare API: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Extract audio from YouTube video and transcribe it using Whisper
 * 
 * Uses yt-dlp (or youtube-dl if available) to download audio, then Whisper for transcription
 * 
 * @param videoId - YouTube video ID
 * @param cookiesText - Optional: YouTube cookies in Netscape format (from browser extension)
 */
export async function transcribeYouTubeVideo(videoId: string, cookiesText?: string, languageCode: string = 'auto'): Promise<{ transcription: string; videoTitle?: string; videoDuration?: number }> {
  // First, try to get transcript directly from YouTube (preferred method)
  logger.info(`[VideoTranscription] Processing video: ${videoId}`);
  const directTranscript = await getYouTubeTranscript(videoId, languageCode);
  
  if (directTranscript) {
    logger.info(`[VideoTranscription] ✅ Using direct transcript from YouTube`);
    return {
      transcription: directTranscript,
      videoTitle: undefined,
      videoDuration: undefined,
    };
  }

  // Fallback to audio extraction + Whisper transcription
  logger.info(`[VideoTranscription] Transcript not available, falling back to audio extraction + Whisper`);
  
  const tempDir = path.join(process.cwd(), 'temp', `video-${videoId}-${Date.now()}`);
  let audioPath: string | null = null;
  let cookiesPath: string | null = null;
  
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Try to get video info and download audio using yt-dlp (more reliable than ytdl-core)
    // yt-dlp is a fork of youtube-dl with better support
    audioPath = path.join(tempDir, 'audio.wav');
    
    // Save cookies to file if provided
    if (cookiesText) {
      cookiesPath = path.join(tempDir, 'cookies.txt');
      await fs.writeFile(cookiesPath, cookiesText, 'utf-8');
      const cookieLines = cookiesText.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
      logger.info(`[VideoTranscription] ✅ Using provided cookies for authentication (${cookieLines} cookie entries)`);
    } else {
      logger.info(`[VideoTranscription] ⚠️ No cookies provided - bot detection may occur. Consider uploading cookies.txt for better success rate.`);
    }
    
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
    
    if (!pythonCommand) {
      // System yt-dlp should NOT be used in production - it should be in venv
      logger.error(`[VideoTranscription] ❌ Cannot use system yt-dlp - venv not found!`);
      logger.error(`[VideoTranscription] Searched paths: ${possibleVenvPaths.join(', ')}`);
      logger.error(`[VideoTranscription] Current working directory: ${process.cwd()}`);
      throw new Error('yt-dlp is not available. venv-whisper with yt-dlp should be installed during Docker build. Please check build logs and ensure yt-dlp is installed in venv-whisper.');
    }

    // Try to get WebShare proxy
    const webshareProxy = await getWebShareProxy();

    // Try multiple strategies to bypass YouTube bot detection
    // Different player clients often work when others fail
    const strategies = [
      {
        name: 'Android client (mobile)',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        extractorArgs: 'youtube:player_client=android',
      },
      {
        name: 'iOS client (mobile)',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        extractorArgs: 'youtube:player_client=ios',
      },
      {
        name: 'Android client (skip webpage)',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        extractorArgs: 'youtube:player_client=android:player_skip=webpage',
      },
      {
        name: 'TV embedded client',
        userAgent: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extractorArgs: 'youtube:player_client=tv_embedded',
      },
      {
        name: 'Web client (desktop)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extractorArgs: 'youtube:player_client=web',
      },
    ];

    let lastError: any = null;
    let downloadSucceeded = false;

    for (const strategy of strategies) {
      try {
        logger.info(`[VideoTranscription] Trying strategy: ${strategy.name}`);
        logger.info(`[VideoTranscription] Video URL: ${videoUrl}`);
        logger.info(`[VideoTranscription] Audio output path: ${audioPath}`);
        
        // Build command with optional cookies and additional flags to help bypass detection
        let command = `"${pythonCommand}" -m yt_dlp --user-agent "${strategy.userAgent}" --extractor-args "${strategy.extractorArgs}"`;
        if (cookiesPath) {
          command += ` --cookies "${cookiesPath}"`;
          logger.info(`[VideoTranscription] 🔐 Using cookies file: ${cookiesPath}`);
        }
        // Add WebShare proxy if available
        if (webshareProxy) {
          command += ` --proxy "${webshareProxy}"`;
          logger.info(`[VideoTranscription] 🌐 Using WebShare proxy with ${strategy.name}`);
        }
        // Additional flags to help bypass detection
        // --no-playlist: Ensure we only download the single video
        // --no-warnings: Reduce noise in output
        // --no-check-certificate: Skip SSL verification (can help with some network issues)
        command += ` --no-playlist --no-warnings --no-check-certificate`;
        command += ` -x --audio-format wav --audio-quality 0 -o "${audioPath}" "${videoUrl}"`;
        
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
        
        // Check if audio file was created
        try {
          await fs.access(audioPath);
          logger.info(`[VideoTranscription] ✅ Audio downloaded successfully with ${strategy.name} strategy`);
          downloadSucceeded = true;
          break; // Success! Exit the retry loop
        } catch {
          // Audio file not created, try next strategy
          logger.warn(`[VideoTranscription] Strategy ${strategy.name} completed but audio file not found, trying next...`);
          continue;
        }
      } catch (strategyError: any) {
        const errorStderr = strategyError?.stderr || '';
        const isBotDetectionError = 
          errorStderr.includes('Sign in to confirm you\'re not a bot') ||
          errorStderr.includes('confirm you\'re not a bot') ||
          errorStderr.includes('bot');
        
        if (isBotDetectionError) {
          logger.warn(`[VideoTranscription] Strategy ${strategy.name} blocked by bot detection, trying next...`);
          lastError = strategyError;
          continue; // Try next strategy
        } else {
          // Non-bot-detection error, log and try next
          logger.warn(`[VideoTranscription] Strategy ${strategy.name} failed: ${strategyError instanceof Error ? strategyError.message : String(strategyError)}`);
          lastError = strategyError;
          continue;
        }
      }
    }

    if (!downloadSucceeded) {
      const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
      const errorStderr = lastError?.stderr || '';
      
      logger.error(`[VideoTranscription] ❌ All strategies failed. Last error: ${errorMessage}`);
      if (errorStderr) {
        logger.error(`[VideoTranscription] Last stderr: ${errorStderr.substring(0, 1000)}`);
      }
      
      const cookieHint = cookiesPath 
        ? 'Cookies were provided but still blocked. The cookies may be expired or invalid. Please export fresh cookies from your browser.'
        : 'No cookies were provided. To bypass bot detection, please export your YouTube cookies from your browser and upload them. Install the "Get cookies.txt LOCALLY" browser extension (Chrome/Edge) or "cookies.txt" (Firefox), go to youtube.com (while logged in), export cookies, and upload the cookies.txt file.';
      
      throw new Error(`YouTube is blocking automated access after trying ${strategies.length} different methods. ${cookieHint}`);
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
        if (cookiesPath) {
          await fs.unlink(cookiesPath).catch(() => {});
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
      model: 'claude-haiku-4-5-20251001', // Using Haiku 4.5 for cost-effective script generation
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
 * Convert transcription to voice actor script using OpenAI Mini
 */
export async function convertToScriptWithOpenAI(transcription: string, videoTitle?: string): Promise<string> {
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using OpenAI Mini for cost-effective script generation
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const script = completion.choices[0]?.message?.content || '';
    return script || transcription; // Fallback to transcription if script generation fails
  } catch (error) {
    logger.error(`[VideoTranscription] Error converting to script with OpenAI: ${error}`);
    // Return transcription as fallback
    return transcription;
  }
}

/**
 * Extract audio from YouTube video
 * Returns audio file path/ID for later transcription
 */
async function extractAudioFromYouTube(
  youtubeUrl: string,
  videoId: string,
  cookiesText?: string,
  languageCode: string = 'auto'
): Promise<{ audioId: string; audioPath: string; videoTitle?: string; videoDuration?: number }> {
  // Try to get transcript directly from YouTube (optional - often fails on cloud providers)
  // This is a best-effort attempt, but we don't rely on it
  logger.info(`[AudioExtraction] Processing video: ${videoId}`);
  
  let directTranscript: string | null = null;
  try {
    // Quick attempt with short timeout - don't wait too long
    directTranscript = await Promise.race([
      getYouTubeTranscript(videoId, languageCode),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5000)) // 5 second timeout
    ]);
  } catch (error) {
    // Expected to fail often - not a problem
    logger.info(`[AudioExtraction] Transcript API not available, will extract audio: ${error instanceof Error ? error.message : String(error)}`);
    directTranscript = null;
  }
  
  if (directTranscript) {
    logger.info(`[AudioExtraction] ✅ Transcript available directly from YouTube, skipping audio extraction`);
    // Return a dummy audioId since we don't need to extract audio
    const audioId = `transcript-${videoId}-${Date.now()}`;
    return {
      audioId,
      audioPath: '', // No audio file needed - empty string indicates direct transcript
      videoTitle: undefined,
      videoDuration: undefined,
    };
  }

  // Primary method: audio extraction (more reliable on cloud providers)
  logger.info(`[AudioExtraction] Extracting audio from YouTube (primary method)`);
  
  const videoUrl = youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`;

  // Get audio file path from AudioFileService
  const audioPath = audioFileService.getAudioFilePath(videoId, 'mp3');
  const audioId = path.basename(audioPath, '.mp3'); // videoId-timestamp

  // Create temp directory for cookies if needed
  const tempDir = path.join(process.cwd(), 'temp', `extract-${videoId}-${Date.now()}`);
  let cookiesPath: string | null = null;

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Save cookies to file if provided
    if (cookiesText) {
      cookiesPath = path.join(tempDir, 'cookies.txt');
      await fs.writeFile(cookiesPath, cookiesText, 'utf-8');
      logger.info(`[AudioExtraction] ✅ Using provided cookies for authentication`);
    }

    // Find venv with yt-dlp (same logic as transcribeYouTubeVideo)
    const cwd = process.cwd();
    const possibleVenvPaths = [
      path.join(cwd, 'venv-whisper'),
      path.join('/app', 'venv-whisper'),
      path.join('/opt/render/project/src', 'venv-whisper'),
    ];

    let pythonCommand: string | null = null;
    let foundVenvPath: string | null = null;

    for (const venvPath of possibleVenvPaths) {
      const venvPython = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python3');

      try {
        const stats = await fs.stat(venvPython);
        if (stats.isFile()) {
          const checkYtdlp = await execAsync(`"${venvPython}" -c "import yt_dlp; print('OK')"`, {
            timeout: 5000
          });
          if (checkYtdlp.stdout.includes('OK')) {
            pythonCommand = venvPython;
            foundVenvPath = venvPath;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!pythonCommand) {
      throw new Error('yt-dlp is not available. venv-whisper with yt-dlp should be installed during Docker build.');
    }

    // Try to get WebShare proxy
    const webshareProxy = await getWebShareProxy();

    // Extract audio using yt-dlp with bestaudio format
    const strategies = [
      {
        name: 'Android client (mobile)',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        extractorArgs: 'youtube:player_client=android',
      },
      {
        name: 'iOS client (mobile)',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        extractorArgs: 'youtube:player_client=ios',
      },
      {
        name: 'Web client (desktop)',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extractorArgs: 'youtube:player_client=web',
      },
    ];

    let downloadSucceeded = false;
    let lastError: any = null;

    for (const strategy of strategies) {
      try {
        let command = `"${pythonCommand}" -m yt_dlp --user-agent "${strategy.userAgent}" --extractor-args "${strategy.extractorArgs}"`;
        if (cookiesPath) {
          command += ` --cookies "${cookiesPath}"`;
        }
        // Add WebShare proxy if available
        if (webshareProxy) {
          command += ` --proxy "${webshareProxy}"`;
          logger.info(`[AudioExtraction] Using WebShare proxy with ${strategy.name}`);
        }
        // Extract best audio and convert to MP3
        command += ` -f "bestaudio/best" --no-playlist --no-warnings --no-check-certificate`;
        command += ` -x --audio-format mp3 --audio-quality 192`;
        command += ` -o "${audioPath}" "${videoUrl}"`;

        logger.info(`[AudioExtraction] Trying strategy: ${strategy.name}`);
        
        await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 300000, // 5 minute timeout
          cwd: foundVenvPath ? path.dirname(foundVenvPath) : undefined
        });

        // Check if audio file was created
        if (await audioFileService.fileExists(audioPath)) {
          // Validate file size
          const validation = await audioFileService.validateFileSize(audioPath);
          if (!validation.valid) {
            throw new Error(validation.error);
          }

          downloadSucceeded = true;
          logger.info(`[AudioExtraction] ✅ Audio extracted successfully with ${strategy.name}`);
          break;
        }
      } catch (strategyError: any) {
        lastError = strategyError;
        const errorStderr = strategyError?.stderr || '';
        if (errorStderr.includes('bot')) {
          logger.warn(`[AudioExtraction] Strategy ${strategy.name} blocked by bot detection, trying next...`);
          continue;
        }
        continue;
      }
    }

    if (!downloadSucceeded) {
      const cookieHint = cookiesPath
        ? 'Cookies were provided but still blocked. The cookies may be expired or invalid.'
        : 'No cookies were provided. Consider uploading cookies.txt for better success rate.';
      throw new Error(`YouTube is blocking automated access after trying ${strategies.length} different methods. ${cookieHint}`);
    }

    // Get video info (title, duration)
    let videoTitle: string | undefined;
    let videoDuration: number | undefined;

    try {
      const infoCommand = `"${pythonCommand}" -m yt_dlp --get-title --get-duration "${videoUrl}" 2>/dev/null`;
      const infoOutput = await execAsync(infoCommand);
      const lines = infoOutput.stdout.trim().split('\n');
      if (lines.length >= 1 && lines[0]) videoTitle = lines[0];
      if (lines.length >= 2 && lines[1]) {
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
    }

    // Cleanup temp directory
    try {
      if (cookiesPath) {
        await fs.unlink(cookiesPath).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    return { audioId, audioPath, videoTitle, videoDuration };
  } catch (error) {
    // Cleanup on error
    try {
      if (cookiesPath) {
        await fs.unlink(cookiesPath).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});
      if (await audioFileService.fileExists(audioPath)) {
        await audioFileService.deleteFile(audioPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// Configure multer for audio file uploads (disk storage to save memory)
// Using disk storage instead of memory to avoid OOM errors on Render free tier (512MB limit)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Store temporarily in audio directory
      cb(null, audioFileService.getAudioDirectory());
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const audioId = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const originalExt = path.extname(file.originalname).toLowerCase();
      const extension = originalExt || '.mp3';
      cb(null, `${audioId}${extension}`);
    },
  }),
  limits: {
    fileSize: audioFileService['maxFileSizeMB'] * 1024 * 1024, // 500MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'
    ];
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExt = allowedExtensions.includes(fileExtension);
    
    if (isValidMime || isValidExt) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

/**
 * POST /api/video/upload-audio
 * Upload audio file for transcription using multipart/form-data
 * Much more memory-efficient than base64 JSON
 */
router.post('/upload-audio', authenticateUser, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required. Please upload a file using multipart/form-data with field name "audio".',
      });
    }

    // With disk storage, file.path contains the full path where multer saved it
    // Extract audioId from filename (format: upload-timestamp-random.ext)
    const filenameWithoutExt = path.parse(file.filename).name;
    const audioId = filenameWithoutExt;
    const audioPath = file.path; // Multer already saved it to disk

    // Validate file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > audioFileService['maxFileSizeMB']) {
      // Clean up the file if it's too large
      await fs.unlink(audioPath).catch(() => {});
      return res.status(400).json({
        success: false,
        error: `File size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${audioFileService['maxFileSizeMB']}MB)`,
      });
    }

    logger.info(`[AudioUpload] ✅ Audio file uploaded: ${audioId} (${sizeMB.toFixed(2)}MB, ${file.originalname}) - saved to disk: ${audioPath}`);

    res.json({
      success: true,
      audioId,
      audioPath,
      sizeMB: sizeMB.toFixed(2),
      filename: file.originalname,
      message: 'Audio file uploaded successfully',
    });
  } catch (error: any) {
    logger.error(`[AudioUpload] Error: ${error.message}`, error);
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum size: ${audioFileService['maxFileSizeMB']}MB`,
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${error.message}`,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload audio file',
    });
  }
});

/**
 * POST /api/video/extract-audio
 * Extract audio from YouTube video (DEPRECATED - use upload-audio instead)
 * Kept for backward compatibility
 */
router.post('/extract-audio', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { youtubeUrl, videoId, cookies, language } = req.body;

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

    logger.info(`[AudioExtraction] Starting audio extraction for video: ${finalVideoId}${cookies ? ' (with cookies)' : ''}${language ? ` (language: ${language})` : ''}`);

    try {
      const { audioId, audioPath, videoTitle, videoDuration } = await extractAudioFromYouTube(
        youtubeUrl || '',
        finalVideoId,
        cookies,
        language || 'auto'
      );

      // Check if we got transcript directly (no audio extraction needed)
      if (!audioPath) {
        // Transcript was retrieved directly, get it again for response
        const transcript = await getYouTubeTranscript(finalVideoId, language || 'auto');
        return res.json({
          success: true,
          audioId,
          audioPath: null,
          transcript, // Include transcript in response
          videoTitle,
          videoDuration,
          message: `Transcript retrieved directly from YouTube${videoTitle ? `: ${videoTitle}` : ''}`,
          method: 'direct_transcript',
        });
      }

      res.json({
        success: true,
        audioId,
        audioPath,
        videoTitle,
        videoDuration,
        message: `Audio extracted successfully${videoTitle ? `: ${videoTitle}` : ''}`,
        method: 'audio_extraction',
      });
    } catch (extractionError: any) {
      // Handle specific error types with appropriate status codes
      const errorMessage = extractionError.message || 'Failed to extract audio';
      
      // Check if it's a YouTube blocking error (user-friendly, not a server error)
      if (errorMessage.includes('blocking automated access') || 
          errorMessage.includes('bot detection') ||
          errorMessage.includes('Sign in to confirm')) {
        logger.warn(`[AudioExtraction] YouTube blocking detected: ${errorMessage}`);
        return res.status(400).json({
          success: false,
          error: errorMessage,
          suggestion: 'Try uploading cookies.txt from your browser, or try a different video. Some videos may require manual verification.',
          requiresCookies: !cookies,
        });
      }
      
      // Check if transcript not found (also user-friendly)
      if (errorMessage.includes('No transcript found') || 
          errorMessage.includes('Transcripts are disabled')) {
        logger.info(`[AudioExtraction] Transcript not available: ${errorMessage}`);
        return res.status(400).json({
          success: false,
          error: errorMessage,
          suggestion: 'This video may not have transcripts available. Try extracting audio instead, or use a different video.',
          canExtractAudio: true,
        });
      }
      
      // Other errors (actual server errors)
      logger.error(`[AudioExtraction] Error: ${errorMessage}`, extractionError);
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error: any) {
    logger.error(`[AudioExtraction] Unexpected error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract audio',
    });
  }
});

/**
 * POST /api/video/transcribe
 * Transcribe audio file and convert to voice actor script
 * Accepts either audioId (from extract-audio) or youtubeUrl/videoId (legacy support)
 */
router.post('/transcribe', authenticateUser, async (req: Request, res: Response) => {
  // Helper to ensure CORS headers are set
  const setCORSHeaders = () => {
    const origin = req.headers.origin;
    if (origin) {
      if (origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('onrender.com')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
  };

  try {
    const { audioId, audioPath, youtubeUrl, videoId, cookies, language, scriptProvider = 'haiku' } = req.body;

    // Create a unique key for deduplication (use audioId if available, otherwise audioPath)
    const dedupeKey = audioId || audioPath || (videoId ? `video-${videoId}` : null);
    
    // Check if this transcription is already in progress
    if (dedupeKey && inFlightTranscriptions.has(dedupeKey)) {
      logger.warn(`[VideoTranscription] Transcription already in progress for: ${dedupeKey}`);
      setCORSHeaders();
      return res.status(409).json({
        success: false,
        error: 'Transcription already in progress for this audio file. Please wait for the current request to complete.',
        audioId: audioId || undefined,
        audioPath: audioPath || undefined,
        code: 'TRANSCRIPTION_IN_PROGRESS',
      });
    }

    let finalAudioPath: string | null = null;
    let videoTitle: string | undefined;
    let videoDuration: number | undefined;

    // New flow: Use audioId or audioPath
    if (audioId || audioPath) {
      logger.info(`[VideoTranscription] Looking for audio file - audioId: ${audioId}, audioPath: ${audioPath}`);
      
      // Helper function to normalize and resolve path
      const normalizePath = (filePath: string): string => {
        try {
          // Resolve relative paths and normalize separators
          const resolved = path.isAbsolute(filePath) 
            ? path.normalize(filePath)
            : path.resolve(filePath);
          return resolved;
        } catch {
          return filePath;
        }
      };
      
      // Try multiple path resolution strategies
      const pathCandidates: string[] = [];
      
      if (audioPath) {
        // Add normalized absolute path
        pathCandidates.push(normalizePath(audioPath));
        
        // If path is absolute but doesn't work, try relative from cwd
        if (path.isAbsolute(audioPath)) {
          const relativeFromAudioDir = path.relative(audioFileService.getAudioDirectory(), audioPath);
          if (relativeFromAudioDir && !relativeFromAudioDir.startsWith('..')) {
            pathCandidates.push(path.join(audioFileService.getAudioDirectory(), relativeFromAudioDir));
          }
        }
        
        // Also try as-is (in case normalization broke something)
        pathCandidates.push(audioPath);
      }
      
      // Try each candidate path
      for (const candidatePath of pathCandidates) {
        if (await audioFileService.fileExists(candidatePath)) {
          finalAudioPath = candidatePath;
          logger.info(`[VideoTranscription] ✅ Found audio file at: ${candidatePath}`);
          break;
        }
      }
      
      // If audioPath didn't work or wasn't provided, try to find by audioId
      if (!finalAudioPath && audioId) {
        logger.info(`[VideoTranscription] Searching for audio file by ID: ${audioId}`);
        
        // Try to find audio file by ID
        const foundPath = await audioFileService.getAudioFileById(audioId);
        if (foundPath && await audioFileService.fileExists(foundPath)) {
          finalAudioPath = foundPath;
          logger.info(`[VideoTranscription] ✅ Found audio file by ID: ${foundPath}`);
        } else {
          // Try to construct path from audioId (format: videoId-timestamp or upload-timestamp-random)
          logger.info(`[VideoTranscription] Trying to construct path from audioId: ${audioId}`);
          const extensions = ['mp3', 'wav', 'ogg', 'webm', 'm4a'];
          for (const ext of extensions) {
            const constructedPath = path.join(audioFileService.getAudioDirectory(), `${audioId}.${ext}`);
            if (await audioFileService.fileExists(constructedPath)) {
              finalAudioPath = constructedPath;
              logger.info(`[VideoTranscription] ✅ Found audio file by constructed path: ${constructedPath}`);
              break;
            }
          }
        }
      }

      if (!finalAudioPath || !(await audioFileService.fileExists(finalAudioPath))) {
        // Log all files in audio directory for debugging
        try {
          const audioDir = audioFileService.getAudioDirectory();
          const files = await fs.readdir(audioDir);
          
          // Also check if the file exists by absolute path using fs directly
          let directPathCheck = false;
          if (audioPath) {
            try {
              const normalized = normalizePath(audioPath);
              await fs.access(normalized);
              directPathCheck = true;
              logger.info(`[VideoTranscription] File exists at ${normalized} but AudioFileService didn't find it`);
              finalAudioPath = normalized;
            } catch {
              // File doesn't exist at that path
            }
          }
          
          if (!directPathCheck) {
            logger.error(`[VideoTranscription] ❌ Audio file not found. AudioId: ${audioId}, AudioPath: ${audioPath}`);
            logger.error(`[VideoTranscription] Tried paths: ${pathCandidates.join(', ')}`);
            logger.error(`[VideoTranscription] Available files in ${audioDir}: ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`);
            
            setCORSHeaders();
            return res.status(404).json({
              success: false,
              error: `Audio file not found. AudioId: ${audioId || 'none'}, AudioPath: ${audioPath || 'none'}. Please upload audio again.`,
            });
          }
        } catch (dirError) {
          logger.error(`[VideoTranscription] Failed to list audio directory: ${dirError}`);
          
          // Last attempt: try direct file access if audioPath was provided
          if (audioPath && !finalAudioPath) {
            try {
              const normalized = normalizePath(audioPath);
              await fs.access(normalized);
              finalAudioPath = normalized;
              logger.info(`[VideoTranscription] ✅ Found audio file via direct access: ${normalized}`);
            } catch {
              setCORSHeaders();
              return res.status(404).json({
                success: false,
                error: `Audio file not found. AudioId: ${audioId || 'none'}, AudioPath: ${audioPath || 'none'}. Please upload audio again.`,
              });
            }
          } else {
            setCORSHeaders();
            return res.status(404).json({
              success: false,
              error: `Audio file not found. AudioId: ${audioId || 'none'}, AudioPath: ${audioPath || 'none'}. Please upload audio again.`,
            });
          }
        }
      }

      logger.info(`[VideoTranscription] Transcribing audio file: ${finalAudioPath}`);
      
      // Ensure finalAudioPath is set before transcribing
      if (!finalAudioPath) {
        setCORSHeaders();
        return res.status(404).json({
          success: false,
          error: 'Audio file path not found. Please upload audio again.',
        });
      }
    } 
    // Legacy flow: Extract and transcribe in one step
    else if (youtubeUrl || videoId) {
      const finalVideoId = videoId || (youtubeUrl ? youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] : null);

      if (!finalVideoId) {
        setCORSHeaders();
        return res.status(400).json({
          success: false,
          error: 'Invalid YouTube URL or video ID',
        });
      }

      // Use dedupe key for legacy flow too
      const legacyDedupeKey = `video-${finalVideoId}`;
      if (inFlightTranscriptions.has(legacyDedupeKey)) {
        logger.warn(`[VideoTranscription] Transcription already in progress for video: ${finalVideoId}`);
        setCORSHeaders();
        return res.status(409).json({
          success: false,
          error: 'Transcription already in progress for this video. Please wait for the current request to complete.',
          videoId: finalVideoId,
          code: 'TRANSCRIPTION_IN_PROGRESS',
        });
      }

      logger.info(`[VideoTranscription] Starting transcription for video: ${finalVideoId}${cookies ? ' (with cookies)' : ''}${language ? ` (language: ${language})` : ''} (legacy mode)`);

      // Create transcription promise and track it
      const transcriptionPromise = (async () => {
        // Use existing function for backward compatibility
        const result = await transcribeYouTubeVideo(finalVideoId, cookies, language || 'auto');
        const script = scriptProvider === 'openai' 
          ? await convertToScriptWithOpenAI(result.transcription, result.videoTitle)
          : await convertToScript(result.transcription, result.videoTitle);

        return {
          success: true,
          transcription: result.transcription,
          script,
          videoTitle: result.videoTitle,
          videoDuration: result.videoDuration,
          method: result.transcription ? 'direct_transcript' : 'audio_whisper',
        };
      })();

      // Track the promise
      inFlightTranscriptions.set(legacyDedupeKey, transcriptionPromise);

      try {
        const result = await transcriptionPromise;
        return res.json(result);
      } catch (transcriptionError: any) {
        logger.error(`[VideoTranscription] Legacy transcription error: ${transcriptionError.message}`, transcriptionError);
        setCORSHeaders();
        return res.status(500).json({
          success: false,
          error: transcriptionError.message || 'Failed to transcribe video',
        });
      } finally {
        // Clean up tracking when done (success or error)
        inFlightTranscriptions.delete(legacyDedupeKey);
      }
    } else {
      setCORSHeaders();
      return res.status(400).json({
        success: false,
        error: 'Either audioId/audioPath or youtubeUrl/videoId is required',
      });
    }

    // Transcribe audio file using Whisper
    if (!finalAudioPath) {
      setCORSHeaders();
      return res.status(404).json({
        success: false,
        error: 'Audio file path not found. Please upload audio again.',
      });
    }
    
    // Create transcription promise and track it
    const transcriptionPromise = (async () => {
      logger.info(`[VideoTranscription] Starting Whisper transcription...`);
      const transcriptionResult = await whisperService.transcribe(finalAudioPath!, {
        language: language || 'auto', // Auto-detect or use specified language
        task: 'transcribe',
        returnTimestamps: false
      });

      const transcription = transcriptionResult.text || 'No transcription available';
      logger.info(`[VideoTranscription] Transcription complete, length: ${transcription.length} characters`);

      // Convert to script
      logger.info(`[VideoTranscription] Converting transcription to script using ${scriptProvider}...`);
      const script = scriptProvider === 'openai' 
        ? await convertToScriptWithOpenAI(transcription, videoTitle)
        : await convertToScript(transcription, videoTitle);

      logger.info(`[VideoTranscription] Transcription and script generation complete`);

      return {
        success: true,
        transcription,
        script,
        videoTitle,
        videoDuration,
      };
    })();

    // Track the promise if we have a dedupe key
    if (dedupeKey) {
      inFlightTranscriptions.set(dedupeKey, transcriptionPromise);
    }

    try {
      const result = await transcriptionPromise;
      res.json(result);
    } catch (transcriptionError: any) {
      logger.error(`[VideoTranscription] Transcription error: ${transcriptionError.message}`, transcriptionError);
      res.status(500).json({
        success: false,
        error: transcriptionError.message || 'Failed to transcribe audio',
      });
    } finally {
      // Clean up tracking when done (success or error)
      if (dedupeKey) {
        inFlightTranscriptions.delete(dedupeKey);
      }
    }
  } catch (error: any) {
    logger.error(`[VideoTranscription] Error: ${error.message}`, error);
    setCORSHeaders();
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
    });
  }
});

export default router;

