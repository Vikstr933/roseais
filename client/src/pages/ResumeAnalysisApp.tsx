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
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  Lightbulb,
  Briefcase,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplatePreviewDialog } from '@/components/TemplatePreviewDialog';
import { ApplicationDashboard } from '@/components/ApplicationDashboard';
import { JobFeed } from '@/components/JobFeed';
import { ResumeBuilder } from '@/components/ResumeBuilder';
import { AutoApplySettings } from '@/components/AutoApplySettings';
import { WorkmeLanding } from '@/components/WorkmeLanding';
import { CVBuilderForm } from '@/components/CVBuilderForm';

interface ResumeAnalysis {
  id: number;
  overallScore: number;
  atsScore: number;
  contentScore: number;
  completenessScore: number;
  keywordScore: number;
  presentationScore?: number;
  improvements: Array<{
    type: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  detailedFeedback?: {
    ats?: { score: number; maxScore: number; percentage: number; feedback: { positives: string[]; negatives: string[]; tips: string[] } };
    content?: { score: number; maxScore: number; percentage: number; feedback: { positives: string[]; negatives: string[]; tips: string[] } };
    keywords?: { score: number; maxScore: number; percentage: number; feedback: { positives: string[]; negatives: string[]; tips: string[] } };
    presentation?: { score: number; maxScore: number; percentage: number; feedback: { positives: string[]; negatives: string[]; tips: string[] } };
    completeness?: { score: number; maxScore: number; percentage: number; feedback: { positives: string[]; negatives: string[]; tips: string[] } };
  };
}

interface Resume {
  id: number;
  filename: string;
  fileType: string;
  createdAt: string;
  rawText?: string;
  parsedData?: {
    formattedText?: string;
    contactInfo?: any;
    sections?: any;
    metadata?: {
      aiFormatted?: boolean;
      aiStructured?: boolean;
    };
  };
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
  const [showLanding, setShowLanding] = useState<boolean>(false);
  const [showCVBuilder, setShowCVBuilder] = useState<boolean>(false);

  // Load user's resumes on mount
  useEffect(() => {
    const loadUserResumes = async () => {
      if (!user) {
        setShowLanding(true);
        return;
      }

      try {
        const response = await apiFetch('/api/resumes', {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.resumes && data.resumes.length > 0) {
            // Load the most recent resume
            const mostRecentResume = data.resumes[0]; // Already sorted by createdAt DESC
            setUploadedResume(mostRecentResume);
            setShowLanding(false);
            
            // Optionally load analysis and job matches if they exist
            if (mostRecentResume.id) {
              try {
                // Load analysis
                const analysisResponse = await apiFetch(`/api/resumes/${mostRecentResume.id}/analysis`);
                if (analysisResponse.ok) {
                  const analysisData = await analysisResponse.json();
                  if (analysisData.success && analysisData.analysis) {
                    setAnalysis(analysisData.analysis);
                  }
                }
                
                // Load job matches
                const matchesResponse = await apiFetch(`/api/resumes/${mostRecentResume.id}/job-matches`);
                if (matchesResponse.ok) {
                  const matchesData = await matchesResponse.json();
                  const matches = matchesData.matches || matchesData.jobMatches || (Array.isArray(matchesData) ? matchesData : []);
                  if (matches && Array.isArray(matches) && matches.length > 0) {
                    setJobMatches(matches);
                    setHasAutoSearched(true);
                  }
                }
              } catch (err) {
                // Analysis or matches might not exist yet, that's okay
                console.log('No analysis or matches found for resume');
              }
            }
          } else {
            // No resumes found, show landing page
            setShowLanding(true);
          }
        }
      } catch (error) {
        console.error('Error loading user resumes:', error);
        // On error, show landing page
        setShowLanding(true);
      }
    };

    loadUserResumes();
  }, [user]);

  // Load job applications when resume is loaded
  useEffect(() => {
    if (uploadedResume?.id) {
      fetchApplicationCount(uploadedResume.id);
      fetchJobApplications();
    }
  }, [uploadedResume?.id]);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isGeneratingAdaptedPDF, setIsGeneratingAdaptedPDF] = useState<Record<string, boolean>>({});
  const [isGeneratingApplicationPDF, setIsGeneratingApplicationPDF] = useState<Record<string, boolean>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classic' | 'minimal' | 'professional'>('modern');
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showOriginalResume, setShowOriginalResume] = useState(false);

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
    setUploadStep(0);

    // Step indicators with labels
    const steps = [
      { label: 'Laddar upp fil...' },
      { label: 'Parsar dokument...' },
      { label: 'Formaterar text...' },
      { label: 'Extraherar data...' },
    ];

    let stepInterval: NodeJS.Timeout | null = null;
    
    // Animate through steps
    let currentStep = 0;
    stepInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setUploadStep(currentStep);
        setProgress(steps[currentStep].label);
        currentStep++;
      }
    }, 3000);

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
        // Mark all steps as complete
        if (stepInterval) clearInterval(stepInterval);
        setUploadStep(steps.length);
        
        setProgress('');
        setUploadedResume(data.resume);
        setShowLanding(false); // Hide landing when CV is uploaded
        
        // Fetch application count and applications for this resume
        if (data.resume?.id) {
          fetchApplicationCount(data.resume.id);
        }
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
      if (stepInterval) clearInterval(stepInterval);
      setIsUploading(false);
      setUploadStep(0);
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
          description: `Your resume scored ${data.analysis?.overallScore ?? 0}/100. Söker automatiskt efter matchande jobb...`,
        });
        // Automatically search for jobs after analysis
        // Use setTimeout to ensure state is updated
        // Automatically search for jobs after analysis
        // Use longer timeout to ensure state is fully updated
        setTimeout(() => {
          handleFindJobs(true); // Pass true to indicate auto-search
        }, 1000);
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
      console.log('[JobMatches] Full response data:', JSON.stringify(data, null, 2));
      console.log('[JobMatches] Data type:', typeof data);
      console.log('[JobMatches] Is array:', Array.isArray(data));
      console.log('[JobMatches] Has matches:', !!data.matches);
      console.log('[JobMatches] Has jobMatches:', !!data.jobMatches);

      // Handle both 'matches' and direct array response
      const matches = data.matches || data.jobMatches || (Array.isArray(data) ? data : []);
      console.log('[JobMatches] Extracted matches:', matches);
      console.log('[JobMatches] Matches length:', matches?.length || 0);
      console.log('[JobMatches] Matches is array:', Array.isArray(matches));
      
      if (matches && Array.isArray(matches) && matches.length > 0) {
        console.log('[JobMatches] ✅ Setting matches:', matches.length);
        setJobMatches(matches);
        setHasAutoSearched(isAutoSearch);
        setProgress('');
        if (!isAutoSearch) {
          toast({
            title: 'Jobb Hittade!',
            description: `Hittade ${matches.length} matchande jobbannonser`,
          });
        }
      } else {
        console.log('[JobMatches] ❌ No matches found - matches:', matches, 'length:', matches?.length);
        // Still set empty array to clear any previous matches
        setJobMatches([]);
        setHasAutoSearched(isAutoSearch);
        setProgress('');
        if (!isAutoSearch && matches && matches.length === 0) {
          toast({
            title: 'Inga jobb hittades',
            description: 'Prova att ändra sökord eller plats',
            variant: 'default',
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

  const handleCreateApplication = async (jobMatch: JobMatch) => {
    // Use existing handleTrackApplication if it exists, otherwise create new
    if (typeof handleTrackApplication === 'function') {
      return handleTrackApplication(jobMatch);
    }
    
    try {
      const response = await apiFetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: uploadedResume?.id,
          jobTitle: jobMatch.jobTitle,
          companyName: jobMatch.company,
          location: jobMatch.location,
          jobUrl: jobMatch.jobUrl,
          applicationMethod: 'manual',
          jobId: jobMatch.jobId || `job-${Date.now()}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Application Tracked!',
          description: `Application for ${jobMatch.jobTitle} at ${jobMatch.company} has been added to your dashboard.`,
        });
      }
    } catch (error) {
      console.error('Error creating application:', error);
      toast({
        title: 'Error',
        description: 'Failed to track application',
        variant: 'destructive',
      });
    }
  };

  const [isGeneratingLaTeX, setIsGeneratingLaTeX] = useState(false);
  const [creatingApplication, setCreatingApplication] = useState<Record<string, boolean>>({});
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applicationStats, setApplicationStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleGeneratePDF = async () => {
    if (!uploadedResume) return;

    setIsGeneratingPDF(true);
    setProgress('Genererar professionell PDF...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: selectedTemplate,
          format: 'A4',
          fontSize: 'medium',
          colorScheme: 'blue',
          outputFormat: 'pdf',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadedResume.filename.replace(/\.[^/.]+$/, '')}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress('');
      toast({
        title: 'PDF Genererad!',
        description: 'Din professionella CV-PDF har laddats ner.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const fetchApplicationCount = async (resumeId: number) => {
    try {
      const response = await apiFetch(`/api/job-applications/resume/${resumeId}`);
      if (response.ok) {
        const data = await response.json();
        const apps = data.applications || [];
        setApplicationCount(apps.length);
        setJobApplications(apps);
      }
    } catch (error) {
      // Silently fail - not critical
      console.error('Error fetching application count:', error);
    }
  };

  const fetchAllJobApplications = async () => {
    if (!user) return;
    
    try {
      setLoadingApplications(true);
      const response = await apiFetch('/api/job-applications');
      if (response.ok) {
        const data = await response.json();
        setJobApplications(data.applications || []);
        setApplicationCount((data.applications || []).length);
      }
    } catch (error) {
      console.error('Error fetching job applications:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte hämta jobbansökningar',
        variant: 'destructive',
      });
    } finally {
      setLoadingApplications(false);
    }
  };

  const fetchJobApplications = async () => {
    if (!uploadedResume) {
      // If no resume, fetch all applications
      await fetchAllJobApplications();
      return;
    }
    
    try {
      setLoadingApplications(true);
      const response = await apiFetch(`/api/job-applications/resume/${uploadedResume.id}`);
      if (response.ok) {
        const data = await response.json();
        setJobApplications(data.applications || []);
        setApplicationCount((data.applications || []).length);
      }
    } catch (error) {
      console.error('Error fetching job applications:', error);
      toast({
        title: 'Error',
        description: 'Kunde inte hämta jobbansökningar',
        variant: 'destructive',
      });
    } finally {
      setLoadingApplications(false);
    }
  };

  const fetchApplicationStats = async () => {
    if (!user) return;
    
    try {
      setLoadingStats(true);
      const response = await apiFetch('/api/job-applications/stats');
      if (response.ok) {
        const data = await response.json();
        setApplicationStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching application stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch job applications and stats when user is available
  useEffect(() => {
    if (user) {
      fetchAllJobApplications();
      fetchApplicationStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGenerateLaTeX = async () => {
    if (!uploadedResume) return;

    setIsGeneratingLaTeX(true);
    setProgress('Genererar LaTeX CV...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: selectedTemplate,
          format: 'A4',
          fontSize: 'medium',
          colorScheme: 'blue',
          outputFormat: 'latex',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate LaTeX');
      }

      // Get LaTeX text
      const latexText = await response.text();
      const blob = new Blob([latexText], { type: 'text/plain; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadedResume.filename.replace(/\.[^/.]+$/, '')}_resume.tex`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress('');
      toast({
        title: 'LaTeX CV Genererad!',
        description: 'Din LaTeX CV-fil har laddats ner. Du kan kompilera den med pdflatex.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate LaTeX';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLaTeX(false);
    }
  };

  const handleTrackApplication = async (jobMatch: JobMatch) => {
    if (!uploadedResume) {
      toast({
        title: 'Error',
        description: 'Inget CV är uppladdat',
        variant: 'destructive',
      });
      return;
    }

    const jobId = jobMatch.jobId || '';
    setCreatingApplication(prev => ({ ...prev, [jobId]: true }));

    try {
      const response = await apiFetch('/api/job-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobMatch.jobTitle,
          companyName: jobMatch.company,
          location: jobMatch.location,
          resumeId: uploadedResume.id,
          applicationMethod: 'manual',
          jobUrl: jobMatch.jobUrl,
          recruiterEmail: jobMatch.applicationEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create application');
      }

      // Update application count
      if (uploadedResume) {
        fetchApplicationCount(uploadedResume.id);
      }

      toast({
        title: 'Ansökan loggad!',
        description: `${jobMatch.jobTitle} har lagts till i din tracker.`,
      });

      // Refresh applications
      fetchJobApplications();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to track application';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCreatingApplication(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const handleGenerateAdaptedPDF = async (adaptedResume: AdaptedResume) => {
    if (!uploadedResume) return;

    setIsGeneratingAdaptedPDF(prev => ({ ...prev, [adaptedResume.id]: true }));
    setProgress('Genererar PDF från anpassat CV...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: selectedTemplate,
          format: 'A4',
          fontSize: 'medium',
          colorScheme: 'blue',
          resumeText: adaptedResume.rawText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = adaptedResume.filename.replace(/\.txt$/, '') + '_anpassad.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress('');
      toast({
        title: 'PDF Genererad!',
        description: 'Din anpassade CV-PDF har laddats ner.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAdaptedPDF(prev => ({ ...prev, [adaptedResume.id]: false }));
    }
  };

  const handleGenerateApplicationPDF = async (jobMatch: JobMatch, applicationData: ApplicationData) => {
    if (!uploadedResume || !jobMatch.jobId) return;

    setIsGeneratingApplicationPDF(prev => ({ ...prev, [jobMatch.jobId!]: true }));
    setProgress('Genererar PDF från ansökan...');

    try {
      const response = await apiFetch(`/api/resumes/${uploadedResume.id}/generate-application-pdf/${jobMatch.jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationText: applicationData.fullApplication.combinedText,
          jobTitle: jobMatch.jobTitle,
          company: jobMatch.company,
          template: selectedTemplate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ansokan_${jobMatch.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress('');
      toast({
        title: 'PDF Genererad!',
        description: 'Din ansökan som PDF har laddats ner.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      setProgress('');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingApplicationPDF(prev => ({ ...prev, [jobMatch.jobId!]: false }));
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

  // Get the best available text (formattedText from AI, or fallback to formatted rawText)
  const getResumeText = (resume?: Resume | null, rawText?: string): string => {
    if (!resume && !rawText) return '';
    
    // Priority 1: Use formattedText from parsedData if available (AI-formatted)
    if (resume?.parsedData?.formattedText) {
      return resume.parsedData.formattedText;
    }
    
    // Priority 2: Use provided rawText or resume rawText
    const textToFormat = rawText || resume?.rawText || '';
    if (!textToFormat) return '';
    
    // Priority 3: Format it with rule-based formatting
    return formatResumeText(textToFormat);
  };

  // Format resume text with better spacing and structure (fallback when no formattedText available)
  const formatResumeText = (text: string): string => {
    if (!text) return '';
    
    let formatted = text;
    
    // STEP 1: REMOVE ALL MARKDOWN FORMATTING FIRST
    // Remove bold markdown (**text** or __text__)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
    formatted = formatted.replace(/__([^_]+)__/g, '$1');
    
    // Remove italic markdown (*text* or _text_) - but be careful not to remove bullet points
    formatted = formatted.replace(/\*([^*\n]+)\*/g, '$1');
    formatted = formatted.replace(/_([^_\n]+)_/g, '$1');
    
    // Remove heading markdown (# ## ###)
    formatted = formatted.replace(/^#{1,6}\s+/gm, '');
    
    // Remove strikethrough (~~text~~)
    formatted = formatted.replace(/~~([^~]+)~~/g, '$1');
    
    // Remove code blocks (```text```)
    formatted = formatted.replace(/```[a-z]*\n?/g, '');
    formatted = formatted.replace(/`([^`]+)`/g, '$1');
    
    // STEP 2: ADD PROPER SPACING
    // First, add spacing before section headers (common CV sections)
    const sectionHeaders = [
      'SAMMANFATTNING', 'ERFARENHET', 'UTBILDNING', 'KOMPETENSER', 'PRESTATIONER', 
      'SPRÅK', 'KONTAKT', 'PERSONLIGT BREV', 'CV', 'ANSOKNING', 'FÄRDIGHETER',
      'Arbetslivserfarenhet', 'Utbildning', 'Kompetenser', 'Språk', 'Kontakt'
    ];
    
    sectionHeaders.forEach(header => {
      // Match header with optional preceding text on same line
      const regex = new RegExp(`([^\\n])(${header})`, 'gi');
      formatted = formatted.replace(regex, '$1\n\n$2');
    });
    
    // Add spacing before headers that start with special characters or are all caps
    formatted = formatted.replace(/([^\n])([A-ZÅÄÖ][A-ZÅÄÖ\s]{10,})/g, (match, before, header) => {
      // Check if it looks like a section header (all caps, longer than 10 chars)
      if (header.trim().length > 10 && header === header.toUpperCase() && !header.match(/\d{4}/)) {
        return `${before}\n\n${header}`;
      }
      return match;
    });
    
    // Add spacing after job titles/company names followed by dates
    // Pattern: Job Title / Company Name Date range
    formatted = formatted.replace(/([^\n])\s+(\w+\s+\w+)\s*\/\s*(\w+)/g, '\n\n$2 / $3');
    
    // Add spacing after date ranges (both formats: 2022-2023 or 01/2022 - 12/2023)
    formatted = formatted.replace(/(\d{4}\s*-\s*\d{4}|\d{2}\/\d{4}\s*-\s*\d{2}\/\d{4}|\d{2}\/\d{4}\s*–\s*\d{2}\/\d{4})/g, '$1\n');
    
    // Add spacing after company/location lines (lines ending with city names)
    formatted = formatted.replace(/([A-ZÅÄÖ][a-zåäö]+\s*,\s*[A-ZÅÄÖ][a-zåäö]+)\s*([^\n])/g, '$1\n$2');
    
    // Add spacing before bullet points or numbered lists
    formatted = formatted.replace(/([^\n])([•\-\*]\s|[\d]+\.[\s])/g, '$1\n$2');
    
    // Add spacing after email addresses and phone numbers
    formatted = formatted.replace(/([\w\.-]+@[\w\.-]+\.\w+|[\+]?[\d\s\-\(\)]{10,})/g, '$1\n');
    
    // Add spacing around separator lines (--- or ㅡ)
    formatted = formatted.replace(/([^\n])([─-]{2,}|ㅡ)\s*([^\n])/g, '$1\n\n$2\n\n$3');
    
    // Add spacing before "-- 1 of 2 --" style pagination
    formatted = formatted.replace(/([^\n])(--\s*\d+\s+of\s+\d+\s*--)/g, '$1\n\n$2\n');
    
    // Clean up multiple blank lines (max 2 consecutive, but allow 3 for section breaks)
    formatted = formatted.replace(/\n{4,}/g, '\n\n\n');
    
    // Trim and return
    return formatted.trim();
  };

  // Format application text with better structure
  const formatApplicationText = (text: string): string => {
    if (!text) return '';
    
    let formatted = text;
    
    // STEP 1: REMOVE ALL MARKDOWN FORMATTING
    // Remove bold markdown (**text** or __text__)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
    formatted = formatted.replace(/__([^_]+)__/g, '$1');
    
    // Remove italic markdown (*text* or _text_)
    formatted = formatted.replace(/\*([^*\n]+)\*/g, '$1');
    formatted = formatted.replace(/_([^_\n]+)_/g, '$1');
    
    // Remove heading markdown (# ## ###)
    formatted = formatted.replace(/^#{1,6}\s+/gm, '');
    
    // Remove strikethrough (~~text~~)
    formatted = formatted.replace(/~~([^~]+)~~/g, '$1');
    
    // Remove code blocks
    formatted = formatted.replace(/```[a-z]*\n?/g, '');
    formatted = formatted.replace(/`([^`]+)`/g, '$1');
    
    // STEP 2: ADD PROPER SPACING
    // Add spacing around section headers
    formatted = formatted.replace(/(PERSONLIGT BREV|CV|ANSOKNING|Slut på ansökan)/g, '\n\n$1\n\n');
    
    // Add spacing after dates
    formatted = formatted.replace(/Datum:\s*\d{4}-\d{2}-\d{2}/g, '$&\n');
    
    // Clean up multiple blank lines
    formatted = formatted.replace(/\n{4,}/g, '\n\n\n');
    
    return formatted.trim();
  };

  // Format combined application (cover letter + CV) with proper CV formatting
  const formatCombinedApplication = (text: string): string => {
    if (!text) return '';
    
    let formatted = text;
    
    // Split into cover letter and CV sections - try multiple patterns
    let cvStartIndex = -1;
    const cvPatterns = [
      /\n\nCV\n/,
      /\nCV\n/,
      /CV\n\n/,
      /CV\n/,
      /\n\nCV\s/,
      /CV\s/
    ];
    
    for (const pattern of cvPatterns) {
      const match = formatted.match(pattern);
      if (match && match.index !== undefined) {
        cvStartIndex = match.index;
        break;
      }
    }
    
    if (cvStartIndex !== -1) {
      // Find the actual start of CV section (after "CV" header)
      const cvHeaderEnd = formatted.indexOf('CV', cvStartIndex);
      const actualCvStart = formatted.indexOf('\n', cvHeaderEnd);
      const splitIndex = actualCvStart !== -1 ? actualCvStart + 1 : cvStartIndex;
      
      const coverLetterPart = formatted.substring(0, splitIndex);
      const cvPart = formatted.substring(splitIndex);
      
      // Format cover letter part
      let formattedCoverLetter = formatApplicationText(coverLetterPart);
      
      // Format CV part using formatResumeText (which handles the CV structure)
      let formattedCV = formatResumeText(cvPart);
      
      // Combine with proper spacing
      formatted = formattedCoverLetter + '\n\n' + formattedCV;
    } else {
      // If we can't find the split, try to format the whole thing
      // But apply more aggressive formatting
      formatted = formatApplicationText(text);
      // Also apply CV formatting in case there's CV content
      formatted = formatResumeText(formatted);
    }
    
    // Add spacing around major section headers in combined text
    formatted = formatted.replace(/(ANSOKNING|PERSONLIGT BREV|CV|Slut på ansökan)/g, '\n\n$1\n\n');
    
    // Clean up multiple blank lines (max 3 for major sections)
    formatted = formatted.replace(/\n{4,}/g, '\n\n\n');
    
    return formatted.trim();
  };



  // Show landing page if no CV and user hasn't made a choice
  if (showLanding && !uploadedResume && !showCVBuilder) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <WorkmeLanding
          onUploadCV={() => {
            setShowLanding(false);
            setShowCVBuilder(false);
          }}
          onCreateCV={() => {
            setShowLanding(false);
            setShowCVBuilder(true);
          }}
        />
      </div>
    );
  }

  // Show CV Builder Form
  if (showCVBuilder && !uploadedResume) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <Button
            variant="ghost"
            onClick={() => {
              setShowCVBuilder(false);
              setShowLanding(true);
            }}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Button>
          <CVBuilderForm
            onComplete={async (cvData) => {
              // TODO: Generate PDF from CV data and upload it
              // For now, just show success and go back to upload
              toast({
                title: 'CV skapat!',
                description: 'Ditt CV har skapats. Ladda upp det för att fortsätta.',
              });
              setShowCVBuilder(false);
              setShowLanding(false);
            }}
            onCancel={() => {
              setShowCVBuilder(false);
              setShowLanding(true);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/public-projects')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Community
            </Button>
            {uploadedResume && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowLanding(true);
                  setUploadedResume(null);
                  setAnalysis(null);
                  setJobMatches([]);
                }}
              >
                Nytt CV
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20 flex-shrink-0">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">Workme</h1>
                <Badge className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-700 w-fit">
                  <Brain className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                Din AI-drivna karriärcoach. Hitta ditt drömjobb snabbare med automatiserad jobbsökning.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Snabbstart-kort - Visa när CV är uppladdat */}
        {uploadedResume && (
          <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Snabbstart - Dina Nästa Steg
              </CardTitle>
              <CardDescription>
                Följ dessa steg för att maximera dina chanser att få jobbet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Steg 1: Analysera CV */}
                <div className={`p-4 rounded-lg border-2 transition-all ${analysis ? 'border-green-300 bg-green-50' : 'border-purple-200 bg-white hover:border-purple-300 cursor-pointer'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${analysis ? 'bg-green-500 text-white' : 'bg-purple-100 text-purple-600'}`}>
                      {analysis ? <CheckCircle className="h-6 w-6" /> : '1'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Analysera CV</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Få detaljerad AI-analys och förbättringsförslag
                      </p>
                      {!analysis ? (
                        <Button
                          size="sm"
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Analyserar...
                            </>
                          ) : (
                            <>
                              <Brain className="h-3 w-3 mr-2" />
                              Starta Analys
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Klar
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Steg 2: Anpassa CV */}
                <div className={`p-4 rounded-lg border-2 transition-all ${adaptedResumes.length > 0 ? 'border-green-300 bg-green-50' : analysis ? 'border-blue-200 bg-white hover:border-blue-300 cursor-pointer' : 'border-gray-200 bg-gray-50 opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${adaptedResumes.length > 0 ? 'bg-green-500 text-white' : analysis ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      {adaptedResumes.length > 0 ? <CheckCircle className="h-6 w-6" /> : '2'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Anpassa CV</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Anpassa ditt CV för specifika jobb
                      </p>
                      {!analysis ? (
                        <p className="text-xs text-muted-foreground italic">Analysera CV först</p>
                      ) : adaptedResumes.length > 0 ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {adaptedResumes.length} anpassad{adaptedResumes.length > 1 ? 'a' : ''}
                        </Badge>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sök jobb och anpassa CV</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Steg 3: Auto-ansök */}
                <div className={`p-4 rounded-lg border-2 transition-all ${applicationCount && applicationCount > 0 ? 'border-green-300 bg-green-50' : analysis ? 'border-cyan-200 bg-white hover:border-cyan-300 cursor-pointer' : 'border-gray-200 bg-gray-50 opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold ${applicationCount && applicationCount > 0 ? 'bg-green-500 text-white' : analysis ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-100 text-gray-400'}`}>
                      {applicationCount && applicationCount > 0 ? <CheckCircle className="h-6 w-6" /> : '3'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Logga Ansökningar</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Spåra dina ansökningar och följ upp
                      </p>
                      {!analysis ? (
                        <p className="text-xs text-muted-foreground italic">Analysera CV först</p>
                      ) : applicationCount && applicationCount > 0 ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {applicationCount} loggad{applicationCount > 1 ? 'a' : ''}
                        </Badge>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Logga ansökningar när du söker jobb</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROI-kort - Visa när användare har aktivitet */}
        {user && (applicationCount !== null && applicationCount > 0 || jobMatches.length > 0) && (
          <Card className="mb-6 border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Din Framgång - Live Statistik
              </CardTitle>
              <CardDescription>
                Se hur mycket du har åstadkommit med Workme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Ansökningar loggade */}
                <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {applicationCount ?? jobApplications.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Ansökningar loggade</div>
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    {applicationCount && applicationCount > 0 ? '✓ Aktiv' : 'Kom igång!'}
                  </div>
                </div>

                {/* Matcher >80% */}
                <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {jobMatches.filter(m => (m.matchPercentage || 0) >= 80).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Matcher &gt;80%</div>
                  <div className="text-xs text-blue-600 mt-1 font-medium">
                    {jobMatches.filter(m => (m.matchPercentage || 0) >= 80).length > 0 ? '✓ Höga chanser' : 'Sök fler jobb'}
                  </div>
                </div>

                {/* Intervjuer */}
                <div className="text-center p-4 bg-white rounded-lg border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {applicationStats?.byStatus?.interview || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Intervjuer</div>
                  <div className="text-xs text-purple-600 mt-1 font-medium">
                    {applicationStats?.byStatus?.interview > 0 ? '✓ Bra jobbat!' : 'Fortsätt söka'}
                  </div>
                </div>

                {/* Erbjudanden */}
                <div className="text-center p-4 bg-white rounded-lg border border-emerald-200">
                  <div className="text-3xl font-bold text-emerald-600 mb-1">
                    {applicationStats?.byStatus?.offer || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Erbjudanden</div>
                  <div className="text-xs text-emerald-600 mt-1 font-medium">
                    {applicationStats?.byStatus?.offer > 0 ? '🎉 Grattis!' : 'Du är på rätt väg'}
                  </div>
                </div>
              </div>

              {/* Ytterligare statistik */}
              {applicationStats && applicationStats.total > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-gray-700">
                        {applicationStats.total || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Totalt ansökningar</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {applicationStats.total > 0 
                          ? Math.round(((applicationStats.byStatus?.interview || 0) / applicationStats.total) * 100)
                          : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Svarsfrekvens</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {applicationStats.total > 0 
                          ? Math.round(((applicationStats.byStatus?.offer || 0) / applicationStats.total) * 100)
                          : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Erbjudandefrekvens</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CV Builder Section - Hidden */}
        {false && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">CV-byggare</CardTitle>
              <CardDescription className="text-xs">
                Bygg ditt CV steg för steg med AI-hjälp eller ladda upp ett befintligt CV för analys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeBuilder />
            </CardContent>
          </Card>
        )}

        {/* CV Upload Section - Only show if no CV uploaded */}
        {!uploadedResume && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ladda upp ditt CV</CardTitle>
              <CardDescription className="text-xs">
                Ladda upp ditt CV för att analysera det med AI och hitta matchade jobb. Stöder PDF, DOCX och LaTeX.
              </CardDescription>
            </CardHeader>
            <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors"
            >
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!uploadedResume && !isUploading && (
                      <Button
                        onClick={handleUpload}
                        size="sm"
                        className="h-8"
                      >
                        Ladda upp
                      </Button>
                    )}
                    {isUploading && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs text-muted-foreground">Laddar upp...</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadedResume(null);
                        setAnalysis(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop eller{' '}
                    <button
                      onClick={() => document.getElementById('file-input')?.click()}
                      className="text-primary hover:underline"
                    >
                      välj fil
                    </button>
                  </p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.docx,.tex"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            {error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

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
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
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
                    {uploadedResume && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="template-select" className="text-sm text-muted-foreground whitespace-nowrap">
                          Mall:
                        </Label>
                        <Select value={selectedTemplate} onValueChange={(value: 'modern' | 'classic' | 'minimal' | 'professional') => setSelectedTemplate(value)}>
                          <SelectTrigger id="template-select" className="w-[160px]">
                            <SelectValue placeholder="Välj mall" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="modern">Modern</SelectItem>
                            <SelectItem value="classic">Klassisk</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="professional">Professionell</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTemplatePreview(true)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          Förhandsgranska
                        </Button>
                      </div>
                    )}
                  </div>
                  {analysis && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={handleGeneratePDF}
                        disabled={isGeneratingPDF || isGeneratingLaTeX}
                        variant="outline"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 w-full sm:w-auto"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Genererar...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Ladda ner PDF
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleGenerateLaTeX}
                        disabled={isGeneratingPDF || isGeneratingLaTeX}
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        {isGeneratingLaTeX ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Genererar...
                          </>
                        ) : (
                          <>
                            <FileCode className="h-4 w-4 mr-2" />
                            Ladda ner LaTeX
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
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
                id="edit-resume-text"
                name="editedResumeText"
                value={editedResumeText}
                onChange={(e) => setEditedResumeText(e.target.value)}
                className="w-full min-h-[400px] p-4 border rounded-lg font-mono text-sm resize-y"
                placeholder="Klistra in eller redigera CV-text här..."
              />
            </CardContent>
          </Card>
        )}

        {/* Analysis Results - Compact 2-Column Layout */}
        {analysis && !editingResume && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column: Scores (1/3 width on large screens) */}
            <div className="lg:col-span-1 space-y-3">
              {/* ATS Info Box - More Compact */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1 text-sm">Vad är ATS?</h4>
                      <p className="text-xs text-blue-800">
                        System som automatiskt sorterar CV:n. Ett ATS-vänligt CV ökar dina chanser att nå rekryterare.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overall Score - More Compact */}
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">CV Poäng</CardTitle>
                    {uploadedResume && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditResume}
                        className="h-6 px-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center justify-center py-1">
                    <div className={`relative w-24 h-24 rounded-full ${getScoreBgColor(analysis?.overallScore ?? 0)} flex items-center justify-center`}>
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(analysis?.overallScore ?? 0)}`}>
                          {analysis?.overallScore ?? 0}
                        </div>
                        <div className="text-xs text-muted-foreground">/100</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Scores - More Compact, Expandable */}
              <div className="space-y-2">
                {[
                  { key: 'ats', label: 'ATS-vänlighet', score: analysis?.atsScore ?? 0, maxScore: 25, description: 'Hur väl ditt CV kan läsas av automatiska system.' },
                  { key: 'content', label: 'Innehållskvalitet', score: analysis?.contentScore ?? 0, maxScore: 30, description: 'Hur väl du kommunicerar prestationer.' },
                  { key: 'keywords', label: 'Nyckelord', score: analysis?.keywordScore ?? 0, maxScore: 20, description: 'Matchning mot relevanta kompetenser.' },
                  { key: 'presentation', label: 'Presentation', score: analysis?.presentationScore ?? analysis?.completenessScore ?? 0, maxScore: 15, description: 'Formatering och visuell hierarki.' },
                  { key: 'completeness', label: 'Kompletthet', score: analysis?.completenessScore ?? 0, maxScore: 10, description: 'Verifierar att inget saknas.' },
                ].map((category) => {
                const isExpanded = expandedCategories[category.key] || false;
                const categoryFeedback = analysis?.detailedFeedback?.[category.key as keyof typeof analysis.detailedFeedback];
                const percentage = category.score;
                const getCategoryColor = (pct: number) => {
                  if (pct >= 70) return 'text-green-600';
                  if (pct >= 50) return 'text-blue-600';
                  if (pct >= 30) return 'text-yellow-600';
                  return 'text-red-600';
                };
                const getCategoryBgColor = (pct: number) => {
                  if (pct >= 70) return 'bg-green-50 border-green-200';
                  if (pct >= 50) return 'bg-blue-50 border-blue-200';
                  if (pct >= 30) return 'bg-yellow-50 border-yellow-200';
                  return 'bg-red-50 border-red-200';
                };

                return (
                  <Card key={category.key} className={isExpanded ? getCategoryBgColor(percentage) : ''}>
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedCategories(prev => ({ ...prev, [category.key]: !prev[category.key] }))}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">{category.label}</CardTitle>
                            <span className={`text-sm font-semibold ${getCategoryColor(percentage)}`}>
                              {category.score}/100
                            </span>
                          </div>
                          <Progress value={category.score} className="h-2" />
                        </div>
                        <Button variant="ghost" size="sm" className="ml-2 h-6 w-6 p-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                      {isExpanded && (
                        <CardContent className="pt-2 pb-2">
                          <div className="space-y-2">
                            {/* Why it matters */}
                            <div className="bg-white/60 rounded p-2">
                              <div className="flex items-start gap-1.5 mb-1">
                                <Info className="h-3 w-3 text-blue-600 mt-0.5" />
                                <h5 className="font-semibold text-xs">Varför viktigt?</h5>
                              </div>
                              <p className="text-xs text-gray-700">{category.description}</p>
                            </div>

                            {/* Positives */}
                            {categoryFeedback?.feedback.positives && categoryFeedback.feedback.positives.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                  <h5 className="font-semibold text-xs text-green-700">Bra jobbat!</h5>
                                </div>
                                <ul className="space-y-0.5">
                                  {categoryFeedback.feedback.positives.slice(0, 3).map((positive, idx) => (
                                    <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                      <span className="text-green-600 mt-0.5">•</span>
                                      <span>{positive}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Negatives / Areas for improvement */}
                            {categoryFeedback?.feedback.negatives && categoryFeedback.feedback.negatives.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <AlertCircle className="h-3 w-3 text-orange-600" />
                                  <h5 className="font-semibold text-xs text-orange-700">Förbättringsområden</h5>
                                </div>
                                <ul className="space-y-0.5">
                                  {categoryFeedback.feedback.negatives.slice(0, 3).map((negative, idx) => (
                                    <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                      <span className="text-orange-600 mt-0.5">•</span>
                                      <span>{negative}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Actionable Tips */}
                            {categoryFeedback?.feedback.tips && categoryFeedback.feedback.tips.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Lightbulb className="h-3 w-3 text-yellow-600" />
                                  <h5 className="font-semibold text-xs text-yellow-700">Tips</h5>
                                </div>
                                <ul className="space-y-0.5">
                                  {categoryFeedback.feedback.tips.slice(0, 2).map((tip, idx) => (
                                    <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                      <span className="text-yellow-600 mt-0.5">💡</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Job Matches and Search (2/3 width on large screens) */}
            <div className="lg:col-span-2">
              <JobFeed
                jobs={jobMatches}
                onTrackApplication={handleTrackApplication}
                onAdaptResume={handleAdaptResume}
                onGenerateApplication={handleGenerateApplication}
                isTracking={creatingApplication}
                isAdapting={isAdapting}
                isGenerating={generatingApplication}
                isLoading={isSearchingJobs}
                uploadedResume={!!uploadedResume}
              />
            </div>
          </div>
        )}

        {/* Alla Ansökningar - Min Ansöknings-Tracker */}
        {user && (applicationCount !== null && applicationCount > 0 || jobApplications.length > 0) && (
          <div className="space-y-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Alla Ansökningar
                </CardTitle>
                <CardDescription>
                  Här ser du alla jobb du har loggat eller ansökt till
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApplicationDashboard />
              </CardContent>
            </Card>
            {/* Auto-Apply Settings */}
            {uploadedResume && (
              <AutoApplySettings resumeId={uploadedResume.id} />
            )}
          </div>
        )}

        {/* Original CV - Quick access */}
        {uploadedResume && !editingResume && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Original-CV
              </CardTitle>
              <CardDescription>
                {uploadedResume.filename || 'Uppladdat CV'} • Uppladdat {uploadedResume.createdAt ? new Date(uploadedResume.createdAt).toLocaleDateString() : '–'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(uploadedResume as any).filePath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getApiUrl((uploadedResume as any).filePath), '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Ladda ner original
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOriginalResume(prev => !prev)}
                >
                  {showOriginalResume ? 'Dölj text' : 'Visa text'}
                </Button>
              </div>
              {showOriginalResume && (
                <div className="border rounded-lg p-4 bg-white max-h-72 overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-gray-800">
                      {getResumeText(uploadedResume, uploadedResume.rawText)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                            const formattedText = getResumeText(null, adapted.rawText);
                            const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = adapted.filename.replace(/\.txt$/, '') + '_formaterad.txt';
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Ladda ner TXT
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateAdaptedPDF(adapted)}
                          disabled={isGeneratingAdaptedPDF[adapted.id]}
                          className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                        >
                          {isGeneratingAdaptedPDF[adapted.id] ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Genererar...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Ladda ner PDF
                            </>
                          )}
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
                      <h5 className="font-semibold mb-3 text-base text-gray-900">Personligt Brev</h5>
                      <div className="border rounded-lg p-6 bg-white shadow-sm">
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-gray-800">
                            {formatApplicationText(viewingApplication.data.coverLetter)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Full Application Preview */}
                    <div className="mt-6">
                      <h5 className="font-semibold mb-3 text-base text-gray-900">Komplett Ansökan (Förhandsvisning)</h5>
                      <div className="border rounded-lg p-6 bg-gray-50 max-h-96 overflow-y-auto">
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-gray-800">
                            {formatCombinedApplication(viewingApplication.data.fullApplication.combinedText)}
                          </div>
                        </div>
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
                          const formattedText = formatCombinedApplication(viewingApplication.data.fullApplication.combinedText);
                          const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Ansokan_${viewingApplication.jobMatch.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Ladda ner TXT
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleGenerateApplicationPDF(viewingApplication.jobMatch, viewingApplication.data)}
                        disabled={isGeneratingApplicationPDF[viewingApplication.jobMatch.jobId || '']}
                        className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {isGeneratingApplicationPDF[viewingApplication.jobMatch.jobId || ''] ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Genererar...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Ladda ner PDF
                          </>
                        )}
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
                    <div className="border rounded-lg p-6 bg-white">
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-gray-800">
                          {formatResumeText(viewingAdaptedResume.rawText)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const formattedText = getResumeText(null, viewingAdaptedResume.rawText);
                          const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = viewingAdaptedResume.filename.replace(/\.txt$/, '') + '_formaterad.txt';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Ladda ner TXT
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleGenerateAdaptedPDF(viewingAdaptedResume)}
                        disabled={isGeneratingAdaptedPDF[viewingAdaptedResume.id]}
                        className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {isGeneratingAdaptedPDF[viewingAdaptedResume.id] ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Genererar...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Ladda ner PDF
                          </>
                        )}
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

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
      <TemplatePreviewDialog
        open={showTemplatePreview}
        onOpenChange={setShowTemplatePreview}
        onSelectTemplate={setSelectedTemplate}
        selectedTemplate={selectedTemplate}
      />
    </div>
  );
}

