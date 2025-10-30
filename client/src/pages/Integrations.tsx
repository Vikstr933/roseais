import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Calendar, ListTodo, Settings } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiresAuth: boolean;
  authType?: string;
  capabilities: string[];
}

interface PluginStatus {
  pluginId: string;
  metadata: Plugin;
  status: {
    enabled: boolean;
    initialized: boolean;
    authenticated: boolean;
    health: 'healthy' | 'warning' | 'error';
    healthMessage?: string;
    lastSync?: string;
    syncInProgress: boolean;
  };
}

export default function Integrations() {
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>([]);
  const [userPluginStatus, setUserPluginStatus] = useState<PluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
    loadUserStatus();

    // Check for OAuth callback success/error in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      const pluginName = params.get('success');
      setSuccess(`${pluginName} plugin connected successfully!`);

      // Wait a moment for backend to finish processing, then reload status
      // Use polling to ensure we get the updated connection status
      let attempts = 0;
      const maxAttempts = 5;
      const checkConnection = async () => {
        attempts++;
        await loadUserStatus();

        // Check if plugin is now showing as connected
        const pluginId = pluginName.toLowerCase().replace(' ', '-');
        const isConnected = userPluginStatus.some(
          p => p.pluginId === pluginId && p.status.authenticated
        );

        // If not connected yet and haven't exceeded max attempts, try again
        if (!isConnected && attempts < maxAttempts) {
          setTimeout(checkConnection, 1000); // Try again in 1 second
        }
      };

      // Start checking after a short delay
      setTimeout(checkConnection, 500);

      // Clear URL params
      window.history.replaceState({}, '', '/integrations');
    }
    if (params.get('error')) {
      setError(`Failed to connect ${params.get('error')} plugin`);
      window.history.replaceState({}, '', '/integrations');
    }

    // Listen for OAuth callback messages from popup windows
    const handleMessage = (event: MessageEvent) => {
      const validTypes = ['gmail-connected', 'calendar-connected', 'github-connected'];
      if (validTypes.includes(event.data.type)) {
        if (event.data.success) {
          const pluginNames: Record<string, string> = {
            'gmail-connected': 'Gmail',
            'calendar-connected': 'Google Calendar',
            'github-connected': 'GitHub'
          };
          const pluginName = pluginNames[event.data.type];
          setSuccess(`${pluginName} connected successfully!`);
          // Reload status to show updated connection
          loadUserStatus();
          // Clear connecting state
          setConnecting(new Set());
        } else {
          const pluginNames: Record<string, string> = {
            'gmail-connected': 'Gmail',
            'calendar-connected': 'Google Calendar',
            'github-connected': 'GitHub'
          };
          const pluginName = pluginNames[event.data.type];
          setError(`Failed to connect ${pluginName}`);
          setConnecting(new Set());
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadPlugins = async () => {
    try {
      const response = await apiFetch('/api/plugins');
      const data = await response.json();
      if (data.success) {
        setAvailablePlugins(data.plugins);
      }
    } catch (err) {
      console.error('Failed to load plugins:', err);
      setError('Failed to load available plugins');
    }
  };

  const loadUserStatus = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/plugins/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUserPluginStatus(data.plugins);
      }
    } catch (err) {
      console.error('Failed to load user plugin status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPlugin = async (pluginId: string) => {
    try {
      setError(null);
      setSuccess(null);
      setConnecting(prev => new Set(prev).add(pluginId));

      console.log(`Connecting ${pluginId}...`);

      // For OAuth plugins, initiate OAuth flow
      if (pluginId === 'gmail') {
        console.log('Fetching Gmail auth URL...');
        const response = await apiFetch('/api/plugins/gmail/auth/start', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Gmail auth response:', data);

        if (data.success && data.authUrl) {
          console.log('Redirecting to Gmail OAuth...');
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        } else {
          throw new Error(data.error || 'No auth URL received');
        }
      } else if (pluginId === 'google-calendar') {
        console.log('Fetching Calendar auth URL...');
        const response = await apiFetch('/api/plugins/google-calendar/auth/start', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Calendar auth response:', data);

        if (data.success && data.authUrl) {
          console.log('Redirecting to Google Calendar OAuth...');
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        } else {
          throw new Error(data.error || 'No auth URL received');
        }
      } else if (pluginId === 'github') {
        console.log('Fetching GitHub auth URL...');
        const response = await apiFetch('/api/plugins/github/auth/start', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('GitHub auth response:', data);

        if (data.success && data.authUrl) {
          console.log('Redirecting to GitHub OAuth...');
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        } else {
          throw new Error(data.error || 'No auth URL received');
        }
      } else if (pluginId === 'notion') {
        // Notion uses API key, not OAuth - show a prompt
        const apiKey = prompt('Enter your Notion API Key (from https://www.notion.so/my-integrations):');
        if (apiKey) {
          const response = await apiFetch('/api/plugins/notion/configure', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiKey })
          });
          const data = await response.json();
          if (data.success) {
            setSuccess('Notion connected successfully!');
            await loadUserStatus();
          } else {
            setError(data.error || 'Failed to connect Notion');
          }
        }
        setConnecting(prev => {
          const newSet = new Set(prev);
          newSet.delete(pluginId);
          return newSet;
        });
      } else {
        setError(`Plugin ${pluginId} is not yet supported`);
        setConnecting(prev => {
          const newSet = new Set(prev);
          newSet.delete(pluginId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to connect plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect plugin');
      setConnecting(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const handleDisconnectPlugin = async (pluginId: string) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await apiFetch(`/api/plugins/${pluginId}/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`${pluginId} disconnected successfully`);
        await loadUserStatus();
      } else {
        setError(data.error || 'Failed to disconnect plugin');
      }
    } catch (err) {
      console.error('Failed to disconnect plugin:', err);
      setError('Failed to disconnect plugin');
    }
  };

  const handleSyncPlugin = async (pluginId: string) => {
    try {
      setError(null);
      setSyncing(prev => new Set(prev).add(pluginId));

      const response = await apiFetch(`/api/plugins/${pluginId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fullSync: false })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`${pluginId} synced: ${data.result.itemsSynced} items`);
        await loadUserStatus();
      } else {
        setError(data.error || 'Failed to sync plugin');
      }
    } catch (err) {
      console.error('Failed to sync plugin:', err);
      setError('Failed to sync plugin');
    } finally {
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const getPluginIcon = (iconStr: string, category: string) => {
    if (iconStr === '📧' || category === 'communication') return <Mail className="w-6 h-6" />;
    if (category === 'productivity') return <ListTodo className="w-6 h-6" />;
    return <Settings className="w-6 h-6" />;
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getPluginStatus = (pluginId: string): PluginStatus | undefined => {
    return userPluginStatus.find(p => p.pluginId === pluginId);
  };

  const isPluginEnabled = (pluginId: string): boolean => {
    const status = getPluginStatus(pluginId);
    return status?.status.enabled || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your productivity tools to enhance your AI assistant with contextual awareness
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            loadPlugins();
            loadUserStatus();
            setSuccess('Status refreshed');
            setTimeout(() => setSuccess(null), 2000);
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-500">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-500">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Integrations</TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePlugins.map((plugin) => {
              const status = getPluginStatus(plugin.id);
              const enabled = isPluginEnabled(plugin.id);

              return (
                <Card key={plugin.id} className={enabled ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {getPluginIcon(plugin.icon, plugin.category)}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                            {enabled && (
                              <Badge className="bg-green-500 hover:bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="mt-1">{plugin.category}</Badge>
                        </div>
                      </div>
                      {enabled && (
                        <div className="flex flex-col items-end space-y-2">
                          {status && getHealthBadge(status.status.health)}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <CardDescription>{plugin.description}</CardDescription>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Capabilities:</h4>
                      <div className="flex flex-wrap gap-2">
                        {plugin.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {plugin.capabilities.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{plugin.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {status?.status.lastSync && (
                      <div className="text-xs text-muted-foreground">
                        Last synced: {new Date(status.status.lastSync).toLocaleString()}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      {enabled ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncPlugin(plugin.id)}
                            disabled={syncing.has(plugin.id) || status?.status.syncInProgress}
                          >
                            {syncing.has(plugin.id) || status?.status.syncInProgress ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Sync
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnectPlugin(plugin.id)}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handleConnectPlugin(plugin.id)}
                          disabled={connecting.has(plugin.id)}
                        >
                          {connecting.has(plugin.id) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            `Connect ${plugin.name}`
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="connected" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePlugins
              .filter(plugin => isPluginEnabled(plugin.id))
              .map((plugin) => {
                const status = getPluginStatus(plugin.id);

                return (
                  <Card key={plugin.id} className="border-primary">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {getPluginIcon(plugin.icon, plugin.category)}
                          <div>
                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">{plugin.category}</Badge>
                          </div>
                        </div>
                        {status && getHealthBadge(status.status.health)}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {status?.status.lastSync && (
                        <div className="text-sm">
                          Last synced: {new Date(status.status.lastSync).toLocaleString()}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncPlugin(plugin.id)}
                          disabled={syncing.has(plugin.id) || status?.status.syncInProgress}
                        >
                          {syncing.has(plugin.id) || status?.status.syncInProgress ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnectPlugin(plugin.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            {availablePlugins.filter(p => isPluginEnabled(p.id)).length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No integrations connected yet. Connect your first integration to get started!
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePlugins
              .filter(plugin => !isPluginEnabled(plugin.id))
              .map((plugin) => (
                <Card key={plugin.id}>
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      {getPluginIcon(plugin.icon, plugin.category)}
                      <div>
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">{plugin.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <CardDescription>{plugin.description}</CardDescription>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Capabilities:</h4>
                      <div className="flex flex-wrap gap-2">
                        {plugin.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {plugin.capabilities.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{plugin.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleConnectPlugin(plugin.id)}
                    >
                      Connect {plugin.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            {availablePlugins.filter(p => !isPluginEnabled(p.id)).length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                All available integrations are already connected!
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
