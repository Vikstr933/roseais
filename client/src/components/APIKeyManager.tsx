import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Key,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface APIKey {
  id: number;
  serviceName: string;
  keyName: string;
  keyType: 'api_key' | 'secret' | 'token' | 'password';
  description?: string;
  website?: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

interface APIKeyRequest {
  serviceName: string;
  keyName: string;
  keyType: 'api_key' | 'secret' | 'token' | 'password';
  description?: string;
  website?: string;
  requiredFor: string;
  promptMessage: string;
}

interface APIKeyManagerProps {
  userId: string;
  onAPIKeyAdded?: (apiKey: APIKey) => void;
  onAPIKeyRequired?: (missingKeys: APIKeyRequest[]) => void;
}

export function APIKeyManager({
  userId,
  onAPIKeyAdded,
  onAPIKeyRequired,
}: APIKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState({
    serviceName: '',
    keyName: '',
    keyValue: '',
    keyType: 'api_key' as const,
    description: '',
    website: '',
  });
  const [showKeyValue, setShowKeyValue] = useState(false);
  const { toast } = useToast();

  // Load user's API keys
  useEffect(() => {
    loadAPIKeys();
  }, [userId]);

  const loadAPIKeys = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/api-keys/user/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setApiKeys(data.apiKeys);
      } else {
        throw new Error(data.error || 'Failed to load API keys');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addAPIKey = async () => {
    if (!newKey.serviceName || !newKey.keyName || !newKey.keyValue) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/api-keys/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...newKey,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'API key stored successfully',
        });

        setNewKey({
          serviceName: '',
          keyName: '',
          keyValue: '',
          keyType: 'api_key',
          description: '',
          website: '',
        });
        setShowAddForm(false);
        loadAPIKeys();

        if (onAPIKeyAdded) {
          onAPIKeyAdded(data.apiKey);
        }
      } else {
        throw new Error(data.error || 'Failed to store API key');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAPIKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${userId}/${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'API key deleted successfully',
        });
        loadAPIKeys();
      } else {
        throw new Error(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const checkAPIKeyRequirements = async (prompt: string) => {
    try {
      const response = await fetch('/api/api-keys/check-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt,
        }),
      });

      const data = await response.json();

      if (response.ok && !data.hasAllKeys && data.missingKeys.length > 0) {
        if (onAPIKeyRequired) {
          onAPIKeyRequired(data.missingKeys);
        }
        return data.missingKeys;
      }

      return [];
    } catch (error) {
      console.error('Error checking API key requirements:', error);
      return [];
    }
  };

  const getKeyTypeColor = (keyType: string) => {
    switch (keyType) {
      case 'api_key':
        return 'bg-blue-100 text-blue-800';
      case 'secret':
        return 'bg-red-100 text-red-800';
      case 'token':
        return 'bg-green-100 text-green-800';
      case 'password':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Key className="h-6 w-6" />
          <h3 className="text-lg font-semibold">API Key Management</h3>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add API Key
        </Button>
      </div>

      {/* Add API Key Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Service Name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g., OpenAI, Anthropic"
                  value={newKey.serviceName}
                  onChange={e =>
                    setNewKey({ ...newKey, serviceName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., api_key, secret_key"
                  value={newKey.keyName}
                  onChange={e =>
                    setNewKey({ ...newKey, keyName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-type">Key Type</Label>
              <Select
                value={newKey.keyType}
                onValueChange={(value: any) =>
                  setNewKey({ ...newKey, keyType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-value">Key Value</Label>
              <div className="relative">
                <Input
                  id="key-value"
                  type={showKeyValue ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={newKey.keyValue}
                  onChange={e =>
                    setNewKey({ ...newKey, keyValue: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKeyValue(!showKeyValue)}
                >
                  {showKeyValue ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="What is this key used for?"
                value={newKey.description}
                onChange={e =>
                  setNewKey({ ...newKey, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website (Optional)</Label>
              <Input
                id="website"
                placeholder="https://platform.openai.com/api-keys"
                value={newKey.website}
                onChange={e =>
                  setNewKey({ ...newKey, website: e.target.value })
                }
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={addAPIKey} disabled={isLoading}>
                {isLoading ? 'Storing...' : 'Store API Key'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys ({apiKeys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading API keys...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No API keys stored yet</p>
              <p className="text-sm">Add your first API key to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(apiKey => (
                <Card key={apiKey.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(apiKey.isActive)}
                        <h4 className="font-medium">{apiKey.serviceName}</h4>
                        <Badge className={getKeyTypeColor(apiKey.keyType)}>
                          {apiKey.keyType}
                        </Badge>
                        <Badge variant="outline">{apiKey.keyName}</Badge>
                      </div>

                      {apiKey.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {apiKey.description}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>
                          Created:{' '}
                          {new Date(apiKey.createdAt).toLocaleDateString()}
                        </span>
                        {apiKey.lastUsed && (
                          <span>
                            Last used:{' '}
                            {new Date(apiKey.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                        <span>Used {apiKey.usageCount} times</span>
                      </div>

                      {apiKey.website && (
                        <div className="mt-2">
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={apiKey.website}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Get Key
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAPIKey(apiKey.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
