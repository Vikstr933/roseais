import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, getApiUrl } from '../lib/api';
import { getAuthHeaders } from '@/contexts/AuthContext';

interface EnvVariable {
  name: string;
  label: string;
  description: string;
  type: 'password' | 'text' | 'url';
  required: boolean;
  placeholder?: string;
  helpUrl?: string;
}

interface APIKeyConfig {
  name: string;
  label: string;
  description: string;
  type: 'api_key' | 'secret' | 'token' | 'password';
  required: boolean;
  placeholder?: string;
  helpUrl?: string;
}

interface PreBuiltConnector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  apiKeys: APIKeyConfig[];
  envVariables: EnvVariable[];
  documentationUrl?: string;
}

interface ConnectorConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connector: PreBuiltConnector | null;
  isConfigured?: boolean;
  existingConfig?: {
    id: string;
    envVariables?: Record<string, string>;
  };
  onSuccess?: () => void;
}

export function ConnectorConfigDialog({
  open,
  onOpenChange,
  connector,
  isConfigured = false,
  existingConfig,
  onSuccess,
}: ConnectorConfigDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [envVariableValues, setEnvVariableValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with existing values if configured
  useEffect(() => {
    if (connector) {
      // Reset form
      const newApiKeyValues: Record<string, string> = {};
      const newEnvValues: Record<string, string> = {};

      connector.apiKeys.forEach(key => {
        newApiKeyValues[key.name] = '';
      });

      connector.envVariables.forEach(env => {
        newEnvValues[env.name] = existingConfig?.envVariables?.[env.name] || '';
      });

      setApiKeyValues(newApiKeyValues);
      setEnvVariableValues(newEnvValues);
      setErrors({});
    }
  }, [connector, existingConfig, open]);

  const handleSave = async () => {
    if (!connector) return;

    // Validate required fields
    const newErrors: Record<string, string> = {};

    // Check required API keys
    connector.apiKeys.forEach(key => {
      if (key.required && !apiKeyValues[key.name]?.trim()) {
        newErrors[`apiKey_${key.name}`] = `${key.label} is required`;
      }
    });

    // Check required env variables
    connector.envVariables.forEach(env => {
      if (env.required && !envVariableValues[env.name]?.trim()) {
        newErrors[`env_${env.name}`] = `${env.label} is required`;
      }
      // Validate URLs
      if (env.type === 'url' && envVariableValues[env.name]) {
        try {
          new URL(envVariableValues[env.name]);
        } catch {
          newErrors[`env_${env.name}`] = 'Please enter a valid URL';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('Not authenticated');
      }

      // Get the primary API key (first required one)
      const primaryKey = connector.apiKeys.find(k => k.required) || connector.apiKeys[0];
      const primaryKeyValue = apiKeyValues[primaryKey.name];

      if (isConfigured && existingConfig) {
        // Update existing connector
        const response = await apiFetch(`/api/shared-connectors/${existingConfig.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keyValue: primaryKeyValue,
            keyType: primaryKey.type,
            envVariables: envVariableValues,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update connector');
        }
      } else {
        // Create new connector
        const response = await apiFetch('/api/shared-connectors', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceName: connector.id,
            keyValue: primaryKeyValue,
            keyType: primaryKey.type,
            description: connector.description,
            envVariables: envVariableValues,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create connector');
        }
      }

      toast({
        title: 'Success',
        description: `${connector.name} connector ${isConfigured ? 'updated' : 'configured'} successfully`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving connector:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save connector configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!connector) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{connector.icon}</span>
            <span>Configure {connector.name}</span>
          </DialogTitle>
          <DialogDescription>
            {connector.description}
            {connector.documentationUrl && (
              <a
                href={connector.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Keys Section */}
          {connector.apiKeys.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">API Keys</h3>
                <Badge variant="outline" className="text-xs">
                  {connector.apiKeys.filter(k => k.required).length} required
                </Badge>
              </div>
              {connector.apiKeys.map((key) => (
                <div key={key.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key.name}>
                      {key.label} {key.required && <span className="text-destructive">*</span>}
                    </Label>
                    {key.helpUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => window.open(key.helpUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Get Key
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id={key.name}
                      type={showPasswords[`apiKey_${key.name}`] ? 'text' : (key.type === 'password' || key.type === 'secret' ? 'password' : 'text')}
                      placeholder={key.placeholder || `Enter ${key.label.toLowerCase()}`}
                      value={apiKeyValues[key.name] || ''}
                      onChange={(e) => {
                        setApiKeyValues({ ...apiKeyValues, [key.name]: e.target.value });
                        if (errors[`apiKey_${key.name}`]) {
                          setErrors({ ...errors, [`apiKey_${key.name}`]: '' });
                        }
                      }}
                      className={errors[`apiKey_${key.name}`] ? 'border-destructive' : ''}
                    />
                    {(key.type === 'password' || key.type === 'secret') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPasswords({ ...showPasswords, [`apiKey_${key.name}`]: !showPasswords[`apiKey_${key.name}`] })}
                      >
                        {showPasswords[`apiKey_${key.name}`] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  {key.description && (
                    <p className="text-xs text-muted-foreground">{key.description}</p>
                  )}
                  {errors[`apiKey_${key.name}`] && (
                    <p className="text-xs text-destructive">{errors[`apiKey_${key.name}`]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Env Variables Section */}
          {connector.envVariables.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Environment Variables</h3>
                <Badge variant="outline" className="text-xs">
                  For project deployments
                </Badge>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  These environment variables will be automatically added to your project deployments (e.g., Vercel).
                </AlertDescription>
              </Alert>
              {connector.envVariables.map((env) => (
                <div key={env.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={env.name}>
                      {env.label} {env.required && <span className="text-destructive">*</span>}
                    </Label>
                    {env.helpUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => window.open(env.helpUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Help
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id={env.name}
                      type={showPasswords[`env_${env.name}`] ? 'text' : (env.type === 'password' ? 'password' : 'text')}
                      placeholder={env.placeholder || `Enter ${env.label.toLowerCase()}`}
                      value={envVariableValues[env.name] || ''}
                      onChange={(e) => {
                        setEnvVariableValues({ ...envVariableValues, [env.name]: e.target.value });
                        if (errors[`env_${env.name}`]) {
                          setErrors({ ...errors, [`env_${env.name}`]: '' });
                        }
                      }}
                      className={errors[`env_${env.name}`] ? 'border-destructive' : ''}
                    />
                    {env.type === 'password' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPasswords({ ...showPasswords, [`env_${env.name}`]: !showPasswords[`env_${env.name}`] })}
                      >
                        {showPasswords[`env_${env.name}`] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  {env.description && (
                    <p className="text-xs text-muted-foreground">{env.description}</p>
                  )}
                  {errors[`env_${env.name}`] && (
                    <p className="text-xs text-destructive">{errors[`env_${env.name}`]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {isConfigured ? 'Update' : 'Configure'} {connector.name}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

