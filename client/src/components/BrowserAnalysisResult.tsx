/**
 * Browser Analysis Result Component
 * 
 * Displays visual analysis results from Browser Agent in a user-friendly format
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Tablet,
  Gauge,
  Accessibility
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface VisualIssue {
  type: 'layout' | 'css' | 'responsive' | 'accessibility' | 'performance' | 'visual';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  element?: string;
  suggestion?: string;
}

interface BrowserAnalysisResultProps {
  result: {
    url: string;
    viewport: { width: number; height: number };
    issuesFound: number;
    issues: VisualIssue[];
    metrics?: {
      loadTime: string;
      firstContentfulPaint?: string;
    };
    accessibility?: {
      score: number;
      violations: number;
    };
    summary: string;
    screenshot?: string; // Base64 encoded image
  };
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400'
};

const severityIcons = {
  critical: XCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info
};

const typeIcons = {
  layout: Monitor,
  css: Monitor,
  responsive: Smartphone,
  accessibility: Accessibility,
  performance: Gauge,
  visual: ImageIcon
};

export function BrowserAnalysisResult({ result }: BrowserAnalysisResultProps) {
  const hasIssues = result.issuesFound > 0;
  const criticalIssues = result.issues.filter(i => i.severity === 'critical').length;
  const highIssues = result.issues.filter(i => i.severity === 'high').length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {hasIssues ? (
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            Visual Analysis Results
          </CardTitle>
          <Badge variant={hasIssues ? 'destructive' : 'default'}>
            {result.issuesFound} {result.issuesFound === 1 ? 'issue' : 'issues'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Alert */}
        <Alert variant={hasIssues ? 'destructive' : 'default'}>
          <AlertTitle>
            {hasIssues 
              ? `${result.issuesFound} Issue${result.issuesFound > 1 ? 's' : ''} Found`
              : '✅ No Issues Found!'
            }
          </AlertTitle>
          <AlertDescription>{result.summary}</AlertDescription>
        </Alert>

        {/* Screenshot */}
        {result.screenshot && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="w-4 h-4" />
              Screenshot
            </div>
            <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
              <img 
                src={`data:image/png;base64,${result.screenshot}`}
                alt="Page screenshot"
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Viewport: {result.viewport.width}x{result.viewport.height}px
            </p>
          </div>
        )}

        {/* Metrics */}
        {result.metrics && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gauge className="w-4 h-4" />
                Load Time
              </div>
              <div className="text-lg font-semibold">{result.metrics.loadTime}</div>
            </div>
            {result.metrics.firstContentfulPaint && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Gauge className="w-4 h-4" />
                  First Contentful Paint
                </div>
                <div className="text-lg font-semibold">{result.metrics.firstContentfulPaint}</div>
              </div>
            )}
          </div>
        )}

        {/* Accessibility Score */}
        {result.accessibility && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Accessibility className="w-4 h-4" />
                Accessibility Score
              </div>
              <Badge 
                variant={
                  result.accessibility.score >= 90 ? 'default' :
                  result.accessibility.score >= 70 ? 'secondary' : 'destructive'
                }
              >
                {result.accessibility.score}/100
              </Badge>
            </div>
            {result.accessibility.violations > 0 && (
              <p className="text-sm text-muted-foreground">
                {result.accessibility.violations} violation{result.accessibility.violations > 1 ? 's' : ''} found
              </p>
            )}
          </div>
        )}

        {/* Issues List */}
        {hasIssues && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Issues ({result.issuesFound})
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {result.issues.map((issue, index) => {
                const Icon = severityIcons[issue.severity];
                const TypeIcon = typeIcons[issue.type] || Info;
                
                return (
                  <Collapsible key={index}>
                    <CollapsibleTrigger className="w-full">
                      <Alert 
                        variant={issue.severity === 'critical' ? 'destructive' : 'default'}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <AlertTitle className="flex items-center gap-2">
                              <TypeIcon className="w-4 h-4" />
                              <Badge className={severityColors[issue.severity]}>
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline">{issue.type}</Badge>
                            </AlertTitle>
                            <AlertDescription className="mt-1">
                              {issue.message}
                              {issue.element && (
                                <span className="block mt-1 text-xs font-mono bg-muted p-1 rounded">
                                  {issue.element}
                                </span>
                              )}
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    </CollapsibleTrigger>
                    {issue.suggestion && (
                      <CollapsibleContent>
                        <Card className="mt-2 ml-8 border-l-4 border-l-blue-500">
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="text-sm font-medium mb-1">Suggestion</div>
                                <div className="text-sm text-muted-foreground">
                                  {issue.suggestion}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                );
              })}
            </div>
          </div>
        )}

        {/* URL */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Analyzed: <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {result.url}
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

