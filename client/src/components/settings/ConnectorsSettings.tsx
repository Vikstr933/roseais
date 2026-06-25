import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plug, Lock, User as UserIcon, ExternalLink, Info } from 'lucide-react';
import { useLocation } from 'wouter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export function ConnectorsSettings() {
  const { user, sessionToken, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [sharedConnectors, setSharedConnectors] = useState<SharedConnector[]>([]);
  const [personalConnectors, setPersonalConnectors] = useState<PersonalConnector[]>([]);

  useEffect(() => {
    fetchConnectors();
  }, [user, isAdmin]);

  const fetchConnectors = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (isAdmin) {
        const sharedRes = await apiFetch('/api/shared-connectors', {
          headers: getAuthHeaders(sessionToken)
        });

        if (sharedRes.ok) {
          const data = await sharedRes.json();
          setSharedConnectors(data.connectors || []);
        }
      } else {
        setSharedConnectors([]);
      }

      // Fetch personal connectors (from integrations)
      const personalRes = await apiFetch('/api/plugins/status', {
        headers: getAuthHeaders(sessionToken)
      });
      
      if (personalRes.ok) {
        const data = await personalRes.json();
        // Filter for connected personal plugins
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
      console.error('Error fetching connectors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connectors',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
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
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Shared Connectors
                </CardTitle>
                <CardDescription className="mt-2">
                  Workspace-wide connectors configured by admins. Available to all projects.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setLocation('/integrations?tab=shared')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharedConnectors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plug className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No shared connectors configured yet.</p>
                <Button
                  variant="link"
                  onClick={() => setLocation('/integrations?tab=shared')}
                  className="mt-2"
                >
                  Configure your first connector →
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sharedConnectors.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plug className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{connector.serviceName}</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  Configured by {connector.configuredByName || 'Admin'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(connector.createdAt).toLocaleDateString()}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {connector.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={connector.isActive ? 'default' : 'secondary'}>
                        {connector.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {connector.keyType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                Your personal tool connections (Notion, Linear, etc.). Only you can access these.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation('/integrations?tab=personal')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Add More
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {personalConnectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Plug className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No personal connectors connected yet.</p>
              <Button
                variant="link"
                onClick={() => setLocation('/integrations?tab=personal')}
                className="mt-2"
              >
                Connect your first tool →
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {personalConnectors.map((connector) => (
                <div
                  key={connector.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plug className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{connector.pluginName}</p>
                      {connector.lastSync && (
                        <p className="text-sm text-muted-foreground">
                          Last synced: {new Date(connector.lastSync).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="default">Connected</Badge>
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
              <p className="font-medium">About Connectors</p>
              <ul className="space-y-1 text-muted-foreground">
                {isAdmin && (
                  <li>• <strong>Shared Connectors</strong> are configured once by admins and available to all projects</li>
                )}
                <li>• <strong>Personal Connectors</strong> are your individual tool connections</li>
                <li>• Visit the <button onClick={() => setLocation('/integrations')} className="underline">Integrations page</button> to add more connectors</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
