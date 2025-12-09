/**
 * ChatMessages - Scrollable chat message list
 * Displays conversation history and loading state
 */

import { memo, forwardRef } from 'react';
import { Brain } from 'lucide-react';
import { ChatMessage } from '../../../components/ChatMessage';
import type { WorkspaceChatMessage } from '../types';

interface ChatMessagesProps {
  chatHistory: WorkspaceChatMessage[];
  isLoading: boolean;
}

export const ChatMessages = memo(
  forwardRef<HTMLDivElement, ChatMessagesProps>(function ChatMessages(
    { chatHistory, isLoading },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto panel-padding min-h-0 relative bg-background/60"
      >
        <div className="item-gap">
          {/* Empty state */}
          {chatHistory.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/70 p-4 text-muted-foreground">
              Start by describing what you want to build. Chap-ZPT will stage the
              files and keep the conversation inside this chat.
            </div>
          )}

          {/* Message list */}
          {chatHistory.map((message, index) => (
            <div key={index} className="transition-smooth">
              <ChatMessage
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                errors={message.errors}
                warnings={message.warnings}
                errorSummary={message.errorSummary}
                browserAnalysis={message.browserAnalysis}
              />
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4 transition-smooth">
              <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-lg hover-lift">
                <Brain className="icon-sm text-white pulse-brand" />
              </div>

              <div className="rounded-lg px-4 py-3 bg-muted max-w-[80%] flex-1 border border-border transition-smooth hover:shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-body">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-foreground font-medium">
                      I'll get started on your app right away! 🚀
                    </span>
                  </div>
                  <p className="text-body-sm text-muted-foreground">
                    Watch the Editor tab light up as code appears!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })
);

