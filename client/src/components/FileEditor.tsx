import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  X, Save, Loader2, Search, Replace, Undo, Redo, 
  Settings, Maximize2, Minimize2, FileText 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';

interface FileEditorProps {
  file: {
    id: number;
    filePath: string;
    fileContent: string;
    fileType: string;
    version: number;
  };
  projectId: string;
  onClose: () => void;
  onSave?: () => void;
}

// Remove BOM and other invisible characters from the start of the file
function cleanFileContent(content: string): string {
  // Remove BOM (Byte Order Mark) - UTF-8 BOM is \uFEFF
  let cleaned = content.replace(/^\uFEFF/, '');
  
  // Remove other common invisible characters at the start
  cleaned = cleaned.replace(/^[\u200B-\u200D\uFEFF]+/, '');
  
  return cleaned;
}

export function FileEditor({ file, projectId, onClose, onSave }: FileEditorProps) {
  const [content, setContent] = useState(() => cleanFileContent(file.fileContent || ''));
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { toast } = useToast();
  const { sessionToken } = useAuth();

  useEffect(() => {
    const cleaned = cleanFileContent(file.fileContent || '');
    setContent(cleaned);
    setHasChanges(false);
  }, [file.id]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setShowFindReplace(true);
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      setShowFindReplace(true);
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    const originalContent = cleanFileContent(file.fileContent || '');
    setHasChanges(newContent !== originalContent);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast({
        title: 'No changes',
        description: 'No changes to save',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`/api/workspaces/${projectId}/files/${file.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          content: content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save file');
      }

      toast({
        title: 'File saved',
        description: `${file.filePath} has been saved successfully`,
      });

      setHasChanges(false);
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving file:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save file',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFind = () => {
    if (editorRef.current && findText) {
      editorRef.current.getAction('actions.find')?.run();
      // Set the find text
      setTimeout(() => {
        const findInput = document.querySelector('.monaco-findInput input') as HTMLInputElement;
        if (findInput) {
          findInput.value = findText;
          findInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 100);
    }
  };

  const handleReplace = () => {
    if (editorRef.current && findText) {
      editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
      setTimeout(() => {
        const findInput = document.querySelector('.monaco-findInput input') as HTMLInputElement;
        const replaceInput = document.querySelector('.monaco-replaceInput input') as HTMLInputElement;
        if (findInput) {
          findInput.value = findText;
          findInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (replaceInput) {
          replaceInput.value = replaceText;
          replaceInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 100);
    }
  };

  const handleUndo = () => {
    editorRef.current?.trigger('undo', 'undo', {});
  };

  const handleRedo = () => {
    editorRef.current?.trigger('redo', 'redo', {});
  };

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const getFileLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'py': 'python',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'xml': 'xml',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const language = getFileLanguage(file.filePath);

  return (
    <Card className={`${isFullscreen ? 'fixed inset-0 z-50' : 'fixed inset-4 z-50'} flex flex-col bg-background border-2`}>
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{file.filePath}</h3>
            <p className="text-sm text-muted-foreground">
              {file.fileType} • v{file.version} • {language}
            </p>
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasChanges && (
            <span className="text-xs text-muted-foreground mr-2">● Unsaved</span>
          )}
          
          {/* Find/Replace */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFindReplace(!showFindReplace)}
            title="Find (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </Button>
          
          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
          
          {/* Format */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            title="Format Document (Shift+Alt+F)"
          >
            Format
          </Button>
          
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            title="Toggle Theme"
          >
            {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
          </Button>
          
          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          
          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          
          {/* Close */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Find/Replace Bar */}
      {showFindReplace && (
        <div className="border-b p-2 flex items-center gap-2 bg-muted/50 flex-shrink-0">
          <Input
            placeholder="Find..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFind();
              }
            }}
            className="h-8 flex-1"
          />
          <Input
            placeholder="Replace..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="h-8 flex-1"
          />
          <Button size="sm" variant="outline" onClick={handleFind}>
            Find
          </Button>
          <Button size="sm" variant="outline" onClick={handleReplace}>
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowFindReplace(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Editor */}
      <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme={editorTheme}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: false,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            glyphMargin: true,
            bracketPairColorization: {
              enabled: true,
            },
            cursorSmoothCaretAnimation: 'on',
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true,
            },
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            multiCursorModifier: 'ctrlCmd',
            contextmenu: true,
            mouseWheelZoom: true,
            smoothScrolling: true,
            renderWhitespace: 'selection',
            renderLineHighlight: 'all',
            occurrencesHighlight: true,
            selectionHighlight: true,
            codeLens: false,
            colorDecorators: true,
            links: true,
            autoIndent: 'full',
            formatOnSave: false, // We handle saving manually
          }}
        />
      </CardContent>
    </Card>
  );
}
