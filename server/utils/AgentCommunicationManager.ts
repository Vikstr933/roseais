import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from './Logger';

interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'event';
  content: any;
  timestamp: string;
  projectDirectory?: string;
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    timeout?: number;
    retryCount?: number;
  };
}

interface MessageQueueItem {
  message: AgentMessage;
  attempts: number;
  lastAttempt: Date;
}

export class AgentCommunicationManager extends EventEmitter {
  private messageQueue: Map<string, MessageQueueItem>;
  private messageLog: Map<string, AgentMessage[]>;
  private communicationDir: string;
  private logger: Logger;

  constructor(baseDirectory: string) {
    super();
    this.messageQueue = new Map();
    this.messageLog = new Map();
    this.communicationDir = path.join(baseDirectory, 'shared', 'communication');
    this.logger = new Logger(baseDirectory);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize logger
      await this.logger.initialize();
      
      // Create communication directory if it doesn't exist
      await fs.mkdir(this.communicationDir, { recursive: true });

      // Create subdirectories for different message types
      const subdirs = ['requests', 'responses', 'events', 'logs', 'acknowledged'];
      await Promise.all(
        subdirs.map(dir => 
          fs.mkdir(path.join(this.communicationDir, dir), { recursive: true })
        )
      );

      await this.logger.info('AgentCommunicationManager', 'Initialized successfully');
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentCommunicationManager', 'Failed to initialize', { error: err.message });
      throw error;
    }
  }

  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<string> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const fullMessage: AgentMessage = {
      ...message,
      id: messageId,
      timestamp,
    };

    try {
      // Store message in appropriate directory
      const typeDir = path.join(this.communicationDir, `${message.type}s`);
      const messagePath = path.join(typeDir, `${messageId}.json`);
      
      await fs.writeFile(
        messagePath,
        JSON.stringify(fullMessage, null, 2)
      );

      // Add to message queue
      this.messageQueue.set(messageId, {
        message: fullMessage,
        attempts: 0,
        lastAttempt: new Date()
      });

      // Add to message log
      if (!this.messageLog.has(message.from)) {
        this.messageLog.set(message.from, []);
      }
      this.messageLog.get(message.from)!.push(fullMessage);

      // Log the message
      await this.logger.info('AgentCommunicationManager', `Message sent from ${message.from} to ${message.to}`, {
        messageId,
        type: message.type,
        content: message.content
      });

      // Emit message event
      this.emit('message', fullMessage);

      return messageId;
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentCommunicationManager', 'Failed to send message', { error: err.message });
      throw error;
    }
  }

  async getMessageHistory(agentId: string): Promise<AgentMessage[]> {
    return this.messageLog.get(agentId) || [];
  }

  async getMessageById(messageId: string): Promise<AgentMessage | null> {
    try {
      // Search in all message type directories
      const dirs = ['requests', 'responses', 'events'];
      for (const dir of dirs) {
        const messagePath = path.join(this.communicationDir, dir, `${messageId}.json`);
        try {
          const content = await fs.readFile(messagePath, 'utf-8');
          return JSON.parse(content);
        } catch (err) {
          // File not found in this directory, continue searching
          continue;
        }
      }
      return null;
    } catch (error) {
      const err = error as Error;
      await this.logger.error('AgentCommunicationManager', 'Failed to get message', { error: err.message });
      throw error;
    }
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    const queueItem = this.messageQueue.get(messageId);
    if (queueItem) {
      this.messageQueue.delete(messageId);
      
      // Move message to acknowledged directory
      const originalPath = path.join(
        this.communicationDir,
        `${queueItem.message.type}s`,
        `${messageId}.json`
      );
      const acknowledgedPath = path.join(
        this.communicationDir,
        'acknowledged',
        `${messageId}.json`
      );
      
      try {
        await fs.rename(originalPath, acknowledgedPath);
      } catch (error) {
        const err = error as Error;
        await this.logger.error('AgentCommunicationManager', 'Failed to move acknowledged message', { 
          messageId,
          error: err.message 
        });
      }
    }
  }

  async cleanupOldMessages(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const dirs = ['requests', 'responses', 'events', 'acknowledged'];

    for (const dir of dirs) {
      const dirPath = path.join(this.communicationDir, dir);
      try {
        const files = await fs.readdir(dirPath);
        await Promise.all(
          files.map(async file => {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            if (now - stats.ctimeMs > maxAge) {
              await fs.unlink(filePath);
            }
          })
        );
      } catch (error) {
        const err = error as Error;
        await this.logger.error('AgentCommunicationManager', `Failed to cleanup directory ${dir}`, { error: err.message });
      }
    }
  }

  async getUnacknowledgedMessages(): Promise<AgentMessage[]> {
    return Array.from(this.messageQueue.values())
      .map(item => item.message);
  }

  async retryFailedMessages(
    maxRetries: number = 3,
    retryDelay: number = 5000
  ): Promise<void> {
    const entries = Array.from(this.messageQueue.entries());
    for (const [messageId, item] of entries) {
      if (
        item.attempts < maxRetries &&
        Date.now() - item.lastAttempt.getTime() > retryDelay
      ) {
        try {
          // Attempt to resend message
          await this.sendMessage(item.message);
          item.attempts++;
          item.lastAttempt = new Date();
        } catch (error) {
          const err = error as Error;
          await this.logger.error('AgentCommunicationManager', `Failed to retry message ${messageId}`, { error: err.message });
        }
      }
    }
  }
}
