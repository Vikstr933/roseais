import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Key, 
  Rocket, 
  Users, 
  Trash2,
  Save,
  AlertTriangle,
  Plus,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProjectSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  projectDescription?: string;
  isPublic?: boolean;
  onProjectUpdate?: () => void;
}

interface ProjectAPIKey {
  id: string;
  serviceName: string;
  name: string;
  keyType: string;
  createdAt: string;
  lastUsed?: string;
  isShared: boolean;
}

interface Member {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectDescription,
  isPublic,
  onProjectUpdate
}: ProjectSettingsProps) {
  const { sessionToken, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  
  // General tab
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription || '');
  const [visibility, setVisibility] = useState(isPublic || false);
  
  // API Keys tab
  const [apiKeys, setApiKeys] = useState<ProjectAPIKey[]>([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', serviceName: '', value: '', keyType: 'api_key' });
  
  // Members tab
  const [members, setMembers] = useState<Member[]>([]);
  
  // Publishing tab
  const [publishingPolicy, setPublishingPolicy] = useState({
    allowExternalPublishing: true,
    allowedRoles: ['admin', 'owner']
  });

  useEffect(() => {
    if (open) {
      setName(projectName);
      setDescription(projectDescription || '');
      setVisibility(isPublic || false);
      fetchProjectData();
    }
  }, [open, projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch API keys
      const keysRes = await apiFetch(`/api/workspaces/${projectId}/api-keys`, {
        headers: getAuthHeaders(sessionToken)
      });
      if (keysRes.ok) {
        const keys = await keysRes.json();
        setApiKeys(keys || []);
      }

      // Fetch members
      const membersRes = await apiFetch(`/api/workspaces/${projectId}/members`, {
        headers: getAuthHeaders(sessionToken)
      });
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }

      // Fetch publishing policy
      const policyRes = await apiFetch(`/api/workspaces/${projectId}/publishing-policy`, {
        headers: getAuthHeaders(sessionToken)
      });
      if (policyRes.ok) {
        const data = await policyRes.json();
        setPublishingPolicy(data.policy || publishingPolicy);
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    }
  };

  const handleSaveGeneral = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/workspaces/${projectId}`, {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          name,
          description,
          isPublic: visibility
        })
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Project settings updated'
        });
        onProjectUpdate?.();
      } else {
        throw new Error('Failed to update project');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update project settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAPIKey = async () => {
    if (!newKey.name || !newKey.serviceName || !newKey.value) {
      toast({
        title: 'Error',
        description: 'All fields are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await apiFetch(`/api/workspaces/${projectId}/api-keys`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify(newKey)
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'API key added'
        });
        setNewKey({ name: '', serviceName: '', value: '', keyType: 'api_key' });
        setShowAddKey(false);
        fetchProjectData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add API key',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/workspaces/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(sessionToken)
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Project deleted'
        });
        onOpenChange(false);
        onProjectUpdate?.();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Project Settings: {projectName}
            </DialogTitle>
            <DialogDescription>
              Configure settings for this specific project.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pb-6">
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
              <TabsTrigger value="publishing" className="text-xs">Publishing</TabsTrigger>
              <TabsTrigger value="api-keys" className="text-xs">API Keys</TabsTrigger>
              <TabsTrigger value="deployment" className="text-xs">Deployment</TabsTrigger>
              <TabsTrigger value="members" className="text-xs">Members</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
            </TabsList>

            <div className="max-h-[55vh] overflow-y-auto">
              {/* General Tab */}
              <TabsContent value="general" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Project Name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Awesome Project"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A brief description of your project"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Public Visibility</Label>
                        <p className="text-xs text-muted-foreground">
                          Make this project visible in the Community
                        </p>
                      </div>
                      <Switch
                        checked={visibility}
                        onCheckedChange={setVisibility}
                      />
                    </div>
                    <Button onClick={handleSaveGeneral} disabled={loading} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Publishing Tab */}
              <TabsContent value="publishing" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">External Publishing</CardTitle>
                    <CardDescription>
                      Control who can deploy this project to Vercel or other platforms.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Allow External Publishing</Label>
                          <p className="text-xs text-muted-foreground">
                            Enable deployment to external platforms
                          </p>
                        </div>
                        <Switch
                          checked={publishingPolicy.allowExternalPublishing}
                          onCheckedChange={(checked) => {
                            setPublishingPolicy(prev => ({
                              ...prev,
                              allowExternalPublishing: checked
                            }));
                          }}
                        />
                      </div>

                      {publishingPolicy.allowExternalPublishing && (
                        <div className="space-y-2 p-4 rounded-lg border">
                          <Label className="text-sm font-medium">Allowed Roles</Label>
                          <p className="text-xs text-muted-foreground mb-3">
                            Select which roles can deploy this project
                          </p>
                          <div className="space-y-2">
                            {['admin', 'owner', 'superadmin'].map((role) => (
                              <div key={role} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`role-${role}`}
                                  checked={publishingPolicy.allowedRoles.includes(role)}
                                  onChange={(e) => {
                                    const currentRoles = publishingPolicy.allowedRoles;
                                    setPublishingPolicy(prev => ({
                                      ...prev,
                                      allowedRoles: e.target.checked
                                        ? [...currentRoles, role]
                                        : currentRoles.filter(r => r !== role)
                                    }));
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor={`role-${role}`} className="text-sm font-normal capitalize cursor-pointer">
                                  {role}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button 
                        onClick={async () => {
                          try {
                            const res = await apiFetch(`/api/workspaces/${projectId}/publishing-policy`, {
                              method: 'PUT',
                              headers: getAuthHeaders(sessionToken),
                              body: JSON.stringify(publishingPolicy)
                            });

                            if (res.ok) {
                              toast({
                                title: 'Success',
                                description: 'Publishing policy updated'
                              });
                            } else {
                              throw new Error('Failed to update policy');
                            }
                          } catch (error) {
                            toast({
                              title: 'Error',
                              description: 'Failed to update publishing policy',
                              variant: 'destructive'
                            });
                          }
                        }}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Publishing Policy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Keys Tab */}
              <TabsContent value="api-keys" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">API Keys</CardTitle>
                        <CardDescription>
                          Manage API keys specific to this project
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowAddKey(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {apiKeys.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No API keys configured for this project</p>
                        <p className="text-xs mt-1">Shared connectors are available automatically</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {apiKeys.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <Key className="h-4 w-4" />
                              <div>
                                <p className="font-medium text-sm">{key.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {key.serviceName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={key.isShared ? 'default' : 'secondary'} className="text-xs">
                                {key.isShared ? 'Shared' : 'Personal'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Add Key Dialog */}
                <Dialog open={showAddKey} onOpenChange={setShowAddKey}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add API Key</DialogTitle>
                      <DialogDescription>
                        Add a project-specific API key
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          placeholder="e.g., Production Stripe Key"
                          value={newKey.name}
                          onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Service</Label>
                        <Input
                          placeholder="e.g., stripe, openai"
                          value={newKey.serviceName}
                          onChange={(e) => setNewKey({ ...newKey, serviceName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          placeholder="sk_live_..."
                          value={newKey.value}
                          onChange={(e) => setNewKey({ ...newKey, value: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddKey(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddAPIKey}>
                          Add Key
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Deployment Tab */}
              <TabsContent value="deployment" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Deployment Configuration</CardTitle>
                    <CardDescription>
                      Configure how this project is deployed to production
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg border bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Deployment settings are managed through the Deploy button in the toolbar.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        This project uses credentials from: Shared Connectors → Personal Connectors → Platform Credentials
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Project Members</CardTitle>
                        <CardDescription>
                          Manage who has access to this project
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Invite
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {members.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No collaborators yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {member.displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm">{member.displayName}</p>
                                <p className="text-xs text-muted-foreground">@{member.username}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {member.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-4 mt-0">
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Irreversible actions. Proceed with caution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">Delete Project</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Once deleted, this project cannot be recovered. All files, settings, and deployment history will be lost.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteProject}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

