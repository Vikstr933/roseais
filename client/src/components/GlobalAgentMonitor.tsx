import React, { useState, useEffect } from 'react';
import { Brain, Search, Code, Database, FileText, MessageSquare, TrendingUp, CheckCircle, Loader2, Minimize2, Maximize2, X } from 'lucide-react';

interface AgentStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

interface AgentConfig {
  id: string;
  icon: any;
  angle: number;
  name: string;
  task: string;
  color: string;
}

const agentConfigs: AgentConfig[] = [
  { id: 'requirements-analyst', icon: Search, angle: 0, name: 'Requirements', task: 'Analyzing user requirements', color: 'from-blue-500 to-cyan-500' },
  { id: 'ui-designer', icon: FileText, angle: 60, name: 'UI Designer', task: 'Designing user interface', color: 'from-purple-500 to-pink-500' },
  { id: 'component-architect', icon: Code, angle: 120, name: 'Architect', task: 'Planning architecture', color: 'from-green-500 to-emerald-500' },
  { id: 'style-generator', icon: TrendingUp, angle: 180, name: 'Styling', task: 'Generating styles', color: 'from-orange-500 to-red-500' },
  { id: 'code-generator', icon: Code, angle: 240, name: 'Code Gen', task: 'Writing code', color: 'from-violet-500 to-purple-500' },
  { id: 'completion', icon: CheckCircle, angle: 300, name: 'QA', task: 'Verifying completion', color: 'from-teal-500 to-cyan-500' }
];

export const GlobalAgentMonitor: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [agentStatusMap, setAgentStatusMap] = useState<Map<string, AgentStatus>>(new Map());
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE for agent activity
    const es = new EventSource('/api/sse/agent-activity');

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Agent Monitor received event:', data);

        switch (data.type) {
          case 'connected':
            console.log('Connected to agent activity stream');
            break;

          case 'orchestration:start':
            setIsVisible(true);
            setWorkflowId(data.workflowId);
            // Initialize all agents as pending from the start
            const initialAgents = new Map();
            agentConfigs.forEach(agent => {
              initialAgents.set(agent.id, {
                id: agent.id,
                status: 'pending' as const,
              });
            });
            setAgentStatusMap(initialAgents);
            setCurrentPhase(0);
            break;

          case 'phase:start':
            setCurrentPhase(data.phase);
            // Mark all agents in this phase as pending
            if (data.agentsInPhase) {
              setAgentStatusMap(prev => {
                const next = new Map(prev);
                data.agentsInPhase.forEach((agentId: string) => {
                  next.set(agentId, {
                    id: agentId,
                    status: 'pending',
                  });
                });
                return next;
              });
            }
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
              next.set(data.agentId!, {
                id: data.agentId!,
                status: 'failed',
                error: data.error,
              });
              return next;
            });
            break;

          case 'orchestration:complete':
          case 'orchestration:error':
            // Keep visible for 3 seconds after completion
            setTimeout(() => {
              setIsVisible(false);
              setWorkflowId(null);
              setAgentStatusMap(new Map());
            }, 3000);
            break;
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    });

    es.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    setEventSource(es);

    return () => {
      es.close();
    };
  }, []);

  const getPosition = (angle: number, radius = 140) => {
    const radian = (angle - 90) * (Math.PI / 180);
    return {
      x: Math.cos(radian) * radius,
      y: Math.sin(radian) * radius
    };
  };

  if (!isVisible) return null;

  return (
    <div className={`
      fixed z-50 transition-all duration-300
      ${isMinimized
        ? 'bottom-4 right-4 w-20 h-20'
        : 'bottom-4 right-4 w-[500px] h-[550px]'
      }
    `}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-white animate-pulse" />
            <span className="text-white font-semibold text-sm">
              {isMinimized ? '' : 'Agent Workflow'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isMinimized && (
              <button
                onClick={() => setIsMinimized(true)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
            {isMinimized && (
              <button
                onClick={() => setIsMinimized(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 p-6 overflow-auto">
            {/* Visualization */}
            <div className="relative h-[400px] flex items-center justify-center">

              {/* Connection Lines */}
              <svg className="absolute inset-0 w-full h-full">
                <g transform="translate(50%, 50%)">
                  {agentConfigs.map(agent => {
                    const pos = getPosition(agent.angle);
                    const status = agentStatusMap.get(agent.id);
                    const isActive = status?.status === 'running';
                    const isComplete = status?.status === 'completed';

                    return (
                      <line
                        key={agent.id}
                        x1="0"
                        y1="0"
                        x2={pos.x}
                        y2={pos.y}
                        stroke={isComplete ? '#8b5cf6' : isActive ? '#a78bfa' : '#1e293b'}
                        strokeWidth="2"
                        className="transition-all duration-700"
                        opacity={isComplete ? 0.8 : isActive ? 0.6 : 0.2}
                      />
                    );
                  })}
                </g>
              </svg>

              {/* Central Orchestrator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center animate-pulse">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full bg-violet-500 opacity-20 animate-ping" />
                </div>
              </div>

              {/* Agents */}
              {agentConfigs.map(agent => {
                const pos = getPosition(agent.angle);
                const status = agentStatusMap.get(agent.id);
                const isActive = status?.status === 'running';
                const isComplete = status?.status === 'completed';
                const isFailed = status?.status === 'failed';
                const isPending = status?.status === 'pending';
                const Icon = agent.icon;

                return (
                  <div
                    key={agent.id}
                    className="absolute top-1/2 left-1/2 flex flex-col items-center"
                    style={{
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
                    }}
                  >
                    {/* Agent Circle */}
                    <div className={`
                      relative w-14 h-14 rounded-full flex items-center justify-center
                      transition-all duration-500
                      ${isComplete
                        ? `bg-gradient-to-br ${agent.color} scale-100`
                        : isActive
                          ? `bg-gradient-to-br ${agent.color} opacity-75 scale-110`
                          : isPending
                            ? 'bg-slate-700 scale-90'
                            : isFailed
                              ? 'bg-red-600 scale-90'
                              : 'bg-slate-800 scale-85 opacity-50'
                      }
                    `}>
                      {isActive ? (
                        <Loader2 className="w-7 h-7 text-white animate-spin" />
                      ) : isComplete ? (
                        <CheckCircle className="w-7 h-7 text-white" />
                      ) : (
                        <Icon className={`w-7 h-7 transition-colors duration-500 ${
                          isComplete || isActive ? 'text-white' : 'text-slate-500'
                        }`} />
                      )}

                      {/* Active pulsing ring */}
                      {isActive && (
                        <div className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping" />
                      )}
                    </div>

                    {/* Agent Name (always show, but dim if inactive) */}
                    <div className={`
                      mt-2 text-center transition-all duration-500 w-28
                      ${isActive || isComplete ? 'opacity-100' : 'opacity-40'}
                    `}>
                      <div className={`
                        text-xs font-medium
                        ${isComplete ? 'text-green-400' : isActive ? 'text-white' : isFailed ? 'text-red-400' : 'text-slate-400'}
                      `}>
                        {agent.name}
                      </div>

                      {/* Task description - only show when active */}
                      {isActive && (
                        <div className="text-slate-400 text-[10px] mt-0.5 animate-pulse">
                          {agent.task}
                        </div>
                      )}

                      {/* Duration - show when complete */}
                      {isComplete && status?.duration && (
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          {(status.duration / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
