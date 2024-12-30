import { motion } from "framer-motion";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Link } from "lucide-react";

interface AiCardProps {
  model: {
    name: string;
    creator: string;
    description: string;
    capabilities: string[];
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
          <p className="text-sm text-muted-foreground">{model.creator}</p>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">{model.description}</p>
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
