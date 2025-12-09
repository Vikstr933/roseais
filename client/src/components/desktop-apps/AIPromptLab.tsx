import { useState, useEffect } from 'react';
import { Sparkles, Play, Save, Trash2, Copy, Clock, Zap, Star, ChevronDown, Loader2, CheckCircle2, AlertCircle, BarChart3, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth, getAuthHeaders } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  category: string;
  isFavorite: boolean;
  lastUsed?: Date;
  usageCount: number;
}

interface TestResult {
  id: string;
  model: string;
  prompt: string;
  response: string;
  duration: number;
  tokens?: { input: number; output: number };
  timestamp: Date;
  status: 'success' | 'error';
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  icon: string;
  color: string;
}

const MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', icon: '🧠', color: 'text-orange-400' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', icon: '🧠', color: 'text-orange-400' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: '🤖', color: 'text-emerald-400' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', icon: '🤖', color: 'text-emerald-400' },
];

const PROMPT_TEMPLATES = [
  { name: 'Code Review', prompt: 'Review the following code and suggest improvements:\n\n```\n[paste code here]\n```', category: 'Development' },
  { name: 'Bug Fix', prompt: 'I have the following error. Help me fix it:\n\nError: [describe error]\n\nCode:\n```\n[paste code]\n```', category: 'Development' },
  { name: 'Feature Request', prompt: 'I need help building: [describe feature]\n\nRequirements:\n- [requirement 1]\n- [requirement 2]\n\nTech stack: React, TypeScript, Tailwind', category: 'Development' },
  { name: 'Documentation', prompt: 'Generate documentation for this code:\n\n```\n[paste code]\n```\n\nInclude: JSDoc comments, usage examples, and a README section.', category: 'Documentation' },
  { name: 'Test Cases', prompt: 'Generate comprehensive test cases for:\n\n```\n[paste code]\n```\n\nInclude: Unit tests, edge cases, and integration test suggestions.', category: 'Testing' },
  { name: 'Explain Code', prompt: 'Explain this code in simple terms:\n\n```\n[paste code]\n```\n\nFocus on: What it does, how it works, and when to use it.', category: 'Learning' },
];

const CATEGORIES = ['All', 'Development', 'Documentation', 'Testing', 'Learning', 'Custom'];

export function AIPromptLab() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  
  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['claude-sonnet-4-5-20250929']);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [activeTab, setActiveTab] = useState<'test' | 'saved' | 'results'>('test');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [promptName, setPromptName] = useState('');

  // Load saved prompts
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chap-prompt-lab-saved');
      if (saved) setSavedPrompts(JSON.parse(saved));
    } catch {}
  }, []);

  // Save prompts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chap-prompt-lab-saved', JSON.stringify(savedPrompts));
    } catch {}
  }, [savedPrompts]);

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(m => m !== modelId)
        : [...prev, modelId]
    );
  };

  const runTest = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a prompt', variant: 'destructive' });
      return;
    }

    if (selectedModels.length === 0) {
      toast({ title: 'Error', description: 'Select at least one model', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setActiveTab('results');

    // Run tests in parallel
    const testPromises = selectedModels.map(async (modelId) => {
      const model = MODELS.find(m => m.id === modelId);
      const startTime = performance.now();

      try {
        const response = await fetch(`${API_BASE}/api/ai/generate`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            model: modelId,
            maxTokens: 2000,
          }),
        });

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        if (response.ok) {
          const data = await response.json();
          return {
            id: `result-${Date.now()}-${modelId}`,
            model: model?.name || modelId,
            prompt,
            response: data.content || data.response || JSON.stringify(data),
            duration,
            tokens: data.usage,
            timestamp: new Date(),
            status: 'success' as const,
          };
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (error: any) {
        const endTime = performance.now();
        return {
          id: `result-${Date.now()}-${modelId}`,
          model: model?.name || modelId,
          prompt,
          response: `Error: ${error.message}`,
          duration: Math.round(endTime - startTime),
          timestamp: new Date(),
          status: 'error' as const,
        };
      }
    });

    const newResults = await Promise.all(testPromises);
    setResults(prev => [...newResults, ...prev.slice(0, 20)]);
    setLoading(false);
  };

  const savePrompt = () => {
    if (!prompt.trim() || !promptName.trim()) {
      toast({ title: 'Error', description: 'Enter a name and prompt', variant: 'destructive' });
      return;
    }

    const newPrompt: SavedPrompt = {
      id: `prompt-${Date.now()}`,
      name: promptName,
      prompt,
      category: 'Custom',
      isFavorite: false,
      usageCount: 0,
    };

    setSavedPrompts(prev => [newPrompt, ...prev]);
    setPromptName('');
    toast({ title: 'Saved', description: 'Prompt saved to library' });
  };

  const loadPrompt = (savedPrompt: SavedPrompt) => {
    setPrompt(savedPrompt.prompt);
    setSavedPrompts(prev => prev.map(p => 
      p.id === savedPrompt.id 
        ? { ...p, usageCount: p.usageCount + 1, lastUsed: new Date() }
        : p
    ));
    setActiveTab('test');
  };

  const toggleFavorite = (id: string) => {
    setSavedPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    ));
  };

  const deletePrompt = (id: string) => {
    setSavedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: 'Response copied to clipboard' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const filteredPrompts = selectedCategory === 'All' 
    ? savedPrompts 
    : savedPrompts.filter(p => p.category === selectedCategory);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 via-purple-950/10 to-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-medium">AI Prompt Lab</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant={activeTab === 'test' ? 'default' : 'ghost'} 
            className="h-6 px-2 text-[10px]"
            onClick={() => setActiveTab('test')}
          >
            <Zap className="h-3 w-3 mr-1" />
            Test
          </Button>
          <Button 
            size="sm" 
            variant={activeTab === 'saved' ? 'default' : 'ghost'} 
            className="h-6 px-2 text-[10px]"
            onClick={() => setActiveTab('saved')}
          >
            <Star className="h-3 w-3 mr-1" />
            Saved
          </Button>
          <Button 
            size="sm" 
            variant={activeTab === 'results' ? 'default' : 'ghost'} 
            className="h-6 px-2 text-[10px]"
            onClick={() => setActiveTab('results')}
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            Results
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'test' && (
          <div className="p-3 space-y-3">
            {/* Prompt Input */}
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="w-full h-32 text-xs bg-zinc-800 border border-zinc-700 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Templates */}
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Quick Templates</label>
              <div className="flex flex-wrap gap-1">
                {PROMPT_TEMPLATES.slice(0, 4).map((template, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(template.prompt)}
                    className="text-[10px] px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block">Models ({selectedModels.length} selected)</label>
              <div className="space-y-1">
                {MODELS.map((model) => (
                  <label 
                    key={model.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedModels.includes(model.id) 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                      className="rounded border-zinc-600"
                    />
                    <span className="text-lg">{model.icon}</span>
                    <div className="flex-1">
                      <span className={`text-xs font-medium ${model.color}`}>{model.name}</span>
                      <span className="text-[10px] text-zinc-500 ml-2">{model.provider}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                className="flex-1 h-8" 
                onClick={runTest}
                disabled={loading || selectedModels.length === 0}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test ({selectedModels.length})
              </Button>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="Name"
                  className="w-24 h-8 text-xs bg-zinc-800 border border-zinc-700 rounded px-2"
                />
                <Button variant="outline" className="h-8" onClick={savePrompt}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="p-3 space-y-2">
            {/* Category Filter */}
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] px-2 py-1 rounded ${
                    selectedCategory === cat 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Saved Prompts */}
            {filteredPrompts.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No saved prompts</p>
              </div>
            ) : (
              filteredPrompts.map((saved) => (
                <div
                  key={saved.id}
                  className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleFavorite(saved.id)}>
                        <Star className={`h-3 w-3 ${saved.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-500'}`} />
                      </button>
                      <span className="text-xs font-medium">{saved.name}</span>
                      <Badge variant="secondary" className="text-[9px] h-4">{saved.category}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => loadPrompt(saved)}
                        className="p-1 hover:bg-zinc-700 rounded"
                      >
                        <Play className="h-3 w-3 text-zinc-400" />
                      </button>
                      <button
                        onClick={() => deletePrompt(saved.id)}
                        className="p-1 hover:bg-red-900/50 rounded"
                      >
                        <Trash2 className="h-3 w-3 text-zinc-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 line-clamp-2">{saved.prompt}</p>
                  <div className="flex gap-2 mt-1 text-[9px] text-zinc-500">
                    <span>Used {saved.usageCount}x</span>
                    {saved.lastUsed && <span>Last: {new Date(saved.lastUsed).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="p-3 space-y-2">
            {results.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No results yet</p>
                <p className="text-[10px] text-zinc-600">Run a test to see results</p>
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className={`p-2 rounded-lg border ${
                    result.status === 'error' 
                      ? 'bg-red-900/10 border-red-900/30' 
                      : 'bg-zinc-800/50 border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.status === 'error' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      <span className="text-xs font-medium">{result.model}</span>
                      <Badge variant="secondary" className="text-[9px] h-4">
                        {result.duration}ms
                      </Badge>
                    </div>
                    <button
                      onClick={() => copyToClipboard(result.response)}
                      className="p-1 hover:bg-zinc-700 rounded"
                    >
                      <Copy className="h-3 w-3 text-zinc-400" />
                    </button>
                  </div>
                  <div className="bg-zinc-900/50 rounded p-2 max-h-40 overflow-auto">
                    <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-mono">
                      {result.response.slice(0, 500)}
                      {result.response.length > 500 && '...'}
                    </pre>
                  </div>
                  <div className="flex gap-2 mt-1 text-[9px] text-zinc-500">
                    {result.tokens && (
                      <>
                        <span>In: {result.tokens.input}</span>
                        <span>Out: {result.tokens.output}</span>
                      </>
                    )}
                    <span>{result.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{savedPrompts.length} saved</span>
        <span>{results.length} results</span>
      </div>
    </div>
  );
}

