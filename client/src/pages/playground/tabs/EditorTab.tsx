import { useState } from "react";
import { Code, FileCode, Trash2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Badge } from "../../../components/ui/badge";
import { EnhancedFileExplorer } from "../../../components/EnhancedFileExplorer";
import { EmptyState } from "../../../components/EmptyState";
import { createGeneratedFile, getFileLanguage } from "../utils";
import type { GeneratedFile, PlaygroundResponse } from "../types";

interface EditorTabProps {
  response: PlaygroundResponse | null;
  selectedFileIndex: number;
  setSelectedFileIndex: (index: number) => void;
  editorLanguage: string;
  setEditorLanguage: (lang: string) => void;
  editorTheme: 'vs-dark' | 'light';
  isLoading: boolean;
  updateGeneratedFiles: (files: GeneratedFile[]) => void;
  setResponse: React.Dispatch<React.SetStateAction<PlaygroundResponse | null>>;
  addChatMessage: (message: any) => void;
}

export function EditorTab({
  response,
  selectedFileIndex,
  setSelectedFileIndex,
  editorLanguage,
  setEditorLanguage,
  editorTheme,
  isLoading,
  updateGeneratedFiles,
  setResponse,
  addChatMessage,
}: EditorTabProps) {
  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row">
      {/* File Explorer - Full width on mobile with better height, fixed width on desktop */}
      <div className="w-full md:w-[240px] bg-muted/30 min-h-0 border-r border-border flex-shrink-0 h-[250px] md:h-auto md:max-h-none overflow-auto md:overflow-visible">
        <div className="h-full min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/50">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">EXPLORER</h2>
            {/* Clear All Files Button */}
            {response && typeof response === 'object' && response.files && response.files.length > 0 && (
              <button
                onClick={() => {
                  // Clear files from UI state
                  setResponse(null);
                  // Clear files from workspace session
                  updateGeneratedFiles([]);
                  // Clear selected file
                  setSelectedFileIndex(0);
                  // Notify user
                  addChatMessage({
                    role: 'assistant',
                    content: 'All files cleared from workspace',
                    timestamp: Date.now()
                  });
                }}
                className="text-xs px-2 py-0.5 rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-1"
                title="Clear all files"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2">
              {(() => {
                const isComponent = response?.type === 'component';
                const fileCount = isComponent ? (response?.files?.length || 0) : 0;
                const fileList = response?.files || [];
                console.log('🗂️ FileExplorer render - files:', fileCount, 'paths:', fileList.map(f => f.path));
                return isComponent && fileCount > 0;
              })() ? (
                <EnhancedFileExplorer
                  key={`files-${response?.files?.length || 0}-${response?.files?.map(f => f.path).join(',') || ''}`}
                  workspacePath="/workspaces"
                  files={(response?.files || []).map((file) => {
                    const cleanedPath = file.path.replace(/^\/workspaces\//, '');
                    return cleanedPath === file.path ? file : createGeneratedFile(cleanedPath, file.content);
                  })}
                  onSelectFile={(index: number) => {
                    setSelectedFileIndex(index);
                    const selectedFile = response?.files?.[index];
                    if (selectedFile) {
                      setEditorLanguage(getFileLanguage(selectedFile.path));
                    }
                  }}
                  selectedFileIndex={selectedFileIndex}
                  onCreateFile={(path: string, content: string) => {
                    const newFile = createGeneratedFile(path, content);
                    const updatedFiles = response?.files?.length ? [...response.files, newFile] : [newFile];
                    setResponse({
                      type: 'component',
                      text: response?.text || '',
                      files: updatedFiles
                    });
                    updateGeneratedFiles(updatedFiles);
                  }}
                  onDeleteFile={(path: string) => {
                    if (!response?.files) return;
                    const updatedFiles = response.files.filter(f => f.path !== path);
                    setResponse(prev => (prev ? { ...prev, files: updatedFiles } : prev));
                    updateGeneratedFiles(updatedFiles);
                  }}
                  onRenameFile={(oldPath: string, newPath: string) => {
                    if (!response?.files) return;
                    const updatedFiles = response.files.map(f =>
                      f.path === oldPath ? createGeneratedFile(newPath, f.content) : f
                    );
                    setResponse(prev => (prev ? { ...prev, files: updatedFiles } : prev));
                    updateGeneratedFiles(updatedFiles);
                  }}
                  onDuplicateFile={(path: string) => {
                    if (!response?.files) return;
                    const originalFile = response.files.find(f => f.path === path);
                    if (!originalFile) return;
                    const duplicatePath = path.replace(/(\.[^.]+)$/, '_copy$1');
                    const duplicatedFile = createGeneratedFile(duplicatePath, originalFile.content);
                    const updatedFiles = [...response.files, duplicatedFile];
                    setResponse(prev => (prev ? { ...prev, files: updatedFiles } : prev));
                    updateGeneratedFiles(updatedFiles);
                  }}
                />
              ) : (
                <EmptyState
                  icon={Code}
                  title={isLoading ? "Generating code..." : "No files yet"}
                  description={isLoading ? "Our AI agents are creating your application files. They'll appear here shortly!" : "Start a conversation to generate code. Describe what you want to build and watch the magic happen."}
                  className="py-8"
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Editor Area - Full width on mobile, reduced on desktop */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-0 left-0 w-full h-full md:w-1/2 md:h-1/2 overflow-hidden bg-background">
          {/* IDE-like Frame with Header Bar - Full width on mobile, centered on desktop */}
          <div className="h-full flex flex-col bg-card border border-border md:rounded-lg md:shadow-lg overflow-hidden md:m-[15%]">
            {/* Header Bar - IDE Style */}
            {typeof response === 'object' &&
             response?.type === 'component' &&
             response.files &&
             response.files[selectedFileIndex] ? (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {response.files[selectedFileIndex].path}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {editorLanguage}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* IDE-style dots (macOS window controls) */}
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    No file selected
                  </span>
                </div>
              </div>
            )}
            
            {/* Editor Container */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* Show Editor - Always visible, updates in real-time as files are generated */}
              {typeof response === 'object' &&
               response?.type === 'component' &&
               response.files &&
               response.files[selectedFileIndex] ? (
                <Editor
                  height="100%"
                  defaultLanguage={editorLanguage}
                  language={editorLanguage}
                  value={response.files[selectedFileIndex].content}
                  theme={editorTheme}
                  onChange={(value) => {
                    // Update the file content in local state
                    if (value !== undefined && response?.files) {
                      const updatedFiles = response.files.map((file, idx) =>
                        idx === selectedFileIndex ? { ...file, content: value } : file
                      );
                      setResponse({ ...response, files: updatedFiles });

                      // Sync to workspace for persistence
                      updateGeneratedFiles(updatedFiles);
                    }
                  }}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: "on",
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: false,
                    wordWrap: "on",
                    suggestOnTriggerCharacters: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: true,
                    folding: true,
                    glyphMargin: true,
                    bracketPairColorization: {
                      enabled: true
                    }
                  }}
                />
              ) : !isLoading && (
                <EmptyState
                  icon={FileCode}
                  title="No File Selected"
                  description="Select a file from the explorer to view and edit its code. Generate a component to get started."
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

