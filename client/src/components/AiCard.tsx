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
            <Accordion type="single" collapsible className="w-full">
              {model.parameters.implementation_guides && (
                <AccordionItem value="implementation">
                  <AccordionTrigger className="text-sm">
                    Implementation Guides
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Object.entries(model.parameters.implementation_guides).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-semibold">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {model.parameters.prompt_patterns && (
                <AccordionItem value="patterns">
                  <AccordionTrigger className="text-sm">
                    Prompt Patterns
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-4 space-y-1">
                      {model.parameters.prompt_patterns.map((pattern, index) => (
                        <li key={index} className="text-sm">{pattern}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {model.parameters.memory_types && (
                <AccordionItem value="memory">
                  <AccordionTrigger className="text-sm">
                    Memory Systems
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-4 space-y-1">
                      {model.parameters.memory_types.map((type, index) => (
                        <li key={index} className="text-sm">{type}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
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