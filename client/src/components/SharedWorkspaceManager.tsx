import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from './ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  Users,
  UserPlus,
  Settings,
  Share2,
  Copy,
  Link,
  Mail,
  Crown,
  Shield,
  Eye,
  Edit3,
  Trash2,
  Clock,
  Globe,
  Lock,
  QrCode,
  Check,
  X,
  RefreshCw,
  Calendar,
  Activity
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface WorkspaceMember {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string;
  lastActive: string;
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canManageMembers: boolean;
    canDelete: boolean;
  };
  status: 'active' | 'pending' | 'suspended';
}

interface WorkspaceSettings {
  id: number;
  name: string;
  description: string;
  isPublic: boolean;
  allowJoinRequests: boolean;
  requireApproval: boolean;
  maxMembers: number;
  inviteCode: string;
  expiresAt: string | null;
  settings: {
    allowComments: boolean;
    allowForking: boolean;
    enableAI: boolean;
    enableWebContainer: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
  message: z.string().optional(),
});

const workspaceSettingsSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  description: z.string().max(500),
  isPublic: z.boolean().default(false),
  allowJoinRequests: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
  maxMembers: z.number().min(1).max(100).default(10),
  allowComments: z.boolean().default(true),
  allowForking: z.boolean().default(true),
  enableAI: z.boolean().default(true),
  enableWebContainer: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
});

interface SharedWorkspaceManagerProps {
  workspaceId: number;
  isOwner: boolean;
  canManage: boolean;
}

export const SharedWorkspaceManager: React.FC<SharedWorkspaceManagerProps> = ({
  workspaceId,
  isOwner,
  canManage
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteForm = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: 'editor',
    },
  });

  const settingsForm = useForm<z.infer<typeof workspaceSettingsSchema>>({
    resolver: zodResolver(workspaceSettingsSchema),
  });

  // Load workspace data
  useEffect(() => {
    loadWorkspaceData();
  }, [workspaceId]);

  const loadWorkspaceData = async () => {
    try {
      setIsLoading(true);

      // Load members
      const membersResponse = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }

      // Load settings
      const settingsResponse = await fetch(`/api/workspaces/${workspaceId}`);
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData);
        settingsForm.reset({
          name: settingsData.name,
          description: settingsData.description || '',
          isPublic: settingsData.isPublic || false,
          allowJoinRequests: settingsData.settings?.allowJoinRequests || false,
          requireApproval: settingsData.settings?.requireApproval || true,
          maxMembers: settingsData.settings?.maxMembers || 10,
          allowComments: settingsData.settings?.allowComments || true,
          allowForking: settingsData.settings?.allowForking || true,
          enableAI: settingsData.settings?.enableAI || true,
          enableWebContainer: settingsData.settings?.enableWebContainer || true,
          theme: settingsData.settings?.theme || 'auto',
        });
      }
    } catch (error) {
      console.error('Failed to load workspace data:', error);
      toast({
        title: "Error",
        description: "Failed to load workspace data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (data: z.infer<typeof inviteSchema>) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Invitation Sent",
          description: `Invitation sent to ${data.email}`,
        });
        setIsInviteDialogOpen(false);
        inviteForm.reset();
        loadWorkspaceData();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to send invitation",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        toast({
          title: "Member Updated",
          description: "Member role updated successfully",
        });
        loadWorkspaceData();
      } else {
        throw new Error('Failed to update member');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Member Removed",
          description: "Member removed from workspace",
        });
        loadWorkspaceData();
      } else {
        throw new Error('Failed to remove member');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSettings = async (data: z.infer<typeof workspaceSettingsSchema>) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Settings Updated",
          description: "Workspace settings updated successfully",
        });
        setIsSettingsDialogOpen(false);
        loadWorkspaceData();
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update workspace settings",
        variant: "destructive",
      });
    }
  };

  const handleGenerateNewInviteCode = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite-code`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "New Invite Code Generated",
          description: "A new invite code has been generated",
        });
        loadWorkspaceData();
      } else {
        throw new Error('Failed to generate invite code');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate new invite code",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: `${description} copied to clipboard`,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'editor': return <Edit3 className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'editor': return 'bg-green-100 text-green-800 border-green-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading workspace data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Workspace Management
          </CardTitle>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to collaborate on this workspace
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...inviteForm}>
                      <form onSubmit={inviteForm.handleSubmit(handleInviteMember)} className="space-y-4">
                        <FormField
                          control={inviteForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input placeholder="colleague@company.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inviteForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer - Read only access</SelectItem>
                                  <SelectItem value="editor">Editor - Can edit and comment</SelectItem>
                                  {isOwner && (
                                    <SelectItem value="admin">Admin - Can manage members</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inviteForm.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Personal Message (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add a personal message to your invitation..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">
                            <Mail className="w-4 h-4 mr-2" />
                            Send Invitation
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                {isOwner && (
                  <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Workspace Settings</DialogTitle>
                        <DialogDescription>
                          Configure your workspace settings and permissions
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...settingsForm}>
                        <form onSubmit={settingsForm.handleSubmit(handleUpdateSettings)} className="space-y-6">
                          <div className="space-y-4">
                            <FormField
                              control={settingsForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Workspace Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={settingsForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-medium">Privacy & Access</h4>
                            <FormField
                              control={settingsForm.control}
                              name="isPublic"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Public Workspace</FormLabel>
                                    <FormDescription>
                                      Make this workspace discoverable and accessible to everyone
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={settingsForm.control}
                              name="allowJoinRequests"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Allow Join Requests</FormLabel>
                                    <FormDescription>
                                      Let people request to join this workspace
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-medium">Features</h4>
                            <FormField
                              control={settingsForm.control}
                              name="allowComments"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Allow Comments</FormLabel>
                                    <FormDescription>
                                      Enable commenting on code and files
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={settingsForm.control}
                              name="enableAI"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel>Enable AI Features</FormLabel>
                                    <FormDescription>
                                      Allow AI-powered code generation and assistance
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">
                              Save Settings
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="sharing">Sharing</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getUserInitials(member.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.displayName}</span>
                        {member.userId === user?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{member.email}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", getRoleColor(member.role))}>
                      {getRoleIcon(member.role)}
                      <span className="ml-1 capitalize">{member.role}</span>
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", getStatusColor(member.status))}>
                      {member.status}
                    </Badge>
                    {canManage && member.userId !== user?.id && member.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        <Select
                          defaultValue={member.role}
                          onValueChange={(value) => handleUpdateMemberRole(member.id, value)}
                        >
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {member.displayName} from this workspace?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sharing" className="space-y-4">
            {settings && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {settings.isPublic ? (
                        <Globe className="w-4 h-4 text-green-500" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-medium">
                        {settings.isPublic ? 'Public Workspace' : 'Private Workspace'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {settings.isPublic
                        ? 'Anyone with the link can view this workspace'
                        : 'Only invited members can access this workspace'
                      }
                    </p>
                  </div>
                </div>

                {settings.inviteCode && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Invite Link</h4>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateNewInviteCode}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Generate New
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <code className="flex-1 text-sm">
                        {window.location.origin}/join/{settings.inviteCode}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}/join/${settings.inviteCode}`,
                            'Invite link'
                          )
                        }
                      >
                        {copied ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg text-center">
                    <Share2 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h4 className="font-medium">Share Link</h4>
                    <p className="text-xs text-gray-500">Send direct invite links</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <QrCode className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <h4 className="font-medium">QR Code</h4>
                    <p className="text-xs text-gray-500">Generate QR for mobile</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Activity tracking coming soon</p>
              <p className="text-sm">See member activity, changes, and collaborations</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SharedWorkspaceManager;