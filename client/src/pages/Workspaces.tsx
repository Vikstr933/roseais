import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SearchBar } from '@/components/SearchBar';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { JoinProjectDialog } from '@/components/JoinProjectDialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Users, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

export default function Workspaces() {
  return (
    <AuthGuard>
      <WorkspacesContent />
    </AuthGuard>
  );
}

function WorkspacesContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();
  const { sessionToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workspaces'],
    queryFn: async () => {
      const response = await apiFetch('/api/workspaces', {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      setShowCreateDialog(false);
      toast({
        title: 'Project Created',
        description: 'Your new project has been created successfully!',
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

  const filteredProjects = projects.filter(
    project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
              Collaborative Projects
            </h1>
            <p className="text-muted-foreground mt-2">
              Create, collaborate, and build amazing applications with AI agents
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowJoinDialog(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Join Project
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <Code2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Projects Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? 'No projects match your search.'
              : 'Get started by creating your first project.'}
          </p>
          {!searchTerm && (
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Your First Project
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </div>
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
