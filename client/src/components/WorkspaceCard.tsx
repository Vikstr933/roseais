import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, Users, PlayCircle } from 'lucide-react';

interface WorkspaceProps {
  workspace: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    agentConfig: {
      model: string;
      parameters: Record<string, any>;
      prompts: string[];
    };
    testCases?: {
      name: string;
      input: string;
      expectedOutput: string;
    }[];
    collaborators: string[];
    status: string;
    use_cases?: string[];
  };
}

export function WorkspaceCard({ workspace }: WorkspaceProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="h-full">
      <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">{workspace.name}</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date(workspace.updatedAt).toLocaleDateString()}
            </p>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {workspace.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">{workspace.description}</p>

          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Agent Configuration:</h4>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-semibold">Model:</span>{' '}
                {workspace.agentConfig.model}
              </div>
              {workspace.agentConfig.prompts && (
                <div className="border rounded-lg p-4">
                  <h5 className="text-sm font-semibold mb-2">Prompts</h5>
                  <div className="space-y-2">
                    {workspace.agentConfig.prompts.map((prompt, index) => (
                      <div key={index} className="text-sm bg-muted p-2 rounded">
                        {prompt}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {workspace.use_cases && workspace.use_cases.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Use Cases:</h4>
              <div className="space-y-2">
                {workspace.use_cases.map((useCase, idx) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    {useCase.startsWith('Not suitable for:') ? (
                      <span className="text-destructive">❌ {useCase}</span>
                    ) : (
                      <span className="text-green-600">✅ {useCase}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {workspace.collaborators.length} collaborators
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="text-sm">Test Agent</span>
            </motion.button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
