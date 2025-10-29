import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Rocket, Github, Globe, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ProductionDeploymentProps {
  files: Array<{ path: string; content: string }>;
  projectName: string;
  onDeployment?: (result: DeploymentResult) => void;
}

interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  githubUrl?: string;
  vercelUrl?: string;
  error?: string;
}

interface DeploymentConfig {
  projectName: string;
  repoName: string;
  description: string;
  isPrivate: boolean;
  framework: 'vite' | 'nextjs' | 'react';
  envVars: Record<string, string>;
}

export function ProductionDeployment({ files, projectName, onDeployment }: ProductionDeploymentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [config, setConfig] = useState<DeploymentConfig>({
    projectName: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    repoName: `${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`,
    description: `AI-generated ${projectName} application`,
    isPrivate: false,
    framework: 'vite',
    envVars: {},
  });
  const [envVarInput, setEnvVarInput] = useState({ key: '', value: '' });
  const { toast } = useToast();

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          files,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDeploymentResult(result.deployment);
        onDeployment?.(result.deployment);
        toast({
          title: "🚀 Deployment Successful!",
          description: "Your app is now live and ready to share.",
        });
      } else {
        setDeploymentResult({ success: false, error: result.error });
        toast({
          title: "❌ Deployment Failed",
          description: result.error || "Something went wrong during deployment.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDeploymentResult({ success: false, error: errorMessage });
      toast({
        title: "❌ Deployment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const addEnvVar = () => {
    if (envVarInput.key && envVarInput.value) {
      setConfig(prev => ({
        ...prev,
        envVars: { ...prev.envVars, [envVarInput.key]: envVarInput.value }
      }));
      setEnvVarInput({ key: '', value: '' });
    }
  };

  const removeEnvVar = (key: string) => {
    setConfig(prev => ({
      ...prev,
      envVars: Object.fromEntries(Object.entries(prev.envVars).filter(([k]) => k !== key))
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          disabled={!files || files.length === 0}
        >
          <Rocket className="h-4 w-4 mr-2" />
          Deploy to Production
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-5 w-5 text-blue-600" />
            Deploy to Production
          </DialogTitle>
        </DialogHeader>

        {!deploymentResult ? (
          <div className="space-y-6">
            {/* Project Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Project Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={config.projectName}
                    onChange={(e) => setConfig(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="my-awesome-app"
                  />
                </div>

                <div>
                  <Label htmlFor="repoName">Repository Name</Label>
                  <Input
                    id="repoName"
                    value={config.repoName}
                    onChange={(e) => setConfig(prev => ({ ...prev, repoName: e.target.value }))}
                    placeholder="my-awesome-app-repo"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your application..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="framework">Framework</Label>
                  <Select value={config.framework} onValueChange={(value: any) => setConfig(prev => ({ ...prev, framework: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vite">Vite + React</SelectItem>
                      <SelectItem value="nextjs">Next.js</SelectItem>
                      <SelectItem value="react">Create React App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="private"
                    checked={config.isPrivate}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isPrivate: checked }))}
                  />
                  <Label htmlFor="private">Private Repository</Label>
                </div>
              </div>
            </div>

            {/* Environment Variables */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Environment Variables</h3>

              <div className="flex gap-2">
                <Input
                  placeholder="Variable name"
                  value={envVarInput.key}
                  onChange={(e) => setEnvVarInput(prev => ({ ...prev, key: e.target.value }))}
                />
                <Input
                  placeholder="Variable value"
                  value={envVarInput.value}
                  onChange={(e) => setEnvVarInput(prev => ({ ...prev, value: e.target.value }))}
                />
                <Button onClick={addEnvVar} size="sm">Add</Button>
              </div>

              {Object.entries(config.envVars).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(config.envVars).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">{key}={value}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEnvVar(key)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deployment Info */}
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>What happens next:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Create a GitHub repository with your code</li>
                    <li>Deploy to Vercel with automatic builds</li>
                    <li>Get a live URL you can share instantly</li>
                    <li>Automatic deployments on future changes</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Deploy Button */}
            <Button
              onClick={handleDeploy}
              disabled={isDeploying || !config.projectName || !config.repoName}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
              size="lg"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying... This may take a few minutes
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy to Production
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Deployment Result */}
            {deploymentResult.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Deployment Successful! 🎉</h3>
                </div>

                <div className="space-y-3">
                  {deploymentResult.githubUrl && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        <span className="font-medium">GitHub Repository</span>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <a href={deploymentResult.githubUrl} target="_blank" rel="noopener noreferrer">
                          View Code <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {deploymentResult.vercelUrl && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">Live Application</span>
                      </div>
                      <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                        <a href={deploymentResult.vercelUrl} target="_blank" rel="noopener noreferrer">
                          Open App <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertDescription>
                    Your app is now live! Share the URL with anyone - it's ready for production use.
                    Any changes pushed to the GitHub repository will automatically trigger new deployments.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Deployment Failed</h3>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Error:</strong> {deploymentResult.error}
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => setDeploymentResult(null)}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}