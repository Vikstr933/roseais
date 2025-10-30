import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Code2,
  Users,
  MessageSquare,
  FileText,
  Activity,
  ExternalLink,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    projectType: string;
    projectStatus: string;
    inviteCode?: string;
    members: Array<{
      id: number;
      role: string;
      user: {
        id: string;
        username: string;
        displayName: string;
      };
    }>;
    recentActivity: Array<{
      id: number;
      activityType: string;
      description: string;
      createdAt: string;
    }>;
    fileCount: number;
    agentConfig?: any;
    testCases?: any[];
  };
  onDelete?: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case 'web_app':
        return 'bg-blue-100 text-blue-800';
      case 'mobile_app':
        return 'bg-green-100 text-green-800';
      case 'api':
        return 'bg-purple-100 text-purple-800';
      case 'desktop_app':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const copyInviteCode = () => {
    if (project.inviteCode) {
      navigator.clipboard.writeText(project.inviteCode);
      toast({
        title: 'Invite Code Copied',
        description: 'Share this code with your collaborators',
      });
    }
  };

  const openProject = () => {
    // Navigate to project detail page
    setLocation(`/projects/${project.id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getLastActivity = () => {
    if (project.recentActivity.length === 0) return 'No recent activity';
    const activity = project.recentActivity[0];
    return activity.description;
  };

  const handleDelete = () => {
    if (deleteConfirmation === 'DELETE') {
      onDelete?.();
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    } else {
      toast({
        title: 'Invalid Confirmation',
        description: 'Please type DELETE to confirm',
        variant: 'destructive',
      });
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10 transition-all duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {getProjectTypeIcon(project.projectType)}
              </span>
              <h3 className="text-xl font-semibold truncate">{project.name}</h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openProject}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Project
                </DropdownMenuItem>
                {project.inviteCode && (
                  <DropdownMenuItem onClick={copyInviteCode}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Invite Code
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs ${getProjectTypeColor(project.projectType)}`}
              >
                {project.projectType.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {project.projectStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Updated {formatDate(project.updatedAt)}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>

          {/* Project Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.members.length} member
                {project.members.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.fileCount} file{project.fileCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span>Recent Activity</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {getLastActivity()}
            </p>
          </div>

          {/* Team Members Preview */}
          {project.members.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Users className="h-4 w-4" />
                <span>Team</span>
              </div>
              <div className="flex -space-x-2">
                {project.members.slice(0, 3).map(member => (
                  <div
                    key={member.id}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                    title={`${member.user.displayName} (${member.role})`}
                  >
                    {member.user.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
                {project.members.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                    +{project.members.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button onClick={openProject} size="sm" className="flex-1">
              <Code2 className="h-4 w-4 mr-2" />
              Open Project
            </Button>
            {project.inviteCode && (
              <Button
                onClick={copyInviteCode}
                variant="outline"
                size="sm"
                className="px-3"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workspace
              <strong className="block mt-2 text-foreground">{project.name}</strong>
              and remove all of its data including files, chat history, and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <label className="text-sm font-medium">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmation !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
