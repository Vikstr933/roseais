import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SearchBar } from '@/components/SearchBar';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { JoinProjectDialog } from '@/components/JoinProjectDialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Users, Code2, AlertCircle, Star, LayoutGrid, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Workspaces() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <WorkspacesContent />
      </AuthGuard>
    </ErrorBoundary>
  );
}

function WorkspacesContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { toast } = useToast();
  const { sessionToken } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: projects = [], isLoading, error: projectsError, refetch } = useQuery<any[]>({
    queryKey: ['/api/workspaces'],
    queryFn: async () => {
      try {
        const response = await apiFetch('/api/workspaces', {
          headers: getAuthHeaders(sessionToken),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 60000, // Consider data fresh for 60 seconds (increased to reduce polling)
    refetchOnWindowFocus: false, // Disabled to reduce rate limit issues
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const response = await apiFetch('/api/workspaces', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify(projectData),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return response.json();
    },
    onSuccess: async (newProject) => {
      try {
        // Invalidate and refetch to get the new project
        await queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
        // Wait a bit for the query to refetch
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setShowCreateDialog(false);
        toast({
          title: 'Project Created',
          description: 'Your new project has been created successfully!',
        });
        
        // Optionally navigate to the new project (if we have the ID)
        if (newProject?.id) {
          // Small delay to ensure state is updated
          setTimeout(() => {
            setLocation(`/projects/${newProject.id}`);
          }, 1000);
        }
      } catch (error) {
        console.error('Error after project creation:', error);
        toast({
          title: 'Project Created',
          description: 'Project was created, but there was an issue refreshing the list.',
          variant: 'default',
        });
        // Still close dialog and try to refetch
        setShowCreateDialog(false);
        refetch();
      }
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const joinProjectMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      const response = await apiFetch('/api/workspaces/join', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({ inviteCode }),
      });
      if (!response.ok) throw new Error('Invalid invite code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      setShowJoinDialog(false);
      toast({
        title: 'Joined Project',
        description: 'You have successfully joined the project!',
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: number) => {
      const response = await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) throw new Error('Failed to delete workspace');
      return response.json();
    },
    onMutate: async (workspaceId: number) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/workspaces'] });

      // Snapshot the previous value
      const previousWorkspaces = queryClient.getQueryData(['/api/workspaces']);

      // Optimistically remove the workspace from the UI IMMEDIATELY
      queryClient.setQueryData(['/api/workspaces'], (old: any[] = []) => {
        return old.filter((workspace: any) => workspace.id !== workspaceId);
      });

      // Return context with the snapshot
      return { previousWorkspaces };
    },
    onSuccess: () => {
      toast({
        title: 'Workspace Deleted',
        description: 'The workspace has been permanently deleted.',
      });
      // No need to refetch - optimistic update already removed it from UI
      // Refetching too quickly can cause the deleted workspace to briefly reappear
    },
    onError: (error, workspaceId, context) => {
      // Roll back to previous state if delete failed
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(['/api/workspaces'], context.previousWorkspaces);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const starProjectMutation = useMutation({
    mutationFn: async ({ projectId, isStarred }: { projectId: number; isStarred: boolean }) => {
      const response = await apiFetch(`/api/workspaces/${projectId}/star`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({ isStarred }),
      });
      if (!response.ok) throw new Error('Failed to star project');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
    },
  });

  const handleStar = (projectId: number, isStarred: boolean) => {
    starProjectMutation.mutate({ projectId, isStarred });
  };

  const filteredProjects = projects.filter(
    project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const starredProjects = filteredProjects.filter((p: any) => p.isStarred === true);
  const otherProjects = filteredProjects.filter((p: any) => p.isStarred !== true);

  return (
    <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-8">
      {/* Spacing to account for fixed header (h-14 sm:h-16 = 56px/64px) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold brand-gradient-text mb-2">
              Collaborative Projects
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create, collaborate, and build amazing applications with AI agents
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setShowJoinDialog(true)}
              variant="outline"
              className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Join Project</span>
              <span className="sm:hidden">Join</span>
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <SearchBar onSearch={setSearchTerm} />
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {projectsError ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 sm:py-16 px-4"
        >
          <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-destructive mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">Error Loading Projects</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {projectsError instanceof Error ? projectsError.message : 'Failed to load projects'}
          </p>
          <Button onClick={() => refetch()} className="min-h-[44px] px-6">
            Try Again
          </Button>
        </motion.div>
      ) : isLoading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8' : 'space-y-2 mt-6 sm:mt-8'}>
          {/* Premium skeleton cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={viewMode === 'grid' ? 'rounded-lg border border-border/50 bg-card p-4 animate-pulse' : 'rounded-lg border border-border/50 bg-card p-3 animate-pulse'}>
              {viewMode === 'grid' ? (
                <>
                  <div className="flex items-start gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-muted" />
                      <div className="h-2.5 w-1/2 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <div className="h-2.5 w-full rounded bg-muted" />
                    <div className="h-2.5 w-2/3 rounded bg-muted" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 w-14 rounded-full bg-muted" />
                    <div className="h-5 w-10 rounded-full bg-muted" />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/4 rounded bg-muted" />
                    <div className="h-2 w-1/2 rounded bg-muted" />
                  </div>
                  <div className="h-6 w-16 rounded bg-muted" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 sm:py-16 px-4"
        >
          <Code2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">No Projects Found</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {searchTerm
              ? 'No projects match your search.'
              : 'Get started by creating your first project.'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="min-h-[44px] px-6"
            >
              Create Your First Project
            </Button>
          )}
        </motion.div>
      ) : (
        <>
          {starredProjects.length > 0 && (
            <div className="mb-4">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                Starred Projects
              </h2>
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4' : 'space-y-2'}>
                {starredProjects.map((project: any, index: number) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ProjectCard
                      project={project}
                      onDelete={() => deleteWorkspaceMutation.mutate(project.id)}
                      onStar={handleStar}
                      variant={viewMode}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {otherProjects.length > 0 && (
            <div>
              {starredProjects.length > 0 && (
                <h2 className="text-base font-semibold mb-3">All Projects</h2>
              )}
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4' : 'space-y-2'}>
                {otherProjects.map((project: any, index: number) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ProjectCard
                      project={project}
                      onDelete={() => deleteWorkspaceMutation.mutate(project.id)}
                      onStar={handleStar}
                      variant={viewMode}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {filteredProjects.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 sm:py-16 px-4"
            >
              <Code2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">No Projects Found</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                {searchTerm
                  ? 'No projects match your search.'
                  : 'Get started by creating your first project.'}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="min-h-[44px] px-6"
                >
                  Create Your First Project
                </Button>
              )}
            </motion.div>
          )}
        </>
      )}

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateProject={createProjectMutation.mutate}
        isLoading={createProjectMutation.isPending}
      />

      <JoinProjectDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        onJoinProject={joinProjectMutation.mutate}
        isLoading={joinProjectMutation.isPending}
      />
    </div>
  );
}
