/**
 * Python Server Preview Component
 * Runs Python web applications (Flask, Django, FastAPI) on the server
 * and provides an iframe preview
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Play, Square, RotateCcw, Terminal, ExternalLink, 
  AlertCircle, CheckCircle, Server, RefreshCw 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PythonServerPreviewProps {
  files: Array<{ path: string; content: string }>;
  onServerReady?: (url: string) => void;
}

interface SandboxInfo {
  id: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
  port?: number;
  projectType: string;
  logs: string[];
  error?: string;
}

export function PythonServerPreview({ files, onServerReady }: PythonServerPreviewProps) {
  const { sessionToken } = useAuth();
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Poll for logs when sandbox is running
  useEffect(() => {
    if (sandbox?.status === 'running' || sandbox?.status === 'starting') {
      pollInterval.current = setInterval(async () => {
        try {
          const response = await apiFetch(`/api/python/sandbox/${sandbox.id}/logs?since=${logs.length}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.logs && data.logs.length > 0) {
              setLogs(prev => [...prev, ...data.logs]);
            }
            
            // Update status
            if (data.status !== sandbox.status) {
              setSandbox(prev => prev ? { ...prev, status: data.status } : null);
            }
          }
        } catch (err) {
          console.error('Error polling logs:', err);
        }
      }, 2000);

      return () => {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
      };
    }
  }, [sandbox?.id, sandbox?.status, sessionToken, logs.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sandbox?.id) {
        stopSandbox();
      }
    };
  }, [sandbox?.id]);

  // Start sandbox
  const startSandbox = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setLogs(['🚀 Starting Python server...']);

    try {
      const response = await apiFetch('/api/python/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          files: files.filter(f => f.path.endsWith('.py') || f.path === 'requirements.txt'),
          options: { timeout: 5 * 60 * 1000 }, // 5 minutes
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start sandbox');
      }

      setSandbox(data.sandbox);
      setLogs(prev => [...prev, ...data.sandbox.logs]);

      // Poll for status updates until server is ready
      if (data.sandbox.status === 'starting' || data.sandbox.status === 'running') {
        const pollStatus = async () => {
          try {
            const statusResponse = await apiFetch(`/api/python/sandbox/${data.sandbox.id}`, {
              headers: { Authorization: `Bearer ${sessionToken}` },
            });
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.sandbox) {
                setSandbox(statusData.sandbox);
                setLogs(prev => {
                  const newLogs = statusData.sandbox.logs.slice(prev.length);
                  return [...prev, ...newLogs];
                });
                
                // If server is running and has URL, notify
                if (statusData.sandbox.status === 'running' && statusData.sandbox.url) {
                  // Ensure URL has https:// prefix
                  const url = statusData.sandbox.url.startsWith('http') 
                    ? statusData.sandbox.url 
                    : `https://${statusData.sandbox.url}`;
                  onServerReady?.(url);
                } else if (statusData.sandbox.status === 'starting') {
                  // Continue polling if still starting
                  setTimeout(pollStatus, 2000);
                }
              }
            }
          } catch (err) {
            console.error('Error polling sandbox status:', err);
          }
        };
        
        // Start polling after a short delay
        setTimeout(pollStatus, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start server');
      setLogs(prev => [...prev, `❌ Error: ${err}`]);
    } finally {
      setIsStarting(false);
    }
  }, [files, sessionToken, onServerReady]);

  // Stop sandbox
  const stopSandbox = useCallback(async () => {
    if (!sandbox?.id) return;

    setIsStopping(true);
    setLogs(prev => [...prev, '🛑 Stopping server...']);

    try {
      await apiFetch(`/api/python/sandbox/${sandbox.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      setLogs(prev => [...prev, '✅ Server stopped']);
      setSandbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop server');
    } finally {
      setIsStopping(false);
    }
  }, [sandbox?.id, sessionToken]);

  // Restart sandbox
  const restartSandbox = useCallback(async () => {
    await stopSandbox();
    await startSandbox();
  }, [stopSandbox, startSandbox]);

  // Detect project type
  const projectType = files.some(f => f.content.includes('from flask')) ? 'Flask' :
                      files.some(f => f.content.includes('from fastapi')) ? 'FastAPI' :
                      files.some(f => f.content.includes('from django')) ? 'Django' :
                      files.some(f => f.content.includes('import streamlit')) ? 'Streamlit' :
                      'Python';

  const isRunning = sandbox?.status === 'running';
  const isStartingOrRunning = sandbox?.status === 'starting' || isRunning;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" />
          <span className="font-medium">Python Server</span>
          <Badge variant="outline" className="text-xs">
            {projectType}
          </Badge>
          {isRunning && (
            <Badge variant="default" className="text-xs bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Running
            </Badge>
          )}
          {sandbox?.status === 'starting' && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Starting...
            </Badge>
          )}
          {sandbox?.status === 'error' && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && sandbox?.url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(sandbox.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </Button>
          )}
          {isStartingOrRunning ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={restartSandbox}
                disabled={isStopping}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Restart
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={stopSandbox}
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 mr-1" />
                )}
                Stop
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={startSandbox}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Start Server
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Preview iframe (when running) */}
        {isRunning && sandbox?.url && (
          <div className="flex-1 min-h-0 border-b relative bg-white">
            {/* E2B/Streamlit apps may block iframe embedding - show both iframe and open button */}
            <iframe
              src={sandbox.url.startsWith('http') ? sandbox.url : `https://${sandbox.url}`}
              className="w-full h-full border-0"
              title="Python Server Preview"
              style={{ minHeight: '400px' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation allow-top-navigation-by-user-activation allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; display-capture"
              referrerPolicy="no-referrer-when-downgrade"
              loading="eager"
              onError={() => console.log('Iframe failed to load')}
            />
            {/* Fallback message - E2B/Streamlit may block iframe embedding */}
            <div className="absolute bottom-2 right-2 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded p-2 text-xs max-w-xs">
              <p className="text-yellow-800 dark:text-yellow-200">
                If preview doesn't load, click "Open" button to view in new tab
              </p>
            </div>
          </div>
        )}

        {/* No preview placeholder OR iframe blocked state */}
        {!isRunning && (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center text-muted-foreground">
              <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {sandbox?.status === 'starting' ? 'Server is starting...' : 
                 sandbox?.status === 'error' ? 'Server failed to start' :
                 'Server not running'}
              </p>
              <p className="text-sm mt-2">
                {sandbox?.status === 'starting' ? 'This may take a moment...' :
                 sandbox?.status === 'error' ? error || sandbox?.error :
                 `Click "Start Server" to run your ${projectType} app`}
              </p>
              {!sandbox && (
                <Button className="mt-4" onClick={startSandbox} disabled={isStarting}>
                  <Play className="w-4 h-4 mr-2" />
                  Start Server
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Running but iframe may be blocked - show prominent open button */}
        {isRunning && sandbox?.url && (
          <div className="p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Server ready at <code className="bg-white/50 dark:bg-black/30 px-1.5 py-0.5 rounded text-xs">{sandbox.url}</code>
              </span>
            </div>
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => window.open(sandbox.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open App
            </Button>
          </div>
        )}

        {/* Console/Logs */}
        <Card className="m-2 overflow-hidden flex-shrink-0" style={{ maxHeight: '200px' }}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Server Logs
              {sandbox?.port && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Port {sandbox.port}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[150px]">
              <div className="p-2 text-xs font-mono space-y-1">
                {logs.length === 0 ? (
                  <span className="text-muted-foreground italic">
                    Server logs will appear here
                  </span>
                ) : (
                  logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "whitespace-pre-wrap",
                        log.includes('Error') || log.includes('❌') ? 'text-red-500' :
                        log.includes('✅') ? 'text-green-500' :
                        log.includes('⚠️') ? 'text-yellow-500' :
                        'text-muted-foreground'
                      )}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>
            🖥️ Server-side Python execution • {projectType} detected
          </span>
          <span>
            {sandbox?.url || 'Not running'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PythonServerPreview;

