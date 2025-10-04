import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [relevanceScores, setRelevanceScores] = useState<
    Record<string, number>
  >({});

  // Update search query when initialQuery changes (from parent component)
  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Load automatic knowledge when query changes
  const loadAutomaticKnowledge = useCallback(
    async (query: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/knowledge/search?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          // Automatically select relevant knowledge
          const selectedKnowledge = {
            companyIds: data.companies?.map((c: any) => c.id) || [],
            frameworkIds: data.frameworks?.map((f: any) => f.id) || [],
            workspaceIds: data.workspaces?.map((w: any) => w.id) || [],
          };
          onKnowledgeChange(selectedKnowledge);
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

  return (
    <div className="space-y-4">
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
        {isLoading && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-xs text-muted-foreground mt-2">
              Finding relevant knowledge...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
