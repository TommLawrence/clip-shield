import { ArrowRight, FileText, Sparkles, Trash2 } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function InputWorkspace({
  value,
  onChange,
  scenarios,
  onLoadScenario,
  onInspect,
  inspected,
  maskedCount,
  busy,
  onClear,
}) {
  return (
    <Panel className="flex flex-col">
      <SectionHeading
        step="01"
        title="Input workspace"
        right={
          <>
            <Badge variant="outline" className="hidden border-white/[0.08] text-[10px] text-muted-foreground sm:inline-flex">
              Stays in this tab
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={!value}
              title="Clear input"
              aria-label="Clear input"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear</span>
            </Button>
          </>
        }
      />

      <label htmlFor="raw-input" className="sr-only">
        Sensitive content to sanitize
      </label>
      <Textarea
        id="raw-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste a support ticket, incident report, maintenance log or vendor document. Everything here is sanitized in your browser before any AI request."
        spellCheck={false}
        className="mt-4 min-h-[236px] resize-y border-white/[0.07] bg-black/30 font-mono text-[12.5px] leading-relaxed placeholder:font-body placeholder:text-[12.5px] placeholder:text-muted-foreground/60"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {inspected ? `${maskedCount} entities masked locally` : "Not inspected yet — detection runs on your device"}
        </span>
        <span className="font-mono">{value.length.toLocaleString("en-US")} chars</span>
      </div>

      <div className="mt-4">
        <p className="cs-mono text-[10px] text-muted-foreground">Sample scenarios · synthetic data</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onLoadScenario(scenario)}
              className={cn(
                "group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition-all",
                "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.05]",
              )}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                <span className="text-[12.5px] font-medium text-foreground">{scenario.name}</span>
                <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70">
                  {scenario.tag}
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{scenario.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onInspect} disabled={!value.trim() || busy} className="gap-2">
          <Sparkles className="h-4 w-4" /> Inspect &amp; sanitize
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <p className="text-[11px] text-muted-foreground">No network request is made during inspection.</p>
      </div>
    </Panel>
  );
}