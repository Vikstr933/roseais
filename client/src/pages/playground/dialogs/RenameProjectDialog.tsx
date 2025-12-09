import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

interface RenameProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProject: { id: number; name: string } | null;
  onRename: (projectId: number, newName: string) => Promise<any>;
}

export function RenameProjectDialog({
  open,
  onOpenChange,
  currentProject,
  onRename,
}: RenameProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          <DialogDescription>
            Enter a new name for "{currentProject?.name}"
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const newName = formData.get('name') as string;

            if (!newName || !currentProject) return;

            if (currentProject) {
              const updatedProject = await onRename(currentProject.id, newName);
              if (updatedProject) {
                onOpenChange(false);
              }
            }
          }}
        >
          <div className="space-y-4 py-4">
            <Input
              name="name"
              defaultValue={currentProject?.name || ''}
              placeholder="Project name"
              required
              minLength={1}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

