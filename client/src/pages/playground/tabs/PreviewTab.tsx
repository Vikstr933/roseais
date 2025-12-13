import { Eye, ChevronUp, Server } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import { PythonPreview } from "../../../components/PythonPreview";
import { PythonServerPreview } from "../../../components/PythonServerPreview";
import { Badge } from "../../../components/ui/badge";
import type { GeneratedFile } from "../types";
import { useEffect, useMemo, useState } from "react";

interface PreviewTabProps {
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  isLoading: boolean;
  setPreviewModalOpen: (open: boolean) => void;
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
}: PreviewTabProps) {
  const [forcePreviewType, setForcePreviewType] = useState<'auto' | 'web' | 'python-script' | 'python-server'>('auto');
  
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

  const hasPythonFiles = response?.files?.some(f => f.path.endsWith('.py'));

  // Check if Browser tab is usable for this project
  const canRunInBrowser = !isPythonWebApp; // Web frameworks can't run in browser

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

      {/* Preview Content */}
      {hasFiles ? (
        <>
          {/* Mobile: Fullscreen Preview Button */}
          <div className="md:hidden p-2 border-b border-border bg-card flex items-center justify-between">
            <h3 className="text-sm font-medium">Preview</h3>
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

