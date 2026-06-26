import { AlertTriangle, Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { AdvancedPreview } from "../../../components/AdvancedPreview";
import type { GeneratedFile } from "../types";

interface MobilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: { type: string; files?: GeneratedFile[] } | null;
  livePreviewUrl: string | null;
  currentComponentName: string;
  previewUnavailableMessage?: string;
}

export function MobilePreviewModal({
  open,
  onOpenChange,
  response,
  livePreviewUrl,
  currentComponentName,
  previewUnavailableMessage,
}: MobilePreviewModalProps) {
  const hasGeneratedFiles = typeof response === 'object' &&
    response?.type === 'component' &&
    response.files &&
    response.files.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-full h-full p-0 m-0 rounded-none [&>button]:hidden">
        <DialogHeader className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span>Preview - {currentComponentName || 'Your App'}</span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasGeneratedFiles && previewUnavailableMessage && !livePreviewUrl ? (
            <div className="h-full flex items-center justify-center bg-background px-6">
              <div className="text-center text-muted-foreground max-w-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <p className="text-base font-medium text-foreground mb-2">Preview could not start in this browser</p>
                <p className="text-sm leading-relaxed">{previewUnavailableMessage}</p>
              </div>
            </div>
          ) : hasGeneratedFiles ? (
            <AdvancedPreview
              files={response!.files!}
              previewUrl={livePreviewUrl || ''}
              projectName={currentComponentName}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-background">
              <div className="text-center text-muted-foreground">
                <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No preview available</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
