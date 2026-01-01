import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Loader2,
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Target,
  BarChart3,
  FileCheck,
  Brain,
  Sparkles,
  X,
  FileCode,
  Wand2,
  Edit,
  Save,
  XCircle,
  Search,
  MapPin,
  FileText as FileTextIcon,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';
import { Input } from '@/components/ui/input';

interface ResumeAnalysis {
  id: number;
  overallScore: number;
  atsScore: number;
  contentScore: number;
  completenessScore: number;
  keywordScore: number;
  improvements: Array<{
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

interface Resume {
  id: number;
  filename: string;
  fileType: string;
  createdAt: string;
  rawText?: string;
  parsedData?: any;
}

interface AdaptedResume {
  id: number;
  filename: string;
  rawText: string;
  adaptedForJob: {
    jobId: string;
    jobTitle: string;
    company?: string;
  };
  originalResumeId: number;
  improvements?: string[];
  adaptationNotes?: string;
}

interface JobMatch {
  jobTitle: string;
  company: string;
  location?: string;
  matchPercentage: number;
  tier?: 1 | 2 | 3; // Tier classification
  jobUrl?: string;
  applicationEmail?: string;
  applicationUrl?: string;
  applicationMethod?: string;
  matchedSkills: string[];
  missingSkills: string[];
  jobId?: string; // For adaptation endpoint
  jobDescription?: string; // For adaptation
}

interface ApplicationData {
  coverLetter: string;
  fullApplication: {
    coverLetter: string;
    resumeText: string;
    combinedText: string;
  };
}

export default function ResumeAnalysisApp() {
  const [, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedResume, setUploadedResume] = useState<Resume | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [isAdapting, setIsAdapting] = useState<Record<string, boolean>>({});
  const [editingResume, setEditingResume] = useState<boolean>(false);
  const [editedResumeText, setEditedResumeText] = useState<string>('');
  const [adaptedResumes, setAdaptedResumes] = useState<AdaptedResume[]>([]);
  const [viewingAdaptedResume, setViewingAdaptedResume] = useState<AdaptedResume | null>(null);
  const [searchKeywords, setSearchKeywords] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [isSearchingJobs, setIsSearchingJobs] = useState<boolean>(false);
  const [generatingApplication, setGeneratingApplication] = useState<Record<string, boolean>>({});
  const [applicationData, setApplicationData] = useState<Record<string, ApplicationData>>({});
  const [viewingApplication, setViewingApplication] = useState<{ jobMatch: JobMatch; data: ApplicationData } | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [hasAutoSearched, setHasAutoSearched] = useState<boolean>(false);
  const [applyingImprovement, setApplyingImprovement] = useState<Record<number, boolean>>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - PDF, DOCX, or TEX
      const validExtensions = ['.pdf', '.docx', '.tex'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF, DOCX, or TEX file',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (5MB)`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      setError(null);
      setUploadedResume(null);
      setAnalysis(null);
      setJobMatches([]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validExtensions = ['.pdf', '.docx', '.tex'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (validExtensions.includes(fileExtension)) {
        setSelectedFile(file);
        setError(null);
        setUploadedResume(null);
        setAnalysis(null);
        setJobMatches([]);
      } else {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF, DOCX, or TEX file',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a file',
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
    setProgress('Uploading resume...');

    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);

      const token = sessionToken || localStorage.getItem('sessionToken');
      const apiUrl = getApiUrl('/api/resumes/upload');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to upload resume (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.resume) {
        setUploadedResume(data.resume);
        setProgress('');
        toast({
          title: 'Resume Uploaded!',
          description: 'Your resume has been uploaded successfully. Click "Analyze Resume" to get insights.',
        });
      } else {
        throw new Error(data.error || 'Failed to upload resume');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload resume';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedResume) {
      toast({
        title: 'Error',
        description: 'Please upload a resume first',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress('Analyzing resume...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to analyze resume (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setProgress('');
        setHasAutoSearched(false); // Reset auto-search flag
        toast({
          title: 'Analysis Complete!',
          description: `Your resume scored ${data.analysis.overallScore}/100. Söker automatiskt efter matchande jobb...`,
        });
        // Automatically search for jobs after analysis
        // Use setTimeout to ensure state is updated
        setTimeout(() => {
          handleFindJobs(true); // Pass true to indicate auto-search
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to analyze resume');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze resume';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFindJobs = async (isAutoSearch: boolean = false) => {
    if (!uploadedResume) return;

    // Don't auto-search if already searched
    if (isAutoSearch && hasAutoSearched) return;

    setIsSearchingJobs(true);
    setProgress('Söker matchande jobb baserat på ditt CV...');

    try {
      // Build query parameters
      // Only use keywords/location if explicitly provided (not in auto-search)
      const params = new URLSearchParams();
      if (!isAutoSearch && searchKeywords.trim()) {
        params.append('keywords', searchKeywords.trim());
      }
      if (!isAutoSearch && searchLocation.trim()) {
        params.append('location', searchLocation.trim());
      }

      const queryString = params.toString();
      const url = `/api/resumes/${uploadedResume.id}/job-matches${queryString ? `?${queryString}` : ''}`;

      const response = await apiFetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to find job matches');
      }

      const data = await response.json();

      if (data.matches) {
        setJobMatches(data.matches);
        setHasAutoSearched(isAutoSearch);
        setProgress('');
        if (!isAutoSearch) {
          toast({
            title: 'Jobb Hittade!',
            description: `Hittade ${data.matches.length} matchande jobbannonser`,
          });
        }
      }
    } catch (err) {
      console.error('Failed to find jobs:', err);
      setProgress('');
      if (!isAutoSearch) {
        toast({
          title: 'Fel',
          description: 'Kunde inte söka jobb. Försök igen.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSearchingJobs(false);
    }
  };

  const handleAdaptResume = async (jobMatch: JobMatch) => {
    if (!uploadedResume || !jobMatch.jobId) return;

    // Prevent multiple simultaneous adaptation requests
    const isCurrentlyAdapting = Object.values(isAdapting).some(v => v === true);
    if (isCurrentlyAdapting) {
      toast({
        title: 'Anpassning pågår redan',
        description: 'Vänligen vänta tills den nuvarande anpassningen är klar.',
        variant: 'destructive',
      });
      return;
    }

    setIsAdapting(prev => ({ ...prev, [jobMatch.jobId!]: true }));
    setProgress('Anpassar CV till jobbet... Detta kan ta upp till en minut...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/adapt/${jobMatch.jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobMatch.jobTitle,
          jobDescription: jobMatch.jobDescription || '',
          requiredSkills: jobMatch.matchedSkills.concat(jobMatch.missingSkills),
          missingSkills: jobMatch.missingSkills,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to adapt resume');
      }

      const data = await response.json();

      if (data.success && data.adaptedResume) {
        // Add the adapted resume to the list
        const newAdaptedResume: AdaptedResume = {
          id: data.adaptedResume.id,
          filename: data.adaptedResume.filename,
          rawText: data.adaptedResume.rawText,
          adaptedForJob: data.adaptedResume.adaptedForJob,
          originalResumeId: data.adaptedResume.originalResumeId,
          improvements: data.adaptedResume.improvements,
          adaptationNotes: data.adaptedResume.adaptationNotes,
        };

        setAdaptedResumes(prev => {
          // Remove any existing adaptation for the same job
          const filtered = prev.filter(a => a.adaptedForJob.jobId !== jobMatch.jobId);
          return [...filtered, newAdaptedResume];
        });

        setProgress('');
        setViewingAdaptedResume(newAdaptedResume);
        
        toast({
          title: 'CV Anpassat!',
          description: `Ditt CV har anpassats till ${jobMatch.jobTitle}. Du kan se den anpassade versionen nedan.`,
        });
      }
    } catch (err) {
      // Handle abort errors gracefully
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Anpassningen avbröts. Försök igen.');
        setProgress('');
        toast({
          title: 'Anpassning avbruten',
          description: 'Requesten tog för lång tid. Försök igen eller kontakta support om problemet kvarstår.',
          variant: 'destructive',
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to adapt resume';
        setError(errorMessage);
        setProgress('');
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsAdapting(prev => ({ ...prev, [jobMatch.jobId!]: false }));
    }
  };

  const handleEditResume = () => {
    if (!uploadedResume) return;
    
    // Fetch current resume text
    apiFetch(`/api/resumes/${uploadedResume.id}`)
      .then(response => response.json())
      .then(data => {
        if (data.resume && data.resume.rawText) {
          setEditedResumeText(data.resume.rawText);
          setEditingResume(true);
        }
      })
      .catch(err => {
        console.error('Failed to fetch resume:', err);
        toast({
          title: 'Error',
          description: 'Failed to load resume for editing',
          variant: 'destructive',
        });
      });
  };

  const handleSaveResume = async () => {
    if (!uploadedResume) return;

    setProgress('Sparar ändringar...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: editedResumeText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save resume');
      }

      setEditingResume(false);
      setProgress('');
      toast({
        title: 'Sparat!',
        description: 'Ditt CV har uppdaterats',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save resume';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingResume(false);
    setEditedResumeText('');
  };

  const handleApplyImprovement = async (improvement: { type: string; title: string; description: string }, index: number) => {
    if (!uploadedResume) return;

    setApplyingImprovement(prev => ({ ...prev, [index]: true }));
    setProgress('Applicerar förbättring...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/apply-improvement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          improvementType: improvement.type,
          improvementDescription: improvement.description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to apply improvement');
      }

      const data = await response.json();

      if (data.success && data.resume) {
        // Update the resume in state
        setUploadedResume(prev => prev ? { ...prev, rawText: data.resume.rawText, parsedData: data.resume.parsedData } : null);
        
        // Re-analyze to get updated scores
        setProgress('Analyserar uppdaterat CV...');
        await handleAnalyze();

        toast({
          title: 'Förbättring Applicerad!',
          description: improvement.title + ' har applicerats på ditt CV.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply improvement';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setApplyingImprovement(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleGenerateApplication = async (jobMatch: JobMatch) => {
    if (!uploadedResume || !jobMatch.jobId) return;

    setGeneratingApplication(prev => ({ ...prev, [jobMatch.jobId!]: true }));
    setProgress('Genererar personligt brev och ansökan...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/generate-application/${jobMatch.jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobMatch.jobTitle,
          jobDescription: jobMatch.jobDescription || '',
          company: jobMatch.company,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate application');
      }

      const data = await response.json();

      if (data.success && data.application) {
        setApplicationData(prev => ({
          ...prev,
          [jobMatch.jobId!]: data.application,
        }));
        setViewingApplication({
          jobMatch,
          data: data.application,
        });
        setProgress('');
        toast({
          title: 'Ansökan Genererad!',
          description: 'Personligt brev och komplett ansökan är klar.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate application';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGeneratingApplication(prev => ({ ...prev, [jobMatch.jobId!]: false }));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTierInfo = (tier?: 1 | 2 | 3) => {
    switch (tier) {
      case 1:
        return {
          label: 'Tier 1: Stark Matchning',
          description: 'Rekommenderas att söka direkt',
          color: 'bg-green-100 text-green-800 border-green-300',
          badgeColor: 'bg-green-600',
        };
      case 2:
        return {
          label: 'Tier 2: Delvis Matchning',
          description: 'Kan bli match med AI-anpassning av CV',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          badgeColor: 'bg-blue-600',
        };
      case 3:
        return {
          label: 'Tier 3: Potentiell Matchning',
          description: 'Värda att utforska eller anpassa CV för',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          badgeColor: 'bg-purple-600',
        };
      default:
        return {
          label: 'Okänd Tier',
          description: '',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          badgeColor: 'bg-gray-600',
        };
    }
  };

  const groupJobsByTier = (jobs: JobMatch[]): { tier: 1 | 2 | 3; jobs: JobMatch[] }[] => {
    const tier1 = jobs.filter(j => j.tier === 1);
    const tier2 = jobs.filter(j => j.tier === 2);
    const tier3 = jobs.filter(j => j.tier === 3);
    
    const grouped: { tier: 1 | 2 | 3; jobs: JobMatch[] }[] = [];
    if (tier1.length > 0) grouped.push({ tier: 1, jobs: tier1 });
    if (tier2.length > 0) grouped.push({ tier: 2, jobs: tier2 });
    if (tier3.length > 0) grouped.push({ tier: 3, jobs: tier3 });
    
    return grouped;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => setLocation('/public-projects')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">CV Analys & Jobb-matchning</h1>
                <Badge className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-700">
                  <Brain className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Analysera ditt CV med AI, få detaljerad feedback och hitta matchade jobb på svenska marknaden.
                Stöder PDF, DOCX och LaTeX-filer.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ladda upp CV</CardTitle>
            <CardDescription>
              Stödjer PDF, DOCX och LaTeX (.tex) filer. Max 5MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadedResume(null);
                        setAnalysis(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {!uploadedResume && (
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Resume
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium mb-2">Drag & drop your resume here</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.docx,.tex"
                      onChange={handleFileSelect}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      Select File
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <FileCode className="h-3 w-3" />
                    <span>Supports: PDF, DOCX, LaTeX</span>
                  </div>
                </div>
              )}
            </div>

            {progress && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">{progress}</p>
                <Progress value={isUploading || isAnalyzing ? 50 : 100} />
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Section */}
        {uploadedResume && !analysis && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium mb-1">Resume Ready for Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    {uploadedResume.filename}
                  </p>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Resume
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resume Editing */}
        {uploadedResume && editingResume && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Redigera CV</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Avbryt
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveResume}
                    disabled={!editedResumeText.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Spara
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Redigera CV-texten direkt. Ändringar sparas när du klickar på "Spara".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={editedResumeText}
                onChange={(e) => setEditedResumeText(e.target.value)}
                className="w-full min-h-[400px] p-4 border rounded-lg font-mono text-sm resize-y"
                placeholder="Klistra in eller redigera CV-text här..."
              />
            </CardContent>
          </Card>
        )}

        {/* Analysis Results - Compact Layout */}
        {analysis && !editingResume && (
          <div className="space-y-4">
            {/* Scores and Improvements in Grid */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Left Column: Overall Score + Edit Button */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">CV Poäng</CardTitle>
                    {uploadedResume && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditResume}
                        className="h-7 px-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-2">
                    <div className={`relative w-32 h-32 rounded-full ${getScoreBgColor(analysis.overallScore)} flex items-center justify-center`}>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                          {analysis.overallScore}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">/100</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">ATS</span>
                        <span className={`text-xs font-semibold ${getScoreColor(analysis.atsScore)}`}>
                          {analysis.atsScore}
                        </span>
                      </div>
                      <Progress value={analysis.atsScore} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Innehåll</span>
                        <span className={`text-xs font-semibold ${getScoreColor(analysis.contentScore)}`}>
                          {analysis.contentScore}
                        </span>
                      </div>
                      <Progress value={analysis.contentScore} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Komplett</span>
                        <span className={`text-xs font-semibold ${getScoreColor(analysis.completenessScore)}`}>
                          {analysis.completenessScore}
                        </span>
                      </div>
                      <Progress value={analysis.completenessScore} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Nyckelord</span>
                        <span className={`text-xs font-semibold ${getScoreColor(analysis.keywordScore)}`}>
                          {analysis.keywordScore}
                        </span>
                      </div>
                      <Progress value={analysis.keywordScore} className="h-1.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Middle/Right Column: Improvements */}
              {analysis.improvements && analysis.improvements.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Förbättringsförslag</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {analysis.improvements.map((improvement, index) => (
                        <div
                          key={index}
                          className="p-2.5 border rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{improvement.title}</h4>
                                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getPriorityColor(improvement.priority)}`}>
                                  {improvement.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {improvement.description}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApplyImprovement(improvement, index)}
                              disabled={applyingImprovement[index] || !uploadedResume}
                              className="flex-shrink-0 h-7 px-2 text-xs"
                            >
                              {applyingImprovement[index] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Improvements */}
            {analysis.improvements && analysis.improvements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Förbättringsförslag</CardTitle>
                  <CardDescription>AI-genererade förslag för att förbättra ditt CV. Klicka på "Applicera" för att automatiskt implementera förbättringen.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.improvements.map((improvement, index) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{improvement.title}</h4>
                              <Badge variant="outline" className={getPriorityColor(improvement.priority)}>
                                {improvement.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {improvement.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApplyImprovement(improvement, index)}
                            disabled={applyingImprovement[index] || !uploadedResume}
                            className="flex-shrink-0"
                          >
                            {applyingImprovement[index] ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Applicerar...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                Applicera
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Matches - Compact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Matchande Jobb</CardTitle>
                    <CardDescription className="text-xs">Automatiskt matchade jobb baserat på ditt CV</CardDescription>
                  </div>
                  {jobMatches.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFindJobs(false)}
                      disabled={isSearchingJobs}
                      className="h-7 px-2"
                    >
                      {isSearchingJobs ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <BarChart3 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Search Form - only show when needed */}
                  {(jobMatches.length === 0 || showAdvancedSearch) && (
                  <div className="space-y-2 pb-3 border-b">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="text"
                        placeholder="Sökord..."
                        value={searchKeywords}
                        onChange={(e) => setSearchKeywords(e.target.value)}
                        className="h-8 text-xs"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleFindJobs(false);
                          }
                        }}
                      />
                      <Input
                        type="text"
                        placeholder="Plats..."
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        className="h-8 text-xs"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleFindJobs(false);
                          }
                        }}
                      />
                    </div>
                    {!hasAutoSearched && (
                      <Button
                        onClick={() => handleFindJobs(false)}
                        disabled={isSearchingJobs || !uploadedResume}
                        size="sm"
                        className="w-full h-7 text-xs"
                      >
                        {isSearchingJobs ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <>
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Sök Jobb
                          </>
                        )}
                      </Button>
                    )}
                    {jobMatches.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className="w-full h-6 text-xs text-muted-foreground"
                      >
                        {showAdvancedSearch ? 'Dölj avancerad sökning' : 'Visa avancerad sökning'}
                      </Button>
                    )}
                  </div>
                  )}

                  {isSearchingJobs && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                      <p className="text-xs">Söker matchande jobb...</p>
                    </div>
                  )}

                  {!isSearchingJobs && jobMatches.length === 0 && !hasAutoSearched && uploadedResume && (
                    <div className="text-center py-4 text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">
                        Analysera ditt CV för att automatiskt hitta matchande jobb.
                      </p>
                    </div>
                  )}

                  {/* Job Results */}
                  {jobMatches.length > 0 && (
                      <div className="space-y-2">
                        {/* Group jobs by tier */}
                        {groupJobsByTier(jobMatches).map(({ tier, jobs }) => {
                          const tierInfo = getTierInfo(tier);
                          return (
                            <div key={tier} className="space-y-2">
                              <div className={`p-2 rounded-md border ${tierInfo.color}`}>
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-sm">{tierInfo.label}</h3>
                                  <Badge className={`${tierInfo.badgeColor} text-xs px-2 py-0`}>
                                    {jobs.length}
                                  </Badge>
                                </div>
                              </div>
                              <div className="space-y-3 ml-2">
                                {jobs.map((match, index) => (
                                  <div
                                    key={index}
                                    className="p-4 border rounded-lg"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <h4 className="font-medium">{match.jobTitle}</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {match.company} {match.location && `• ${match.location}`}
                                        </p>
                                      </div>
                                      <Badge className={`${tier === 1 ? 'bg-green-100 text-green-700' : tier === 2 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {match.matchPercentage}% match
                                      </Badge>
                                    </div>
                        {match.matchedSkills.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1">Matched Skills:</p>
                            <div className="flex flex-wrap gap-1">
                              {match.matchedSkills.slice(0, 5).map((skill, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {match.jobUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(match.jobUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Visa Jobb
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAdaptResume(match)}
                            disabled={isAdapting[match.jobId || '']}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          >
                            {isAdapting[match.jobId || ''] ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Anpassar...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4 mr-2" />
                                Anpassa CV
                              </>
                            )}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleGenerateApplication(match)}
                            disabled={generatingApplication[match.jobId || ''] || !uploadedResume}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                          >
                            {generatingApplication[match.jobId || ''] ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Genererar...
                              </>
                            ) : (
                              <>
                                <FileTextIcon className="h-4 w-4 mr-2" />
                                Skapa Ansökan
                              </>
                            )}
                          </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Adapted Resumes - Compact */}
            {adaptedResumes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Anpassade CV-versioner</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {adaptedResumes.map((adapted) => {
                      const isViewing = viewingAdaptedResume?.id === adapted.id;
                      return (
                        <div
                          key={adapted.id}
                          className={`p-4 border rounded-lg ${isViewing ? 'border-primary bg-primary/5' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium">{adapted.adaptedForJob.jobTitle}</h4>
                              {adapted.adaptedForJob.company && (
                                <p className="text-sm text-muted-foreground">
                                  {adapted.adaptedForJob.company}
                                </p>
                              )}
                              {adapted.adaptationNotes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {adapted.adaptationNotes}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="bg-purple-100 text-purple-700">
                              Anpassad
                            </Badge>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant={isViewing ? "default" : "outline"}
                              size="sm"
                              onClick={() => setViewingAdaptedResume(isViewing ? null : adapted)}
                            >
                              {isViewing ? (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  Stäng
                                </>
                              ) : (
                                <>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Visa CV
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const blob = new Blob([adapted.rawText], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = adapted.filename;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Ladda ner
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Viewing Application */}
            {viewingApplication && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Ansökan för {viewingApplication.jobMatch.jobTitle}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingApplication(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    {viewingApplication.jobMatch.company}
                    {viewingApplication.jobMatch.applicationEmail && (
                      <span> • Email: {viewingApplication.jobMatch.applicationEmail}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Cover Letter Section */}
                    <div>
                      <h5 className="font-medium mb-2 text-sm">Personligt Brev</h5>
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <pre className="whitespace-pre-wrap font-mono text-sm">
                          {viewingApplication.data.coverLetter}
                        </pre>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingApplication.data.fullApplication.combinedText);
                          toast({
                            title: 'Kopierad!',
                            description: 'Hela ansökan har kopierats till urklipp',
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Kopiera Allt
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingApplication.data.coverLetter);
                          toast({
                            title: 'Kopierad!',
                            description: 'Personligt brev har kopierats till urklipp',
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Kopiera Personligt Brev
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const blob = new Blob([viewingApplication.data.fullApplication.combinedText], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Ansokan_${viewingApplication.jobMatch.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Ladda ner som Text
                      </Button>
                      {viewingApplication.jobMatch.applicationUrl && (
                        <Button
                          variant="default"
                          onClick={() => window.open(viewingApplication.jobMatch.applicationUrl, '_blank')}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Öppna Ansökningssida
                        </Button>
                      )}
                      {viewingApplication.jobMatch.applicationEmail && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const subject = encodeURIComponent(`Ansökan: ${viewingApplication.jobMatch.jobTitle}`);
                            const body = encodeURIComponent(viewingApplication.data.fullApplication.combinedText);
                            window.location.href = `mailto:${viewingApplication.jobMatch.applicationEmail}?subject=${subject}&body=${body}`;
                          }}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Öppna Email-klient
                        </Button>
                      )}
                    </div>

                    {/* Instructions */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Instruktioner:</strong> Kopiera ansökan eller öppna ansökningssidan. Klistra in personligt brev och bifoga ditt CV.
                        {viewingApplication.jobMatch.applicationEmail && ' Du kan också skicka via email med knappen ovan.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Viewing Adapted Resume */}
            {viewingAdaptedResume && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Anpassad CV för {viewingAdaptedResume.adaptedForJob.jobTitle}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingAdaptedResume(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    {viewingAdaptedResume.adaptedForJob.company && (
                      <span>Företag: {viewingAdaptedResume.adaptedForJob.company}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {viewingAdaptedResume.improvements && viewingAdaptedResume.improvements.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="font-medium mb-2 text-sm">Förbättringar som gjorts:</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {viewingAdaptedResume.improvements.map((improvement, idx) => (
                            <li key={idx}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {viewingAdaptedResume.rawText}
                      </pre>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const blob = new Blob([viewingAdaptedResume.rawText], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = viewingAdaptedResume.filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Ladda ner
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingAdaptedResume.rawText);
                          toast({
                            title: 'Kopierad!',
                            description: 'CV-texten har kopierats till urklipp',
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Kopiera text
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

