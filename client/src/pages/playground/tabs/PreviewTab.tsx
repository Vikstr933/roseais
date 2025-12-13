import { Eye, ChevronUp } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import { PythonPreview } from "../../../components/PythonPreview";
import { Badge } from "../../../components/ui/badge";
import type { GeneratedFile } from "../types";
import { useEffect, useMemo, useState } from "react";

interface PreviewTabProps {
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  isLoading: boolean;
  setPreviewModalOpen: (open: boolean) => void;
}

// Detect project type from files
function detectProjectType(files: GeneratedFile[]): 'web' | 'python' | 'node' | 'unknown' {
  const hasPythonFiles = files.some(f => f.path.endsWith('.py'));
  const hasReactFiles = files.some(f => 
    f.path.endsWith('.tsx') || f.path.endsWith('.jsx') ||
    (f.path === 'package.json' && f.content.includes('react'))
  );
  const hasPackageJson = files.some(f => f.path === 'package.json');
  
  // Python takes priority if .py files exist
  if (hasPythonFiles && !hasReactFiles) return 'python';
  if (hasReactFiles) return 'web';
  if (hasPackageJson) return 'node';
  
  return 'unknown';
}

export function PreviewTab({
  response,
  livePreviewUrl,
  currentComponentName,
  isLoading,
  setPreviewModalOpen,
}: PreviewTabProps) {
  const [forcePreviewType, setForcePreviewType] = useState<'auto' | 'web' | 'python'>('auto');
  
  // Detect project type from files
  const projectType = useMemo(() => {
    if (!response?.files || response.files.length === 0) return 'unknown';
    return detectProjectType(response.files);
  }, [response?.files]);

  // Determine which preview to show
  const activePreviewType = forcePreviewType === 'auto' ? projectType : forcePreviewType;

  // Debug logging
  useEffect(() => {
    if (livePreviewUrl) {
      console.log('📺 PreviewTab: Preview URL set to:', livePreviewUrl);
      console.log('📺 PreviewTab: Files count:', response?.files?.length || 0);
      console.log('📺 PreviewTab: Component name:', currentComponentName);
      console.log('📺 PreviewTab: Project type:', projectType);
    } else {
      console.log('📺 PreviewTab: No preview URL yet');
    }
  }, [livePreviewUrl, response?.files?.length, currentComponentName, projectType]);

  const hasFiles = typeof response === 'object' &&
    response?.type === 'component' &&
    response.files &&
    response.files.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Preview Type Selector (when we have mixed files) */}
      {hasFiles && (projectType === 'python' || response?.files?.some(f => f.path.endsWith('.py'))) && (
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <Button
            variant={activePreviewType === 'web' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setForcePreviewType(activePreviewType === 'web' ? 'auto' : 'web')}
          >
            🌐 Web
          </Button>
          <Button
            variant={activePreviewType === 'python' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setForcePreviewType(activePreviewType === 'python' ? 'auto' : 'python')}
          >
            🐍 Python
          </Button>
          <Badge variant="outline" className="ml-auto text-xs">
            {projectType === 'python' ? '🐍 Python Project' : 
             projectType === 'web' ? '🌐 Web Project' : 
             '📦 Node Project'}
          </Badge>
        </div>
      )}

      {/* Preview Content */}
      {hasFiles ? (
        <>
          {/* Mobile: Fullscreen Preview Button */}
          <div className="md:hidden p-2 border-b border-border bg-card flex items-center justify-between">
            <h3 className="text-sm font-medium">Preview</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalOpen(true)}
              className="text-xs"
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Fullscreen
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {activePreviewType === 'python' ? (
              <PythonPreview files={response!.files!} />
            ) : (
              <AdvancedPreview
                files={response!.files!}
                previewUrl={livePreviewUrl || ''}
                projectName={currentComponentName}
              />
            )}
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center text-muted-foreground">
            <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{isLoading ? "Generating code..." : "Preview will appear here"}</p>
            <p className="text-sm mt-2">{isLoading ? "Files are being generated in real-time..." : "Generate a component to see the preview"}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              <Badge variant="outline">🌐 Web apps (React)</Badge>
              <Badge variant="outline">🐍 Python scripts</Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

