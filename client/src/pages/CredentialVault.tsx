import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { apiFetch } from '../lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Key,
  Plus,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface Credential {
  id: number;
  serviceName: string;
  credentialType: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  validationStatus?: string;
  lastUsedAt?: string;
  lastValidatedAt?: string;
  createdAt: string;
}

// Only OAuth services - API keys should be managed in Integrations page
const SERVICE_CONFIGS = {
  discord: {
    name: 'Discord',
    icon: '💬',
    type: 'oauth2',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { name: 'botToken', label: 'Bot Token (Optional)', type: 'password', required: false },
    ],
    docsUrl: 'https://discord.com/developers/applications',
  },
  slack: {
    name: 'Slack',
    icon: '💼',
    type: 'oauth2',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    docsUrl: 'https://api.slack.com/apps',
  },
  github: {
    name: 'GitHub',
    icon: '🐙',
    type: 'personal_access_token',
    fields: [
      { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true },
    ],
    docsUrl: 'https://github.com/settings/tokens',
  },
  gitlab: {
    name: 'GitLab',
    icon: '🦊',
    type: 'personal_access_token',
    fields: [
      { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true },
    ],
    docsUrl: 'https://gitlab.com/-/profile/personal_access_tokens',
  },
};

export default function CredentialVault() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  // Fetch credentials - only OAuth credentials
  const { data: credentials, isLoading } = useQuery<{ credentials: Credential[] }>({
    queryKey: ['credentials'],
    queryFn: async () => {
      const res = await apiFetch('/api/credentials');
      if (!res.ok) throw new Error('Failed to fetch credentials');
      const data = await res.json();
      // Filter to only show OAuth credentials (oauth2, personal_access_token for OAuth services)
      const oauthServices = ['discord', 'slack', 'gmail', 'calendar', 'github', 'gitlab'];
      const filtered = {
        ...data,
        credentials: data.credentials.filter((cred: Credential) => 
          cred.credentialType === 'oauth2' || 
          (cred.credentialType === 'personal_access_token' && oauthServices.includes(cred.serviceName.toLowerCase()))
        ),
      };
      return filtered;
    },
  });

  // Add credential mutation
  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/credentials', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add credential');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setIsAddDialogOpen(false);
      setSelectedService('');
      setFormData({});
    },
  });

  // Delete credential mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/credentials/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete credential');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });

  // Test credential mutation
  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/credentials/${id}/test`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to test credential');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });

  const handleAddCredential = () => {
    if (!selectedService) return;

    const config = SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS];
    const credentials: Record<string, string> = {};

    // Extract credential fields
    config.fields.forEach(field => {
      if (formData[field.name]) {
        credentials[field.name] = formData[field.name];
      }
    });

    addMutation.mutate({
      serviceName: selectedService,
      credentialType: config.type,
      displayName: formData.displayName || `${config.name} Credential`,
      description: formData.description,
      credentials,
    });
  };

  const handleOAuthConnect = async (service: string) => {
    try {
      const res = await apiFetch(`/api/credentials/oauth/${service}/start`);
      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Failed to start OAuth flow', error);
    }
  };

  const getStatusBadge = (credential: Credential) => {
    if (!credential.validationStatus) {
      return <Badge variant="secondary">Not Tested</Badge>;
    }

    switch (credential.validationStatus) {
      case 'valid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Invalid</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="secondary">{credential.validationStatus}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Key className="w-8 h-8 text-blue-500" />
            OAuth Credentials
          </h1>
          <p className="text-muted-foreground">
            Manage your OAuth credentials for plugins. For API keys and connectors, go to <a href="/integrations" className="text-primary hover:underline">Integrations</a>.
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {/* Credentials Grid */}
      {isLoading ? (
        <div className="text-center py-12">Loading credentials...</div>
      ) : credentials?.credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No OAuth Credentials Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add OAuth credentials for plugins that require them. For API keys and connectors, go to <a href="/integrations" className="text-primary hover:underline">Integrations</a>.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {credentials?.credentials.map((cred) => {
            const config = SERVICE_CONFIGS[cred.serviceName as keyof typeof SERVICE_CONFIGS];
            return (
              <Card key={cred.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{config?.icon || '🔑'}</div>
                      <div>
                        <CardTitle>{cred.displayName}</CardTitle>
                        <CardDescription>
                          {config?.name || cred.serviceName} • {cred.credentialType}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(cred)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1 text-sm">
                      {cred.description && (
                        <p className="text-muted-foreground">{cred.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Created: {new Date(cred.createdAt).toLocaleDateString()}</span>
                        {cred.lastUsedAt && (
                          <span>Last used: {new Date(cred.lastUsedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testMutation.mutate(cred.id)}
                        disabled={testMutation.isPending}
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this credential?')) {
                            deleteMutation.mutate(cred.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Credential Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Credential</DialogTitle>
            <DialogDescription>
              Choose a service and provide your credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Service Selection */}
            {!selectedService ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(SERVICE_CONFIGS).map(([key, config]) => (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => setSelectedService(key)}
                  >
                    <span className="text-3xl">{config.icon}</span>
                    <span className="font-semibold">{config.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {config.type.replace('_', ' ')}
                    </Badge>
                  </Button>
                ))}
              </div>
            ) : (
              <>
                {/* Selected Service Form */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].icon}
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        {SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(
                        SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].docsUrl,
                        '_blank'
                      )}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Docs
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedService('');
                        setFormData({});
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>

                {/* OAuth Option */}
                {SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].type === 'oauth2' && (
                  <Alert>
                    <AlertDescription className="flex justify-between items-center">
                      <span>Prefer OAuth? Connect with one click</span>
                      <Button
                        size="sm"
                        onClick={() => handleOAuthConnect(selectedService)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Connect with OAuth
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Input
                      id="displayName"
                      placeholder={`My ${SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].name} Credential`}
                      value={formData.displayName || ''}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Optional description..."
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-2"
                      rows={2}
                    />
                  </div>

                  {SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].fields.map((field) => (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label} {field.required && '*'}
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          id={field.name}
                          type={showPassword[field.name] ? 'text' : field.type}
                          placeholder={field.label}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          required={field.required}
                        />
                        {field.type === 'password' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={() => setShowPassword({
                              ...showPassword,
                              [field.name]: !showPassword[field.name],
                            })}
                          >
                            {showPassword[field.name] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {addMutation.isError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {addMutation.error instanceof Error
                        ? addMutation.error.message
                        : 'Failed to add credential'}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          {selectedService && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setSelectedService('');
                  setFormData({});
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCredential}
                disabled={
                  !formData.displayName ||
                  addMutation.isPending ||
                  SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS].fields.some(
                    f => f.required && !formData[f.name]
                  )
                }
              >
                {addMutation.isPending ? 'Adding...' : 'Add Credential'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
