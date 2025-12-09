import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { motion } from 'framer-motion';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Search, RefreshCw, ExternalLink, Star, GitBranch } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface KnowledgeItem {
  id: number;
  name: string;
  description: string;
  type: 'company' | 'framework' | 'workspace' | 'github';
  relevanceScore?: number;
  data?: any;
}

interface KnowledgeSourcesViewerProps {
  query?: string;
  onKnowledgeSelect?: (knowledge: KnowledgeItem) => void;
}

export function KnowledgeSourcesViewer({
  query = '',
  onKnowledgeSelect,
}: KnowledgeSourcesViewerProps) {
  const [allKnowledge, setAllKnowledge] = useState<{
    companies: KnowledgeItem[];
    frameworks: KnowledgeItem[];
    workspaces: KnowledgeItem[];
    githubRepositories: any[];
  }>({
    companies: [],
    frameworks: [],
    workspaces: [],
    githubRepositories: [],
  });
  const [relevanceScores, setRelevanceScores] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);
  const { toast } = useToast();

  // Load all knowledge items
  const loadAllKnowledge = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/knowledge/all');
      if (response.ok) {
        const data = await response.json();
        setAllKnowledge(data);
      }
    } catch (error) {
      console.error('Error loading knowledge:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge sources',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate relevance scores
  const calculateRelevance = async (query: string) => {
    if (!query.trim()) {
      setRelevanceScores({});
      return;
    }

    try {
      const response = await apiFetch('/api/knowledge/calculate-relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const scores = await response.json();
        setRelevanceScores(scores);
      }
    } catch (error) {
      console.error('Error calculating relevance:', error);
    }
  };

  // Load knowledge on mount
  useEffect(() => {
    loadAllKnowledge();
  }, []);

  // Calculate relevance when search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateRelevance(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Get knowledge type icon
  const getKnowledgeIcon = (type: string) => {
    switch (type) {
      case 'company':
        return '🏢';
      case 'framework':
        return '⚙️';
      case 'workspace':
        return '💼';
      case 'github':
        return '🐙';
      default:
        return '📚';
    }
  };

  // Get relevance badge variant
  const getRelevanceBadgeVariant = (score: number) => {
    if (score > 0.7) return 'default';
    if (score > 0.5) return 'secondary';
    if (score > 0.3) return 'outline';
    return 'outline';
  };

  // Filter and sort knowledge items
  const getFilteredKnowledge = (items: KnowledgeItem[], type: string) => {
    return items
      .map(item => ({
        ...item,
        relevanceScore: relevanceScores[`${type}-${item.id}`] || 0,
      }))
      .filter(
        item =>
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.relevanceScore > 0.1
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  };

  const filteredCompanies = getFilteredKnowledge(
    allKnowledge.companies,
    'company'
  );
  const filteredFrameworks = getFilteredKnowledge(
    allKnowledge.frameworks,
    'framework'
  );
  const filteredWorkspaces = getFilteredKnowledge(
    allKnowledge.workspaces,
    'workspace'
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Knowledge Sources</h2>
            <p className="text-sm text-muted-foreground">
              Browse and search through available knowledge sources
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllKnowledge}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search knowledge sources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs defaultValue="companies" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="companies" className="text-xs">
                🏢 Companies ({filteredCompanies.length})
              </TabsTrigger>
              <TabsTrigger value="frameworks" className="text-xs">
                ⚙️ Frameworks ({filteredFrameworks.length})
              </TabsTrigger>
              <TabsTrigger value="workspaces" className="text-xs">
                💼 Workspaces ({filteredWorkspaces.length})
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs">
                🐙 GitHub ({allKnowledge.githubRepositories.length})
              </TabsTrigger>
            </TabsList>

            {/* Companies Tab */}
            <TabsContent value="companies" className="mt-4">
              <div className="grid gap-3">
                {filteredCompanies.map(company => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onKnowledgeSelect?.(company)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {getKnowledgeIcon(company.type)}
                            </span>
                            <CardTitle className="text-sm">
                              {company.name}
                            </CardTitle>
                          </div>
                          {company.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                company.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(company.relevanceScore * 100)}% match
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs">
                          {company.description}
                        </CardDescription>
                        {company.data?.website && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3" />
                            <a
                              href={company.data.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                              onClick={e => e.stopPropagation()}
                            >
                              {company.data.website}
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {filteredCompanies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No companies found matching your search.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Frameworks Tab */}
            <TabsContent value="frameworks" className="mt-4">
              <div className="grid gap-3">
                {filteredFrameworks.map(framework => (
                  <motion.div
                    key={framework.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onKnowledgeSelect?.(framework)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {getKnowledgeIcon(framework.type)}
                            </span>
                            <CardTitle className="text-sm">
                              {framework.name}
                            </CardTitle>
                          </div>
                          {framework.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                framework.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(framework.relevanceScore * 100)}%
                              match
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs">
                          {framework.description}
                        </CardDescription>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          {framework.data?.language && (
                            <div className="flex items-center gap-1">
                              <span>Language: {framework.data.language}</span>
                            </div>
                          )}
                          {framework.data?.githubUrl && (
                            <div className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              <a
                                href={framework.data.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary"
                                onClick={e => e.stopPropagation()}
                              >
                                GitHub
                              </a>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {filteredFrameworks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No frameworks found matching your search.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Workspaces Tab */}
            <TabsContent value="workspaces" className="mt-4">
              <div className="grid gap-3">
                {filteredWorkspaces.map(workspace => (
                  <motion.div
                    key={workspace.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onKnowledgeSelect?.(workspace)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {getKnowledgeIcon(workspace.type)}
                            </span>
                            <CardTitle className="text-sm">
                              {workspace.name}
                            </CardTitle>
                          </div>
                          {workspace.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                workspace.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(workspace.relevanceScore * 100)}%
                              match
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs">
                          {workspace.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {filteredWorkspaces.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No workspaces found matching your search.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* GitHub Tab */}
            <TabsContent value="github" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>GitHub repositories will be shown here when available.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
