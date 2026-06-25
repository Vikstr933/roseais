import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
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

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100, 'Name too long'),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface CreateProjectPayload {
  name: string;
  description: string;
  projectType: 'web_app';
  agentConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  testCases: unknown[];
  settings: {
    autoSave: boolean;
    notifications: boolean;
    theme: 'dark';
  };
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (data: CreateProjectPayload) => void;
  isLoading: boolean;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
  isLoading,
}: CreateProjectDialogProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (values: ProjectFormValues) => {
    onCreateProject({
      name: values.name.trim(),
      description: '',
      projectType: 'web_app',
      agentConfig: {
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.7,
        maxTokens: 16000,
      },
      testCases: [],
      settings: {
        autoSave: true,
        notifications: true,
        theme: 'dark',
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create Web App</DialogTitle>
          <DialogDescription>
            Name the project. You will describe what to build in the playground chat next.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Klippoteket" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="min-w-[120px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
