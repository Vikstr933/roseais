import React, { useState, useEffect } from 'react';
import { OneClickDeployer } from '../components/OneClickDeployer';
import { WebContainerDeployer } from '../components/WebContainerDeployer';

interface DeploymentPageProps {
  componentName: string;
  files: Array<{ path: string; content: string }>;
  onBack?: () => void;
}

type DeploymentMode = 'webcontainer' | 'public' | 'both';

export const DeploymentPage: React.FC<DeploymentPageProps> = ({
  componentName,
  files,
  onBack,
}) => {
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>('both');
  const [webContainerUrl, setWebContainerUrl] = useState<string>('');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [isWebContainerSupported, setIsWebContainerSupported] = useState<boolean>(false);

  useEffect(() => {
    // Check WebContainer support
    const supported = typeof window !== 'undefined' && 'WebContainer' in window;
    setIsWebContainerSupported(supported);
    
    if (!supported) {
      setDeploymentMode('public');
    }
  }, []);

  const handleWebContainerReady = (url: string) => {
    setWebContainerUrl(url);
  };

  const handlePublicDeploymentReady = (url: string, platform: string) => {
    setPublicUrl(url);
  };

  const handleError = (error: string) => {
    console.error('Deployment error:', error);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🚀 Deploy Your App</h1>
              <p className="text-gray-600 mt-2">
                Choose how you want to deploy <strong>{componentName}</strong>
              </p>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
        </div>

        {/* Deployment Mode Selection */}
        {isWebContainerSupported && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Deployment Type:</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setDeploymentMode('webcontainer')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  deploymentMode === 'webcontainer'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">⚡</span>
                  <span className="font-medium text-gray-900">Instant Preview</span>
                </div>
                <p className="text-sm text-gray-600">
                  Run in your browser instantly. Perfect for testing and development.
                </p>
              </button>

              <button
                onClick={() => setDeploymentMode('public')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  deploymentMode === 'public'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🌍</span>
                  <span className="font-medium text-gray-900">Global Deployment</span>
                </div>
                <p className="text-sm text-gray-600">
                  Deploy to the world. Share with anyone, anywhere.
                </p>
              </button>

              <button
                onClick={() => setDeploymentMode('both')}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  deploymentMode === 'both'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🚀</span>
                  <span className="font-medium text-gray-900">Both Options</span>
                </div>
                <p className="text-sm text-gray-600">
                  Get instant preview + global deployment. Best of both worlds.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Deployment Components */}
        <div className="space-y-8">
          {/* WebContainer Deployment */}
          {(deploymentMode === 'webcontainer' || deploymentMode === 'both') && isWebContainerSupported && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Instant Browser Preview</h2>
              <WebContainerDeployer
                componentName={componentName}
                files={files}
                onDeploymentReady={handleWebContainerReady}
                onError={handleError}
              />
            </div>
          )}

          {/* Public Deployment */}
          {(deploymentMode === 'public' || deploymentMode === 'both') && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🌍 Global Public Deployment</h2>
              <OneClickDeployer
                componentName={componentName}
                files={files}
                onDeploymentReady={handlePublicDeploymentReady}
                onError={handleError}
              />
            </div>
          )}
        </div>

        {/* Deployment Results Summary */}
        {(webContainerUrl || publicUrl) && (
          <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎉 Deployment Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {webContainerUrl && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">⚡ Instant Preview</h4>
                  <a
                    href={webContainerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                  >
                    {webContainerUrl}
                  </a>
                  <p className="text-xs text-blue-700 mt-1">
                    Runs in your browser - perfect for testing
                  </p>
                </div>
              )}

              {publicUrl && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">🌍 Global Access</h4>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 underline text-sm break-all"
                  >
                    {publicUrl}
                  </a>
                  <p className="text-xs text-green-700 mt-1">
                    Accessible worldwide - share with anyone
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">📋 Quick Actions</h5>
              <div className="flex flex-wrap gap-2">
                {webContainerUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(webContainerUrl)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                  >
                    Copy Preview URL
                  </button>
                )}
                {publicUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(publicUrl)}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                  >
                    Copy Public URL
                  </button>
                )}
                {(webContainerUrl || publicUrl) && (
                  <button
                    onClick={() => {
                      const shareText = `Check out my AI-generated app: ${publicUrl || webContainerUrl}`;
                      navigator.clipboard.writeText(shareText);
                    }}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                  >
                    Copy Share Text
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Browser Support Warning */}
        {!isWebContainerSupported && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-600 mr-2">⚠️</div>
              <div>
                <h4 className="font-medium text-yellow-800">Browser Compatibility</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  WebContainer preview is not supported in your browser. You can still use global deployment.
                  For the best experience, use Chrome, Safari 16.4+, or Firefox.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
