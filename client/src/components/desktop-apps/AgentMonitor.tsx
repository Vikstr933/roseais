import { useState, useEffect, useRef } from 'react';
import { Bot, Activity, MessageSquare, Zap, Clock, CheckCircle2, AlertCircle, Loader2, RefreshCw, Pause, Play, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth, getAuthHeaders } from '../../contexts/AuthContext';
import { ScrollArea } from '../ui/scroll-area';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  model?: string;
  lastActivity?: string;
  tasksCompleted?: number;
  currentTask?: string;
  icon?: string;
}

interface AgentEvent {
  id: string;
  agentId: string;
  agentName: string;
  type: 'started' | 'completed' | 'error' | 'message';
  message: string;
  timestamp: Date;
  duration?: number;
}

// Agent icons based on type
const AGENT_ICONS: Record<string, string> = {
  'component-architect': '🏗️',
  'component-developer': '👨‍💻',
  'component-qa': '🔍',
  'code-reviewer': '📝',
  'code_generator': '⚙️',
  'browser-agent': '🌐',
  'discord-bot': '🤖',
  'analysis': '📊',
  'default': '🤖',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  idle: { bg: 'bg-zinc-800', text: 'text-zinc-400', dot: 'bg-zinc-500' },
  working: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', dot: 'bg-emerald-500 animate-pulse' },
  error: { bg: 'bg-red-900/30', text: 'text-red-400', dot: 'bg-red-500' },
  offline: { bg: 'bg-zinc-900', text: 'text-zinc-600', dot: 'bg-zinc-700' },
};

export function AgentMonitor() {
  const { sessionToken } = useAuth();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [view, setView] = useState<'agents' | 'events'>('agents');
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/agents`, {
          headers: getAuthHeaders(sessionToken),
        });

        if (response.ok) {
          const data = await response.json();
          const agentStatuses: AgentStatus[] = (data.agents || data || []).map((agent: any) => ({
            id: agent.id?.toString() || agent.name,
            name: agent.name || agent.id,
            type: agent.type || agent.category || 'default',
            status: agent.isActive !== false ? 'idle' : 'offline',
            model: agent.model,
            lastActivity: agent.updatedAt,
            tasksCompleted: 0,
            icon: AGENT_ICONS[agent.type] || AGENT_ICONS[agent.name] || AGENT_ICONS.default,
          }));
          setAgents(agentStatuses);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [sessionToken]);

  // Connect to SSE for real-time agent activity
  useEffect(() => {
    if (!sessionToken || paused) return;

    const connectSSE = () => {
      try {
        const url = `${API_BASE}/api/sse/agent-activity`;
        const eventSource = new EventSource(url, {
          withCredentials: false,
        });

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'agent_activity' || data.type === 'generation_progress') {
              // Update agent status
              if (data.agentId) {
                setAgents(prev => prev.map(a => 
                  a.id === data.agentId || a.name === data.agentName
                    ? { 
                        ...a, 
                        status: data.status === 'completed' ? 'idle' : 'working',
                        currentTask: data.message,
                        lastActivity: new Date().toISOString(),
                      }
                    : a
                ));
              }

              // Add event
              const newEvent: AgentEvent = {
                id: `event-${Date.now()}`,
                agentId: data.agentId || 'system',
                agentName: data.agentName || data.agent || 'System',
                type: data.status === 'completed' ? 'completed' : 
                      data.status === 'error' ? 'error' : 
                      data.status === 'started' ? 'started' : 'message',
                message: data.message || data.content || 'Activity detected',
                timestamp: new Date(),
                duration: data.duration,
              };
              
              setEvents(prev => [newEvent, ...prev.slice(0, 99)]);
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          // Reconnect after 5 seconds
          setTimeout(connectSSE, 5000);
        };

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error('Failed to connect to SSE:', error);
      }
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [sessionToken, paused]);

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const getAgentIcon = (agent: AgentStatus) => {
    return agent.icon || AGENT_ICONS[agent.type] || AGENT_ICONS.default;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type: AgentEvent['type']) => {
    switch (type) {
      case 'started': return <Play className="h-3 w-3 text-blue-400" />;
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-400" />;
      default: return <MessageSquare className="h-3 w-3 text-zinc-400" />;
    }
  };

  const activeAgents = agents.filter(a => a.status === 'working').length;
  const totalAgents = agents.length;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900 text-zinc-100">
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 animate-pulse">
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="flex gap-1">
            <div className="h-6 w-16 rounded bg-zinc-800" />
            <div className="h-6 w-16 rounded bg-zinc-800" />
          </div>
        </div>
        {/* Skeleton agents */}
        <div className="flex-1 p-2 space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50">
              <div className="h-8 w-8 rounded-full bg-zinc-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-zinc-700" />
                <div className="h-2 w-2/3 rounded bg-zinc-700" />
              </div>
              <div className="h-5 w-12 rounded-full bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className={`h-4 w-4 ${activeAgents > 0 ? 'text-emerald-500 animate-pulse' : 'text-zinc-500'}`} />
            <span className="text-xs font-medium">
              {activeAgents}/{totalAgents} Active
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant={view === 'agents' ? 'default' : 'ghost'} 
            className="h-6 px-2 text-[10px]"
            onClick={() => setView('agents')}
          >
            <Bot className="h-3 w-3 mr-1" />
            Agents
          </Button>
          <Button 
            size="sm" 
            variant={view === 'events' ? 'default' : 'ghost'} 
            className="h-6 px-2 text-[10px]"
            onClick={() => setView('events')}
          >
            <Zap className="h-3 w-3 mr-1" />
            Events
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {view === 'agents' ? (
          <div className="p-2 space-y-1.5">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-10 w-10 text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-400">No agents found</p>
                <p className="text-xs text-zinc-500">Agents will appear here when active</p>
              </div>
            ) : (
              agents.map((agent) => {
                const colors = STATUS_COLORS[agent.status];
                const isSelected = selectedAgent === agent.id;
                
                return (
                  <div
                    key={agent.id}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-zinc-700'
                    } ${colors.bg}`}
                    onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getAgentIcon(agent)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{agent.name}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          </div>
                          <span className="text-[10px] text-zinc-500">{agent.type}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                    
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-zinc-700/50 space-y-1">
                        {agent.model && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500">Model</span>
                            <span className="text-zinc-300 font-mono">{agent.model}</span>
                          </div>
                        )}
                        {agent.currentTask && (
                          <div className="text-[10px]">
                            <span className="text-zinc-500">Current: </span>
                            <span className="text-zinc-300">{agent.currentTask}</span>
                          </div>
                        )}
                        {agent.lastActivity && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500">Last Active</span>
                            <span className="text-zinc-300">{new Date(agent.lastActivity).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Zap className="h-10 w-10 text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-400">No events yet</p>
                <p className="text-xs text-zinc-500">Agent activity will appear here</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-1.5 rounded hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-300">{event.agentName}</span>
                      <span className="text-[10px] text-zinc-600">{formatTime(event.timestamp)}</span>
                      {event.duration && (
                        <Badge variant="secondary" className="h-4 text-[9px] px-1">
                          {event.duration}ms
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">{event.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={eventsEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          {paused ? (
            <><Pause className="h-2.5 w-2.5" /> Paused</>
          ) : (
            <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Live</>
          )}
        </span>
        <span>{events.length} events</span>
      </div>
    </div>
  );
}

