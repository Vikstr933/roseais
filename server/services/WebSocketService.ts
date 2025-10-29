import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { projectFiles, chatMessages, users, workspaces } from '../../db/schema-pg';
import { eq, and, or, sql } from 'drizzle-orm';
import { parse } from 'url';

const logger = new SimpleLogger('WebSocketService');

export interface WebSocketMessage {
  type: 'join_project' | 'leave_project' | 'file_update' | 'chat_message' | 'user_activity' | 'generation_start' | 'generation_end' | 'cursor_position';
  projectId?: number;
  userId?: string;
  data?: any;
  timestamp?: string;
}

export interface ConnectedUser {
  ws: WebSocket;
  userId: string;
  username: string;
  projectId: number;
  lastActivity: Date;
  activityType: 'viewing' | 'editing' | 'generating' | 'chatting';
}

export class WebSocketService {
  private wss?: WebSocketServer;
  private connections = new Map<WebSocket, ConnectedUser>();
  private projectUsers = new Map<number, Set<string>>(); // projectId -> userIds
  private userActivity = new Map<string, ConnectedUser>(); // userId -> activity

  constructor() {
    this.setupHeartbeat();
  }

  initialize(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: async (info, callback) => {
        try {
          // Extract token from query string or headers
          const { query } = parse(info.req.url || '', true);
          const token = query.token as string ||
                       info.req.headers['authorization']?.replace('Bearer ', '') ||
                       info.req.headers['sec-websocket-protocol'];

          if (!token) {
            logger.warn('WebSocket connection attempted without token');
            callback(false, 401, 'Unauthorized: No token provided');
            return;
          }

          // Verify user exists in database (simple auth check)
          // In production, you would verify JWT token here
          try {
            const user = await db.query.users.findFirst({
              where: (users, { eq }) => eq(users.id, token)
            });

            if (!user) {
              logger.warn('WebSocket connection with invalid user token', { token });
              callback(false, 401, 'Unauthorized: Invalid token');
              return;
            }

            // Store user info on request for later use
            (info.req as any).user = {
              id: user.id,
              username: user.username,
              email: user.email
            };

            logger.info('WebSocket authentication successful', {
              userId: user.id,
              username: user.username
            });
            callback(true);
          } catch (dbError) {
            logger.error('Database error during WebSocket auth', dbError as Error);
            callback(false, 500, 'Internal server error');
          }
        } catch (error) {
          logger.error('WebSocket verification error', error as Error);
          callback(false, 500, 'Internal server error');
        }
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    logger.info('WebSocket service initialized with authentication');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage) {
    logger.info('New WebSocket connection', {
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent']
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', error);
      this.handleDisconnection(ws);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'user_activity',
      data: { status: 'connected' },
      timestamp: new Date().toISOString()
    });
  }

  private handleMessage(ws: WebSocket, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'join_project':
          this.handleJoinProject(ws, message);
          break;
        case 'leave_project':
          this.handleLeaveProject(ws, message);
          break;
        case 'file_update':
          this.handleFileUpdate(ws, message);
          break;
        case 'chat_message':
          this.handleChatMessage(ws, message);
          break;
        case 'user_activity':
          this.handleUserActivity(ws, message);
          break;
        case 'generation_start':
          this.handleGenerationStart(ws, message);
          break;
        case 'generation_end':
          this.handleGenerationEnd(ws, message);
          break;
        case 'cursor_position':
          this.handleCursorPosition(ws, message);
          break;
        default:
          logger.warn('Unknown message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message', error as Error);
    }
  }

  private async handleJoinProject(ws: WebSocket, message: WebSocketMessage) {
    const { projectId, userId, data } = message;

    if (!projectId || !userId || !data?.username) {
      logger.warn('Invalid join_project message', { projectId, userId });
      this.sendMessage(ws, {
        type: 'user_activity',
        data: {
          action: 'error',
          error: 'Invalid join request'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Verify user has access to this project
    const hasAccess = await this.verifyProjectAccess(userId, projectId);

    if (!hasAccess) {
      logger.warn('User attempted to join project without access', { userId, projectId });
      this.sendMessage(ws, {
        type: 'user_activity',
        data: {
          action: 'error',
          error: 'Access denied to this project'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Store user connection
    const user: ConnectedUser = {
      ws,
      userId,
      username: data.username,
      projectId,
      lastActivity: new Date(),
      activityType: 'viewing'
    };

    this.connections.set(ws, user);
    this.userActivity.set(userId, user);

    // Add to project users
    if (!this.projectUsers.has(projectId)) {
      this.projectUsers.set(projectId, new Set());
    }
    this.projectUsers.get(projectId)!.add(userId);

    logger.info('User joined project', { userId, projectId, username: data.username });

    // Notify other users in the project
    this.broadcastToProject(projectId, {
      type: 'user_activity',
      data: {
        action: 'user_joined',
        userId,
        username: data.username,
        activityType: 'viewing'
      },
      timestamp: new Date().toISOString()
    }, userId);

    // Send current active users to the new user
    this.sendActiveUsers(ws, projectId);
  }

  private async verifyProjectAccess(userId: string, projectId: number): Promise<boolean> {
    try {
      // Check if user owns the workspace or is a collaborator
      const workspace = await db.query.workspaces.findFirst({
        where: (workspaces, { eq, and, or }) => and(
          eq(workspaces.id, projectId),
          or(
            eq(workspaces.ownerId, userId),
            sql`${userId} = ANY(${workspaces.collaborators})`
          )
        )
      });

      return !!workspace;
    } catch (error) {
      logger.error('Error verifying project access', error as Error, { userId, projectId });
      return false;
    }
  }

  private handleLeaveProject(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    this.removeUserFromProject(connection);
  }

  private handleFileUpdate(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    const { projectId, data } = message;

    logger.info('File update received', {
      projectId,
      userId: connection.userId,
      fileName: data?.fileName
    });

    // Update user activity
    connection.activityType = 'editing';
    connection.lastActivity = new Date();

    // Broadcast file update to other users in the project
    this.broadcastToProject(projectId || connection.projectId, {
      type: 'file_update',
      data: {
        fileName: data?.fileName,
        content: data?.content,
        userId: connection.userId,
        username: connection.username,
        operation: data?.operation || 'edit'
      },
      timestamp: new Date().toISOString()
    }, connection.userId);
  }

  private async handleChatMessage(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    const { projectId, data } = message;

    try {
      // Save chat message to database
      await db.insert(chatMessages).values({
        projectId: projectId || connection.projectId,
        userId: connection.userId,
        role: 'user',
        content: data?.content || '',
        metadata: { username: connection.username }
      });

      // Update user activity
      connection.activityType = 'chatting';
      connection.lastActivity = new Date();

      // Broadcast chat message to other users
      this.broadcastToProject(projectId || connection.projectId, {
        type: 'chat_message',
        data: {
          content: data?.content,
          userId: connection.userId,
          username: connection.username,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }, connection.userId);

      logger.info('Chat message handled', {
        projectId: projectId || connection.projectId,
        userId: connection.userId
      });
    } catch (error) {
      logger.error('Error saving chat message', error as Error);
    }
  }

  private handleUserActivity(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    const { data } = message;

    if (data?.activityType) {
      connection.activityType = data.activityType;
    }
    connection.lastActivity = new Date();

    // Broadcast activity update to other users
    this.broadcastToProject(connection.projectId, {
      type: 'user_activity',
      data: {
        action: 'activity_update',
        userId: connection.userId,
        username: connection.username,
        activityType: connection.activityType,
        ...data
      },
      timestamp: new Date().toISOString()
    }, connection.userId);
  }

  private handleGenerationStart(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.activityType = 'generating';
    connection.lastActivity = new Date();

    this.broadcastToProject(connection.projectId, {
      type: 'generation_start',
      data: {
        userId: connection.userId,
        username: connection.username,
        generationType: message.data?.generationType || 'code'
      },
      timestamp: new Date().toISOString()
    }, connection.userId);
  }

  private handleGenerationEnd(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.activityType = 'viewing';
    connection.lastActivity = new Date();

    this.broadcastToProject(connection.projectId, {
      type: 'generation_end',
      data: {
        userId: connection.userId,
        username: connection.username,
        success: message.data?.success || true,
        result: message.data?.result
      },
      timestamp: new Date().toISOString()
    }, connection.userId);
  }

  private handleCursorPosition(ws: WebSocket, message: WebSocketMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    // Broadcast cursor position to other users (for collaborative editing)
    this.broadcastToProject(connection.projectId, {
      type: 'cursor_position',
      data: {
        userId: connection.userId,
        username: connection.username,
        fileName: message.data?.fileName,
        line: message.data?.line,
        column: message.data?.column
      },
      timestamp: new Date().toISOString()
    }, connection.userId);
  }

  private handleDisconnection(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (connection) {
      this.removeUserFromProject(connection);
      logger.info('User disconnected', {
        userId: connection.userId,
        projectId: connection.projectId
      });
    }
  }

  private removeUserFromProject(connection: ConnectedUser) {
    const { userId, projectId, username } = connection;

    // Remove from maps
    this.connections.delete(connection.ws);
    this.userActivity.delete(userId);

    const projectUserSet = this.projectUsers.get(projectId);
    if (projectUserSet) {
      projectUserSet.delete(userId);
      if (projectUserSet.size === 0) {
        this.projectUsers.delete(projectId);
      }
    }

    // Notify other users
    this.broadcastToProject(projectId, {
      type: 'user_activity',
      data: {
        action: 'user_left',
        userId,
        username
      },
      timestamp: new Date().toISOString()
    }, userId);
  }

  private sendActiveUsers(ws: WebSocket, projectId: number) {
    const activeUsers: any[] = [];
    const projectUserSet = this.projectUsers.get(projectId);

    if (projectUserSet) {
      for (const userId of projectUserSet) {
        const user = this.userActivity.get(userId);
        if (user) {
          activeUsers.push({
            userId: user.userId,
            username: user.username,
            activityType: user.activityType,
            lastActivity: user.lastActivity.toISOString()
          });
        }
      }
    }

    this.sendMessage(ws, {
      type: 'user_activity',
      data: {
        action: 'active_users',
        users: activeUsers
      },
      timestamp: new Date().toISOString()
    });
  }

  private broadcastToProject(projectId: number, message: WebSocketMessage, excludeUserId?: string) {
    const projectUserSet = this.projectUsers.get(projectId);
    if (!projectUserSet) return;

    for (const userId of projectUserSet) {
      if (excludeUserId && userId === excludeUserId) continue;

      const user = this.userActivity.get(userId);
      if (user && user.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(user.ws, message);
      }
    }
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending WebSocket message', error as Error);
      }
    }
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.connections.forEach((connection, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if user has been inactive for too long (5 minutes)
          const timeSinceActivity = Date.now() - connection.lastActivity.getTime();
          if (timeSinceActivity > 5 * 60 * 1000) {
            connection.activityType = 'viewing'; // Reset to viewing if inactive
          }

          // Send ping
          ws.ping();
        } else {
          this.handleDisconnection(ws);
        }
      });
    }, 30000); // Every 30 seconds
  }

  // Public methods for external use
  public notifyFileChange(projectId: number, fileName: string, content: string, userId: string) {
    this.broadcastToProject(projectId, {
      type: 'file_update',
      data: {
        fileName,
        content,
        userId,
        operation: 'external_update'
      },
      timestamp: new Date().toISOString()
    });
  }

  public notifyGenerationComplete(projectId: number, result: any, userId: string) {
    this.broadcastToProject(projectId, {
      type: 'generation_end',
      data: {
        userId,
        success: true,
        result
      },
      timestamp: new Date().toISOString()
    });
  }

  public getActiveUsers(projectId: number): ConnectedUser[] {
    const activeUsers: ConnectedUser[] = [];
    const projectUserSet = this.projectUsers.get(projectId);

    if (projectUserSet) {
      for (const userId of projectUserSet) {
        const user = this.userActivity.get(userId);
        if (user) {
          activeUsers.push(user);
        }
      }
    }

    return activeUsers;
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getProjectUserCount(projectId: number): number {
    return this.projectUsers.get(projectId)?.size || 0;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;