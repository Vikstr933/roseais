import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Github,
  Plus,
  Search,
  Code,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  topics: string[];
  functions: any[];
  classes: any[];
  constants: any[];
  lastUpdated: string;
}

interface GitHubKnowledgeManagerProps {
  userId?: string;
  onRepositoryAdded?: (repository: GitHubRepository) => void;
}

export function GitHubKnowledgeManager({
  userId,
  onRepositoryAdded,
}: GitHubKnowledgeManagerProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const { toast } = useToast();

  const addRepository = async () => {
    if (!repoUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a GitHub repository URL',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/github-knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          userId: userId || 'anonymous',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Added ${data.repository.fullName} to knowledge base`,
        });

        setRepositories(prev => [...prev, data.repository]);
        setRepoUrl('');

        if (onRepositoryAdded) {
          onRepositoryAdded(data.repository);
        }
      } else {
        throw new Error(data.error || 'Failed to add repository');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchRepositories = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/github-knowledge/search?q=${encodeURIComponent(searchQuery)}&userId=${userId || 'anonymous'}`
      );
      const data = await response.json();

      if (response.ok) {
        setSearchResults(data);
      } else {
        throw new Error(data.error || 'Failed to search repositories');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseGitHubUrl = (url: string): boolean => {
    const githubUrlPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+/;
    return githubUrlPattern.test(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Github className="h-6 w-6" />
        <h3 className="text-lg font-semibold">GitHub Repository Knowledge</h3>
      </div>

      {/* Add Repository */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add Repository</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url">GitHub Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              className={
                !parseGitHubUrl(repoUrl) && repoUrl ? 'border-red-500' : ''
              }
            />
            {!parseGitHubUrl(repoUrl) && repoUrl && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please enter a valid GitHub repository URL
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button
            onClick={addRepository}
            disabled={isLoading || !parseGitHubUrl(repoUrl)}
            className="w-full"
          >
            {isLoading ? 'Adding...' : 'Add to Knowledge Base'}
          </Button>
        </CardContent>
      </Card>

      {/* Search Repositories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Search Repository Knowledge</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Search functions, classes, or concepts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && searchRepositories()}
            />
            <Button onClick={searchRepositories} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults && (
            <div className="space-y-4">
              {/* Repositories */}
              {searchResults.repositories.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
                    Repositories ({searchResults.repositories.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.repositories.map(
                      (repo: GitHubRepository) => (
                        <Card key={repo.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium">{repo.name}</h5>
                              <p className="text-sm text-gray-600">
                                {repo.description}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline">{repo.language}</Badge>
                                <span className="text-xs text-gray-500">
                                  {repo.functions.length} functions,{' '}
                                  {repo.classes.length} classes
                                </span>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            </Button>
                          </div>
                        </Card>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Functions */}
              {searchResults.functions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>Functions ({searchResults.functions.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {searchResults.functions
                      .slice(0, 5)
                      .map((func: any, index: number) => (
                        <Card key={index} className="p-3">
                          <div className="space-y-1">
                            <h5 className="font-mono text-sm font-medium">
                              {func.name}
                            </h5>
                            <p className="text-xs text-gray-600">
                              {func.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {func.file}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Line {func.line}
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* Classes */}
              {searchResults.classes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Classes ({searchResults.classes.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {searchResults.classes
                      .slice(0, 5)
                      .map((cls: any, index: number) => (
                        <Card key={index} className="p-3">
                          <div className="space-y-1">
                            <h5 className="font-mono text-sm font-medium">
                              {cls.name}
                            </h5>
                            <p className="text-xs text-gray-600">
                              {cls.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {cls.file}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Line {cls.line}
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {searchResults.repositories.length === 0 &&
                searchResults.functions.length === 0 &&
                searchResults.classes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No results found for "{searchQuery}"</p>
                    <p className="text-sm">
                      Try a different search term or add more repositories
                    </p>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
