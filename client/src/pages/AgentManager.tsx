import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Edit2, Power, PowerOff, Wand2 } from 'lucide-react';
import { clientLogger } from '../utils/ClientLogger';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { AuthGuard } from '../components/AuthGuard';

type Agent = {
  id: number | string;
  name: string;
  description: string;
  role: string;
  model: string;
  systemPrompt: string;
  temperature: string;
  capabilities: Record<string, boolean>;
  expertise: Record<string, string>;
  frameworks: Record<string, boolean>;
  libraries: Record<string, boolean>;
  bestPractices: Record<string, boolean>;
  enabledPlugins?: string[];
  isActive: boolean;
};

// Available plugins will be fetched from API

export default function AgentManager() {
  return (
    <AuthGuard>
      <AgentManagerContent />
    </AuthGuard>
  );
}

function AgentManagerContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState<Omit<
    Agent,
    'id'
  > | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Log page load
  useEffect(() => {
    clientLogger.uiEvent('AgentManager', 'page_loaded', {
      filterRole,
      filterStatus,
      sortBy,
      sortOrder,
    });
  }, []);

  // Fetch available plugins
  const { data: fetchedPlugins, error: pluginsError } = useQuery<Array<{ id: string; name: string; description: string; category?: string }>>({
    queryKey: ['availablePlugins'],
    queryFn: async () => {
      try {
        const response = await apiFetch('/api/plugins');
        if (!response.ok) {
          throw new Error('Failed to fetch available plugins');
        }
        const data = await response.json();
        // Handle both { success: true, plugins: [...] } and direct array response
        return data.plugins || data || [];
      } catch (error) {
        console.error('Error fetching plugins:', error);
        return [];
      }
    },
    enabled: isDialogOpen, // Only fetch when dialog is open
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Update availablePlugins when fetched
  useEffect(() => {
    if (fetchedPlugins) {
      setAvailablePlugins(fetchedPlugins);
    }
    if (pluginsError) {
      console.error('Error fetching plugins:', pluginsError);
      toast({
        title: 'Error',
        description: 'Failed to load available plugins',
        variant: 'destructive',
      });
    }
  }, [fetchedPlugins, pluginsError, toast]);

  // Initialize selectedPlugins when opening dialog with agent
  useEffect(() => {
    if (isDialogOpen && selectedAgent) {
      setSelectedPlugins(selectedAgent.enabledPlugins || []);
    } else if (!isDialogOpen) {
      setSelectedPlugins([]);
    }
  }, [isDialogOpen, selectedAgent]);

  const { data: agents = [], error: queryError } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
    queryFn: async () => {
      const startTime = Date.now();
      clientLogger.apiCall('GET', '/api/agents', undefined, undefined, {
        component: 'AgentManager',
        action: 'fetch_agents',
      });

      console.log('Fetching agents...');
      const response = await apiFetch('/api/agents');
      const duration = Date.now() - startTime;

      if (!response.ok) {
        clientLogger.apiCall('GET', '/api/agents', response.status, duration, {
          component: 'AgentManager',
          action: 'fetch_agents',
          error: 'Failed to fetch agents',
        });
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      clientLogger.apiCall('GET', '/api/agents', response.status, duration, {
        component: 'AgentManager',
        action: 'fetch_agents',
        agentCount: data.length,
      });

      // Data is already in correct format from server
      console.log('Agents data from server:', data);
      return data;
    },
  });

  // Filter and sort agents
  const filteredAndSortedAgents = useMemo(() => {
    return (agents || [])
      .filter(agent => {
        const matchesRole = filterRole === 'all' || agent.role === filterRole;
        const matchesStatus =
          filterStatus === 'all' ||
          (filterStatus === 'active' ? agent.isActive : !agent.isActive);
        const matchesSearch =
          !searchQuery ||
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.role.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRole && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'role':
            comparison = a.role.localeCompare(b.role);
            break;
          case 'status':
            comparison = Number(b.isActive) - Number(a.isActive);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [agents, filterRole, filterStatus, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    if (queryError) {
      console.error('Query error:', queryError);
      toast({
        title: 'Error',
        description: 'Failed to fetch agents',
        variant: 'destructive',
      });
    }
  }, [queryError, toast]);

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiFetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error('Failed to generate agent configuration');
      return res.json();
    },
    onSuccess: data => {
      setGeneratedConfig(data);
      setIsPromptDialogOpen(false);
      setIsDialogOpen(true);
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newAgent: Omit<Agent, 'id'>) => {
      const res = await apiFetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      if (!res.ok) throw new Error('Failed to create agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      setIsDialogOpen(false);
      setGeneratedConfig(null);
      toast({
        title: 'Success',
        description: 'Agent created successfully',
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const res = await apiFetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          description: agent.description,
          role: agent.role,
          model: agent.model,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          capabilities: agent.capabilities,
          expertise: agent.expertise,
          frameworks: agent.frameworks,
          libraries: agent.libraries,
          bestPractices: agent.bestPractices,
          isActive: agent.isActive,
          enabledPlugins: agent.enabledPlugins || [],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update agent');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      setIsDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Agent updated successfully',
      });
    },
    onError: error => {
      // Extract error details from the error message
      let errorMessage = 'Failed to update agent';
      try {
        const errorData = JSON.parse(error.message);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      console.log(
        'Toggling agent status:',
        agent.id,
        'from',
        agent.isActive,
        'to',
        !agent.isActive
      );

      const res = await apiFetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !agent.isActive,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to toggle agent status');
      }

      const updatedAgent = await res.json();
      console.log('Toggle response:', updatedAgent);
      return updatedAgent;
    },
    onMutate: async agent => {
      await queryClient.cancelQueries({ queryKey: ['/api/agents'] });
      const previousAgents = queryClient.getQueryData<Agent[]>(['/api/agents']);

      queryClient.setQueryData<Agent[]>(['/api/agents'], old =>
        old?.map(a => (a.id === agent.id ? { ...a, isActive: !a.isActive } : a))
      );

      return { previousAgents };
    },
    onError: (err, agent, context) => {
      queryClient.setQueryData(['/api/agents'], context?.previousAgents);

      // Extract error details from the error message
      let errorMessage = 'Failed to update agent status';
      try {
        const errorData = JSON.parse(err.message);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = err.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
    onSuccess: data => {
      toast({
        title: 'Success',
        description: `Agent ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
    },
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold brand-gradient-text mb-2">
              AI Agent Management
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create, configure, and manage your AI agents
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={() => {
                setIsPromptDialogOpen(true);
                setPrompt('');
              }}
              className="gap-2"
              variant="secondary"
            >
              <Wand2 className="w-4 h-4" />
              AI Create
            </Button>
            <Button
              onClick={() => {
                setSelectedAgent(null);
                setGeneratedConfig(null);
                setSelectedPlugins([]);
                setIsDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </div>

          <Dialog
            open={isPromptDialogOpen}
            onOpenChange={setIsPromptDialogOpen}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-auto overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Agent with AI</DialogTitle>
                <DialogDescription>
                  Describe what capabilities you need and we&rsquo;ll draft a complete agent configuration for you.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  generateMutation.mutate(prompt);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What kind of AI Agent do you need?
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., An AI Agent that can help me write newsletters and design them"
                    required
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPromptDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generateMutation.isPending}>
                    {generateMutation.isPending ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-auto overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
                </DialogTitle>
              <DialogDescription>
                Provide the core details, instructions, and capabilities for this agent. All fields can be adjusted later.
              </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const formData = new FormData(
                    e.currentTarget as HTMLFormElement
                  );
                  // Helper function to clean and split array fields
                  const processRecordField = (
                    value: string,
                    isExpertise = false
                  ) => {
                    const items = value
                      .split(',')
                      .map(item => item.trim())
                      .filter(Boolean);
                    return items.reduce(
                      (acc, item) => {
                        if (isExpertise) {
                          const [skill, level = 'expert'] = item
                            .split(':')
                            .map(s => s.trim());
                          acc[skill] = level;
                        } else {
                          acc[item] = true;
                        }
                        return acc;
                      },
                      {} as Record<string, any>
                    );
                  };

                  const agentData = {
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                    role: formData.get('role') as string,
                    model: formData.get('model') as string,
                    systemPrompt: formData.get('systemPrompt') as string,
                    temperature: formData.get('temperature') as string,
                    capabilities: processRecordField(
                      formData.get('capabilities') as string
                    ),
                    expertise: processRecordField(
                      formData.get('expertise') as string,
                      true
                    ),
                    frameworks: processRecordField(
                      formData.get('frameworks') as string
                    ),
                    libraries: processRecordField(
                      formData.get('libraries') as string
                    ),
                    bestPractices: processRecordField(
                      formData.get('bestPractices') as string
                    ),
                    enabledPlugins: selectedPlugins,
                  };

                  if (selectedAgent) {
                    updateMutation.mutate({
                      ...agentData,
                      id: selectedAgent.id,
                      isActive: selectedAgent.isActive,
                    });
                  } else {
                    createMutation.mutate(agentData as any);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    name="name"
                    defaultValue={generatedConfig?.name || selectedAgent?.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    name="description"
                    defaultValue={
                      generatedConfig?.description || selectedAgent?.description
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input
                    name="role"
                    defaultValue={generatedConfig?.role || selectedAgent?.role}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <div className="space-y-2">
                    <Select
                      defaultValue={
                        generatedConfig?.model || selectedAgent?.model || 'claude-sonnet-4-5-20250929'
                      }
                      onValueChange={(value) => {
                        // Store selected value in a ref or state for form submission
                        const form = document.querySelector('form');
                        if (form) {
                          let modelInput = form.querySelector('input[name="model"]') as HTMLInputElement;
                          if (!modelInput) {
                            modelInput = document.createElement('input');
                            modelInput.type = 'hidden';
                            modelInput.name = 'model';
                            form.appendChild(modelInput);
                          }
                          modelInput.value = value;
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-sonnet-4-5-20250929">
                          Claude 4.5 Sonnet (Latest)
                        </SelectItem>
                        <SelectItem value="claude-3-5-sonnet-20241022">
                          Claude 3.5 Sonnet
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Hidden input for form submission */}
                    <input
                      type="hidden"
                      name="model"
                      defaultValue={generatedConfig?.model || selectedAgent?.model || 'claude-sonnet-4-5-20250929'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    name="systemPrompt"
                    defaultValue={
                      generatedConfig?.systemPrompt ||
                      selectedAgent?.systemPrompt
                    }
                    required
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Temperature</label>
                  <Input
                    name="temperature"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue={
                      generatedConfig?.temperature ||
                      selectedAgent?.temperature ||
                      '0.7'
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Capabilities (comma-separated)
                  </label>
                  <Input
                    name="capabilities"
                    defaultValue={
                      generatedConfig?.capabilities
                        ? Object.keys(generatedConfig.capabilities).join(', ')
                        : selectedAgent
                          ? Object.keys(selectedAgent.capabilities).join(', ')
                          : ''
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Expertise (comma-separated)
                  </label>
                  <Input
                    name="expertise"
                    defaultValue={
                      generatedConfig?.expertise
                        ? Object.entries(generatedConfig.expertise)
                            .map(([skill, level]) => `${skill}: ${level}`)
                            .join(', ')
                        : selectedAgent
                          ? Object.entries(selectedAgent.expertise)
                              .map(([skill, level]) => `${skill}: ${level}`)
                              .join(', ')
                          : ''
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Frameworks (comma-separated)
                  </label>
                  <Input
                    name="frameworks"
                    defaultValue={
                      generatedConfig?.frameworks
                        ? Object.keys(generatedConfig.frameworks).join(', ')
                        : selectedAgent
                          ? Object.keys(selectedAgent.frameworks).join(', ')
                          : ''
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Libraries (comma-separated)
                  </label>
                  <Input
                    name="libraries"
                    defaultValue={
                      generatedConfig?.libraries
                        ? Object.keys(generatedConfig.libraries).join(', ')
                        : selectedAgent
                          ? Object.keys(selectedAgent.libraries).join(', ')
                          : ''
                    }
                    placeholder="jest, react-testing-library, axios"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Best Practices (comma-separated)
                  </label>
                  <Input
                    name="bestPractices"
                    defaultValue={
                      generatedConfig?.bestPractices
                        ? Object.keys(generatedConfig.bestPractices).join(', ')
                        : selectedAgent
                          ? Object.keys(selectedAgent.bestPractices).join(', ')
                          : ''
                    }
                    placeholder="SOLID, DRY, Clean Code"
                    required
                  />
                </div>

                {/* Plugin/Skill Selection */}
                <div className="space-y-3 border-t pt-4">
                  <label className="text-sm font-medium block">
                    Enabled Skills/Plugins
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select which plugins this agent can access
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availablePlugins.length === 0 ? (
                      <p className="text-sm text-muted-foreground col-span-2">
                        Loading plugins...
                      </p>
                    ) : (
                      availablePlugins.map(plugin => (
                        <label
                          key={plugin.id}
                          className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedPlugins.includes(plugin.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPlugins(prev => [...prev, plugin.id]);
                              } else {
                                setSelectedPlugins(prev => prev.filter(id => id !== plugin.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{plugin.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {plugin.description}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setGeneratedConfig(null);
                      setSelectedPlugins([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedAgent ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Search input */}
      <div className="mb-6">
        <Input
          placeholder="Search agents..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Filtering and Sorting Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Array.from(new Set(agents.map(agent => agent.role))).map(role => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={(value: 'all' | 'active' | 'inactive') =>
            setFilterStatus(value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(value: 'name' | 'role' | 'status') =>
            setSortBy(value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="gap-2"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {/* Compact Agent Cards Grid - 4-6 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredAndSortedAgents.map((agent, index) => {
          const isSystemAgent = Boolean((agent as any).isSystem);
          const agentRole = agent.role?.toLowerCase() || '';
          
          const roleColors: Record<string, string> = {
            'code_generator': 'from-violet-500 to-purple-600',
            'code-generator': 'from-violet-500 to-purple-600',
            'component-architect': 'from-blue-500 to-cyan-600',
            'component-developer': 'from-emerald-500 to-teal-600',
            'component-qa': 'from-amber-500 to-orange-600',
            'code-reviewer': 'from-rose-500 to-pink-600',
            'browser-agent': 'from-indigo-500 to-blue-600',
            'personal-assistant': 'from-fuchsia-500 to-purple-600',
            'analysis': 'from-cyan-500 to-blue-600',
          };
          
          const gradientClass = roleColors[agentRole] || 'from-slate-500 to-slate-600';
          const capabilitiesCount = Array.isArray(agent.capabilities) 
            ? agent.capabilities.length 
            : Object.keys(agent.capabilities || {}).length;
          
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedAgent(agent);
                setGeneratedConfig(null);
                setIsDialogOpen(true);
              }}
              className="cursor-pointer"
            >
              <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg group ${
                agent.isActive 
                  ? 'border-border hover:border-primary/50' 
                  : 'border-muted opacity-50'
              }`}>
                {/* Gradient top bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientClass}`} />
                
                <div className="p-3">
                  {/* Header row: Status dot, name, badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      agent.isActive 
                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' 
                        : 'bg-slate-400'
                    }`} />
                    <h3 className="text-sm font-medium truncate flex-1">{agent.name}</h3>
                  </div>
                  
                  {/* Role badge */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 truncate max-w-full">
                      {agent.role}
                    </Badge>
                    {isSystemAgent && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                        🔒
                      </Badge>
                    )}
                  </div>
                  
                  {/* Stats row */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{capabilitiesCount} capabilities</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                      Click to view →
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Agent Detail Dialog */}
      <Dialog open={isDialogOpen && selectedAgent !== null && generatedConfig === null} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setSelectedAgent(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAgent && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedAgent.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <DialogTitle className="text-xl">{selectedAgent.name}</DialogTitle>
                    {Boolean((selectedAgent as any).isSystem) && (
                      <Badge variant="outline" className="text-xs">🔒 System Agent</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActiveMutation.mutate(selectedAgent);
                      }}
                      disabled={toggleActiveMutation.isPending || Boolean((selectedAgent as any).isSystem)}
                    >
                      {selectedAgent.isActive ? <Power className="h-4 w-4 mr-1" /> : <PowerOff className="h-4 w-4 mr-1" />}
                      {selectedAgent.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        clientLogger.userAction('edit_agent', 'AgentManager', {
                          agentId: selectedAgent.id,
                          agentName: selectedAgent.name,
                        });
                        setGeneratedConfig(null);
                        // Keep dialog open but switch to edit mode
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
                <DialogDescription className="mt-2">
                  {selectedAgent.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</p>
                  <p className="text-sm">{selectedAgent.role}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</p>
                  <p className="text-sm">{selectedAgent.model}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Temperature</p>
                  <p className="text-sm">{selectedAgent.temperature}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                  <Badge variant={selectedAgent.isActive ? 'default' : 'secondary'}>
                    {selectedAgent.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedAgent.capabilities)
                      ? selectedAgent.capabilities
                      : Object.entries(selectedAgent.capabilities)
                          .filter(([_, enabled]) => enabled)
                          .map(([capability]) => capability)
                    ).map(capability => (
                      <Badge key={capability} variant="secondary" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Expertise</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedAgent.expertise)
                      ? selectedAgent.expertise
                      : Object.entries(selectedAgent.expertise)
                    ).map((item, index) => {
                      if (Array.isArray(selectedAgent.expertise)) {
                        const [skill, level] = item.split(': ');
                        return (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}: {level}
                          </Badge>
                        );
                      } else {
                        const [skill, level] = item;
                        return (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}: {level}
                          </Badge>
                        );
                      }
                    })}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Frameworks & Libraries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedAgent.frameworks)
                      ? selectedAgent.frameworks
                      : Object.entries(selectedAgent.frameworks)
                          .filter(([_, enabled]) => enabled)
                          .map(([framework]) => framework)
                    ).map(framework => (
                      <Badge key={framework} variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                        {framework}
                      </Badge>
                    ))}
                    {(Array.isArray(selectedAgent.libraries)
                      ? selectedAgent.libraries
                      : Object.entries(selectedAgent.libraries)
                          .filter(([_, enabled]) => enabled)
                          .map(([lib]) => lib)
                    ).map(lib => (
                      <Badge key={lib} variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">
                        {lib}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {selectedAgent.enabledPlugins && Array.isArray(selectedAgent.enabledPlugins) && selectedAgent.enabledPlugins.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Enabled Plugins</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.enabledPlugins.map((pluginId: string) => (
                        <Badge key={pluginId} variant="outline" className="text-xs">
                          🔌 {pluginId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
