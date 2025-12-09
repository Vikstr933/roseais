import React, { useState, useCallback, useMemo } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import {
  File,
  Folder,
  FolderOpen,
  Search,
  Plus,
  MoreHorizontal,
  Edit3,
  Trash2,
  Download,
  Copy,
  Eye,
  Code,
  Image,
  Settings,
  FileText,
  Database
} from 'lucide-react';

interface FileItem {
  path: string;
  content: string;
  type?: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
  isNew?: boolean;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  size?: number;
  extension?: string;
}

interface EnhancedFileExplorerProps {
  files: FileItem[];
  selectedFileIndex: number;
  onSelectFile: (index: number) => void;
  onCreateFile?: (path: string, content: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  onDuplicateFile?: (path: string) => void;
  workspacePath?: string;
}

export function EnhancedFileExplorer({
  files,
  selectedFileIndex,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onDuplicateFile,
  workspacePath = '/workspace'
}: EnhancedFileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Build file tree from flat file list
  const fileTree = useMemo(() => {
    const tree: FileNode = {
      name: 'root',
      path: '',
      type: 'folder',
      children: []
    };

    files.forEach((file, index) => {
      const parts = file.path.split('/').filter(Boolean);
      let current = tree;

      parts.forEach((part, partIndex) => {
        const isFile = partIndex === parts.length - 1;
        const currentPath = parts.slice(0, partIndex + 1).join('/');

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
            content: isFile ? file.content : undefined,
            size: isFile ? file.content?.length : undefined,
            extension: isFile ? part.split('.').pop() : undefined
          };
          current.children.push(existing);
        }

        current = existing;
      });
    });

    return tree;
  }, [files]);

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;

    return files.filter(file =>
      file.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const getFileIcon = (fileName: string, isFolder = false) => {
    if (isFolder) {
      return expandedFolders.has(fileName) ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'tsx':
      case 'jsx':
      case 'ts':
      case 'js':
        return <Code className="h-4 w-4 text-blue-500" />;
      case 'css':
      case 'scss':
      case 'sass':
        return <FileText className="h-4 w-4 text-pink-500" />;
      case 'json':
        return <Database className="h-4 w-4 text-yellow-500" />;
      case 'md':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image className="h-4 w-4 text-green-500" />;
      case 'html':
        return <Code className="h-4 w-4 text-orange-500" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getFileTypeColor = (extension?: string) => {
    switch (extension) {
      case 'tsx':
      case 'jsx':
        return 'bg-blue-100 text-blue-700';
      case 'ts':
      case 'js':
        return 'bg-yellow-100 text-yellow-700';
      case 'css':
      case 'scss':
        return 'bg-pink-100 text-pink-700';
      case 'json':
        return 'bg-orange-100 text-orange-700';
      case 'html':
        return 'bg-red-100 text-red-700';
      case 'md':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const handleFileSelect = (filePath: string) => {
    const fileIndex = files.findIndex(f => f.path === filePath);
    if (fileIndex !== -1) {
      onSelectFile(fileIndex);
    }
  };

  const handleRename = (filePath: string) => {
    setEditingFile(filePath);
    setNewFileName(filePath.split('/').pop() || '');
  };

  const commitRename = () => {
    if (editingFile && newFileName && onRenameFile) {
      const oldPath = editingFile;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newFileName;
      const newPath = pathParts.join('/');

      onRenameFile(oldPath, newPath);
    }
    setEditingFile(null);
    setNewFileName('');
  };

  const renderFileNode = (node: FileNode, level = 0): React.ReactNode => {
    if (node.type === 'folder' && node.children) {
      const isExpanded = expandedFolders.has(node.path);

      return (
        <div key={node.path}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer rounded-sm ${
              level > 0 ? `ml-${level * 4}` : ''
            }`}
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${8 + level * 16}px` }}
          >
            {getFileIcon(node.name, true)}
            <span className="text-sm font-medium">{node.name}</span>
            {node.children.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {node.children.length}
              </Badge>
            )}
          </div>

          {isExpanded && node.children.map(child => renderFileNode(child, level + 1))}
        </div>
      );
    }

    // File node
    const fileIndex = files.findIndex(f => f.path === node.path);
    const isSelected = fileIndex === selectedFileIndex;
    const isEditing = editingFile === node.path;

    return (
      <ContextMenu key={node.path}>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer rounded-sm ${
              isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
            }`}
            onClick={() => handleFileSelect(node.path)}
            style={{ paddingLeft: `${8 + level * 16}px` }}
          >
            {getFileIcon(node.name)}

            {isEditing ? (
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') {
                    setEditingFile(null);
                    setNewFileName('');
                  }
                }}
                className="h-6 text-xs flex-1"
                autoFocus
              />
            ) : (
              <>
                <span className="text-sm flex-1 truncate">{node.name}</span>

                {node.extension && (
                  <Badge variant="outline" className={`text-xs ${getFileTypeColor(node.extension)}`}>
                    {node.extension}
                  </Badge>
                )}

                {node.size && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatFileSize(node.size)}
                  </span>
                )}
              </>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleFileSelect(node.path)}>
            <Eye className="h-4 w-4 mr-2" />
            Open
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleRename(node.path)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicateFile?.(node.path)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={() => downloadFile(node.path, node.content || '')}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </ContextMenuItem>
          <Separator />
          <ContextMenuItem
            onClick={() => onDeleteFile?.(node.path)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const downloadFile = (path: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const createNewFile = () => {
    const fileName = prompt('Enter file name:');
    if (fileName && onCreateFile) {
      const fullPath = `src/${fileName}`;
      onCreateFile(fullPath, '// New file\n');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">FILES</h2>
          <Button size="sm" variant="ghost" onClick={createNewFile}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {searchQuery ? (
            // Search results
            <div className="space-y-1">
              {filteredFiles.map((file, index) => (
                <div
                  key={file.path}
                  className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer rounded-sm ${
                    index === selectedFileIndex ? 'bg-primary/10 border-l-2 border-primary' : ''
                  }`}
                  onClick={() => onSelectFile(index)}
                >
                  {getFileIcon(file.path)}
                  <span className="text-sm flex-1 truncate">{file.path}</span>
                </div>
              ))}
            </div>
          ) : (
            // File tree
            <div>
              {fileTree.children?.map(child => renderFileNode(child))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{files.length} files</span>
          <span>{formatFileSize(files.reduce((acc, f) => acc + (f.content?.length || 0), 0))}</span>
        </div>
      </div>
    </div>
  );
}