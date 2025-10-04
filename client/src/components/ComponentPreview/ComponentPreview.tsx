import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Download, Play, StopCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useServerStatus } from '../../hooks/useServerStatus';

interface PreviewProps {
  componentName: string;
  files: {
    path: string;
    content: string;
  }[];
}

export function ComponentPreview({ componentName, files }: PreviewProps) {
  const [activeTab, setActiveTab] = useState('preview');
  const [selectedFile, setSelectedFile] = useState(files[0]?.path);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { status: serverStatus } = useServerStatus();

  const handleStartServer = useCallback(async () => {
    try {
      // Save edited files
      const response = await fetch('/api/components/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName,
          files: files.map(file => ({
            path: file.path,
            content: editedFiles[file.path] || file.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to save files');

      // Start development server
      const serverResponse = await fetch('/api/components/start-server', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ componentName }),
      });

      if (!serverResponse.ok) throw new Error('Failed to start server');

      const { url } = await serverResponse.json();
      setPreviewUrl(url);

      toast({
        title: 'Development Server Started',
        description: `Preview available at ${url}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to start server',
        variant: 'destructive',
      });
    }
  }, [componentName, editedFiles, toast]);

  const handleStopServer = useCallback(async () => {
    try {
      const response = await fetch('/api/components/stop-server', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ componentName }),
      });

      if (!response.ok) throw new Error('Failed to stop server');

      setPreviewUrl(null);

      toast({
        title: 'Server Stopped',
        description: 'Development server has been stopped',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to stop server',
        variant: 'destructive',
      });
    }
  }, [componentName, toast]);

  // Initialize edited files with original content
  useEffect(() => {
    const initialContent: Record<string, string> = {};
    files.forEach(file => {
      initialContent[file.path] = file.content;
    });
    setEditedFiles(initialContent);
  }, [files]);

  // Auto-start server when component is loaded
  useEffect(() => {
    if (files.length > 0 && !previewUrl) {
      handleStartServer();
    }
  }, [files, previewUrl, handleStartServer]);

  const handleFileEdit = (path: string, content: string) => {
    setEditedFiles(prev => ({
      ...prev,
      [path]: content,
    }));
  };

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch('/api/components/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName,
          files: files.map(file => ({
            path: file.path,
            content: editedFiles[file.path] || file.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to generate download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${componentName.toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Started',
        description: 'Your component files are being downloaded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download files',
        variant: 'destructive',
      });
    }
  }, [componentName, editedFiles, toast]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end gap-2 p-2 border-b">
        {previewUrl ? (
          <Button onClick={handleStopServer} variant="outline" size="sm">
            <StopCircle className="h-4 w-4 mr-2" />
            Stop Server
          </Button>
        ) : (
          <Button onClick={handleStartServer} variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Start Server
          </Button>
        )}
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      <div className="flex-1">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title="Component Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Start the development server to preview the component
          </div>
        )}
      </div>
    </div>
  );
}
