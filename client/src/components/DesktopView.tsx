import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Edit3,
  Rocket,
  MoreHorizontal,
  Plus,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plug,
  Activity,
  BarChart3,
  Folder,
  FolderPlus,
  FolderOpen,
  Settings,
  Trash2,
  Copy,
  RefreshCw,
  Grid3X3,
  Eye,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Pencil,
  LayoutGrid,
  SortAsc,
  // Desktop app icons
  StickyNote,
  Terminal,
  Lock,
  Send,
  Bot,
  GitBranch,
  FlaskConical,
  FolderClosed,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Switch } from './ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import type { WebContainerService } from '../services/WebContainerService';
import { SecretsVault, APIPlayground, AgentMonitor, VersionTimeline, AIPromptLab } from './desktop-apps';

// API helper
const API_BASE = import.meta.env.VITE_API_URL || '';

interface DesktopViewProps {
  projects: Array<{
    id: number;
    name: string;
    description?: string;
  }>;
  currentProjectId?: number;
  onSelectProject: (projectId: number) => void;
  onCreateProject: () => void;
  onEditProject: (projectId: number) => void;
  webContainerService?: WebContainerService | null;
  isWebContainerReady?: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface DesktopItem {
  id: string;
  type: 'app' | 'system' | 'folder';
  name: string;
  icon: string;
  color: string;
  position: Position;
  projectId?: number;
  folderId?: string; // If item is inside a folder
  isOpen?: boolean; // For folders
  items?: string[]; // IDs of items in folder
}

interface OpenWindow {
  id: string;
  title: string;
  type: 'notes' | 'terminal' | 'browser-agent' | 'api-monitor' | 'file-manager' | 'secrets-vault' | 'api-playground' | 'agent-monitor' | 'version-timeline' | 'prompt-lab';
  position: Position;
  size: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
}

interface RealPlugin {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'available' | 'error';
  category: string;
  isConnected: boolean;
}

// Icon component mapping for system apps
const SYSTEM_APP_ICONS: Record<string, LucideIcon> = {
  'notes': StickyNote,
  'terminal': Terminal,
  'secrets-vault': Lock,
  'api-playground': Send,
  'agent-monitor': Bot,
  'version-timeline': GitBranch,
  'prompt-lab': FlaskConical,
  'file-manager': FolderClosed,
  'browser-agent': Globe,
};

// Default system apps - always visible on desktop
const DEFAULT_SYSTEM_APPS = [
  { id: 'notes', name: 'Notes', icon: 'notes', color: 'from-amber-400 to-orange-500', type: 'notes' as const },
  { id: 'terminal', name: 'Terminal', icon: 'terminal', color: 'from-zinc-600 to-zinc-800', type: 'terminal' as const },
  { id: 'secrets-vault', name: 'Secrets', icon: 'secrets-vault', color: 'from-emerald-400 to-teal-500', type: 'secrets-vault' as const },
  { id: 'api-playground', name: 'API', icon: 'api-playground', color: 'from-violet-400 to-purple-500', type: 'api-playground' as const },
  { id: 'agent-monitor', name: 'Agents', icon: 'agent-monitor', color: 'from-sky-400 to-blue-500', type: 'agent-monitor' as const },
  { id: 'version-timeline', name: 'Versions', icon: 'version-timeline', color: 'from-rose-400 to-pink-500', type: 'version-timeline' as const },
  { id: 'prompt-lab', name: 'Prompt Lab', icon: 'prompt-lab', color: 'from-fuchsia-400 to-purple-500', type: 'prompt-lab' as const },
  { id: 'file-manager', name: 'Files', icon: 'file-manager', color: 'from-blue-400 to-indigo-500', type: 'file-manager' as const },
];

// Helper to render app icon (Lucide or emoji fallback)
const renderAppIcon = (iconKey: string, className: string = "h-6 w-6 text-gray-900 drop-shadow-sm") => {
  const IconComponent = SYSTEM_APP_ICONS[iconKey];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  // Fallback to emoji if it's an emoji string
  return <span className="text-2xl drop-shadow-sm">{iconKey}</span>;
};

const getProjectColor = (name: string): string => {
  const colors = [
    'from-purple-500 to-indigo-600',
    'from-pink-500 to-rose-600',
    'from-orange-500 to-amber-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-cyan-600',
    'from-violet-500 to-purple-600',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

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

const ICON_SIZE = 50;
const GRID_SIZE = 70;

const STORAGE_KEYS = {
  items: 'chap-desktop-items-v4',
  notes: 'chap-desktop-notes',
  terminal: 'chap-desktop-terminal-history',
};

// Plugin icon mapping
const PLUGIN_ICONS: Record<string, string> = {
  gmail: '📧',
  'google-calendar': '📅',
  github: '🐙',
  notion: '📓',
  slack: '💬',
  browser: '🌐',
  openai: '🤖',
  anthropic: '🧠',
  vercel: '▲',
};

export function DesktopView({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  webContainerService,
  isWebContainerReady = false,
}: DesktopViewProps) {
  const { sessionToken } = useAuth();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [showPluginsDialog, setShowPluginsDialog] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [highestZIndex, setHighestZIndex] = useState(100);
  const [initialized, setInitialized] = useState(false);

  // Real plugins from API
  const [realPlugins, setRealPlugins] = useState<RealPlugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);

  // Desktop items
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.items);
      if (saved) {
        const items = JSON.parse(saved);
        // Ensure items is an array
        if (!Array.isArray(items)) {
          throw new Error('Invalid items format');
        }
        // Ensure all default system apps are present
        const existingSystemIds = new Set(items.filter((i: DesktopItem) => i.type === 'system').map((i: DesktopItem) => i.id));
        const missingDefaults = DEFAULT_SYSTEM_APPS.filter(app => !existingSystemIds.has(`system-${app.id}`));
        
        if (missingDefaults.length > 0) {
          let nextX = 20;
          let nextY = 20;
          const cols = 6;
          let col = items.length % cols;
          let row = Math.floor(items.length / cols);
          
          missingDefaults.forEach(app => {
            items.push({
              id: `system-${app.id}`,
              type: 'system',
              name: app.name,
              icon: app.icon,
              color: app.color,
              position: { x: 20 + col * GRID_SIZE, y: 20 + row * GRID_SIZE },
            });
            col++;
            if (col >= cols) { col = 0; row++; }
          });
        }
        return items;
      }
      
      // First time - create default system apps
      return DEFAULT_SYSTEM_APPS.map((app, index) => ({
        id: `system-${app.id}`,
        type: 'system' as const,
        name: app.name,
        icon: app.icon,
        color: app.color,
        position: { x: 20 + (index % 6) * GRID_SIZE, y: 20 + Math.floor(index / 6) * GRID_SIZE },
      }));
    } catch {
      // Always return a valid array
      return DEFAULT_SYSTEM_APPS.map((app, index) => ({
        id: `system-${app.id}`,
        type: 'system' as const,
        name: app.name,
        icon: app.icon,
        color: app.color,
        position: { x: 20 + (index % 6) * GRID_SIZE, y: 20 + Math.floor(index / 6) * GRID_SIZE },
      }));
    }
  });

  // Windows
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Notes
  const [notesContent, setNotesContent] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.notes) || ''; } catch { return ''; }
  });

  // Terminal
  const [terminalHistory, setTerminalHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.terminal);
      return saved ? JSON.parse(saved) : ['$ Welcome to Elon Terminal', '$ Type "help" for commands'];
    } catch { return ['$ Welcome to Elon Terminal']; }
  });
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalWorking, setTerminalWorking] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    targetItem?: DesktopItem;
  }>({ show: false, x: 0, y: 0 });
  
  // Folder editing state
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  // Fetch real plugins from API
  useEffect(() => {
    const fetchPlugins = async () => {
      // Default plugins to show while loading or if API fails
      const defaultPlugins: RealPlugin[] = [
        { id: 'openai', name: 'OpenAI', icon: '🤖', status: 'connected', category: 'AI', isConnected: true },
        { id: 'anthropic', name: 'Anthropic', icon: '🧠', status: 'connected', category: 'AI', isConnected: true },
      ];
      
      if (!sessionToken) {
        setRealPlugins(defaultPlugins);
        setLoadingPlugins(false);
        return;
      }
      
      try {
        const response = await fetch(`${API_BASE}/api/plugins/status`, {
          headers: getAuthHeaders(sessionToken),
        });
        
        if (response.ok) {
          const data = await response.json();
          const plugins: RealPlugin[] = [];
          
          // Parse the plugins from the response
          if (data.plugins && Array.isArray(data.plugins)) {
            data.plugins.forEach((p: any) => {
              // Skip browser agent - it's a system tool, not a user plugin
              if (p.id === 'browser' || p.name?.toLowerCase().includes('browser agent')) {
                return;
              }
              plugins.push({
                id: p.id || p.name?.toLowerCase().replace(/\s+/g, '-'),
                name: p.name || p.id,
                icon: PLUGIN_ICONS[p.id] || p.icon || '🔌',
                status: p.isConnected ? 'connected' : 'available',
                category: p.category || 'Integration',
                isConnected: p.isConnected || false,
              });
            });
          }
          
          // If we got plugins from API, use them; otherwise use defaults
          setRealPlugins(plugins.length > 0 ? plugins : defaultPlugins);
        } else {
          // API failed (401, etc.) - use defaults
          console.warn('Failed to fetch plugins, using defaults');
          setRealPlugins(defaultPlugins);
        }
      } catch (error) {
        console.error('Failed to fetch plugins:', error);
        setRealPlugins(defaultPlugins);
      } finally {
        setLoadingPlugins(false);
      }
    };

    fetchPlugins();
  }, [sessionToken]);

  // Save notes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.notes, notesContent); } catch {}
  }, [notesContent]);

  // Save terminal
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.terminal, JSON.stringify(terminalHistory.slice(-100))); } catch {}
  }, [terminalHistory]);

  // Save desktop items
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(desktopItems)); } catch {}
  }, [desktopItems]);

  // Calculate next position - ensures icons stay within visible desktop bounds
  const getNextPosition = useCallback((existingItems: DesktopItem[]): Position | null => {
    if (!desktopRef.current) return { x: 20, y: 20 };
    const width = desktopRef.current.clientWidth || 800;
    const height = desktopRef.current.clientHeight || 500;
    const cols = Math.floor((width - 40) / GRID_SIZE);
    const maxRows = Math.floor((height - 100) / GRID_SIZE); // Leave space for taskbar
    const occupied = new Set<string>();
    
    existingItems.filter(item => !item.folderId).forEach(item => {
      const col = Math.round((item.position.x - 20) / GRID_SIZE);
      const row = Math.round((item.position.y - 20) / GRID_SIZE);
      if (col >= 0 && row >= 0) {
        occupied.add(`${col},${row}`);
      }
    });
    
    // Search for available position within bounds
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!occupied.has(`${col},${row}`)) {
          return { x: 20 + col * GRID_SIZE, y: 20 + row * GRID_SIZE };
        }
      }
    }
    
    // No space available
    return null;
  }, []);

  // Sync projects
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      return;
    }
    
    const existingProjectIds = new Set((desktopItems || []).filter(i => i.type === 'app').map(i => i.projectId));
    const newProjects = projects.filter(p => !existingProjectIds.has(p.id));
    const deletedIds = new Set(
      (desktopItems || []).filter(i => i.type === 'app' && i.projectId && !projects.some(p => p.id === i.projectId)).map(i => i.projectId)
    );
    
    if (newProjects.length === 0 && deletedIds.size === 0) return;
    
    setDesktopItems((prev) => {
      const safePrev = prev || [];
      let items = safePrev.filter(i => i.type !== 'app' || !i.projectId || !deletedIds.has(i.projectId));
      newProjects.forEach(project => {
        const pos = getNextPosition(items);
        if (pos) {
          items.push({
            id: `app-${project.id}`,
            type: 'app',
            name: project.name,
            icon: getProjectIcon(project.name),
            color: getProjectColor(project.name),
            position: pos,
            projectId: project.id,
          });
        } else {
          // No space on desktop, create or use "Other Apps" folder
          let otherFolder = items.find(i => i.type === 'folder' && i.name === 'Other Apps');
          if (!otherFolder) {
            const folderPos = getNextPosition(items);
            if (folderPos) {
              otherFolder = {
                id: `folder-other-${Date.now()}`,
                type: 'folder',
                name: 'Other Apps',
                icon: '📁',
                color: 'from-purple-500 to-pink-500',
                position: folderPos,
              };
              items.push(otherFolder);
            }
          }
          
          if (otherFolder) {
            items.push({
              id: `app-${project.id}`,
              type: 'app',
              name: project.name,
              icon: getProjectIcon(project.name),
              color: getProjectColor(project.name),
              position: { x: 20, y: 20 }, // Position doesn't matter, it's in a folder
              projectId: project.id,
              folderId: otherFolder.id,
            });
          }
        }
      });
      return items;
    });
  }, [projects, initialized, getNextPosition]);

  // Window functions
  const openWindow = (type: OpenWindow['type'], title: string) => {
    const existing = openWindows.find(w => w.type === type);
    if (existing) {
      bringToFront(existing.id);
      if (existing.minimized) setOpenWindows(prev => prev.map(w => w.id === existing.id ? { ...w, minimized: false } : w));
      return;
    }
    const newZ = highestZIndex + 1;
    setHighestZIndex(newZ);
    const sizes: Record<string, { width: number; height: number }> = {
      'notes': { width: 350, height: 400 },
      'terminal': { width: 600, height: 400 },
      'browser-agent': { width: 400, height: 350 },
      'api-monitor': { width: 350, height: 300 },
      'file-manager': { width: 450, height: 400 },
      'secrets-vault': { width: 380, height: 450 },
      'api-playground': { width: 550, height: 500 },
      'agent-monitor': { width: 420, height: 450 },
      'version-timeline': { width: 400, height: 500 },
      'prompt-lab': { width: 500, height: 550 },
    };
    const windowId = `window-${Date.now()}`;
    setOpenWindows(prev => [...prev, {
      id: windowId, title, type,
      position: { x: 100 + openWindows.length * 30, y: 50 + openWindows.length * 30 },
      size: sizes[type] || { width: 400, height: 300 },
      minimized: false, maximized: false, zIndex: newZ,
    }]);
    setActiveWindowId(windowId);
  };

  const closeWindow = (id: string) => setOpenWindows(prev => prev.filter(w => w.id !== id));
  const minimizeWindow = (id: string) => setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w));
  const maximizeWindow = (id: string) => setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w));
  const bringToFront = (id: string) => {
    const newZ = highestZIndex + 1;
    setHighestZIndex(newZ);
    setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: newZ } : w));
    setActiveWindowId(id);
  };

  const handleItemClick = (item: DesktopItem) => {
    if (item.type === 'app' && item.projectId) onSelectProject(item.projectId);
    else if (item.type === 'system') {
      const appId = item.id.replace('system-', '');
      const app = DEFAULT_SYSTEM_APPS.find(a => a.id === appId);
      if (app) openWindow(app.type, app.name);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent, itemId: string) => {
    if (!desktopRef.current || (e.clientX === 0 && e.clientY === 0)) return;
    const rect = desktopRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left - ICON_SIZE / 2;
    let y = e.clientY - rect.top - ICON_SIZE / 2;
    if (snapToGrid) { x = Math.round(x / GRID_SIZE) * GRID_SIZE; y = Math.round(y / GRID_SIZE) * GRID_SIZE; }
    x = Math.max(0, Math.min(x, rect.width - ICON_SIZE));
    y = Math.max(0, Math.min(y, rect.height - ICON_SIZE));
    setDesktopItems(prev => prev.map(item => item.id === itemId ? { ...item, position: { x, y } } : item));
  }, [snapToGrid]);

  // Handle drag over folder (for dropping items into folders)
  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Only allow drop if we're dragging an item that isn't this folder
    if (draggedItem && draggedItem !== folderId) {
      setDropTargetFolder(folderId);
    }
  }, [draggedItem]);

  // Handle drag leave folder
  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetFolder(null);
  }, []);

  // Handle drop on folder - move item into the folder
  const handleDropOnFolder = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem || draggedItem === folderId) {
      setDropTargetFolder(null);
      return;
    }
    
    const itemToMove = desktopItems.find(item => item.id === draggedItem);
    const targetFolder = desktopItems.find(item => item.id === folderId);
    
    // Don't allow moving folders into folders (for now)
    if (itemToMove?.type === 'folder') {
      setDropTargetFolder(null);
      return;
    }
    
    // Move the item into the folder
    if (itemToMove && targetFolder?.type === 'folder') {
      setDesktopItems(prev => prev.map(item => {
        if (item.id === draggedItem) {
          return { ...item, folderId: folderId };
        }
        if (item.id === folderId && item.items) {
          return { ...item, items: [...item.items, draggedItem] };
        }
        return item;
      }));
    }
    
    setDropTargetFolder(null);
    setDraggedItem(null);
  }, [draggedItem, desktopItems]);

  // Handle drag end - reset drop target if not dropped on folder
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTargetFolder(null);
  }, []);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, targetItem?: DesktopItem) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = desktopRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setContextMenu({
      show: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      targetItem,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0 });
  }, []);

  // Create new folder
  const createFolder = useCallback((x: number, y: number) => {
    const folderId = `folder-${Date.now()}`;
    const newFolder: DesktopItem = {
      id: folderId,
      type: 'folder',
      name: 'New Folder',
      icon: '📂',
      color: 'from-amber-400 to-orange-500',
      position: snapToGrid 
        ? { x: Math.round(x / GRID_SIZE) * GRID_SIZE, y: Math.round(y / GRID_SIZE) * GRID_SIZE }
        : { x, y },
      items: [],
    };
    setDesktopItems(prev => [...prev, newFolder]);
    setEditingFolder(folderId);
    setFolderName('New Folder');
    closeContextMenu();
  }, [snapToGrid, closeContextMenu]);

  // Rename folder
  const renameFolder = useCallback((folderId: string, newName: string) => {
    if (!newName.trim()) return;
    setDesktopItems(prev => prev.map(item => 
      item.id === folderId ? { ...item, name: newName.trim() } : item
    ));
    setEditingFolder(null);
  }, []);

  // Delete folder (move items out first)
  const deleteFolder = useCallback((folderId: string) => {
    setDesktopItems(prev => {
      const folder = prev.find(i => i.id === folderId);
      if (!folder) return prev;
      
      // Move all items out of the folder
      const updatedItems = prev.map(item => {
        if (item.folderId === folderId) {
          return { ...item, folderId: undefined };
        }
        return item;
      });
      
      // Remove the folder
      return updatedItems.filter(i => i.id !== folderId);
    });
    closeContextMenu();
  }, [closeContextMenu]);

  // Move item into folder
  const moveToFolder = useCallback((itemId: string, folderId: string) => {
    setDesktopItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, folderId } : item
    ));
  }, []);

  // Move item out of folder
  const moveOutOfFolder = useCallback((itemId: string) => {
    setDesktopItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      
      const newPos = getNextPosition(prev.filter(i => !i.folderId));
      if (!newPos) {
        // No space on desktop, keep it in the folder or move to "Other Apps"
        let otherFolder = prev.find(i => i.type === 'folder' && i.name === 'Other Apps');
        if (!otherFolder) {
          const folderPos = getNextPosition(prev.filter(i => i.type !== 'folder' || i.name !== 'Other Apps'));
          if (folderPos) {
            otherFolder = {
              id: `folder-other-${Date.now()}`,
              type: 'folder',
              name: 'Other Apps',
              icon: '📁',
              color: 'from-purple-500 to-pink-500',
              position: folderPos,
            };
            return [...prev.map(i => i.id === itemId ? { ...i, folderId: otherFolder!.id } : i), otherFolder];
          }
        }
        // Keep in current folder or move to Other Apps if no space
        return prev.map(i => 
          i.id === itemId ? { ...i, folderId: otherFolder?.id || item.folderId } : i
        );
      }
      return prev.map(i => 
        i.id === itemId ? { ...i, folderId: undefined, position: newPos } : i
      );
    });
  }, [getNextPosition]);

  // Delete item (for apps)
  const deleteItem = useCallback((itemId: string) => {
    setDesktopItems(prev => prev.filter(i => i.id !== itemId));
    closeContextMenu();
  }, [closeContextMenu]);

  // Toggle folder open/close
  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolder(prev => prev === folderId ? null : folderId);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.show) closeContextMenu();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu.show, closeContextMenu]);

  // Terminal command handler - executes real commands in WebContainer when available
  const handleTerminalCommand = async (command: string) => {
    const cmd = command.trim();
    if (!cmd) return;
    
    setTerminalInput('');
    const newHistory = [...terminalHistory, `$ ${command}`];
    setTerminalHistory(newHistory);
    
    // Check if it's an npm/yarn/pnpm/node command that needs WebContainer
    const isShellCommand = cmd.startsWith('npm ') || cmd.startsWith('yarn ') || 
                           cmd.startsWith('pnpm ') || cmd.startsWith('node ') ||
                           cmd.startsWith('npx ') || cmd === 'ls' || cmd.startsWith('ls ') ||
                           cmd === 'pwd' || cmd.startsWith('cat ') || cmd.startsWith('mkdir ') ||
                           cmd.startsWith('cd ');
    
    if (isShellCommand) {
      // Check if project is selected
      if (!currentProjectId) {
        setTerminalHistory([...newHistory, 
          '⚠️  No project selected.',
          '',
          'Select a project first:',
          '  • Click an app on the desktop',
          '  • Or use "open <number>" command',
          ''
        ]);
        return;
      }
      
      // Check if WebContainer is ready
      if (!webContainerService || !isWebContainerReady) {
        setTerminalHistory([...newHistory,
          '⚠️  WebContainer not ready.',
          '',
          'Go to the Editor tab first to initialize the dev environment.',
          'Then return here to run commands.',
          ''
        ]);
        return;
      }
      
      // Execute the command in WebContainer
      setTerminalWorking(true);
      try {
        const parts = cmd.split(' ');
        const executable = parts[0];
        const args = parts.slice(1);
        
        // Check if files are actually loaded in WebContainer
        let files: string[] = [];
        try {
          files = await webContainerService.listFiles('.');
        } catch {
          // Ignore
        }
        
        // If no files loaded yet, guide user
        if (files.length === 0 || (files.length === 1 && files[0] === '')) {
          setTerminalHistory([...newHistory,
            '⚠️  No project files loaded in WebContainer.',
            '',
            'To run npm/yarn commands:',
            '1. Go to the Editor tab',
            '2. Generate or load a project',
            '3. Return here to run commands',
            ''
          ]);
          setTerminalWorking(false);
          return;
        }
        
        // Check for package.json before running npm/yarn/pnpm
        if (cmd.startsWith('npm ') || cmd.startsWith('yarn ') || cmd.startsWith('pnpm ')) {
          const hasRootPackage = files.includes('package.json');
          const hasClientDir = files.includes('client');
          
          if (!hasRootPackage && !hasClientDir) {
            setTerminalHistory([...newHistory,
              '❌ No package.json found in project.',
              '',
              'Make sure you have generated an app first.',
              'Try: Go to Editor tab → Generate app → Return here',
              ''
            ]);
            setTerminalWorking(false);
            return;
          }
        }
        
        // Determine working directory based on project structure
        let cwd = '.';
        if (cmd.startsWith('npm ') || cmd.startsWith('yarn ') || cmd.startsWith('pnpm ')) {
          // Check if this is a monorepo - run in client/ if it exists
          if (files.includes('client')) {
            cwd = 'client';
          }
        }
        
        setTerminalHistory(prev => [...prev, `📂 Running in: ${cwd === '.' ? 'root' : cwd}`]);
        
        const result = await webContainerService.executeCommand(executable, args, {
          cwd,
          onOutput: (line) => {
            setTerminalHistory(prev => [...prev, line]);
          }
        });
        
        if (result.exitCode !== 0) {
          setTerminalHistory(prev => [...prev, `❌ Command exited with code ${result.exitCode}`]);
        } else {
          setTerminalHistory(prev => [...prev, `✅ Done`]);
        }
      } catch (error) {
        setTerminalHistory(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      } finally {
        setTerminalWorking(false);
      }
      return;
    }

    const cmdLower = cmd.toLowerCase();
    
    if (cmdLower === 'help') {
      setTerminalHistory([...newHistory,
        '╔═══════════════════════════════════════════╗',
        '║             Elon Terminal                 ║',
        '╠═══════════════════════════════════════════╣',
        '║ Built-in Commands:                        ║',
        '║   help      - Show this help              ║',
        '║   clear     - Clear terminal              ║',
        '║   projects  - List all projects           ║',
        '║   open <n>  - Open project by number      ║',
        '║   status    - System status               ║',
        '║   plugins   - Show connected plugins      ║',
        '╠═══════════════════════════════════════════╣',
        '║ Shell Commands (requires project):        ║',
        '║   npm install, npm run dev, etc.          ║',
        '║   yarn add, yarn build, etc.              ║',
        '║   ls, pwd, cat, node, npx                 ║',
        '╠═══════════════════════════════════════════╣',
        isWebContainerReady 
          ? '║ ✅ WebContainer: Ready                    ║'
          : '║ ⚠️  WebContainer: Not ready (use Editor) ║',
        currentProjectId
          ? `║ ✅ Project: ${(projects.find(p => p.id === currentProjectId)?.name || 'Selected').padEnd(27)}║`
          : '║ ⚠️  No project selected                  ║',
        '╚═══════════════════════════════════════════╝'
      ]);
      return;
    } else if (cmdLower === 'clear') {
      setTerminalHistory(['$ Terminal cleared']);
      return;
    } else if (cmdLower === 'projects') {
      const projectList = [...newHistory, `Found ${projects.length} project(s):`];
      projects.forEach((p, i) => projectList.push(`  ${i + 1}. ${p.name}${p.id === currentProjectId ? ' ← selected' : ''}`));
      if (projects.length === 0) projectList.push('  No projects yet. Create one with the + button!');
      setTerminalHistory(projectList);
      return;
    } else if (cmdLower === 'status') {
      const connected = realPlugins.filter(p => p.isConnected).length;
      setTerminalHistory([...newHistory,
        '┌─────────────────────────────────────┐',
        '│          System Status              │',
        '├─────────────────────────────────────┤',
        `│ 📁 Projects: ${projects.length.toString().padEnd(22)}│`,
        `│ 🔌 Plugins: ${connected}/${realPlugins.length} connected${' '.repeat(14)}│`,
        `│ 🪟 Windows: ${openWindows.length.toString().padEnd(23)}│`,
        `│ 🐳 WebContainer: ${isWebContainerReady ? 'Ready' : 'Not ready'}${' '.repeat(isWebContainerReady ? 11 : 5)}│`,
        currentProjectId 
          ? `│ 📂 Project: ${(projects.find(p => p.id === currentProjectId)?.name || 'Unknown').slice(0, 20).padEnd(22)}│`
          : '│ 📂 No project selected              │',
        '└─────────────────────────────────────┘'
      ]);
      return;
    } else if (cmdLower === 'plugins') {
      const pluginLines = [...newHistory, 'Connected Plugins:'];
      const connected = realPlugins.filter(p => p.isConnected);
      if (connected.length > 0) {
        connected.forEach(p => pluginLines.push(`  ✅ ${p.icon} ${p.name}`));
      } else {
        pluginLines.push('  No plugins connected. Visit the Skills page.');
      }
      pluginLines.push('', 'Available:');
      realPlugins.filter(p => !p.isConnected).forEach(p => pluginLines.push(`  ⭕ ${p.icon} ${p.name}`));
      setTerminalHistory(pluginLines);
      return;
    } else if (cmdLower.startsWith('open ')) {
      const num = parseInt(cmd.split(' ')[1]);
      if (num > 0 && num <= projects.length) {
        onSelectProject(projects[num - 1].id);
        setTerminalHistory([...newHistory, `Opening ${projects[num - 1].name}...`]);
      } else {
        setTerminalHistory([...newHistory, `Error: Invalid project number (1-${projects.length})`]);
      }
      return;
    } else {
      setTerminalHistory([...newHistory, `Command not found: ${command}`, 'Type "help" for available commands']);
      return;
    }
  };

  const connectedPlugins = realPlugins.filter(p => p.isConnected);

  // Render window content
  const renderWindowContent = (window: OpenWindow) => {
    switch (window.type) {
      case 'notes':
        return (
          <textarea
            value={notesContent}
            onChange={(e) => setNotesContent(e.target.value)}
            placeholder="Write your notes here... Auto-saved!"
            className="flex-1 w-full resize-none border-0 p-3 text-sm bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 placeholder:text-amber-600/50 focus:outline-none"
          />
        );
      case 'terminal':
        return (
          <div className="flex-1 flex flex-col bg-zinc-900 font-mono text-xs overflow-hidden">
            <div className="flex-1 p-2 overflow-auto text-emerald-400">
              {terminalHistory.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
              ))}
              {terminalWorking && <div className="text-yellow-400">Working...</div>}
            </div>
            <div className="flex items-center border-t border-zinc-700 p-2 bg-zinc-800">
              <span className="text-emerald-400 mr-1">$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTerminalCommand(terminalInput)}
                className="flex-1 bg-transparent outline-none text-emerald-400"
                placeholder="Type a command..."
                disabled={terminalWorking}
              />
            </div>
          </div>
        );
      case 'browser-agent':
        return (
          <div className="flex-1 p-3 space-y-2 overflow-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium">Browser Agent Ready</span>
            </div>
            <div className="text-xs p-2 bg-muted/50 rounded">🌐 Agent initialized</div>
            <div className="text-xs p-2 bg-muted/50 rounded">📸 Screenshot capability ready</div>
            <div className="text-xs p-2 bg-muted/50 rounded">🔍 Visual analysis available</div>
            <Button size="sm" className="w-full mt-3 h-7 text-xs">
              <Eye className="h-3 w-3 mr-1.5" />
              Take Screenshot
            </Button>
          </div>
        );
      case 'file-manager':
        return (
          <div className="flex-1 p-3 space-y-1 overflow-auto">
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projects yet</p>
                <Button size="sm" className="mt-3" onClick={onCreateProject}>
                  <Plus className="h-3 w-3 mr-1.5" />
                  Create Project
                </Button>
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                    currentProjectId === project.id 
                      ? 'bg-primary/15 ring-1 ring-primary/30 shadow-sm' 
                      : 'hover:bg-muted/60 hover:shadow-sm'
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className={`p-1.5 rounded-md transition-colors ${
                    currentProjectId === project.id ? 'bg-primary/20' : 'bg-blue-500/10 group-hover:bg-blue-500/20'
                  }`}>
                    <Folder className={`h-4 w-4 ${currentProjectId === project.id ? 'text-primary' : 'text-blue-500'}`} />
                  </div>
                  <span className="text-xs font-medium flex-1 truncate">{project.name}</span>
                  {currentProjectId === project.id && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary animate-in fade-in zoom-in-50 duration-200" />
                  )}
                </div>
              ))
            )}
          </div>
        );
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
      default:
        return null;
    }
  };

  // Memoize filtered items to ensure consistent hook order
  const desktopIcons = useMemo(() => (desktopItems || []).filter(item => !item.folderId), [desktopItems]);
  const folders = useMemo(() => (desktopItems || []).filter(i => i.type === 'folder'), [desktopItems]);
  const folderItems = useMemo(() => (desktopItems || []).filter(i => i.folderId === openFolder), [desktopItems, openFolder]);
  const appItems = useMemo(() => (desktopItems || []).filter(i => i.type === 'app'), [desktopItems]);
  const visibleWindows = useMemo(() => openWindows.filter(w => !w.minimized), [openWindows]);
  const minimizedWindows = useMemo(() => openWindows.filter(w => w.minimized), [openWindows]);
  const desktopBackgroundStyle = useMemo(() => ({
    background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #e0f2fe 100%)',
    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.1) 0%, transparent 50%), linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #e0f2fe 100%)`,
  }), []);
  const gridStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)`,
    backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
  }), []);

  return (
    <TooltipProvider>
      <div className="w-full h-full flex flex-col relative overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Desktop</h2>
              <Badge variant="secondary" className="text-[10px] h-5">{projects.length} apps</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant={snapToGrid ? "default" : "ghost"} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSnapToGrid(!snapToGrid);
                    }} 
                    className="h-7 w-7 p-0"
                    type="button"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Snap to grid</TooltipContent>
              </Tooltip>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={onCreateProject}>
                <Plus className="h-3.5 w-3.5" />
                New App
              </Button>
            </div>
          </div>

          {/* Desktop Canvas */}
          <div 
            ref={desktopRef}
            className="flex-1 relative overflow-hidden"
            onContextMenu={(e) => handleContextMenu(e)}
            style={desktopBackgroundStyle}
          >
            {snapToGrid && (
              <div className="absolute inset-0 pointer-events-none opacity-5" style={gridStyle} />
            )}

            {/* Desktop Icons - filter out items in folders */}
            {desktopIcons.map((item) => (
              <motion.div
                key={item.id}
                initial={false}
                animate={{ x: item.position.x, y: item.position.y }}
                transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
                draggable={item.type !== 'folder' || !dropTargetFolder}
                onDragStart={() => setDraggedItem(item.id)}
                onDrag={(e) => handleDrag(e as unknown as React.DragEvent, item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={item.type === 'folder' ? (e) => handleFolderDragOver(e, item.id) : undefined}
                onDragLeave={item.type === 'folder' ? handleFolderDragLeave : undefined}
                onDrop={item.type === 'folder' ? (e) => handleDropOnFolder(e, item.id) : undefined}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className="absolute cursor-grab active:cursor-grabbing select-none group"
                style={{ width: ICON_SIZE, zIndex: draggedItem === item.id ? 100 : (dropTargetFolder === item.id ? 50 : 1), willChange: draggedItem === item.id ? 'transform' : 'auto' }}
              >
                <div
                  className={`flex flex-col items-center p-1.5 rounded-xl transition-colors duration-150 ${
                    currentProjectId === item.projectId ? 'bg-purple-200/50 ring-2 ring-purple-400/50' : 'hover:bg-white/50'
                  } ${draggedItem === item.id ? 'opacity-70 scale-110' : ''} ${openFolder === item.id ? 'ring-2 ring-purple-500/50' : ''} ${
                    dropTargetFolder === item.id ? 'bg-emerald-200/50 ring-2 ring-emerald-400 scale-110' : ''
                  } focus:outline-none focus:ring-2 focus:ring-purple-400/70`}
                  style={{ transform: draggedItem === item.id ? 'scale(1.1)' : dropTargetFolder === item.id ? 'scale(1.1)' : 'scale(1)' }}
                  onClick={() => item.type === 'folder' ? toggleFolder(item.id) : handleItemClick(item)}
                  onDoubleClick={() => item.type === 'app' && item.projectId && onEditProject(item.projectId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      item.type === 'folder' ? toggleFolder(item.id) : handleItemClick(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.name}${item.type === 'folder' ? ' folder' : ' app'}`}
                >
                  {/* Folder editing mode */}
                  {item.type === 'folder' && editingFolder === item.id ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                        <FolderOpen className="h-5 w-5 text-white drop-shadow-sm" />
                      </div>
                        <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        onBlur={() => renameFolder(item.id, folderName)}
                        onKeyDown={(e) => e.key === 'Enter' && renameFolder(item.id, folderName)}
                        autoFocus
                        className="mt-1 w-14 text-[9px] bg-white/90 text-gray-900 text-center rounded px-1 py-0.5 outline-none ring-1 ring-purple-300/50 border border-purple-200/50"
                      />
                    </div>
                  ) : (
                    <>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-transform duration-150`}>
                        {item.type === 'folder' ? (
                          openFolder === item.id ? (
                            <FolderOpen className="h-5 w-5 text-white drop-shadow-sm" />
                          ) : (
                            <Folder className="h-5 w-5 text-white drop-shadow-sm" />
                          )
                        ) : (
                          renderAppIcon(item.icon, "h-5 w-5 text-gray-900 drop-shadow-sm")
                        )}
                      </div>
                      <p className="mt-1 text-[9px] font-medium text-gray-900 text-center truncate w-full px-0.5 drop-shadow-sm">
                        {item.name.length > 10 ? item.name.slice(0, 8) + '...' : item.name}
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Context Menu */}
            <AnimatePresence>
              {contextMenu.show && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bg-zinc-900/95 backdrop-blur-lg border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-[180px] z-[200]"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                  role="menu"
                  aria-label="Desktop context menu"
                >
                  {/* Desktop context menu (no item selected) */}
                  {!contextMenu.targetItem && (
                    <>
                      <button
                        onClick={() => createFolder(contextMenu.x, contextMenu.y)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Create new folder"
                      >
                        <FolderPlus className="h-4 w-4 text-amber-400" aria-hidden="true" />
                        New Folder
                      </button>
                      <button
                        onClick={() => { onCreateProject(); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Create new app"
                      >
                        <Plus className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                        New App
                      </button>
                      <div className="border-t border-zinc-700 my-1" role="separator" />
                      <button
                        onClick={() => { setSnapToGrid(!snapToGrid); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label={snapToGrid ? 'Disable grid snap' : 'Enable grid snap'}
                      >
                        <LayoutGrid className="h-4 w-4 text-blue-400" aria-hidden="true" />
                        {snapToGrid ? 'Disable' : 'Enable'} Grid Snap
                      </button>
                      <button
                        onClick={() => { 
                          // Sort items alphabetically
                          setDesktopItems(prev => {
                            const sorted = [...prev].sort((a, b) => a.name.localeCompare(b.name));
                            let col = 0, row = 0;
                            return sorted.map(item => {
                              const pos = { x: 20 + col * GRID_SIZE, y: 20 + row * GRID_SIZE };
                              col++;
                              if (col >= 8) { col = 0; row++; }
                              return { ...item, position: pos };
                            });
                          });
                          closeContextMenu();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Sort items by name"
                      >
                        <SortAsc className="h-4 w-4 text-purple-400" aria-hidden="true" />
                        Sort by Name
                      </button>
                      <button
                        onClick={() => { window.location.reload(); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Refresh desktop"
                      >
                        <RefreshCw className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                        Refresh
                      </button>
                    </>
                  )}

                  {/* Folder context menu */}
                  {contextMenu.targetItem?.type === 'folder' && (
                    <>
                      <button
                        onClick={() => { toggleFolder(contextMenu.targetItem!.id); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label={openFolder === contextMenu.targetItem.id ? 'Close folder' : 'Open folder'}
                      >
                        <FolderOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
                        {openFolder === contextMenu.targetItem.id ? 'Close' : 'Open'} Folder
                      </button>
                      <button
                        onClick={() => { 
                          setEditingFolder(contextMenu.targetItem!.id); 
                          setFolderName(contextMenu.targetItem!.name);
                          closeContextMenu(); 
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Rename folder"
                      >
                        <Pencil className="h-4 w-4 text-blue-400" aria-hidden="true" />
                        Rename
                      </button>
                      <div className="border-t border-zinc-700 my-1" role="separator" />
                      <button
                        onClick={() => deleteFolder(contextMenu.targetItem!.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors focus:outline-none focus:bg-red-900/30"
                        aria-label="Delete folder"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete Folder
                      </button>
                    </>
                  )}

                  {/* App context menu */}
                  {contextMenu.targetItem?.type === 'app' && (
                    <>
                      <button
                        onClick={() => { 
                          if (contextMenu.targetItem?.projectId) onSelectProject(contextMenu.targetItem.projectId);
                          closeContextMenu();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Open app"
                      >
                        <Play className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                        Open
                      </button>
                      <button
                        onClick={() => { 
                          if (contextMenu.targetItem?.projectId) onEditProject(contextMenu.targetItem.projectId);
                          closeContextMenu();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                        aria-label="Edit app in playground"
                      >
                        <Edit3 className="h-4 w-4 text-blue-400" aria-hidden="true" />
                        Edit in Playground
                      </button>
                      {/* Move to folder options */}
                      {folders.length > 0 && (
                        <>
                          <div className="border-t border-zinc-700 my-1" role="separator" />
                          <div className="px-3 py-1 text-[10px] text-zinc-500 uppercase tracking-wide" aria-label="Move to folder options">Move to Folder</div>
                          {folders.map(folder => (
                            <button
                              key={folder.id}
                              onClick={() => { 
                                moveToFolder(contextMenu.targetItem!.id, folder.id);
                                closeContextMenu();
                              }}
                              className="w-full flex items-center gap-3 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-zinc-800"
                              aria-label={`Move to folder ${folder.name}`}
                            >
                              <Folder className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                              {folder.name}
                            </button>
                          ))}
                        </>
                      )}
                      <div className="border-t border-zinc-700 my-1" role="separator" />
                      <button
                        onClick={() => deleteItem(contextMenu.targetItem!.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors focus:outline-none focus:bg-red-900/30"
                        aria-label="Remove app from desktop"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove from Desktop
                      </button>
                    </>
                  )}

                  {/* System app context menu */}
                  {contextMenu.targetItem?.type === 'system' && (
                    <>
                      <button
                        onClick={() => { handleItemClick(contextMenu.targetItem!); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                      >
                        <Play className="h-4 w-4 text-emerald-400" />
                        Open
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Open Folder Content Overlay */}
            <AnimatePresence>
              {openFolder && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[150]"
                  onClick={() => setOpenFolder(null)}
                >
                  <motion.div
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    className="bg-zinc-900/95 border border-zinc-700 rounded-2xl p-4 min-w-[300px] max-w-[500px] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-amber-400" />
                        <span className="font-medium text-white">
                          {desktopItems.find(i => i.id === openFolder)?.name || 'Folder'}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOpenFolder(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-auto">
                      {folderItems.length === 0 ? (
                        <div className="col-span-4 text-center py-8 text-zinc-500">
                          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Folder is empty</p>
                          <p className="text-xs">Drag apps here to organize</p>
                        </div>
                      ) : (
                        folderItems.map(item => (
                          <div
                            key={item.id}
                            className="flex flex-col items-center p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                            onClick={() => {
                              if (item.type === 'app' && item.projectId) onSelectProject(item.projectId);
                              else handleItemClick(item);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Show option to remove from folder
                              if (confirm('Remove from folder?')) {
                                moveOutOfFolder(item.id);
                              }
                            }}
                          >
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                              {renderAppIcon(item.icon, "h-5 w-5 text-white")}
                            </div>
                            <p className="mt-1 text-[10px] text-white/80 text-center truncate w-full">
                              {item.name}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Windows */}
            <AnimatePresence mode="wait">
              {visibleWindows.map((window) => (
                <motion.div
                  key={window.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={`absolute rounded-lg shadow-2xl overflow-hidden flex flex-col bg-card ${activeWindowId === window.id ? 'ring-2 ring-primary/50' : ''}`}
                  style={{
                    left: window.maximized ? 0 : window.position.x,
                    top: window.maximized ? 0 : window.position.y,
                    width: window.maximized ? '100%' : window.size.width,
                    height: window.maximized ? '100%' : window.size.height,
                    zIndex: window.zIndex,
                    willChange: 'transform',
                  }}
                  onClick={() => bringToFront(window.id)}
                >
                  <div 
                    className="flex items-center justify-between px-3 py-1.5 bg-muted/95 backdrop-blur border-b cursor-move"
                    onMouseDown={(e) => {
                      if (window.maximized) return;
                      const startX = e.clientX - window.position.x;
                      const startY = e.clientY - window.position.y;
                      let rafId: number | null = null;
                      const handleMove = (e: MouseEvent) => {
                        if (rafId !== null) cancelAnimationFrame(rafId);
                        rafId = requestAnimationFrame(() => {
                          setOpenWindows(prev => prev.map(w => w.id === window.id ? { ...w, position: { x: e.clientX - startX, y: e.clientY - startY } } : w));
                        });
                      };
                      const handleUp = () => { 
                        if (rafId !== null) cancelAnimationFrame(rafId);
                        document.removeEventListener('mousemove', handleMove); 
                        document.removeEventListener('mouseup', handleUp); 
                      };
                      document.addEventListener('mousemove', handleMove, { passive: true });
                      document.addEventListener('mouseup', handleUp, { passive: true });
                    }}
                  >
                    <span className="text-xs font-medium">{window.title}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); minimizeWindow(window.id); }}><Minimize2 className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); maximizeWindow(window.id); }}><Maximize2 className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 hover:bg-red-500 hover:text-white" onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">{renderWindowContent(window)}</div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {projects.length === 0 && appItems.length === 0 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
                <p className="text-sm text-white/60 mb-3">No apps yet. Create your first!</p>
                <Button onClick={onCreateProject} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create App
                </Button>
              </div>
            )}
          </div>

          {/* Taskbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t bg-card/80 backdrop-blur flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs font-medium">{projects.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Plug className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium">{connectedPlugins.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {minimizedWindows.map((window) => (
                <Button key={window.id} variant="secondary" size="sm" className="h-6 text-[10px] px-2" onClick={() => minimizeWindow(window.id)}>
                  {window.title}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowPluginsDialog(true)}>
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Plugins</span>
            </Button>
          </div>
        </div>

        {/* Plugins Dialog */}
        <Dialog open={showPluginsDialog} onOpenChange={setShowPluginsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" />
                Connected Skills
              </DialogTitle>
              <DialogDescription>
                Manage your connected services. Visit Skills page to add more.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {loadingPlugins ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 w-20 rounded bg-muted" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="h-8 w-8 rounded bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-1/3 rounded bg-muted" />
                        <div className="h-3 w-1/4 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : realPlugins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Plug className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No skills found</p>
                  <Button size="sm" className="mt-3" onClick={() => window.location.href = '/integrations'}>
                    Go to Skills
                  </Button>
                </div>
              ) : (
                <div>
                  {connectedPlugins.length > 0 && (
                    <div key="connected-plugins">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">CONNECTED</h4>
                      {connectedPlugins.map((plugin) => (
                        <div key={plugin.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{plugin.icon}</span>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {plugin.name}
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              </p>
                              <p className="text-xs text-muted-foreground">{plugin.category}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {realPlugins.filter(p => !p.isConnected).length > 0 && (
                    <div key="available-plugins">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">AVAILABLE</h4>
                      {realPlugins.filter(p => !p.isConnected).map((plugin) => (
                        <div key={plugin.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{plugin.icon}</span>
                            <div>
                              <p className="font-medium">{plugin.name}</p>
                              <p className="text-xs text-muted-foreground">{plugin.category}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => window.location.href = '/integrations'}>
                            Connect
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/integrations'}>
                Manage Skills
              </Button>
              <Button onClick={() => setShowPluginsDialog(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
