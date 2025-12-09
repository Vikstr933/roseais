/**
 * Background Task Service
 * Manages long-running tasks (like code generation) that can continue while user navigates
 */

export interface BackgroundTask {
  id: string;
  type: 'code-generation' | 'deployment' | 'analysis';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number; // 0-100
  title: string;
  description?: string;
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  workflowId?: string;
  metadata?: {
    prompt?: string;
    agentsUsed?: string[];
    filesGenerated?: number;
    deploymentUrl?: string;
  };
}

type TaskUpdateCallback = (task: BackgroundTask) => void;
type TaskCompleteCallback = (task: BackgroundTask) => void;

class BackgroundTaskServiceClass {
  private tasks: Map<string, BackgroundTask> = new Map();
  private eventSource: EventSource | null = null;
  private updateCallbacks: Set<TaskUpdateCallback> = new Set();
  private completeCallbacks: Set<TaskCompleteCallback> = new Set();
  private isConnected = false;

  /**
   * Start a new code generation task
   */
  async startCodeGeneration(prompt: string, options?: {
    useOrchestration?: boolean;
    features?: string[];
  }): Promise<string> {
    const taskId = `task-${Date.now()}`;
    const workflowId = `workflow-${Date.now()}`;

    // Create task
    const task: BackgroundTask = {
      id: taskId,
      type: 'code-generation',
      status: 'pending',
      progress: 0,
      title: 'Generating code...',
      description: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
      startedAt: new Date(),
      workflowId,
      metadata: {
        prompt,
        agentsUsed: []
      }
    };

    this.tasks.set(taskId, task);
    this.notifyUpdate(task);

    // Subscribe to SSE events BEFORE starting generation
    this.subscribeToAgentEvents(workflowId, taskId);

    try {
      // Start code generation via orchestration
      const response = await apiFetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          useOrchestration: options?.useOrchestration ?? true,
          features: options?.features || [],
          workflowId
        })
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      // Update task to in-progress
      task.status = 'in-progress';
      task.progress = 5;
      this.tasks.set(taskId, task);
      this.notifyUpdate(task);

      console.log('🚀 Background code generation started:', taskId);
    } catch (error) {
      console.error('Failed to start code generation:', error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.tasks.set(taskId, task);
      this.notifyUpdate(task);
      this.notifyComplete(task);
    }

    return taskId;
  }

  /**
   * Subscribe to agent events via SSE
   */
  private subscribeToAgentEvents(workflowId: string, taskId: string) {
    if (this.isConnected && this.eventSource) {
      // Already connected, just listen for this workflow
      return;
    }

    const token = localStorage.getItem('sessionToken');
    const sseUrl = `/api/sse/agent-activity?token=${token}`;

    console.log('📡 Subscribing to agent events:', sseUrl);

    this.eventSource = new EventSource(getApiUrl(sseUrl));
    this.isConnected = true;

    this.eventSource.onopen = () => {
      console.log('✅ SSE connection established');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE event received:', data);

        // Only process events for this workflow
        if (data.workflowId !== workflowId) {
          return;
        }

        const task = this.tasks.get(taskId);
        if (!task) return;

        // Update task based on event type
        switch (data.type) {
          case 'AGENT_START':
            task.status = 'in-progress';
            task.progress = Math.min(task.progress + 10, 90);
            task.description = `${data.agent || 'Agent'} started...`;
            if (data.agent && !task.metadata?.agentsUsed?.includes(data.agent)) {
              task.metadata!.agentsUsed!.push(data.agent);
            }
            break;

          case 'AGENT_PROGRESS':
            task.progress = Math.min(data.progress || task.progress + 5, 90);
            task.description = data.message || task.description;
            break;

          case 'AGENT_COMPLETE':
            task.progress = Math.min(task.progress + 15, 95);
            task.description = `${data.agent || 'Agent'} completed`;
            break;

          case 'WORKFLOW_COMPLETE':
            task.status = 'completed';
            task.progress = 100;
            task.completedAt = new Date();
            task.title = 'Code generation complete!';
            task.description = 'Your code is ready';
            task.result = data.result;
            if (data.result?.filesGenerated) {
              task.metadata!.filesGenerated = data.result.filesGenerated;
            }
            if (data.result?.deploymentUrl) {
              task.metadata!.deploymentUrl = data.result.deploymentUrl;
            }
            this.notifyComplete(task);
            break;

          case 'WORKFLOW_ERROR':
            task.status = 'failed';
            task.error = data.error || 'Generation failed';
            task.completedAt = new Date();
            this.notifyComplete(task);
            break;
        }

        this.tasks.set(taskId, task);
        this.notifyUpdate(task);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      this.isConnected = false;

      // Try to reconnect after 5 seconds
      setTimeout(() => {
        if (!this.isConnected && this.tasks.size > 0) {
          console.log('🔄 Attempting to reconnect SSE...');
          this.subscribeToAgentEvents(workflowId, taskId);
        }
      }, 5000);
    };
  }

  /**
   * Get all tasks
   */
  getTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get active (non-completed) tasks
   */
  getActiveTasks(): BackgroundTask[] {
    return this.getTasks().filter(
      task => task.status === 'pending' || task.status === 'in-progress'
    );
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string) {
    this.tasks.delete(taskId);

    // Close SSE if no more tasks
    if (this.tasks.size === 0 && this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log('🔌 SSE connection closed (no active tasks)');
    }
  }

  /**
   * Clear all completed tasks
   */
  clearCompleted() {
    const completed = this.getTasks().filter(
      task => task.status === 'completed' || task.status === 'failed'
    );
    completed.forEach(task => this.removeTask(task.id));
  }

  /**
   * Subscribe to task updates
   */
  onUpdate(callback: TaskUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Subscribe to task completion
   */
  onComplete(callback: TaskCompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  /**
   * Notify all update listeners
   */
  private notifyUpdate(task: BackgroundTask) {
    this.updateCallbacks.forEach(callback => callback(task));
  }

  /**
   * Notify all completion listeners
   */
  private notifyComplete(task: BackgroundTask) {
    this.completeCallbacks.forEach(callback => callback(task));
  }

  /**
   * Cleanup on unmount
   */
  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
    this.updateCallbacks.clear();
    this.completeCallbacks.clear();
  }
}

// Export singleton instance
export const BackgroundTaskService = new BackgroundTaskServiceClass();
