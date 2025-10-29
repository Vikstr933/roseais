import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: 'join_project' | 'leave_project' | 'file_update' | 'chat_message' | 'user_activity' | 'generation_start' | 'generation_end' | 'cursor_position';
  projectId?: number;
  userId?: string;
  data?: any;
  timestamp?: string;
}

export interface ActiveUser {
  userId: string;
  username: string;
  activityType: 'viewing' | 'editing' | 'generating' | 'chatting';
  lastActivity: string;
}

interface UseWebSocketOptions {
  projectId?: number;
  userId?: string;
  username?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onUserJoin?: (user: ActiveUser) => void;
  onUserLeave?: (userId: string) => void;
  onFileUpdate?: (data: any) => void;
  onChatMessage?: (data: any) => void;
  onActivityUpdate?: (data: any) => void;
  onGenerationStart?: (data: any) => void;
  onGenerationEnd?: (data: any) => void;
  onCursorPosition?: (data: any) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    projectId,
    userId,
    username,
    onMessage,
    onUserJoin,
    onUserLeave,
    onFileUpdate,
    onChatMessage,
    onActivityUpdate,
    onGenerationStart,
    onGenerationEnd,
    onCursorPosition,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      setConnectionStatus('connecting');
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Join project if specified
        if (projectId && userId && username) {
          sendMessage({
            type: 'join_project',
            projectId,
            userId,
            data: { username }
          });
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          // Call general message handler
          onMessage?.(message);

          // Handle specific message types
          switch (message.type) {
            case 'user_activity':
              handleUserActivity(message.data);
              break;
            case 'file_update':
              onFileUpdate?.(message.data);
              break;
            case 'chat_message':
              onChatMessage?.(message.data);
              break;
            case 'generation_start':
              onGenerationStart?.(message.data);
              break;
            case 'generation_end':
              onGenerationEnd?.(message.data);
              break;
            case 'cursor_position':
              onCursorPosition?.(message.data);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [projectId, userId, username, onMessage, onFileUpdate, onChatMessage, onActivityUpdate, onGenerationStart, onGenerationEnd, onCursorPosition]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Send leave project message before closing
      if (projectId && userId) {
        sendMessage({
          type: 'leave_project',
          projectId,
          userId
        });
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    setActiveUsers([]);
  }, [projectId, userId]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, []);

  const handleUserActivity = useCallback((data: any) => {
    switch (data.action) {
      case 'user_joined':
        const newUser: ActiveUser = {
          userId: data.userId,
          username: data.username,
          activityType: data.activityType || 'viewing',
          lastActivity: new Date().toISOString()
        };
        setActiveUsers(prev => {
          const existing = prev.find(u => u.userId === data.userId);
          if (existing) {
            return prev.map(u => u.userId === data.userId ? newUser : u);
          }
          return [...prev, newUser];
        });
        onUserJoin?.(newUser);
        break;

      case 'user_left':
        setActiveUsers(prev => prev.filter(u => u.userId !== data.userId));
        onUserLeave?.(data.userId);
        break;

      case 'activity_update':
        setActiveUsers(prev => prev.map(user =>
          user.userId === data.userId
            ? { ...user, activityType: data.activityType, lastActivity: new Date().toISOString() }
            : user
        ));
        onActivityUpdate?.(data);
        break;

      case 'active_users':
        setActiveUsers(data.users || []);
        break;
    }
  }, [onUserJoin, onUserLeave, onActivityUpdate]);

  // Helper methods for common actions
  const joinProject = useCallback((projectId: number, userId: string, username: string) => {
    return sendMessage({
      type: 'join_project',
      projectId,
      userId,
      data: { username }
    });
  }, [sendMessage]);

  const leaveProject = useCallback((projectId: number, userId: string) => {
    return sendMessage({
      type: 'leave_project',
      projectId,
      userId
    });
  }, [sendMessage]);

  const updateFile = useCallback((fileName: string, content: string, operation: string = 'edit') => {
    return sendMessage({
      type: 'file_update',
      projectId,
      data: { fileName, content, operation }
    });
  }, [sendMessage, projectId]);

  const sendChatMessage = useCallback((content: string) => {
    return sendMessage({
      type: 'chat_message',
      projectId,
      data: { content }
    });
  }, [sendMessage, projectId]);

  const updateActivity = useCallback((activityType: 'viewing' | 'editing' | 'generating' | 'chatting', metadata?: any) => {
    return sendMessage({
      type: 'user_activity',
      data: { activityType, ...metadata }
    });
  }, [sendMessage]);

  const notifyGenerationStart = useCallback((generationType: string = 'code') => {
    return sendMessage({
      type: 'generation_start',
      data: { generationType }
    });
  }, [sendMessage]);

  const notifyGenerationEnd = useCallback((success: boolean = true, result?: any) => {
    return sendMessage({
      type: 'generation_end',
      data: { success, result }
    });
  }, [sendMessage]);

  const updateCursorPosition = useCallback((fileName: string, line: number, column: number) => {
    return sendMessage({
      type: 'cursor_position',
      data: { fileName, line, column }
    });
  }, [sendMessage]);

  // Auto-connect when hook is used
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Join project when parameters change
  useEffect(() => {
    if (isConnected && projectId && userId && username) {
      joinProject(projectId, userId, username);
    }
  }, [isConnected, projectId, userId, username, joinProject]);

  return {
    isConnected,
    connectionStatus,
    activeUsers,
    connect,
    disconnect,
    sendMessage,
    joinProject,
    leaveProject,
    updateFile,
    sendChatMessage,
    updateActivity,
    notifyGenerationStart,
    notifyGenerationEnd,
    updateCursorPosition,
  };
};

export default useWebSocket;