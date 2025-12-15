import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { AuthGuard } from '@/components/AuthGuard';
import {
  ArrowLeft,
  Users,
  MessageSquare,
  FileText,
  Activity,
  Send,
  Copy,
  Settings,
  Play,
  Code2,
  Share2,
  QrCode,
  Link,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import ActiveUsersIndicator from '@/components/ActiveUsersIndicator';
import { useUserActivity } from '@/hooks/useUserActivity';
import { FileEditor } from '@/components/FileEditor';
import { OptimizedIDE } from '@/components/IDE/OptimizedIDE';

// Type definitions for project data
interface ProjectMember {
  id: number;
  projectId: number;
  userId: string;
  role: string;
  joinedAt: string;
  permissions: string;
  isActive: number;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}

interface ProjectFile {
  id: number;
  projectId: number;
  filePath: string;
  fileContent: string;
  fileType: string;
  createdBy: string;
  lastModifiedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isActive: number;
}

interface ProjectChatMessage {
  id: number;
  projectId: number;
  userId: string;
  message: string;
  messageType: string;
  metadata: string;
  createdAt: string;
  isEdited: number;
  editedAt: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}

interface ProjectActivity {
  id: number;
  projectId: number;
  userId: string;
  activityType: string;
  description: string;
  metadata: string;
  createdAt: string;
}

export default function ProjectDetail() {
  return (
    <AuthGuard>
      <ProjectDetailContent />
    </AuthGuard>
  );
}

function ProjectDetailContent() {
  const [match, params] = useRoute('/projects/:id');
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const { sessionToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [showIDE, setShowIDE] = useState(false);
  const { trackViewing, trackChatting } = useUserActivity();

  const { data: project, isLoading, error: projectError } = useQuery({
    queryKey: [`/api/workspaces/${id}`],
    enabled: !!id && !!sessionToken,
    queryFn: async () => {
      console.log('[ProjectDetail] Fetching project:', id);
      const response = await apiFetch(`/api/workspaces/${id}`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ProjectDetail] Failed to fetch project:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to fetch project');
      }
      const data = await response.json();
      console.log('[ProjectDetail] Project loaded:', data);
      return data;
    },
    retry: 1,
  });

  const { data: chatMessages = [] } = useQuery({
    queryKey: [`/api/workspaces/${id}/chat`],
    enabled: !!id,
    queryFn: async () => {
      const response = await apiFetch(`/api/workspaces/${id}/chat`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) throw new Error('Failed to fetch chat messages');
      return response.json();
    },
  });

  const { data: projectFiles = [] } = useQuery({
    queryKey: [`/api/workspaces/${id}/files`],
    enabled: !!id,
    queryFn: async () => {
      const response = await apiFetch(`/api/workspaces/${id}/files`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) throw new Error('Failed to fetch project files');
      return response.json();
    },
  });

  // Track viewing activity when component mounts
  useEffect(() => {
    if (id && user) {
      trackViewing(parseInt(id));
    }
  }, [id, user, trackViewing]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiFetch(`/api/workspaces/${id}/chat`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${id}/chat`],
      });
      setNewMessage('');
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    // Track chatting activity when sending a message
    if (id && user) {
      trackChatting(parseInt(id), { messageLength: newMessage.length });
    }

    sendMessageMutation.mutate(newMessage);
  };

  const copyInviteCode = () => {
    if (project?.inviteCode) {
      navigator.clipboard.writeText(project.inviteCode);
      toast({
        title: 'Invite Code Copied',
        description: 'Share this code with your collaborators',
      });
    }
  };

  const openInPlayground = () => {
    // Navigate to playground with project context
    setLocation(`/playground/${id}`);
  };

  const openProjectSettings = () => {
    // Navigate to project settings (you can implement a settings page later)
    toast({
      title: 'Project Settings',
      description: 'Settings page coming soon! You can update workspace details here.',
    });
  };

  const shareProject = () => {
    setShowShareDialog(true);
  };

  const copyShareLink = () => {
    if (project?.inviteCode) {
      const shareUrl = `${window.location.origin}/workspaces/join?code=${project.inviteCode}`;
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Share Link Copied',
        description: 'Anyone with this link can request to join the project',
      });
    }
  };

  const downloadQRCode = () => {
    if (project?.inviteCode) {
      const shareUrl = `${window.location.origin}/workspaces/join?code=${project.inviteCode}`;
      // Generate QR code using a simple service
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

      // Download the QR code
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `${project.name}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'QR Code Downloaded',
        description: 'Team members can scan this to join your project',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (projectError) {
    console.error('[ProjectDetail] Project error:', projectError);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Project</h1>
          <p className="text-muted-foreground mb-4">
            {projectError instanceof Error ? projectError.message : 'An error occurred'}
          </p>
          <Button onClick={() => setLocation('/workspaces')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => setLocation('/workspaces')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/workspaces')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <span>
                  {getProjectTypeIcon(project.projectType || 'web_app')}
                </span>
                {project.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {project.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {project.projectType?.replace('_', ' ') || 'Unknown'}
            </Badge>
            <Badge variant="outline">
              {project.projectStatus || 'Unknown'}
            </Badge>
            {project.inviteCode && (
              <Button variant="outline" size="sm" onClick={copyInviteCode}>
                <Copy className="h-4 w-4 mr-2" />
                {project.inviteCode}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Project Stats */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </h3>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.members?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Active collaborators
                </p>
                {project.members && project.members.length > 0 && (
                  <div className="flex -space-x-2 mt-3">
                    {project.members
                      .slice(0, 5)
                      .map((member: ProjectMember) => (
                        <div
                          key={member.id}
                          className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                          title={`${member.user.displayName} (${member.role})`}
                        >
                          {member.user.displayName.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    {project.members.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                        +{project.members.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Files
                </h3>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.fileCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">Project files</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={openInPlayground}
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  Open in Playground
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </h3>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.recentActivity?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Recent actions</p>
                {project.recentActivity &&
                  project.recentActivity.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {project.recentActivity[0]?.description ||
                        'No description'}
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Active Users Indicator */}
          {id && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Live Activity
                </h3>
              </CardHeader>
              <CardContent>
                <ActiveUsersIndicator
                  projectId={parseInt(id)}
                  currentUserId={user?.id}
                />
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Quick Actions</h3>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={openInPlayground}>
                  <Play className="h-4 w-4 mr-2" />
                  Generate in Playground
                </Button>
                <Button variant="outline" onClick={openProjectSettings}>
                  <Settings className="h-4 w-4 mr-2" />
                  Project Settings
                </Button>
                {project.inviteCode && (
                  <Button variant="outline" onClick={shareProject}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Project
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Share Dialog */}
          {showShareDialog && project?.inviteCode && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Share Project
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShareDialog(false)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Invite Code Section */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={project.inviteCode}
                      readOnly
                      className="font-mono"
                    />
                    <Button variant="outline" onClick={copyInviteCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Share Link Section */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Share Link
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${window.location.origin}/workspaces/join?code=${project.inviteCode}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={copyShareLink}>
                      <Link className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* QR Code Section */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    QR Code
                  </label>
                  <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        `${window.location.origin}/workspaces/join?code=${project.inviteCode}`
                      )}`}
                      alt="Project QR Code"
                      className="w-48 h-48 border-4 border-background rounded-lg"
                    />
                    <Button onClick={downloadQRCode} size="sm">
                      <QrCode className="h-4 w-4 mr-2" />
                      Download QR Code
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Team members can scan this to join your project
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Project Files</h3>
            </CardHeader>
            <CardContent>
              {projectFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="text-lg font-medium mb-2">No Files Yet</h4>
                  <p className="text-muted-foreground mb-4">
                    Generate components in the playground and export them to
                    this project
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={openInPlayground}>
                      <Play className="h-4 w-4 mr-2" />
                      Start Building
                    </Button>
                    <Button onClick={() => setShowIDE(true)} variant="outline">
                      <Code2 className="h-4 w-4 mr-2" />
                      Open IDE
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mb-4 flex justify-between items-center">
                    <h4 className="text-sm font-medium">Click a file to edit, or open IDE for full experience</h4>
                    <Button onClick={() => setShowIDE(true)} size="sm">
                      <Code2 className="h-4 w-4 mr-2" />
                      Open IDE
                    </Button>
                  </div>
                  {projectFiles.map((file: ProjectFile) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {file.filePath.endsWith('.tsx')
                            ? '⚛️'
                            : file.filePath.endsWith('.ts')
                              ? '📄'
                              : file.filePath.endsWith('.css')
                                ? '🎨'
                                : '📁'}
                        </span>
                        <div>
                          <p className="font-medium">{file.filePath}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.fileType} • v{file.version}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Project Chat
              </h3>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h4 className="text-lg font-medium mb-2">
                        No Messages Yet
                      </h4>
                      <p className="text-muted-foreground">
                        Start a conversation with your team
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((message: ProjectChatMessage) => (
                      <div
                        key={message.id}
                        className="flex gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                          {message.user?.displayName?.charAt(0).toUpperCase() ||
                            'U'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {message.user?.displayName || 'Unknown User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Project Activity
              </h3>
            </CardHeader>
            <CardContent>
              {project.recentActivity && project.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {project.recentActivity.map((activity: ProjectActivity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="text-lg font-medium mb-2">No Activity Yet</h4>
                  <p className="text-muted-foreground">
                    Project activity will appear here as team members work
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* File Editor Modal - Simple single file editor */}
      {selectedFile && id && !showIDE && (
        <FileEditor
          file={{
            id: selectedFile.id,
            filePath: selectedFile.filePath,
            fileContent: selectedFile.fileContent || '',
            fileType: selectedFile.fileType,
            version: selectedFile.version,
          }}
          projectId={id}
          onClose={() => setSelectedFile(null)}
          onSave={() => {
            queryClient.invalidateQueries({
              queryKey: [`/api/workspaces/${id}/files`],
            });
          }}
        />
      )}

      {/* Full IDE - Optimized */}
      {showIDE && id && (
        <OptimizedIDE
          projectId={id}
          projectFiles={projectFiles}
          onClose={() => setShowIDE(false)}
          onFilesUpdate={() => {
            queryClient.invalidateQueries({
              queryKey: [`/api/workspaces/${id}/files`],
            });
          }}
        />
      )}
    </div>
  );
}
