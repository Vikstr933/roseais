import { Eye, ChevronUp, Server, Play, Square, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import { PythonPreview } from "../../../components/PythonPreview";
import { PythonServerPreview } from "../../../components/PythonServerPreview";
import { Badge } from "../../../components/ui/badge";
import type { GeneratedFile } from "../types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { webContainerService, type WebContainerSupport } from "../../../services/WebContainerService";
import { formatPreviewContractIssues, repairMissingPackageDependencies, validatePreviewContract } from "../utils";

interface PreviewTabProps {
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  isLoading: boolean;
  setPreviewModalOpen: (open: boolean) => void;
  setLivePreviewUrl?: (url: string | null) => void;
  webContainerSupport?: WebContainerSupport;
  onStartServerPreview?: () => Promise<void>;
}

// Detailed Python project type detection
type PythonProjectType = 'flask' | 'django' | 'fastapi' | 'streamlit' | 'script';

function detectPythonProjectType(files: GeneratedFile[]): PythonProjectType | null {
  if (!files || files.length === 0) return null;
  for (const file of files) {
    if (!file?.path?.endsWith('.py')) continue;
    const content = file?.content?.toLowerCase() || '';
    
    if (content.includes('from flask import') || content.includes('import flask')) return 'flask';
    if (content.includes('from django') || content.includes('import django')) return 'django';
    if (content.includes('from fastapi import') || content.includes('import fastapi')) return 'fastapi';
    if (content.includes('import streamlit') || content.includes('from streamlit')) return 'streamlit';
  }
  
  // Check if any .py files exist
  if (files.some(f => f?.path?.endsWith('.py'))) return 'script';
  return null;
}

// Detect project type from files
function detectProjectType(files: GeneratedFile[]): 'web' | 'python-script' | 'python-server' | 'node' | 'unknown' {
  if (!files || files.length === 0) return 'unknown';
  
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
    f?.path?.endsWith('.tsx') || f?.path?.endsWith('.jsx') ||
    ((f?.path === 'package.json' || f?.path === 'client/package.json') && f?.content?.includes('react'))
  );
  const hasPackageJson = files.some(f => f?.path === 'package.json' || f?.path === 'client/package.json' || f?.path === 'server/package.json');
  
  if (hasReactFiles) return 'web';
  if (hasPackageJson) return 'node';
  
  return 'unknown';
}

function normalizeRuntimeFiles<T extends { path: string; content: string }>(files: T[]): T[] {
  const normalizedFiles = files.map(file => {
    const filename = file.path?.split('/').pop() || '';
    const isRootConfigFile = ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js'].includes(filename);

    if (isRootConfigFile && file.path?.startsWith('src/')) {
      return { ...file, path: filename };
    }

    return file;
  });

  return repairMissingPackageDependencies(normalizedFiles);
}

function PreviewUnavailableState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold mb-2">Live preview is not available here</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function ServerPreviewReadyState({
  isStarting,
  onStart,
}: {
  isStarting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Server className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold mb-2">Hosted frontend preview is ready to start</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          The browser runtime could not expose a preview URL, so the frontend preview will be built separately.
        </p>
        <Button onClick={onStart} disabled={isStarting} className="gap-2">
          <Play className="h-4 w-4" />
          {isStarting ? 'Starting hosted preview...' : 'Start hosted preview'}
        </Button>
      </div>
    </div>
  );
}

function canFallbackToServerPreview(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('WebContainer did not provide a browser-accessible preview URL') ||
    message.includes('no browser-accessible preview URL') ||
    message.includes('preview server started locally') ||
    message.includes('no browser-accessible preview URL was returned') ||
    message.includes('signal is aborted')
  );
}

function formatPreviewError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('signal is aborted') || normalized.includes('aborterror')) {
    return 'Preview start was interrupted. Please try starting the preview again.';
  }

  if (canFallbackToServerPreview(error)) {
    return 'Browser preview did not expose a usable URL. Try hosted preview instead.';
  }

  return message || 'Preview could not start. Please try again.';
}

export function PreviewTab({
  response,
  livePreviewUrl,
  currentComponentName,
  isLoading,
  setPreviewModalOpen,
  setLivePreviewUrl,
  webContainerSupport,
  onStartServerPreview,
}: PreviewTabProps) {
  const [forcePreviewType, setForcePreviewType] = useState<'auto' | 'web' | 'python-script' | 'python-server'>('auto');
  const [isServerRunning, setIsServerRunning] = useState<boolean>(!!livePreviewUrl);
  const [isStartingServer, setIsStartingServer] = useState<boolean>(false);
  const [isStoppingServer, setIsStoppingServer] = useState<boolean>(false);
  const [isServerPreviewFallbackActive, setIsServerPreviewFallbackActive] = useState<boolean>(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const supportStatus = webContainerSupport ?? webContainerService.getSupportStatus();
  
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

  const hasPythonFiles = response?.files?.some(f => f?.path?.endsWith('.py')) || false;

  // Check if Browser tab is usable for this project
  const canRunInBrowser = !isPythonWebApp; // Web frameworks can't run in browser

  // Check if this is a WebContainer project (has package.json and React files)
  const isWebContainerProject = useMemo(() => {
    if (!response?.files) {
      console.log('🔍 isWebContainerProject: No files in response');
      return false;
    }
    const hasPackageJson = response.files.some(f => f?.path === 'package.json' || f?.path?.endsWith('/package.json'));
    const hasReactFiles = response.files.some(f => 
      f?.path?.endsWith('.tsx') || f?.path?.endsWith('.jsx') ||
      (f?.path === 'package.json' && f?.content?.includes('react'))
    );
    const result = hasPackageJson && hasReactFiles && !isPythonWebApp;
    console.log('🔍 isWebContainerProject check:', {
      hasPackageJson,
      hasReactFiles,
      isPythonWebApp,
      result,
      filePaths: response.files.map(f => f?.path).filter(Boolean)
    });
    return result;
  }, [response?.files, isPythonWebApp]);

  const canStartPreview = supportStatus.supported || !!onStartServerPreview;
  const usesServerHostedPreview = isWebContainerProject && !supportStatus.supported && !!onStartServerPreview;
  const livePreviewUnavailable = isWebContainerProject && !supportStatus.supported && !livePreviewUrl && !onStartServerPreview;
  const shouldHideFallbackNotice = !!previewNotice && !!onStartServerPreview && canFallbackToServerPreview(previewNotice);
  const displayPreviewNotice = shouldHideFallbackNotice ? null : previewNotice;

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

  // Update server running state when URL changes
  useEffect(() => {
    setIsServerRunning(!!livePreviewUrl);
    if (livePreviewUrl) {
      setIsServerPreviewFallbackActive(false);
    }
  }, [livePreviewUrl]);

  const startServerPreviewFallback = useCallback(async (message = 'Starting hosted preview...') => {
    if (!onStartServerPreview) return false;

    setIsServerPreviewFallbackActive(true);
    setIsStartingServer(true);
    setPreviewNotice(message);

    try {
      await onStartServerPreview();
      setIsServerRunning(true);
      setPreviewNotice(null);
      return true;
    } catch (error) {
      console.error('❌ Hosted preview fallback failed:', error);
      setPreviewNotice(formatPreviewError(error));
      return false;
    } finally {
      setIsStartingServer(false);
    }
  }, [onStartServerPreview]);

  const resetPreviewStartup = useCallback(() => {
    setIsStartingServer(false);
    setIsServerPreviewFallbackActive(false);
    setPreviewNotice('Preview startup was reset. You can start it again.');
  }, []);

  useEffect(() => {
    if (!isStartingServer) return;

    const timeout = window.setTimeout(() => {
      setIsStartingServer(false);
      setIsServerPreviewFallbackActive(false);
      setPreviewNotice('Preview startup is taking longer than expected. You can start it again.');
    }, 30000);

    return () => window.clearTimeout(timeout);
  }, [isStartingServer]);

  useEffect(() => {
    if (
      previewNotice &&
      onStartServerPreview &&
      !livePreviewUrl &&
      !isStartingServer &&
      !isServerPreviewFallbackActive &&
      canFallbackToServerPreview(previewNotice)
    ) {
      void startServerPreviewFallback('Browser preview did not expose a URL. Starting hosted preview instead...');
    }
  }, [
    previewNotice,
    onStartServerPreview,
    livePreviewUrl,
    isStartingServer,
    isServerPreviewFallbackActive,
    startServerPreviewFallback,
  ]);

  // Auto-mount files to WebContainer when project is loaded
  useEffect(() => {
    if (!response?.files || response.files.length === 0) return;
    if (!isWebContainerProject) return; // Only for WebContainer projects
    if (isServerRunning) return; // Don't remount if server is already running
    if (!supportStatus.supported) return;
    const responseFiles = response.files;

    // Auto-mount files when project loads
    const mountFiles = async () => {
      try {
        console.log('📁 Auto-mounting files to WebContainer...');
        
        const fixedFiles = normalizeRuntimeFiles(responseFiles);
        const previewContract = validatePreviewContract(fixedFiles);
        if (!previewContract.valid) {
          console.error('Cannot auto-mount files because preview contract failed:', previewContract);
          return;
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
  }, [response?.files, isWebContainerProject, isServerRunning, supportStatus.supported]);

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
      setPreviewNotice('No project is loaded yet. Please wait for the project to finish loading.');
      return;
    }

    if (!response.files || response.files.length === 0) {
      console.error('Cannot start server: no files in response');
      setPreviewNotice('No files were found in this project. Generate or add files first.');
      return;
    }

    if (!setLivePreviewUrl) {
      console.error('Cannot start server: setLivePreviewUrl is not provided');
      setPreviewNotice('Preview could not start. Please refresh the page and try again.');
      return;
    }

    // Check if WebContainer is supported
    const currentSupport = webContainerSupport ?? webContainerService.getSupportStatus();
    if (!currentSupport.supported) {
      console.info('Live preview is not supported in this browser:', currentSupport);
      if (onStartServerPreview) {
        await startServerPreviewFallback('Starting hosted preview...');
        return;
      }
      setPreviewNotice(currentSupport.userMessage);
      return;
    }
    
    setIsStartingServer(true);
    setPreviewNotice(null);
    try {
      console.log('🚀 Starting dev server...');
      
      // Ensure WebContainer is booted
      console.log('🔧 Booting WebContainer...');
      await webContainerService.boot();
      console.log('✅ WebContainer booted');
      
      const fixedFiles = normalizeRuntimeFiles(response.files);
      const previewContract = validatePreviewContract(fixedFiles);
      if (!previewContract.valid) {
        console.error('Cannot start server: preview contract failed', previewContract);
        setPreviewNotice(`Preview is waiting for generated files to pass validation: ${formatPreviewContractIssues(previewContract)}`);
        return;
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
      if (onStartServerPreview && canFallbackToServerPreview(error)) {
        await startServerPreviewFallback('Browser preview did not expose a URL. Starting hosted preview instead...');
        return;
      }
      // Show user-friendly error message
      setPreviewNotice(formatPreviewError(error));
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
              onClick={
                isServerPreviewFallbackActive || shouldHideFallbackNotice
                  ? () => { void startServerPreviewFallback('Starting hosted preview...'); }
                  : handleStartServer
              }
              disabled={isStartingServer || !canStartPreview}
            >
              <Play className="h-3 w-3 mr-1" />
              {isStartingServer ? 'Starting preview...' : (usesServerHostedPreview || isServerPreviewFallbackActive) ? 'Start Hosted Preview' : 'Start Server'}
            </Button>
          )}
          {isStartingServer && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={resetPreviewStartup}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          {livePreviewUrl && (
            <Badge variant="outline" className="text-xs">
              {livePreviewUrl}
            </Badge>
          )}
          {!supportStatus.supported && (
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">
              {usesServerHostedPreview ? 'Hosted preview available' : 'Browser runtime unavailable'}
            </Badge>
          )}
        </div>
      )}

      {(displayPreviewNotice || livePreviewUnavailable) && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{displayPreviewNotice || supportStatus.userMessage}</span>
          </div>
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
                      onClick={
                        isServerPreviewFallbackActive || shouldHideFallbackNotice
                          ? () => { void startServerPreviewFallback('Starting hosted preview...'); }
                          : handleStartServer
                      }
                      disabled={isStartingServer || !canStartPreview}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {isStartingServer ? 'Starting...' : (usesServerHostedPreview || isServerPreviewFallbackActive) ? 'Server' : 'Start'}
                    </Button>
                  )}
                  {isStartingServer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={resetPreviewStartup}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
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
            ) : (usesServerHostedPreview || isServerPreviewFallbackActive || shouldHideFallbackNotice) && !livePreviewUrl ? (
              <ServerPreviewReadyState
                isStarting={isStartingServer}
                onStart={() => { void startServerPreviewFallback('Starting hosted preview...'); }}
              />
            ) : livePreviewUnavailable ? (
              <PreviewUnavailableState message={supportStatus.userMessage} />
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
