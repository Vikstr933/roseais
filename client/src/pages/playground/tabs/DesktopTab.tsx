import { DesktopView } from "../../../components/DesktopView";
import { GenerationOverlay } from "../../../components/GenerationOverlay";
import type { WebContainerService } from "../../../services/WebContainerService";
import { Monitor, Power } from "lucide-react";

interface DesktopTabProps {
  projects: Array<{ id: number; name: string; description?: string; workspaceType?: 'personal' | 'team' }>;
  currentProjectId?: number;
  onSelectProject: (projectId: number) => void;
  onCreateProject: () => void;
  onEditProject: (projectId: number) => void;
  webContainerService: WebContainerService;
  isWebContainerReady: boolean;
  isLoading?: boolean;
  currentStep?: string;
  progress?: number;
}

export function DesktopTab({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  webContainerService,
  isWebContainerReady,
  isLoading = false,
  currentStep,
  progress = 0,
}: DesktopTabProps) {
  // Fixed desktop dimensions (16:10 aspect ratio, common for monitors)
  const DESKTOP_WIDTH = 800;
  const DESKTOP_HEIGHT = 500;
  const BEZEL_PADDING = 12; // Symmetric padding on all sides
  const BEZEL_BORDER = 4; // Border width
  const FRAME_WIDTH = DESKTOP_WIDTH + (BEZEL_PADDING * 2) + (BEZEL_BORDER * 2);
  const FRAME_HEIGHT = DESKTOP_HEIGHT + (BEZEL_PADDING * 2) + (BEZEL_BORDER * 2);
  
  return (
    <div className="h-full w-full flex items-center justify-center overflow-auto bg-background">
      {/* Computer/IDE Frame - Fixed Size Container */}
      <div className="relative flex-shrink-0 my-4 mx-auto" style={{ width: `${FRAME_WIDTH}px`, maxWidth: 'calc(100vw - 2rem)' }}>
        {/* Monitor Bezel - Top */}
        <div className="absolute -top-10 md:-top-12 left-0 right-0 h-10 md:h-12 bg-gradient-to-b from-gray-800 to-gray-900 rounded-t-lg flex items-center justify-center shadow-lg z-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500"></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-500"></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500"></div>
          </div>
          <div className="absolute right-2 md:right-4 flex items-center gap-1 text-gray-400 text-[10px] md:text-xs">
            <Monitor className="h-2.5 w-2.5 md:h-3 md:w-3" />
            <span className="hidden sm:inline">Desktop Environment</span>
          </div>
        </div>
        
        {/* Monitor Screen Frame */}
        <div 
          className="bg-gray-900 rounded-lg shadow-2xl border-gray-800"
          style={{
            padding: `${BEZEL_PADDING}px`,
            borderWidth: `${BEZEL_BORDER}px`,
            borderStyle: 'solid',
            width: `${FRAME_WIDTH}px`,
            height: `${FRAME_HEIGHT}px`,
          }}
        >
          {/* Screen Bezel Inner */}
          <div className="bg-black rounded-sm overflow-hidden shadow-inner w-full h-full">
            {/* Desktop Container - Fills entire screen */}
            <div className="relative w-full h-full overflow-hidden">
              <DesktopView
                projects={projects}
                currentProjectId={currentProjectId}
                onSelectProject={onSelectProject}
                onCreateProject={onCreateProject}
                onEditProject={onEditProject}
                webContainerService={webContainerService}
                isWebContainerReady={isWebContainerReady}
              />
              {/* Generation Overlay - Shows when code is being generated */}
              <GenerationOverlay
                isLoading={isLoading}
                currentStep={currentStep}
                progress={progress}
                style="hologram" // Can be changed to: 'matrix', 'particles', 'circuit', 'code-rain', 'hologram', 'minimal'
              />
            </div>
          </div>
        </div>
        
        {/* Monitor Stand/Base */}
        <div className="absolute -bottom-6 md:-bottom-8 left-1/2 -translate-x-1/2 w-48 md:w-64 h-6 md:h-8 bg-gradient-to-b from-gray-700 to-gray-800 rounded-b-lg"></div>
        <div className="absolute -bottom-12 md:-bottom-16 left-1/2 -translate-x-1/2 w-64 md:w-80 h-1.5 md:h-2 bg-gray-600 rounded"></div>
      </div>
    </div>
  );
}

