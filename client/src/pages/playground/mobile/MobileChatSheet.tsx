import { Brain, Trash2, X, Send } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../../components/ui/sheet";
import { Form, FormControl, FormField, FormItem } from "../../../components/ui/form";
import { ChatMessage } from "../../../components/ChatMessage";
import type { UseFormReturn } from "react-hook-form";
import type { PromptForm } from "../constants";

interface MobileChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatHistory: any[];
  isLoading: boolean;
  form: UseFormReturn<PromptForm>;
  onSubmit: (data: PromptForm) => void;
  clearChat: () => void;
}

export function MobileChatSheet({
  open,
  onOpenChange,
  chatHistory,
  isLoading,
  form,
  onSubmit,
  clearChat,
}: MobileChatSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col [&>button]:hidden">
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-bold">Chap-ZPT Chat</span>
            </SheetTitle>
            <div className="flex items-center gap-2">
              {chatHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-8 px-2 text-xs"
                  title="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          <div className="space-y-4">
            {chatHistory.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/70 p-4 text-muted-foreground">
                Start by describing what you want to build. Chap-ZPT will stage the files and keep
                the conversation inside this chat.
              </div>
            )}
            {chatHistory.map((message, index) => (
              <div key={index}>
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
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Brain className="h-5 w-5 text-white animate-pulse" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-muted max-w-[80%] flex-1 border border-border">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      <span className="font-medium">I'll get started on your app right away! 🚀</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Watch the Editor tab light up as code appears!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="userPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <textarea
                          {...field}
                          placeholder="Describe your app or request changes..."
                          className="w-full min-h-[44px] max-h-[120px] px-4 py-3 pr-12 text-base rounded-lg border border-input bg-background resize-none focus-ring"
                          disabled={isLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />
                        <Button
                          type="submit"
                          disabled={isLoading || !field.value?.trim()}
                          size="sm"
                          className="absolute bottom-2 right-2 h-10 w-10 p-0 btn-primary rounded-lg disabled:opacity-50"
                        >
                          {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">Enter</kbd> to send
              </p>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

