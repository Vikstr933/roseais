/**
 * ChatHeader - Header for the Elon Chat panel
 * Contains title, agent status, status messages, and clear button
 */

import { memo } from 'react';
import { Brain, Trash2, MessageSquare, Code } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AgentStatusDropdown } from './AgentStatusDropdown';
import { StatusMessagesDropdown } from './StatusMessagesDropdown';
import type { AgentStatus, StatusMessage } from '../types';

interface ChatHeaderProps {
  agentStatusMap: Map<string, AgentStatus>;
  statusMessages: StatusMessage[];
  chatHistoryLength: number;
  onClearChat: () => void;
  isChatMode: boolean;
  onChatModeChange: (enabled: boolean) => void;
}

export const ChatHeader = memo(function ChatHeader({
  agentStatusMap,
  statusMessages,
  chatHistoryLength,
  onClearChat,
  isChatMode,
  onChatModeChange,
}: ChatHeaderProps) {
  return (
    <div className="panel-padding border-b border-border flex-shrink-0 bg-card z-30 shadow-sm">
      <div className="flex items-center justify-between relative">
        <h2 className="text-h4 flex items-center gap-2 text-foreground">
          <Brain className="icon-md text-primary" />
          <span className="font-bold tracking-tight">Elon Chat</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={isChatMode ? "default" : "outline"}
            size="sm"
            onClick={() => onChatModeChange(!isChatMode)}
            className="h-8 px-3 text-xs min-h-[32px] sm:min-h-0"
            title={isChatMode ? "Chat mode: AI will only chat, not generate code" : "Code mode: AI will generate code when needed"}
          >
            {isChatMode ? (
              <>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Chat Mode
              </>
            ) : (
              <>
                <Code className="h-3.5 w-3.5 mr-1.5" />
                Code Mode
              </>
            )}
          </Button>
          <AgentStatusDropdown agentStatusMap={agentStatusMap} />
          <StatusMessagesDropdown statusMessages={statusMessages} />
          {chatHistoryLength > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[32px] sm:min-h-0"
              title="Clear chat history"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
