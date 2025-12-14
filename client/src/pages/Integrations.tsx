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
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Calendar, ListTodo, Settings, Sparkles, Plus, AlertTriangle, Code, Shield, Key, ExternalLink, MessageSquare, User, HelpCircle, Info } from 'lucide-react';
import { ToolPermissionsDialog } from '@/components/ToolPermissionsDialog';
import { ConnectorConfigDialog } from '@/components/ConnectorConfigDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

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
  isShared?: boolean; // Workspace-level connector
  isPersonal?: boolean; // User-level connector
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
  const { sessionToken, isAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>([]);
  const [userPluginStatus, setUserPluginStatus] = useState<PluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pluginsPerPage] = useState(20);
  const [totalPlugins, setTotalPlugins] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Discord OAuth state
  const [discordLink, setDiscordLink] = useState<{ linked: boolean; mapping?: { discordUserId: string; discordUsername?: string } }>({ linked: false });
  const [discordLoading, setDiscordLoading] = useState(false);
  
  // Discord Bot state
  const [discordBotStatus, setDiscordBotStatus] = useState<{ connected: boolean; botUser?: { id: string; username: string; tag: string } } | null>(null);
  const [discordBotLoading, setDiscordBotLoading] = useState(false);
  const [discordBotToken, setDiscordBotToken] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [discordServerId, setDiscordServerId] = useState('');

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
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedPluginForPermissions, setSelectedPluginForPermissions] = useState<{ id: string; name: string; tools: any[] } | null>(null);
  const [sharedConnectors, setSharedConnectors] = useState<any[]>([]);
  const [availablePreBuiltConnectors, setAvailablePreBuiltConnectors] = useState<any[]>([]);
  const [loadingSharedConnectors, setLoadingSharedConnectors] = useState(false);
  const [connectorConfigDialogOpen, setConnectorConfigDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<any>(null);
  const [connectorConfigMode, setConnectorConfigMode] = useState<'create' | 'edit'>('create');
  const [connectorConfigId, setConnectorConfigId] = useState<string | undefined>(undefined);
  const getPluginById = (pluginId: string) => availablePlugins.find(p => p.id === pluginId);
  const isCustomPlugin = (plugin?: Plugin) =>
    !!plugin && (plugin.isUserGenerated || plugin.category === 'custom' || plugin.id.startsWith('plugin_'));
  const openCredentialDialogForPlugin = (plugin: Plugin) => {
    const hasDefinedFields = plugin.credentialsRequired && Object.keys(plugin.credentialsRequired).length > 0;
    const fields = hasDefinedFields
      ? plugin.credentialsRequired!
      : {
          apiKey: {
            label: 'API Key',
            type: 'password',
            required: true,
            description: 'Enter the API key or access token for this plugin',
          },
        };

    const initialValues: Record<string, string> = {};
    Object.keys(fields).forEach((key) => {
      initialValues[key] = '';
    });

    setCredentialPluginId(plugin.id);
    setCredentialPluginName(plugin.name);
    setCredentialsRequired(fields);
    setCredentialValues(initialValues);
    setCredentialDialogOpen(true);
  };

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
    onSuccess: async (data) => {
      setResult(data);
      if (data.status === 'blocked' || data.status === 'rejected') {
        setStep('review');
      } else {
        setStep('success');
        // Refresh plugin list to show the new plugin
        await loadPlugins();
        await loadUserStatus();
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

      // Validate URL fields (webhooks, etc.)
      for (const [key, value] of Object.entries(credentialValues)) {
        const config = credentialsRequired[key];
        if (config?.type === 'url' && value) {
          try {
            new URL(value);
          } catch {
            setError(`Invalid URL for ${config.label || key}. Please enter a valid URL (e.g., https://...)`);
            return;
          }
        }
      }

      const plugin = getPluginById(credentialPluginId);
      if (!plugin) {
        throw new Error('Plugin not found');
      }

      // Determine credentialType based on plugin requirements
      // If webhookUrl is required, use 'custom' (webhooks don't fit standard auth types)
      const hasWebhook = Object.keys(credentialsRequired).some(
        key => key.toLowerCase().includes('webhook')
      );
      
      let credentialType: 'api_key' | 'oauth2' | 'personal_access_token' | 'custom' = 'custom';
      if (!hasWebhook && plugin.authType) {
        // Map plugin authType to valid enum values
        if (plugin.authType === 'oauth' || plugin.authType === 'oauth2') {
          credentialType = 'oauth2';
        } else if (plugin.authType === 'api_key' || plugin.authType === 'apikey') {
          credentialType = 'api_key';
        } else if (plugin.authType === 'personal_access_token' || plugin.authType === 'token') {
          credentialType = 'personal_access_token';
        }
      }

      const pluginName = plugin?.name || 'Plugin';
      const credentialPayload = {
        serviceName: credentialPluginId,
        credentialType,
        displayName: `${pluginName} Credentials`,
        description: plugin?.description || `Credentials for ${pluginName}`,
        credentials: credentialValues,
      };

      const saveResponse = await apiFetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentialPayload),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        const errorMessage = errorData.details 
          ? `${errorData.error || 'Validation failed'}: ${Array.isArray(errorData.details) ? errorData.details.join(', ') : JSON.stringify(errorData.details)}`
          : errorData.error || 'Failed to save credentials';
        throw new Error(errorMessage);
      }

      await installCustomPlugin(plugin, credentialValues);

      setCredentialDialogOpen(false);
      setCredentialValues({});
    } catch (err) {
      console.error('Failed to save credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
  };

  useEffect(() => {
    loadPlugins(1);
    loadUserStatus();
    loadSharedConnectors();
    loadDiscordStatus();
    loadDiscordBotStatus();

    // Check for Discord OAuth callback
    const params = new URLSearchParams(window.location.search);
    const discordOAuth = params.get('discord_oauth');
    if (discordOAuth) {
      if (discordOAuth === 'success') {
        toast({
          title: 'Success',
          description: 'Discord account linked successfully! You can now chat with Elon in Discord.',
        });
        loadDiscordStatus();
      } else {
        const error = params.get('error');
        toast({
          title: 'Error',
          description: error || 'Failed to link Discord account',
          variant: 'destructive',
        });
      }
      // Clean up URL
      window.history.replaceState({}, '', '/integrations');
    }

    // Check for OAuth callback success/error in URL
    if (params.get('success')) {
      const pluginName = params.get('success');
      if (pluginName) {
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
      setTimeout(checkConnection, 500); // Start checking after 500ms
      }

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
          // Clear connecting state first
          setConnecting(new Set());
          
          // Reload status with retry logic to ensure we get the updated connection
          const reloadStatusWithRetry = async (attempts = 0) => {
            try {
              const response = await apiFetch('/api/plugins/status', {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
                }
              });
              const data = await response.json();
              
              if (data.success) {
                setUserPluginStatus(data.plugins);
                
                // Check if plugin is now connected
                const pluginId = event.data.type.replace('-connected', '');
                const isConnected = data.plugins.some(
                  (p: any) => p.pluginId === pluginId && p.status?.authenticated === true
                );
                
                // If not connected yet and haven't exceeded max attempts, try again
                if (!isConnected && attempts < 3) {
                  setTimeout(() => reloadStatusWithRetry(attempts + 1), 1000);
                }
              }
            } catch (err) {
              console.error('Failed to reload plugin status:', err);
              // Retry on error if we haven't exceeded max attempts
              if (attempts < 3) {
                setTimeout(() => reloadStatusWithRetry(attempts + 1), 1000);
              }
            }
          };
          
          // Small delay to ensure backend has processed the connection
          setTimeout(() => {
            reloadStatusWithRetry();
          }, 500);
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
  }, [toast]);

  // Load Discord link status
  const loadDiscordStatus = async () => {
    try {
      const response = await apiFetch('/api/discord/link/status', {
        headers: getAuthHeaders(sessionToken)
      });
      const data = await response.json();
      if (data.success) {
        setDiscordLink({
          linked: data.linked,
          mapping: data.mapping
        });
      }
    } catch (error) {
      console.error('Failed to load Discord status:', error);
    }
  };

  // Load Discord bot status
  const loadDiscordBotStatus = async () => {
    try {
      // Only load bot status if user is admin/superadmin
      if (!isAdmin && !isSuperAdmin) {
        setDiscordBotStatus({ connected: false });
        return;
      }
      const response = await apiFetch('/api/discord/bot/status', {
        headers: getAuthHeaders(sessionToken)
      });
      const data = await response.json();
      if (data.success) {
        setDiscordBotStatus({
          connected: data.connected,
          botUser: data.botUser
        });
      }
    } catch (error) {
      console.error('Failed to load Discord bot status:', error);
      setDiscordBotStatus({ connected: false });
    }
  };

  // Handle Discord OAuth linking
  const handleLinkDiscord = async () => {
    setDiscordLoading(true);
    try {
      // Get OAuth URL from backend
      const response = await apiFetch('/api/discord/oauth/start', {
        headers: getAuthHeaders(sessionToken)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Discord OAuth flow');
      }

      // Open Discord OAuth in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        'Discord OAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        // If popup blocked, redirect directly
        window.location.href = data.authUrl;
      } else {
        // Listen for popup close or message
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Reload status to check if linking succeeded
            setTimeout(() => {
              loadDiscordStatus();
            }, 1000);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error linking Discord:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Discord OAuth flow',
        variant: 'destructive'
      });
    } finally {
      setDiscordLoading(false);
    }
  };

  // Handle Discord unlinking
  const handleUnlinkDiscord = async () => {
    setDiscordLoading(true);
    try {
      const response = await apiFetch('/api/discord/link', {
        method: 'DELETE',
        headers: getAuthHeaders(sessionToken)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink Discord account');
      }

      toast({
        title: 'Success',
        description: 'Discord account unlinked successfully',
      });
      await loadDiscordStatus();
    } catch (error) {
      console.error('Error unlinking Discord:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unlink Discord account',
        variant: 'destructive'
      });
    } finally {
      setDiscordLoading(false);
    }
  };

  const loadPlugins = async (page: number = currentPage) => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/plugins?page=${page}&limit=${pluginsPerPage}`, {
        cache: 'no-store', // Always fetch fresh plugin list
      } as RequestInit);
      const data = await response.json();
      if (data.success) {
        // Filter out Browser Agent - it's a system tool, not a user-connectable plugin
        const filteredPlugins = data.plugins.filter((p: any) => 
          p.id !== 'browser' && 
          !p.name?.toLowerCase().includes('browser agent')
        );
        setAvailablePlugins(filteredPlugins);
        if (data.pagination) {
          setTotalPlugins(data.pagination.total);
          setTotalPages(data.pagination.pages);
          setCurrentPage(data.pagination.page);
        }
      }
    } catch (err) {
      console.error('Failed to load plugins:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Check if it's a backend wake-up scenario
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        toast({
          title: 'Backend Starting',
          description: 'The server is waking up. This may take 30-60 seconds on first load. Retrying...',
          duration: 5000,
        });
      } else {
        setError('Failed to load available plugins');
        toast({
          title: 'Error',
          description: 'Failed to load available plugins',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Load shared connectors (workspace-wide API keys)
  const loadSharedConnectors = async () => {
    if (!sessionToken) return;
    setLoadingSharedConnectors(true);
    try {
      const response = await apiFetch('/api/shared-connectors', {
        headers: getAuthHeaders(sessionToken),
      });
      if (response.ok) {
        const data = await response.json();
        setSharedConnectors(data.connectors || []);
        setAvailablePreBuiltConnectors(data.availableConnectors || []);
      }
    } catch (error) {
      console.error('Error loading shared connectors:', error);
    } finally {
      setLoadingSharedConnectors(false);
    }
  };

  const installCustomPlugin = async (
    plugin: Plugin,
    credentials: Record<string, string> = {},
    customConfig?: Record<string, any>
  ) => {
    const response = await apiFetch(`/api/user-plugins/${plugin.id}/install`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        credentials,
        customConfig: customConfig || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to install plugin');
    }

    setSuccess(`${plugin.name} connected successfully!`);
    await loadPlugins();
    await loadUserStatus();
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
      const plugin = getPluginById(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      if (isCustomPlugin(plugin)) {
        if (plugin.requiresAuth) {
          openCredentialDialogForPlugin(plugin);
        } else {
          await installCustomPlugin(plugin);
        }

        setConnecting(prev => {
          const newSet = new Set(prev);
          newSet.delete(pluginId);
          return newSet;
        });
        return;
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
        const apiKey = window.prompt('Enter your Notion API Key (from https://www.notion.so/my-integrations):');
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

      const plugin = getPluginById(pluginId);
      const isCustom = isCustomPlugin(plugin);

      const endpoint = isCustom
        ? `/api/user-plugins/${pluginId}/uninstall`
        : `/api/plugins/${pluginId}/disable`;

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`${plugin?.name || pluginId} disconnected successfully`);
        await loadPlugins();
        await loadUserStatus();
      } else {
        setError(data.error || 'Failed to disconnect plugin');
      }
    } catch (err) {
      console.error('Failed to disconnect plugin:', err);
      setError('Failed to disconnect plugin');
    }
  };

  const handleDeletePlugin = async (pluginId: string) => {
    const plugin = getPluginById(pluginId);
    if (!plugin || !isCustomPlugin(plugin)) {
      setError('Only custom plugins can be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${plugin.name}? This removes the plugin definition and any stored credentials.`
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);
      setDeleting(prev => new Set(prev).add(pluginId));

      // Ensure plugin is uninstalled first
      await apiFetch(`/api/user-plugins/${pluginId}/uninstall`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => {
        // Ignore if uninstall fails (maybe not installed)
      });

      const response = await apiFetch(`/api/user-plugins/${pluginId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete plugin');
      }

      setSuccess(`${plugin.name} deleted successfully`);
      // Optimistically remove the plugin from local state so the UI updates immediately
      setAvailablePlugins(prev => prev.filter(p => p.id !== pluginId));
      setUserPluginStatus(prev => prev.filter(p => p.pluginId !== pluginId));
      await loadPlugins();
      await loadUserStatus();
    } catch (err) {
      console.error('Failed to delete plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete plugin');
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  };

  const handleSyncPlugin = async (pluginId: string) => {
    try {
      setError(null);
      const plugin = getPluginById(pluginId);
      if (isCustomPlugin(plugin)) {
        setError('Custom plugins sync automatically when executed.');
        return;
      }
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
      <div className="container mx-auto p-6 max-w-7xl pt-20 sm:pt-24">
        {/* Header skeleton */}
        <div className="mb-8 flex items-start justify-between animate-pulse">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-4 w-96 rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-44 rounded bg-muted" />
            <div className="h-10 w-24 rounded bg-muted" />
          </div>
        </div>
        
        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-muted" />
          ))}
        </div>
        
        {/* Plugin cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="h-6 w-10 rounded-full bg-muted" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-4/5 rounded bg-muted" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded-full bg-muted" />
                <div className="h-5 w-14 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl pt-20 sm:pt-24">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Skills</h1>
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

      {/* Discord Integration - Minimal Container */}
      <div className={`mb-2 flex items-center justify-between p-3 rounded-lg border ${discordLink.linked ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className="p-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">Discord Integration</p>
              {discordLink.linked && (
                <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                  <CheckCircle2 className="w-3 h-3 mr-0.5" />
                  Connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {discordLink.linked && discordLink.mapping 
                ? `Linked as ${discordLink.mapping.discordUsername || 'Discord user'}`
                : 'Link your Discord account to chat with Elon'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {discordLink.linked ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnlinkDiscord}
              disabled={discordLoading}
              className="h-8"
            >
              {discordLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Unlink
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleLinkDiscord}
              disabled={discordLoading}
              className="h-8 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              {discordLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              <MessageSquare className="w-3 h-3 mr-1" />
              Link
            </Button>
          )}
        </div>
      </div>

      {/* Discord Bot - Minimal Container - Only visible to admins/superadmins */}
      {(isAdmin || isSuperAdmin) && (
        <div className={`mb-2 flex items-center justify-between p-3 rounded-lg border ${discordBotStatus?.connected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">Discord Bot</p>
                {discordBotStatus?.connected ? (
                  <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    <XCircle className="w-3 h-3 mr-0.5" />
                    Offline
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {discordBotStatus?.connected 
                  ? `Connected as ${discordBotStatus.botUser?.username || 'bot'}`
                  : 'Connect Elon\'s Discord bot to your server (Admin only)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {discordBotStatus?.connected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  try {
                    setDiscordBotLoading(true);
                    const response = await apiFetch('/api/discord/bot/disconnect', {
                      method: 'POST',
                      headers: getAuthHeaders(sessionToken)
                    });
                    const data = await response.json();
                    if (data.success) {
                      toast({
                        title: 'Success',
                        description: 'Discord bot disconnected successfully',
                      });
                      await loadDiscordBotStatus();
                    } else {
                      throw new Error(data.error || 'Failed to disconnect bot');
                    }
                  } catch (error) {
                    console.error('Failed to disconnect bot:', error);
                    toast({
                      title: 'Error',
                      description: error instanceof Error ? error.message : 'Failed to disconnect Discord bot',
                      variant: 'destructive',
                    });
                  } finally {
                    setDiscordBotLoading(false);
                  }
                }}
                disabled={discordBotLoading}
                className="h-8"
              >
                {discordBotLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  // Open a dialog or navigate to settings for bot connection
                  // For now, we'll show a toast with instructions
                  toast({
                    title: 'Discord Bot Setup',
                    description: 'Go to Discord Developer Portal to create and connect your bot. See documentation for details.',
                  });
                }}
                className="h-8 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Setup
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Discord Bot Setup Dialog - Only shown when user clicks Setup */}
      {(isAdmin || isSuperAdmin) && !discordBotStatus?.connected && (
        <div className="mb-6">
          {/* This will be shown in a collapsible section or dialog when needed */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                placeholder="Enter Discord Bot Token"
                value={discordBotToken}
                onChange={(e) => setDiscordBotToken(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Get this from Discord Developer Portal → Your Application → Bot → Reset Token
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverId">Server ID (Optional)</Label>
              <Input
                id="serverId"
                placeholder="822863750939148329"
                value={discordServerId}
                onChange={(e) => setDiscordServerId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to listen to all servers. To find Server ID: Enable Developer Mode in Discord → Right-click server → "Copy Server ID"
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channelId">Default Channel ID (Optional)</Label>
              <Input
                id="channelId"
                placeholder="Default Channel ID for messages"
                value={discordChannelId}
                onChange={(e) => setDiscordChannelId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                If provided, Elon will use this channel by default for sending messages.
              </p>
            </div>
            <Button
              onClick={async () => {
                try {
                  setDiscordBotLoading(true);
                  const response = await apiFetch('/api/discord/bot/connect', {
                    method: 'POST',
                    headers: {
                      ...getAuthHeaders(sessionToken),
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      botToken: discordBotToken,
                      serverId: discordServerId || undefined,
                      channelId: discordChannelId || undefined,
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    toast({
                      title: 'Success',
                      description: 'Discord bot connected successfully!',
                    });
                    setDiscordBotToken('');
                    setDiscordServerId('');
                    setDiscordChannelId('');
                    await loadDiscordBotStatus();
                  } else {
                    throw new Error(data.error || 'Failed to connect bot');
                  }
                } catch (error) {
                  console.error('Failed to connect bot:', error);
                  toast({
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Failed to connect Discord bot',
                    variant: 'destructive',
                  });
                } finally {
                  setDiscordBotLoading(false);
                }
              }}
              disabled={discordBotLoading || !discordBotToken.trim()}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              {discordBotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="mr-2 h-4 w-4" />
              Connect Discord Bot
            </Button>
          </div>
        </div>
      )}
      

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="all" className="flex-1 min-w-[80px]">All Skills</TabsTrigger>
          <TabsTrigger value="shared" className="flex-1 min-w-[80px]">Shared</TabsTrigger>
          <TabsTrigger value="personal" className="flex-1 min-w-[80px]">Personal</TabsTrigger>
          <TabsTrigger value="connected" className="flex-1 min-w-[80px]">Connected</TabsTrigger>
          <TabsTrigger value="available" className="flex-1 min-w-[80px]">Available</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="space-y-2">
            {/* Custom Plugin Generator - Minimal Container */}
            <div className="flex items-center justify-between p-3 rounded-lg border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 hover:border-purple-400 transition-all cursor-pointer" onClick={openGenerator}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm text-purple-600 dark:text-purple-400">Generate Custom Plugin</p>
                  <p className="text-xs text-muted-foreground">AI-Powered</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openGenerator(); }}>
                <Plus className="w-3 h-3 mr-1" />
                Create
              </Button>
            </div>

            {availablePlugins.map((plugin) => {
              const status = getPluginStatus(plugin.id);
              const enabled = isPluginEnabled(plugin.id);
              const customPlugin = isCustomPlugin(plugin);

              return (
                <div key={plugin.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border ${enabled ? 'border-primary bg-primary/5' : 'border-border bg-card'} gap-3`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {getPluginIcon(plugin.icon, plugin.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{plugin.name}</p>
                        {enabled && (
                          <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            Connected
                          </Badge>
                        )}
                        {enabled && status && getHealthBadge(status.status.health)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{plugin.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                        </Badge>
                        {status?.status.lastSync && (
                          <span className="text-xs text-muted-foreground">
                            Synced {new Date(status.status.lastSync).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {enabled ? (
                      <>
                        {customPlugin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCredentialDialogForPlugin(plugin)}
                            className="h-8"
                          >
                            <Key className="w-3 h-3 mr-1" />
                            Credentials
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncPlugin(plugin.id)}
                            disabled={syncing.has(plugin.id) || status?.status.syncInProgress}
                            className="h-8"
                          >
                            {syncing.has(plugin.id) || status?.status.syncInProgress ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnectPlugin(plugin.id)}
                          className="h-8"
                        >
                          Disconnect
                        </Button>
                        {customPlugin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePlugin(plugin.id)}
                            disabled={deleting.has(plugin.id)}
                            className="h-8"
                          >
                            {deleting.has(plugin.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnectPlugin(plugin.id)}
                        disabled={connecting.has(plugin.id)}
                        className="h-8"
                      >
                        {connecting.has(plugin.id) ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="connected" className="mt-6">
          <div className="space-y-2">
            {availablePlugins
              .filter(plugin => isPluginEnabled(plugin.id))
              .map((plugin) => {
                const status = getPluginStatus(plugin.id);
                const customPlugin = isCustomPlugin(plugin);

                return (
                  <div key={plugin.id} className="flex items-center justify-between p-3 rounded-lg border border-primary bg-primary/5">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getPluginIcon(plugin.icon, plugin.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{plugin.name}</p>
                          <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            Connected
                          </Badge>
                          {status && getHealthBadge(status.status.health)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                          </Badge>
                          {status?.status.lastSync && (
                            <span className="text-xs text-muted-foreground">
                              Synced {new Date(status.status.lastSync).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Get tools for this plugin
                          const pluginTools = plugin.capabilities?.map((cap: string, idx: number) => ({
                            id: cap.toLowerCase().replace(/\s+/g, '_'),
                            name: cap,
                            description: `Tool: ${cap}`,
                          })) || [];
                          setSelectedPluginForPermissions({
                            id: plugin.id,
                            name: plugin.name,
                            tools: pluginTools,
                          });
                          setShowPermissionsDialog(true);
                        }}
                        className="h-8"
                        title="Manage tool permissions"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Permissions
                      </Button>
                      {customPlugin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCredentialDialogForPlugin(plugin)}
                          className="h-8"
                        >
                          <Key className="w-3 h-3 mr-1" />
                          Credentials
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncPlugin(plugin.id)}
                          disabled={syncing.has(plugin.id) || status?.status.syncInProgress}
                          className="h-8"
                        >
                          {syncing.has(plugin.id) || status?.status.syncInProgress ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnectPlugin(plugin.id)}
                        className="h-8"
                      >
                        Disconnect
                      </Button>
                      {customPlugin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePlugin(plugin.id)}
                          disabled={deleting.has(plugin.id)}
                          className="h-8"
                        >
                          {deleting.has(plugin.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Delete'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            {availablePlugins.filter(p => isPluginEnabled(p.id)).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No skills connected yet. Connect your first skill to get started!
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          <div className="space-y-2">
            {availablePlugins
              .filter(plugin => !isPluginEnabled(plugin.id))
              .map((plugin) => {
                const customPlugin = isCustomPlugin(plugin);
                return (
                  <div key={plugin.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getPluginIcon(plugin.icon, plugin.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{plugin.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{plugin.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {getCategoryLabel(plugin.category, (plugin as any).isUserGenerated)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <Button
                        size="sm"
                        onClick={() => handleConnectPlugin(plugin.id)}
                        disabled={connecting.has(plugin.id)}
                        className="h-8"
                      >
                        {connecting.has(plugin.id) ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : null}
                        Connect
                      </Button>
                      {customPlugin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePlugin(plugin.id)}
                          disabled={deleting.has(plugin.id)}
                          className="h-8"
                        >
                          {deleting.has(plugin.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Delete'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            {availablePlugins.filter(p => !isPluginEnabled(p.id)).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                All available skills are already connected!
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="shared" className="mt-6">
          <TooltipProvider>
            <div className="mb-6 space-y-4">
              {/* Help Section */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Shared Connectors
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Shared connectors are workspace-wide API keys and environment variables configured by admins. 
                            Once set up, all users in your workspace can use them automatically when generating apps.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Configured once by admins, available to everyone in your workspace. These connectors provide API keys and environment variables that are automatically injected into your generated apps.
                    </p>
                    
                    {/* Examples */}
                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-blue-100 dark:border-blue-900">
                      <p className="text-xs font-medium mb-2 text-blue-900 dark:text-blue-100">How it works:</p>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span><strong>Stripe:</strong> When you generate a payment app, Stripe API keys are automatically available as environment variables</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span><strong>Vercel:</strong> Your deployments automatically use the configured Vercel token for publishing</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span><strong>GitHub:</strong> Repository operations use the shared GitHub token automatically</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connectors List */}
              {loadingSharedConnectors ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Show configured shared connectors */}
                  {sharedConnectors.map((connector: any) => {
                    const preBuilt = availablePreBuiltConnectors.find(c => c.id === connector.serviceName?.toLowerCase());
                    const connectorData = preBuilt || {
                      id: connector.serviceName,
                      name: connector.name || connector.serviceName,
                      description: connector.description || `Shared connector for ${connector.serviceName}`,
                      icon: '🔌',
                      category: 'other',
                    };
                    
                    return (
                      <div key={connector.id} className="flex items-center justify-between p-4 rounded-lg border border-primary bg-primary/5">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 text-2xl">{connectorData.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{connectorData.name}</p>
                              <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                                <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                Configured
                              </Badge>
                              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                                Shared
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{connectorData.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>Configured by: {connector.configuredBy || 'Admin'}</span>
                              {connector.lastUsed && (
                                <span>• Last used: {new Date(connector.lastUsed).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {isAdmin && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const preBuiltConnector = availablePreBuiltConnectors.find(c => c.id === connector.serviceName?.toLowerCase());
                                      if (preBuiltConnector) {
                                        setSelectedConnector({
                                          ...preBuiltConnector,
                                          isConfigured: true,
                                          existingConfig: {
                                            id: connector.id,
                                            envVariables: connector.envVariables || {},
                                          },
                                        });
                                        setConnectorConfigMode('edit');
                                        setConnectorConfigId(connector.id);
                                        setConnectorConfigDialogOpen(true);
                                      }
                                    }}
                                    className="h-8"
                                  >
                                    <Settings className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Update API keys and environment variables</p>
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await apiFetch(`/api/shared-connectors/${connector.id}`, {
                                      method: 'DELETE',
                                      headers: getAuthHeaders(sessionToken),
                                    });
                                    if (response.ok) {
                                      toast({
                                        title: 'Success',
                                        description: 'Shared connector removed',
                                      });
                                      loadSharedConnectors();
                                    }
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to remove connector',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                                className="h-8"
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Show available pre-built connectors that aren't configured yet */}
                  {availablePreBuiltConnectors
                    .filter(c => !c.isConfigured)
                    .map((connector: any) => (
                      <div key={connector.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 text-2xl">{connector.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{connector.name}</p>
                              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                                Available
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{connector.description}</p>
                            {connector.documentationUrl && (
                              <a
                                href={connector.documentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Documentation
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {isAdmin ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedConnector({
                                  ...connector,
                                  isConfigured: false,
                                });
                                setConnectorConfigMode('create');
                                setConnectorConfigId(undefined);
                                setConnectorConfigDialogOpen(true);
                              }}
                              disabled={connecting.has(connector.id)}
                              className="h-8"
                            >
                              {connecting.has(connector.id) ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3 mr-1" />
                              )}
                              Configure
                            </Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground">Admin only</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Only admins can configure shared connectors</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    ))}

                  {sharedConnectors.length === 0 && availablePreBuiltConnectors.filter(c => !c.isConfigured).length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No shared connectors available</p>
                      {isAdmin && (
                        <p className="text-xs mt-1">Configure a connector above to get started</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TooltipProvider>
        </TabsContent>

        <TabsContent value="personal" className="mt-6">
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <User className="h-4 w-4 text-purple-600" />
              Personal Connectors
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect your personal tool accounts to provide context while building. Only you can access your connections. Examples: Gmail, Notion, Linear, Miro.
            </p>
          </div>
          <div className="space-y-2">
            {availablePlugins
              .filter(plugin => {
                const personalIds = ['gmail', 'calendar', 'notion', 'linear', 'miro', 'discord', 'slack', 'github'];
                return personalIds.includes(plugin.id.toLowerCase()) || plugin.isPersonal === true || (!plugin.isShared && plugin.id !== 'vercel' && plugin.id !== 'stripe' && plugin.id !== 'shopify');
              })
              .map((plugin) => {
                const status = getPluginStatus(plugin.id);
                const isConnected = isPluginEnabled(plugin.id);
                const customPlugin = isCustomPlugin(plugin);
                return (
                  <div key={plugin.id} className={`flex items-center justify-between p-3 rounded-lg border ${isConnected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getPluginIcon(plugin.icon, plugin.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{plugin.name}</p>
                          {isConnected && (
                            <Badge className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              Connected
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                            Personal
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">{plugin.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {isConnected ? (
                        <>
                          {customPlugin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCredentialDialogForPlugin(plugin)}
                              className="h-8"
                            >
                              <Key className="w-3 h-3 mr-1" />
                              Credentials
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSyncPlugin(plugin.id)}
                              disabled={syncing.has(plugin.id) || status?.status.syncInProgress}
                              className="h-8"
                            >
                              {syncing.has(plugin.id) || status?.status.syncInProgress ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnectPlugin(plugin.id)}
                            className="h-8"
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnectPlugin(plugin.id)}
                          disabled={connecting.has(plugin.id)}
                          className="h-8"
                        >
                          {connecting.has(plugin.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : null}
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            {availablePlugins.filter(p => {
              const personalIds = ['gmail', 'calendar', 'notion', 'linear', 'miro', 'discord', 'slack', 'github'];
              return personalIds.includes(p.id.toLowerCase()) || p.isPersonal === true || (!p.isShared && p.id !== 'vercel' && p.id !== 'stripe' && p.id !== 'shopify');
            }).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No personal connectors available
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => {
                    if (currentPage > 1) {
                      loadPlugins(currentPage - 1);
                    }
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => loadPlugins(page)}
                        isActive={page === currentPage}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => {
                    if (currentPage < totalPages) {
                      loadPlugins(currentPage + 1);
                    }
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

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
                    placeholder="Exempel: Skapa en Discord-plugin som kan läsa meddelanden från kanaler, skicka meddelanden och lista tillgängliga kanaler. Använd Discord.js och bot token för autentisering."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Min 10 tecken, max 2000 tecken
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 max-h-[400px] overflow-y-auto">
                      <p className="text-sm font-medium text-foreground">15 Exempel på användbara plugins:</p>
                      <div className="text-xs text-muted-foreground space-y-2.5">
                        <div>
                          <p className="font-medium text-foreground">1. Slack</p>
                          <p className="pl-2 mt-0.5">"Skapa en Slack-plugin som kan skicka meddelanden till kanaler, läsa meddelanden, lista workspaces och skicka DM. Använd Slack Web API med OAuth2."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">2. Trello</p>
                          <p className="pl-2 mt-0.5">"Skapa en Trello-plugin som kan skapa kort, lista kort från boards, uppdatera kortstatus och lägga till kommentarer. Använd Trello API med API-nyckel."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">3. Asana</p>
                          <p className="pl-2 mt-0.5">"Skapa en Asana-plugin som kan skapa tasks, uppdatera task-status, lista projects och lägga till kommentarer. Använd Asana API med personal access token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">4. Jira</p>
                          <p className="pl-2 mt-0.5">"Skapa en Jira-plugin som kan skapa issues, uppdatera issue-status, söka efter issues och lägga till kommentarer. Använd Jira REST API med API-token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">5. Linear</p>
                          <p className="pl-2 mt-0.5">"Skapa en Linear-plugin som kan skapa issues, uppdatera issue-status, lista teams och söka efter issues. Använd Linear API med API-nyckel."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">6. Figma</p>
                          <p className="pl-2 mt-0.5">"Skapa en Figma-plugin som kan lista files, hämta komponenter, söka efter designs och kommentera på frames. Använd Figma REST API med personal access token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">7. Airtable</p>
                          <p className="pl-2 mt-0.5">"Skapa en Airtable-plugin som kan läsa records från tables, skapa nya records, uppdatera records och lista bases. Använd Airtable API med API-nyckel."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">8. Monday.com</p>
                          <p className="pl-2 mt-0.5">"Skapa en Monday.com-plugin som kan skapa items, uppdatera item-status, lista boards och lägga till updates. Använd Monday.com API med API-token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">9. Spotify</p>
                          <p className="pl-2 mt-0.5">"Skapa en Spotify-plugin som kan söka efter låtar, skapa playlists, lägga till låtar i playlists och hämta artistinformation. Använd Spotify Web API med OAuth2."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">10. Twitter/X</p>
                          <p className="pl-2 mt-0.5">"Skapa en Twitter-plugin som kan skicka tweets, läsa timeline, söka efter tweets och hämta användarinformation. Använd Twitter API v2 med Bearer token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">11. Stripe</p>
                          <p className="pl-2 mt-0.5">"Skapa en Stripe-plugin som kan skapa customers, lista charges, hämta payment intents och skapa subscriptions. Använd Stripe API med secret key."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">12. Shopify</p>
                          <p className="pl-2 mt-0.5">"Skapa en Shopify-plugin som kan lista products, skapa orders, uppdatera inventory och hämta customer information. Använd Shopify Admin API med access token."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">13. YouTube</p>
                          <p className="pl-2 mt-0.5">"Skapa en YouTube-plugin som kan söka efter videos, hämta video information, lista playlists och hämta channel statistics. Använd YouTube Data API v3 med API-nyckel."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">14. LinkedIn</p>
                          <p className="pl-2 mt-0.5">"Skapa en LinkedIn-plugin som kan skapa posts, hämta profile information, söka efter connections och läsa feed. Använd LinkedIn API med OAuth2."</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">15. Reddit</p>
                          <p className="pl-2 mt-0.5">"Skapa en Reddit-plugin som kan läsa posts från subreddits, skapa posts, kommentera och hämta trending topics. Använd Reddit API med OAuth2."</p>
                        </div>
                      </div>
                    </div>
                  </div>
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
                      <AlertDescription>
                        <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          Credentials Required
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          This plugin needs credentials (API keys, OAuth tokens, etc.). After closing this dialog,
                          select the plugin in the Integrations list and click "Connect" to enter the required values.
                        </p>
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
      {/* Tool Permissions Dialog */}
      {selectedPluginForPermissions && (
        <ToolPermissionsDialog
          open={showPermissionsDialog}
          onOpenChange={setShowPermissionsDialog}
          pluginId={selectedPluginForPermissions.id}
          pluginName={selectedPluginForPermissions.name}
          tools={selectedPluginForPermissions.tools}
        />
      )}

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

      {/* Connector Configuration Dialog */}
      {selectedConnector && (
        <ConnectorConfigDialog
          open={connectorConfigDialogOpen}
          onOpenChange={(open) => {
            setConnectorConfigDialogOpen(open);
            if (!open) {
              setSelectedConnector(null);
            }
          }}
          connector={selectedConnector}
          isConfigured={selectedConnector?.isConfigured || false}
          existingConfig={selectedConnector?.existingConfig}
          onSuccess={() => {
            loadSharedConnectors();
            setSelectedConnector(null);
            setConnectorConfigDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
