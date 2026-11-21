import { useRef, useState } from "react";
import { Copy, Eye, EyeOff, Highlighter, Lock, ShieldCheck } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "sanitized", label: "Sanitized" },
  { id: "original", label: "Original" },
  { id: "vault", label: "Rehydration vault" },
];

function Highlighted({ text }) {
  const parts = text.split(/(\[[A-Z]+_\d+\])/g);
  return (
    <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-black/35 p-4 font-mono text-[12.5px] leading-relaxed text-foreground/85">
      {parts.map((part, index) =>
        /^\[[A-Z]+_\d+\]$/.test(part) ? (
          <mark key={index} className="cs-token bg-primary/10">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </pre>
  );
}

export default function RedactionPreview({
  raw,
  sanitized,
  mapping,
  maskedCount,
  onMaskSelection,
  onCopySanitized,
  onCopyRestored,
  inspected,
}) {
  const [tab, setTab] = useState("sanitized");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [revealed, setRevealed] = useState(() => new Set());
  const areaRef = useRef(null);

  const captureSelection = () => {
    const node = areaRef.current;
    if (!node) return;
    setSelection({ start: node.selectionStart, end: node.selectionEnd });
  };

  const toggleReveal = (token) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const selectedLength = Math.max(0, selection.end - selection.start);

  return (
    <Panel>
      <SectionHeading
        step="03"
        title="Redaction preview"
        hint="Verify before anything leaves this tab"
        right={
          <Button onClick={onCopySanitized} size="sm" variant="outline" title="Copy sanitized" aria-label="Copy sanitized text" className="gap-2 border-white/[0.08] bg-white/[0.03]">
            <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy sanitized</span>
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Redaction preview views" className="flex flex-wrap rounded-lg border border-white/[0.08] bg-black/25 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] transition-colors sm:px-3 sm:text-[12px]",
                tab === item.id ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="hidden font-mono text-[10.5px] text-muted-foreground sm:inline">
          {maskedCount} masked · {mapping.length} placeholders
        </span>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10.5px] text-primary sm:inline-flex">
          <Lock className="h-3 w-3" /> memory only
        </span>
      </div>

      <div className="mt-3">
        {tab === "sanitized" ? (
          inspected ? (
            <Highlighted text={sanitized} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-[12.5px] text-muted-foreground">
              Inspect the content to build the sanitized version.
            </div>
          )
        ) : null}

        {tab === "original" ? (
          <div>
            <label htmlFor="original-preview" className="sr-only">
              Original text — select a span to mask it
            </label>
            <textarea
              id="original-preview"
              ref={areaRef}
              readOnly
              value={raw}
              onSelect={captureSelection}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              spellCheck={false}
              className="h-[240px] w-full resize-none overflow-auto rounded-xl border border-white/[0.06] bg-black/35 p-4 font-mono text-[12.5px] leading-relaxed text-foreground/85 focus-visible:ring-1 focus-visible:ring-primary/40"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/[0.08] bg-white/[0.03]"
                disabled={selectedLength < 2}
                onClick={() => onMaskSelection(selection.start, selection.end)}
                title="Mask selection"
                aria-label="Mask selection"
              >
                <Highlighter className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mask selection</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {selectedLength >= 2
                  ? `${selectedLength} characters selected — add them as [MANUAL_n]`
                  : "Select text above to add a manual mask."}
              </span>
            </div>
          </div>
        ) : null}

        {tab === "vault" ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/35 p-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <p className="text-[11.5px] leading-relaxed text-amber-100/80">
                This vault never leaves memory, is never written to storage, and is never attached to an AI request.
                Restoration happens only when you ask for it, in this browser.
              </p>
            </div>

            <ul className="mt-3 max-h-[190px] space-y-1.5 overflow-y-auto pr-1">
              {mapping.length ? (
                mapping.map((entry) => (
                  <li
                    key={entry.token}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <span className="cs-token shrink-0">{entry.token}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/85">
                      {revealed.has(entry.token) ? entry.value : "••••••••••••"}
                    </span>
                    <span className="hidden shrink-0 text-[10.5px] text-muted-foreground sm:inline">{entry.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleReveal(entry.token)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      aria-label={revealed.has(entry.token) ? `Hide ${entry.token}` : `Reveal ${entry.token}`}
                    >
                      {revealed.has(entry.token) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))
              ) : (
                <li className="py-4 text-center text-[12px] text-muted-foreground">No mapping stored.</li>
              )}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => onCopyRestored()}
                disabled={!mapping.length}
                title="Copy with originals"
                aria-label="Copy with originals"
              >
                <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy with originals</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">Explicit action. Never included in AI output.</span>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}