import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Copy, Check } from 'lucide-react';

const joinFormSchema = z.object({
  inviteCode: z
    .string()
    .min(1, 'Invite code is required')
    .max(20, 'Invalid invite code'),
});

type JoinFormValues = z.infer<typeof joinFormSchema>;

interface JoinProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinProject: (inviteCode: string) => void;
  isLoading: boolean;
}

export function JoinProjectDialog({
  open,
  onOpenChange,
  onJoinProject,
  isLoading,
}: JoinProjectDialogProps) {
  const [copied, setCopied] = useState(false);

  const form = useForm<JoinFormValues>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: {
      inviteCode: '',
    },
  });

  const onSubmit = (values: JoinFormValues) => {
    onJoinProject(values.inviteCode.toUpperCase());
  };

  const generateSampleCode = () => {
    const sampleCode = 'ABC12345';
    form.setValue('inviteCode', sampleCode);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Project
          </DialogTitle>
          <DialogDescription>
            Enter the invite code shared by your team member to join their
            project.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invite Code</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter invite code (e.g., ABC12345)"
                        className="uppercase"
                        {...field}
                        onChange={e =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(field.value)}
                        disabled={!field.value}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Help Section */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-semibold mb-2">
                How to get an invite code?
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Ask your team member to share the project's invite code</p>
                <p>• The code is usually 8 characters long (e.g., ABC12345)</p>
                <p>• You can find it in the project settings or team section</p>
              </div>
            </div>

            {/* Sample Code for Demo */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Demo: Try with sample code
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Click to use a sample invite code for testing
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSampleCode}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Use Sample
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Joining...' : 'Join Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
