import React, { useEffect, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

const levelColors = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-yellow-500',
  ERROR: 'bg-red-500',
  DEBUG: 'bg-gray-500'
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<{
    level?: string;
    category?: string;
  }>({});

  useEffect(() => {
    // Connect to SSE endpoint for real-time logs
    // Load initial logs
    fetch('/api/logs/recent')
      .then(res => res.json())
      .then(initialLogs => setLogs(initialLogs))
      .catch(console.error);

    // Connect to SSE endpoint for real-time logs
    const eventSource = new EventSource('/api/logs', { withCredentials: true });

    eventSource.onmessage = (event) => {
      const logEntry: LogEntry = JSON.parse(event.data);
      setLogs(prevLogs => [...prevLogs, logEntry].slice(-1000)); // Keep last 1000 logs
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // Don't close on error, let it retry automatically
      // But do log the error for debugging
      console.debug('SSE connection state:', eventSource.readyState);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Filter logs based on selected criteria
  const filteredLogs = logs.filter(log => {
    if (filter.level && log.level !== filter.level) return false;
    if (filter.category && log.category !== filter.category) return false;
    return true;
  });

  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(logs.map(log => log.category)));

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-4 mb-4">
        <select
          className="border rounded p-2"
          onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value || undefined }))}
          value={filter.level || ''}
        >
          <option value="">All Levels</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="DEBUG">Debug</option>
        </select>

        <select
          className="border rounded p-2"
          onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value || undefined }))}
          value={filter.category || ''}
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <ScrollArea className="h-[600px] rounded-md border">
        <div className="space-y-2 p-4">
          {filteredLogs.map((log, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={levelColors[log.level]}>
                      {log.level}
                    </Badge>
                    <Badge variant="outline">{log.category}</Badge>
                    <span className="text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.metadata && (
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
