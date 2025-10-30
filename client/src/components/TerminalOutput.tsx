import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../lib/api';
import { apiFetch } from '../lib/api';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Trash2, Play, Square } from 'lucide-react';

interface TerminalOutputProps {
  componentName?: string;
  isLoading?: boolean;
}

export function TerminalOutput({
  componentName,
  isLoading,
}: TerminalOutputProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [output]);

  // Connect to terminal output stream
  useEffect(() => {
    if (!componentName) return;

    // Clear previous output
    setOutput([]);
    setIsConnected(false);

    // Create EventSource for Server-Sent Events
    const eventSource = new EventSource(getApiUrl(
      `/api/terminal/${componentName}/stream`
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'output') {
          setOutput(prev => [...prev, data.data]);
        } else if (data.type === 'heartbeat') {
          // Keep connection alive
        }
      } catch (error) {
        console.error('Error parsing terminal output:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('Terminal output stream error:', error);
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [componentName]);

  // Clear terminal output
  const clearOutput = async () => {
    if (!componentName) return;

    try {
      await apiFetch(`/api/terminal/${componentName}`, {
        method: 'DELETE',
      });
      setOutput([]);
    } catch (error) {
      console.error('Error clearing terminal output:', error);
    }
  };

  // Format output line with colors and icons
  const formatOutputLine = (line: string) => {
    // Add emoji and color coding for different types of output
    if (line.includes('📦') || line.includes('Installing')) {
      return { text: line, color: 'text-blue-500' };
    } else if (line.includes('✅') || line.includes('successfully') || line.includes('complete!')) {
      return { text: line, color: 'text-green-500' };
    } else if (line.includes('🚀') || line.includes('Starting')) {
      return { text: line, color: 'text-purple-500' };
    } else if (line.includes('❌') || line.includes('Error') || line.includes('Failed')) {
      return { text: line, color: 'text-red-500' };
    } else if (line.includes('🛑') || line.includes('stopped')) {
      return { text: line, color: 'text-orange-500' };
    } else if (line.includes('⚙️') || line.includes('Setting up')) {
      return { text: line, color: 'text-cyan-500' };
    } else if (line.includes('🤖') || line.includes('AI agents')) {
      return { text: line, color: 'text-indigo-500' };
    } else if (line.includes('🎨') || line.includes('Designing')) {
      return { text: line, color: 'text-pink-500' };
    } else if (line.includes('⚡') || line.includes('Generating')) {
      return { text: line, color: 'text-yellow-500' };
    } else if (line.includes('🔍') || line.includes('Validating')) {
      return { text: line, color: 'text-teal-500' };
    } else if (line.includes('🌐') || line.includes('WebContainer')) {
      return { text: line, color: 'text-emerald-500' };
    } else if (line.includes('Local:') || line.includes('http://') || line.includes('https://')) {
      return { text: line, color: 'text-green-400' };
    } else if (line.includes('🔗') || line.includes('live at:')) {
      return { text: line, color: 'text-green-400 font-semibold' };
    } else {
      return { text: line, color: 'text-gray-300' };
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/30 rounded-bl-lg rounded-br-lg">
      <div className="px-3 py-2 border-b bg-muted/50 rounded-tl-lg rounded-tr-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            🖥️ TERMINAL
          </h3>
          {componentName && (
            <Badge
              variant={isConnected ? 'default' : 'secondary'}
              className="text-xs"
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          )}
        </div>
        {componentName && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearOutput}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="p-3">
          <div className="font-mono text-xs space-y-1">
            {isLoading && !componentName && (
              <div className="text-primary animate-pulse flex items-center space-x-2">
                <span>🔄</span>
                <span>Generating component...</span>
              </div>
            )}

            {!isLoading && !componentName && (
              <div className="text-muted-foreground">
                Ready to generate components
              </div>
            )}

            {componentName && output.length === 0 && (
              <div className="text-muted-foreground">
                Waiting for terminal output...
              </div>
            )}

            {output.map((line, index) => {
              const formatted = formatOutputLine(line);
              return (
                <div
                  key={index}
                  className={`${formatted.color} whitespace-pre-wrap`}
                >
                  {formatted.text}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
