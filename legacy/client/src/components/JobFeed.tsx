import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  MapPin,
  Building2,
  TrendingUp,
  ExternalLink,
  Briefcase,
  Filter,
  Star,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '../lib/api';
import { useToast } from '@/hooks/use-toast';

export interface Job {
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
  jobId?: string;
  jobDescription?: string;
}

interface JobFeedProps {
  jobs: Job[];
  onTrackApplication: (job: Job) => void;
  onAdaptResume: (job: Job) => void;
  onGenerateApplication: (job: Job) => void;
  isTracking?: Record<string, boolean>;
  isAdapting?: Record<string, boolean>;
  isGenerating?: Record<string, boolean>;
  isLoading?: boolean;
  uploadedResume?: boolean;
}

export function JobFeed({
  jobs,
  onTrackApplication,
  onAdaptResume,
  onGenerateApplication,
  isTracking = {},
  isAdapting = {},
  isGenerating = {},
  isLoading = false,
  uploadedResume = false,
}: JobFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [matchFilter, setMatchFilter] = useState<string>('all');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [savingJob, setSavingJob] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch saved jobs on mount
  useEffect(() => {
    fetchSavedJobs();
  }, []);

  const fetchSavedJobs = async () => {
    try {
      const response = await apiFetch('/api/saved-jobs');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.jobs) {
          const savedJobIds = new Set(
            data.jobs
              .map((job: any) => job.jobId)
              .filter((id: string | null) => id !== null)
          );
          setSavedJobs(savedJobIds);
        }
      } else if (response.status === 404) {
        // Endpoint might not be available yet, silently ignore
        console.log('[JobFeed] Saved jobs endpoint not available (404)');
      } else if (response.status === 401) {
        // User not authenticated, silently ignore
        console.log('[JobFeed] User not authenticated for saved jobs');
      }
    } catch (error) {
      // Silently handle errors - saved jobs is an optional feature
      // Only log if it's not a network/404 error
      if (error instanceof Error && !error.message.includes('404') && !error.message.includes('Failed to fetch')) {
        console.warn('[JobFeed] Error fetching saved jobs:', error);
      }
    }
  };

  // Extract unique locations
  const locations = Array.from(new Set(jobs.map(job => job.location).filter(Boolean)));

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLocation = locationFilter === 'all' || job.location === locationFilter;
    
    const matchesMatch = matchFilter === 'all' ||
      (matchFilter === 'high' && job.matchPercentage >= 75) ||
      (matchFilter === 'medium' && job.matchPercentage >= 55 && job.matchPercentage < 75) ||
      (matchFilter === 'low' && job.matchPercentage < 55);
    
    return matchesSearch && matchesLocation && matchesMatch;
  });

  const toggleSaveJob = async (job: Job) => {
    const jobId = job.jobId || `${job.company}-${job.jobTitle}`;
    
    if (savingJob[jobId]) return;
    
    setSavingJob(prev => ({ ...prev, [jobId]: true }));

    try {
      if (savedJobs.has(jobId)) {
        // Remove from saved
        const response = await apiFetch(`/api/saved-jobs/${jobId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setSavedJobs(prev => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
          toast({
            title: 'Jobb borttaget',
            description: 'Jobbet har tagits bort från dina sparade jobb',
          });
        }
      } else {
        // Save job
        const response = await apiFetch('/api/saved-jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobTitle: job.jobTitle,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            jobId: job.jobId || jobId,
            jobDescription: job.jobDescription,
            matchPercentage: job.matchPercentage,
            matchedSkills: job.matchedSkills,
          }),
        });
        
        if (response.ok) {
          setSavedJobs(prev => new Set(prev).add(jobId));
          toast({
            title: 'Jobb sparat',
            description: 'Jobbet har sparats till dina sparade jobb',
          });
        } else if (response.status === 404) {
          // Endpoint not available, silently fail
          console.log('[JobFeed] Saved jobs endpoint not available (404)');
        } else if (response.status === 401) {
          toast({
            title: 'Autentisering krävs',
            description: 'Du behöver logga in för att spara jobb',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      // Only show error if it's not a 404 (endpoint not available)
      if (error instanceof Error && !error.message.includes('404') && !error.message.includes('Failed to fetch')) {
        console.error('Error toggling saved job:', error);
        toast({
          title: 'Fel',
          description: 'Kunde inte spara/ta bort jobbet',
          variant: 'destructive',
        });
      }
    } finally {
      setSavingJob(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 75) return 'border-green-300 bg-green-50/50';
    if (percentage >= 55) return 'border-blue-300 bg-blue-50/50';
    if (percentage >= 35) return 'border-yellow-300 bg-yellow-50/50';
    return 'border-gray-300 bg-gray-50/50';
  };

  const getMatchBadgeColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-600';
    if (percentage >= 55) return 'bg-blue-600';
    if (percentage >= 35) return 'bg-yellow-600';
    return 'bg-gray-600';
  };

  const getMatchLabel = (percentage: number) => {
    if (percentage >= 75) return 'Stark matchning';
    if (percentage >= 55) return 'Bra matchning';
    if (percentage >= 35) return 'Måttlig matchning';
    return 'Låg matchning';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">Söker jobb...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Jobbannonser
          </CardTitle>
          <CardDescription className="text-xs">
            {filteredJobs.length} av {jobs.length} jobb matchar dina filter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök efter jobbtitel eller företag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-9 text-xs">
                <MapPin className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Plats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla platser</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger className="h-9 text-xs">
                <TrendingUp className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Match-procent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla matchningar</SelectItem>
                <SelectItem value="high">Stark (75%+)</SelectItem>
                <SelectItem value="medium">Bra (55-74%)</SelectItem>
                <SelectItem value="low">Måttlig (&lt;55%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Inga jobb hittades</p>
            <p className="text-xs mt-1">Prova att ändra dina filter eller söktermer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const jobId = job.jobId || `${job.company}-${job.jobTitle}`;
            const isSaved = savedJobs.has(jobId);
            
            return (
              <Card
                key={jobId}
                className={`${getMatchColor(job.matchPercentage)} transition-all hover:shadow-md`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {job.company.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base leading-tight">{job.jobTitle}</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => toggleSaveJob(job)}
                              disabled={savingJob[jobId]}
                            >
                              {savingJob[jobId] ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Star
                                  className={`h-4 w-4 ${isSaved ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                                />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {job.company}
                            </div>
                            {job.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {job.location}
                              </div>
                            )}
                          </div>
                          {job.matchedSkills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {job.matchedSkills.slice(0, 5).map((skill, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {skill}
                                </Badge>
                              ))}
                              {job.matchedSkills.length > 5 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  +{job.matchedSkills.length - 5} mer
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`${getMatchBadgeColor(job.matchPercentage)} text-white`}>
                        {job.matchPercentage}%
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {getMatchLabel(job.matchPercentage)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {job.jobUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(job.jobUrl, '_blank')}
                        className="h-8 text-xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Visa Jobb
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTrackApplication(job)}
                      disabled={isTracking[jobId] || !uploadedResume}
                      className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    >
                      {isTracking[jobId] ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Sparar...
                        </>
                      ) : (
                        <>
                          <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                          Logga Ansökan
                        </>
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onAdaptResume(job)}
                      disabled={isAdapting[jobId] || !uploadedResume}
                      className="h-8 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {isAdapting[jobId] ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Anpassar...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                          Anpassa CV
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

