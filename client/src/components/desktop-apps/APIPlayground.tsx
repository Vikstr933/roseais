import { useState, useEffect } from 'react';
import { Play, Copy, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, Plus, Trash2, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuth, getAuthHeaders } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface RequestHistory {
  id: string;
  method: string;
  endpoint: string;
  status: number;
  duration: number;
  timestamp: Date;
  response?: string;
}

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

const METHODS = [
  { value: 'GET', color: 'text-emerald-400' },
  { value: 'POST', color: 'text-blue-400' },
  { value: 'PUT', color: 'text-amber-400' },
  { value: 'PATCH', color: 'text-orange-400' },
  { value: 'DELETE', color: 'text-red-400' },
];

const PRESET_ENDPOINTS = [
  { label: 'Health Check', method: 'GET', endpoint: '/api/health' },
  { label: 'User Info', method: 'GET', endpoint: '/api/auth/me' },
  { label: 'Projects', method: 'GET', endpoint: '/api/workspaces' },
  { label: 'Agents', method: 'GET', endpoint: '/api/agents' },
  { label: 'Plugins', method: 'GET', endpoint: '/api/plugins' },
  { label: 'Plugin Status', method: 'GET', endpoint: '/api/plugins/status' },
];

export function APIPlayground({ currentProjectId }: { currentProjectId?: number }) {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/api/health');
  const [body, setBody] = useState('');
  const [headers, setHeaders] = useState<Header[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ]);
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RequestHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activeTab, setActiveTab] = useState<'response' | 'headers'>('response');

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chap-api-playground-history');
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem('chap-api-playground-history', JSON.stringify(history.slice(0, 20)));
    } catch {}
  }, [history]);

  const sendRequest = async () => {
    if (!endpoint) {
      toast({ title: 'Error', description: 'Endpoint is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResponse(null);
    setStatus(null);
    setDuration(null);

    const startTime = performance.now();

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
      
      const reqHeaders: Record<string, string> = {};
      headers.filter(h => h.enabled && h.key).forEach(h => {
        reqHeaders[h.key] = h.value;
      });
      
      // Add auth header if available
      if (sessionToken) {
        reqHeaders['Authorization'] = `Bearer ${sessionToken}`;
      }

      const options: RequestInit = {
        method,
        headers: reqHeaders,
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        options.body = body;
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      const dur = Math.round(endTime - startTime);

      setStatus(res.status);
      setDuration(dur);

      const contentType = res.headers.get('content-type');
      let responseText: string;
      
      if (contentType?.includes('application/json')) {
        const json = await res.json();
        responseText = JSON.stringify(json, null, 2);
      } else {
        responseText = await res.text();
      }
      
      setResponse(responseText);

      // Add to history
      const historyItem: RequestHistory = {
        id: `req-${Date.now()}`,
        method,
        endpoint,
        status: res.status,
        duration: dur,
        timestamp: new Date(),
        response: responseText.slice(0, 500),
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 19)]);

    } catch (error: any) {
      const endTime = performance.now();
      setDuration(Math.round(endTime - startTime));
      setStatus(0);
      setResponse(`Error: ${error.message}`);
      
      toast({ 
        title: 'Request Failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const addHeader = () => {
    setHeaders(prev => [...prev, { key: '', value: '', enabled: true }]);
  };

  const updateHeader = (index: number, field: keyof Header, value: string | boolean) => {
    setHeaders(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  };

  const removeHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const selectPreset = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setMethod(preset.method);
    setEndpoint(preset.endpoint);
    setShowPresets(false);
  };

  const selectFromHistory = (item: RequestHistory) => {
    setMethod(item.method);
    setEndpoint(item.endpoint);
    setShowHistory(false);
  };

  const getMethodColor = (m: string) => METHODS.find(x => x.value === m)?.color || 'text-gray-400';
  const getStatusColor = (s: number) => {
    if (s >= 200 && s < 300) return 'text-emerald-400';
    if (s >= 300 && s < 400) return 'text-blue-400';
    if (s >= 400 && s < 500) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900 text-zinc-100">
      {/* URL Bar */}
      <div className="p-2 border-b border-zinc-800 space-y-2">
        <div className="flex gap-1.5">
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`h-8 px-2 text-xs font-bold bg-zinc-800 border border-zinc-700 rounded ${getMethodColor(method)}`}
            >
              {METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.value}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative">
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/api/endpoint"
              className="h-8 text-xs bg-zinc-800 border-zinc-700 font-mono pr-16"
              onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
            />
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="p-1 rounded hover:bg-zinc-700"
                title="Presets"
              >
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1 rounded hover:bg-zinc-700"
                title="History"
              >
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          </div>
          <Button 
            size="sm" 
            className="h-8 px-3"
            onClick={sendRequest}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Presets Dropdown */}
        {showPresets && (
          <div className="absolute z-10 mt-1 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-1">
            {PRESET_ENDPOINTS.map((preset, i) => (
              <button
                key={i}
                onClick={() => selectPreset(preset)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-zinc-700 text-xs"
              >
                <span className={`font-mono font-bold ${getMethodColor(preset.method)}`}>
                  {preset.method}
                </span>
                <span className="text-zinc-300">{preset.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* History Dropdown */}
        {showHistory && history.length > 0 && (
          <div className="absolute z-10 mt-1 right-12 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-1 max-h-48 overflow-auto">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => selectFromHistory(item)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-zinc-700 text-xs"
              >
                <span className={`font-mono font-bold text-[10px] ${getMethodColor(item.method)}`}>
                  {item.method}
                </span>
                <span className="flex-1 truncate text-zinc-300 font-mono text-[10px]">
                  {item.endpoint}
                </span>
                <span className={`text-[10px] ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Headers / Body Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('response')}
            className={`px-3 py-1.5 text-xs font-medium ${activeTab === 'response' ? 'text-primary border-b-2 border-primary' : 'text-zinc-400'}`}
          >
            Response
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-1.5 text-xs font-medium ${activeTab === 'headers' ? 'text-primary border-b-2 border-primary' : 'text-zinc-400'}`}
          >
            Headers
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'headers' ? (
          <div className="p-2 space-y-1.5">
            {headers.map((header, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={header.enabled}
                  onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                  className="rounded border-zinc-700"
                />
                <Input
                  placeholder="Key"
                  value={header.key}
                  onChange={(e) => updateHeader(i, 'key', e.target.value)}
                  className="h-6 text-[10px] bg-zinc-800 border-zinc-700 flex-1 font-mono"
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(i, 'value', e.target.value)}
                  className="h-6 text-[10px] bg-zinc-800 border-zinc-700 flex-1 font-mono"
                />
                <button onClick={() => removeHeader(i)} className="p-1 hover:bg-zinc-700 rounded">
                  <Trash2 className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addHeader}>
              <Plus className="h-3 w-3 mr-1" /> Add Header
            </Button>

            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <div className="mt-3">
                <label className="text-xs text-zinc-400 mb-1 block">Request Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="w-full h-24 text-xs bg-zinc-800 border border-zinc-700 rounded p-2 font-mono resize-none"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Status Bar */}
            {status !== null && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  {status >= 200 && status < 300 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className={`text-xs font-bold ${getStatusColor(status)}`}>
                    {status || 'Error'}
                  </span>
                </div>
                {duration !== null && (
                  <span className="text-xs text-zinc-500">
                    {duration}ms
                  </span>
                )}
              </div>
            )}

            {/* Response Body */}
            <div className="flex-1 p-2 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : response ? (
                <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap">
                  {response}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Globe className="h-8 w-8 text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">Send a request to see the response</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Base: {API_BASE || 'localhost'}</span>
        <span>{history.length} requests</span>
      </div>
    </div>
  );
}

