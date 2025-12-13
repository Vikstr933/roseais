import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, MessageSquare } from 'lucide-react';
import { ChatBeforeBuildDialog } from './ChatBeforeBuildDialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description too long'),
  projectType: z.enum(['web_app', 'mobile_app', 'api', 'desktop_app']),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (data: any) => void;
  isLoading: boolean;
}

const projectTypes = [
  {
    value: 'web_app',
    label: 'Web Application',
    description: 'React, Vue, or other web frameworks',
    icon: '🌐',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'mobile_app',
    label: 'Mobile Application',
    description: 'React Native, Flutter, or native apps',
    icon: '📱',
    color: 'bg-green-100 text-green-800',
  },
  {
    value: 'api',
    label: 'API Service',
    description: 'REST APIs, GraphQL, or microservices',
    icon: '🔌',
    color: 'bg-purple-100 text-purple-800',
  },
  {
    value: 'desktop_app',
    label: 'Desktop Application',
    description: 'Electron, Tauri, or native desktop apps',
    icon: '💻',
    color: 'bg-orange-100 text-orange-800',
  },
];

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
  isLoading,
}: CreateProjectDialogProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [refinedDescription, setRefinedDescription] = useState<string>('');

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      projectType: 'web_app',
    },
  });

  const handleChatComplete = (description: string) => {
    setRefinedDescription(description);
    form.setValue('description', description);
    setShowChatDialog(false);
  };

  const onSubmit = (values: ProjectFormValues) => {
    onCreateProject({
      ...values,
      description: refinedDescription || values.description,
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

  const selectedProjectType = projectTypes.find(
    type => type.value === selectedType
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Start a new collaborative project with your team. You can invite
            collaborators later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Project Type Selection */}
              <div className="space-y-3">
                <FormLabel>Project Type</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  {projectTypes.map(type => (
                    <div
                      key={type.value}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedType(type.value);
                        form.setValue('projectType', type.value as any);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-sm font-medium">
                          {type.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  ))}
                </div>
                {selectedProjectType && (
                  <Badge className={`text-xs ${selectedProjectType.color}`}>
                    {selectedProjectType.label}
                  </Badge>
                )}
              </div>

              {/* Project Details */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Awesome Project" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Description</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowChatDialog(true);
                          }}
                          className="flex items-center gap-2"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Chat to Refine
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what you're building... (or use Chat to Refine for AI assistance)"
                          className="min-h-[80px]"
                          {...field}
                          value={refinedDescription || field.value}
                          onChange={e => {
                            field.onChange(e);
                            setRefinedDescription(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Project Features Preview */}
            {selectedType && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">Project Features</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Real-time collaboration
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    AI agent integration
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Project chat
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    File versioning
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !selectedType} className="min-w-[120px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <ChatBeforeBuildDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          projectType={form.watch('projectType')}
          initialIdea={form.watch('description')}
          onComplete={handleChatComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
