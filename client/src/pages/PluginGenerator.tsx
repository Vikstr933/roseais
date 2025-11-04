import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Sparkles, AlertTriangle, CheckCircle, XCircle, Code, Shield } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface PluginGenerationResult {
  success: boolean;
  pluginId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'blocked';
  securityScore: number;
  reviewRequired: boolean;
  metadata: {
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
  }>;
  generationTime: number;
  tokensUsed: number;
}

interface GenerationStats {
  todaysGenerations: number;
  limits: {
    maxCustomPlugins: number;
    generationsPerDay: number;
    maxPluginComplexity: string;
  };
}

export default function PluginGenerator() {
  const [step, setStep] = useState<'describe' | 'generating' | 'review' | 'success'>('describe');
  const [prompt, setPrompt] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex'>('simple');
  const [result, setResult] = useState<PluginGenerationResult | null>(null);

  // Fetch stats
  const { data: stats } = useQuery<GenerationStats>({
    queryKey: ['plugin-stats'],
    queryFn: async () => {
      const res = await apiFetch('/api/user-plugins/stats/overview');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Generate plugin mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { prompt: string; serviceName?: string; estimatedComplexity?: string }) => {
      const res = await apiFetch('/api/user-plugins/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate plugin');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.status === 'blocked' || data.status === 'rejected') {
        setStep('review');
      } else {
        setStep('success');
      }
    },
    onError: (error) => {
      setStep('describe');
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    setStep('generating');
    generateMutation.mutate({
      prompt,
      serviceName: serviceName || undefined,
      estimatedComplexity: complexity,
    });
  };

  const handleReset = () => {
    setStep('describe');
    setPrompt('');
    setServiceName('');
    setComplexity('simple');
    setResult(null);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          Generate Custom Plugin
        </h1>
        <p className="text-muted-foreground">
          Use AI to create custom integrations with your favorite services
        </p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <Card className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.todaysGenerations}/{stats.limits.generationsPerDay === -1 ? '∞' : stats.limits.generationsPerDay}
                </div>
                <div className="text-sm text-muted-foreground">Generations Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.limits.maxCustomPlugins === -1 ? '∞' : stats.limits.maxCustomPlugins}
                </div>
                <div className="text-sm text-muted-foreground">Plugin Limit</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 capitalize">
                  {stats.limits.maxPluginComplexity}
                </div>
                <div className="text-sm text-muted-foreground">Max Complexity</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Describe */}
      {step === 'describe' && (
        <Card>
          <CardHeader>
            <CardTitle>Describe Your Plugin</CardTitle>
            <CardDescription>
              Tell us what you want your plugin to do. Be specific about the service and functionality.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="prompt">What should this plugin do?</Label>
              <Textarea
                id="prompt"
                placeholder="Example: Create a Discord plugin that monitors mentions of '@urgent' in my server and sends me notifications via the OmniAssistant. It should also be able to send messages when I'm away."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Min 10 characters, max 2000 characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="service">Service (Optional)</Label>
                <Input
                  id="service"
                  placeholder="e.g., Discord, Slack, Trello"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="complexity">Complexity</Label>
                <select
                  id="complexity"
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as any)}
                  className="mt-2 w-full h-10 px-3 rounded-md border border-input bg-background"
                  disabled={stats?.limits.maxPluginComplexity === 'simple'}
                >
                  <option value="simple">Simple</option>
                  <option value="medium" disabled={stats?.limits.maxPluginComplexity === 'simple'}>
                    Medium {stats?.limits.maxPluginComplexity === 'simple' && '(Pro+)'}
                  </option>
                  <option value="complex" disabled={stats?.limits.maxPluginComplexity !== 'complex'}>
                    Complex {stats?.limits.maxPluginComplexity !== 'complex' && '(Enterprise)'}
                  </option>
                </select>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                All plugins are analyzed for security issues before approval. Malicious code will be rejected.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleGenerate}
              disabled={prompt.length < 10 || generateMutation.isPending}
              className="w-full"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Plugin...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Plugin
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generating */}
      {step === 'generating' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-500" />
              <h3 className="text-xl font-semibold">Generating Your Plugin</h3>
              <p className="text-muted-foreground">
                AI is analyzing your request and generating secure code...
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review (if blocked/rejected) */}
      {step === 'review' && result && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              Plugin {result.status === 'blocked' ? 'Blocked' : 'Rejected'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {result.status === 'blocked'
                  ? 'This request was blocked due to security concerns.'
                  : 'The generated plugin failed security validation.'}
              </AlertDescription>
            </Alert>

            {result.issues && result.issues.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Security Issues Found:</h4>
                <ul className="space-y-2">
                  {result.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {issue.severity}
                      </Badge>
                      <span className="text-sm">{issue.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={handleReset} variant="outline" className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 'success' && result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Plugin Generated Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Plugin Name</div>
                <div className="text-lg font-semibold">{result.metadata.pluginName}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Security Score</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${result.securityScore >= 80 ? 'text-green-500' : 'text-yellow-500'}`} />
                  {result.securityScore}/100
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Description</div>
              <p className="text-sm">{result.metadata.description}</p>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {result.metadata.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">{cap}</Badge>
                ))}
              </div>
            </div>

            {result.reviewRequired && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This plugin requires manual review before activation due to its security score.
                  You'll be notified once it's approved.
                </AlertDescription>
              </Alert>
            )}

            {result.issues && result.issues.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Issues Found:</h4>
                <ul className="space-y-1">
                  {result.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                        {issue.severity}
                      </Badge>
                      <span>{issue.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <Button
                onClick={() => window.location.href = '/integrations'}
                className="w-full"
              >
                Go to Integrations
              </Button>
              <Button onClick={handleReset} variant="outline" className="w-full">
                Generate Another Plugin
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {generateMutation.isError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : 'Failed to generate plugin. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
