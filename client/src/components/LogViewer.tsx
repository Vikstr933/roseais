import React, { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';
import { apiFetch } from '../lib/api';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, Filter, Download } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  metadata?: Record<string, any>;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: string;
  ip?: string;
  source?: 'CLIENT' | 'SERVER';
  sessionId?: string;
  userId?: string;
  component?: string;
  action?: string;
}

const levelColors = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-yellow-500',
  ERROR: 'bg-red-500',
  DEBUG: 'bg-gray-500',
};

const sourceColors = {
  CLIENT: 'bg-green-100 text-green-800',
  SERVER: 'bg-blue-100 text-blue-800',
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<{
    level?: string;
    category?: string;
    source?: string;
    search?: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Connect to SSE endpoint for real-time logs
    // Load initial logs
    apiFetch('/api/logs/recent')
      .then(res => res.json())
      .then(initialLogs => setLogs(initialLogs))
      .catch(console.error);

    // Connect to SSE endpoint for real-time logs
    const eventSource = new EventSource(getApiUrl('/api/logs'), { withCredentials: true });

    eventSource.onmessage = event => {
      const logEntry: LogEntry = JSON.parse(event.data);
      setLogs(prevLogs => [...prevLogs, logEntry].slice(-1000)); // Keep last 1000 logs
    };

    eventSource.onerror = error => {
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
    if (filter.source && log.source !== filter.source) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        log.url?.toLowerCase().includes(searchLower) ||
        log.requestId?.toLowerCase().includes(searchLower) ||
        log.method?.toLowerCase().includes(searchLower) ||
        log.component?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower) ||
        log.sessionId?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata || {})
          .toLowerCase()
          .includes(searchLower)
      );
    }
    return true;
  });

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get unique categories and sources for filter dropdowns
  const categories = Array.from(new Set(logs.map(log => log.category)));
  const sources = Array.from(
    new Set(logs.map(log => log.source).filter(Boolean))
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>

        <select
          className="border rounded p-2 bg-white text-gray-900"
          onChange={e =>
            setFilter(prev => ({ ...prev, level: e.target.value || undefined }))
          }
          value={filter.level || ''}
        >
          <option value="">All Levels</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="DEBUG">Debug</option>
        </select>

        <select
          className="border rounded p-2 bg-white text-gray-900"
          onChange={e =>
            setFilter(prev => ({
              ...prev,
              category: e.target.value || undefined,
            }))
          }
          value={filter.category || ''}
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          className="border rounded p-2 bg-white text-gray-900"
          onChange={e =>
            setFilter(prev => ({
              ...prev,
              source: e.target.value || undefined,
            }))
          }
          value={filter.source || ''}
        >
          <option value="">All Sources</option>
          {sources.map(source => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={exportLogs}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>

        <div className="text-sm text-gray-500 flex items-center">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>

      <ScrollArea className="h-[600px] rounded-md border">
        <div className="space-y-2 p-4">
          {filteredLogs.map((log, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={levelColors[log.level]}>{log.level}</Badge>
                  <Badge variant="outline">{log.category}</Badge>
                  {log.source && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${sourceColors[log.source]}`}
                    >
                      {log.source}
                    </Badge>
                  )}
                  {log.requestId && (
                    <Badge variant="secondary" className="text-xs">
                      ID: {log.requestId}
                    </Badge>
                  )}
                  {log.sessionId && (
                    <Badge variant="secondary" className="text-xs">
                      Session: {log.sessionId.slice(-6)}
                    </Badge>
                  )}
                  {log.method && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        log.method === 'GET'
                          ? 'bg-green-100 text-green-800'
                          : log.method === 'POST'
                            ? 'bg-blue-100 text-blue-800'
                            : log.method === 'PUT'
                              ? 'bg-yellow-100 text-yellow-800'
                              : log.method === 'DELETE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {log.method}
                    </Badge>
                  )}
                  {log.statusCode && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        log.statusCode >= 200 && log.statusCode < 300
                          ? 'bg-green-100 text-green-800'
                          : log.statusCode >= 300 && log.statusCode < 400
                            ? 'bg-yellow-100 text-yellow-800'
                            : log.statusCode >= 400
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {log.statusCode}
                    </Badge>
                  )}
                  {log.duration && (
                    <Badge variant="outline" className="text-xs">
                      {log.duration}
                    </Badge>
                  )}
                  <span className="text-sm text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">{log.message}</p>
                  {log.url && (
                    <p className="text-xs text-gray-600 font-mono bg-gray-50 p-1 rounded">
                      {log.url}
                    </p>
                  )}
                  {log.component && log.action && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">{log.component}</span>:{' '}
                      {log.action}
                    </p>
                  )}
                  {log.ip && (
                    <p className="text-xs text-gray-500">IP: {log.ip}</p>
                  )}
                  {log.userId && (
                    <p className="text-xs text-gray-500">User: {log.userId}</p>
                  )}
                </div>

                {log.metadata && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
