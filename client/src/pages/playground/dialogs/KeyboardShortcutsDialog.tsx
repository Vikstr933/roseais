import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to work faster in the playground
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Project Management</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>New Project</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+N</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Save Project</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+S</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Restart Dev Server</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+Shift+R</kbd>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Navigation</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Focus Chat</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Editor Tab</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+1</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Preview Tab</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+2</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Sessions Tab</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+3</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span>Settings Tab</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded">Ctrl+4</kbd>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Shortcuts work when not typing in input fields. Press Escape to close dialogs.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

