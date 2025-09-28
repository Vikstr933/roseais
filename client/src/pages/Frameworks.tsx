import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { Code, Github, Book, Star } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Framework {
  id: number;
  name: string;
  description: string;
  language: string;
  githubUrl?: string;
  documentation?: string;
  features: string[];
  use_cases?: string[];
}

export default function Frameworks() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: frameworks = [], isLoading, error } = useQuery<Framework[]>({
    queryKey: ["/api/frameworks"],
  });

  const filteredFrameworks = frameworks.filter(framework =>
    framework.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    framework.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    framework.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
    framework.features.some(feature => feature.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          <h3 className="font-medium mb-2">Error Loading Frameworks</h3>
          <p>{error.message || 'An error occurred while loading frameworks'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          Development Frameworks
        </h1>
        <p className="text-muted-foreground mt-2">
          Popular frameworks and libraries for building modern applications
        </p>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredFrameworks.map((framework, index) => (
          <motion.div
            key={framework.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Code className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="text-xl font-semibold">{framework.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {framework.language}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm">{framework.description}</p>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Key Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    {framework.features.map((feature, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {framework.use_cases && framework.use_cases.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Use Cases:</h4>
                    <div className="space-y-2">
                      {framework.use_cases.map((useCase, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          {useCase.startsWith("Not suitable for:") ? (
                            <span className="text-destructive">❌ {useCase}</span>
                          ) : (
                            <span className="text-green-600">✅ {useCase}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {framework.githubUrl && (
                    <a
                      href={framework.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <Github className="w-4 h-4" />
                      <span>GitHub</span>
                    </a>
                  )}
                  {framework.documentation && (
                    <a
                      href={framework.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <Book className="w-4 h-4" />
                      <span>Docs</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredFrameworks.length === 0 && frameworks.length > 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <p>No frameworks found matching your search.</p>
        </div>
      )}

      {frameworks.length === 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <p>No frameworks available.</p>
        </div>
      )}
    </div>
  );
}
