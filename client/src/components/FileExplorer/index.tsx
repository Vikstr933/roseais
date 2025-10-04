import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface FileExplorerProps {
  workspacePath: string;
  files: { path: string; content: string }[];
  onSelectFile: (index: number) => void;
  selectedFileIndex: number;
  onFileChange?: (path: string, content: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onFileDelete?: (path: string) => void;
  onFileCreate?: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onSelectFile,
  selectedFileIndex,
  onFileCreate,
  workspacePath,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  // Rebuild tree whenever files change with error handling
  const [tree, setTree] = useState(() => buildTree(files, workspacePath));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!files || files.length === 0) {
      setTree({});
      return;
    }

    try {
      setLoading(true);
      const newTree = buildTree(files, workspacePath);
      setTree(newTree);
    } catch (error) {
      console.error('Error building file tree:', error);
      setTree({});
    } finally {
      setLoading(false);
    }
  }, [files, workspacePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No files generated yet</p>
      </div>
    );
  }

  // Convert flat file list to directory tree structure
  const buildTree = useCallback(
    (files: { path: string }[], basePath: string) => {
      const tree: Record<string, any> = {};

      // Filter out empty files
      const validFiles = files.filter(
        file => file.path && file.path.trim() !== ''
      );

      validFiles.forEach(file => {
        // Normalize path by removing workspace prefix
        const normalizedPath = file.path.replace(
          new RegExp(`^${basePath}\/?`),
          ''
        );
        const parts = normalizedPath.split('/');
        let currentLevel = tree;

        parts.forEach((part, index) => {
          if (part) {
            // Skip empty parts
            if (!currentLevel[part]) {
              currentLevel[part] =
                index === parts.length - 1
                  ? { type: 'file', path: file.path }
                  : { type: 'folder', children: {} };
            }
            currentLevel = currentLevel[part].children || {};
          }
        });
      });

      // Remove empty folders
      const removeEmptyFolders = (node: any) => {
        if (node.type === 'folder') {
          Object.keys(node.children).forEach(key => {
            removeEmptyFolders(node.children[key]);
          });

          if (Object.keys(node.children).length === 0) {
            delete node.children;
          }
        }
      };

      Object.keys(tree).forEach(key => {
        removeEmptyFolders(tree[key]);
      });

      return tree;
    },
    []
  );

  const renderTree = (tree: Record<string, any>, path = '') => {
    return Object.entries(tree).map(([name, node]) => {
      const fullPath = path ? `${path}/${name}` : name;

      if (node.type === 'folder') {
        return (
          <div key={fullPath}>
            <div
              className="flex items-center text-sm px-2 py-1 rounded-sm hover:bg-muted cursor-pointer text-muted-foreground"
              onClick={() => {
                setExpandedFolders(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(fullPath)) {
                    newSet.delete(fullPath);
                  } else {
                    newSet.add(fullPath);
                  }
                  return newSet;
                });
              }}
            >
              <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
              {name}
            </div>
            {expandedFolders.has(fullPath) && (
              <div className="pl-4">{renderTree(node.children, fullPath)}</div>
            )}
          </div>
        );
      }

      const fileIndex = files.findIndex(f => f.path === node.path);
      const isSelected = selectedFileIndex === fileIndex;

      return (
        <div
          key={fullPath}
          className={`flex items-center text-sm px-2 py-1 rounded-sm hover:bg-muted cursor-pointer ${
            isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
          }`}
          onClick={() => onSelectFile(fileIndex)}
        >
          {getFileIcon(name)}
          {name}
        </div>
      );
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="h-4 w-4 mr-2 flex-shrink-0" />;
      case 'json':
        return <FileJson className="h-4 w-4 mr-2 flex-shrink-0" />;
      case 'css':
      case 'scss':
        return <FileText className="h-4 w-4 mr-2 flex-shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
        return <FileImage className="h-4 w-4 mr-2 flex-shrink-0" />;
      default:
        return <File className="h-4 w-4 mr-2 flex-shrink-0" />;
    }
  };

  return (
    <div className="space-y-1">
      {renderTree(tree)}
      {creatingFile && (
        <div className="pl-4">
          <div className="flex items-center gap-2">
            <Input
              value={newFilePath}
              onChange={e => setNewFilePath(e.target.value)}
              placeholder="New file name"
              className="h-8"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (newFilePath.trim()) {
                  onFileCreate?.(newFilePath);
                  setCreatingFile(false);
                  setNewFilePath('');
                }
              }}
            >
              Create
            </Button>
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => setCreatingFile(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        New File
      </Button>
    </div>
  );
};
