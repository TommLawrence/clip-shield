import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Highlighter, Lock, ShieldCheck } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeOffsetToRaw } from "@/lib/redaction";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "sanitized", label: "Sanitized" },
  { id: "original", label: "Original" },
  { id: "vault", label: "Rehydration vault" },
];

// Categories a manual mask can be tagged with. Each picks the placeholder
// prefix from the shared taxonomy; the default [MANUAL_n] needs no choice.
const CATEGORY_OPTIONS = [
  { id: "MANUAL", label: "Manual" },
  { id: "PERSON", label: "Person" },
  { id: "EMAIL", label: "Email" },
  { id: "PHONE", label: "Phone" },
  { id: "HOST", label: "Host / asset" },
  { id: "CUSTOM", label: "Custom term" },
];

const PLACEHOLDER_RE = /\[[A-Z]+_\d+\]/g;

function buildSegments(text) {
  const out = [];
  let last = 0;
  let match;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push({ type: "text", sStart: last, sEnd: match.index });
    out.push({ type: "token", sStart: match.index, sEnd: match.index + match[0].length });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", sStart: last, sEnd: text.length });
  return out;
}

// Plain-text character offset of (node, offset) within container, computed via
// a Range so nested <mark>/<span> nodes are handled correctly.
function textOffset(container, node, offset) {
  try {
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return -1;
  }
}

const EMPTY_SEL = { start: 0, end: 0, ok: false, rawStart: null, rawEnd: null, overlaps: false };

/**
 * Selectable, token-highlighted sanitized preview. The user can select any
 * plain-text span and mask it; selections crossing a placeholder are
 * rejected so the rehydration mapping cannot be corrupted. Selected offsets
 * are mapped back to raw-text offsets via the sanitizeMap from buildRedaction.
 */
function SelectableSanitized({ sanitized, sanitizeMap, raw, category, onCategoryChange, allOccurrences, onAllChange, onMask }) {
  const preRef = useRef(null);
  const [sel, setSel] = useState(EMPTY_SEL);
  const segments = useMemo(() => (sanitized ? buildSegments(sanitized) : []), [sanitized]);

  const capture = () => {
    const pre = preRef.current;
    if (!pre) return;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSel(EMPTY_SEL);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!pre.contains(range.startContainer) || !pre.contains(range.endContainer)) {
      setSel(EMPTY_SEL);
      return;
    }
    let start = textOffset(pre, range.startContainer, range.startOffset);
    let end = textOffset(pre, range.endContainer, range.endOffset);
    if (start < 0 || end < 0) {
      setSel(EMPTY_SEL);
      return;
    }
    if (start > end) [start, end] = [end, start];
    if (end - start < 1) {
      setSel(EMPTY_SEL);
      return;
    }
    const overlaps = segments.some((seg) => seg.type === "token" && seg.sStart < end && start < seg.sEnd);
    if (overlaps) {
      setSel({ start, end, ok: false, rawStart: null, rawEnd: null, overlaps: true });
      return;
    }
    const rawStart = sanitizeOffsetToRaw(sanitizeMap || [], start);
    const rawEnd = sanitizeOffsetToRaw(sanitizeMap || [], end);
    if (rawStart === null || rawEnd === null || rawEnd <= rawStart) {
      setSel({ start, end, ok: false, rawStart: null, rawEnd: null, overlaps: true });
      return;
    }
    setSel({ start, end, ok: true, rawStart, rawEnd, overlaps: false });
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      const pre = preRef.current;
      if (!pre) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (pre.contains(range.startContainer) || pre.contains(range.endContainer)) capture();
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [segments, sanitizeMap]);

  const handleMask = () => {
    if (!sel.ok) return;
    const value = raw.slice(sel.rawStart, sel.rawEnd);
    if (allOccurrences) {
      const count = value ? raw.split(value).length - 1 : 0;
      if (count > 1 && !window.confirm(`Mask all ${count} occurrences of the selected text?`)) return;
    }
    onMask(sel.rawStart, sel.rawEnd, { category, allOccurrences: allOccurrences });
  };

  const charCount = sel.end - sel.start;

  return (
    <div>
      <pre
        ref={preRef}
        onMouseUp={capture}
        onKeyUp={capture}
        className="cs-select-preview max-h-[260px] select-text overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-black/35 p-4 font-mono text-[12.5px] leading-relaxed text-foreground/85"
      >
        {segments.map((seg, index) =>
          seg.type === "token" ? (
            <mark key={index} className="cs-token bg-primary/10">
              {sanitized.slice(seg.sStart, seg.sEnd)}
            </mark>
          ) : (
            <span key={index}>{sanitized.slice(seg.sStart, seg.sEnd)}</span>
          ),
        )}
      </pre>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-8 w-[150px] border-white/[0.08] bg-white/[0.03] text-[11.5px]" aria-label="Manual mask category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-[12px]">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox checked={allOccurrences} onCheckedChange={(checked) => onAllChange(Boolean(checked))} />
          All occurrences
        </label>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-white/[0.08] bg-white/[0.03]"
          disabled={!sel.ok}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleMask}
          title="Mask selected text"
          aria-label="Mask selected text"
        >
          <Highlighter className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mask selected text</span>
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {sel.overlaps
            ? "Selection overlaps a placeholder — refine it."
            : sel.ok
              ? `${charCount} character${charCount === 1 ? "" : "s"} selected — mask it now`
              : "Select text in the preview to mask what detectors missed."}
        </span>
      </div>
    </div>
  );
}

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
  sanitizeMap,
}) {
  const [tab, setTab] = useState("sanitized");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [revealed, setRevealed] = useState(() => new Set());
  const [manualCategory, setManualCategory] = useState("MANUAL");
  const [allOccurrences, setAllOccurrences] = useState(false);
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
            <SelectableSanitized
              sanitized={sanitized}
              sanitizeMap={sanitizeMap}
              raw={raw}
              category={manualCategory}
              onCategoryChange={setManualCategory}
              allOccurrences={allOccurrences}
              onAllChange={setAllOccurrences}
              onMask={(start, end, options) => onMaskSelection(start, end, options)}
            />
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