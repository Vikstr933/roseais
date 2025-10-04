import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, X, Lightbulb, Code, Building } from 'lucide-react';

interface KnowledgeItem {
  id: number;
  type: 'company' | 'framework' | 'workspace';
  name: string;
  description: string;
  data: any;
  relevanceScore: number;
}

interface KnowledgeContext {
  companies: KnowledgeItem[];
  frameworks: KnowledgeItem[];
  workspaces: KnowledgeItem[];
  totalItems: number;
}

interface KnowledgeSelectorProps {
  onKnowledgeChange: (selectedKnowledge: {
    companyIds: number[];
    frameworkIds: number[];
    workspaceIds: number[];
  }) => void;
  initialQuery?: string;
  mode?: 'automatic' | 'manual';
}

export function KnowledgeSelector({
  onKnowledgeChange,
  initialQuery = '',
  mode = 'automatic',
}: KnowledgeSelectorProps) {
  const [autoKnowledge, setAutoKnowledge] = useState<KnowledgeContext | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [relevanceScores, setRelevanceScores] = useState<
    Record<string, number>
  >({});

  // Update search query when initialQuery changes (from parent component)
  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  const loadAutomaticKnowledge = useCallback(
    async (query: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/knowledge/search?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const knowledge = await response.json();
          setAutoKnowledge(knowledge);

          // Auto-select the most relevant items
          const autoSelected = {
            companyIds: knowledge.companies
              .slice(0, 2)
              .map((item: KnowledgeItem) => item.id),
            frameworkIds: knowledge.frameworks
              .slice(0, 3)
              .map((item: KnowledgeItem) => item.id),
            workspaceIds: knowledge.workspaces
              .slice(0, 1)
              .map((item: KnowledgeItem) => item.id),
          };

          setSelectedKnowledge(autoSelected);
          onKnowledgeChange(autoSelected);
        }
      } catch (error) {
        console.error('Error loading automatic knowledge:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [onKnowledgeChange]
  );

  // Load automatic knowledge when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      loadAutomaticKnowledge(searchQuery);
    }
  }, [searchQuery, loadAutomaticKnowledge]);

  // Load automatic knowledge when initialQuery changes (from parent component)
  useEffect(() => {
    if (initialQuery.trim() && initialQuery !== searchQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  // Real-time relevance scoring as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setRelevanceScores({});
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/knowledge/calculate-relevance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (response.ok) {
          const scores = await response.json();
          setRelevanceScores(scores);
        }
      } catch (error) {
        console.error('Error calculating relevance scores:', error);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // No manual selection in automatic mode

  const getKnowledgeItems = () => {
    return (
      autoKnowledge || {
        companies: [],
        frameworks: [],
        workspaces: [],
        totalItems: 0,
      }
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'company':
        return <Building className="h-4 w-4" />;
      case 'framework':
        return <Code className="h-4 w-4" />;
      case 'workspace':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'company':
        return 'bg-blue-100 text-blue-800';
      case 'framework':
        return 'bg-green-100 text-green-800';
      case 'workspace':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderKnowledgeItems = (
    items: KnowledgeItem[],
    type: 'company' | 'framework' | 'workspace'
  ) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">No {type}s found</div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map(item => {
          const isSelected = selectedKnowledge[
            `${type}Ids` as keyof typeof selectedKnowledge
          ].includes(item.id);

          return (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleItemToggle(type, item.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleItemToggle(type, item.id)}
                    disabled={mode === 'automatic'}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      {getIcon(type)}
                      <h4 className="font-medium text-sm truncate">
                        {item.name}
                      </h4>
                      <Badge className={getTypeColor(type)}>{type}</Badge>
                      {(item.relevanceScore > 0 ||
                        (mode === 'automatic' &&
                          relevanceScores[`${type}-${item.id}`])) && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {Math.round(
                            (relevanceScores[`${type}-${item.id}`] ||
                              item.relevanceScore) * 100
                          )}
                          % match
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.description}
                    </p>
                    {item.data.use_cases && (
                      <p className="text-xs text-gray-500 mt-1">
                        Use cases: {item.data.use_cases}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const knowledgeItems = getKnowledgeItems();
  const totalSelected =
    selectedKnowledge.companyIds.length +
    selectedKnowledge.frameworkIds.length +
    selectedKnowledge.workspaceIds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knowledge Base</h3>
        {totalSelected > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {totalSelected} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="h-8"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="text-center py-8 text-muted-foreground">
        <Lightbulb className="h-12 w-12 mx-auto mb-4 text-blue-500" />
        <h3 className="text-lg font-medium mb-2">
          Automatic Knowledge Selection
        </h3>
        <p className="text-sm">
          The AI will automatically analyze your prompt and select relevant
          knowledge from the knowledge base.
        </p>
        <p className="text-xs mt-2 text-muted-foreground">
          No manual selection needed - just enter your prompt in the chat!
        </p>
      </div>
    </div>
  );
}
