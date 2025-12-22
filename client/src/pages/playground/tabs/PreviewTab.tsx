import { Eye, ChevronUp, Server, Play, Square } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import { PythonPreview } from "../../../components/PythonPreview";
import { PythonServerPreview } from "../../../components/PythonServerPreview";
import { Badge } from "../../../components/ui/badge";
import type { GeneratedFile } from "../types";
import { useEffect, useMemo, useState } from "react";
import { webContainerService } from "../../../services/WebContainerService";

interface PreviewTabProps {
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  isLoading: boolean;
  setPreviewModalOpen: (open: boolean) => void;
  setLivePreviewUrl?: (url: string | null) => void;
}

// Detailed Python project type detection
type PythonProjectType = 'flask' | 'django' | 'fastapi' | 'streamlit' | 'script';

function detectPythonProjectType(files: GeneratedFile[]): PythonProjectType | null {
  for (const file of files) {
    if (!file.path.endsWith('.py')) continue;
    const content = file.content.toLowerCase();
    
    if (content.includes('from flask import') || content.includes('import flask')) return 'flask';
    if (content.includes('from django') || content.includes('import django')) return 'django';
    if (content.includes('from fastapi import') || content.includes('import fastapi')) return 'fastapi';
    if (content.includes('import streamlit') || content.includes('from streamlit')) return 'streamlit';
  }
  
  // Check if any .py files exist
  if (files.some(f => f.path.endsWith('.py'))) return 'script';
  return null;
}

// Detect project type from files
function detectProjectType(files: GeneratedFile[]): 'web' | 'python-script' | 'python-server' | 'node' | 'unknown' {
  const pythonType = detectPythonProjectType(files);
  
  // Python web frameworks need server-side preview
  if (pythonType && ['flask', 'django', 'fastapi', 'streamlit'].includes(pythonType)) {
    return 'python-server';
  }
  
  // Simple Python scripts can run in browser via Pyodide
  if (pythonType === 'script') {
    return 'python-script';
  }
  
  const hasReactFiles = files.some(f => 
    f.path.endsWith('.tsx') || f.path.endsWith('.jsx') ||
    (f.path === 'package.json' && f.content.includes('react'))
  );
  const hasPackageJson = files.some(f => f.path === 'package.json');
  
  if (hasReactFiles) return 'web';
  if (hasPackageJson) return 'node';
  
  return 'unknown';
}

export function PreviewTab({
  response,
  livePreviewUrl,
  currentComponentName,
  isLoading,
  setPreviewModalOpen,
  setLivePreviewUrl,
}: PreviewTabProps) {
  const [forcePreviewType, setForcePreviewType] = useState<'auto' | 'web' | 'python-script' | 'python-server'>('auto');
  const [isServerRunning, setIsServerRunning] = useState<boolean>(!!livePreviewUrl);
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);
  const [isStoppingServer, setIsStoppingServer] = useState<boolean>(false);
  
  // Detect project type from files
  const projectType = useMemo(() => {
    if (!response?.files || response.files.length === 0) return 'unknown';
    return detectProjectType(response.files);
  }, [response?.files]);

  // Get detailed Python type for display
  const pythonType = useMemo(() => {
    if (!response?.files) return null;
    return detectPythonProjectType(response.files);
  }, [response?.files]);

  // Auto-select Server tab for Python web frameworks (they can't run in browser)
  const isPythonWebApp = pythonType && ['flask', 'django', 'fastapi', 'streamlit'].includes(pythonType);
  
  useEffect(() => {
    // Auto-switch to Server mode for Python web apps
    if (isPythonWebApp && forcePreviewType === 'auto') {
      console.log('🐍 Auto-selecting Server preview for', pythonType);
    }
  }, [isPythonWebApp, pythonType, forcePreviewType]);

  // Determine which preview to show
  // For Python web apps, default to server mode even when 'auto'
  const activePreviewType = useMemo(() => {
    if (forcePreviewType !== 'auto') return forcePreviewType;
    if (isPythonWebApp) return 'python-server'; // Auto-select server for web frameworks
    return projectType;
  }, [forcePreviewType, isPythonWebApp, projectType]);

  // Debug logging
  useEffect(() => {
    if (livePreviewUrl) {
      console.log('📺 PreviewTab: Preview URL set to:', livePreviewUrl);
      console.log('📺 PreviewTab: Files count:', response?.files?.length || 0);
      console.log('📺 PreviewTab: Component name:', currentComponentName);
      console.log('📺 PreviewTab: Project type:', projectType);
      console.log('📺 PreviewTab: Python type:', pythonType);
    } else {
      console.log('📺 PreviewTab: No preview URL yet');
    }
  }, [livePreviewUrl, response?.files?.length, currentComponentName, projectType, pythonType]);

  const hasFiles = typeof response === 'object' &&
    response?.type === 'component' &&
    response.files &&
    response.files.length > 0;

  // Debug logging
  useEffect(() => {
    console.log('🔍 PreviewTab state:', {
      hasFiles,
      isWebContainerProject,
      hasResponse: !!response,
      filesCount: response?.files?.length || 0,
      filePaths: response?.files?.map(f => f.path) || []
    });
  }, [hasFiles, isWebContainerProject, response]);

  const hasPythonFiles = response?.files?.some(f => f.path.endsWith('.py'));

  // Check if Browser tab is usable for this project
  const canRunInBrowser = !isPythonWebApp; // Web frameworks can't run in browser

  // Check if this is a WebContainer project (has package.json and React files)
  const isWebContainerProject = useMemo(() => {
    if (!response?.files) {
      console.log('🔍 isWebContainerProject: No files in response');
      return false;
    }
    const hasPackageJson = response.files.some(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
    const hasReactFiles = response.files.some(f => 
      f.path.endsWith('.tsx') || f.path.endsWith('.jsx') ||
      (f.path === 'package.json' && f.content.includes('react'))
    );
    const result = hasPackageJson && hasReactFiles && !isPythonWebApp;
    console.log('🔍 isWebContainerProject check:', {
      hasPackageJson,
      hasReactFiles,
      isPythonWebApp,
      result,
      filePaths: response.files.map(f => f.path)
    });
    return result;
  }, [response?.files, isPythonWebApp]);

  // Update server running state when URL changes
  useEffect(() => {
    setIsServerRunning(!!livePreviewUrl);
  }, [livePreviewUrl]);

  // Auto-mount files to WebContainer when project is loaded
  useEffect(() => {
    if (!response?.files || response.files.length === 0) return;
    if (!isWebContainerProject) return; // Only for WebContainer projects
    if (isServerRunning) return; // Don't remount if server is already running

    // Auto-mount files when project loads
    const mountFiles = async () => {
      try {
        console.log('📁 Auto-mounting files to WebContainer...');
        
        // Fix file paths: move package.json, tsconfig.json, vite.config.ts to root
        const fixedFiles = response.files.map(file => {
          const filename = file.path?.split('/').pop() || '';
          const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
          
          if (isConfigFile && file.path?.startsWith('src/')) {
            return { ...file, path: filename };
          }
          return file;
        });

        // Ensure App.tsx exists
        const hasMainTsx = fixedFiles.some(f => f.path === 'src/main.tsx' || f.path.endsWith('/main.tsx'));
        const hasAppTsx = fixedFiles.some(f => f.path === 'src/App.tsx' || f.path.endsWith('/App.tsx'));
        
        if (hasMainTsx && !hasAppTsx) {
          console.warn('⚠️ App.tsx missing but main.tsx exists - creating fallback App.tsx');
          fixedFiles.push({
            path: 'src/App.tsx',
            content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Your application is ready! Start building your features here.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Next steps:</strong> Customize this component to build your application.
          </p>
        </div>
      </div>
    </div>
  );
}`
          });
        }

        // Boot WebContainer if needed
        await webContainerService.boot();
        
        // Mount files
        await webContainerService.writeFiles(fixedFiles);
        console.log('✅ Files auto-mounted to WebContainer');
      } catch (error) {
        console.error('Failed to auto-mount files:', error);
        // Don't show alert for auto-mount failures - user can still click Start Server
      }
    };

    mountFiles();
  }, [response?.files, isWebContainerProject, isServerRunning]);

  // Handle start dev server
  const handleStartServer = async () => {
    console.log('🔍 handleStartServer called:', {
      hasResponse: !!response,
      hasFiles: !!response?.files,
      filesCount: response?.files?.length || 0,
      hasSetLivePreviewUrl: !!setLivePreviewUrl
    });

    if (!response) {
      console.error('Cannot start server: response is null');
      alert('Cannot start server: No project loaded. Please wait for the project to finish loading.');
      return;
    }

    if (!response.files || response.files.length === 0) {
      console.error('Cannot start server: no files in response');
      alert('Cannot start server: No files found in this project. Please generate or add files first.');
      return;
    }

    if (!setLivePreviewUrl) {
      console.error('Cannot start server: setLivePreviewUrl is not provided');
      alert('Cannot start server: Preview URL setter is missing. This is a bug, please refresh the page.');
      return;
    }

    // Check if WebContainer is supported
    if (!webContainerService.isSupported()) {
      console.error('WebContainer is not supported in this browser');
      alert('WebContainer is not supported in this browser. Please use a modern browser with SharedArrayBuffer support.');
      return;
    }
    
    setIsStartingServer(true);
    try {
      console.log('🚀 Starting dev server...');
      
      // Ensure WebContainer is booted
      console.log('🔧 Booting WebContainer...');
      await webContainerService.boot();
      console.log('✅ WebContainer booted');
      
      // Fix file paths: move package.json, tsconfig.json, vite.config.ts to root
      const fixedFiles = response.files.map(file => {
        const filename = file.path?.split('/').pop() || '';
        const isConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);
        
        if (isConfigFile && file.path?.startsWith('src/')) {
          return { ...file, path: filename };
        }
        return file;
      });

      // 🚨 CRITICAL: Ensure App.tsx exists (main.tsx imports it)
      const hasMainTsx = fixedFiles.some(f => f.path === 'src/main.tsx' || f.path.endsWith('/main.tsx'));
      const hasAppTsx = fixedFiles.some(f => f.path === 'src/App.tsx' || f.path.endsWith('/App.tsx'));
      
      if (hasMainTsx && !hasAppTsx) {
        console.warn('⚠️ App.tsx missing but main.tsx exists - creating fallback App.tsx');
        fixedFiles.push({
          path: 'src/App.tsx',
          content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Your application is ready! Start building your features here.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Next steps:</strong> Customize this component to build your application.
          </p>
        </div>
      </div>
    </div>
  );
}`
        });
      }

      console.log(`📝 Writing ${fixedFiles.length} files to WebContainer...`);
      // Write files to WebContainer
      await webContainerService.writeFiles(fixedFiles);
      console.log('✅ Files written successfully');

      console.log('📦 Installing dependencies...');
      // Install dependencies
      await webContainerService.installDependencies();
      console.log('✅ Dependencies installed');

      console.log('🚀 Starting dev server...');
      // Start dev server
      const devServerUrl = await webContainerService.startDevServer();
      console.log('✅ Dev server started at:', devServerUrl);
      
      setLivePreviewUrl(devServerUrl);
      setIsServerRunning(true);
    } catch (error) {
      console.error('❌ Failed to start dev server:', error);
      // Show user-friendly error message
      alert(`Failed to start dev server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStartingServer(false);
    }
  };

  // Handle stop dev server
  const handleStopServer = async () => {
    setIsStoppingServer(true);
    try {
      await webContainerService.stopDevServer();
      if (setLivePreviewUrl) {
        setLivePreviewUrl(null);
      }
      setIsServerRunning(false);
    } catch (error) {
      console.error('Failed to stop dev server:', error);
    } finally {
      setIsStoppingServer(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Type Selector (when we have Python files) */}
      {hasFiles && hasPythonFiles && (
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <Button
            variant={activePreviewType === 'web' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setForcePreviewType(activePreviewType === 'web' ? 'auto' : 'web')}
          >
            🌐 Web
          </Button>
          <Button
            variant={activePreviewType === 'python-script' ? 'default' : 'outline'}
            size="sm"
            className={`h-6 text-xs ${!canRunInBrowser ? 'opacity-50' : ''}`}
            onClick={() => setForcePreviewType(activePreviewType === 'python-script' ? 'auto' : 'python-script')}
            title={canRunInBrowser 
              ? "Run Python in browser (Pyodide) - for simple scripts" 
              : `⚠️ ${pythonType} can't run in browser - use Server tab`}
          >
            🐍 Browser
            {!canRunInBrowser && <span className="ml-1 text-yellow-500">⚠️</span>}
          </Button>
          <Button
            variant={activePreviewType === 'python-server' ? 'default' : 'outline'}
            size="sm"
            className={`h-6 text-xs ${isPythonWebApp ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            onClick={() => setForcePreviewType(activePreviewType === 'python-server' ? 'auto' : 'python-server')}
            title={isPythonWebApp 
              ? `✅ Recommended for ${pythonType} - runs real Python server`
              : "Run Python on server - for Flask/Django/FastAPI/Streamlit"}
          >
            <Server className="w-3 h-3 mr-1" />
            Server
            {isPythonWebApp && <span className="ml-1">✅</span>}
          </Button>
          <Badge variant="outline" className="ml-auto text-xs">
            {pythonType === 'flask' ? '🌶️ Flask' :
             pythonType === 'fastapi' ? '⚡ FastAPI' :
             pythonType === 'django' ? '🎸 Django' :
             pythonType === 'streamlit' ? '📊 Streamlit' :
             pythonType === 'script' ? '🐍 Python Script' :
             projectType === 'web' ? '🌐 Web Project' : 
             '📦 Project'}
          </Badge>
        </div>
      )}

      {/* WebContainer Dev Server Controls */}
      {hasFiles && isWebContainerProject && (
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Dev Server:</span>
          {isServerRunning ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleStopServer}
              disabled={isStoppingServer}
            >
              <Square className="h-3 w-3 mr-1" />
              {isStoppingServer ? 'Stopping...' : 'Stop Server'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={handleStartServer}
              disabled={isStartingServer}
            >
              <Play className="h-3 w-3 mr-1" />
              {isStartingServer ? 'Starting...' : 'Start Server'}
            </Button>
          )}
          {livePreviewUrl && (
            <Badge variant="outline" className="text-xs">
              {livePreviewUrl}
            </Badge>
          )}
          {!webContainerService.isSupported() && (
            <Badge variant="destructive" className="text-xs">
              WebContainer Not Supported
            </Badge>
          )}
        </div>
      )}
      
      {/* Debug info - show why button might be hidden */}
      {hasFiles && !isWebContainerProject && (
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>ℹ️ Dev Server controls available for React/Node projects with package.json</span>
        </div>
      )}

      {/* Preview Content */}
      {hasFiles ? (
        <>
          {/* Mobile: Fullscreen Preview Button */}
          <div className="md:hidden p-2 border-b border-border bg-card flex items-center justify-between">
            <h3 className="text-sm font-medium">Preview</h3>
            <div className="flex items-center gap-2">
              {/* WebContainer controls on mobile */}
              {isWebContainerProject && (
                <>
                  {isServerRunning ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={handleStopServer}
                      disabled={isStoppingServer}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs h-7"
                      onClick={handleStartServer}
                      disabled={isStartingServer}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalOpen(true)}
                className="text-xs"
              >
                <ChevronUp className="h-4 w-4 mr-1" />
                Fullscreen
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {activePreviewType === 'python-script' ? (
              <PythonPreview files={response!.files!} />
            ) : activePreviewType === 'python-server' ? (
              <PythonServerPreview files={response!.files!} />
            ) : (
              <AdvancedPreview
                files={response!.files!}
                previewUrl={livePreviewUrl || ''}
                projectName={currentComponentName}
              />
            )}
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center text-muted-foreground">
            <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{isLoading ? "Generating code..." : "Preview will appear here"}</p>
            <p className="text-sm mt-2">{isLoading ? "Files are being generated in real-time..." : "Generate a component to see the preview"}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs flex-wrap">
              <Badge variant="outline">🌐 React/Web</Badge>
              <Badge variant="outline">🐍 Python Scripts</Badge>
              <Badge variant="outline">🌶️ Flask</Badge>
              <Badge variant="outline">⚡ FastAPI</Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

