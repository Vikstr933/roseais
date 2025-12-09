import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Users,
  Eye,
  Edit3,
  Save,
  Zap,
  MessageCircle,
  Clock,
  WifiOff,
  Wifi
} from 'lucide-react';
import { cn } from '../lib/utils';

interface CollaborativeCodeEditorProps {
  projectId: number;
  fileName: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  height?: number | string;
  readOnly?: boolean;
  className?: string;
}

interface CollaborativeCursor {
  userId: string;
  username: string;
  line: number;
  column: number;
  color: string;
}

interface UserActivity {
  userId: string;
  username: string;
  activityType: 'viewing' | 'editing' | 'generating' | 'chatting';
  lastActivity: string;
}

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
];

export const CollaborativeCodeEditor: React.FC<CollaborativeCodeEditorProps> = ({
  projectId,
  fileName,
  language,
  value,
  onChange,
  onSave,
  height = 400,
  readOnly = false,
  className
}) => {
  const { user } = useAuth();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [cursors, setCursors] = useState<CollaborativeCursor[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserActivity[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const userColorRef = useRef<string>(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);

  // WebSocket integration
  const {
    isConnected,
    activeUsers: wsActiveUsers,
    updateFile,
    updateActivity,
    updateCursorPosition,
    notifyGenerationStart,
    notifyGenerationEnd
  } = useWebSocket({
    projectId,
    userId: user?.id,
    username: user?.displayName || user?.username || 'Anonymous',
    onFileUpdate: handleRemoteFileUpdate,
    onCursorPosition: handleRemoteCursorUpdate,
    onGenerationStart: handleRemoteGenerationStart,
    onGenerationEnd: handleRemoteGenerationEnd,
    onActivityUpdate: handleRemoteActivityUpdate
  });

  // Handle remote file updates
  function handleRemoteFileUpdate(data: any) {
    if (data.fileName === fileName && data.userId !== user?.id) {
      // Update the editor content without losing cursor position
      const editor = editorRef.current;
      if (editor && data.content !== undefined) {
        const currentPosition = editor.getPosition();
        onChange(data.content);

        // Restore cursor position after content update
        if (currentPosition) {
          setTimeout(() => {
            editor.setPosition(currentPosition);
          }, 0);
        }
      }
    }
  }

  // Handle remote cursor updates
  function handleRemoteCursorUpdate(data: any) {
    if (data.fileName === fileName && data.userId !== user?.id) {
      setCursors(prev => {
        const existing = prev.find(c => c.userId === data.userId);
        const userColor = existing?.color || CURSOR_COLORS[prev.length % CURSOR_COLORS.length];

        const newCursor: CollaborativeCursor = {
          userId: data.userId,
          username: data.username,
          line: data.line,
          column: data.column,
          color: userColor
        };

        if (existing) {
          return prev.map(c => c.userId === data.userId ? newCursor : c);
        }
        return [...prev, newCursor];
      });

      // Remove cursor after 30 seconds of inactivity
      setTimeout(() => {
        setCursors(prev => prev.filter(c => c.userId !== data.userId));
      }, 30000);
    }
  }

  // Handle remote generation events
  function handleRemoteGenerationStart(data: any) {
    if (data.userId !== user?.id) {
      setIsGenerating(true);
    }
  }

  function handleRemoteGenerationEnd(data: any) {
    if (data.userId !== user?.id) {
      setIsGenerating(false);
    }
  }

  // Handle remote activity updates
  function handleRemoteActivityUpdate(data: any) {
    setActiveUsers(prev => prev.map(u =>
      u.userId === data.userId
        ? { ...u, activityType: data.activityType, lastActivity: new Date().toISOString() }
        : u
    ));
  }

  // Editor event handlers
  const handleEditorChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined && newValue !== value) {
      onChange(newValue);
      setHasUnsavedChanges(true);

      // Notify other users of the file update
      updateFile(fileName, newValue, 'edit');

      // Update activity to editing
      updateActivity('editing');
    }
  }, [value, onChange, fileName, updateFile, updateActivity]);

  const handleCursorPositionChange = useCallback(() => {
    const editor = editorRef.current;
    if (editor && user?.id) {
      const position = editor.getPosition();
      if (position) {
        updateCursorPosition(fileName, position.lineNumber, position.column);
      }
    }
  }, [fileName, updateCursorPosition, user?.id]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave();
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    }
  }, [onSave]);

  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition(handleCursorPositionChange);

    // Listen for focus events to update activity
    editor.onDidFocusEditorText(() => {
      updateActivity('editing');
    });

    editor.onDidBlurEditorText(() => {
      updateActivity('viewing');
    });

    // Create decorations for collaborative cursors
    editor.onDidChangeCursorPosition(() => {
      renderCollaborativeCursors(editor);
    });
  }, [handleCursorPositionChange, updateActivity]);

  // Render collaborative cursors in the editor
  const renderCollaborativeCursors = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    if (!editor) return;

    const decorations = cursors.map(cursor => ({
      range: new monaco.Range(cursor.line, cursor.column, cursor.line, cursor.column + 1),
      options: {
        className: 'collaborative-cursor',
        beforeContentClassName: 'collaborative-cursor-before',
        afterContentClassName: 'collaborative-cursor-after',
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        hoverMessage: { value: `${cursor.username} is here` }
      }
    }));

    editor.deltaDecorations([], decorations);
  }, [cursors]);

  // Update activity when component mounts/unmounts
  useEffect(() => {
    updateActivity('viewing');
    return () => {
      updateActivity('viewing');
    };
  }, [updateActivity]);

  // Sync active users from WebSocket
  useEffect(() => {
    setActiveUsers(wsActiveUsers);
  }, [wsActiveUsers]);

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timer = setTimeout(() => {
        handleSave();
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, handleSave]);

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'editing': return <Edit3 className="w-3 h-3" />;
      case 'generating': return <Zap className="w-3 h-3" />;
      case 'chatting': return <MessageCircle className="w-3 h-3" />;
      case 'viewing': return <Eye className="w-3 h-3" />;
      default: return <Eye className="w-3 h-3" />;
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'editing': return 'text-orange-600 bg-orange-100';
      case 'generating': return 'text-blue-600 bg-blue-100';
      case 'chatting': return 'text-green-600 bg-green-100';
      case 'viewing': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Collaboration Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Collaborative Editing - {fileName}
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

              {/* Save Status */}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs">
                  Unsaved Changes
                </Badge>
              )}

              {lastSaved && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Saved {lastSaved.toLocaleTimeString()}
                </Badge>
              )}

              {/* Save Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className="text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Active Users */}
          {activeUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeUsers
                .filter(user => user.userId !== user?.id)
                .map((activeUser) => (
                  <Badge
                    key={activeUser.userId}
                    variant="outline"
                    className={cn(
                      "text-xs flex items-center gap-1",
                      getActivityColor(activeUser.activityType)
                    )}
                  >
                    {getActivityIcon(activeUser.activityType)}
                    {activeUser.username}
                  </Badge>
                ))}
            </div>
          )}

          {/* Generation Status */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded mb-4">
              <Zap className="w-4 h-4 animate-pulse" />
              AI is generating code...
            </div>
          )}

          {/* Editor */}
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height={height}
              language={language}
              value={value}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                readOnly: readOnly || isGenerating,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                theme: 'vs-dark',
                cursorSmoothCaretAnimation: 'on',
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                formatOnPaste: true,
                formatOnType: true
              }}
              theme="vs-dark"
            />
          </div>

          {/* Cursor Indicators */}
          {cursors.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Active cursors:</span>
                {cursors.map((cursor) => (
                  <Badge
                    key={cursor.userId}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: cursor.color, color: cursor.color }}
                  >
                    {cursor.username} (L{cursor.line}:C{cursor.column})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSS for collaborative cursors */}
      <style>{`
        .collaborative-cursor {
          border-left: 2px solid var(--cursor-color, #007ACC);
          animation: blink 1s infinite;
        }

        .collaborative-cursor-before {
          content: '';
          position: absolute;
          top: -2px;
          left: -1px;
          width: 8px;
          height: 8px;
          background: var(--cursor-color, #007ACC);
          border-radius: 50%;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default CollaborativeCodeEditor;