import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Brain, Search, Code, FileText, CheckCircle, Loader2, Palette, Box, User, Cpu, Zap, Sparkles } from 'lucide-react';

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

// Map agent IDs to icons and colors (updated to match current 8-agent system)
const getAgentIcon = (agentId: string) => {
  const iconMap: Record<string, any> = {
    'personal-assistant': User,
    'requirements-agent': Search,
    'component-architect': Box,
    'ui-designer': Palette,
    'style-generator': Sparkles,
    'code-generator': Code,
    'completion-agent': CheckCircle,
    'orchestration': Zap
  };
  return iconMap[agentId] || Cpu;
};

const getAgentColor = (agentId: string): string => {
  const colorMap: Record<string, string> = {
    'personal-assistant': 'from-indigo-500 to-indigo-600',
    'requirements-agent': 'from-blue-500 to-blue-600',
    'component-architect': 'from-purple-500 to-purple-600',
    'ui-designer': 'from-pink-500 to-pink-600',
    'style-generator': 'from-cyan-500 to-cyan-600',
    'code-generator': 'from-green-500 to-green-600',
    'completion-agent': 'from-emerald-500 to-emerald-600',
    'orchestration': 'from-amber-500 to-amber-600'
  };
  return colorMap[agentId] || 'from-gray-500 to-gray-600';
};

// Fallback default agents when API fetch fails
const getDefaultAgents = (): AgentConfig[] => {
  return [
    {
      id: 'component-architect',
      name: 'Component Architect',
      task: 'Planning architecture',
      icon: getAgentIcon('component-architect'),
      color: getAgentColor('component-architect'),
      angle: 0
    },
    {
      id: 'ui-designer',
      name: 'UI Designer',
      task: 'Designing interface',
      icon: getAgentIcon('ui-designer'),
      color: getAgentColor('ui-designer'),
      angle: 90
    },
    {
      id: 'code-generator',
      name: 'Component Developer',
      task: 'Writing code',
      icon: getAgentIcon('code-generator'),
      color: getAgentColor('code-generator'),
      angle: 180
    },
    {
      id: 'completion-agent',
      name: 'Completion Agent',
      task: 'Finalizing',
      icon: getAgentIcon('completion-agent'),
      color: getAgentColor('completion-agent'),
      angle: 270
    }
  ];
};

interface CircularAgentVisualizationProps {
  agentStatusMap: Map<string, AgentStatus>;
  isRunning: boolean;
}

export const CircularAgentVisualization: React.FC<CircularAgentVisualizationProps> = ({
  agentStatusMap,
  isRunning
}) => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Fetch agents from database
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await apiFetch('/api/agents', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
          }
        });

        if (response.ok) {
          const data = await response.json();

          // Filter out personal-assistant (not part of orchestration)
          // and create AgentConfig for each
          const agentConfigs: AgentConfig[] = data
            .filter((agent: any) => agent.id !== 'personal-assistant')
            .map((agent: any, index: number) => ({
              id: agent.id,
              icon: getAgentIcon(agent.id),
              angle: (360 / (data.length - 1)) * index, // Distribute evenly
              name: agent.name,
              task: agent.description || agent.role || 'Processing...',
              color: getAgentColor(agent.id)
            }));

          setAgents(agentConfigs);
          console.log('✅ Loaded agents for visualization:', agentConfigs);
        } else {
          console.warn('Failed to fetch agents, using fallback defaults');
          // Fallback to default agents
          setAgents(getDefaultAgents());
        }
      } catch (error) {
        console.warn('Error fetching agents, using fallback defaults:', error);
        setAgents(getDefaultAgents());
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Count completed agents for progress animation (only count agents that have status)
  const selectedAgentsCount = agentStatusMap.size;
  const completedCount = Array.from(agentStatusMap.values()).filter(s => s.status === 'completed').length;
  const targetProgress = selectedAgentsCount > 0 ? (completedCount / selectedAgentsCount) * 100 : 0;

  // Smooth progress animation - MUST be before early return to avoid conditional hooks
  useEffect(() => {
    if (targetProgress === 0) {
      setAnimatedProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setAnimatedProgress(prev => {
        // Increment by 1% at a time for smooth animation
        if (prev < targetProgress) {
          return Math.min(prev + 1, targetProgress);
        }
        // Clear interval when target is reached
        if (prev >= targetProgress) {
          clearInterval(interval);
        }
        return prev;
      });
    }, 30); // Update every 30ms for smooth visual effect

    return () => clearInterval(interval);
  }, [targetProgress]); // Remove animatedProgress from dependencies to prevent infinite loop

  // Use fallback agents immediately while loading to avoid blank screen
  // This ensures the visualization shows up instantly without a loading spinner

  // Use fetched agents or fallback if still loading
  const agentsToDisplay = loading || agents.length === 0 ? getDefaultAgents() : agents;

  const activeAgentConfigs = agentsToDisplay.map((agent, index) => ({
    ...agent,
    angle: (360 / agentsToDisplay.length) * index // Distribute evenly based on actual count
  }));

  const getPosition = (angle: number, radius = 200) => { // Reduced radius for better fit
    const radian = (angle - 90) * (Math.PI / 180);
    return {
      x: Math.cos(radian) * radius,
      y: Math.sin(radian) * radius
    };
  };

  return (
    <div className="relative w-full h-full min-h-[400px] max-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-pink-500/5 animate-pulse" />
      )}

      {/* Connection Lines with animated gradient */}
      <svg className="absolute inset-0 w-full h-full" viewBox="-300 -300 600 600" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Gradient for active lines */}
          <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.4" />
          </linearGradient>

          {/* Gradient for completed lines */}
          <linearGradient id="completeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
          </linearGradient>

          {/* Lightning gradient - electric blue to white */}
          <radialGradient id="lightningGradient">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.7" />
          </radialGradient>

          {/* Glow filter for lightning */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g>
          {activeAgentConfigs.map(agent => {
            const pos = getPosition(agent.angle);
            const status = agentStatusMap.get(agent.id);
            const isActive = status?.status === 'running';
            const isComplete = status?.status === 'completed';

            return (
              <React.Fragment key={agent.id}>
                {/* Connection line - Keep visible once workflow starts */}
                <line
                  x1="0"
                  y1="0"
                  x2={pos.x}
                  y2={pos.y}
                  stroke={isComplete ? 'url(#completeGradient)' : isActive ? 'url(#activeGradient)' : '#334155'}
                  strokeWidth={isActive ? "3" : "2"}
                  className="transition-all duration-700"
                  opacity={isComplete ? 1 : isActive ? 0.8 : (status ? 0.5 : 0.3)}
                />

                {/* Lightning charge animation when active */}
                {isActive && (
                  <>
                    {/* Main lightning bolt */}
                    <circle
                      r="6"
                      fill="url(#lightningGradient)"
                      opacity="0.9"
                      filter="url(#glow)"
                    >
                      <animateMotion
                        dur="0.8s"
                        repeatCount="indefinite"
                        path={`M 0,0 L ${pos.x},${pos.y}`}
                      />
                    </circle>

                    {/* Trail effect */}
                    <circle
                      r="4"
                      fill="#8b5cf6"
                      opacity="0.6"
                    >
                      <animateMotion
                        dur="0.8s"
                        repeatCount="indefinite"
                        begin="0.1s"
                        path={`M 0,0 L ${pos.x},${pos.y}`}
                      />
                    </circle>

                    {/* Sparkle trail */}
                    <circle
                      r="2"
                      fill="#fff"
                      opacity="0.8"
                    >
                      <animateMotion
                        dur="0.8s"
                        repeatCount="indefinite"
                        begin="0.2s"
                        path={`M 0,0 L ${pos.x},${pos.y}`}
                      />
                    </circle>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </g>
      </svg>

      {/* Central Orchestrator */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`
          relative w-28 h-28
          transition-all duration-500
          ${isRunning ? 'scale-110' : 'scale-100'}
        `}>
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="#1e293b"
              strokeWidth="4"
            />
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - animatedProgress / 100)}`}
              className="transition-all duration-500 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>

          {/* Main circle with glow */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-violet-500/50">
            <Brain className={`w-12 h-12 text-white ${isRunning ? 'animate-pulse' : ''}`} />
          </div>

          {/* Rotating glow rings when active */}
          {isRunning && (
            <>
              <div className="absolute inset-0 rounded-full bg-violet-500 opacity-20 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-purple-500 opacity-10 animate-ping animation-delay-500" />
              <div className="absolute inset-0 rounded-full border-4 border-violet-400 opacity-30 animate-spin-slow" />
            </>
          )}

          {/* Completion sparkle effect */}
          {animatedProgress === 100 && !isRunning && (
            <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-pulse" />
          )}

          {/* Label */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <div className="text-sm font-semibold text-foreground">Orchestrator</div>
            <div className="text-xs text-muted-foreground text-center">
              {isRunning ? (
                animatedProgress === 100 ? (
                  <span className="text-blue-400 animate-pulse">📝 Generating files...</span>
                ) : (
                  <span className="text-violet-400">{Math.round(animatedProgress)}% Complete</span>
                )
              ) : animatedProgress === 100 ? (
                <span className="text-green-400">✓ Done</span>
              ) : (
                <span>Idle</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agents - Show all 6 agents, highlight only active ones */}
      {activeAgentConfigs.map((agent, index) => {
        const pos = getPosition(agent.angle);
        const status = agentStatusMap.get(agent.id);
        const isSelected = agentStatusMap.has(agent.id); // Is this agent selected for current workflow?
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
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              opacity: 1
            }}
          >
            {/* Agent Circle with enhanced effects */}
            <div className={`
              relative w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-500
              ${!isSelected
                ? 'bg-slate-800/40 scale-85 opacity-30' // Not selected for this workflow
                : isComplete
                  ? `bg-gradient-to-br ${agent.color} scale-100 shadow-xl shadow-green-500/30`
                  : isActive
                    ? `bg-gradient-to-br ${agent.color} opacity-90 scale-115 shadow-2xl shadow-violet-500/50 animate-electric-glow`
                    : isPending
                      ? 'bg-slate-700 scale-90 shadow-md'
                      : isFailed
                        ? 'bg-gradient-to-br from-red-600 to-red-700 scale-90 shadow-lg shadow-red-500/30'
                        : 'bg-slate-800 scale-85 opacity-50'
              }
            `}>
              {/* Icon or status indicator */}
              {isActive ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isComplete ? (
                <CheckCircle className="w-10 h-10 text-white animate-bounce-once" />
              ) : isFailed ? (
                <div className="text-white text-2xl animate-shake">✕</div>
              ) : (
                <Icon className={`w-10 h-10 transition-all duration-500 ${
                  isComplete || isActive ? 'text-white' : 'text-slate-500'
                }`} />
              )}

              {/* Active pulsing rings with rotation */}
              {isActive && (
                <>
                  <div className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping" />
                  <div className="absolute inset-0 rounded-full bg-white opacity-10 animate-ping animation-delay-300" />
                  <div className="absolute inset-0 rounded-full border-2 border-white opacity-30 animate-spin-slow" />
                </>
              )}

              {/* Completion glow */}
              {isComplete && (
                <div className="absolute inset-0 rounded-full bg-green-400 opacity-20 animate-pulse" />
              )}

              {/* Status dot */}
              <div className={`
                absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-background
                transition-all duration-300
                ${isComplete ? 'bg-green-500 shadow-lg shadow-green-500/50' : isActive ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' : isPending ? 'bg-yellow-500' : isFailed ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-slate-600'}
              `} />
            </div>

            {/* Agent Info */}
            <div className={`
              mt-3 text-center transition-all duration-500 w-32
              ${isActive || isComplete || isFailed ? 'opacity-100' : 'opacity-60'}
            `}>
              {/* Name */}
              <div className={`
                font-semibold text-sm
                ${isComplete ? 'text-green-400' : isActive ? 'text-foreground' : isFailed ? 'text-red-400' : 'text-muted-foreground'}
              `}>
                {agent.name}
              </div>

              {/* Live progress message or task description - show when active */}
              {isActive && (
                <div className="text-muted-foreground text-xs mt-1 animate-pulse">
                  {status?.currentMessage || agent.task}
                </div>
              )}

              {/* Duration - show when complete */}
              {isComplete && status?.duration && (
                <div className="text-muted-foreground text-xs mt-1 flex items-center justify-center gap-1">
                  <span className="text-green-400">✓</span>
                  {(status.duration / 1000).toFixed(1)}s
                </div>
              )}

              {/* Error - show when failed */}
              {isFailed && status?.error && (
                <div className="text-red-400 text-xs mt-1 truncate" title={status.error}>
                  {status.error}
                </div>
              )}

              {/* Pending indicator */}
              {isPending && !isActive && (
                <div className="text-muted-foreground text-xs mt-1">
                  Waiting...
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Add CSS for custom animations
if (!document.getElementById('agent-viz-styles')) {
  const style = document.createElement('style');
  style.id = 'agent-viz-styles';
  style.textContent = `
    .animation-delay-300 {
      animation-delay: 300ms;
    }
    .animation-delay-500 {
      animation-delay: 500ms;
    }

    @keyframes spin-slow {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .animate-spin-slow {
      animation: spin-slow 3s linear infinite;
    }

    @keyframes bounce-once {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }

    .animate-bounce-once {
      animation: bounce-once 0.6s ease-out;
    }

    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      25% {
        transform: translateX(-5px);
      }
      75% {
        transform: translateX(5px);
      }
    }

    .animate-shake {
      animation: shake 0.5s ease-in-out;
    }

    @keyframes electric-glow {
      0%, 100% {
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.5),
                    0 0 40px rgba(139, 92, 246, 0.3),
                    0 0 60px rgba(139, 92, 246, 0.1);
      }
      50% {
        box-shadow: 0 0 30px rgba(96, 165, 250, 0.8),
                    0 0 60px rgba(96, 165, 250, 0.5),
                    0 0 90px rgba(96, 165, 250, 0.3),
                    0 0 120px rgba(59, 130, 246, 0.2);
      }
    }

    .animate-electric-glow {
      animation: electric-glow 1.5s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}
