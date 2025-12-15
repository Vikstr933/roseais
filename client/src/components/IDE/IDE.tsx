import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  X, Save, Loader2, Search, Replace, Undo, Redo, 
  Maximize2, Minimize2, FileText, Folder, FilePlus,
  FolderOpen, GitBranch, Terminal, Settings, 
  ChevronRight, ChevronDown, FileCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
}

interface IDEProps {
  projectId: string;
  projectFiles: ProjectFile[];
  onClose: () => void;
  onFilesUpdate?: () => void;
}

// Remove BOM and other invisible characters
function cleanFileContent(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]+/, '');
}

// Build file tree structure
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

export function IDE({ projectId, projectFiles, onClose, onFilesUpdate }: IDEProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  
  const editorRefs = useRef<(editor.IStandaloneCodeEditor | null)[]>([]);
  const { toast } = useToast();
  const { sessionToken } = useAuth();

  const fileTree = buildFileTree(projectFiles);

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

  // Open file
  const openFile = useCallback((file: ProjectFile) => {
    const existingIndex = openFiles.findIndex(f => f.id === file.id);
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
      return;
    }

    const cleanedContent = cleanFileContent(file.fileContent || '');
    const newFile: OpenFile = {
      id: file.id,
      filePath: file.filePath,
      content: cleanedContent,
      originalContent: cleanedContent,
      isDirty: false,
      language: getFileLanguage(file.filePath)
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFileIndex(openFiles.length);
  }, [openFiles]);

  // Close file
  const closeFile = useCallback((index: number) => {
    const file = openFiles[index];
    if (file.isDirty) {
      if (!confirm(`File ${file.filePath} has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    
    setOpenFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex >= index && activeFileIndex > 0) {
      setActiveFileIndex(activeFileIndex - 1);
    } else if (activeFileIndex === index && openFiles.length > 1) {
      setActiveFileIndex(0);
    }
  }, [openFiles, activeFileIndex]);

  // Save file
  const saveFile = useCallback(async (fileIndex: number) => {
    const file = openFiles[fileIndex];
    if (!file.isDirty) return;

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

      toast({
        title: 'File saved',
        description: `${file.filePath} has been saved successfully`,
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

  // Save all files
  const saveAll = useCallback(async () => {
    for (let i = 0; i < openFiles.length; i++) {
      if (openFiles[i].isDirty) {
        await saveFile(i);
      }
    }
  }, [openFiles, saveFile]);

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

  // Handle editor mount
  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor, index: number) => {
    editorRefs.current[index] = editor;

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(index);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setShowFindReplace(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      setShowFindReplace(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      setShowQuickSwitcher(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      setShowGlobalSearch(true);
    });
  }, [saveFile]);

  // Handle content change
  const handleContentChange = useCallback((value: string | undefined, index: number) => {
    const newContent = value || '';
    setOpenFiles(prev => prev.map((f, i) => {
      if (i === index) {
        return {
          ...f,
          content: newContent,
          isDirty: newContent !== f.originalContent
        };
      }
      return f;
    }));
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P: Quick switcher
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
      // Ctrl+Shift+F: Global search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      // Ctrl+O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        // Open file picker would go here
      }
      // Ctrl+N: New file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewFileDialog(true);
      }
      // Escape: Close dialogs
      if (e.key === 'Escape') {
        setShowQuickSwitcher(false);
        setShowGlobalSearch(false);
        setShowFindReplace(false);
        setShowNewFileDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter files for quick switcher
  const quickSwitcherFiles = projectFiles.filter(file =>
    file.filePath.toLowerCase().includes(quickSwitcherQuery.toLowerCase())
  );

  // Render file tree
  const renderFileTree = (node: FileTreeNode, level: number = 0) => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="flex items-center text-sm px-2 py-1 hover:bg-muted cursor-pointer"
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
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            <Folder className="h-4 w-4 mr-1" />
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
      <div
        key={node.path}
        className="flex items-center text-sm px-2 py-1 hover:bg-muted cursor-pointer"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => openFile(file)}
      >
        <FileText className="h-4 w-4 mr-1" />
        <span className="flex-1 truncate">{node.name}</span>
      </div>
    );
  };

  const activeFile = openFiles[activeFileIndex];

  return (
    <Card className={`${isFullscreen ? 'fixed inset-0 z-50' : 'fixed inset-4 z-50'} flex flex-col bg-background border-2`}>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between border-b pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFileExplorer(!showFileExplorer)}
          >
            <Folder className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold truncate">
            Project IDE
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowNewFileDialog(true)} title="New File (Ctrl+N)">
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowQuickSwitcher(true)} title="Quick Switcher (Ctrl+P)">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowGlobalSearch(true)} title="Search in Files (Ctrl+Shift+F)">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTerminal(!showTerminal)} title="Terminal">
            <Terminal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}>
            {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
          </Button>
          <Button variant="ghost" size="sm" onClick={saveAll} disabled={!openFiles.some(f => f.isDirty)}>
            <Save className="h-4 w-4 mr-1" />
            Save All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File Explorer Sidebar */}
        {showFileExplorer && (
          <div className="w-64 border-r bg-muted/30 flex flex-col">
            <div className="p-2 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase">Explorer</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewFileDialog(true)}
                >
                  <FilePlus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
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
            <div className="border-b bg-muted/20 flex items-center overflow-x-auto">
              {openFiles.map((file, index) => (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-3 py-2 border-r cursor-pointer min-w-fit ${
                    index === activeFileIndex
                      ? 'bg-background border-b-2 border-b-primary'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setActiveFileIndex(index)}
                >
                  <FileCode className="h-3 w-3" />
                  <span className="text-sm truncate max-w-[200px]">{file.filePath}</span>
                  {file.isDirty && <span className="text-xs">●</span>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          {activeFile ? (
            <div className="flex-1 relative">
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                theme={editorTheme}
                onChange={(value) => handleContentChange(value, activeFileIndex)}
                onMount={(editor) => handleEditorMount(editor, activeFileIndex)}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true,
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
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No file open</p>
                <p className="text-sm mt-2">Click a file in the explorer to open it</p>
              </div>
            </div>
          )}

          {/* Terminal */}
          {showTerminal && (
            <div className="h-64 border-t bg-black text-green-400 font-mono text-sm p-4">
              <div className="mb-2">Terminal (Coming soon - xterm.js integration)</div>
              <div className="opacity-50">$ Ready for commands...</div>
            </div>
          )}
        </div>
      </div>

      {/* Find/Replace Bar */}
      {showFindReplace && activeFile && (
        <div className="border-t p-2 flex items-center gap-2 bg-muted/50">
          <Input
            placeholder="Find..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            className="h-8"
          />
          <Input
            placeholder="Replace..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="h-8"
          />
          <Button size="sm" onClick={() => editorRefs.current[activeFileIndex]?.getAction('actions.find')?.run()}>
            Find
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowFindReplace(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Quick Switcher Dialog */}
      {showQuickSwitcher && (
        <Dialog open={showQuickSwitcher} onOpenChange={setShowQuickSwitcher}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Quick Switcher (Ctrl+P)</DialogTitle>
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
                    className="p-2 hover:bg-muted cursor-pointer rounded"
                    onClick={() => {
                      openFile(file);
                      setShowQuickSwitcher(false);
                      setQuickSwitcherQuery('');
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{file.filePath}</span>
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
              <DialogTitle>Create New File</DialogTitle>
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
              <Button onClick={createNewFile} disabled={!newFileName.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Global Search Dialog */}
      {showGlobalSearch && (
        <Dialog open={showGlobalSearch} onOpenChange={setShowGlobalSearch}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Search in Files (Ctrl+Shift+F)</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Search across all files..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              autoFocus
            />
            <ScrollArea className="max-h-96">
              <div className="text-sm text-muted-foreground p-4 text-center">
                Global search functionality coming soon...
                <br />
                This will search across all project files and show results with context.
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

