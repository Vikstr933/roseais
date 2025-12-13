import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Key, ExternalLink, Info, FolderOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export function APIKeysSettings() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ProjectAPIKey[]>([]);

  useEffect(() => {
    fetchAPIKeys();
  }, [user]);

  const fetchAPIKeys = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch all user's projects and their API keys
      const projectsRes = await apiFetch('/api/workspaces', {
        headers: getAuthHeaders(sessionToken)
      });
      
      if (!projectsRes.ok) {
        throw new Error('Failed to fetch projects');
      }

      const projects = await projectsRes.json();
      const allKeys: ProjectAPIKey[] = [];

      // For each project, fetch its API keys
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

      setApiKeys(allKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = (projectId: number) => {
    setLocation(`/playground/${projectId}`);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API Keys Overview
          </CardTitle>
          <CardDescription>
            View all API keys across your projects. Click a project name to open its settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No API keys configured in your projects yet.</p>
              <p className="text-xs mt-2">
                API keys are managed per-project in the Project Settings.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleOpenProject(key.projectId)}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <FolderOpen className="h-4 w-4" />
                          {key.projectName}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{key.serviceName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {key.keyType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {key.isShared ? (
                          <Badge variant="default">Shared</Badge>
                        ) : (
                          <Badge variant="secondary">Personal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(key.lastUsed)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenProject(key.projectId)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <p className="font-medium">About API Keys</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Personal API Keys</strong> are specific to a single project</li>
                <li>• <strong>Shared API Keys</strong> come from Shared Connectors and are available to all projects</li>
                <li>• To add/edit API keys for a project, open the project and click the gear icon (⚙️)</li>
                <li>• API keys are encrypted and stored securely</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

