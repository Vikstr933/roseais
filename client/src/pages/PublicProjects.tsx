import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Heart,
  GitBranch,
  Eye,
  TrendingUp,
  Clock,
  Star,
  Filter,
  FileCode,
  Code,
} from 'lucide-react';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';

interface PublicProject {
  id: number;
  name: string;
  description: string;
  projectType: string;
  screenshotUrl: string | null;
  thumbnailUrl: string | null;
  remixCount: number;
  voteCount: number;
  viewCount: number;
  featured: boolean;
  tags: string[];
  createdAt: string;
  ownerId: string;
  ownerName: string;
  fileCount: number;
}

const categoryColors: Record<string, string> = {
  web_app: 'from-blue-500 to-cyan-500',
  mobile_app: 'from-purple-500 to-pink-500',
  api: 'from-emerald-500 to-teal-500',
  dashboard: 'from-amber-500 to-orange-500',
  e_commerce: 'from-rose-500 to-pink-500',
  portfolio: 'from-violet-500 to-indigo-500',
};

const categoryLabels: Record<string, string> = {
  web_app: 'Web App',
  mobile_app: 'Mobile App',
  api: 'API',
  dashboard: 'Dashboard',
  e_commerce: 'E-commerce',
  portfolio: 'Portfolio',
};

const sortOptions = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'recent', label: 'Recent', icon: Clock },
  { value: 'votes', label: 'Most Voted', icon: Star },
  { value: 'remixes', label: 'Most Remixed', icon: GitBranch },
];

const categoryFilters = [
  { value: '', label: 'All Categories' },
  { value: 'web_app', label: 'Web Apps' },
  { value: 'mobile_app', label: 'Mobile Apps' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'e_commerce', label: 'E-commerce' },
  { value: 'portfolio', label: 'Portfolios' },
];

export default function PublicProjects() {
  const [location, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [votedProjects, setVotedProjects] = useState<Set<number>>(new Set());
  const [total, setTotal] = useState(0);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          sort: sortBy,
          limit: '24',
          offset: '0',
          ...(selectedCategory && { category: selectedCategory }),
          ...(featuredOnly && { featured: 'true' }),
          ...(searchTerm && { search: searchTerm }),
        });

        console.log('[PublicProjects] Fetching projects with params:', params.toString());
        const response = await apiFetch(`/api/public-projects?${params}`, {
          headers: sessionToken ? getAuthHeaders(sessionToken) : {},
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[PublicProjects] Received data:', { 
            success: data.success, 
            projectCount: data.projects?.length || 0,
            total: data.total 
          });
          if (data.success) {
            setProjects(data.projects || []);
            setTotal(data.total || 0);
            
            // Check vote status for each project
            if (user && sessionToken) {
              const voteChecks = data.projects.map((p: PublicProject) =>
                apiFetch(`/api/public-projects/${p.id}/vote-status`, {
                  headers: getAuthHeaders(sessionToken),
                }).then(res => res.json())
              );
              
              const voteStatuses = await Promise.all(voteChecks);
              const voted = new Set<number>();
              voteStatuses.forEach((status, i) => {
                if (status.success && status.voted) {
                  voted.add(data.projects[i].id);
                }
              });
              setVotedProjects(voted);
            }
          } else {
            console.error('[PublicProjects] API returned success=false:', data);
            toast({
              title: "Error",
              description: data.error || "Failed to load projects",
              variant: "destructive",
            });
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PublicProjects] Failed to fetch projects:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          toast({
            title: "Error",
            description: errorData.error || `Failed to load projects (${response.status})`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('[PublicProjects] Failed to fetch projects:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to load projects. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [sortBy, selectedCategory, featuredOnly, searchTerm, user, sessionToken]);

  const handleVote = async (projectId: number) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    try {
      const response = await apiFetch(`/api/public-projects/${projectId}/vote`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken!),
      });

      if (response.ok) {
        const data = await response.json();
        const isVoted = data.voted;
        
        setVotedProjects(prev => {
          const next = new Set(prev);
          if (isVoted) {
            next.add(projectId);
          } else {
            next.delete(projectId);
          }
          return next;
        });

        // Update local project vote count
        setProjects(prev =>
          prev.map(p =>
            p.id === projectId
              ? { ...p, voteCount: isVoted ? p.voteCount + 1 : Math.max(0, p.voteCount - 1) }
              : p
          )
        );

        toast({
          title: isVoted ? 'Voted!' : 'Vote removed',
          description: isVoted ? 'Thanks for your vote!' : 'Your vote has been removed',
        });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      toast({
        title: 'Error',
        description: 'Failed to vote. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRemix = async (projectId: number) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    try {
      const response = await apiFetch(`/api/public-projects/${projectId}/remix`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken!),
      });

      if (response.ok) {
        const data = await response.json();
        const newProjectId = data.project.id;
        const filesCopied = data.filesCopied || 0;
        
        toast({
          title: 'Project Remixed!',
          description: `Successfully copied ${filesCopied} files. Opening your remix in the playground...`,
        });
        
        // Small delay to ensure backend has processed the remix
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to playground - it will load the project files
        setLocation(`/playground/${newProjectId}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to remix project');
      }
    } catch (error) {
      console.error('Failed to remix:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remix project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Community
          </h1>
          <p className="text-sm text-muted-foreground">
            Discover projects and use ready-made apps from our community
          </p>
        </motion.div>

        {/* Filters and Search */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-md border text-sm bg-background"
              >
                {categoryFilters.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {sortOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Featured Toggle */}
            <button
              onClick={() => setFeaturedOnly(!featuredOnly)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                featuredOnly
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Star className="h-3 w-3 inline mr-1.5" />
              Featured
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-muted-foreground text-xs">
          {loading ? 'Loading...' : `${total} projects`}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-card rounded-lg border aspect-[4/3] animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects.map((project, index) => {
              const categoryGradient = categoryColors[project.projectType] || categoryColors.web_app;
              const categoryLabel = categoryLabels[project.projectType] || project.projectType;
              const isVoted = votedProjects.has(project.id);
              
              // Validate screenshot URL
              const hasValidScreenshot = project.screenshotUrl && 
                (project.screenshotUrl.startsWith('http://') || project.screenshotUrl.startsWith('https://')) &&
                project.screenshotUrl.length > 10;
              const hasValidThumbnail = project.thumbnailUrl && 
                (project.thumbnailUrl.startsWith('http://') || project.thumbnailUrl.startsWith('https://')) &&
                project.thumbnailUrl.length > 10;
              const previewImageUrl = hasValidThumbnail
                ? project.thumbnailUrl
                : hasValidScreenshot
                  ? project.screenshotUrl
                  : null;
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group"
                >
                  <div 
                    className="relative bg-card rounded-lg border overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/public-projects/${project.id}`)}
                  >
                    {/* Screenshot/Thumbnail */}
                    <div className={`aspect-[4/3] relative overflow-hidden bg-muted ${
                      !previewImageUrl ? `bg-gradient-to-br ${categoryGradient}` : ''
                    }`}>
                      {previewImageUrl ? (
                        <img
                          src={previewImageUrl}
                          alt={project.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Hide image and show gradient fallback
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.className = `aspect-[4/3] relative overflow-hidden bg-gradient-to-br ${categoryGradient}`;
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Code className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {/* Stats Overlay */}
                      {project.featured && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="hidden sm:inline">Featured</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate mb-1">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{project.description}</p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{project.viewCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            <span>{project.remixCount}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(project.id);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                            isVoted
                              ? 'text-rose-600'
                              : 'hover:text-rose-600'
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isVoted ? 'fill-current' : ''}`} />
                          <span className="font-medium">{project.voteCount}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
