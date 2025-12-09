import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  MessageCircle,
  Send,
  Users,
  Clock,
  Code,
  FileText,
  Zap,
  WifiOff,
  Wifi
} from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'file_share' | 'code_share';
  metadata?: any;
}

interface CollaborativeChatProps {
  projectId: number;
  className?: string;
  height?: number | string;
}

export const CollaborativeChat: React.FC<CollaborativeChatProps> = ({
  projectId,
  className,
  height = 400
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebSocket integration
  const {
    isConnected,
    activeUsers,
    sendChatMessage,
    updateActivity
  } = useWebSocket({
    projectId,
    userId: user?.id,
    username: user?.displayName || user?.username || 'Anonymous',
    onChatMessage: handleNewMessage,
    onUserJoin: handleUserJoin,
    onUserLeave: handleUserLeave,
    onActivityUpdate: handleActivityUpdate
  });

  // Handle new chat messages
  function handleNewMessage(data: any) {
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      userId: data.userId,
      username: data.username,
      content: data.content,
      timestamp: data.timestamp || new Date().toISOString(),
      type: data.type || 'text',
      metadata: data.metadata
    };

    setMessages(prev => [...prev, message]);
    scrollToBottom();
  }

  // Handle user join
  function handleUserJoin(user: any) {
    const systemMessage: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      userId: 'system',
      username: 'System',
      content: `${user.username} joined the project`,
      timestamp: new Date().toISOString(),
      type: 'system'
    };

    setMessages(prev => [...prev, systemMessage]);
    scrollToBottom();
  }

  // Handle user leave
  function handleUserLeave(userId: string) {
    const user = activeUsers.find(u => u.userId === userId);
    if (user) {
      const systemMessage: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        userId: 'system',
        username: 'System',
        content: `${user.username} left the project`,
        timestamp: new Date().toISOString(),
        type: 'system'
      };

      setMessages(prev => [...prev, systemMessage]);
      scrollToBottom();
    }
  }

  // Handle activity updates (typing indicators)
  function handleActivityUpdate(data: any) {
    if (data.activityType === 'chatting' && data.userId !== user?.id) {
      setIsTyping(prev => {
        if (!prev.includes(data.username)) {
          return [...prev, data.username];
        }
        return prev;
      });

      // Remove typing indicator after 3 seconds
      setTimeout(() => {
        setIsTyping(prev => prev.filter(u => u !== data.username));
      }, 3000);
    }
  }

  // Send message
  const handleSendMessage = () => {
    if (newMessage.trim() && user?.id) {
      // Add message locally first for immediate feedback
      const localMessage: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        userId: user.id,
        username: user.displayName || user.username || 'You',
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      setMessages(prev => [...prev, localMessage]);

      // Send via WebSocket
      sendChatMessage(newMessage.trim());

      setNewMessage('');
      scrollToBottom();
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Update activity to chatting when typing
    if (e.target.value.length > 0) {
      updateActivity('chatting');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user initials
  const getUserInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get message icon
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'system': return <Users className="w-3 h-3" />;
      case 'file_share': return <FileText className="w-3 h-3" />;
      case 'code_share': return <Code className="w-3 h-3" />;
      default: return <MessageCircle className="w-3 h-3" />;
    }
  };

  // Get message color
  const getMessageColor = (type: string) => {
    switch (type) {
      case 'system': return 'bg-gray-100 text-gray-700';
      case 'file_share': return 'bg-blue-100 text-blue-700';
      case 'code_share': return 'bg-green-100 text-green-700';
      default: return 'bg-white';
    }
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Project Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>

            {/* Active Users Count */}
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {activeUsers.length} online
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" style={{ height }}>
          <div className="space-y-3 py-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-colors",
                  message.userId === user?.id ? "ml-8" : "mr-8",
                  getMessageColor(message.type)
                )}
              >
                {/* Avatar */}
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {message.type === 'system' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      getUserInitials(message.username)
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {message.username}
                    </span>
                    {getMessageIcon(message.type)}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicators */}
            {isTyping.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>
                  {isTyping.join(', ')} {isTyping.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConnected}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Active Users */}
          {activeUsers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {activeUsers.map((activeUser) => (
                <Badge
                  key={activeUser.userId}
                  variant="outline"
                  className="text-xs"
                >
                  {activeUser.username}
                  {activeUser.activityType === 'editing' && <Edit3 className="w-3 h-3 ml-1" />}
                  {activeUser.activityType === 'generating' && <Zap className="w-3 h-3 ml-1" />}
                  {activeUser.activityType === 'chatting' && <MessageCircle className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CollaborativeChat;