import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock3,
  Loader2,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { CircularAgentVisualization } from './CircularAgentVisualization';

type AgentEventType =
  | 'connected'
  | 'phase:start'
  | 'phase:complete'
  | 'agent:start'
  | 'agent:progress'
  | 'agent:complete'
  | 'agent:error'
  | 'orchestration:complete'
  | 'FILE_GENERATED'
  | 'AGENT_START'
  | 'AGENT_PROGRESS'
  | 'AGENT_COMPLETE'
  | 'AGENT_ERROR';

interface AgentEvent {
  type: AgentEventType;
  agentId?: string;
  agent?: string; // For new event format
  phase?: number;
  totalPhases?: number;
  timestamp?: number | string;
  duration?: number;
  success?: boolean;
  error?: string;
  message?: string; // For progress updates
  agentsInPhase?: string[];
  warnings?: number;
  file?: {
    path: string;
    size: number;
    preview: string;
  };
  totalFiles?: number;
  generatedFiles?: number;
}

type AgentStatusType = 'pending' | 'running' | 'completed' | 'failed';

interface AgentStatus {
  id: string;
  status: AgentStatusType;
  phase?: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
  currentMessage?: string; // Live progress message
}

interface PhaseStatus {
  index: number;
  agents: string[];
  status: 'pending' | 'active' | 'complete';
  startedAt?: number;
  completedAt?: number;
}

export function AgentMonitorPanel() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStatusMap, setAgentStatusMap] = useState<Map<string, AgentStatus>>(
    () => new Map()
  );
  const [phases, setPhases] = useState<Map<number, PhaseStatus>>(() => new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create a single EventSource instance
    console.log('🔌 Creating EventSource for agent activity');
    const eventSource = new EventSource('/api/sse/agent-activity');

    eventSource.onopen = () => {
      console.log('✅ Agent activity stream opened');
      setConnected(true);
    };

    eventSource.onmessage = event => {
      try {
        const data: AgentEvent = JSON.parse(event.data);

        // Ignore heartbeat messages
        if (event.data === ': heartbeat') return;

        setEvents(prev => {
          // Limit to last 100 events to prevent memory bloat
          const newEvents = [...prev, { ...data, timestamp: data.timestamp ?? Date.now() }];
          return newEvents.slice(-100);
        });

      switch (data.type) {
        case 'connected':
          setConnected(true);
          break;
        case 'phase:start':
          setPhases(prev => {
            const next = new Map(prev);
            next.set(data.phase ?? 0, {
              index: data.phase ?? 0,
              agents: data.agentsInPhase ?? [],
              status: 'active',
              startedAt: Date.now(),
            });
            return next;
          });
          break;
        case 'phase:complete':
          setPhases(prev => {
            const next = new Map(prev);
            const phaseEntry = next.get(data.phase ?? 0);
            if (phaseEntry) {
              phaseEntry.status = 'complete';
              phaseEntry.completedAt = Date.now();
            }
            return next;
          });
          break;
        case 'agent:start':
          if (!data.agentId) break;
          setAgentStatusMap(prev => {
            const next = new Map(prev);
            next.set(data.agentId!, {
              id: data.agentId!,
              status: 'running',
              startTime: data.timestamp ?? Date.now(),
            });
            return next;
          });
          break;
        case 'agent:progress':
          if (!data.agentId) break;
          setAgentStatusMap(prev => {
            const next = new Map(prev);
            const agent = next.get(data.agentId!);
            if (agent) {
              next.set(data.agentId!, {
                ...agent,
                currentMessage: data.message,
              });
            }
            return next;
          });
          break;
        case 'agent:complete':
          if (!data.agentId) break;
          setAgentStatusMap(prev => {
            const next = new Map(prev);
            const agent = next.get(data.agentId!);
            const now = Date.now();
            next.set(data.agentId!, {
              id: data.agentId!,
              status: data.success === false ? 'failed' : 'completed',
              startTime: agent?.startTime,
              endTime: now,
              duration:
                data.duration ??
                (agent?.startTime ? now - agent.startTime : undefined),
              error: data.success === false ? data.error : undefined,
            });
            return next;
          });
          break;
        case 'agent:error':
          if (!data.agentId) break;
          setAgentStatusMap(prev => {
            const next = new Map(prev);
            const agent = next.get(data.agentId!);
            next.set(data.agentId!, {
              id: data.agentId!,
              status: 'failed',
              startTime: agent?.startTime,
              endTime: Date.now(),
              duration: agent?.startTime
                ? Date.now() - agent.startTime
                : undefined,
              error: data.error,
            });
            return next;
          });
          break;
        case 'orchestration:complete':
          setPhases(prev => {
            const next = new Map(prev);
            return new Map(
              Array.from(next.entries()).map(([phaseIndex, value]) => [
                phaseIndex,
                value.status === 'complete'
                  ? value
                  : { ...value, status: 'complete', completedAt: Date.now() },
              ])
            );
          });
          break;
        case 'FILE_GENERATED':
          // Handle file generation events
          console.log(`📄 File generated: ${data.file?.path} (${data.generatedFiles}/${data.totalFiles})`);
          break;
        case 'AGENT_START':
          // Handle new format agent start events
          const startAgentId = data.agent || data.agentId;
          if (startAgentId) {
            console.log(`🚀 AGENT_START received for: ${startAgentId}`);
            setAgentStatusMap(prev => {
              const next = new Map(prev);
              next.set(startAgentId, {
                id: startAgentId,
                status: 'running',
                startTime: typeof data.timestamp === 'string'
                  ? new Date(data.timestamp).getTime()
                  : data.timestamp ?? Date.now(),
              });
              console.log(`✅ Agent map updated:`, Array.from(next.keys()));
              return next;
            });
          }
          break;
        case 'AGENT_PROGRESS':
          // Handle new format agent progress events
          const progressAgentId = data.agent || data.agentId;
          if (progressAgentId) {
            console.log(`⏳ AGENT_PROGRESS received for: ${progressAgentId} - ${data.message}`);
            setAgentStatusMap(prev => {
              const next = new Map(prev);
              const agent = next.get(progressAgentId);
              if (agent) {
                next.set(progressAgentId, {
                  ...agent,
                  currentMessage: data.message,
                });
              } else {
                // Agent not yet in map, add it as running
                console.log(`⚠️ Agent ${progressAgentId} not in map, adding as running`);
                next.set(progressAgentId, {
                  id: progressAgentId,
                  status: 'running',
                  startTime: Date.now(),
                  currentMessage: data.message,
                });
              }
              return next;
            });
          }
          break;
        case 'AGENT_COMPLETE':
          // Handle new format agent complete events
          const completeAgentId = data.agent || data.agentId;
          if (completeAgentId) {
            console.log(`✅ AGENT_COMPLETE received for: ${completeAgentId}`);
            setAgentStatusMap(prev => {
              const next = new Map(prev);
              const agent = next.get(completeAgentId);
              const now = Date.now();
              next.set(completeAgentId, {
                id: completeAgentId,
                status: 'completed',
                startTime: agent?.startTime,
                endTime: now,
                duration: data.duration ?? (agent?.startTime ? now - agent.startTime : undefined),
              });
              console.log(`✅ Agent map updated:`, Array.from(next.keys()));
              return next;
            });
          }
          break;
        case 'AGENT_ERROR':
          // Handle new format agent error events
          const errorAgentId = data.agent || data.agentId;
          if (errorAgentId) {
            setAgentStatusMap(prev => {
              const next = new Map(prev);
              const agent = next.get(errorAgentId);
              next.set(errorAgentId, {
                id: errorAgentId,
                status: 'failed',
                startTime: agent?.startTime,
                endTime: Date.now(),
                duration: agent?.startTime ? Date.now() - agent.startTime : undefined,
                error: data.error || data.message,
              });
              return next;
            });
          }
          break;
        default:
          break;
      }
      } catch (error) {
        console.error('Error parsing agent event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ Agent activity stream error:', error);
      setConnected(false);
      eventSource.close();

      // Retry after 5 seconds
      setTimeout(() => {
        console.log('🔄 Retrying agent activity stream...');
        // Trigger re-render to create new connection
        setConnected(false);
      }, 5000);
    };

    // CRITICAL: Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up EventSource for agent activity');
      eventSource.close();
    };
  }, []); // Empty deps array - only run once

  const agentStatuses = useMemo(() => Array.from(agentStatusMap.values()), [agentStatusMap]);
  const sortedPhases = useMemo(
    () => Array.from(phases.values()).sort((a, b) => a.index - b.index),
    [phases]
  );
  const completeCount = agentStatuses.filter(agent => agent.status === 'completed').length;
  const failedCount = agentStatuses.filter(agent => agent.status === 'failed').length;
  const totalAgents = agentStatuses.length;
  const overallProgress = totalAgents
    ? Math.round((completeCount / totalAgents) * 100)
    : 0;

  // Check if workflow is running
  const isRunning = agentStatuses.some(a => a.status === 'running') || totalAgents > 0;

  return (
    <div className="space-y-6">
      {/* Circular Visualization - Main focal point - Always show when connected */}
      {connected && (
        <Card className="bg-slate-950">
          <CardContent className="p-6">
            <CircularAgentVisualization
              agentStatusMap={agentStatusMap}
              isRunning={isRunning}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <SummaryCard
        connected={connected}
        completeCount={completeCount}
        failedCount={failedCount}
        totalAgents={totalAgents}
        progress={overallProgress}
      />

      {/* Phase Timeline - Collapsible details */}
      <PhaseTimeline phases={sortedPhases} />

      {/* Agent Grid - Detailed status */}
      <AgentGrid agents={agentStatuses} />

      {/* Event Log - For debugging */}
      <EventLog events={events} />
    </div>
  );
}

function SummaryCard(props: {
  connected: boolean;
  completeCount: number;
  failedCount: number;
  totalAgents: number;
  progress: number;
}) {
  const { connected, completeCount, failedCount, totalAgents, progress } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Agent Orchestration</span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              aria-hidden
            />
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>Overall progress</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric value={totalAgents} label="Agents In Run" icon={Clock3} />
          <Metric value={completeCount} label="Completed" icon={CheckCircle2} />
          <Metric value={failedCount} label="Failed" icon={XCircle} />
          <Metric value={progress + '%'} label="Progress" icon={Loader2} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric(props: { value: number | string; label: string; icon: typeof Clock3 }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="rounded-full bg-muted p-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <div className="text-lg font-semibold">{props.value}</div>
        <div className="text-sm text-muted-foreground">{props.label}</div>
      </div>
    </div>
  );
}

function PhaseTimeline({ phases }: { phases: PhaseStatus[] }) {
  if (!phases.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Phases</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {phases.map(phase => (
            <div
              key={phase.index}
              className="flex items-start justify-between rounded-lg border bg-muted/40 p-4"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Badge variant={phase.status === 'complete' ? 'default' : 'secondary'}>
                    Phase {phase.index}
                  </Badge>
                  <span className="text-muted-foreground">{phase.agents.join(', ')}</span>
                </div>
                {phase.startedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Started {new Date(phase.startedAt).toLocaleTimeString()}
                    {phase.completedAt
                      ? ` · Completed ${new Date(phase.completedAt).toLocaleTimeString()}`
                      : ''}
                  </p>
                )}
              </div>
              <Badge variant={phase.status === 'complete' ? 'default' : 'secondary'}>
                {phase.status === 'complete'
                  ? 'Complete'
                  : phase.status === 'active'
                  ? 'In Progress'
                  : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentGrid({ agents }: { agents: AgentStatus[] }) {
  if (!agents.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Waiting for agent activity...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  const statusConfig: Record<AgentStatusType, { icon: typeof Clock3; variant: 'default' | 'secondary' | 'destructive'; label: string; }> = {
    pending: { icon: Clock3, variant: 'secondary', label: 'Pending' },
    running: { icon: Loader2, variant: 'secondary', label: 'Running' },
    completed: { icon: CheckCircle2, variant: 'default', label: 'Completed' },
    failed: { icon: XCircle, variant: 'destructive', label: 'Failed' },
  };

  const config = statusConfig[agent.status];
  const Icon = config.icon;

  return (
    <Card className="border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{agent.id}</h3>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className={`h-4 w-4 ${agent.status === 'running' ? 'animate-spin' : ''}`} />
              {agent.duration !== undefined
                ? `${agent.duration}ms`
                : agent.startTime
                ? 'In progress'
                : 'Awaiting start'}
            </div>
            {agent.error ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <TriangleAlert className="h-3 w-3" />
                <span className="line-clamp-2">{agent.error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventLog({ events }: { events: AgentEvent[] }) {
  if (!events.length) return null;

  const lastEvents = events.slice(-40).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Log</CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        <ul className="space-y-2 text-sm">
          {lastEvents.map((event, idx) => (
            <li
              key={`${event.timestamp}-${event.type}-${idx}`}
              className="flex items-center justify-between gap-4 rounded border bg-muted/40 px-3 py-2"
            >
              <div className="space-y-1">
                <div className="font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp ?? Date.now()).toLocaleTimeString()}
                </div>
                <div className="capitalize">
                  {event.type.replace(/[:_]/g, ' ')}{' '}
                  {event.agentId ? (
                    <span className="font-semibold text-muted-foreground">({event.agentId})</span>
                  ) : null}
                </div>
                {event.error ? (
                  <p className="text-xs text-destructive">{event.error}</p>
                ) : null}
              </div>
              {event.duration ? (
                <span className="text-xs text-muted-foreground">{event.duration}ms</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}


