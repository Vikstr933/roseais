/**
 * ChatPanel - Complete Chap-ZPT Chat panel
 * Composes ChatHeader, ChatMessages, and ChatInput
 * 
 * This is the main chat interface for the playground.
 * Hidden on mobile (shown in bottom sheet), visible on desktop.
 */

import { memo, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import type { AgentStatus, StatusMessage, WorkspaceChatMessage } from '../types';
import type { PromptForm } from '../constants';

interface ChatPanelProps {
  // Chat state
  chatHistory: WorkspaceChatMessage[];
  statusMessages: StatusMessage[];
  agentStatusMap: Map<string, AgentStatus>;
  isLoading: boolean;
  
  // Form
  form: UseFormReturn<PromptForm>;
  onSubmit: (data: PromptForm) => void;
  
  // Actions
  onClearChat: () => void;
  
  // Refs
  chatMessagesRef: RefObject<HTMLDivElement>;
}

export const ChatPanel = memo(function ChatPanel({
  chatHistory,
  statusMessages,
  agentStatusMap,
  isLoading,
  form,
  onSubmit,
  onClearChat,
  chatMessagesRef,
}: ChatPanelProps) {
  return (
    <div className="hidden md:flex w-[32%] min-w-[320px] max-w-[480px] border-r border-border flex-col bg-card text-foreground relative shadow-2xl min-h-0 h-full overflow-hidden">
      <ChatHeader
        agentStatusMap={agentStatusMap}
        statusMessages={statusMessages}
        chatHistoryLength={chatHistory.length}
        onClearChat={onClearChat}
      />
      
      <ChatMessages
        ref={chatMessagesRef}
        chatHistory={chatHistory}
        isLoading={isLoading}
      />
      
      <ChatInput
        form={form}
        isLoading={isLoading}
        onSubmit={onSubmit}
      />
    </div>
  );
});

