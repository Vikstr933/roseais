import React, { useState } from "react";
import { Folder, File, FileText, FileCode, FileJson, FileImage } from "lucide-react";

export interface FileExplorerProps {
  workspacePath: string;
  files: { path: string; content: string }[];
  onSelectFile: (index: number) => void;
  selectedFileIndex: number;
  onFileChange?: (path: string, content: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onFileDelete?: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onSelectFile,
  selectedFileIndex
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Convert flat file list to directory tree structure
  const buildTree = (files: { path: string }[]) => {
    const tree: Record<string, any> = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = tree;
      
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = index === parts.length - 1 ? 
            { type: 'file', path: file.path } : 
            { type: 'folder', children: {} };
        }
        currentLevel = currentLevel[part].children || {};
      });
    });

    return tree;
  };

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
              <div className="pl-4">
                {renderTree(node.children, fullPath)}
              </div>
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

  const tree = buildTree(files);
  return (
    <div className="space-y-1">
      {renderTree(tree)}
    </div>
  );
};

export default FileExplorer;
