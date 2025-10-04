export enum ClientLogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export enum ClientLogCategory {
  UI = 'UI',
  API = 'API',
  NAVIGATION = 'NAVIGATION',
  USER_ACTION = 'USER_ACTION',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  AUTH = 'AUTH',
  AGENT_MANAGER = 'AGENT_MANAGER',
  COMPONENT = 'COMPONENT',
}

export interface ClientLogEntry {
  timestamp: string;
  level: ClientLogLevel;
  category: ClientLogCategory;
  message: string;
  metadata?: Record<string, any>;
  source: 'CLIENT';
  sessionId?: string;
  userId?: string;
  component?: string;
  action?: string;
  duration?: number;
}

class ClientLogger {
  private sessionId: string;
  private userId?: string;
  private logQueue: ClientLogEntry[] = [];
  private isOnline: boolean = navigator.onLine;
  private flushInterval: number = 5000; // 5 seconds
  private maxQueueSize: number = 100;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupOnlineListener();
    this.startFlushInterval();
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushLogs();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private startFlushInterval(): void {
    setInterval(() => {
      if (this.isOnline && this.logQueue.length > 0) {
        this.flushLogs();
      }
    }, this.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      await fetch('/api/logs/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.sessionId,
          userId: this.userId,
        }),
      });
    } catch (error) {
      // If sending fails, put logs back in queue (up to max size)
      this.logQueue = [...logsToSend, ...this.logQueue].slice(
        0,
        this.maxQueueSize
      );
      console.error('Failed to send client logs:', error);
    }
  }

  private addLog(
    level: ClientLogLevel,
    category: ClientLogCategory,
    message: string,
    metadata?: Record<string, any>,
    component?: string,
    action?: string,
    duration?: number
  ): void {
    const logEntry: ClientLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      source: 'CLIENT',
      sessionId: this.sessionId,
      userId: this.userId,
      component,
      action,
      duration,
    };

    this.logQueue.push(logEntry);

    // If queue is full, remove oldest entries
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue = this.logQueue.slice(-this.maxQueueSize);
    }

    // Also log to console for development
    console.log(`[${level}] [${category}] ${message}`, metadata);

    // Try to flush immediately if online
    if (this.isOnline) {
      this.flushLogs().catch(() => {
        // Ignore errors, logs will be retried later
      });
    }
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  // UI Events
  uiEvent(
    component: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.UI,
      `${component}: ${action}`,
      metadata,
      component,
      action
    );
  }

  // API Calls
  apiCall(
    method: string,
    url: string,
    status?: number,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    this.addLog(
      status && status >= 400 ? ClientLogLevel.ERROR : ClientLogLevel.INFO,
      ClientLogCategory.API,
      `${method} ${url} ${status ? `(${status})` : ''}`,
      { ...metadata, status, duration },
      'API',
      method,
      duration
    );
  }

  // Navigation
  navigation(from: string, to: string, metadata?: Record<string, any>): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.NAVIGATION,
      `Navigation: ${from} → ${to}`,
      metadata,
      'Router',
      'navigate'
    );
  }

  // User Actions
  userAction(
    action: string,
    component: string,
    metadata?: Record<string, any>
  ): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.USER_ACTION,
      `User action: ${action}`,
      metadata,
      component,
      action
    );
  }

  // Performance
  performance(
    metric: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.PERFORMANCE,
      `Performance: ${metric} = ${value}ms`,
      { ...metadata, value },
      'Performance',
      metric,
      value
    );
  }

  // Errors
  error(
    error: Error | string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.addLog(
      ClientLogLevel.ERROR,
      ClientLogCategory.ERROR,
      `Error: ${errorMessage}`,
      { ...metadata, stack: errorStack },
      component,
      'error'
    );
  }

  // Authentication
  authEvent(event: string, metadata?: Record<string, any>): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.AUTH,
      `Auth: ${event}`,
      metadata,
      'Auth',
      event
    );
  }

  // Agent Manager
  agentManagerEvent(
    event: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): void {
    this.addLog(
      ClientLogLevel.INFO,
      ClientLogCategory.AGENT_MANAGER,
      `Agent Manager: ${event}`,
      { ...metadata, agentId },
      'AgentManager',
      event
    );
  }

  // Generic logging methods
  info(
    category: ClientLogCategory,
    message: string,
    metadata?: Record<string, any>,
    component?: string
  ): void {
    this.addLog(ClientLogLevel.INFO, category, message, metadata, component);
  }

  warning(
    category: ClientLogCategory,
    message: string,
    metadata?: Record<string, any>,
    component?: string
  ): void {
    this.addLog(ClientLogLevel.WARNING, category, message, metadata, component);
  }

  debug(
    category: ClientLogCategory,
    message: string,
    metadata?: Record<string, any>,
    component?: string
  ): void {
    this.addLog(ClientLogLevel.DEBUG, category, message, metadata, component);
  }
}

// Create singleton instance
export const clientLogger = new ClientLogger();

// Export for use in components
export default clientLogger;
