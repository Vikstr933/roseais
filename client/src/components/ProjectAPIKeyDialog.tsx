import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Key, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectAPIKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingApiKeys: MissingAPIKey[];
  projectId: number | null;
  projectName?: string;
  allowUserWide?: boolean;
  onKeysAdded?: () => void | Promise<void>;
}

interface Project {
  id: number;
  name: string;
}

export interface RequiredAPIKey {
  serviceName: string;
  keyName: string;
  keyType?: 'api_key' | 'secret' | 'token' | 'password';
  description?: string;
  website?: string;
  requiredFor?: string;
  promptMessage?: string;
}

export type MissingAPIKey = string | RequiredAPIKey;

const STRING_KEY_MAP: Record<string, RequiredAPIKey> = {
  SUPABASE_URL: {
    serviceName: 'supabase',
    keyName: 'url',
    keyType: 'api_key',
    description: 'Supabase project URL',
  },
  SUPABASE_ANON_KEY: {
    serviceName: 'supabase',
    keyName: 'anon_key',
    keyType: 'api_key',
    description: 'Supabase anon public API key',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    serviceName: 'supabase',
    keyName: 'service_role_key',
    keyType: 'secret',
    description: 'Supabase service role key',
  },
  CLOUDINARY_CLOUD_NAME: {
    serviceName: 'cloudinary',
    keyName: 'cloud_name',
    keyType: 'api_key',
    description: 'Cloudinary cloud name',
  },
  CLOUDINARY_API_KEY: {
    serviceName: 'cloudinary',
    keyName: 'api_key',
    keyType: 'api_key',
    description: 'Cloudinary API key',
  },
  CLOUDINARY_API_SECRET: {
    serviceName: 'cloudinary',
    keyName: 'api_secret',
    keyType: 'secret',
    description: 'Cloudinary API secret',
  },
  STRIPE_SECRET_KEY: {
    serviceName: 'stripe',
    keyName: 'secret_key',
    keyType: 'secret',
    description: 'Stripe secret key',
  },
  OPENAI_API_KEY: {
    serviceName: 'openai',
    keyName: 'api_key',
    keyType: 'api_key',
    description: 'OpenAI API key',
  },
};

function normalizeMissingKey(key: MissingAPIKey): RequiredAPIKey | null {
  if (!key) return null;
  if (typeof key !== 'string') {
    if (!key.serviceName || !key.keyName) return null;
    return {
      ...key,
      serviceName: key.serviceName.toLowerCase(),
      keyName: key.keyName.toLowerCase(),
      keyType: key.keyType || 'api_key',
    };
  }

  const raw = key.trim();
  if (!raw) return null;

  const mapped = STRING_KEY_MAP[raw.toUpperCase()];
  if (mapped) return mapped;

  if (raw.includes(':')) {
    const [serviceName, keyName] = raw.split(':');
    if (serviceName && keyName) {
      return {
        serviceName: serviceName.toLowerCase(),
        keyName: keyName.toLowerCase(),
        keyType: keyName.toLowerCase().includes('secret') ? 'secret' : 'api_key',
      };
    }
  }

  return {
    serviceName: raw.toLowerCase().replace(/_api_key$/, '').replace(/[^a-z0-9]+/g, '_'),
    keyName: raw.toLowerCase().includes('token') ? 'token' : 'api_key',
    keyType: raw.toLowerCase().includes('token') ? 'token' : 'api_key',
    description: raw,
  };
}

function getKeyId(key: RequiredAPIKey): string {
  return `${key.serviceName}:${key.keyName}`;
}

export function ProjectAPIKeyDialog({
  open,
  onOpenChange,
  missingApiKeys,
  projectId,
  projectName,
  allowUserWide = false,
  onKeysAdded,
}: ProjectAPIKeyDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(projectId);
  const [isUserWide, setIsUserWide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const requiredApiKeys = useMemo(() => {
    const normalized = missingApiKeys
      .map(normalizeMissingKey)
      .filter((key): key is RequiredAPIKey => Boolean(key));
    return Array.from(
      new Map(normalized.map(key => [getKeyId(key), key])).values()
    );
  }, [missingApiKeys]);

  // Load user's projects for selection
  useEffect(() => {
    if (open && user?.id) {
      setSelectedProjectId(projectId);
      setIsUserWide(false);
      loadProjects();
    }
  }, [open, user?.id, projectId]);

  useEffect(() => {
    if (open && !allowUserWide && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [open, allowUserWide, selectedProjectId, projects]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await apiFetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setProjects(Array.isArray(data) ? data : data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleKeyChange = (keyId: string, value: string) => {
    setApiKeyValues(prev => ({ ...prev, [keyId]: value }));
  };

  const handleSubmit = async () => {
    if (requiredApiKeys.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid API keys to save',
        variant: 'destructive',
      });
      return;
    }
    
    if (requiredApiKeys.some(key => !apiKeyValues[getKeyId(key)]?.trim())) {
      toast({
        title: 'Error',
        description: 'Please fill in all required API keys',
        variant: 'destructive',
      });
      return;
    }

    const targetProjectId = allowUserWide && isUserWide ? null : selectedProjectId;
    if (targetProjectId === null && !(allowUserWide && isUserWide)) {
      toast({
        title: 'Project required',
        description: 'Select a project before saving these API keys.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Store each API key
      const storePromises = requiredApiKeys.map(async (apiKey) => {
        const keyValue = apiKeyValues[getKeyId(apiKey)];
        if (!keyValue) return;

        const response = await apiFetch('/api/api-keys/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: apiKey.serviceName,
            keyName: apiKey.keyName,
            keyValue: keyValue,
            keyType: apiKey.keyType || 'api_key',
            description: apiKey.description || `API key for ${apiKey.serviceName}:${apiKey.keyName}`,
            website: apiKey.website,
            projectId: targetProjectId, // Pass projectId to store project-specific or user-wide
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || error.error || `Failed to store ${apiKey.serviceName}:${apiKey.keyName}`);
        }
      });

      await Promise.all(storePromises);

      toast({
        title: 'Success',
        description: `API keys saved ${allowUserWide && isUserWide ? 'user-wide' : `for project: ${projects.find(p => p.id === selectedProjectId)?.name || projectName || 'Current Project'}`}`,
      });

      // Reset form
      setApiKeyValues({});
      onOpenChange(false);
      
      if (onKeysAdded) {
        await onKeysAdded();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save API keys',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getKeyLabel = (apiKey: RequiredAPIKey) => {
    const keyName = apiKey.description || `${apiKey.serviceName} ${apiKey.keyName}`;
    // Convert OPENAI_API_KEY to "OpenAI API Key"
    if (!keyName || typeof keyName !== 'string') {
      return 'API Key';
    }
    return keyName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys Required
          </DialogTitle>
          <DialogDescription>
            Your project requires API keys to function properly. Please provide them below.
            {projectName && (
              <span className="block mt-1 text-sm font-medium">
                Project: {projectName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              These API keys are required for your application to work. They will be encrypted and saved for this project only.
            </AlertDescription>
          </Alert>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Storage Location</Label>
            {allowUserWide ? (
              <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isUserWide}
                  onChange={() => {
                    setIsUserWide(true);
                    setSelectedProjectId(null);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">User-wide (all projects)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isUserWide}
                  onChange={() => {
                    setIsUserWide(false);
                    setSelectedProjectId(projectId);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">Project-specific</span>
              </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Project-specific keys keep each app isolated and easier to ship safely.
              </p>
            )}

            {!isUserWide && (
              <div className="mt-2">
                <Select
                  value={selectedProjectId?.toString() || ''}
                  onValueChange={(value) => setSelectedProjectId(parseInt(value))}
                  disabled={isLoadingProjects}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project">
                      {selectedProjectId
                        ? projects.find(p => p.id === selectedProjectId)?.name || 'Current Project'
                        : 'Select project'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projectId && (
                      <SelectItem value={projectId.toString()}>
                        {projectName || 'Current Project'} (Current)
                      </SelectItem>
                    )}
                    {projects
                      .filter(p => !projectId || p.id !== projectId)
                      .map(project => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* API Key Inputs */}
          <div className="space-y-4">
            {requiredApiKeys
              .map((apiKey) => {
                const keyId = getKeyId(apiKey);
                return (
                <div key={keyId} className="space-y-2">
                  <Label htmlFor={keyId}>{getKeyLabel(apiKey)}</Label>
                  <Input
                    id={keyId}
                    type="password"
                    placeholder={`Enter your ${getKeyLabel(apiKey)}`}
                    value={apiKeyValues[keyId] || ''}
                    onChange={(e) => handleKeyChange(keyId, e.target.value)}
                    className="font-mono text-sm"
                  />
                  {apiKey.requiredFor && (
                    <p className="text-xs text-muted-foreground">{apiKey.requiredFor}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || requiredApiKeys.some(key => !apiKeyValues[getKeyId(key)]?.trim())}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save API Keys'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
