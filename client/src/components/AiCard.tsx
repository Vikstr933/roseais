import { motion } from "framer-motion";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Link, Code } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AiCardProps {
  model: {
    name: string;
    creator: string;
    description: string;
    capabilities: string[];
    parameters: {
      implementation_guides?: Record<string, string>;
      prompt_patterns?: string[];
      reasoning_steps?: string[];
      memory_types?: string[];
      code_examples?: Record<string, string>;
    };
    category: string;
    imageUrl?: string;
    documentationUrl?: string;
  };
}

export function AiCard({ model }: AiCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">{model.name}</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{model.creator}</p>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {model.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">{model.description}</p>

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Capabilities:</h4>
            <div className="flex flex-wrap gap-2">
              {model.capabilities.map((capability, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary"
                >
                  {capability}
                </Badge>
              ))}
            </div>
          </div>

          {model.parameters && (
            <div className="space-y-4">
              {model.parameters.implementation_guides && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Implementation Guide</h4>
                  <div className="space-y-2">
                    {Object.entries(model.parameters.implementation_guides).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-semibold">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {model.parameters.code_examples && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Code Examples</h4>
                  <div className="space-y-4">
                    {Object.entries(model.parameters.code_examples).map(([title, code]) => (
                      <div key={title} className="space-y-2">
                        <h5 className="font-medium text-sm">{title}</h5>
                        <pre className="bg-muted p-2 rounded-md overflow-x-auto">
                          <code className="text-xs whitespace-pre-wrap">{code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {model.parameters.prompt_patterns && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Prompt Patterns</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {model.parameters.prompt_patterns.map((pattern, index) => (
                      <li key={index} className="text-sm">{pattern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {model.parameters.memory_types && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Memory Systems</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {model.parameters.memory_types.map((type, index) => (
                      <li key={index} className="text-sm">{type}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {model.documentationUrl && (
            <a
              href={model.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline"
            >
              <Link className="w-4 h-4" />
              Documentation
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}