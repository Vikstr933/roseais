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
import { useMutation } from "@tanstack/react-query";

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
      const res = await fetch("/api/prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          orchestration: data.enableOrchestration,
        }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResponse(data.response);
      if (data.orchestrationPlan) {
        setOrchestrationPlan(data.orchestrationPlan);
      } else {
        setOrchestrationPlan(null);
      }
    },
  });

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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Agent Orchestration
                          </FormLabel>
                          <FormDescription>
                            Coordinate multiple AI agents to handle complex tasks
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="systemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Prompt</FormLabel>
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
                        <FormControl>
                          <Textarea
                            placeholder="Enter your prompt here..."
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
                  <pre className="bg-muted/50 rounded-lg p-4 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(orchestrationPlan, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Response Preview</h3>
                <div className="bg-muted/50 rounded-lg p-4 min-h-[400px] whitespace-pre-wrap">
                  {response || "Response will appear here..."}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}