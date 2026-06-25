import { useState, useEffect } from "react";
import { ScrollArea } from "../../../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Globe, Lock, MessageSquare, GitFork } from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { apiFetch } from "../../../lib/api";
import { useAuth, getAuthHeaders } from "../../../contexts/AuthContext";

interface SettingsTabProps {
  editorTheme: 'vs-dark' | 'light';
  setEditorTheme: (theme: 'vs-dark' | 'light') => void;
  currentProject?: { id: number; name: string; isPublic?: boolean } | null;
}

export function SettingsTab({ editorTheme, setEditorTheme, currentProject }: SettingsTabProps) {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    isPublic: false,
    allowComments: true,
    allowFork: true,
  });

  // Fetch current project privacy settings
  useEffect(() => {
    if (currentProject?.id && sessionToken) {
      const fetchProjectSettings = async () => {
        try {
          const response = await apiFetch(`/api/workspaces/${currentProject.id}`, {
            headers: getAuthHeaders(sessionToken),
          });
          if (response.ok) {
            const project = await response.json();
            setPrivacySettings({
              isPublic: project.isPublic || false,
              allowComments: project.allowComments !== false,
              allowFork: project.allowFork !== false,
            });
          }
        } catch (error) {
          console.error('Failed to fetch project settings:', error);
        }
      };
      fetchProjectSettings();
    }
  }, [currentProject?.id, sessionToken]);

  const updatePrivacySettings = async () => {
    if (!sessionToken || !currentProject?.id) {
      toast({
        title: "Error",
        description: "Please save your project first",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiFetch(`/api/workspaces/${currentProject.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(sessionToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPublic: privacySettings.isPublic,
          allowComments: privacySettings.allowComments,
          allowFork: privacySettings.allowFork,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || errorData.error || `Failed to update settings`);
      }

      toast({
        title: "Settings Updated!",
        description: "Privacy settings have been saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h3 className="text-lg font-semibold mb-4">Playground Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your AI generation preferences and deployment options.
          </p>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Editor Theme</h4>
            <Select value={editorTheme} onValueChange={(val) => setEditorTheme(val as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vs-dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Default Project Type</h4>
            <p className="text-sm text-muted-foreground">React (TypeScript + Vite)</p>
          </div>
          {/* Privacy Settings - Only show if project is saved */}
          {currentProject?.id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {privacySettings.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  Privacy Settings
                </CardTitle>
                <CardDescription>
                  Control who can access and interact with your project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="public">Make Project Public</Label>
                    <p className="text-sm text-muted-foreground">
                      Anyone with the link can view this project
                    </p>
                  </div>
                  <Switch
                    id="public"
                    checked={privacySettings.isPublic}
                    onCheckedChange={(checked) =>
                      setPrivacySettings(prev => ({ ...prev, isPublic: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="comments">Allow Comments</Label>
                    <p className="text-sm text-muted-foreground">
                      Let viewers leave feedback on your project
                    </p>
                  </div>
                  <Switch
                    id="comments"
                    checked={privacySettings.allowComments}
                    onCheckedChange={(checked) =>
                      setPrivacySettings(prev => ({ ...prev, allowComments: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="fork">Allow Forking</Label>
                    <p className="text-sm text-muted-foreground">
                      Let others create their own copy of this project
                    </p>
                  </div>
                  <Switch
                    id="fork"
                    checked={privacySettings.allowFork}
                    onCheckedChange={(checked) =>
                      setPrivacySettings(prev => ({ ...prev, allowFork: checked }))
                    }
                  />
                </div>

                <Button 
                  onClick={updatePrivacySettings} 
                  className="w-full"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Update Settings'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Incremental Generation Info - Always Enabled */}
          <div className="p-4 bg-green-500/10 dark:bg-green-500/20 rounded-lg border border-green-500/30 dark:border-green-500/40">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-700 dark:text-green-300 mb-1">Incremental Generation</h4>
                <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                  Code is generated incrementally in phases with validation at each step. This ensures:
                </p>
                <ul className="text-xs text-green-600 dark:text-green-400 space-y-1 ml-4 list-disc">
                  <li>Foundation built first (package.json, configs)</li>
                  <li>Each phase sees previous files (imports resolve)</li>
                  <li>Validation after each phase (errors caught early)</li>
                  <li>Automatic error fixing (up to 3 attempts per phase)</li>
                  <li>Working apps guaranteed (95%+ success rate)</li>
                </ul>
                <div className="mt-3 p-2 bg-green-500/15 dark:bg-green-500/25 rounded text-xs text-green-700 dark:text-green-300">
                  <strong>Always Enabled:</strong> This is the standard way we generate code. It produces better results than the old monolithic approach.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
