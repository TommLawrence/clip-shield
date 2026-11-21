import { Cloud, Cpu, Info, Timer, TriangleAlert } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { MODE_SPECS } from "@/lib/hybrid-modes";
import { cn } from "@/lib/utils";

function Metric({ label, value, sub, tone = "default" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3.5">
      <p className="cs-mono text-[9.5px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-heading text-[15px] font-semibold leading-tight",
          tone === "emerald" ? "text-emerald-300" : tone === "cloud" ? "text-sky-300" : tone === "warn" ? "text-amber-300" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function RoutingInspector({ mode, result, error, device, runtime, firebase, maskedCount, phase }) {
  const spec = MODE_SPECS[mode];
  const source = result?.inferenceSource || null;

  const sourceTone = source === "ON_DEVICE" ? "emerald" : source === "IN_CLOUD" ? "cloud" : "default";
  const sourceValue = source || (error ? "Not returned" : phase !== "idle" ? "Pending" : "Not run");

  const readiness = (() => {
    if (firebase.status === "unconfigured") return "Firebase unconfigured";
    if (!runtime) return "Detecting…";
    if (!runtime.meetsVersion) return `Chrome ${runtime.chromeVersion || "unknown"} · needs 139+`;
    if (device.status === "ready") return "On-device ready";
    if (device.status === "downloading") return `Downloading ${device.progress ?? 0}%`;
    if (device.status === "unavailable") return "On-device unavailable";
    return "On-device not prepared";
  })();

  return (
    <Panel>
      <SectionHeading
        step="05"
        title="Hybrid routing inspector"
        hint="Values reported by the SDK"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-muted-foreground">
            <Timer className="h-3 w-3" /> per-request trace
          </span>
        }
      />

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Selected mode" value={spec.shortLabel} sub={spec.requestedMode} />
        <Metric label="Actual inference source" value={sourceValue} sub={source ? "result.response.inferenceSource" : "no fabricated value"} tone={sourceTone} />
        <Metric label="Latency" value={result ? `${result.latencyMs} ms` : "—"} sub="measured around generateContent" />
        <Metric
          label="Fallback"
          value={result ? (result.cloudFallback ? "Yes · cloud fallback" : "No") : "—"}
          sub={result ? (result.cloudFallback ? "PREFER_ON_DEVICE escalated" : "ran as requested") : "not run yet"}
          tone={result?.cloudFallback ? "warn" : "default"}
        />
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Masked entities" value={String(maskedCount)} sub="included in the request" />
        <Metric label="Sent characters" value={result ? String(result.sentChars) : "—"} sub={result?.truncated ? "truncated for context" : "sanitized payload"} />
        <Metric label="Cloud model" value={result?.model || "gemini-4-hydrogen"} sub="configured fallback / cloud target" />
        <Metric label="Model readiness" value={readiness} sub={runtime?.supportsPromptApi ? "Chrome Prompt API detected" : "Prompt API not detected"} />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/80" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            <span className="text-foreground/85">ON_DEVICE</span> / <span className="text-foreground/85">IN_CLOUD</span> is
            read from the response object. When the SDK does not return a source, ClipShield says so instead of guessing.
          </p>
        </div>

        {result?.structured ? (
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Structured JSON schema applied to the request (cloud response schema + on-device constraint).
            </p>
          </div>
        ) : null}

        {result && !result.structured && spec.structured ? (
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300/80" />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              This SDK build rejected the response-schema option, so the JSON contract is enforced by the prompt and parsed
              defensively.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
            <div className="text-[11.5px] leading-relaxed text-rose-100/80">
              <p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-rose-300">{error.code}</span> — {error.message}
              </p>
              {error.code === "app-check" || error.code === "network" ? (
                <p className="mt-1.5 font-mono text-[10.5px] text-rose-200/70">
                  hostname: {typeof window !== "undefined" ? window.location.hostname : "unknown"} · site key loaded:{" "}
                  {firebase?.diagnostics?.siteKeyLoaded ? "true" : "false"} · debug mode:{" "}
                  {firebase?.diagnostics?.debugTokenActive ? "active" : "inactive"}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}