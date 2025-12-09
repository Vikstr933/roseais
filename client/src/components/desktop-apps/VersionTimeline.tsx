import { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Clock, ArrowRight, Loader2, RefreshCw, Eye, Download, Trash2, ChevronRight, FileCode, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth, getAuthHeaders } from '../../contexts/AuthContext';
import { ScrollArea } from '../ui/scroll-area';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AppVersion {
  id: string;
  projectId: number;
  projectName: string;
  version: string;
  prompt: string;
  filesCount: number;
  timestamp: Date;
  status: 'success' | 'error' | 'in_progress';
  duration?: number;
  model?: string;
  filesPreview?: Array<{ path: string; size: number }>;
}

interface GenerationSession {
  id: string;
  projectId: number;
  projectName: string;
  versions: AppVersion[];
  createdAt: Date;
}

export function VersionTimeline({ currentProjectId }: { currentProjectId?: number }) {
  const { sessionToken } = useAuth();
  const [sessions, setSessions] = useState<GenerationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(currentProjectId || null);

  // Fetch version history from API
  useEffect(() => {
    const fetchVersions = async () => {
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      try {
        // Try to fetch from sessions API
        const sessionsResponse = await fetch(`${API_BASE}/api/sessions`, {
          headers: getAuthHeaders(sessionToken),
        });

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          
          // Group by project
          const projectMap = new Map<number, GenerationSession>();
          
          for (const session of sessionsData.sessions || sessionsData || []) {
            const projectId = session.projectId || session.workspaceId;
            if (!projectId) continue;

            if (!projectMap.has(projectId)) {
              projectMap.set(projectId, {
                id: `session-${projectId}`,
                projectId,
                projectName: session.projectName || session.name || `Project ${projectId}`,
                versions: [],
                createdAt: new Date(session.createdAt || Date.now()),
              });
            }

            const proj = projectMap.get(projectId)!;
            
            // Add as version
            proj.versions.push({
              id: session.id?.toString() || `v-${Date.now()}`,
              projectId,
              projectName: proj.projectName,
              version: `v${proj.versions.length + 1}`,
              prompt: session.prompt || session.lastPrompt || 'Generation',
              filesCount: session.filesCount || session.generatedFiles?.length || 0,
              timestamp: new Date(session.updatedAt || session.createdAt || Date.now()),
              status: session.status === 'error' ? 'error' : 'success',
              duration: session.duration,
              model: session.model,
              filesPreview: session.generatedFiles?.slice(0, 5).map((f: any) => ({
                path: f.path || f.name,
                size: f.content?.length || 0,
              })),
            });
          }

          // Convert to array and sort
          const sessionsArray = Array.from(projectMap.values())
            .map(s => ({
              ...s,
              versions: s.versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
            }))
            .sort((a, b) => {
              const aLatest = a.versions[0]?.timestamp.getTime() || 0;
              const bLatest = b.versions[0]?.timestamp.getTime() || 0;
              return bLatest - aLatest;
            });

          setSessions(sessionsArray);
        } else {
          // Fallback: try workspace files history
          if (currentProjectId) {
            const filesResponse = await fetch(`${API_BASE}/api/workspaces/${currentProjectId}/files`, {
              headers: getAuthHeaders(sessionToken),
            });
            
            if (filesResponse.ok) {
              const filesData = await filesResponse.json();
              // Create a single version from current files
              setSessions([{
                id: `session-${currentProjectId}`,
                projectId: currentProjectId,
                projectName: `Project ${currentProjectId}`,
                versions: [{
                  id: 'current',
                  projectId: currentProjectId,
                  projectName: `Project ${currentProjectId}`,
                  version: 'v1',
                  prompt: 'Current version',
                  filesCount: filesData.files?.length || 0,
                  timestamp: new Date(),
                  status: 'success',
                  filesPreview: filesData.files?.slice(0, 5).map((f: any) => ({
                    path: f.path,
                    size: f.content?.length || 0,
                  })),
                }],
                createdAt: new Date(),
              }]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [sessionToken, currentProjectId]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const filteredSessions = selectedProject 
    ? sessions.filter(s => s.projectId === selectedProject)
    : sessions;

  const allVersions = filteredSessions.flatMap(s => s.versions);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-100">
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-zinc-800" />
            <div className="h-3 w-24 rounded bg-zinc-800" />
            <div className="h-4 w-16 rounded-full bg-zinc-800" />
          </div>
          <div className="h-6 w-6 rounded bg-zinc-800" />
        </div>
        {/* Skeleton timeline */}
        <div className="flex-1 p-3 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="h-3 w-32 rounded bg-zinc-700" />
              </div>
              <div className="ml-5 space-y-1.5">
                <div className="h-2.5 w-full rounded bg-zinc-800" />
                <div className="h-2.5 w-3/4 rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Version History</span>
          <Badge variant="secondary" className="text-[10px] h-4">
            {allVersions.length} versions
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {sessions.length > 1 && (
            <select
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value ? parseInt(e.target.value) : null)}
              className="h-6 text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 text-zinc-300"
            >
              <option value="">All Projects</option>
              {sessions.map(s => (
                <option key={s.projectId} value={s.projectId}>{s.projectName}</option>
              ))}
            </select>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {allVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitCommit className="h-12 w-12 text-zinc-600 mb-4" />
              <p className="text-sm text-zinc-400 mb-1">No versions yet</p>
              <p className="text-xs text-zinc-500">Generate some code to see the timeline</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
              
              {/* Versions */}
              <div className="space-y-3">
                {allVersions.map((version, index) => {
                  const isExpanded = expandedVersion === version.id;
                  const isLatest = index === 0;
                  
                  return (
                    <div key={version.id} className="relative pl-8">
                      {/* Timeline dot */}
                      <div className={`absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 ${
                        version.status === 'error' 
                          ? 'bg-red-500 border-red-400' 
                          : version.status === 'in_progress'
                            ? 'bg-blue-500 border-blue-400 animate-pulse'
                            : isLatest 
                              ? 'bg-emerald-500 border-emerald-400' 
                              : 'bg-zinc-600 border-zinc-500'
                      }`} />
                      
                      {/* Version card */}
                      <div 
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isExpanded 
                            ? 'border-primary bg-primary/5' 
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-800/50'
                        }`}
                        onClick={() => setExpandedVersion(isExpanded ? null : version.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={isLatest ? 'default' : 'secondary'} 
                                className="text-[10px] h-4 px-1.5"
                              >
                                {version.version}
                              </Badge>
                              {isLatest && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-400 border-emerald-500/30">
                                  Latest
                                </Badge>
                              )}
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDate(version.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 truncate pr-4">
                              {version.prompt.slice(0, 60)}...
                            </p>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-zinc-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                        
                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <FileCode className="h-3 w-3 text-zinc-500" />
                                <span className="text-zinc-400">{version.filesCount} files</span>
                              </div>
                              {version.duration && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 text-zinc-500" />
                                  <span className="text-zinc-400">{formatDuration(version.duration)}</span>
                                </div>
                              )}
                              {version.model && (
                                <div className="flex items-center gap-1.5 col-span-2">
                                  <Layers className="h-3 w-3 text-zinc-500" />
                                  <span className="text-zinc-400 font-mono">{version.model}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Files preview */}
                            {version.filesPreview && version.filesPreview.length > 0 && (
                              <div className="bg-zinc-900/50 rounded p-2 space-y-1">
                                {version.filesPreview.map((file, i) => (
                                  <div key={i} className="flex items-center justify-between text-[10px]">
                                    <span className="text-zinc-400 font-mono truncate">{file.path}</span>
                                    <span className="text-zinc-600 flex-shrink-0">
                                      {(file.size / 1024).toFixed(1)}KB
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Full prompt */}
                            <div className="bg-zinc-900/50 rounded p-2">
                              <p className="text-[10px] text-zinc-400 whitespace-pre-wrap">
                                {version.prompt}
                              </p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex gap-1.5 pt-1">
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1">
                                <Download className="h-3 w-3 mr-1" />
                                Export
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{sessions.length} project(s)</span>
        <span className="flex items-center gap-1">
          <GitCommit className="h-2.5 w-2.5" />
          {allVersions.filter(v => v.status === 'success').length} successful
        </span>
      </div>
    </div>
  );
}

