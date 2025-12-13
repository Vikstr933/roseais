/**
 * Python Preview Component
 * Runs Python code in the browser using Pyodide
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RotateCcw, Package, Terminal, AlertCircle, CheckCircle } from 'lucide-react';
import { pythonRuntimeService, PythonExecutionResult } from '@/services/PythonRuntimeService';
import { cn } from '@/lib/utils';

interface PythonPreviewProps {
  files: Array<{ path: string; content: string }>;
  onOutput?: (output: string) => void;
}

export function PythonPreview({ files, onOutput }: PythonPreviewProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [installedPackages, setInstalledPackages] = useState<string[]>([]);

  // Find main Python file
  const mainFile = files.find(f => 
    f.path === 'main.py' || 
    f.path === 'app.py' || 
    f.path.endsWith('.py')
  );

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Initialize Pyodide on mount
  useEffect(() => {
    const init = async () => {
      if (pythonRuntimeService.isReady()) {
        setIsReady(true);
        return;
      }

      setIsInitializing(true);
      try {
        await pythonRuntimeService.init((message) => {
          addLog(message);
        });
        setIsReady(true);
        addLog('Python runtime ready');
      } catch (err) {
        setError(`Failed to initialize Python: ${err}`);
        addLog(`❌ Error: ${err}`);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [addLog]);

  // Run Python code
  const runCode = useCallback(async () => {
    if (!mainFile) {
      setError('No Python file found');
      return;
    }

    setIsRunning(true);
    setError(null);
    setOutput('');
    addLog(`Running ${mainFile.path}...`);

    try {
      // Write all files to virtual filesystem
      for (const file of files.filter(f => f.path.endsWith('.py'))) {
        await pythonRuntimeService.writeFile(file.path, file.content);
        addLog(`📄 Loaded ${file.path}`);
      }

      // Run with automatic dependency detection
      const result: PythonExecutionResult = await pythonRuntimeService.runWithDependencies(
        mainFile.content,
        (message) => addLog(message)
      );

      if (result.success) {
        setOutput(result.output || '(No output)');
        setExecutionTime(result.executionTime);
        addLog(`✅ Completed in ${result.executionTime}ms`);
        onOutput?.(result.output);
      } else {
        setError(result.error || 'Unknown error');
        addLog(`❌ Error: ${result.error}`);
      }
    } catch (err) {
      setError(String(err));
      addLog(`❌ Error: ${err}`);
    } finally {
      setIsRunning(false);
    }
  }, [mainFile, files, addLog, onOutput]);

  // Reset environment
  const resetEnvironment = useCallback(async () => {
    setIsInitializing(true);
    setOutput('');
    setError(null);
    setLogs([]);
    addLog('Resetting Python environment...');

    try {
      await pythonRuntimeService.reset();
      setIsReady(true);
      addLog('✅ Environment reset');
    } catch (err) {
      setError(`Failed to reset: ${err}`);
    } finally {
      setIsInitializing(false);
    }
  }, [addLog]);

  // Detect packages in current code
  const detectedPackages = mainFile 
    ? pythonRuntimeService.detectRequiredPackages(mainFile.content)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐍</span>
          <span className="font-medium">Python Preview</span>
          {isReady && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}
          {isInitializing && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Loading...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={resetEnvironment}
            disabled={isInitializing || isRunning}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={runCode}
            disabled={!isReady || isRunning || !mainFile}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Detected Packages */}
        {detectedPackages.length > 0 && (
          <div className="p-2 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="w-4 h-4" />
              <span>Detected packages:</span>
              {detectedPackages.map(pkg => (
                <Badge key={pkg} variant="secondary" className="text-xs">
                  {pkg}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Output Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Main Output */}
          <Card className="flex-1 m-2 overflow-hidden">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Output
                {executionTime && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {executionTime}ms
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <pre className={cn(
                  "p-3 text-sm font-mono whitespace-pre-wrap",
                  error ? "text-red-500" : "text-foreground"
                )}>
                  {error ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : output || (
                    <span className="text-muted-foreground italic">
                      {isReady 
                        ? 'Click "Run" to execute Python code' 
                        : 'Initializing Python runtime...'}
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Console/Logs */}
          <Card className="m-2 mt-0 overflow-hidden">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                📋 Console
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[120px]">
                <div className="p-2 text-xs font-mono space-y-1">
                  {logs.length === 0 ? (
                    <span className="text-muted-foreground italic">
                      Console output will appear here
                    </span>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="text-muted-foreground">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>
            Powered by Pyodide (Python {isReady ? '3.11' : '...'} in WebAssembly)
          </span>
          <span>
            {mainFile ? `📄 ${mainFile.path}` : 'No Python file detected'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PythonPreview;

