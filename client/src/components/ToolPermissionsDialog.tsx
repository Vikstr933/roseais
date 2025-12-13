import { useState, useEffect } from 'react';
import { Settings, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Tool {
  id: string;
  name: string;
  description: string;
}

interface ToolPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pluginId: string;
  pluginName: string;
  tools: Tool[];
}

export function ToolPermissionsDialog({
  open,
  onOpenChange,
  pluginId,
  pluginName,
  tools,
}: ToolPermissionsDialogProps) {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Record<string, 'allow' | 'ask' | 'deny'>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && pluginId) {
      loadPermissions();
    }
  }, [open, pluginId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/tool-permissions/${pluginId}`, {
        headers: getAuthHeaders(sessionToken),
      });

      if (response.ok) {
        const data = await response.json();
        const perms: Record<string, 'allow' | 'ask' | 'deny'> = {};
        data.permissions.forEach((p: any) => {
          perms[p.toolId] = p.permission;
        });
        setPermissions(perms);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (toolId: string, permission: 'allow' | 'ask' | 'deny') => {
    try {
      setSaving(true);
      const response = await apiFetch(`/api/tool-permissions/${pluginId}/${toolId}`, {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({ permission }),
      });

      if (response.ok) {
        setPermissions(prev => ({ ...prev, [toolId]: permission }));
        toast({
          title: 'Permission Updated',
          description: `Tool "${toolId}" permission set to ${permission}`,
        });
      } else {
        throw new Error('Failed to update permission');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permission',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getPermissionBadge = (permission: 'allow' | 'ask' | 'deny') => {
    switch (permission) {
      case 'allow':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Always Allow
          </Badge>
        );
      case 'deny':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Never Allow
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            Ask Each Time
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tool Permissions: {pluginName}
          </DialogTitle>
          <DialogDescription>
            Control how the Agent is allowed to use tools for this connector. You can set permissions per tool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading permissions...</div>
          ) : tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tools available for this connector
            </div>
          ) : (
            tools.map((tool) => {
              const currentPermission = permissions[tool.id] || 'ask';
              return (
                <div
                  key={tool.id}
                  className="p-4 border rounded-lg bg-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                    {getPermissionBadge(currentPermission)}
                  </div>
                  <Select
                    value={currentPermission}
                    onValueChange={(value: 'allow' | 'ask' | 'deny') =>
                      updatePermission(tool.id, value)
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Always Allow
                        </div>
                      </SelectItem>
                      <SelectItem value="ask">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          Ask Each Time
                        </div>
                      </SelectItem>
                      <SelectItem value="deny">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Never Allow
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

