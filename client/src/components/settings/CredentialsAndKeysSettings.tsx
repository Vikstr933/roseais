import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plug, 
  Lock, 
  User as UserIcon, 
  ExternalLink, 
  Info, 
  FolderOpen,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SharedConnector {
  id: string;
  serviceName: string;
  name: string;
  keyType: string;
  isActive: boolean;
  configuredBy: string;
  configuredByName?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface PersonalConnector {
  id: string;
  pluginId: string;
  pluginName: string;
  authenticated: boolean;
  lastSync?: string;
}

interface ProjectAPIKey {
  id: string;
  projectId: number;
  projectName: string;
  serviceName: string;
  keyType: string;
  createdAt: string;
  lastUsed?: string;
  isShared: boolean;
}

interface PersonalSecret {
  id: string;
  name: string;
  serviceName: string;
  createdAt: string;
  lastUsed?: string;
}

export function CredentialsAndKeysSettings() {
  const { user, sessionToken, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [sharedConnectors, setSharedConnectors] = useState<SharedConnector[]>([]);
  const [personalConnectors, setPersonalConnectors] = useState<PersonalConnector[]>([]);
  const [projectAPIKeys, setProjectAPIKeys] = useState<ProjectAPIKey[]>([]);
  const [personalSecrets, setPersonalSecrets] = useState<PersonalSecret[]>([]);
  
  // UI states
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [newSecret, setNewSecret] = useState({ name: '', serviceName: '', value: '' });
  const [showSecretValues, setShowSecretValues] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllCredentials();
  }, [user]);

  const fetchAllCredentials = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchSharedConnectors(),
        fetchPersonalConnectors(),
        fetchProjectAPIKeys(),
        fetchPersonalSecrets()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedConnectors = async () => {
    try {
      const res = await apiFetch('/api/shared-connectors', {
        headers: getAuthHeaders(sessionToken)
      });
      if (res.ok) {
        const data = await res.json();
        setSharedConnectors(data.connectors || []);
      }
    } catch (error) {
      console.error('Error fetching shared connectors:', error);
    }
  };

  const fetchPersonalConnectors = async () => {
    try {
      const res = await apiFetch('/api/plugins/status', {
        headers: getAuthHeaders(sessionToken)
      });
      if (res.ok) {
        const data = await res.json();
        const connected = (data.plugins || [])
          .filter((p: any) => p.status?.authenticated && !p.metadata?.isShared)
          .map((p: any) => ({
            id: p.pluginId,
            pluginId: p.pluginId,
            pluginName: p.metadata?.name || p.pluginId,
            authenticated: p.status.authenticated,
            lastSync: p.status.lastSync
          }));
        setPersonalConnectors(connected);
      }
    } catch (error) {
      console.error('Error fetching personal connectors:', error);
    }
  };

  const fetchProjectAPIKeys = async () => {
    try {
      const projectsRes = await apiFetch('/api/workspaces', {
        headers: getAuthHeaders(sessionToken)
      });
      
      if (!projectsRes.ok) return;

      const projects = await projectsRes.json();
      const allKeys: ProjectAPIKey[] = [];

      for (const project of projects) {
        try {
          const keysRes = await apiFetch(`/api/workspaces/${project.id}/api-keys`, {
            headers: getAuthHeaders(sessionToken)
          });
          
          if (keysRes.ok) {
            const keys = await keysRes.json();
            const projectKeys = keys.map((key: any) => ({
              id: key.id,
              projectId: project.id,
              projectName: project.name,
              serviceName: key.serviceName || 'Unknown',
              keyType: key.keyType || 'api_key',
              createdAt: key.createdAt,
              lastUsed: key.lastUsed,
              isShared: key.isShared || false
            }));
            allKeys.push(...projectKeys);
          }
        } catch (error) {
          console.error(`Error fetching keys for project ${project.id}:`, error);
        }
      }

      setProjectAPIKeys(allKeys);
    } catch (error) {
      console.error('Error fetching project API keys:', error);
    }
  };

  const fetchPersonalSecrets = async () => {
    try {
      const res = await apiFetch('/api/secrets', {
        headers: getAuthHeaders(sessionToken)
      });
      if (res.ok) {
        const secrets = await res.json();
        setPersonalSecrets(secrets || []);
      }
    } catch (error) {
      console.error('Error fetching personal secrets:', error);
    }
  };

  const handleAddSecret = async () => {
    if (!newSecret.name || !newSecret.serviceName || !newSecret.value) {
      toast({
        title: 'Error',
        description: 'All fields are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await apiFetch('/api/secrets', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify(newSecret)
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Secret added successfully'
        });
        setNewSecret({ name: '', serviceName: '', value: '' });
        setShowAddSecret(false);
        fetchPersonalSecrets();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add secret',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSecret = async (id: string) => {
    try {
      const res = await apiFetch(`/api/secrets/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(sessionToken)
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Secret deleted successfully'
        });
        fetchPersonalSecrets();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete secret',
        variant: 'destructive'
      });
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecretValues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRelativeTime = (date?: string) => {
    if (!date) return 'Never';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Credentials & Keys</h2>
        <p className="text-muted-foreground">
          Manage all your API keys, connectors, and authentication credentials in one place.
        </p>
      </div>

      {/* Shared Connectors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Shared Connectors
              </CardTitle>
              <CardDescription className="mt-2">
                Workspace-wide connectors (Stripe, Vercel, GitHub). Configured by admins, available to all projects.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/integrations?tab=shared')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Configure
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sharedConnectors.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No shared connectors configured.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sharedConnectors.map((connector) => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Plug className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{connector.serviceName}</p>
                      <p className="text-xs text-muted-foreground">{connector.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connector.isActive ? 'default' : 'secondary'} className="text-xs">
                      {connector.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Personal Connectors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Personal Connectors
              </CardTitle>
              <CardDescription className="mt-2">
                Your OAuth connections (Notion, Linear, Miro). Only you can access these.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/integrations?tab=personal')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {personalConnectors.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No personal connectors connected.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {personalConnectors.map((connector) => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Plug className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{connector.pluginName}</p>
                  </div>
                  <Badge variant="default" className="text-xs">Connected</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Project API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Project API Keys
          </CardTitle>
          <CardDescription>
            Overview of API keys across all your projects. Click project name to manage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectAPIKeys.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No project API keys configured.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Last Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectAPIKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <button
                          onClick={() => setLocation(`/playground/${key.projectId}`)}
                          className="flex items-center gap-2 hover:text-primary"
                        >
                          <FolderOpen className="h-4 w-4" />
                          <span className="font-medium text-sm">{key.projectName}</span>
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{key.serviceName}</TableCell>
                      <TableCell>
                        <Badge variant={key.isShared ? 'default' : 'secondary'} className="text-xs">
                          {key.isShared ? 'Shared' : 'Personal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(key.lastUsed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Personal Secrets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Personal Secrets
              </CardTitle>
              <CardDescription className="mt-2">
                Your private API keys and secrets. Used as fallback when projects don't have specific keys.
              </CardDescription>
            </div>
            <Dialog open={showAddSecret} onOpenChange={setShowAddSecret}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Secret
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Secret</DialogTitle>
                  <DialogDescription>
                    Store a personal API key or secret securely.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g., Production API Key"
                      value={newSecret.name}
                      onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Service Name</Label>
                    <Input
                      placeholder="e.g., stripe, openai"
                      value={newSecret.serviceName}
                      onChange={(e) => setNewSecret({ ...newSecret, serviceName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input
                      type="password"
                      placeholder="Your API key or secret"
                      value={newSecret.value}
                      onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddSecret(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSecret}>
                      Add Secret
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {personalSecrets.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No personal secrets stored.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {personalSecrets.map((secret) => (
                <div
                  key={secret.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{secret.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{secret.serviceName}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSecret(secret.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Understanding Credentials & Keys</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Shared Connectors</strong>: Configured by admins, available to all projects</li>
                <li>• <strong>Personal Connectors</strong>: Your OAuth connections (Notion, etc.)</li>
                <li>• <strong>Project API Keys</strong>: Keys specific to individual projects</li>
                <li>• <strong>Personal Secrets</strong>: Your private keys, used as fallback</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

