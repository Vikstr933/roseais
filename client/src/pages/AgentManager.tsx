import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Edit2, Power, PowerOff, Wand2 } from 'lucide-react';
import { clientLogger } from '../utils/ClientLogger';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
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
  id: number;
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
  isActive: boolean;
};

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

  const { data: agents = [], error: queryError } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
    queryFn: async () => {
      const startTime = Date.now();
      clientLogger.apiCall('GET', '/api/agents', undefined, undefined, {
        component: 'AgentManager',
        action: 'fetch_agents',
      });

      console.log('Fetching agents...');
      const response = await fetch('/api/agents');
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
      const res = await fetch('/api/agents/generate', {
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
      const res = await fetch('/api/agents', {
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
      const res = await fetch(`/api/agents/${agent.id}`, {
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

      const res = await fetch(`/api/agents/${agent.id}`, {
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
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
              AI Agent Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Create, configure, and manage your AI agents
            </p>
          </div>
          <div className="flex gap-2">
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
            <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Agent with AI</DialogTitle>
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
            <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
                </DialogTitle>
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
                  <Select
                    name="model"
                    defaultValue={
                      generatedConfig?.model || selectedAgent?.model
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-sonnet-20240229">
                        Claude 3 Sonnet
                      </SelectItem>
                      <SelectItem value="gpt-4-turbo-preview">
                        GPT-4 Turbo
                      </SelectItem>
                      <SelectItem value="deepseek-coder-33b-instruct">
                        DeepSeek Coder
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setGeneratedConfig(null);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedAgents.map(agent => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h2 className="text-xl font-semibold">{agent.name}</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      clientLogger.userAction('edit_agent', 'AgentManager', {
                        agentId: agent.id,
                        agentName: agent.name,
                      });
                      setSelectedAgent(agent);
                      setGeneratedConfig(null);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      clientLogger.userAction(
                        'toggle_agent_status',
                        'AgentManager',
                        {
                          agentId: agent.id,
                          agentName: agent.name,
                          currentStatus: agent.isActive ? 'active' : 'inactive',
                          newStatus: agent.isActive ? 'inactive' : 'active',
                        }
                      );
                      toggleActiveMutation.mutate(agent);
                    }}
                    disabled={toggleActiveMutation.isPending}
                  >
                    {agent.isActive ? (
                      <Power className="h-4 w-4" />
                    ) : (
                      <PowerOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {agent.description}
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.role}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Model</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Capabilities</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(agent.capabilities)
                        ? agent.capabilities
                        : Object.entries(agent.capabilities)
                            .filter(([_, enabled]) => enabled)
                            .map(([capability]) => capability)
                      ).map(capability => (
                        <Badge
                          key={capability}
                          variant="secondary"
                          className="text-xs"
                        >
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Expertise</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(agent.expertise)
                        ? agent.expertise
                        : Object.entries(agent.expertise)
                      ).map((item, index) => {
                        if (Array.isArray(agent.expertise)) {
                          // Handle array format: ["React: expert", "TypeScript: expert"]
                          const [skill, level] = item.split(': ');
                          return (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {skill}: {level}
                            </Badge>
                          );
                        } else {
                          // Handle object format: {React: "expert", TypeScript: "expert"}
                          const [skill, level] = item;
                          return (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="text-xs"
                            >
                              {skill}: {level}
                            </Badge>
                          );
                        }
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Frameworks</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(agent.frameworks)
                        ? agent.frameworks
                        : Object.entries(agent.frameworks)
                            .filter(([_, enabled]) => enabled)
                            .map(([framework]) => framework)
                      ).map(framework => (
                        <Badge
                          key={framework}
                          variant="secondary"
                          className="text-xs"
                        >
                          {framework}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Libraries</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(agent.libraries)
                        ? agent.libraries
                        : Object.entries(agent.libraries)
                            .filter(([_, enabled]) => enabled)
                            .map(([lib]) => lib)
                      ).map(lib => (
                        <Badge
                          key={lib}
                          variant="secondary"
                          className="text-xs"
                        >
                          {lib}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Best Practices</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(agent.bestPractices)
                        ? agent.bestPractices
                        : Object.entries(agent.bestPractices)
                            .filter(([_, enabled]) => enabled)
                            .map(([practice]) => practice)
                      ).map(practice => (
                        <Badge
                          key={practice}
                          variant="secondary"
                          className="text-xs"
                        >
                          {practice}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge
                      variant={agent.isActive ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
