import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  X,
  Globe,
  Lock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import ActiveUsersIndicator from '@/components/ActiveUsersIndicator';
import { useUserActivity } from '@/hooks/useUserActivity';
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
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showIDE, setShowIDE] = useState(false);
  const [initialFileId, setInitialFileId] = useState<number | undefined>(undefined);
  const [privacySettings, setPrivacySettings] = useState({
    isPublic: false,
    allowComments: true,
    allowFork: true,
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const { trackViewing, trackChatting } = useUserActivity();

  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/workspaces/${id}`],
    enabled: !!id,
    queryFn: async () => {
      const response = await apiFetch(`/api/workspaces/${id}`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
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
    setShowProjectSettings(true);
    // Fetch current privacy settings
    if (project) {
      setPrivacySettings({
        isPublic: project.isPublic || false,
        allowComments: project.allowComments !== false,
        allowFork: project.allowFork !== false,
      });
    }
  };

  const updatePrivacySettings = async () => {
    if (!id || !sessionToken) return;

    setIsUpdatingSettings(true);
    try {
      const response = await apiFetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          isPublic: privacySettings.isPublic,
          allowComments: privacySettings.allowComments,
          allowFork: privacySettings.allowFork,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update settings');
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/workspaces/${id}`],
      });

      toast({
        title: 'Settings Updated!',
        description: 'Privacy settings have been saved',
      });

      setShowProjectSettings(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingSettings(false);
    }
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

  if (!project) {
    return (
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
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
    <div className="container mx-auto px-3 pt-16 sm:pt-20 pb-4 max-w-7xl">
      {/* Minimalist Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setLocation('/workspaces')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {project.projectType?.replace('_', ' ') || 'Unknown'}
            </Badge>
            {project.inviteCode && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyInviteCode}>
                <Copy className="h-3 w-3 mr-1" />
                {project.inviteCode}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="files" className="space-y-3">
        <TabsList className="h-8 grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-xs py-1">Overview</TabsTrigger>
          <TabsTrigger value="files" className="text-xs py-1">Files</TabsTrigger>
          <TabsTrigger value="chat" className="text-xs py-1">Chat</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs py-1">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Project Stats - Compact */}
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">Members</h3>
                </div>
                <div className="text-lg font-semibold">
                  {project.members?.length || 0}
                </div>
              </div>
              {project.members && project.members.length > 0 && (
                <div className="flex -space-x-1.5 mt-2">
                  {project.members
                    .slice(0, 4)
                    .map((member: ProjectMember) => (
                      <div
                        key={member.id}
                        className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[10px] font-medium"
                        title={`${member.user.displayName} (${member.role})`}
                      >
                        {member.user.displayName.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  {project.members.length > 4 && (
                    <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] font-medium">
                      +{project.members.length - 4}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">Files</h3>
                </div>
                <div className="text-lg font-semibold">
                  {project.fileCount || 0}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs mt-2 px-2"
                onClick={openInPlayground}
              >
                <Code2 className="h-3 w-3 mr-1" />
                Playground
              </Button>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">Activity</h3>
                </div>
                <div className="text-lg font-semibold">
                  {project.recentActivity?.length || 0}
                </div>
              </div>
              {project.recentActivity && project.recentActivity.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                  {project.recentActivity[0]?.description || 'No description'}
                </p>
              )}
            </Card>
          </div>

          {/* Active Users Indicator - Compact */}
          {id && (
            <Card className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-medium text-muted-foreground uppercase">Live Activity</h3>
              </div>
              <ActiveUsersIndicator
                  projectId={parseInt(id)}
                  currentUserId={user?.id}
                />
            </Card>
          )}

          {/* Quick Actions - Compact */}
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-medium text-muted-foreground uppercase">Actions</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setShowIDE(true)}
              >
                <Code2 className="h-3 w-3 mr-1" />
                IDE
              </Button>
              <Button 
                size="sm"
                className="h-7 text-xs px-2"
                onClick={openInPlayground}
              >
                <Play className="h-3 w-3 mr-1" />
                Playground
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-7 text-xs px-2"
                onClick={openProjectSettings}
              >
                <Settings className="h-3 w-3 mr-1" />
                Settings
              </Button>
              {project.inviteCode && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={shareProject}
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Share
                </Button>
              )}
            </div>
          </Card>

          {/* Share Dialog */}
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share "{project?.name}"
                </DialogTitle>
              </DialogHeader>
              {project?.inviteCode && (
                <div className="space-y-4">
                  {/* Invite Code Section */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Invite Code</Label>
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
                    <Label className="text-sm font-medium mb-2 block">Share Link</Label>
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
                    <Label className="text-sm font-medium mb-2 block">QR Code</Label>
                    <div className="flex flex-col items-center gap-3 p-4 bg-muted rounded-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          `${window.location.origin}/workspaces/join?code=${project.inviteCode}`
                        )}`}
                        alt="Project QR Code"
                        className="w-32 h-32 border-2 border-background rounded-md"
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
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Project Settings Dialog */}
          <Dialog open={showProjectSettings} onOpenChange={setShowProjectSettings}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Project Settings
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Privacy Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {privacySettings.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      Privacy Settings
                    </CardTitle>
                    <CardDescription>
                      Control who can access and interact with your project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="public">Make Project Public</Label>
                        <p className="text-sm text-muted-foreground">
                          Anyone with the link can view this project
                        </p>
                      </div>
                      <Switch
                        id="public"
                        checked={privacySettings.isPublic}
                        onCheckedChange={(checked) =>
                          setPrivacySettings(prev => ({ ...prev, isPublic: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="comments">Allow Comments</Label>
                        <p className="text-sm text-muted-foreground">
                          Let viewers leave feedback on your project
                        </p>
                      </div>
                      <Switch
                        id="comments"
                        checked={privacySettings.allowComments}
                        onCheckedChange={(checked) =>
                          setPrivacySettings(prev => ({ ...prev, allowComments: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="fork">Allow Forking</Label>
                        <p className="text-sm text-muted-foreground">
                          Let others create their own copy of this project
                        </p>
                      </div>
                      <Switch
                        id="fork"
                        checked={privacySettings.allowFork}
                        onCheckedChange={(checked) =>
                          setPrivacySettings(prev => ({ ...prev, allowFork: checked }))
                        }
                      />
                    </div>

                    <Button 
                      onClick={updatePrivacySettings} 
                      className="w-full"
                      disabled={isUpdatingSettings}
                    >
                      {isUpdatingSettings ? 'Updating...' : 'Update Settings'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          {projectFiles.length === 0 ? (
            <Card className="p-6">
              <div className="text-center py-6">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <h4 className="text-sm font-medium mb-1">No Files Yet</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate components in the playground and export them to this project
                </p>
                <Button size="sm" className="h-7 text-xs" onClick={openInPlayground}>
                  <Play className="h-3 w-3 mr-1" />
                  Start Building
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-1">
              {projectFiles.map((file: ProjectFile) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 hover:border-primary/20 cursor-pointer transition-all text-sm group"
                  onClick={() => {
                    setInitialFileId(file.id);
                    setShowIDE(true);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{file.filePath}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.fileType} • v{file.version}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card className="h-[500px] flex flex-col">
            <CardHeader className="p-3 border-b">
              <h3 className="text-xs font-medium flex items-center gap-1.5 uppercase text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </h3>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-3">
              <ScrollArea className="flex-1 mb-3">
                <div className="space-y-2">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <h4 className="text-sm font-medium mb-1">No Messages Yet</h4>
                      <p className="text-xs text-muted-foreground">
                        Start a conversation with your team
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((message: ProjectChatMessage) => (
                      <div
                        key={message.id}
                        className="flex gap-2 p-2 rounded-md bg-muted/30"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {message.user?.displayName?.charAt(0).toUpperCase() ||
                            'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-medium text-xs">
                              {message.user?.displayName || 'Unknown User'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(message.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs">{message.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-1.5">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="h-8 text-xs"
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          {project.recentActivity && project.recentActivity.length > 0 ? (
            <div className="space-y-1">
              {project.recentActivity.map((activity: ProjectActivity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-2 p-2 border rounded-md"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">{activity.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-6">
              <div className="text-center py-6">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <h4 className="text-sm font-medium mb-1">No Activity Yet</h4>
                <p className="text-xs text-muted-foreground">
                  Project activity will appear here as team members work
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Full IDE Modal */}
      {showIDE && id && (
        <OptimizedIDE
          projectId={id}
          projectFiles={projectFiles}
          initialFileId={initialFileId}
          onClose={() => {
            setShowIDE(false);
            setInitialFileId(undefined);
          }}
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
