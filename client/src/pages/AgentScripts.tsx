import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Download, Code2 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentScript {
  id: number;
  name: string;
  description: string;
  language: string;
  version: string;
  category: string;
  tags: string[];
  configSchema: Record<string, any>;
  requirements: string[];
}

export default function AgentScripts() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: scripts = [] } = useQuery<AgentScript[]>({
    queryKey: ["/api/agent-scripts"],
  });

  const filteredScripts = scripts.filter(script => 
    script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    script.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    script.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDownload = async (scriptId: number) => {
    try {
      const response = await fetch(`/api/agent-scripts/${scriptId}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-script-${scriptId}.py`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download script:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          Autonomous Agent Scripts
        </h1>
        <p className="text-muted-foreground mt-2">
          Download and deploy ready-to-use autonomous agent scripts
        </p>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredScripts.map((script, index) => (
          <motion.div
            key={script.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" />
                  <h3 className="text-xl font-semibold">{script.name}</h3>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {script.language}
                  </Badge>
                  <span className="text-sm text-muted-foreground">v{script.version}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm">{script.description}</p>
                
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Requirements:</h4>
                  <div className="flex flex-wrap gap-2">
                    {script.requirements.map((req, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs"
                      >
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Tags:</h4>
                  <div className="flex flex-wrap gap-2">
                    {script.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-primary/10 text-primary"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleDownload(script.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Script
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
