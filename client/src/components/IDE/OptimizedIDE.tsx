import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Save, Loader2, Search, Undo, Redo,
  Maximize2, Minimize2, FileText, Folder, FilePlus,
  Terminal as TerminalIcon, ChevronRight, ChevronDown, FileCode, Trash2, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import Editor from '@monaco-editor/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from '@/components/ui/menubar';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

interface ProjectFile {
  id: number;
  filePath: string;
  fileContent: string;
  fileType: string;
  version: number;
  updatedAt: string;
}

interface OpenFile {
  id: number;
  filePath: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
  lastAccessed: number; // For LRU cache
  isLoaded: boolean; // Lazy loading flag
}

interface IDEProps {
  projectId: string;
  projectFiles: ProjectFile[];
  onClose: () => void;
  onFilesUpdate?: () => void;
  initialFileId?: number; // Optional: open this file on mount
}

// Performance constants
const MAX_OPEN_FILES = 10; // LRU cache limit
const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce
const FILE_CACHE_SIZE = 50; // Max files in memory cache

// Remove BOM and invisible characters
function cleanFileContent(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]+/, '');
}

// File tree structure
interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  fileId?: number;
}

function buildFileTree(files: ProjectFile[]): FileTreeNode {
  const tree: FileTreeNode = {
    name: 'root',
    path: '',
    type: 'folder',
    children: []
  };

  files.forEach(file => {
    const parts = file.filePath.split('/').filter(Boolean);
    let current = tree;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');

      if (!current.children) {
        current.children = [];
      }

      let existing = current.children.find(child => child.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          fileId: isFile ? file.id : undefined
        };
        current.children.push(existing);
      }

      current = existing;
    });
  });

  return tree;
}

// Simple virtual scrolling for file tree (without external dependency)
function useVirtualScroll<T>(items: T[], itemHeight: number = 24, containerHeight: number = 600) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  return {
    visibleItems,
    offsetY,
    totalHeight,
    setScrollTop,
    visibleStart,
    visibleEnd
  };
}

export function OptimizedIDE({ projectId, projectFiles, onClose, onFilesUpdate, initialFileId }: IDEProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const terminalStreamRef = useRef<EventSource | null>(null);
  
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const fileCache = useRef<Map<number, string>>(new Map()); // LRU cache for file contents
  const { toast } = useToast();
  const { sessionToken } = useAuth();

  // Memoize file tree to avoid rebuilding on every render
  const fileTree = useMemo(() => buildFileTree(projectFiles), [projectFiles]);

  // Flatten file tree for virtual scrolling
  const flatFileList = useMemo(() => {
    const flatten = (node: FileTreeNode, level: number = 0): Array<{ node: FileTreeNode; level: number }> => {
      const result: Array<{ node: FileTreeNode; level: number }> = [];
      if (node.type === 'folder') {
        result.push({ node, level });
        if (expandedFolders.has(node.path) && node.children) {
          node.children.forEach(child => {
            result.push(...flatten(child, level + 1));
          });
        }
      } else {
        result.push({ node, level });
      }
      return result;
    };
    return fileTree.children ? fileTree.children.flatMap(child => flatten(child)) : [];
  }, [fileTree, expandedFolders]);

  const getFileLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'json': 'json', 'css': 'css', 'html': 'html', 'py': 'python', 'md': 'markdown',
      'yaml': 'yaml', 'yml': 'yaml', 'sql': 'sql', 'sh': 'shell', 'bash': 'shell',
      'xml': 'xml', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'go': 'go', 'rs': 'rust',
      'php': 'php', 'rb': 'ruby',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  // LRU: Find least recently used file
  const findLRUFile = useCallback(() => {
    if (openFiles.length === 0) return -1;
    let lruIndex = 0;
    let oldestTime = openFiles[0].lastAccessed;
    openFiles.forEach((file, index) => {
      if (file.lastAccessed < oldestTime) {
        oldestTime = file.lastAccessed;
        lruIndex = index;
      }
    });
    return lruIndex;
  }, [openFiles]);

  // Open file with lazy loading and LRU cache management
  const openFile = useCallback(async (file: ProjectFile) => {
    const existingIndex = openFiles.findIndex(f => f.id === file.id);
    if (existingIndex >= 0) {
      // Update last accessed time
      setOpenFiles(prev => prev.map((f, i) => 
        i === existingIndex ? { ...f, lastAccessed: Date.now() } : f
      ));
      setActiveFileIndex(existingIndex);
      return;
    }

    // Check if we need to close a file (LRU cache limit)
    if (openFiles.length >= MAX_OPEN_FILES) {
      const lruIndex = findLRUFile();
      if (lruIndex >= 0) {
        const lruFile = openFiles[lruIndex];
        if (lruFile.isDirty) {
          if (!confirm(`File ${lruFile.filePath} has unsaved changes. Close anyway?`)) {
            return;
          }
        }
        // Remove from cache
        fileCache.current.delete(lruFile.id);
        setOpenFiles(prev => prev.filter((_, i) => i !== lruIndex));
        if (activeFileIndex >= lruIndex) {
          setActiveFileIndex(Math.max(0, activeFileIndex - 1));
        }
      }
    }

    // Lazy load: Check cache first
    let content: string;
    if (fileCache.current.has(file.id)) {
      content = fileCache.current.get(file.id)!;
    } else {
      // Load from file (already has content, but we clean it)
      content = cleanFileContent(file.fileContent || '');
      // Add to cache (with size limit)
      if (fileCache.current.size >= FILE_CACHE_SIZE) {
        // Remove oldest entry (simple FIFO for cache)
        const firstKey = fileCache.current.keys().next().value;
        if (firstKey !== undefined) {
          fileCache.current.delete(firstKey);
        }
      }
      fileCache.current.set(file.id, content);
    }

    const newFile: OpenFile = {
      id: file.id,
      filePath: file.filePath,
      content,
      originalContent: content,
      isDirty: false,
      language: getFileLanguage(file.filePath),
      lastAccessed: Date.now(),
      isLoaded: true
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFileIndex(openFiles.length);
  }, [openFiles, findLRUFile, activeFileIndex]);

  // Close file
  const closeFile = useCallback((index: number) => {
    const file = openFiles[index];
    if (file.isDirty) {
      if (!confirm(`File ${file.filePath} has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    
    // Clear save timeout
    const timeout = saveTimeouts.current.get(file.id);
    if (timeout) {
      clearTimeout(timeout);
      saveTimeouts.current.delete(file.id);
    }
    
    // Remove from cache if not dirty (keep dirty files in cache)
    if (!file.isDirty) {
      fileCache.current.delete(file.id);
    }
    
    setOpenFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex >= index && activeFileIndex > 0) {
      setActiveFileIndex(activeFileIndex - 1);
    } else if (activeFileIndex === index && openFiles.length > 1) {
      setActiveFileIndex(0);
    }
  }, [openFiles, activeFileIndex]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback((fileIndex: number) => {
    const file = openFiles[fileIndex];
    if (!file) return;

    // Clear existing timeout
    const existingTimeout = saveTimeouts.current.get(file.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new save
    const timeout = setTimeout(async () => {
      await saveFile(fileIndex);
    }, AUTO_SAVE_DELAY);

    saveTimeouts.current.set(file.id, timeout);
  }, [openFiles]);

  // Save file
  const saveFile = useCallback(async (fileIndex: number) => {
    const file = openFiles[fileIndex];
    if (!file || !file.isDirty) return;

    setIsSaving(true);
    try {
      const response = await apiFetch(`/api/workspaces/${projectId}/files/${file.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({ content: file.content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save file');
      }

      setOpenFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, isDirty: false, originalContent: f.content } : f
      ));

      // Update cache
      fileCache.current.set(file.id, file.content);

      toast({
        title: 'File saved',
        description: `${file.filePath} has been saved`,
      });

      if (onFilesUpdate) {
        onFilesUpdate();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save file',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [openFiles, projectId, sessionToken, toast, onFilesUpdate]);

  // Delete file (soft delete via API)
  const deleteFile = useCallback(
    async (fileId: number, filePath: string) => {
      if (!confirm(`Delete "${filePath}" from this project? This cannot be undone inside the app.`)) {
        return;
      }

      setIsDeleting(true);
      try {
        const response = await apiFetch(`/api/workspaces/${projectId}/files/${fileId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(sessionToken),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete file');
        }

        // Remove from open files
        setOpenFiles(prev => prev.filter(f => f.id !== fileId));
        // Remove from cache
        fileCache.current.delete(fileId);

        toast({
          title: 'File deleted',
          description: `${filePath} has been deleted`,
        });

        if (onFilesUpdate) {
          onFilesUpdate();
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete file',
          variant: 'destructive',
        });
      } finally {
        setIsDeleting(false);
      }
    },
    [projectId, sessionToken, toast, onFilesUpdate]
  );

  // Save all files
  const saveAll = useCallback(async () => {
    // Clear all pending auto-saves
    saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
    saveTimeouts.current.clear();

    for (let i = 0; i < openFiles.length; i++) {
      if (openFiles[i].isDirty) {
        await saveFile(i);
      }
    }
  }, [openFiles, saveFile]);

  // Close all tabs except the one at index
  const closeOtherTabs = useCallback((index: number) => {
    setOpenFiles(prev => {
      const keep = prev[index];
      if (!keep) return prev;

      // Clear timeouts and caches for others
      prev.forEach((file, i) => {
        if (i !== index) {
          const timeout = saveTimeouts.current.get(file.id);
          if (timeout) {
            clearTimeout(timeout);
            saveTimeouts.current.delete(file.id);
          }
          if (!file.isDirty) {
            fileCache.current.delete(file.id);
          }
        }
      });

      return [keep];
    });
    setActiveFileIndex(0);
  }, []);

  // Close all tabs
  const closeAllTabs = useCallback(() => {
    setOpenFiles(prev => {
      prev.forEach(file => {
        const timeout = saveTimeouts.current.get(file.id);
        if (timeout) {
          clearTimeout(timeout);
          saveTimeouts.current.delete(file.id);
        }
        if (!file.isDirty) {
          fileCache.current.delete(file.id);
        }
      });
      return [];
    });
    setActiveFileIndex(0);
  }, []);

  // Create new file
  const createNewFile = useCallback(async () => {
    if (!newFileName.trim()) return;

    setIsSaving(true);
    try {
      const response = await apiFetch(`/api/workspaces/${projectId}/files`, {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          files: [{ path: newFileName, content: '' }]
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create file');
      }

      toast({
        title: 'File created',
        description: `${newFileName} has been created`,
      });

      setShowNewFileDialog(false);
      setNewFileName('');
      
      if (onFilesUpdate) {
        onFilesUpdate();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create file',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [newFileName, projectId, sessionToken, toast, onFilesUpdate]);

  // Handle content change with debounced auto-save
  const handleContentChange = useCallback((value: string | undefined, index: number) => {
    const newContent = value || '';
    setOpenFiles(prev => {
      const updated = prev.map((f, i) => {
        if (i === index) {
          return {
            ...f,
            content: newContent,
            isDirty: newContent !== f.originalContent,
            lastAccessed: Date.now()
          };
        }
        return f;
      });
      return updated;
    });

    // Schedule auto-save
    scheduleAutoSave(index);
  }, [scheduleAutoSave]);

  // Global keyboard shortcuts (ctrl+p for quick switcher, ctrl+n for new file)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewFileDialog(true);
      }
      if (e.key === 'Escape') {
        setShowQuickSwitcher(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open initial file on mount if provided
  useEffect(() => {
    if (initialFileId && projectFiles.length > 0 && openFiles.length === 0) {
      const fileToOpen = projectFiles.find(f => f.id === initialFileId);
      if (fileToOpen) {
        openFile(fileToOpen);
      }
    }
  }, [initialFileId, projectFiles, openFiles.length, openFile]); // Run when initialFileId or projectFiles change

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
    };
  }, []);

  // Initialize xterm.js terminal and subscribe to backend terminal stream
  useEffect(() => {
    if (!showTerminal) {
      // Hide terminal: do not destroy xterm instance, but stop streaming
      if (terminalStreamRef.current) {
        terminalStreamRef.current.close();
        terminalStreamRef.current = null;
      }
      return;
    }

    if (!terminalContainerRef.current) return;

    // Lazy-init xterm instance
    if (!xtermRef.current) {
      const term = new Terminal({
        convertEol: true,
        fontSize: 13,
        theme: {
          background: '#000000',
          foreground: '#d1fae5',
        },
      });
      xtermRef.current = term;
      term.open(terminalContainerRef.current);
      term.writeln('IDE Terminal (logs)');
      term.writeln('Listening for build/deploy output...');
      term.writeln('');
    }

    // Subscribe to terminal SSE stream for this project
    try {
      const streamUrl = getApiUrl(`/api/terminal/${encodeURIComponent(projectId)}/stream`);
      console.log('[IDE Terminal] Connecting to:', streamUrl);
      
      const stream = new EventSource(streamUrl, {
        withCredentials: true,
      });

      stream.onopen = () => {
        console.log('[IDE Terminal] Connection opened');
        xtermRef.current?.writeln('[terminal] Connected to log stream');
      };

      stream.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'output' && typeof payload.data === 'string') {
            xtermRef.current?.writeln(payload.data);
          } else if (payload?.type === 'heartbeat') {
            // Silently handle heartbeats
          }
        } catch {
          // Fallback: write raw data
          if (event.data) {
            xtermRef.current?.writeln(String(event.data));
          }
        }
      };

      stream.onerror = (error) => {
        console.error('[IDE Terminal] Connection error:', error);
        // Check if connection is closed
        if (stream.readyState === EventSource.CLOSED) {
          xtermRef.current?.writeln('[terminal] Connection closed. Check if endpoint exists: /api/terminal/' + projectId + '/stream');
        } else {
          xtermRef.current?.writeln('[terminal] Connection error. Retrying...');
        }
      };

      terminalStreamRef.current = stream;
    } catch (error) {
      console.error('[IDE Terminal] Failed to create EventSource:', error);
      xtermRef.current?.writeln('[terminal] Failed to connect to terminal stream: ' + (error instanceof Error ? error.message : String(error)));
    }

    return () => {
      if (terminalStreamRef.current) {
        terminalStreamRef.current.close();
        terminalStreamRef.current = null;
      }
    };
  }, [showTerminal, projectId]);

  // Filter files for quick switcher
  const quickSwitcherFiles = useMemo(() => 
    projectFiles.filter(file =>
      file.filePath.toLowerCase().includes(quickSwitcherQuery.toLowerCase())
    ),
    [projectFiles, quickSwitcherQuery]
  );

  // Render file tree with virtual scrolling
  const renderFileTree = (node: FileTreeNode, level: number = 0) => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="flex items-center text-sm px-2 py-1 hover:bg-purple-100/50 cursor-pointer text-purple-900 dark:text-purple-100"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              setExpandedFolders(prev => {
                const newSet = new Set(prev);
                if (newSet.has(node.path)) {
                  newSet.delete(node.path);
                } else {
                  newSet.add(node.path);
                }
                return newSet;
              });
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 mr-1 text-purple-600" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1 text-purple-600" />
            )}
            <Folder className="h-4 w-4 mr-1 text-purple-600" />
            <span className="flex-1 truncate">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderFileTree(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const file = projectFiles.find(f => f.id === node.fileId);
    if (!file) return null;

    return (
      <ContextMenu key={node.path}>
        <ContextMenuTrigger asChild>
          <div
            className="flex items-center text-sm px-2 py-1 hover:bg-purple-100/50 cursor-pointer text-purple-900 dark:text-purple-100"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => openFile(file)}
          >
            <FileText className="h-4 w-4 mr-1 text-purple-500" />
            <span className="flex-1 truncate">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => openFile(file)}>Open</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={isDeleting}
            className="text-destructive"
            onClick={() => deleteFile(file.id, file.filePath)}
          >
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const activeFile = openFiles[activeFileIndex];

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[100]' : 'fixed inset-4 z-[100]'}`}>
    <Card className="flex flex-col bg-background border-2 border-purple-200/50 relative h-full w-full">
      {/* Animated brand gradient border glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-purple-500/0 animate-[shimmer_3s_ease-in-out_infinite] opacity-30" />
      </div>

      {/* Header with brand gradient accent */}
      <CardHeader className="flex flex-row items-center justify-between border-b border-purple-200/50 pb-2 flex-shrink-0 bg-gradient-to-r from-purple-50/50 via-purple-50/30 to-transparent relative">
        {/* Subtle animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400/5 via-pink-400/5 to-purple-400/5 opacity-50 animate-[shimmer_4s_ease-in-out_infinite]" />
        
        <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFileExplorer(!showFileExplorer)}
            className="hover:bg-purple-100 text-purple-600 hover:text-purple-700 transition-all hover:scale-105"
          >
            <Folder className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold truncate flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-[pulse_2s_ease-in-out_infinite]" />
              <span className="brand-gradient-text font-bold text-base">Vik IDE</span>
            </div>
            <span className="text-muted-foreground text-xs">({openFiles.length}/{MAX_OPEN_FILES} files)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowNewFileDialog(true)} 
            title="New File (Ctrl+N)"
            className="hover:bg-purple-100 text-purple-600 hover:text-purple-700"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowQuickSwitcher(true)} 
            title="Quick Switcher (Ctrl+P)"
            className="hover:bg-purple-100 text-purple-600 hover:text-purple-700"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowTerminal(!showTerminal)} 
            title="Terminal"
            className="hover:bg-purple-100 text-purple-600 hover:text-purple-700"
          >
            <TerminalIcon className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            className="hover:bg-purple-100"
          >
            {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
          </Button>
          <Button 
            variant={openFiles.some(f => f.isDirty) ? "default" : "ghost"}
            size="sm" 
            onClick={saveAll} 
            disabled={!openFiles.some(f => f.isDirty)}
            className={openFiles.some(f => f.isDirty) ? "brand-gradient text-white hover:opacity-90" : "hover:bg-purple-100 disabled:opacity-50"}
          >
            <Save className="h-4 w-4 mr-1" />
            <span className="font-medium">Save All</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hover:bg-purple-100"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Top menubar like classic IDEs */}
      <div className="border-b border-purple-200/50 px-2 py-1 bg-purple-50/30 flex-shrink-0 relative">
        {/* Subtle animated gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400/0 via-purple-400/40 to-purple-400/0 opacity-60 animate-[shimmer_3s_ease-in-out_infinite]" />
        <Menubar className="relative z-10">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowNewFileDialog(true)}>
                New File
                <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => setShowQuickSwitcher(true)}>
                Open File...
                <MenubarShortcut>Ctrl+P</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                disabled={!openFiles[activeFileIndex]?.isDirty}
                onClick={() => saveFile(activeFileIndex)}
              >
                Save
                <MenubarShortcut>Ctrl+S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={saveAll} disabled={!openFiles.some(f => f.isDirty)}>
                Save All
                <MenubarShortcut>Ctrl+Shift+S</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Undo
                <MenubarShortcut>Ctrl+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Redo
                <MenubarShortcut>Ctrl+Y</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowFileExplorer(v => !v)}>
                Toggle File Explorer
              </MenubarItem>
              <MenubarItem onClick={() => setShowTerminal(v => !v)}>
                Toggle Terminal
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Go</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowQuickSwitcher(true)}>
                Go to File...
                <MenubarShortcut>Ctrl+P</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Run</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowTerminal(true)}>
                Run Command...
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Terminal</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setShowTerminal(v => !v)}>
                Show/Hide Terminal
                <MenubarShortcut>Ctrl+`</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File Explorer Sidebar */}
        {showFileExplorer && (
          <div className="w-64 border-r border-purple-200/50 bg-purple-50/20 flex flex-col relative">
            {/* Subtle animated gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-50 animate-[shimmer_3s_ease-in-out_infinite]" />
            <div className="p-2 border-b border-purple-200/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 animate-[spin_4s_linear_infinite]" />
                  Explorer
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewFileDialog(true)}
                  className="hover:bg-purple-100 text-purple-600 hover:text-purple-700"
                >
                  <FilePlus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]]:scrollbar-thin [&>[data-radix-scroll-area-viewport]]:scrollbar-thumb-purple-300 [&>[data-radix-scroll-area-viewport]]:scrollbar-track-purple-100/50 hover:[&>[data-radix-scroll-area-viewport]]:scrollbar-thumb-purple-400">
              <div className="p-1">
                {fileTree.children?.map(child => renderFileTree(child))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="border-b border-purple-200/50 bg-purple-50/30 flex items-center overflow-x-auto relative">
              {/* Animated accent line under tabs */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400/0 via-purple-400/50 to-purple-400/0 animate-[shimmer_2s_ease-in-out_infinite]" />
              {openFiles.map((file, index) => (
                <ContextMenu key={file.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 border-r border-purple-200/30 cursor-pointer min-w-fit transition-all duration-200 ${
                        index === activeFileIndex
                          ? 'bg-background border-b-2 border-b-purple-600 text-purple-700 dark:text-purple-400 shadow-[0_2px_8px_rgba(139,92,246,0.15)]'
                          : 'bg-purple-50/50 hover:bg-purple-100/50 text-purple-800/70 dark:text-purple-300/70 hover:shadow-[0_1px_4px_rgba(139,92,246,0.1)]'
                      }`}
                      onClick={() => setActiveFileIndex(index)}
                    >
                      <FileCode className={`h-3 w-3 ${index === activeFileIndex ? 'text-purple-600' : 'text-purple-500'}`} />
                      <span className="text-sm truncate max-w-[200px]">{file.filePath}</span>
                      {file.isDirty && <span className="text-xs text-purple-600">●</span>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-purple-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(index);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => closeFile(index)}>Close</ContextMenuItem>
                    <ContextMenuItem onClick={() => closeOtherTabs(index)}>Close Others</ContextMenuItem>
                    <ContextMenuItem onClick={closeAllTabs}>Close All</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      disabled={isDeleting}
                      className="text-destructive"
                      onClick={() => deleteFile(file.id, file.filePath)}
                    >
                      Delete File
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}

          {/* Editor - Only render active tab for performance */}
          {activeFile ? (
            <div className="flex-1 relative">
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                theme={editorTheme}
                onChange={(value) => handleContentChange(value, activeFileIndex)}
                options={{
                  minimap: { enabled: openFiles.length < 5 }, // Disable for many files
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true, // Keep for responsive, but consider manual for performance
                  wordWrap: 'on',
                  formatOnPaste: true,
                  formatOnType: true,
                  tabSize: 2,
                  insertSpaces: true,
                  detectIndentation: true,
                  folding: true,
                  bracketPairColorization: { enabled: true },
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  // Performance optimizations
                  renderValidationDecorations: 'off', // Can be heavy for large files
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection', // Less rendering
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground relative">
              {/* Subtle animated background pattern */}
              <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,1),transparent_70%)] animate-[pulse_4s_ease-in-out_infinite]" />
              <div className="text-center relative z-10">
                <div className="relative inline-block mb-4">
                  <FileText className="h-12 w-12 mx-auto opacity-50 text-purple-400 animate-[float_3s_ease-in-out_infinite]" />
                  <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-purple-500 animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
                <p className="text-purple-700 dark:text-purple-300 font-medium">No file open</p>
                <p className="text-sm mt-2 text-purple-600/70 dark:text-purple-400/70">Click a file in the explorer to open it</p>
              </div>
            </div>
          )}

          {/* Terminal */}
          {showTerminal && (
            <div className="h-64 border-t bg-black text-green-400 font-mono text-sm">
              <div ref={terminalContainerRef} className="h-full w-full overflow-hidden px-2 py-1" />
            </div>
          )}
        </div>
      </div>

      {/* Quick Switcher */}
      {showQuickSwitcher && (
        <Dialog open={showQuickSwitcher} onOpenChange={setShowQuickSwitcher}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-purple-700 dark:text-purple-400">Quick Switcher (Ctrl+P)</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Type to search files..."
              value={quickSwitcherQuery}
              onChange={(e) => setQuickSwitcherQuery(e.target.value)}
              autoFocus
            />
            <ScrollArea className="max-h-96">
              <div className="space-y-1">
                {quickSwitcherFiles.map(file => (
                  <div
                    key={file.id}
                    className="p-2 hover:bg-purple-100/50 cursor-pointer rounded transition-colors"
                    onClick={() => {
                      openFile(file);
                      setShowQuickSwitcher(false);
                      setQuickSwitcherQuery('');
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-purple-900 dark:text-purple-100">{file.filePath}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* New File Dialog */}
      {showNewFileDialog && (
        <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-purple-700 dark:text-purple-400">Create New File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>File Path</Label>
                <Input
                  placeholder="e.g., src/components/NewComponent.tsx"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      createNewFile();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createNewFile} 
                disabled={!newFileName.trim() || isSaving}
                className="brand-gradient text-white hover:opacity-90"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
    </div>
  );
}

