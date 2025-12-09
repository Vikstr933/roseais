import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink, Play, Globe, Trash2, Loader2 } from 'lucide-react';
import { WebContainerService } from '../services/WebContainerService';
import { vercelDeploymentService, VercelDeployment } from '../services/VercelDeploymentService';

interface DeploymentInterfaceProps {
  componentName: string;
  files: Array<{ path: string; content: string }>;
  onDeploymentReady?: (url: string, type: 'webcontainer' | 'vercel') => void;
}

export const DeploymentInterface: React.FC<DeploymentInterfaceProps> = ({
  componentName,
  files,
  onDeploymentReady,
}) => {
  const [webContainerStatus, setWebContainerStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const [webContainerUrl, setWebContainerUrl] = useState<string>('');
  const [vercelDeployments, setVercelDeployments] = useState<VercelDeployment[]>([]);
  const [vercelDeploying, setVercelDeploying] = useState(false);
  const [vercelError, setVercelError] = useState<string>('');

  const webContainerService = new WebContainerService();

  useEffect(() => {
    loadVercelDeployments();
  }, []);

  const loadVercelDeployments = async () => {
    try {
      const deployments = await vercelDeploymentService.getAllDeployments();
      setVercelDeployments(deployments);
    } catch (error) {
      console.error('Failed to load Vercel deployments:', error);
    }
  };

  const handleWebContainerDeploy = async () => {
    if (!webContainerService.isSupported()) {
      alert('WebContainer is not supported in this browser. Please use a modern browser like Chrome or Edge.');
      return;
    }

    setWebContainerStatus('deploying');
    try {
      const instance = await webContainerService.deployApp(componentName, files);
      setWebContainerUrl(instance.url);
      setWebContainerStatus('ready');
      onDeploymentReady?.(instance.url, 'webcontainer');
    } catch (error) {
      console.error('WebContainer deployment failed:', error);
      setWebContainerStatus('error');
    }
  };

  const handleVercelDeploy = async () => {
    setVercelDeploying(true);
    setVercelError('');
    
    try {
      const deployment = await vercelDeploymentService.deployComponent(componentName, {
        framework: 'react',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
      });
      
      setVercelDeployments(prev => [deployment, ...prev]);
      onDeploymentReady?.(deployment.url, 'vercel');
    } catch (error) {
      setVercelError(error instanceof Error ? error.message : 'Failed to deploy to Vercel');
    } finally {
      setVercelDeploying(false);
    }
  };

  const handleDeleteVercelDeployment = async (deploymentId: string) => {
    try {
      await vercelDeploymentService.deleteDeployment(deploymentId);
      setVercelDeployments(prev => prev.filter(d => d.deploymentId !== deploymentId));
    } catch (error) {
      console.error('Failed to delete deployment:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* WebContainer Development Deployment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Development Environment
          </CardTitle>
          <CardDescription>
            Deploy to WebContainer for instant development and testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Run your app instantly in the browser with WebContainer
                </p>
                <Badge variant={webContainerStatus === 'ready' ? 'default' : 'secondary'} className="mt-2">
                  {webContainerStatus === 'idle' && 'Ready to deploy'}
                  {webContainerStatus === 'deploying' && 'Deploying...'}
                  {webContainerStatus === 'ready' && 'Running'}
                  {webContainerStatus === 'error' && 'Error'}
                </Badge>
              </div>
              <Button
                onClick={handleWebContainerDeploy}
                disabled={webContainerStatus === 'deploying'}
                className="flex items-center gap-2"
              >
                {webContainerStatus === 'deploying' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {webContainerStatus === 'deploying' ? 'Deploying...' : 'Deploy to WebContainer'}
              </Button>
            </div>
            
            {webContainerStatus === 'ready' && webContainerUrl && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800 mb-2">✅ Development server is running!</p>
                <a
                  href={webContainerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </a>
              </div>
            )}
            
            {webContainerStatus === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  ❌ WebContainer deployment failed. Please try again or use Vercel deployment.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vercel Production Deployment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Production Deployment
          </CardTitle>
          <CardDescription>
            Deploy to Vercel for public access and production hosting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Deploy to Vercel for public access and production hosting
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires Vercel CLI to be installed on the server
                </p>
              </div>
              <Button
                onClick={handleVercelDeploy}
                disabled={vercelDeploying}
                variant="outline"
                className="flex items-center gap-2"
              >
                {vercelDeploying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {vercelDeploying ? 'Deploying...' : 'Deploy to Vercel'}
              </Button>
            </div>

            {vercelError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">❌ {vercelError}</p>
              </div>
            )}

            {/* Existing Vercel Deployments */}
            {vercelDeployments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Previous Deployments:</h4>
                {vercelDeployments.map((deployment) => (
                  <div
                    key={deployment.deploymentId}
                    className="flex items-center justify-between p-3 bg-gray-50 border rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={deployment.status === 'ready' ? 'default' : 'secondary'}>
                        {deployment.status}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{deployment.url}</p>
                        <p className="text-xs text-muted-foreground">
                          Deployed {new Date(deployment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={deployment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteVercelDeployment(deployment.deploymentId)}
                        className="p-1 hover:bg-gray-200 rounded text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
