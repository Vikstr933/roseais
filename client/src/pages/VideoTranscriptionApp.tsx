import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Video,
  Youtube,
  Loader2,
  Download,
  Copy,
  ArrowLeft,
  FileText,
  Mic,
  Sparkles,
  Brain,
} from 'lucide-react';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';

interface TranscriptionResult {
  transcription: string;
  script: string;
  videoTitle?: string;
  videoDuration?: number;
}

export default function VideoTranscriptionApp() {
  const [, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const handleTranscribe = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a YouTube URL',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid YouTube URL',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTranscriptionResult(null);

    try {
      const response = await apiFetch('/api/video/transcribe', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(sessionToken!),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          youtubeUrl,
          videoId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to transcribe video (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTranscriptionResult({
          transcription: data.transcription || '',
          script: data.script || '',
          videoTitle: data.videoTitle,
          videoDuration: data.videoDuration,
        });
        toast({
          title: 'Success!',
          description: 'Video transcribed and script generated successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to process video');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe video';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string, type: 'transcription' | 'script') => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${type === 'transcription' ? 'Transcription' : 'Script'} copied to clipboard`,
    });
  };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Downloaded!',
      description: `${filename} downloaded successfully`,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* OmniAssistant Branding Header */}
      <div className="w-full border-b border-purple-200/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 mt-20 pt-4">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">OmniAssistant</p>
              <p className="text-xs text-muted-foreground">Generated by OmniAssistant Platform</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/public-projects')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
              <Video className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Video Transcription to Script
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                Transcribe YouTube videos and convert them into professional voice actor scripts for voiceover production.
                Perfect for content creators who need to add commentary voiceover to body cam footage, documentaries, or any video content.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Mic className="h-3 w-3" />
                  <span>AI Transcription</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>Script Formatting</span>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Voice Actor Ready</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative bg-card rounded-lg border-2 border-transparent p-6 mb-6 overflow-hidden group"
          style={{
            background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #a855f7, #ec4899, #a855f7) border-box',
            border: '2px solid transparent',
          }}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300 pointer-events-none" />
          <div className="relative z-10">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                YouTube Video URL
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="pl-10"
                    disabled={isProcessing}
                  />
                </div>
                <Button
                  onClick={handleTranscribe}
                  disabled={isProcessing || !youtubeUrl.trim()}
                  className="min-w-[120px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Transcribe
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          </div>
        </motion.div>

        {/* Results Section */}
        {transcriptionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Transcription */}
            <div 
              className="relative bg-card rounded-lg border-2 border-transparent p-6 overflow-hidden group"
              style={{
                background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #a855f7, #ec4899, #a855f7) border-box',
                border: '2px solid transparent',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-purple-600" />
                    <h2 className="text-xl font-semibold">Transcription</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(transcriptionResult.transcription, 'transcription')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(transcriptionResult.transcription, 'transcription.txt')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={transcriptionResult.transcription}
                  readOnly
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </div>

            {/* Script */}
            <div 
              className="relative bg-card rounded-lg border-2 border-transparent p-6 overflow-hidden group"
              style={{
                background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #a855f7, #ec4899, #a855f7) border-box',
                border: '2px solid transparent',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <h2 className="text-xl font-semibold">Voice Actor Script</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(transcriptionResult.script, 'script')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(transcriptionResult.script, 'voice-actor-script.txt')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={transcriptionResult.script}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Use Case Example */}
        {!transcriptionResult && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border-2 border-purple-200/50 dark:border-purple-800/50 p-6 mt-6 overflow-hidden"
          >
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-500/20 rounded-md">
              <Brain className="h-3 w-3 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-400">OmniAssistant</span>
            </div>
            <div className="relative z-10">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Use Case Example
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                <strong>Scenario:</strong> You run a YouTube channel featuring police investigations with body cam footage. 
                You want to add professional commentary voiceover to explain what's happening.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">1.</span>
                  <span>Upload your body cam footage video to YouTube</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">2.</span>
                  <span>Paste the YouTube URL here and click "Transcribe"</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">3.</span>
                  <span>Get a professional script formatted for voice actors</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">4.</span>
                  <span>Use the script to record your commentary voiceover</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

