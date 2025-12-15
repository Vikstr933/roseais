import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import {
  User,
  Zap,
  MessageCircle,
  Eye,
  Edit3,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface UserActivity {
  userId: string;
  username: string;
  displayName: string;
  activityType: 'generating' | 'chatting' | 'viewing' | 'editing';
  lockType?: 'component_generation' | 'agent_generation' | 'code_generation';
  projectId: number;
  startedAt: string;
  lastSeen: string;
  metadata?: any;
}

interface GenerationLock {
  userId: string;
  username: string;
  displayName: string;
  lockType: string;
  startedAt: string;
}

interface ProjectActivityStatus {
  projectId: number;
  activeUsers: UserActivity[];
  hasActiveGeneration: boolean;
  hasActiveChat: boolean;
  generationLocks: GenerationLock[];
}

interface ActiveUsersIndicatorProps {
  projectId: number;
  currentUserId?: string;
  className?: string;
}

const ActiveUsersIndicator: React.FC<ActiveUsersIndicatorProps> = ({
  projectId,
  currentUserId,
  className = '',
}) => {
  const [activityStatus, setActivityStatus] =
    useState<ProjectActivityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityStatus();

    // Poll for updates every 15 seconds (reduced frequency to avoid rate limits)
    // Only poll when tab is visible to reduce unnecessary requests
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchActivityStatus();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [projectId]);

  const fetchActivityStatus = async () => {
    try {
      const response = await apiFetch(`/api/activity/project/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity status');
      }

      const data = await response.json();
      setActivityStatus(data);
      setError(null);
    } catch (err) {
      // Silently fail - activity tracking is optional
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (activityType: string, lockType?: string) => {
    switch (activityType) {
      case 'generating':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'chatting':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'editing':
        return <Edit3 className="w-4 h-4 text-orange-500" />;
      case 'viewing':
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityLabel = (activityType: string, lockType?: string) => {
    switch (activityType) {
      case 'generating':
        if (lockType) {
          switch (lockType) {
            case 'component_generation':
              return 'Generating components';
            case 'agent_generation':
              return 'Generating agents';
            case 'code_generation':
              return 'Generating code';
            default:
              return 'Generating content';
          }
        }
        return 'Generating';
      case 'chatting':
        return 'Chatting with AI';
      case 'editing':
        return 'Editing files';
      case 'viewing':
        return 'Viewing project';
      default:
        return 'Active';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div
        className={`flex items-center space-x-2 text-sm text-gray-500 ${className}`}
      >
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span>Loading activity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center space-x-2 text-sm text-red-500 ${className}`}
      >
        <AlertCircle className="w-4 h-4" />
        <span>Failed to load activity</span>
      </div>
    );
  }

  if (
    !activityStatus ||
    (activityStatus.activeUsers.length === 0 &&
      activityStatus.generationLocks.length === 0)
  ) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Generation Locks */}
      {activityStatus.generationLocks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              Generation in Progress
            </span>
          </div>
          <div className="space-y-2">
            {activityStatus.generationLocks.map((lock, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-yellow-700">
                    {getInitials(lock.displayName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-yellow-800 truncate">
                    {lock.displayName}
                  </p>
                  <p className="text-xs text-yellow-600">
                    {getActivityLabel('generating', lock.lockType as any)}
                  </p>
                </div>
                <div className="flex items-center space-x-1 text-xs text-yellow-600">
                  <Clock className="w-3 h-3" />
                  <span>{getTimeAgo(lock.startedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Users */}
      {activityStatus.activeUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Active Collaborators ({activityStatus.activeUsers.length})
            </span>
          </div>
          <div className="space-y-2">
            {activityStatus.activeUsers
              .filter(user => user.userId !== currentUserId) // Don't show current user
              .map((user, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-700">
                      {getInitials(user.displayName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-800 truncate">
                      {user.displayName}
                    </p>
                    <div className="flex items-center space-x-1">
                      {getActivityIcon(user.activityType, user.lockType)}
                      <p className="text-xs text-blue-600">
                        {getActivityLabel(user.activityType, user.lockType)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-blue-600">
                    <Clock className="w-3 h-3" />
                    <span>{getTimeAgo(user.lastSeen)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Current User Status */}
      {currentUserId && (
        <div className="text-xs text-gray-500 text-center">
          You are currently viewing this project
        </div>
      )}
    </div>
  );
};

export default ActiveUsersIndicator;
