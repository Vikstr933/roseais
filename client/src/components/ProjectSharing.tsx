import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Share2,
  Copy,
  Eye,
  Lock,
  Globe,
  QrCode,
  Download,
  ExternalLink,
  Users,
  Settings
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ProjectSharingProps {
  projectId: string;
  projectName: string;
  files: Array<{ path: string; content: string }>;
  isPublic?: boolean;
  onUpdateSharing?: (settings: SharingSettings) => void;
}

interface SharingSettings {
  isPublic: boolean;
  allowComments: boolean;
  allowFork: boolean;
  password?: string;
  expiresAt?: Date;
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
  isPublic = false,
  onUpdateSharing
}: ProjectSharingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<SharingSettings>({
    isPublic,
    allowComments: true,
    allowFork: true,
  });
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([
    {
      id: 'view-link',
      url: `https://yourapp.com/share/${projectId}`,
      type: 'view',
      description: 'Anyone with this link can view the project',
      clicks: 42,
      createdAt: new Date(),
    },
    {
      id: 'preview-link',
      url: `https://yourapp.com/preview/${projectId}`,
      type: 'preview',
      description: 'Interactive preview of the generated app',
      clicks: 18,
      createdAt: new Date(),
    },
  ]);
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
    const newLink: ShareLink = {
      id: `${type}-${Date.now()}`,
      url: `https://yourapp.com/${type}/${projectId}?token=${Math.random().toString(36).substring(7)}`,
      type,
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} link with custom token`,
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

  const updateSharingSettings = () => {
    onUpdateSharing?.(settings);
    toast({
      title: "Settings Updated!",
      description: "Project sharing settings have been saved",
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
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{projectName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {settings.isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control who can access and interact with your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="public">Make Project Public</Label>
                  <p className="text-sm text-muted-foreground">
                    Anyone with the link can view this project
                  </p>
                </div>
                <Switch
                  id="public"
                  checked={settings.isPublic}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, isPublic: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="comments">Allow Comments</Label>
                  <p className="text-sm text-muted-foreground">
                    Let viewers leave feedback on your project
                  </p>
                </div>
                <Switch
                  id="comments"
                  checked={settings.allowComments}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, allowComments: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fork">Allow Forking</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others create their own copy of this project
                  </p>
                </div>
                <Switch
                  id="fork"
                  checked={settings.allowFork}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, allowFork: checked }))
                  }
                />
              </div>

              <Button onClick={updateSharingSettings} className="w-full">
                Update Settings
              </Button>
            </CardContent>
          </Card>

          {/* Share Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Share2 className="h-5 w-5" />
                Share Links
              </CardTitle>
              <CardDescription>
                Generate different types of links for various use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {shareLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-full ${getLinkColor(link.type)}`}>
                      {getLinkIcon(link.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {link.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {link.clicks} clicks
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {link.description}
                      </p>
                      <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block truncate">
                        {link.url}
                      </code>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(link.url, `${link.type} link`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNewLink('view')}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNewLink('preview')}
                  className="flex-1"
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
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-5 w-5" />
                Export & Embed
              </CardTitle>
              <CardDescription>
                Additional ways to share and use your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={exportProject} className="h-20 flex-col gap-2">
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Export JSON</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowQR(!showQR)}
                  className="h-20 flex-col gap-2"
                >
                  <QrCode className="h-5 w-5" />
                  <span className="text-sm">QR Code</span>
                </Button>
              </div>

              {showQR && (
                <div className="flex justify-center p-4 bg-muted rounded-lg">
                  <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-gray-400" />
                  </div>
                </div>
              )}

              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <strong>Collaboration:</strong> Invite team members to collaborate on this project
                  by generating edit links. They'll be able to modify the code in real-time.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Embed Code</CardTitle>
              <CardDescription>
                Add this project to your website or blog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Iframe Embed</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`<iframe src="${shareLinks[1]?.url}" width="100%" height="600" frameborder="0"></iframe>`}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        `<iframe src="${shareLinks[1]?.url}" width="100%" height="600" frameborder="0"></iframe>`,
                        'Embed code'
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}