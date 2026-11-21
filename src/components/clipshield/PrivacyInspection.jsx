import { useState } from "react";
import { Plus, ScanLine, ShieldAlert, X } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import ExposureScore from "@/components/clipshield/ExposureScore";
import FindingsList from "@/components/clipshield/FindingsList";
import PolicySelector from "@/components/clipshield/PolicySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PrivacyInspection({
  exposure,
  findings,
  inspected,
  onToggle,
  customTerms,
  onAddTerm,
  onRemoveTerm,
  onRescan,
  hasContent,
  policy,
  onSetPolicy,
}) {
  const [term, setTerm] = useState("");

  const submit = (event) => {
    event.preventDefault();
    onAddTerm(term);
    setTerm("");
  };

  return (
    <Panel className="flex flex-col">
      <SectionHeading
        step="02"
        title="Privacy inspection"
        hint="Deterministic"
        right={
          <Button variant="outline" size="sm" onClick={onRescan} disabled={!hasContent} title="Re-scan" aria-label="Re-scan" className="gap-1.5 border-white/[0.08] bg-white/[0.03]">
            <ScanLine className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Re-scan</span>
          </Button>
        }
      />

      <div className="mt-5">
        <ExposureScore exposure={exposure} />
      </div>

      <div className="mt-4">
        <PolicySelector policy={policy} onChange={onSetPolicy} />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="cs-mono text-[10px] text-muted-foreground">Detected entities</h3>
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {findings.filter((finding) => finding.include).length} of {findings.length} masked
        </span>
      </div>

      <div className="mt-2">
        <FindingsList findings={findings} onToggle={onToggle} />
      </div>

      {exposure.factors.length ? (
        <div className="mt-4 hidden space-y-1 rounded-xl border border-white/[0.06] bg-black/20 p-3 sm:block">
          <p className="cs-mono mb-1.5 text-[9.5px] text-muted-foreground">Score composition</p>
          {exposure.factors.map((factor) => (
            <div key={factor.category} className="flex items-baseline justify-between gap-3 text-[11.5px]">
              <span className="truncate text-muted-foreground">{factor.explanation}</span>
              <span className="shrink-0 font-mono text-[11px] text-foreground/80">+{factor.points}</span>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4">
        <label htmlFor="custom-term" className="cs-mono text-[10px] text-muted-foreground">
          Custom sensitive term
        </label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="custom-term"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Project name, codename, client…"
            className="h-9 border-white/[0.08] bg-black/25 text-[12.5px]"
          />
          <Button type="submit" size="sm" variant="outline" title="Add term" aria-label="Add custom term" className="h-9 gap-1 border-white/[0.08] bg-white/[0.03]">
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </form>

      {customTerms.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {customTerms.map((custom) => (
            <span
              key={custom}
              className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-2.5 pr-1 text-[11px] text-muted-foreground"
            >
              {custom}
              <button
                type="button"
                onClick={() => onRemoveTerm(custom)}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-white/10 hover:text-foreground"
                aria-label={`Remove custom term ${custom}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-auto flex items-start gap-2 pt-4 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
        Pattern matching is best-effort. Toggle any finding off, or add a custom term, and review the sanitized text before
        analysis. {inspected ? "" : "Nothing has been scanned yet."}
      </p>
    </Panel>
  );
}