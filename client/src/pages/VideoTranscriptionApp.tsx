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

      // Validate file size (25MB max - OpenAI Whisper API limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (25MB)`,
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

  const handleGenerateOpenAIScript = async () => {
    if (!transcriptionResult?.transcription) {
      toast({
        title: 'Error',
        description: 'No transcription available. Please transcribe audio first.',
        variant: 'destructive',
      });
      return;
    }

    if (!extractedAudio) {
      toast({
        title: 'Error',
        description: 'No audio file available. Please upload and transcribe audio first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingOpenAIScript(true);
    setError(null);

    try {
      // Send the existing transcription along with audio info to generate script with OpenAI
      const requestBody: any = {
        audioId: extractedAudio.audioId,
        audioPath: extractedAudio.audioPath,
        transcript: transcriptionResult.transcription, // Send existing transcription
        scriptProvider: 'openai',
        videoTitle: transcriptionResult.videoTitle,
      };

      const response = await apiFetch('/api/video/transcribe', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to generate OpenAI script (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success && data.script) {
        setOpenAIScript(data.script);
        toast({
          title: 'Success!',
          description: 'OpenAI script generated successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to generate OpenAI script');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate OpenAI script';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingOpenAIScript(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-purple-50/30 to-background">
      {/* Premium Header */}
      <div className="w-full border-b border-purple-200/30 bg-white/80 backdrop-blur-xl mt-20 sticky top-20 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Audio Transcription Studio</p>
              <p className="text-xs text-muted-foreground">AI-Powered YouTube Commentary Script Generator</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/public-projects')}
            className="text-muted-foreground hover:text-foreground hover:bg-purple-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Premium Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Transform Audio Into Commentary Scripts
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional AI-powered transcription and script generation for YouTube creators. 
              Perfect for body cam footage, documentaries, and any video content that needs engaging commentary.
            </p>
          </div>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-full text-sm font-medium text-purple-700 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              OpenAI Whisper AI
            </div>
            <div className="px-4 py-2 bg-pink-50 border border-pink-200 rounded-full text-sm font-medium text-pink-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Smart Script Generation
            </div>
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Voice Actor Ready
            </div>
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-full text-sm font-medium text-green-700 flex items-center gap-2">
              <Video className="h-4 w-4" />
              Max 25MB Files
            </div>
          </div>
        </motion.div>

        {/* Premium Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated p-8 mb-8"
        >
          <div className="space-y-6">
            <div>
              <label className="text-base font-semibold mb-3 block text-foreground">
                Upload Audio File
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                Supported formats: MP3, WAV, OGG, WebM, M4A • Maximum size: 25MB
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                    onChange={handleFileSelect}
                    className="cursor-pointer h-12 text-sm"
                    disabled={isUploading || isTranscribing}
                  />
                </div>
                <Button
                  onClick={handleUploadAudio}
                  disabled={isUploading || !selectedFile || isTranscribing}
                  className="min-w-[160px] h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium shadow-lg shadow-purple-500/25"
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
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <FileText className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-purple-100"
                      onClick={() => {
                        setSelectedFile(null);
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      disabled={isUploading || isTranscribing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>

            {progress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3"
              >
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-blue-900">{progress}</p>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-50 border border-red-200 rounded-xl"
              >
                <p className="text-sm font-medium text-red-900">{error}</p>
              </motion.div>
            )}

            {extractedAudio && !isTranscribing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-900">Audio Ready for Transcription</p>
                      {extractedAudio.videoTitle && (
                        <p className="text-xs text-green-700 mt-0.5">
                          {extractedAudio.videoTitle}
                          {extractedAudio.videoDuration && ` • ${Math.round(extractedAudio.videoDuration / 60)} min`}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/25 px-6"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Transcription
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Premium Results Section */}
        {transcriptionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Transcription Card */}
            <div className="card-elevated p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 rounded-xl">
                    <Mic className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Raw Transcription</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct transcription from audio</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(transcriptionResult.transcription, 'transcription')}
                    className="hover:bg-purple-50"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(transcriptionResult.transcription, 'transcription.txt')}
                    className="hover:bg-purple-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
              <Textarea
                value={transcriptionResult.transcription}
                readOnly
                className="min-h-[250px] font-mono text-sm bg-muted/50 border-muted"
              />
            </div>

            {/* Script Card with Tabs */}
            <div className="card-elevated p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-pink-100 rounded-xl">
                  <FileText className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Commentary Script</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">YouTube-ready commentary format</p>
                </div>
              </div>
              <Tabs defaultValue="haiku" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted p-1.5">
                  <TabsTrigger value="haiku" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Claude Haiku
                  </TabsTrigger>
                  <TabsTrigger value="openai" className="data-[state=active]:bg-white data-[state=active]:shadow-sm relative">
                    OpenAI Mini
                    {!openAIScript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 px-2 text-xs absolute right-2"
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
                <TabsContent value="haiku" className="space-y-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(transcriptionResult.script, 'script')}
                      className="hover:bg-purple-50"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(transcriptionResult.script, 'commentary-script-haiku.txt')}
                      className="hover:bg-purple-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  <Textarea
                    value={transcriptionResult.script}
                    readOnly
                    className="min-h-[400px] font-mono text-sm bg-muted/50 border-muted leading-relaxed"
                  />
                </TabsContent>
                <TabsContent value="openai" className="space-y-4">
                  {openAIScript ? (
                    <>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(openAIScript, 'script')}
                          className="hover:bg-purple-50"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(openAIScript, 'commentary-script-openai.txt')}
                          className="hover:bg-purple-50"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                      <Textarea
                        value={openAIScript}
                        readOnly
                        className="min-h-[400px] font-mono text-sm bg-muted/50 border-muted leading-relaxed"
                      />
                    </>
                  ) : (
                    <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed border-muted rounded-xl bg-muted/30">
                      <div className="text-center max-w-md px-6">
                        <div className="mb-4 flex justify-center">
                          <div className="p-4 bg-purple-100 rounded-full">
                            <Sparkles className="h-8 w-8 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-base font-medium text-foreground mb-2">Generate OpenAI Script</p>
                        <p className="text-sm text-muted-foreground mb-6">
                          Create an alternative script version using OpenAI Mini for comparison
                        </p>
                        <Button
                          onClick={handleGenerateOpenAIScript}
                          disabled={isGeneratingOpenAIScript}
                          size="lg"
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/25"
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
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </motion.div>
        )}

      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

