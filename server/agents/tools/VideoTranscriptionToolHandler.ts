/**
 * Video Transcription Tool Handler
 * 
 * Handles video transcription from YouTube URLs and converts to voice actor scripts
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';
import { SimpleLogger } from '../../utils/SimpleLogger';

const logger = new SimpleLogger('VideoTranscriptionToolHandler');

export class VideoTranscriptionToolHandler extends BaseToolHandler {
  constructor() {
    super('transcribe_video');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'transcribe_video',
      description: 'Transcribe YouTube videos and convert them into professional voice actor scripts. Use this when the user wants to transcribe a video, get a script for voiceover, or convert video content to text. Perfect for content creators who need to add commentary voiceover to videos, body cam footage, documentaries, or any video content.',
      parameters: {
        type: 'object',
        properties: {
          youtubeUrl: {
            type: 'string',
            description: 'The YouTube video URL to transcribe (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)'
          },
          videoId: {
            type: 'string',
            description: 'Optional: The YouTube video ID (extracted automatically from URL if not provided)'
          },
          convertToScript: {
            type: 'boolean',
            description: 'Whether to convert the transcription to a voice actor script (default: true)',
            default: true
          }
        },
        required: ['youtubeUrl']
      },
      execute: async (params: Record<string, any>) => {
        return await this.execute(params, context);
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    try {
      const { youtubeUrl, videoId, convertToScript = true } = params;

      if (!youtubeUrl) {
        return {
          success: false,
          error: 'YouTube URL is required',
          fallbackSuggestion: 'Please provide a YouTube URL to transcribe'
        };
      }

      logger.info(`[VideoTranscription] Starting transcription for: ${youtubeUrl}`);

      // Extract video ID from URL if not provided
      const finalVideoId = videoId || (youtubeUrl ? youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] : null);
      
      if (!finalVideoId) {
        return {
          success: false,
          error: 'Invalid YouTube URL or video ID',
          fallbackSuggestion: 'Please provide a valid YouTube URL'
        };
      }

      // Import and call transcription functions directly
      // We need to import the module to access the functions
      const videoModule = await import('../../routes/video');
      
      // Transcribe video
      const { transcription, videoTitle, videoDuration } = await videoModule.transcribeYouTubeVideo(finalVideoId);
      
      // Convert to script if requested
      let script = transcription;
      if (convertToScript !== false) {
        script = await videoModule.convertToScript(transcription, videoTitle);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to transcribe video (${response.status})`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Transcription failed',
          fallbackSuggestion: 'Please check the YouTube URL and try again'
        };
      }

      // Format the result for the user
      const result = {
        success: true,
        transcription: data.transcription,
        script: data.script,
        videoTitle: data.videoTitle,
        videoDuration: data.videoDuration,
        message: `Successfully transcribed video${data.videoTitle ? `: ${data.videoTitle}` : ''}${data.videoDuration ? ` (${Math.round(data.videoDuration / 60)} minutes)` : ''}`
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('[VideoTranscription] Error transcribing video', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transcribe video',
        retryable: this.isRetryableError(error)
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    // Check if the video transcription API is available
    try {
      const backendUrl = process.env.BACKEND_URL || 
                        process.env.RENDER_EXTERNAL_URL || 
                        'https://ai-library-backend.onrender.com';
      
      const response = await fetch(`${backendUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  getDescription(): string {
    return 'Transcribe YouTube videos and convert them into professional voice actor scripts for voiceover production';
  }

  getUsageExamples(): string[] {
    return [
      'Transcribe this YouTube video: https://www.youtube.com/watch?v=VIDEO_ID',
      'Convert this video to a voice actor script: https://youtu.be/VIDEO_ID',
      'I need a script for this body cam footage video: [YouTube URL]',
      'Can you transcribe this video and format it for voiceover?'
    ];
  }
}

