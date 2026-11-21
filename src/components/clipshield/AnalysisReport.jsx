import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Cpu, Eye, EyeOff, FileSearch, ListChecks, ShieldQuestion, TriangleAlert } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Switch } from "@/components/ui/switch";
import { rehydrate } from "@/lib/redaction";
import { cn } from "@/lib/utils";

const HEADINGS = ["What happened", "Likely impact", "Immediate next steps", "What a human must verify"];

const SEVERITY_CLASSES = {
  critical: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  high: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  medium: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  low: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

function SourceBanner({ result }) {
  if (result.inferenceSource === "ON_DEVICE") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-2.5">
        <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-[11.5px] leading-relaxed text-emerald-100/85">
          <span className="font-medium text-emerald-200">ON_DEVICE</span> — inference ran on this device. The sanitized
          content did not leave the browser.
        </p>
      </div>
    );
  }
  if (result.inferenceSource === "IN_CLOUD") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.07] px-3.5 py-2.5">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <p className="text-[11.5px] leading-relaxed text-sky-100/85">
          <span className="font-medium text-sky-200">IN_CLOUD</span> — inference ran on{" "}
          <span className="font-mono">{result.model}</span>. Only the sanitized text with placeholders was sent.
          {result.cloudFallback ? " This was a fallback from a local-first request." : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <p className="text-[11.5px] leading-relaxed text-amber-100/85">
        The SDK did not return an inference source for this request. ClipShield reports that honestly rather than
        assuming where it ran.
      </p>
    </div>
  );
}

function TextBrief({ text }) {
  const blocks = [];
  let current = { heading: null, lines: [] };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const normalized = trimmed.replace(/^#+\s*/, "").replace(/\*+/g, "").replace(/:$/, "").trim();
    const isHeading = HEADINGS.some((heading) => heading.toLowerCase() === normalized.toLowerCase());
    if (isHeading) {
      if (current.heading || current.lines.some(Boolean)) blocks.push(current);
      current = { heading: normalized, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.heading || current.lines.some(Boolean)) blocks.push(current);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const content = block.lines.join("\n").trim();
        if (!content) return null;
        const bullets = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList = bullets.every((line) => /^[-•*]\s+/.test(line));

        return (
          <div key={index}>
            {block.heading ? (
              <h4 className="font-heading text-[13px] font-semibold tracking-[-0.01em] text-foreground">{block.heading}</h4>
            ) : null}
            {isList ? (
              <ul className="mt-1.5 space-y-1">
                {bullets.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-foreground/85">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
                    <span>{line.replace(/^[-•*]\s+/, "")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85">{content}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StructuredBrief({ data }) {
  const findings = Array.isArray(data.security_findings) ? data.security_findings : [];
  const risks = Array.isArray(data.risk_matrix) ? data.risk_matrix : [];
  const actions = Array.isArray(data.action_items) ? data.action_items : [];
  const considerations = Array.isArray(data.operational_considerations) ? data.operational_considerations : [];
  const verification = Array.isArray(data.human_verification) ? data.human_verification : [];

  return (
    <div className="space-y-5">
      {data.executive_summary ? (
        <div>
          <h4 className="cs-mono text-[10px] text-muted-foreground">Executive summary</h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{data.executive_summary}</p>
        </div>
      ) : null}

      {findings.length ? (
        <div>
          <h4 className="cs-mono text-[10px] text-muted-foreground">Security &amp; privacy findings</h4>
          <ul className="mt-2 space-y-2">
            {findings.map((finding, index) => (
              <li key={index} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-foreground">{finding.title}</span>
                  <span
                    className={cn(
                      "ml-auto rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em]",
                      SEVERITY_CLASSES[finding.severity] || SEVERITY_CLASSES.medium,
                    )}
                  >
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{finding.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {risks.length ? (
        <div>
          <h4 className="cs-mono text-[10px] text-muted-foreground">Risk matrix</h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Likelihood</th>
                  <th className="px-3 py-2 font-medium">Impact</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk, index) => (
                  <tr key={index} className="border-t border-white/[0.05] align-top">
                    <td className="px-3 py-2.5">
                      <span className="block text-[12px] text-foreground/90">{risk.risk}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{risk.explanation}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{risk.likelihood}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{risk.impact}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em]",
                          SEVERITY_CLASSES[risk.severity] || SEVERITY_CLASSES.medium,
                        )}
                      >
                        {risk.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {actions.length ? (
        <div>
          <h4 className="cs-mono text-[10px] text-muted-foreground">Recommended actions</h4>
          <ul className="mt-2 space-y-1.5">
            {actions.map((item, index) => (
              <li key={index} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-[12px] leading-relaxed text-foreground/85">{item.action}</span>
                <span className="ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  {item.priority} · {item.owner_role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {considerations.length ? (
          <div>
            <h4 className="cs-mono text-[10px] text-muted-foreground">Operational considerations</h4>
            <ul className="mt-2 space-y-1">
              {considerations.map((item, index) => (
                <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sky-400/70" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {verification.length ? (
          <div>
            <h4 className="cs-mono text-[10px] text-muted-foreground">Requires human verification</h4>
            <ul className="mt-2 space-y-1">
              {verification.map((item, index) => (
                <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-400/70" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AnalysisReport({ result, error, busy, mapping = [] }) {
  const [reveal, setReveal] = useState(false);

  // Reveal is browser-only and never persists. Reset it whenever a new result
  // arrives so a stale reveal state never carries over to a different run.
  useEffect(() => {
    setReveal(false);
  }, [result]);

  const restored = reveal && result ? rehydrate(result.text, mapping) : null;
  return (
    <Panel>
      <SectionHeading
        step="06"
        title="Analysis results"
        hint={result ? "Generated from the sanitized payload" : "Nothing generated yet"}
        right={
          result ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              {result.requestedMode}
            </span>
          ) : null
        }
      />

      <div className="mt-4">
        {error ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-rose-300" />
              <p className="text-[13px] font-medium text-rose-100">{error.message}</p>
            </div>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-rose-300/80">{error.code}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-rose-100/70">
              No result was fabricated to fill this space. Fix the cause above and run the request again.
            </p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <SourceBanner result={result} />
            {result.json ? <StructuredBrief data={result.json} /> : <TextBrief text={result.text} />}
            {result.structured && !result.json ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                <p className="text-[11.5px] leading-relaxed text-amber-100/80">
                  The model returned text that did not match the JSON contract. The raw response is shown above instead of
                  a guessed structure.
                </p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/80">
                  {result.text}
                </pre>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {reveal ? (
                    <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  ) : (
                    <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-[12px] font-medium text-foreground">Reveal original values locally</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Restore recognized placeholders from this tab's in-memory vault. Substitution happens only in the browser — rehydrated text is never sent to Firebase AI Logic or persisted.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={reveal}
                  onCheckedChange={setReveal}
                  disabled={!mapping.length}
                  aria-label="Reveal original values locally"
                />
              </div>

              {reveal ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2">
                    <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <p className="text-[11px] leading-relaxed text-amber-100/90">
                      Sensitive information is now displayed. This view stays in this browser tab only.
                    </p>
                  </div>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                    {restored}
                  </pre>
                </div>
              ) : null}
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Generated content can be wrong or incomplete. Placeholders are not expanded here — verify every claim against
              the original record in the rehydration vault.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
            <FileSearch className="mx-auto h-5 w-5 text-muted-foreground/60" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {busy ? "Running inference…" : "Load content, review the sanitized text, then choose an inference mode."}
            </p>
            <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground/80">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" /> brief
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldQuestion className="h-3 w-3" /> risk matrix
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> action items
              </span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}