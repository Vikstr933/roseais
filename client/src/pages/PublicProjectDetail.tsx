import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Eye,
  Heart,
  GitBranch,
  Star,
  Calendar,
  User,
  Code2,
  ExternalLink,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { apiFetch } from '../lib/api';
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
  updatedAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  fileCount: number;
}

const categoryLabels: Record<string, string> = {
  web_app: 'Web App',
  mobile_app: 'Mobile App',
  api: 'API',
  dashboard: 'Dashboard',
  e_commerce: 'E-commerce',
  portfolio: 'Portfolio',
};

function PublicProjectDetail() {
  const [match, params] = useRoute('/public-projects/:id');
  const [, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [files, setFiles] = useState<Array<{ id: number; path: string; name: string }>>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const projectId = params?.id ? Number(params.id) : null;

  // Fetch project details
  const { data: projectData, isLoading } = useQuery<{ success: boolean; project: PublicProject }>({
    queryKey: [`/api/public-projects/${projectId}`],
    enabled: !!projectId,
    queryFn: async () => {
      const response = await apiFetch(`/api/public-projects/${projectId}`, {
        headers: sessionToken ? getAuthHeaders(sessionToken) : {},
      });
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
  });

  const project = projectData?.project;

  // Check vote status
  useEffect(() => {
    if (projectId && user && sessionToken) {
      apiFetch(`/api/public-projects/${projectId}/vote-status`, {
        headers: getAuthHeaders(sessionToken),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setHasVoted(data.voted || false);
          }
        })
        .catch(() => {});
    }
  }, [projectId, user, sessionToken]);

  // Fetch files
  useEffect(() => {
    if (projectId) {
      setFilesLoading(true);
      apiFetch(`/api/public-projects/${projectId}/files`, {
        headers: sessionToken ? getAuthHeaders(sessionToken) : {},
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFiles(data.files || []);
          }
        })
        .catch(() => {})
        .finally(() => setFilesLoading(false));
    }
  }, [projectId, sessionToken]);

  const handleVote = async () => {
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
        setHasVoted(data.voted || false);
        toast({
          title: data.voted ? 'Voted!' : 'Vote removed',
          description: data.voted ? 'Thanks for your vote!' : 'Your vote has been removed',
        });
        // Refresh project data to update vote count
        window.location.reload();
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

  const handleRemix = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    setIsRemixing(true);
    try {
      const response = await apiFetch(`/api/public-projects/${projectId}/remix`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken!),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Project Remixed!',
          description: 'Opening your remix in the playground...',
        });
        
        // Small delay to ensure backend has processed the remix
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to playground - it will load the project files
        setLocation(`/playground/${data.project.id}`);
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
    } finally {
      setIsRemixing(false);
    }
  };

  const copyProjectLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied!',
      description: 'Project link copied to clipboard',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-muted rounded-lg w-1/3" />
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-muted-foreground mb-6">This project doesn't exist or is not public.</p>
          <Button onClick={() => setLocation('/public-projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>
        </div>
      </div>
    );
  }

  const categoryLabel = categoryLabels[project.projectType] || project.projectType;

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      {/* Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-400/20 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-15%] w-[500px] h-[500px] bg-pink-400/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => setLocation('/public-projects')}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Screenshot/Thumbnail */}
            <div className="flex-shrink-0">
              {project.screenshotUrl || project.thumbnailUrl ? (
                <img
                  src={project.screenshotUrl || project.thumbnailUrl || ''}
                  alt={project.name}
                  className="w-full md:w-[500px] h-[300px] md:h-[400px] object-cover rounded-2xl border border-border shadow-2xl"
                />
              ) : (
                <div className="w-full md:w-[500px] h-[300px] md:h-[400px] bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl border border-purple-200 flex items-center justify-center">
                  <Code2 className="h-16 w-16 text-purple-300" />
                </div>
              )}
            </div>

            {/* Project Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {project.featured && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Featured
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-border">
                      {categoryLabel}
                    </Badge>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">{project.name}</h1>
                  {project.description ? (
                    <p className="text-lg text-muted-foreground mb-4">{project.description}</p>
                  ) : (
                    <p className="text-lg text-muted-foreground mb-4 italic">No description provided</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">{project.viewCount || 0}</span>
                  <span className="text-xs text-muted-foreground">views</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{project.voteCount || 0}</span>
                  <span className="text-xs text-muted-foreground">votes</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                  <GitBranch className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{project.remixCount || 0}</span>
                  <span className="text-xs text-muted-foreground">remixes</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                  <Code2 className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">{project.fileCount || 0}</span>
                  <span className="text-xs text-muted-foreground">files</span>
                </div>
              </div>

              {/* Owner Info */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  {project.ownerAvatar ? (
                    <img src={project.ownerAvatar} alt={project.ownerName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">{project.ownerName}</p>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  size="lg"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleRemix}
                  disabled={isRemixing}
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  {isRemixing ? 'Remixing...' : 'Remix Project'}
                </Button>
                <Button
                  size="lg"
                  variant={hasVoted ? 'default' : 'outline'}
                  className={hasVoted ? 'bg-red-500 hover:bg-red-600 text-white' : 'border-border'}
                  onClick={handleVote}
                  disabled={!user}
                >
                  <Heart className={`h-4 w-4 mr-2 ${hasVoted ? 'fill-current' : ''}`} />
                  {hasVoted ? 'Voted' : 'Vote'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border"
                  onClick={copyProjectLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>

              {!user && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Sign in</strong> to remix this project or vote for it!
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          {project.tags && project.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="border-border">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No tags</div>
          )}
        </motion.div>

        {/* Files Section */}
        {project.fileCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Code2 className="h-5 w-5 text-primary" />
                  Project Files ({project.fileCount})
                </CardTitle>
                <CardDescription>Files included in this project</CardDescription>
              </CardHeader>
              <CardContent>
                {filesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading files...</div>
                ) : files.length > 0 ? (
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-1">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-mono text-foreground truncate flex-1">{file.path}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No files found</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Additional Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Code2 className="h-5 w-5 text-primary" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">{categoryLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Files</span>
                <span className="font-medium text-foreground">{project.fileCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-foreground">{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium text-foreground">{new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Star className="h-5 w-5 text-primary" />
                Community Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Views</span>
                <span className="font-medium text-foreground">{project.viewCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Votes</span>
                <span className="font-medium text-foreground">{project.voteCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remixes</span>
                <span className="font-medium text-foreground">{project.remixCount || 0}</span>
              </div>
              {project.featured && (
                <div className="flex items-center gap-2 pt-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">Featured Project</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

// Export default for lazy loading
export default PublicProjectDetail;

