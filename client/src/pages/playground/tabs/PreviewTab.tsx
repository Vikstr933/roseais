import { Eye, ChevronUp } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import type { GeneratedFile } from "../types";
import { useEffect } from "react";

interface PreviewTabProps {
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  isLoading: boolean;
  setPreviewModalOpen: (open: boolean) => void;
}

export function PreviewTab({
  response,
  livePreviewUrl,
  currentComponentName,
  isLoading,
  setPreviewModalOpen,
}: PreviewTabProps) {
  // Debug logging
  useEffect(() => {
    if (livePreviewUrl) {
      console.log('📺 PreviewTab: Preview URL set to:', livePreviewUrl);
      console.log('📺 PreviewTab: Files count:', response?.files?.length || 0);
      console.log('📺 PreviewTab: Component name:', currentComponentName);
    } else {
      console.log('📺 PreviewTab: No preview URL yet');
    }
  }, [livePreviewUrl, response?.files?.length, currentComponentName]);

  return (
    <div className="h-full flex flex-col">
      {/* Preview - Always visible, updates in real-time */}
      {typeof response === 'object' &&
       response?.type === 'component' &&
       response.files &&
       response.files.length > 0 ? (
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
            <AdvancedPreview
              files={response.files}
              previewUrl={livePreviewUrl || ''}
              projectName={currentComponentName}
            />
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center text-muted-foreground">
            <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{isLoading ? "Generating code..." : "Preview will appear here"}</p>
            <p className="text-sm mt-2">{isLoading ? "Files are being generated in real-time..." : "Generate a component to see the preview"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

