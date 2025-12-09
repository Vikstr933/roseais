import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Link, Code } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AiCardProps {
  model: {
    id: string;
    name: string;
    provider: string;

    description: string;
    contextWindow?: number;
    maxTokens?: number;
    releaseDate: string;
    strengths?: string[];
    category?: string;
    imageUrl?: string;
    documentationUrl?: string;
  };
}

export function AiCard({ model }: AiCardProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="h-full">
      <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">{model.name}</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{model.provider}</p>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {model.category || 'AI Model'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">{model.description}</p>

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Key Features:</h4>
            <div className="flex flex-wrap gap-2">
              {(model.strengths || []).map((strength, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary"
                >
                  {strength}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {model.contextWindow && (
              <div>
                <p className="text-xs text-muted-foreground">Context Window</p>
                <p className="text-sm font-medium">
                  {model.contextWindow.toLocaleString()} tokens
                </p>
              </div>
            )}
            {model.maxTokens && (
              <div>
                <p className="text-xs text-muted-foreground">Max Output</p>
                <p className="text-sm font-medium">
                  {model.maxTokens.toLocaleString()} tokens
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Release Date</p>
              <p className="text-sm font-medium">
                {new Date(model.releaseDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="text-sm font-medium">{model.provider}</p>
            </div>
          </div>

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
