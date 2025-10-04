import React, { useState } from 'react';

interface OneClickDeployerProps {
  componentName: string;
  files: Array<{ path: string; content: string }>;
  onDeploymentReady?: (url: string, platform: string) => void;
  onError?: (error: string) => void;
}

type DeploymentPlatform = 'vercel' | 'netlify' | 'github-pages';
type DeploymentStatus = 'idle' | 'deploying' | 'ready' | 'error';

export const OneClickDeployer: React.FC<OneClickDeployerProps> = ({
  componentName,
  files,
  onDeploymentReady,
  onError,
}) => {
  const [status, setStatus] = useState<DeploymentStatus>('idle');
  const [selectedPlatform, setSelectedPlatform] = useState<DeploymentPlatform>('vercel');
  const [deploymentUrl, setDeploymentUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [deploymentId, setDeploymentId] = useState<string>('');

  const handleOneClickDeploy = async () => {
    try {
      setStatus('deploying');
      setError('');
      setDeploymentUrl('');

      const response = await fetch('/api/deployments/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName,
          files,
          platform: selectedPlatform,
        }),
      });

      if (!response.ok) {
        throw new Error(`Deployment failed: ${response.statusText}`);
      }

      const result = await response.json();
      setDeploymentId(result.deploymentId);
      setDeploymentUrl(result.url);
      setStatus('ready');
      onDeploymentReady?.(result.url, selectedPlatform);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
    }
  };

  const handleCopyUrl = () => {
    if (deploymentUrl) {
      navigator.clipboard.writeText(deploymentUrl);
    }
  };

  const handleShareUrl = () => {
    if (deploymentUrl) {
      const shareText = `Check out my AI-generated app: ${deploymentUrl}`;
      if (navigator.share) {
        navigator.share({
          title: `${componentName} - AI Generated App`,
          text: shareText,
          url: deploymentUrl,
        });
      } else {
        navigator.clipboard.writeText(shareText);
      }
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">🚀 One-Click Global Deployment</h3>
          <p className="text-sm text-gray-600 mt-1">
            Deploy your AI-generated app to the world with a single click
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {status === 'idle' && (
            <button
              onClick={handleOneClickDeploy}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              🌍 Deploy Globally
            </button>
          )}
          {status === 'deploying' && (
            <div className="flex items-center px-6 py-3 bg-blue-50 text-blue-700 rounded-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <span className="font-medium">Deploying...</span>
            </div>
          )}
        </div>
      </div>

      {/* Platform Selection */}
      {status === 'idle' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Choose Deployment Platform:
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'vercel', name: 'Vercel', icon: '▲', description: 'Fast, global CDN' },
              { id: 'netlify', name: 'Netlify', icon: '🌐', description: 'JAMstack optimized' },
              { id: 'github-pages', name: 'GitHub Pages', icon: '📚', description: 'Free hosting' },
            ].map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id as DeploymentPlatform)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  selectedPlatform === platform.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">{platform.icon}</span>
                  <span className="font-medium text-gray-900">{platform.name}</span>
                </div>
                <p className="text-xs text-gray-600">{platform.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Deployment Progress */}
      {status === 'deploying' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">🚀 Deploying to {selectedPlatform}...</h4>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-blue-700">
                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Preparing files...
              </div>
              <div className="flex items-center text-sm text-blue-700">
                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Installing dependencies...
              </div>
              <div className="flex items-center text-sm text-blue-700">
                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Building application...
              </div>
              <div className="flex items-center text-sm text-blue-700">
                <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Deploying to {selectedPlatform}...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Success */}
      {status === 'ready' && deploymentUrl && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="text-green-600 mr-2">✅</div>
              <h4 className="font-medium text-green-900">Deployment Successful!</h4>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Your app is now live and accessible worldwide!
            </p>
            
            <div className="bg-white border border-green-200 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Live URL:
                  </label>
                  <a
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 underline text-sm break-all"
                  >
                    {deploymentUrl}
                  </a>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="Copy URL"
                  >
                    📋
                  </button>
                  <button
                    onClick={handleShareUrl}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="Share"
                  >
                    🔗
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">🌍 Global Access</h5>
              <p className="text-sm text-blue-700">
                Your app is accessible from anywhere in the world with low latency.
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h5 className="font-medium text-purple-900 mb-2">🔒 Secure & Fast</h5>
              <p className="text-sm text-purple-700">
                Deployed on enterprise-grade infrastructure with automatic HTTPS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Error */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <div className="text-red-600 mr-2">❌</div>
            <h4 className="font-medium text-red-900">Deployment Failed</h4>
          </div>
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button
            onClick={() => setStatus('idle')}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
