import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Brain, ChevronDown, ChevronUp, X } from 'lucide-react';

interface KnowledgeItem {
  id: number;
  name: string;
  description: string;
  type: 'company' | 'framework' | 'workspace' | 'github';
  relevanceScore?: number;
}

interface ChatKnowledgeSelectorProps {
  query: string;
  onKnowledgeChange: (selectedKnowledge: {
    companyIds: number[];
    frameworkIds: number[];
    workspaceIds: number[];
  }) => void;
  className?: string;
}

export function ChatKnowledgeSelector({
  query,
  onKnowledgeChange,
  className = '',
}: ChatKnowledgeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [allKnowledge, setAllKnowledge] = useState<{
    companies: KnowledgeItem[];
    frameworks: KnowledgeItem[];
    workspaces: KnowledgeItem[];
  }>({
    companies: [],
    frameworks: [],
    workspaces: [],
  });
  const [relevanceScores, setRelevanceScores] = useState<
    Record<string, number>
  >({});
  const [selectedKnowledge, setSelectedKnowledge] = useState<{
    companyIds: number[];
    frameworkIds: number[];
    workspaceIds: number[];
  }>({
    companyIds: [],
    frameworkIds: [],
    workspaceIds: [],
  });
  const [isLoading, setIsLoading] = useState(false);

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

  // Calculate relevance when query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateRelevance(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Handle knowledge selection
  const handleKnowledgeToggle = (
    type: 'company' | 'framework' | 'workspace',
    id: number
  ) => {
    const newSelection = { ...selectedKnowledge };

    if (type === 'company') {
      if (newSelection.companyIds.includes(id)) {
        newSelection.companyIds = newSelection.companyIds.filter(
          companyId => companyId !== id
        );
      } else {
        newSelection.companyIds.push(id);
      }
    } else if (type === 'framework') {
      if (newSelection.frameworkIds.includes(id)) {
        newSelection.frameworkIds = newSelection.frameworkIds.filter(
          frameworkId => frameworkId !== id
        );
      } else {
        newSelection.frameworkIds.push(id);
      }
    } else if (type === 'workspace') {
      if (newSelection.workspaceIds.includes(id)) {
        newSelection.workspaceIds = newSelection.workspaceIds.filter(
          workspaceId => workspaceId !== id
        );
      } else {
        newSelection.workspaceIds.push(id);
      }
    }

    setSelectedKnowledge(newSelection);
    onKnowledgeChange(newSelection);
  };

  // Clear all selections
  const clearAllSelections = () => {
    const emptySelection = {
      companyIds: [],
      frameworkIds: [],
      workspaceIds: [],
    };
    setSelectedKnowledge(emptySelection);
    onKnowledgeChange(emptySelection);
  };

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
          !query.trim() ||
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.relevanceScore > 0.1
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5); // Show top 5 most relevant
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

  const totalSelected =
    selectedKnowledge.companyIds.length +
    selectedKnowledge.frameworkIds.length +
    selectedKnowledge.workspaceIds.length;

  return (
    <div className={`relative ${className}`}>
      {/* Knowledge Selector Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          <span>Knowledge Sources</span>
          {totalSelected > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalSelected} selected
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Expanded Knowledge List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-hidden"
          >
            <div className="p-3 border-b bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Select Knowledge Sources
                </h4>
                {totalSelected > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllSelections}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalSelected === 0
                  ? 'No selections - AI will automatically choose the best knowledge sources'
                  : `${totalSelected} selected - AI will prioritize these sources`}
              </p>
            </div>

            <ScrollArea className="max-h-64">
              <div className="p-3 space-y-3">
                {/* Companies */}
                {filteredCompanies.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      🏢 Companies ({filteredCompanies.length})
                    </h5>
                    <div className="space-y-1">
                      {filteredCompanies.map(company => (
                        <div
                          key={company.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            handleKnowledgeToggle('company', company.id)
                          }
                        >
                          <Checkbox
                            checked={selectedKnowledge.companyIds.includes(
                              company.id
                            )}
                            onChange={() =>
                              handleKnowledgeToggle('company', company.id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {company.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {company.description}
                            </div>
                          </div>
                          {company.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                company.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(company.relevanceScore * 100)}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frameworks */}
                {filteredFrameworks.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      ⚙️ Frameworks ({filteredFrameworks.length})
                    </h5>
                    <div className="space-y-1">
                      {filteredFrameworks.map(framework => (
                        <div
                          key={framework.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            handleKnowledgeToggle('framework', framework.id)
                          }
                        >
                          <Checkbox
                            checked={selectedKnowledge.frameworkIds.includes(
                              framework.id
                            )}
                            onChange={() =>
                              handleKnowledgeToggle('framework', framework.id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {framework.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {framework.description}
                            </div>
                          </div>
                          {framework.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                framework.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(framework.relevanceScore * 100)}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workspaces */}
                {filteredWorkspaces.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      💼 Workspaces ({filteredWorkspaces.length})
                    </h5>
                    <div className="space-y-1">
                      {filteredWorkspaces.map(workspace => (
                        <div
                          key={workspace.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            handleKnowledgeToggle('workspace', workspace.id)
                          }
                        >
                          <Checkbox
                            checked={selectedKnowledge.workspaceIds.includes(
                              workspace.id
                            )}
                            onChange={() =>
                              handleKnowledgeToggle('workspace', workspace.id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {workspace.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {workspace.description}
                            </div>
                          </div>
                          {workspace.relevanceScore > 0 && (
                            <Badge
                              variant={getRelevanceBadgeVariant(
                                workspace.relevanceScore
                              )}
                              className="text-xs"
                            >
                              {Math.round(workspace.relevanceScore * 100)}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredCompanies.length === 0 &&
                  filteredFrameworks.length === 0 &&
                  filteredWorkspaces.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">
                        No relevant knowledge sources found.
                      </p>
                      <p className="text-xs">
                        AI will use automatic knowledge selection.
                      </p>
                    </div>
                  )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
