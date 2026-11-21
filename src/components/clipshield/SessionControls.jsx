import { Copy, Eraser, RotateCcw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SessionControls({ onCopy, onClearInput, onClearMappings, onReset, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onCopy} disabled={disabled} title="Copy sanitized" aria-label="Copy sanitized" className="gap-2 border-white/[0.08] bg-white/[0.03]">
        <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy sanitized</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onClearInput} title="Clear input" aria-label="Clear input" className="gap-2 text-muted-foreground hover:text-foreground">
        <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear input</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onClearMappings} title="Clear mappings" aria-label="Clear mappings" className="gap-2 text-muted-foreground hover:text-foreground">
        <Unlink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear mappings</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onReset} title="Reset workspace" aria-label="Reset workspace" className="gap-2 text-muted-foreground hover:text-foreground">
        <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset workspace</span>
      </Button>
    </div>
  );
}