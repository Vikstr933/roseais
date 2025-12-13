import { useState } from 'react';
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import type { WebContainerService } from "../../../services/WebContainerService";
import { 
  Smartphone, 
  Folder, 
  Plus, 
  Settings,
  CheckCircle2,
  Lock,
  StickyNote,
  Terminal,
  Send,
  Bot,
  GitBranch,
  FlaskConical,
  FolderClosed,
  Plug
} from "lucide-react";
import { SecretsVault, APIPlayground, AgentMonitor, VersionTimeline, AIPromptLab } from '../../../components/desktop-apps';

interface MobileTabProps {
  projects: Array<{ id: number; name: string; description?: string; workspaceType?: 'personal' | 'team' }>;
  currentProjectId?: number;
  onSelectProject: (projectId: number) => void;
  onCreateProject: () => void;
  onEditProject: (projectId: number) => void;
  webContainerService: WebContainerService;
  isWebContainerReady: boolean;
}

const SYSTEM_APPS = [
  { id: 'notes', name: 'Notes', icon: StickyNote, color: 'from-amber-400 to-orange-500' },
  { id: 'terminal', name: 'Terminal', icon: Terminal, color: 'from-zinc-600 to-zinc-800' },
  { id: 'secrets-vault', name: 'Secrets', icon: Lock, color: 'from-emerald-400 to-teal-500' },
  { id: 'api-playground', name: 'API', icon: Send, color: 'from-violet-400 to-purple-500' },
  { id: 'agent-monitor', name: 'Agents', icon: Bot, color: 'from-sky-400 to-blue-500' },
  { id: 'version-timeline', name: 'Versions', icon: GitBranch, color: 'from-rose-400 to-pink-500' },
  { id: 'prompt-lab', name: 'Prompt Lab', icon: FlaskConical, color: 'from-fuchsia-400 to-purple-500' },
  { id: 'file-manager', name: 'Files', icon: FolderClosed, color: 'from-blue-400 to-indigo-500' },
];

const getProjectIcon = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('chat') || n.includes('bot')) return '💬';
  if (n.includes('shop') || n.includes('store')) return '🛒';
  if (n.includes('timer') || n.includes('clock')) return '⏱️';
  if (n.includes('todo') || n.includes('task')) return '✅';
  if (n.includes('dashboard')) return '📊';
  if (n.includes('game')) return '🎮';
  if (n.includes('note')) return '📝';
  return '📱';
};

export function MobileTab({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  webContainerService,
  isWebContainerReady,
}: MobileTabProps) {
  const [openApp, setOpenApp] = useState<string | null>(null);
  
  const handleOpenSystemApp = (appId: string) => {
    setOpenApp(appId);
  };
  
  const renderSystemAppContent = (appId: string) => {
    switch (appId) {
      case 'secrets-vault':
        return <SecretsVault />;
      case 'api-playground':
        return <APIPlayground currentProjectId={currentProjectId} />;
      case 'agent-monitor':
        return <AgentMonitor />;
      case 'version-timeline':
        return <VersionTimeline currentProjectId={currentProjectId} />;
      case 'prompt-lab':
        return <AIPromptLab />;
      case 'notes':
        return (
          <div className="p-4">
            <textarea 
              placeholder="Write your notes here..." 
              className="w-full h-[300px] p-3 rounded-lg border bg-background resize-none"
            />
          </div>
        );
      case 'terminal':
        return (
          <div className="p-4 text-center text-muted-foreground">
            <Terminal className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Terminal is only available on desktop</p>
          </div>
        );
      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Coming soon!</p>
          </div>
        );
    }
  };
  
  const getAppTitle = (appId: string) => {
    const app = SYSTEM_APPS.find(a => a.id === appId);
    return app?.name || 'System Tool';
  };
  
  return (
    <>
      <div className="h-full w-full overflow-auto bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">My Apps</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Quick access to your projects and system tools
          </p>
        </div>

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Projects ({projects.length})
            </h3>
            <Button size="sm" onClick={onCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
          
          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Folder className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No projects yet. Create your first app!
                </p>
                <Button onClick={onCreateProject}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                    currentProjectId === project.id 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : ''
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg">
                        {getProjectIcon(project.name)}
                      </div>
                      <div className="w-full">
                        <p className="font-medium text-sm truncate">
                          {project.name}
                        </p>
                        {currentProjectId === project.id && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary">Active</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* System Apps Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            System Tools
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {SYSTEM_APPS.map((app) => {
              const IconComponent = app.icon;
              return (
                <button
                  key={app.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-accent transition-colors active:scale-95"
                  onClick={() => handleOpenSystemApp(app.id)}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-md`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {app.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* WebContainer Status */}
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isWebContainerReady ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm">Dev Environment</span>
            </div>
            <Badge variant={isWebContainerReady ? 'default' : 'secondary'} className="text-xs">
              {isWebContainerReady ? 'Ready' : 'Initializing'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
    
    {/* System App Sheet */}
    <Sheet open={openApp !== null} onOpenChange={(open) => !open && setOpenApp(null)}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>{getAppTitle(openApp || '')}</SheetTitle>
          <SheetDescription>
            {openApp === 'terminal' && 'Terminal is only available on desktop'}
            {openApp === 'notes' && 'Quick notes for your project'}
            {openApp === 'secrets-vault' && 'Manage your API keys and secrets'}
            {openApp === 'api-playground' && 'Test API endpoints'}
            {openApp === 'agent-monitor' && 'Monitor your AI agents'}
            {openApp === 'version-timeline' && 'View project version history'}
            {openApp === 'prompt-lab' && 'Test and compare prompts'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 h-[calc(80vh-120px)] overflow-auto">
          {openApp && renderSystemAppContent(openApp)}
        </div>
      </SheetContent>
    </Sheet>
  </>
  );
}

