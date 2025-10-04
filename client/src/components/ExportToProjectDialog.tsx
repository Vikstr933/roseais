import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderPlus, FileText, Users, Activity, Rocket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeploymentPage } from '@/pages/DeploymentPage';

interface ExportToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: Array<{ path: string; content: string }>;
  componentName: string;
}

export function ExportToProjectDialog({
  open,
  onOpenChange,
  files,
  componentName,
}: ExportToProjectDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showDeployment, setShowDeployment] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/workspaces'],
  });

  const exportMutation = useMutation({
    mutationFn: async ({
      projectId,
      files,
      componentName,
    }: {
      projectId: number;
      files: any[];
      componentName: string;
    }) => {
      const response = await fetch(`/api/workspaces/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, componentName }),
      });
      if (!response.ok) throw new Error('Failed to export to project');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      onOpenChange(false);
      toast({
        title: 'Export Successful',
        description: `Successfully exported ${componentName} to project`,
      });
    },
    onError: error => {
      toast({
        title: 'Export Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleExport = () => {
    if (!selectedProjectId) return;

    exportMutation.mutate({
      projectId: parseInt(selectedProjectId),
      files,
      componentName,
    });
  };

  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return '⚛️';
      case 'ts':
      case 'js':
        return '📄';
      case 'css':
        return '🎨';
      case 'json':
        return '⚙️';
      case 'md':
        return '📝';
      default:
        return '📁';
    }
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case 'web_app':
        return '🌐';
      case 'mobile_app':
        return '📱';
      case 'api':
        return '🔌';
      case 'desktop_app':
        return '💻';
      default:
        return '📁';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Export to Project
            </DialogTitle>
            <DialogDescription>
              Choose a project to export your generated component to. This will
              add the files to the project and make them available for
              collaboration.
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-6">
          {/* Component Preview */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Component to Export</h4>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚛️</span>
              <span className="font-medium">{componentName}</span>
              <Badge variant="secondary" className="text-xs">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            <ScrollArea className="h-32">
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span>{getFileIcon(file.path)}</span>
                    <span className="font-mono text-xs">{file.path}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Project Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold">Select Project</label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a project to export to..." />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <FolderPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No projects available</p>
                    <p className="text-xs">
                      Create a project first to export to
                    </p>
                  </div>
                ) : (
                  projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{getProjectTypeIcon(project.projectType)}</span>
                        <span>{project.name}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {project.members?.length || 0} member
                          {(project.members?.length || 0) !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Project Info */}
          {selectedProjectId && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              {(() => {
                const project = projects.find(
                  p => p.id.toString() === selectedProjectId
                );
                if (!project) return null;

                return (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Project Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{getProjectTypeIcon(project.projectType)}</span>
                        <span>{project.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>
                          {project.members?.length || 0} member
                          {(project.members?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>
                          {project.fileCount || 0} file
                          {(project.fileCount || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        <span className="capitalize">
                          {project.projectStatus}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Export Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              What happens when you export?
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Files will be added to the selected project</li>
              <li>• Team members will be notified of the new files</li>
              <li>• Files will be available for collaborative editing</li>
              <li>• Project activity will be logged</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeployment(true)}
              className="flex-1 sm:flex-none"
            >
              <Rocket className="h-4 w-4 mr-2" />
              Deploy Globally
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={exportMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
          </div>
          <Button
            onClick={handleExport}
            disabled={!selectedProjectId || exportMutation.isPending}
            className="w-full sm:w-auto"
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export to Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Deployment Dialog */}
    {showDeployment && (
      <Dialog open={showDeployment} onOpenChange={setShowDeployment}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0">
          <DeploymentPage
            componentName={componentName}
            files={files}
            onBack={() => setShowDeployment(false)}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
