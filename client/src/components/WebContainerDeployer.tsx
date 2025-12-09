import React, { useState, useEffect } from 'react';
import { webContainerService, WebContainerInstance } from '../services/WebContainerService';

interface WebContainerDeployerProps {
  componentName: string;
  files: Array<{ path: string; content: string }>;
  onDeploymentReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export const WebContainerDeployer: React.FC<WebContainerDeployerProps> = ({
  componentName,
  files,
  onDeploymentReady,
  onError,
}) => {
  const [instance, setInstance] = useState<WebContainerInstance | null>(null);
  const [status, setStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(false);

  useEffect(() => {
    // Check WebContainer support
    const supported = webContainerService.isSupported();
    setIsSupported(supported);
    
    if (!supported) {
      setError('WebContainer not supported in this browser. Please use Chrome, Safari 16.4+, or Firefox.');
      setStatus('error');
      onError?.('WebContainer not supported');
    }
  }, [onError]);

  const handleDeploy = async () => {
    if (!isSupported) return;

    try {
      setStatus('deploying');
      setError('');

      const deploymentInstance = await webContainerService.deployApp(componentName, files);
      setInstance(deploymentInstance);

      // Wait for server to be ready
      const checkReady = setInterval(() => {
        if (deploymentInstance.status === 'running' && deploymentInstance.url) {
          setStatus('ready');
          onDeploymentReady?.(deploymentInstance.url);
          clearInterval(checkReady);
        } else if (deploymentInstance.status === 'error') {
          setStatus('error');
          setError('Deployment failed');
          onError?.('Deployment failed');
          clearInterval(checkReady);
        }
      }, 1000);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (status === 'deploying') {
          setStatus('error');
          setError('Deployment timeout');
          onError?.('Deployment timeout');
          clearInterval(checkReady);
        }
      }, 60000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
    }
  };

  const handleStop = async () => {
    if (instance) {
      try {
        await webContainerService.stopInstance(instance.id);
        setInstance(null);
        setStatus('idle');
      } catch (err) {
        console.error('Failed to stop deployment:', err);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <div className="text-yellow-600 mr-2">⚠️</div>
          <div>
            <h3 className="font-medium text-yellow-800">WebContainer Not Supported</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Your browser doesn't support WebContainer. Please use Chrome, Safari 16.4+, or Firefox for the best experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">WebContainer Deployment</h3>
        <div className="flex items-center space-x-2">
          {status === 'idle' && (
            <button
              onClick={handleDeploy}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              🚀 Deploy
            </button>
          )}
          {status === 'deploying' && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Deploying...
            </div>
          )}
          {status === 'ready' && (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              🛑 Stop
            </button>
          )}
        </div>
      </div>

      {status === 'deploying' && (
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Booting WebContainer...
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Installing dependencies...
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Starting development server...
          </div>
        </div>
      )}

      {status === 'ready' && instance && (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <div className="text-green-600 mr-2">✅</div>
              <div>
                <h4 className="font-medium text-green-800">Deployment Ready!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Your app is running in WebContainer
                </p>
              </div>
            </div>
          </div>
          
          {instance.url && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">URL:</label>
              <a
                href={instance.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                {instance.url}
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(instance.url)}
                className="text-gray-500 hover:text-gray-700"
                title="Copy URL"
              >
                📋
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <div className="text-red-600 mr-2">❌</div>
            <div>
              <h4 className="font-medium text-red-800">Deployment Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
