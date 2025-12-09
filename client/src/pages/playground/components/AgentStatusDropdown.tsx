/**
 * AgentStatusDropdown - Displays current agent statuses in a collapsible dropdown
 * Extracted from PromptPlayground ChatPanel for better maintainability
 */

import { memo } from 'react';
import { Brain } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import { AGENT_STATUS_CONFIG } from '../constants';
import { formatAgentName, formatDuration, formatTokenCount } from '../utils';
import type { AgentStatus } from '../types';

interface AgentStatusDropdownProps {
  agentStatusMap: Map<string, AgentStatus>;
}

export const AgentStatusDropdown = memo(function AgentStatusDropdown({
  agentStatusMap,
}: AgentStatusDropdownProps) {
  if (agentStatusMap.size === 0) {
    return null;
  }

  const activeCount = Array.from(agentStatusMap.values()).filter(
    (a) => a.status === 'running'
  ).length;

  return (
    <div className="relative">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[32px] sm:min-h-0"
            title={`${activeCount} active agent(s)`}
          >
            <Brain className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{activeCount} active</span>
            <span className="sm:hidden">{activeCount}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-b-lg shadow-lg max-h-[400px] overflow-y-auto">
          <div className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Agent Status
            </div>
            {Array.from(agentStatusMap.entries()).map(([agentId, status]) => {
              const agentName = formatAgentName(agentId);
              const statusConfig = AGENT_STATUS_CONFIG[status.status];

              return (
                <div
                  key={agentId}
                  className="text-xs p-2 rounded border border-border bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{agentName}</span>
                    <span className={`${statusConfig.color} flex items-center gap-1`}>
                      <span>{statusConfig.icon}</span>
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>
                  {status.currentMessage && (
                    <div className="text-muted-foreground text-[10px] mt-1">
                      {status.currentMessage}
                    </div>
                  )}
                  {status.tokenUsage && (
                    <div className="text-muted-foreground text-[10px] mt-1">
                      Tokens: {formatTokenCount(status.tokenUsage.total)} (
                      {formatTokenCount(status.tokenUsage.input)} in +{' '}
                      {formatTokenCount(status.tokenUsage.output)} out)
                    </div>
                  )}
                  {status.startTime && status.endTime && (
                    <div className="text-muted-foreground text-[10px] mt-1">
                      Duration: {formatDuration(status.endTime - status.startTime)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

