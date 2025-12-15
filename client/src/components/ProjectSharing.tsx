import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Share2,
  Copy,
  Eye,
  QrCode,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { apiFetch } from '../lib/api';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';

interface ProjectSharingProps {
  projectId: string;
  projectName: string;
  files: Array<{ path: string; content: string }>;
  previewUrl?: string; // Optional preview URL for sharing
}


interface ShareLink {
  id: string;
  url: string;
  type: 'view' | 'edit' | 'preview';
  description: string;
  clicks: number;
  createdAt: Date;
}

export function ProjectSharing({
  projectId,
  projectName,
  files,
  previewUrl,
}: ProjectSharingProps) {
  const { sessionToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  
  // Generate actual shareable links based on preview URL
  const getShareLinks = React.useCallback((): ShareLink[] => {
    const baseUrl = previewUrl || window.location.origin;
    const shareToken = btoa(`${projectId}-${Date.now()}`).replace(/[+/=]/g, '').substring(0, 16);
    
    return [
      {
        id: 'preview-link',
        url: previewUrl || `${baseUrl}/preview/${projectId}`,
        type: 'preview',
        description: previewUrl ? 'Live preview of your app' : 'Preview link (generate app first)',
        clicks: 0,
        createdAt: new Date(),
      },
      {
        id: 'view-link',
        url: `${baseUrl}/share/${projectId}?token=${shareToken}`,
        type: 'view',
        description: 'Shareable link to view the project',
        clicks: 0,
        createdAt: new Date(),
      },
    ];
  }, [previewUrl, projectId]);
  
  const [shareLinks, setShareLinks] = useState<ShareLink[]>(getShareLinks());
  
  // Update links when previewUrl changes
  useEffect(() => {
    setShareLinks(getShareLinks());
  }, [getShareLinks]);
  const [showQR, setShowQR] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link Copied!",
      description: `${description} copied to clipboard`,
    });
  };

  const generateNewLink = (type: 'view' | 'edit' | 'preview') => {
    const baseUrl = previewUrl || window.location.origin;
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    let url: string;
    let description: string;
    
    if (type === 'preview' && previewUrl) {
      url = previewUrl;
      description = 'Live preview link';
    } else if (type === 'view') {
      url = `${baseUrl}/share/${projectId}?token=${token}`;
      description = 'View-only link with access token';
    } else {
      url = `${baseUrl}/edit/${projectId}?token=${token}`;
      description = 'Edit link with access token';
    }
    
    const newLink: ShareLink = {
      id: `${type}-${Date.now()}`,
      url,
      type,
      description,
      clicks: 0,
      createdAt: new Date(),
    };

    setShareLinks(prev => [...prev, newLink]);
    copyToClipboard(newLink.url, `${type} link`);
  };

  const exportProject = () => {
    const projectData = {
      name: projectName,
      files,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Project Exported!",
      description: "Project files have been downloaded as JSON",
    });
  };


  const getLinkIcon = (type: string) => {
    switch (type) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'edit': return <Settings className="h-4 w-4" />;
      case 'preview': return <ExternalLink className="h-4 w-4" />;
      default: return <Share2 className="h-4 w-4" />;
    }
  };

  const getLinkColor = (type: string) => {
    switch (type) {
      case 'view': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'edit': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'preview': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share Project
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5" />
            Share "{projectName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share Links
              </CardTitle>
              <CardDescription className="text-sm">
                Generate different types of links for various use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {shareLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`p-1.5 rounded ${getLinkColor(link.type)} flex-shrink-0`}>
                      {getLinkIcon(link.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {link.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {link.description}
                      </p>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded block truncate font-mono">
                        {link.url}
                      </code>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => copyToClipboard(link.url, `${link.type} link`)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNewLink('view')}
                  className="flex-1 h-8 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNewLink('preview')}
                  className="flex-1 h-8 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Preview Link
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export & QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={exportProject} className="h-16 flex-col gap-1.5 text-xs">
                  <Download className="h-4 w-4" />
                  <span>Export JSON</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowQR(!showQR)}
                  className="h-16 flex-col gap-1.5 text-xs"
                >
                  <QrCode className="h-4 w-4" />
                  <span>QR Code</span>
                </Button>
              </div>

              {showQR && shareLinks.length > 0 && (
                <div className="flex justify-center p-3 bg-muted rounded-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareLinks[0]?.url || '')}`}
                    alt="QR Code"
                    className="w-32 h-32 border-2 border-background rounded-md"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}