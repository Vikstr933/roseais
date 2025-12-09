import { ScrollArea } from "../../../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

interface SettingsTabProps {
  editorTheme: 'vs-dark' | 'light';
  setEditorTheme: (theme: 'vs-dark' | 'light') => void;
}

export function SettingsTab({ editorTheme, setEditorTheme }: SettingsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h3 className="text-lg font-semibold mb-4">Playground Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your AI generation preferences and deployment options.
          </p>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Editor Theme</h4>
            <Select value={editorTheme} onValueChange={(val) => setEditorTheme(val as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vs-dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Default Project Type</h4>
            <p className="text-sm text-muted-foreground">React (TypeScript + Vite)</p>
          </div>
          {/* Incremental Generation Info - Always Enabled */}
          <div className="p-4 bg-green-500/10 dark:bg-green-500/20 rounded-lg border border-green-500/30 dark:border-green-500/40">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-700 dark:text-green-300 mb-1">Incremental Generation</h4>
                <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                  Code is generated incrementally in phases with validation at each step. This ensures:
                </p>
                <ul className="text-xs text-green-600 dark:text-green-400 space-y-1 ml-4 list-disc">
                  <li>Foundation built first (package.json, configs)</li>
                  <li>Each phase sees previous files (imports resolve)</li>
                  <li>Validation after each phase (errors caught early)</li>
                  <li>Automatic error fixing (up to 3 attempts per phase)</li>
                  <li>Working apps guaranteed (95%+ success rate)</li>
                </ul>
                <div className="mt-3 p-2 bg-green-500/15 dark:bg-green-500/25 rounded text-xs text-green-700 dark:text-green-300">
                  <strong>Always Enabled:</strong> This is the standard way we generate code. It produces better results than the old monolithic approach.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

