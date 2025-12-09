import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../hooks/use-toast";

interface DatabaseAPIKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingApiKeys: string[];
  databaseType: 'mongodb' | 'postgresql' | 'mysql';
  projectId?: number;
  onKeysAdded?: (projectId?: number) => void | Promise<void>;
}

interface APIKeyConfig {
  key: string;
  label: string;
  description: string;
  link: string;
  placeholder: string;
}

const API_KEY_CONFIGS: Record<string, APIKeyConfig> = {
  MONGODB_ATLAS_API_KEY: {
    key: 'MONGODB_ATLAS_API_KEY',
    label: 'MongoDB Atlas API Key',
    description: 'Public API key from MongoDB Atlas',
    link: 'https://cloud.mongodb.com/v2#/account/publicApi',
    placeholder: 'Enter your MongoDB Atlas Public API Key'
  },
  MONGODB_ATLAS_PROJECT_ID: {
    key: 'MONGODB_ATLAS_PROJECT_ID',
    label: 'MongoDB Atlas Project ID',
    description: 'Your MongoDB Atlas Project ID',
    link: 'https://cloud.mongodb.com/v2#/account/publicApi',
    placeholder: 'Enter your MongoDB Atlas Project ID'
  },
  NEON_API_KEY: {
    key: 'NEON_API_KEY',
    label: 'Neon API Key',
    description: 'API key from Neon dashboard',
    link: 'https://console.neon.tech/app/settings/api-keys',
    placeholder: 'Enter your Neon API Key'
  },
  NEON_PROJECT_ID: {
    key: 'NEON_PROJECT_ID',
    label: 'Neon Project ID',
    description: 'Your Neon Project ID',
    link: 'https://console.neon.tech/app/projects',
    placeholder: 'Enter your Neon Project ID'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase Service Role Key',
    description: 'Service role key from Supabase project settings',
    link: 'https://app.supabase.com/project/_/settings/api',
    placeholder: 'Enter your Supabase Service Role Key'
  },
  SUPABASE_URL: {
    key: 'SUPABASE_URL',
    label: 'Supabase URL',
    description: 'Your Supabase project URL',
    link: 'https://app.supabase.com/project/_/settings/api',
    placeholder: 'https://your-project.supabase.co'
  },
  SUPABASE_DB_PASSWORD: {
    key: 'SUPABASE_DB_PASSWORD',
    label: 'Supabase Database Password',
    description: 'Database password from Supabase settings',
    link: 'https://app.supabase.com/project/_/settings/database',
    placeholder: 'Enter your Supabase Database Password'
  }
};

const getProviderInfo = (databaseType: string, missingKeys: string[]) => {
  if (databaseType === 'mongodb') {
    return {
      name: 'MongoDB Atlas',
      signupLink: 'https://www.mongodb.com/cloud/atlas/register',
      docsLink: 'https://www.mongodb.com/docs/atlas/configure-api-access/',
      description: 'MongoDB Atlas provides managed MongoDB databases in the cloud.'
    };
  } else if (databaseType === 'postgresql') {
    // Check which provider keys are missing
    const hasNeonKeys = missingKeys.some(k => k.includes('NEON'));
    const hasSupabaseKeys = missingKeys.some(k => k.includes('SUPABASE'));
    
    if (hasNeonKeys && !hasSupabaseKeys) {
      return {
        name: 'Neon',
        signupLink: 'https://neon.tech/signup',
        docsLink: 'https://neon.tech/docs/connect/api-keys',
        description: 'Neon provides serverless PostgreSQL databases.'
      };
    } else if (hasSupabaseKeys && !hasNeonKeys) {
      return {
        name: 'Supabase',
        signupLink: 'https://supabase.com/dashboard/sign-up',
        docsLink: 'https://supabase.com/docs/guides/api',
        description: 'Supabase provides managed PostgreSQL databases with additional features.'
      };
    } else {
      // Both or neither - default to Neon
      return {
        name: 'Neon or Supabase',
        signupLink: 'https://neon.tech/signup',
        docsLink: 'https://neon.tech/docs/connect/api-keys',
        description: 'Choose between Neon (serverless) or Supabase (managed PostgreSQL).'
      };
    }
  }
  
  return {
    name: 'Database Provider',
    signupLink: '#',
    docsLink: '#',
    description: 'Configure your database provider.'
  };
};

export function DatabaseAPIKeyDialog({
  open,
  onOpenChange,
  missingApiKeys,
  databaseType,
  projectId,
  onKeysAdded
}: DatabaseAPIKeyDialogProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const providerInfo = getProviderInfo(databaseType, missingApiKeys);
  const requiredKeys = missingApiKeys.filter(key => API_KEY_CONFIGS[key]);

  const handleKeyChange = (key: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // These are platform-level API keys that need to be added to backend environment variables
    // After admin adds them, we can retry provisioning
    onOpenChange(false);
    
    toast({
      title: "API Keys Required",
      description: "These API keys need to be added to the backend environment variables. After adding them, click 'Retry' to automatically provision the database.",
      variant: "default",
    });

    // If projectId is provided, trigger retry callback
    if (projectId && onKeysAdded) {
      await onKeysAdded(projectId);
    } else if (onKeysAdded) {
      await onKeysAdded();
    }

    // Open documentation or settings page
    window.open('/settings?tab=integrations', '_blank');
  };

  const handleSkip = () => {
    onOpenChange(false);
    toast({
      title: "Skipped",
      description: "You can configure API keys later in Settings → Integrations.",
      variant: "default",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Database API Keys Required
          </DialogTitle>
          <DialogDescription>
            To automatically provision a {databaseType} database for your project, we need API keys from {providerInfo.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Why do we need these?</AlertTitle>
            <AlertDescription>
              {providerInfo.description} With API keys, we can automatically create and configure your database. 
              Without them, you'll need to set up the database manually.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Get Your API Keys</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(providerInfo.signupLink, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {providerInfo.name === 'MongoDB Atlas' ? 'Sign Up' : 'Get API Keys'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Don't have an account? <a href={providerInfo.signupLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Sign up for {providerInfo.name}</a> or <a href={providerInfo.docsLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">view documentation</a>.
            </p>
          </div>

          <div className="space-y-4 border-t pt-4">
            {requiredKeys.map((key) => {
              const config = API_KEY_CONFIGS[key];
              if (!config) return null;

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key}>{config.label}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(config.link, '_blank')}
                      className="h-6 px-2 text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Get Key
                    </Button>
                  </div>
                  <Input
                    id={key}
                    type="password"
                    placeholder={config.placeholder}
                    value={apiKeys[key] || ''}
                    onChange={(e) => handleKeyChange(key, e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              );
            })}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Important:</strong> These API keys need to be added to the backend environment variables (Render/Vercel) 
              by a platform administrator. Once configured, all users will benefit from automatic database provisioning.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={isSubmitting}>
            Dismiss
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            View Setup Instructions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

