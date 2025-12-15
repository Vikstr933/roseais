import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';

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

export function FileEditor({ file, projectId, onClose, onSave }: FileEditorProps) {
  const [content, setContent] = useState(file.fileContent || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const { sessionToken } = useAuth();

  useEffect(() => {
    setContent(file.fileContent || '');
    setHasChanges(false);
  }, [file.id]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(e.target.value !== file.fileContent);
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
    };
    return languageMap[ext || ''] || 'text';
  };

  return (
    <Card className="fixed inset-4 z-50 flex flex-col bg-background border-2">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{file.filePath}</h3>
          <p className="text-sm text-muted-foreground">
            {file.fileType} • v{file.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <textarea
            value={content}
            onChange={handleContentChange}
            className="w-full h-full p-4 font-mono text-sm resize-none border-0 focus:outline-none focus:ring-0 bg-background"
            style={{
              minHeight: '100%',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            }}
            spellCheck={false}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

