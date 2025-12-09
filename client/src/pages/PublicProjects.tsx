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
  Play,
  Copy,
  ExternalLink,
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50 text-gray-900 pt-20">
      {/* Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-400/40 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-15%] w-[500px] h-[500px] bg-pink-400/40 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-gray-900">From the</span>{' '}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Community
            </span>
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl">
            Discover, remix, and build upon projects created by our community
          </p>
        </motion.div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="pl-12 bg-white/95 border-purple-200/50 text-gray-900 placeholder:text-gray-400 h-12"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/95 border border-purple-200/50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {categoryFilters.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 flex-wrap">
              {sortOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === option.value
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                        : 'bg-white/90 text-gray-700 hover:bg-purple-50 hover:text-purple-700 border border-purple-200/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Featured Toggle */}
            <button
              onClick={() => setFeaturedOnly(!featuredOnly)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                featuredOnly
                  ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30'
                  : 'bg-white/90 text-gray-700 hover:bg-purple-50 hover:text-purple-700 border border-purple-200/50'
              }`}
            >
              <Star className="h-4 w-4 inline mr-2" />
              Featured
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 text-gray-600 text-sm">
          {loading ? 'Loading...' : `${total} projects found`}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white/90 rounded-2xl border border-purple-200/50 aspect-[4/3] animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FileCode className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No projects found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => {
              const categoryGradient = categoryColors[project.projectType] || categoryColors.web_app;
              const categoryLabel = categoryLabels[project.projectType] || project.projectType;
              const isVoted = votedProjects.has(project.id);
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden hover:border-purple-300/70 transition-all duration-500 shadow-lg hover:shadow-xl">
                    {/* Screenshot/Thumbnail */}
                    <div className={`aspect-[4/3] relative overflow-hidden ${
                      project.screenshotUrl || project.thumbnailUrl
                        ? ''
                        : `bg-gradient-to-br ${categoryGradient}`
                    }`}>
                      {project.screenshotUrl || project.thumbnailUrl ? (
                        <img
                          src={project.screenshotUrl || project.thumbnailUrl || ''}
                          alt={project.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to gradient if image fails
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.className += ` bg-gradient-to-br ${categoryGradient}`;
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="p-6 rounded-2xl bg-white/90 backdrop-blur-sm border border-purple-200/50 shadow-lg">
                            <FileCode className="h-12 w-12 text-purple-600" />
                          </div>
                        </div>
                      )}
                      
                      {/* Stats Overlay */}
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                        {project.featured && (
                          <div className="px-3 py-1.5 rounded-full bg-amber-100 backdrop-blur-sm border border-amber-300/50 text-amber-700 text-xs font-semibold flex items-center gap-1.5">
                            <Star className="h-3 w-3 fill-current" />
                            Featured
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <div className="px-2 py-1 rounded-full bg-white/95 backdrop-blur-sm text-purple-700 text-xs flex items-center gap-1 border border-purple-200/50 shadow-md">
                            <Code className="h-3 w-3" />
                            {project.fileCount}
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-600/90 via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
                          onClick={() => setLocation(`/public-projects/${project.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Project
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-white/90 hover:bg-white text-purple-700 border-purple-200/50"
                          onClick={() => handleRemix(project.id)}
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          Remix
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-gray-900 font-semibold text-lg group-hover:text-violet-600 transition-colors truncate">
                            {project.name}
                          </h3>
                          <p className="text-gray-600 text-sm capitalize">{categoryLabel}</p>
                        </div>
                      </div>
                      
                      {project.description && (
                        <p className="text-gray-700 text-sm line-clamp-2 mb-3">{project.description}</p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between pt-3 border-t border-purple-200/30">
                        <div className="flex items-center gap-4 text-gray-600 text-xs">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            <span>{project.viewCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5" />
                            <span>{project.remixCount}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleVote(project.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                            isVoted
                              ? 'bg-rose-100 text-rose-600 border border-rose-300/50'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200/50'
                          }`}
                        >
                          <Heart className={`h-4 w-4 ${isVoted ? 'fill-current' : ''}`} />
                          <span className="text-sm font-medium">{project.voteCount}</span>
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
