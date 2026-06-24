/**
 * ChatInput - Input form for sending messages to Elon
 * Supports Enter to send, Shift+Enter for new line
 */

import { memo } from 'react';
import { Send } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from '../../../components/ui/form';
import type { PromptForm } from '../constants';

interface ChatInputProps {
  form: UseFormReturn<PromptForm>;
  isLoading: boolean;
  onSubmit: (data: PromptForm) => void;
}

export const ChatInput = memo(function ChatInput({
  form,
  isLoading,
  onSubmit,
}: ChatInputProps) {
  return (
    <div className="panel-padding border-t border-border flex-shrink-0 bg-card relative z-20">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="tight-gap"
        >
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
                      className="w-full min-h-[44px] md:min-h-[48px] max-h-[120px] px-4 py-3 pr-12 text-base md:text-body rounded-lg border border-input bg-background resize-none focus-ring transition-smooth"
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
                      className="absolute bottom-2 md:bottom-3 right-2 md:right-3 h-10 w-10 md:h-9 md:w-9 p-0 btn-primary rounded-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] md:min-h-0"
                    >
                      {isLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
                        <Send className="icon-sm" />
                      )}
                    </Button>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
          <p className="text-caption">
            Press{' '}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">
              Enter
            </kbd>{' '}
            to send,{' '}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">
              Shift+Enter
            </kbd>{' '}
            for new line
          </p>
        </form>
      </Form>
    </div>
  );
});
