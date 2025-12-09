/**
 * InsightsPanel Component
 * Displays proactive AI-generated insights and suggestions
 * Part of Digital Office Platform (Fas 1)
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  Bell,
} from 'lucide-react';
import { useOmniAssistant, type AIInsight } from '@/hooks/useOmniAssistant';

export function InsightsPanel() {
  const { insights, fetchInsights, dismissInsight, actionInsight } = useOmniAssistant();

  useEffect(() => {
    // Load insights on mount
    fetchInsights(5);

    // Refresh insights every 5 minutes
    const interval = setInterval(() => {
      fetchInsights(5);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchInsights]);

  if (insights.length === 0) {
    return null; // Don't show panel if no insights
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)]"
    >
      <Card className="shadow-2xl border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Insights
            <Badge variant="secondary" className="ml-auto">
              {insights.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {insights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={() => dismissInsight(insight.id)}
                onAction={() => actionInsight(insight.id)}
              />
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface InsightCardProps {
  insight: AIInsight;
  onDismiss: () => void;
  onAction: () => void;
}

function InsightCard({ insight, onDismiss, onAction }: InsightCardProps) {
  const icon = getInsightIcon(insight.insightType);
  const variant = getInsightVariant(insight.insightType);
  const priorityColor = getPriorityColor(insight.priority);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative"
    >
      <Card className={`border-l-4 ${priorityColor} hover:shadow-md transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 p-2 rounded-full ${variant.bgClass}`}>
              {icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm">{insight.title}</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={onDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{insight.message}</p>

              {/* Actions */}
              {!insight.actionTaken && (
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={onAction} className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Take Action
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    {insight.insightType}
                  </Badge>
                </div>
              )}

              {insight.actionTaken && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
          </div>

          {/* Priority indicator */}
          {insight.priority >= 4 && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="text-xs">
                High Priority
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function getInsightIcon(type: string) {
  const className = "h-4 w-4";

  switch (type) {
    case 'opportunity':
      return <TrendingUp className={className} />;
    case 'warning':
      return <AlertTriangle className={className} />;
    case 'suggestion':
      return <Lightbulb className={className} />;
    case 'celebration':
      return <Sparkles className={className} />;
    default:
      return <Bell className={className} />;
  }
}

function getInsightVariant(type: string) {
  switch (type) {
    case 'opportunity':
      return { bgClass: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' };
    case 'warning':
      return { bgClass: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' };
    case 'suggestion':
      return { bgClass: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' };
    case 'celebration':
      return { bgClass: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' };
    default:
      return { bgClass: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
  }
}

function getPriorityColor(priority: number) {
  if (priority >= 4) return 'border-l-red-500';
  if (priority >= 3) return 'border-l-orange-500';
  if (priority >= 2) return 'border-l-yellow-500';
  return 'border-l-blue-500';
}
