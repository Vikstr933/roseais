import { MessageSquare, Code, Eye, Sparkles } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

type PlaygroundTab = 'desktop' | 'editor' | 'preview';

interface MobileBottomNavProps {
  activeTab: PlaygroundTab;
  setActiveTab: Dispatch<SetStateAction<PlaygroundTab>>;
  setChatSheetOpen: (open: boolean) => void;
  setPreviewModalOpen: (open: boolean) => void;
  chatHistory: any[];
  isLoading: boolean;
  currentComponentName: string;
  livePreviewUrl: string | null;
}

export function MobileBottomNav({
  activeTab,
  setActiveTab,
  setChatSheetOpen,
  setPreviewModalOpen,
  chatHistory,
  isLoading,
  currentComponentName,
  livePreviewUrl,
}: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border shadow-lg md:hidden">
      <div className="flex items-center justify-around h-16 px-2 safe-area-inset-bottom">
        {/* Chat Button */}
        <button
          onClick={() => setChatSheetOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 relative touch-target"
          aria-label="Open Chat"
        >
          <div className="relative">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            {chatHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-semibold">
                {chatHistory.length > 9 ? '9+' : chatHistory.length}
              </span>
            )}
            {isLoading && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-pulse flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Chat</span>
        </button>

        {/* Editor Tab Button */}
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 touch-target ${
            activeTab === 'editor' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Editor"
        >
          <Code className="h-5 w-5" />
          <span className="text-[10px] font-medium">Editor</span>
        </button>

        {/* Preview Tab Button */}
        <button
          onClick={() => {
            setActiveTab('preview');
            setPreviewModalOpen(true);
          }}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 touch-target relative ${
            activeTab === 'preview' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Preview"
        >
          <Eye className="h-5 w-5" />
          <span className="text-[10px] font-medium">Preview</span>
          {currentComponentName && livePreviewUrl && (
            <span className="absolute top-0 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          )}
        </button>

        {/* Elon Assistant Button */}
        <button
          onClick={() => {
            // Open Elon by clicking the OmniAssistant button
            const elonButton = document.querySelector('button[class*="rounded-full"][class*="shadow"]') as HTMLElement;
            if (elonButton && elonButton.querySelector('svg')) {
              elonButton.click();
            }
          }}
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 touch-target text-muted-foreground"
          aria-label="Open Elon Assistant"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] font-medium">Elon</span>
        </button>
      </div>
    </nav>
  );
}

