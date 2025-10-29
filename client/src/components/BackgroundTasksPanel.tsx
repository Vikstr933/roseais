/**
 * Background Tasks Panel
 * Displays active and recent background tasks with progress
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Code
} from 'lucide-react';
import { BackgroundTaskService, BackgroundTask } from '@/services/BackgroundTaskService';

export default function BackgroundTasksPanel() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Subscribe to task updates
    const unsubUpdate = BackgroundTaskService.onUpdate((task) => {
      setTasks(BackgroundTaskService.getTasks());

      // Auto-open panel when a new task starts
      if (task.status === 'in-progress' && !isOpen) {
        setIsOpen(true);
        setIsMinimized(false);
      }
    });

    const unsubComplete = BackgroundTaskService.onComplete((task) => {
      setTasks(BackgroundTaskService.getTasks());

      // Show notification when task completes
      if (task.status === 'completed') {
        showNotification(task);
      }
    });

    // Load initial tasks
    setTasks(BackgroundTaskService.getTasks());

    return () => {
      unsubUpdate();
      unsubComplete();
    };
  }, [isOpen]);

  const showNotification = (task: BackgroundTask) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Code Generation Complete', {
        body: task.description || 'Your code is ready',
        icon: '/favicon.ico',
        tag: task.id
      });
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleRemoveTask = (taskId: string) => {
    BackgroundTaskService.removeTask(taskId);
    setTasks(BackgroundTaskService.getTasks());
  };

  const handleClearCompleted = () => {
    BackgroundTaskService.clearCompleted();
    setTasks(BackgroundTaskService.getTasks());
  };

  const activeTasks = tasks.filter(
    t => t.status === 'pending' || t.status === 'in-progress'
  );
  const completedTasks = tasks.filter(
    t => t.status === 'completed' || t.status === 'failed'
  );

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null;
  }

  // Auto-open if there are active tasks
  if (!isOpen && activeTasks.length > 0) {
    setIsOpen(true);
  }

  if (!isOpen) {
    return null;
  }

  // Minimized state - just show count
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-6 z-40">
        <Card className="w-64 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <CardTitle className="text-sm">
                  {activeTasks.length} Active Task{activeTasks.length !== 1 ? 's' : ''}
                </CardTitle>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsMinimized(false)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Full panel
  return (
    <div className="fixed bottom-24 right-6 z-40">
      <Card className="w-96 h-[400px] shadow-2xl flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Background Tasks</CardTitle>
              {activeTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeTasks.length} active
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {/* Active Tasks */}
              {activeTasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                    ACTIVE
                  </h3>
                  {activeTasks.map(task => (
                    <TaskItem key={task.id} task={task} onRemove={handleRemoveTask} />
                  ))}
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      RECENT
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleClearCompleted}
                    >
                      Clear all
                    </Button>
                  </div>
                  {completedTasks.slice(0, 5).map(task => (
                    <TaskItem key={task.id} task={task} onRemove={handleRemoveTask} />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskItemProps {
  task: BackgroundTask;
  onRemove: (taskId: string) => void;
}

function TaskItem({ task, onRemove }: TaskItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
      case 'in-progress':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending':
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
    }
  };

  const isActive = task.status === 'pending' || task.status === 'in-progress';

  return (
    <div className={`border rounded-lg p-3 mb-2 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium truncate">{task.title}</p>
              {task.type === 'code-generation' && (
                <Badge variant="outline" className="text-xs">
                  Code Gen
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {task.description}
              </p>
            )}
            {isActive && (
              <div className="mt-2">
                <Progress value={task.progress} className="h-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {task.progress}%
                </p>
              </div>
            )}
            {task.status === 'completed' && task.metadata?.filesGenerated && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Generated {task.metadata.filesGenerated} file{task.metadata.filesGenerated !== 1 ? 's' : ''}
              </p>
            )}
            {task.status === 'failed' && task.error && (
              <p className="text-xs text-red-600 mt-1">
                {task.error}
              </p>
            )}
            {task.metadata?.deploymentUrl && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs mt-1"
                onClick={() => window.open(task.metadata?.deploymentUrl, '_blank')}
              >
                View Result <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
        {!isActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemove(task.id)}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
