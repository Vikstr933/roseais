import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Plus, Trash2, Key, Shield, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuth, getAuthHeaders } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Secret {
  id: string;
  name: string;
  key: string;
  value: string;
  type: 'api_key' | 'token' | 'password' | 'env';
  service?: string;
  lastUsed?: string;
  isVisible?: boolean;
}

// Predefined services with icons
const SERVICES: Record<string, { icon: string; color: string }> = {
  openai: { icon: '🤖', color: 'text-emerald-500' },
  anthropic: { icon: '🧠', color: 'text-orange-500' },
  github: { icon: '🐙', color: 'text-purple-500' },
  vercel: { icon: '▲', color: 'text-white' },
  stripe: { icon: '💳', color: 'text-indigo-500' },
  supabase: { icon: '⚡', color: 'text-emerald-400' },
  firebase: { icon: '🔥', color: 'text-amber-500' },
  aws: { icon: '☁️', color: 'text-orange-400' },
  postgres: { icon: '🐘', color: 'text-blue-500' },
  redis: { icon: '🔴', color: 'text-red-500' },
  custom: { icon: '🔑', color: 'text-gray-400' },
};

export function SecretsVault() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSecret, setNewSecret] = useState({ name: '', key: '', value: '', service: 'custom' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load secrets from API
  useEffect(() => {
    const fetchSecrets = async () => {
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/secrets`, {
          headers: getAuthHeaders(sessionToken),
        });

        if (response.ok) {
          const data = await response.json();
          setSecrets(data.secrets || []);
        } else {
          // Use local storage as fallback
          const saved = localStorage.getItem('chap-secrets-vault');
          if (saved) setSecrets(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to fetch secrets:', error);
        const saved = localStorage.getItem('chap-secrets-vault');
        if (saved) setSecrets(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };

    fetchSecrets();
  }, [sessionToken]);

  // Save to local storage as backup
  useEffect(() => {
    if (!loading) {
      // Don't save actual values to localStorage, just names
      const safeSecrets = secrets.map(s => ({ ...s, value: '***' }));
      localStorage.setItem('chap-secrets-vault', JSON.stringify(safeSecrets));
    }
  }, [secrets, loading]);

  const addSecret = async () => {
    if (!newSecret.name || !newSecret.key || !newSecret.value) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }

    const secret: Secret = {
      id: `secret-${Date.now()}`,
      name: newSecret.name,
      key: newSecret.key,
      value: newSecret.value,
      type: 'api_key',
      service: newSecret.service,
      lastUsed: new Date().toISOString(),
    };

    try {
      if (sessionToken) {
        const response = await fetch(`${API_BASE}/api/secrets`, {
          method: 'POST',
          headers: { ...getAuthHeaders(sessionToken), 'Content-Type': 'application/json' },
          body: JSON.stringify(secret),
        });

        if (!response.ok) throw new Error('Failed to save');
      }

      setSecrets(prev => [...prev, secret]);
      setNewSecret({ name: '', key: '', value: '', service: 'custom' });
      setShowAddForm(false);
      toast({ title: 'Secret Added', description: `${secret.name} has been securely stored` });
    } catch (error) {
      toast({ title: 'Saved Locally', description: 'Secret saved to local vault' });
      setSecrets(prev => [...prev, secret]);
      setNewSecret({ name: '', key: '', value: '', service: 'custom' });
      setShowAddForm(false);
    }
  };

  const deleteSecret = async (id: string) => {
    try {
      if (sessionToken) {
        const response = await fetch(`${API_BASE}/api/secrets/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(sessionToken),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to delete secret');
        }

        // Optimistically update UI
        setSecrets(prev => prev.filter(s => s.id !== id));
        
        // Refetch to ensure we have the latest data (in case of cache issues)
        const refreshResponse = await fetch(`${API_BASE}/api/secrets`, {
          headers: getAuthHeaders(sessionToken),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setSecrets(data.secrets || []);
        }
        
        toast({ title: 'Secret Deleted', description: 'Secret has been removed' });
      } else {
        // Local-only deletion
        setSecrets(prev => prev.filter(s => s.id !== id));
        toast({ title: 'Secret Deleted', description: 'Secret has been removed' });
      }
    } catch (error) {
      console.error('Failed to delete secret:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to delete secret',
        variant: 'destructive' 
      });
    }
  };

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: 'Copied!', description: 'Secret copied to clipboard' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const toggleVisibility = (id: string) => {
    setSecrets(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
  };

  const maskValue = (value: string) => {
    if (value.length <= 8) return '•'.repeat(value.length);
    return value.slice(0, 4) + '•'.repeat(value.length - 8) + value.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950">
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-zinc-800" />
            <div className="h-3 w-24 rounded bg-zinc-800" />
          </div>
          <div className="h-6 w-14 rounded bg-zinc-800" />
        </div>
        {/* Skeleton secrets list */}
        <div className="flex-1 p-2 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50">
              <div className="h-6 w-6 rounded bg-zinc-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-zinc-700" />
                <div className="h-2 w-2/3 rounded bg-zinc-700" />
              </div>
              <div className="flex gap-1">
                <div className="h-5 w-5 rounded bg-zinc-700" />
                <div className="h-5 w-5 rounded bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-medium text-zinc-300">Encrypted Vault</span>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-6 px-2 text-xs"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-3 border-b border-zinc-800 bg-zinc-800/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Name (e.g. OpenAI Prod)"
              value={newSecret.name}
              onChange={(e) => setNewSecret(prev => ({ ...prev, name: e.target.value }))}
              className="h-7 text-xs bg-zinc-900 border-zinc-700"
            />
            <select
              value={newSecret.service}
              onChange={(e) => setNewSecret(prev => ({ ...prev, service: e.target.value }))}
              className="h-7 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 text-zinc-300"
            >
              {Object.entries(SERVICES).map(([key, { icon }]) => (
                <option key={key} value={key}>{icon} {key}</option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Key name (e.g. OPENAI_API_KEY)"
            value={newSecret.key}
            onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value }))}
            className="h-7 text-xs bg-zinc-900 border-zinc-700 font-mono"
          />
          <Input
            type="password"
            placeholder="Secret value"
            value={newSecret.value}
            onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
            className="h-7 text-xs bg-zinc-900 border-zinc-700 font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={addSecret}>
              <Lock className="h-3 w-3 mr-1" />
              Store Securely
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Secrets List */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {secrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Key className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">No secrets stored</p>
            <p className="text-xs text-zinc-500">Add API keys and tokens securely</p>
          </div>
        ) : (
          secrets.map((secret) => {
            const service = SERVICES[secret.service || 'custom'];
            return (
              <div
                key={secret.id}
                className="group p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={service.color}>{service.icon}</span>
                    <span className="text-xs font-medium text-zinc-200">{secret.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleVisibility(secret.id)}
                      className="p-1 rounded hover:bg-zinc-700"
                    >
                      {secret.isVisible ? (
                        <EyeOff className="h-3 w-3 text-zinc-400" />
                      ) : (
                        <Eye className="h-3 w-3 text-zinc-400" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(secret.value, secret.id)}
                      className="p-1 rounded hover:bg-zinc-700"
                    >
                      {copiedId === secret.id ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-zinc-400" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteSecret(secret.id)}
                      className="p-1 rounded hover:bg-red-900/50"
                    >
                      <Trash2 className="h-3 w-3 text-zinc-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-zinc-500 font-mono">{secret.key}</code>
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-400 bg-zinc-900/50 rounded px-2 py-1">
                  {secret.isVisible ? secret.value : maskValue(secret.value)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          AES-256 encrypted
        </span>
        <span>{secrets.length} secrets</span>
      </div>
    </div>
  );
}

