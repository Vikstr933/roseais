import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch, getApiUrl } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Calendar, ListTodo, Settings, Sparkles, Plus, AlertTriangle, Code, Shield, Key, ExternalLink } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiresAuth: boolean;
  authType?: string;
  capabilities: string[];
  isUserGenerated?: boolean;
  credentialsRequired?: Record<string, any>;
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

interface PluginGenerationResult {
  success: boolean;
  pluginId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'blocked';
  securityScore: number;
  reviewRequired: boolean;
  metadata: {
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
  }>;
  generationTime: number;
  tokensUsed: number;
}

interface GenerationStats {
  todaysGenerations: number;
  limits: {
    maxCustomPlugins: number;
    generationsPerDay: number;
    maxPluginComplexity: string;
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

  // Plugin Generator Dialog State
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [step, setStep] = useState<'describe' | 'generating' | 'review' | 'success'>('describe');
  const [prompt, setPrompt] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex'>('simple');
  const [result, setResult] = useState<PluginGenerationResult | null>(null);

  // Credential Dialog State
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [credentialPluginId, setCredentialPluginId] = useState('');
  const [credentialPluginName, setCredentialPluginName] = useState('');
  const [credentialsRequired, setCredentialsRequired] = useState<Record<string, any>>({});
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});

  // Fetch plugin generation stats
  const { data: stats } = useQuery<GenerationStats>({
    queryKey: ['plugin-stats'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/user-plugins/stats/overview'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: generatorOpen, // Only fetch when dialog is open
  });

  // Generate plugin mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { prompt: string; serviceName?: string; estimatedComplexity?: string }) => {
      const res = await fetch(getApiUrl('/api/user-plugins/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate plugin');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.status === 'blocked' || data.status === 'rejected') {
        setStep('review');
      } else {
        setStep('success');
      }
    },
    onError: (error) => {
      setStep('describe');
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    setStep('generating');
    generateMutation.mutate({
      prompt,
      serviceName: serviceName || undefined,
      estimatedComplexity: complexity,
    });
  };

  const handleResetGenerator = () => {
    setStep('describe');
    setPrompt('');
    setServiceName('');
    setComplexity('simple');
    setResult(null);
  };

  const openGenerator = () => {
    handleResetGenerator();
    setGeneratorOpen(true);
  };

  const handleSaveCredentials = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Validate required fields
      const requiredFields = Object.entries(credentialsRequired)
        .filter(([_, config]) => config.required)
        .map(([key, _]) => key);

      const missingFields = requiredFields.filter(field => !credentialValues[field]?.trim());
      if (missingFields.length > 0) {
        setError(`Please fill in required fields: ${missingFields.map(f => credentialsRequired[f].label).join(', ')}`);
        return;
      }

      // Save each credential separately
      for (const [key, value] of Object.entries(credentialValues)) {
        if (!value) continue; // Skip empty fields

        const response = await apiFetch('/api/credentials', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceName: credentialPluginId,
            key: key,
            value: value
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to save ${credentialsRequired[key]?.label || key}`);
        }
      }

      // Install the plugin after credentials are saved
      const installResponse = await apiFetch(`/api/user-plugins/${credentialPluginId}/install`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentials: credentialValues
        })
      });

      if (!installResponse.ok) {
        const errorData = await installResponse.json();
        throw new Error(errorData.error || 'Failed to install plugin');
      }

      setSuccess(`${credentialPluginName} connected successfully!`);
      setCredentialDialogOpen(false);
      setCredentialValues({});
      await loadPlugins();
      await loadUserStatus();
    } catch (err) {
      console.error('Failed to save credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
  };

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

      // Find the plugin
      const plugin = availablePlugins.find(p => p.id === pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // Check if this is a user-generated plugin OR requires auth
      if (plugin.isUserGenerated || plugin.requiresAuth) {
        console.log('Plugin requires authentication:', {
          isUserGenerated: plugin.isUserGenerated,
          requiresAuth: plugin.requiresAuth,
          authType: plugin.authType,
          credentialsRequired: plugin.credentialsRequired
        });

        // Handle OAuth flow for user-generated plugins
        if (plugin.isUserGenerated && plugin.authType === 'oauth') {
          console.log('OAuth flow for user-generated plugin');
          // Try to initiate OAuth flow
          try {
            const response = await apiFetch(`/api/user-plugins/${pluginId}/auth/start`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.authUrl) {
                window.location.href = data.authUrl;
                return;
              }
            }
          } catch (oauthError) {
            console.warn('OAuth flow not available, falling back to credential dialog:', oauthError);
            // Fall through to credential dialog
          }
        }

        // Show credential dialog for API key or custom auth
        // Also show if credentialsRequired is empty but auth is required (user needs to provide credentials)
        const hasCredentialsRequired = plugin.credentialsRequired && Object.keys(plugin.credentialsRequired).length > 0;
        
        if (hasCredentialsRequired || (plugin.requiresAuth && !plugin.authType)) {
          console.log('Showing credential dialog');
          setCredentialPluginId(pluginId);
          setCredentialPluginName(plugin.name);
          setCredentialsRequired(plugin.credentialsRequired || {
            // If no credentialsRequired defined but auth is needed, create a default field
            apiKey: {
              label: 'API Key',
              type: 'password',
              required: true,
              description: 'Enter your API key or access token'
            }
          });
          setCredentialValues({});
          setCredentialDialogOpen(true);

          // Remove from connecting state since we're showing a dialog
          setConnecting(prev => {
            const newSet = new Set(prev);
            newSet.delete(pluginId);
            return newSet;
          });
          return;
        } else if (plugin.requiresAuth && plugin.authType === 'oauth') {
          // OAuth flow should have been handled above, but if we get here, show error
          throw new Error('OAuth authentication is required but not configured for this plugin');
        }
      }

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
    // Custom user-generated plugins use emoji icons
    if (category === 'custom' || iconStr === '🔌') {
      return <span className="text-2xl">{iconStr}</span>;
    }
    if (iconStr === '📧' || category === 'communication') return <Mail className="w-6 h-6" />;
    if (category === 'productivity') return <ListTodo className="w-6 h-6" />;
    return <Settings className="w-6 h-6" />;
  };

  const getCategoryLabel = (category: string, isUserGenerated?: boolean) => {
    if (category === 'custom' || isUserGenerated) {
      return 'AI Generated';
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
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
        <div className="flex gap-2">
          <Button
            onClick={openGenerator}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Custom Plugin
          </Button>
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
            {/* Custom Plugin Generator Card */}
            <Card className="border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 hover:border-purple-400 transition-all cursor-pointer" onClick={openGenerator}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-purple-600 dark:text-purple-400 font-bold">
                      Generate Custom Plugin
                    </CardTitle>
                    <Badge variant="outline" className="mt-1 border-purple-300">AI-Powered</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 text-foreground/80">
                  Create custom integrations with Discord, Slack, Trello, and more using natural language.
                  Just describe what you want and let AI build it for you!
                </CardDescription>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" />
                    Secure code generation
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" />
                    Multi-layer security analysis
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500" />
                    Sandboxed execution
                  </div>
                </div>
                <Button className="w-full mt-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600" onClick={(e) => { e.stopPropagation(); openGenerator(); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your Plugin
                </Button>
              </CardContent>
            </Card>

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
                          <Badge variant="outline" className="mt-1">
                            {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                          </Badge>
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
                            <Badge variant="outline" className="mt-1">
                              {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                            </Badge>
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
                        <Badge variant="outline" className="mt-1">
                          {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                        </Badge>
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

      {/* Plugin Generator Dialog */}
      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              Generate Custom Plugin
            </DialogTitle>
            <DialogDescription>
              Use AI to create custom integrations with your favorite services
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stats Bar */}
            {stats && (
              <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-none">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {stats.todaysGenerations}/{stats.limits.generationsPerDay === -1 ? '∞' : stats.limits.generationsPerDay}
                      </div>
                      <div className="text-sm text-muted-foreground">Generations Today</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.limits.maxCustomPlugins === -1 ? '∞' : stats.limits.maxCustomPlugins}
                      </div>
                      <div className="text-sm text-muted-foreground">Plugin Limit</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 capitalize">
                        {stats.limits.maxPluginComplexity}
                      </div>
                      <div className="text-sm text-muted-foreground">Max Complexity</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Describe */}
            {step === 'describe' && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="prompt">What should this plugin do?</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Example: Create a Discord plugin that monitors mentions of '@urgent' in my server and sends me notifications via the OmniAssistant. It should also be able to send messages when I'm away."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Min 10 characters, max 2000 characters
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="service">Service (Optional)</Label>
                    <Input
                      id="service"
                      placeholder="e.g., Discord, Slack, Trello"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="complexity">Complexity</Label>
                    <select
                      id="complexity"
                      value={complexity}
                      onChange={(e) => setComplexity(e.target.value as any)}
                      className="mt-2 w-full h-10 px-3 rounded-md border border-input bg-background"
                      disabled={stats?.limits.maxPluginComplexity === 'simple'}
                    >
                      <option value="simple">Simple</option>
                      <option value="medium" disabled={stats?.limits.maxPluginComplexity === 'simple'}>
                        Medium {stats?.limits.maxPluginComplexity === 'simple' && '(Pro+)'}
                      </option>
                      <option value="complex" disabled={stats?.limits.maxPluginComplexity !== 'complex'}>
                        Complex {stats?.limits.maxPluginComplexity !== 'complex' && '(Enterprise)'}
                      </option>
                    </select>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    All plugins are analyzed for security issues before approval. Malicious code will be rejected.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleGenerate}
                  disabled={prompt.length < 10 || generateMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Plugin...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Plugin
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Generating */}
            {step === 'generating' && (
              <div className="py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-500" />
                  <h3 className="text-xl font-semibold">Generating Your Plugin</h3>
                  <p className="text-muted-foreground">
                    AI is analyzing your request and generating secure code...
                  </p>
                  <div className="flex justify-center gap-2 mt-4">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review (if blocked/rejected) */}
            {step === 'review' && result && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-6 h-6" />
                    Plugin {result.status === 'blocked' ? 'Blocked' : 'Rejected'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {result.status === 'blocked'
                        ? 'This request was blocked due to security concerns.'
                        : 'The generated plugin failed security validation.'}
                    </AlertDescription>
                  </Alert>

                  {result.issues && result.issues.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Security Issues Found:</h4>
                      <ul className="space-y-2">
                        {result.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {issue.severity}
                            </Badge>
                            <span className="text-sm">{issue.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button onClick={handleResetGenerator} variant="outline" className="w-full">
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Success */}
            {step === 'success' && result && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                    Plugin Generated Successfully!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground">Plugin Name</div>
                      <div className="text-lg font-semibold">{result.metadata.pluginName}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground">Security Score</div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${result.securityScore >= 80 ? 'text-green-500' : 'text-yellow-500'}`} />
                        {result.securityScore}/100
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Description</div>
                    <p className="text-sm">{result.metadata.description}</p>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Capabilities</div>
                    <div className="flex flex-wrap gap-2">
                      {result.metadata.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary">{cap}</Badge>
                      ))}
                    </div>
                  </div>

                  {result.reviewRequired && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This plugin requires manual review before activation due to its security score.
                        You'll be notified once it's approved.
                      </AlertDescription>
                    </Alert>
                  )}

                  {result.issues && result.issues.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Issues Found:</h4>
                      <ul className="space-y-1">
                        {result.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                              {issue.severity}
                            </Badge>
                            <span>{issue.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Credential Requirement Alert */}
                  {result.metadata.requiresAuth && (
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                      <Key className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Credentials Required
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            This plugin needs {serviceName || 'service'} credentials (API keys, OAuth tokens, etc.) to function properly.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            setCredentialServiceName(serviceName || '');
                            setCredentialDialogOpen(true);
                          }}
                          className="ml-4 bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          <Key className="w-4 h-4 mr-2" />
                          Add Credentials
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    <Button
                      onClick={() => {
                        setGeneratorOpen(false);
                        loadPlugins();
                        loadUserStatus();
                      }}
                      className="w-full"
                    >
                      Close & Refresh
                    </Button>
                    <Button onClick={handleResetGenerator} variant="outline" className="w-full">
                      Generate Another Plugin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {generateMutation.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {generateMutation.error instanceof Error
                    ? generateMutation.error.message
                    : 'Failed to generate plugin. Please try again.'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Credential Management Dialog */}
      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-6 h-6 text-blue-600" />
              Connect {credentialPluginName}
            </DialogTitle>
            <DialogDescription>
              Enter the required credentials to connect this plugin. All credentials are encrypted with AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Security:</strong> Your credentials are encrypted before storage and never exposed to the frontend.
                They're only decrypted server-side when your plugin executes.
              </AlertDescription>
            </Alert>

            {Object.keys(credentialsRequired).length === 0 ? (
              <Alert>
                <AlertDescription>
                  This plugin doesn't require any credentials. Click "Connect" to install it.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {Object.entries(credentialsRequired).map(([key, config]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="flex items-center gap-2">
                      {config.label}
                      {config.required && <span className="text-red-500">*</span>}
                    </Label>
                    {config.description && (
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    )}
                    <Input
                      id={key}
                      type={config.type === 'password' ? 'password' : config.type === 'url' ? 'url' : 'text'}
                      placeholder={config.placeholder || ''}
                      value={credentialValues[key] || ''}
                      onChange={(e) => setCredentialValues(prev => ({
                        ...prev,
                        [key]: e.target.value
                      }))}
                      required={config.required}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setCredentialDialogOpen(false);
                  setCredentialValues({});
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCredentials}
                className="flex-1"
              >
                <Key className="w-4 h-4 mr-2" />
                Connect Plugin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
