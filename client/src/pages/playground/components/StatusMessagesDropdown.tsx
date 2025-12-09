/**
 * StatusMessagesDropdown - Displays generation status messages in a collapsible dropdown
 * Extracted from PromptPlayground ChatPanel for better maintainability
 */

import { memo } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import type { StatusMessage } from '../types';

interface StatusMessagesDropdownProps {
  statusMessages: StatusMessage[];
}

export const StatusMessagesDropdown = memo(function StatusMessagesDropdown({
  statusMessages,
}: StatusMessagesDropdownProps) {
  if (statusMessages.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[32px] sm:min-h-0"
            title={`${statusMessages.length} status updates`}
          >
            <Activity className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{statusMessages.length}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-b-lg shadow-lg max-h-[300px] overflow-y-auto">
          <div className="p-2 space-y-1">
            {statusMessages
              .slice()
              .reverse()
              .map((msg) => (
                <div
                  key={msg.id}
                  className="text-xs text-muted-foreground p-2 rounded hover:bg-muted"
                >
                  {msg.content}
                </div>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

