import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  HelpCircle,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';

interface TranscriptionResult {
  transcription: string;
  script: string;
  videoTitle?: string;
  videoDuration?: number;
}

interface AudioExtractionResult {
  audioId: string;
  audioPath: string | null;
  videoTitle?: string;
  videoDuration?: number;
  transcript?: string; // Direct transcript if available
  method?: 'direct_transcript' | 'audio_extraction';
}

export default function VideoTranscriptionApp() {
  const [, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [extractedAudio, setExtractedAudio] = useState<AudioExtractionResult | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [openAIScript, setOpenAIScript] = useState<string | null>(null);
  const [isGeneratingOpenAIScript, setIsGeneratingOpenAIScript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
      const validExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an audio file (MP3, WAV, OGG, WebM, or M4A)',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (500MB)`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadAudio = async () => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select an audio file',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    setIsUploading(true);
    setError(null);
    setExtractedAudio(null);
    setProgress('Uploading audio file...');

    try {
      // Use FormData for efficient file upload (multipart/form-data)
      // This is much more memory-efficient than base64 JSON
      const formData = new FormData();
      formData.append('audio', selectedFile);

      // Get auth token for the request
      const token = sessionToken || localStorage.getItem('sessionToken');
      
      // Use getApiUrl helper to get correct URL (uses Vite proxy in dev, Render URL in prod)
      const apiUrl = getApiUrl('/api/video/upload-audio');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          // Don't set Content-Type - browser will set it with boundary for multipart/form-data
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include', // Important for CORS
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to upload audio (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        const extractionResult: AudioExtractionResult = {
          audioId: data.audioId,
          audioPath: data.audioPath || null,
          videoTitle: selectedFile.name,
          videoDuration: undefined,
          transcript: undefined,
          method: 'audio_extraction',
        };
        
        setExtractedAudio(extractionResult);
        setProgress('');
        
        toast({
          title: 'Audio Uploaded!',
          description: 'Audio file uploaded successfully. Click "Transcribe" to continue.',
        });
      } else {
        throw new Error(data.error || 'Failed to upload audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload audio');
      setProgress('');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to upload audio',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!extractedAudio) {
      toast({
        title: 'Error',
        description: 'Please extract audio first',
        variant: 'destructive',
      });
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscriptionResult(null);
    setProgress('Transcribing audio...');

    try {
      // If we have a direct transcript, send it to avoid re-fetching
      const requestBody: any = {
        audioId: extractedAudio.audioId,
        audioPath: extractedAudio.audioPath,
        scriptProvider: 'haiku', // Use Haiku by default
      };
      
      if (extractedAudio.transcript) {
        requestBody.transcript = extractedAudio.transcript;
        setProgress('Generating script from transcript...');
      } else {
        setProgress('Transcribing audio...');
      }

      const response = await apiFetch('/api/video/transcribe', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to transcribe audio (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTranscriptionResult({
          transcription: data.transcription || '',
          script: data.script || '',
          videoTitle: extractedAudio.videoTitle || data.videoTitle,
          videoDuration: extractedAudio.videoDuration || data.videoDuration,
        });
        setProgress('');
        toast({
          title: 'Success!',
          description: 'Audio transcribed and script generated successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to transcribe audio');
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
      setIsTranscribing(false);
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
                Audio Transcription to Script
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                Upload an audio file and convert it into a professional voice actor script for voiceover production.
                Perfect for content creators who need to add commentary voiceover to body cam footage, documentaries, or any video content.
              </p>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">💡 How to get audio from YouTube videos:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Use <strong>yt-dlp</strong> (command line): <code className="bg-background px-1 rounded">yt-dlp -x --audio-format mp3 VIDEO_URL</code></li>
                  <li>Use online tools like <strong>ytmp3.cc</strong> or <strong>y2mate.com</strong></li>
                  <li>Use browser extensions like <strong>Video DownloadHelper</strong></li>
                </ol>
              </div>
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
                Audio File (MP3, WAV, OGG, WebM, or M4A)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                    disabled={isUploading || isTranscribing}
                  />
                </div>
                <Button
                  onClick={handleUploadAudio}
                  disabled={isUploading || !selectedFile || isTranscribing}
                  className="min-w-[140px]"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Audio
                    </>
                  )}
                </Button>
              </div>
              {selectedFile && (
                <div className="mt-2 p-2 bg-muted rounded-md text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        setSelectedFile(null);
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      disabled={isUploading || isTranscribing}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {progress && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress}
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            {extractedAudio && !isTranscribing && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Audio extracted successfully
                    </span>
                  </div>
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Transcribe
                      </>
                    )}
                  </Button>
                </div>
                {extractedAudio.videoTitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {extractedAudio.videoTitle}
                    {extractedAudio.videoDuration && ` (${Math.round(extractedAudio.videoDuration / 60)} min)`}
                  </p>
                )}
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

            {/* Script with Tabs */}
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
                </div>
                <Tabs defaultValue="haiku" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="haiku">Claude Haiku</TabsTrigger>
                    <TabsTrigger value="openai">
                      OpenAI Mini
                      {!openAIScript && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateOpenAIScript();
                          }}
                          disabled={isGeneratingOpenAIScript}
                        >
                          {isGeneratingOpenAIScript ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Generate'
                          )}
                        </Button>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="haiku" className="mt-4">
                    <div className="flex items-center justify-end gap-2 mb-2">
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
                        onClick={() => handleDownload(transcriptionResult.script, 'voice-actor-script-haiku.txt')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    <Textarea
                      value={transcriptionResult.script}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </TabsContent>
                  <TabsContent value="openai" className="mt-4">
                    {openAIScript ? (
                      <>
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(openAIScript, 'script')}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(openAIScript, 'voice-actor-script-openai.txt')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <Textarea
                          value={openAIScript}
                          readOnly
                          className="min-h-[300px] font-mono text-sm"
                        />
                      </>
                    ) : (
                      <div className="min-h-[300px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                        <div className="text-center">
                          <p className="text-muted-foreground mb-4">No OpenAI Mini script generated yet</p>
                          <Button
                            onClick={handleGenerateOpenAIScript}
                            disabled={isGeneratingOpenAIScript}
                          >
                            {isGeneratingOpenAIScript ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate with OpenAI Mini
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </motion.div>
        )}

        {/* Use Case Example */}
        {!transcriptionResult && !isTranscribing && (
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

