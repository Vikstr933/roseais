import { motion } from "framer-motion";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, HelpCircle, Eye, Code } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const promptFormSchema = z.object({
  systemPrompt: z.string().min(1, "System prompt is required"),
  userPrompt: z.string().min(1, "User prompt is required"),
  model: z.string().min(1, "Model selection is required"),
  temperature: z.number().min(0).max(1),
  enableOrchestration: z.boolean().default(false),
});

type PromptForm = z.infer<typeof promptFormSchema>;

export default function PromptPlayground() {
  const [response, setResponse] = useState<string>("");
  const [orchestrationPlan, setOrchestrationPlan] = useState<any>(null);
  const [error, setError] = useState<{ message: string; suggestion: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<PromptForm>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      systemPrompt: "You are a helpful AI assistant.",
      userPrompt: "",
      model: "claude-3",
      temperature: 0.7,
      enableOrchestration: false,
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: PromptForm) => {
      setError(null);
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          orchestration: data.enableOrchestration,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResponse(data.response);
      if (data.orchestrationPlan) {
        setOrchestrationPlan(data.orchestrationPlan);
        toast({
          title: "Orchestration Plan Generated",
          description: "Task has been broken down and assigned to specialized agents.",
        });
      } else {
        setOrchestrationPlan(null);
      }
    },
    onError: (error) => {
      try {
        const errorData = JSON.parse(error.message);
        setError({
          message: errorData.error,
          suggestion: errorData.suggestion
        });
      } catch {
        setError({
          message: "An unexpected error occurred",
          suggestion: "Please try again later"
        });
      }
      setResponse("");
      setOrchestrationPlan(null);
    },
  });

  // Function to safely render HTML content
  const createMarkup = (html: string) => {
    return { __html: html };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          Prompt Engineering Playground
        </h1>
        <p className="text-muted-foreground mt-2">
          Experiment with different prompts and see how they affect AI responses
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="h-full">
            <CardContent className="pt-6">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{error.message}</AlertTitle>
                  <AlertDescription>{error.suggestion}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) =>
                    generateMutation.mutate(data)
                  )}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="enableOrchestration"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <FormLabel className="text-base">
                                Enable Agent Orchestration
                              </FormLabel>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">
                                      When enabled, your task will be divided into subtasks and handled by multiple specialized AI agents working together.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="space-y-2">
                              <FormDescription>
                                Break down complex tasks into manageable subtasks, each handled by specialized AI agents.
                              </FormDescription>
                              <div className="text-sm text-muted-foreground">
                                Perfect for tasks like:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                  <li>Research and analysis requiring multiple perspectives</li>
                                  <li>Creative projects needing different expertise</li>
                                  <li>Problem-solving requiring step-by-step reasoning</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (checked) {
                                  form.setValue("systemPrompt",
                                    "You are a collaborative AI assistant capable of breaking down complex tasks and coordinating with other specialized agents. Analyze tasks thoroughly and create detailed plans for execution."
                                  );
                                }
                              }}
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="systemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Prompt</FormLabel>
                        <FormDescription>
                          Define the AI's role and behavior. {form.watch("enableOrchestration") &&
                            "With orchestration enabled, this sets the context for how agents should collaborate."}
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Enter system instructions..."
                            className="min-h-[100px] resize-none"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="userPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Prompt</FormLabel>
                        <FormDescription>
                          {form.watch("enableOrchestration")
                            ? "Describe your complex task. The system will break it down and assign specialized agents."
                            : "Enter your prompt or question here."
                          }
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder={form.watch("enableOrchestration")
                              ? "Example: Create a modern landing page for a SaaS product with hero section, features, and pricing."
                              : "Enter your prompt here..."
                            }
                            className="min-h-[150px] resize-none"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormDescription>
                            Select the AI model to use
                          </FormDescription>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="claude-3">Claude 3</SelectItem>
                              <SelectItem value="deepseek">DeepSeek</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="temperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperature</FormLabel>
                          <FormDescription>
                            Controls response randomness (0 = focused, 1 = creative)
                          </FormDescription>
                          <FormControl>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              className="w-full"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? "Generating..." : "Generate"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="space-y-6">
            {orchestrationPlan && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Orchestration Plan</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      This plan shows how your task has been broken down and distributed among specialized AI agents:
                    </p>
                    <pre className="overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(orchestrationPlan, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Response Preview</h3>
                <Tabs defaultValue="raw">
                  <TabsList className="mb-4">
                    <TabsTrigger value="raw" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Raw
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="raw">
                    <div className="bg-muted/50 rounded-lg p-4 min-h-[400px] whitespace-pre-wrap">
                      {response || "Response will appear here..."}
                    </div>
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="bg-white rounded-lg min-h-[400px] border">
                      {response ? (
                        <div
                          className="w-full h-full"
                          dangerouslySetInnerHTML={createMarkup(response)}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                          Preview will appear here...
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}