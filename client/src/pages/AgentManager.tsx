import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Edit2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Agent = {
  id: number;
  name: string;
  description: string;
  role: string;
  model: string;
  systemPrompt: string;
  temperature: string;
  capabilities: string[];
  isActive: boolean;
};

export default function AgentManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const createMutation = useMutation({
    mutationFn: async (newAgent: Omit<Agent, "id">) => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgent),
      });
      if (!res.ok) throw new Error("Failed to create agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });
      if (!res.ok) throw new Error("Failed to update agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Agent updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agent, isActive: !agent.isActive }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to toggle agent status");
      }
      return res.json();
    },
    onMutate: async (agent) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/agents"] });
      const previousAgents = queryClient.getQueryData<Agent[]>(["/api/agents"]);

      queryClient.setQueryData<Agent[]>(["/api/agents"], (old) =>
        old?.map((a) =>
          a.id === agent.id ? { ...a, isActive: !a.isActive } : a
        )
      );

      return { previousAgents };
    },
    onError: (err, agent, context) => {
      queryClient.setQueryData(["/api/agents"], context?.previousAgents);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Agent ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      });
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setSelectedAgent(null)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedAgent ? "Edit Agent" : "Create New Agent"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const agentData = {
                    name: formData.get("name") as string,
                    description: formData.get("description") as string,
                    role: formData.get("role") as string,
                    model: formData.get("model") as string,
                    systemPrompt: formData.get("systemPrompt") as string,
                    temperature: formData.get("temperature") as string,
                    capabilities: (formData.get("capabilities") as string).split(",").map(c => c.trim()),
                  };

                  if (selectedAgent) {
                    updateMutation.mutate({ ...agentData, id: selectedAgent.id, isActive: selectedAgent.isActive });
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
                    defaultValue={selectedAgent?.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    name="description"
                    defaultValue={selectedAgent?.description}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input
                    name="role"
                    defaultValue={selectedAgent?.role}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Select
                    name="model"
                    defaultValue={selectedAgent?.model}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3">Claude 3</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    name="systemPrompt"
                    defaultValue={selectedAgent?.systemPrompt}
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
                    defaultValue={selectedAgent?.temperature ?? "0.7"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Capabilities (comma-separated)</label>
                  <Input
                    name="capabilities"
                    defaultValue={selectedAgent?.capabilities.join(", ")}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedAgent ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
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
                      setSelectedAgent(agent);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActiveMutation.mutate(agent)}
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
                      {agent.capabilities.map((capability, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge
                      variant={agent.isActive ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {agent.isActive ? "Active" : "Inactive"}
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