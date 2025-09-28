import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, any>;
  code?: string;
}

export class Logger extends EventEmitter {
  private logDir: string;
  private logFile: string;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(baseDirectory: string) {
    super();
    this.logDir = path.join(baseDirectory, 'logs');
    this.logFile = path.join(this.logDir, 'agent-operations.log');
  }

  async initialize(): Promise<void> {
    // If already initializing, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized, return immediately
    if (this.initialized) {
      return;
    }

    // Create new initialization promise
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Write an initialization marker to verify file access
      const initEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        category: 'Logger',
        message: 'Logger initialized successfully'
      };
      
      await this.writeToLog(initEntry);
      this.initialized = true;
      
      // Emit initialization success
      this.emit('initialized');
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize Logger:', err);
      throw error;
    }
  }

  private async writeToLog(entry: LogEntry): Promise<void> {
    // Only initialize if not already initialized
    if (!this.initialized && !this.initializationPromise) {
      await this.initialize();
    }

    const logLine = `[${entry.timestamp}] ${entry.level} [${entry.category}] ${entry.message} ${entry.code ? `\n\`\`\`\n${entry.code}\n\`\`\`\n` : ''}\n`;
    
    try {
      // Ensure log directory exists (in case it was deleted)
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Write to log file
      await fs.appendFile(this.logFile, logLine);
      
      // Emit the log entry for real-time monitoring
      this.emit('log', {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      });
      
      // Also log to console for development visibility
      console.log(logLine.trim());
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.error('Failed to write log entry:', err);
      
      // Even if file write fails, still emit the event for real-time monitoring
      this.emit('log', {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      });
    }
  }

  async log(
    level: LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, any>,
    code?: string
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      code
    };

    await this.writeToLog(entry);
  }

  async info(category: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, category, message, metadata);
  }

  async warning(category: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARNING, category, message, metadata);
  }

  async error(category: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, category, message, metadata);
  }

  async debug(category: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, category, message, metadata);
  }

  async getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    if (!this.initialized) {
      console.warn('Logger not initialized. Attempting to initialize now...');
      await this.initialize();
    }

    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      return content
        .split('\n')
        .filter(Boolean)
        .slice(-limit)
        .map(line => {
          const match = line.match(/\[(.*?)\] (.*?) \[(.*?)\] (.*)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2] as LogLevel,
              category: match[3],
              message: match[4]
            };
          }
          return null;
        })
        .filter((entry): entry is LogEntry => entry !== null);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  // Helper method to check if logger is initialized
  isInitialized(): boolean {
    return this.initialized;
  }
}
