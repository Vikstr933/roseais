import { Brain, Eye } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface MobileProgressIndicatorProps {
  isLoading: boolean;
  currentStep: string;
  setActiveTab: (tab: any) => void;
  setChatSheetOpen: (open: boolean) => void;
}

export function MobileProgressIndicator({
  isLoading,
  currentStep,
  setActiveTab,
  setChatSheetOpen,
}: MobileProgressIndicatorProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-primary/95 backdrop-blur-sm border-b border-primary/20 shadow-lg">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
          <Brain className="h-4 w-4 text-white animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-foreground truncate">
            Generating your app...
          </p>
          <p className="text-xs text-primary-foreground/80">
            {currentStep || 'Preparing files...'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveTab('preview');
            setChatSheetOpen(false);
          }}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <Eye className="h-4 w-4 mr-1" />
          Preview
        </Button>
      </div>
    </div>
  );
}

