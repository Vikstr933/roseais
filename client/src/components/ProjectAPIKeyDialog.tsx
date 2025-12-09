import { useState, useEffect } from 'react';
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
  missingApiKeys: string[];
  projectId: number | null;
  projectName?: string;
  onKeysAdded?: () => void | Promise<void>;
}

interface Project {
  id: number;
  name: string;
}

export function ProjectAPIKeyDialog({
  open,
  onOpenChange,
  missingApiKeys,
  projectId,
  projectName,
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

  // Load user's projects for selection
  useEffect(() => {
    if (open && user?.id) {
      loadProjects();
    }
  }, [open, user?.id]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await apiFetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleKeyChange = (key: string, value: string) => {
    setApiKeyValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Filter out invalid keys
    const validKeys = missingApiKeys.filter((key): key is string => 
      typeof key === 'string' && key.trim().length > 0
    );
    
    if (validKeys.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid API keys to save',
        variant: 'destructive',
      });
      return;
    }
    
    if (validKeys.some(key => !apiKeyValues[key] || !apiKeyValues[key].trim())) {
      toast({
        title: 'Error',
        description: 'Please fill in all required API keys',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Store each API key
      const storePromises = validKeys.map(async (keyName) => {
        const keyValue = apiKeyValues[keyName];
        if (!keyValue) return;

        // Determine the target project (null for user-wide, number for project-specific)
        const targetProjectId = isUserWide ? null : selectedProjectId;

        const response = await apiFetch('/api/api-keys/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: keyName,
            keyName: keyName,
            keyValue: keyValue,
            keyType: 'api_key',
            description: `API key for ${keyName}${targetProjectId ? ` (Project-specific)` : ' (User-wide)'}`,
            projectId: targetProjectId, // Pass projectId to store project-specific or user-wide
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to store ${keyName}`);
        }
      });

      await Promise.all(storePromises);

      toast({
        title: 'Success',
        description: `API keys saved ${isUserWide ? 'user-wide' : `for project: ${projects.find(p => p.id === selectedProjectId)?.name || projectName || 'Current Project'}`}`,
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

  const getKeyLabel = (keyName: string) => {
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
              These API keys are required for your application to work. You can store them as user-wide (available to all projects) or project-specific (only for this project).
            </AlertDescription>
          </Alert>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Storage Location</Label>
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
            {missingApiKeys
              .filter((keyName): keyName is string => typeof keyName === 'string' && keyName.trim().length > 0)
              .map((keyName) => (
                <div key={keyName} className="space-y-2">
                  <Label htmlFor={keyName}>{getKeyLabel(keyName)}</Label>
                  <Input
                    id={keyName}
                    type="password"
                    placeholder={`Enter your ${getKeyLabel(keyName)}`}
                    value={apiKeyValues[keyName] || ''}
                    onChange={(e) => handleKeyChange(keyName, e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
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
            disabled={isSubmitting || missingApiKeys.filter((key): key is string => typeof key === 'string').some(key => !apiKeyValues[key]?.trim())}
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

