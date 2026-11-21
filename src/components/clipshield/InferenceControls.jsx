import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudCog,
  Cpu,
  Download,
  Loader2,
  Play,
  ShieldCheck,
} from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { MODE_ORDER, MODE_SPECS } from "@/lib/hybrid-modes";
import { cn } from "@/lib/utils";

const MODE_ICONS = { LOCAL_FIRST: Cpu, LOCAL_ONLY: ShieldCheck, CLOUD: Cloud, CLOUD_PREFERRED: CloudCog };

const CLOUD_MODES = new Set(["CLOUD", "CLOUD_PREFERRED"]);

function ModeCard({ spec, active, disabled, onSelect }) {
  const Icon = MODE_ICONS[spec.key];
  const tone =
    spec.key === "CLOUD"
      ? "bg-indigo-400/10 text-indigo-300 ring-indigo-400/25"
      : spec.key === "LOCAL_ONLY"
        ? "bg-white/[0.04] text-emerald-200/90 ring-white/10"
        : "bg-primary/12 text-primary ring-primary/25";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onSelect(spec.key)}
      className={cn(
        "rounded-xl border p-3 text-left transition-all sm:p-4",
        active
          ? "border-primary/35 bg-primary/[0.06] ring-1 ring-inset ring-primary/20"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{spec.requestedMode}</span>
      </div>
      <span className="mt-3 block font-heading text-[13.5px] font-semibold text-foreground">{spec.label}</span>
      <span className="mt-1 block text-[11.5px] leading-relaxed text-muted-foreground">{spec.description}</span>
      <span className="mt-3 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        {active ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <span className="h-3 w-3 rounded-full border border-white/15" />}
        {active ? "Selected" : "Select mode"}
      </span>
    </button>
  );
}

export default function InferenceControls({
  mode,
  setMode,
  consent,
  setConsent,
  onRun,
  onPrepareLocal,
  phase,
  device,
  firebase,
  runtime,
  canRun,
}) {
  const spec = MODE_SPECS[mode];
  const busy = phase !== "idle";
  const forceLocal = mode === "LOCAL_ONLY";

  const readiness =
    firebase.status === "unconfigured"
      ? "Firebase not connected"
      : runtime && !runtime.meetsVersion
        ? "Chrome 139+ required for on-device"
        : device.status === "ready"
          ? "On-device model ready"
          : device.status === "downloading"
            ? `Downloading on-device model · ${device.progress ?? 0}%`
            : "Not prepared";

  return (
    <Panel>
      <SectionHeading
        step="04"
        title="Inference controls"
        hint="Firebase AI Logic"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-muted-foreground">
            {readiness}
          </span>
        }
      />

      <div role="radiogroup" aria-label="Inference mode" className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {MODE_ORDER.map((key) => (
          <ModeCard
            key={key}
            spec={MODE_SPECS[key]}
            active={mode === key}
            disabled={busy || (forceLocal && key === "CLOUD")}
            onSelect={setMode}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-medium text-foreground">Force on-device only</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Locks the workspace to <span className="font-mono">ONLY_ON_DEVICE</span>. Cloud modes stay disabled, so a
              failure can never silently become a cloud request.
            </p>
          </div>
          <Switch
            checked={forceLocal}
            onCheckedChange={(checked) => setMode(checked ? "LOCAL_ONLY" : "LOCAL_FIRST")}
            disabled={busy}
            aria-label="Force on-device only"
          />
        </div>

        {mode === "LOCAL_FIRST" ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <Checkbox
              checked={consent.fallback}
              onCheckedChange={(checked) => setConsent((current) => ({ ...current, fallback: Boolean(checked) }))}
              className="mt-0.5"
            />
            <span className="text-[11.5px] leading-relaxed text-muted-foreground">
              I understand Firebase AI Logic will try Gemini Nano 4 on this device, and{" "}
              <span className="text-foreground/90">may automatically fall back to gemini-4-hydrogen in the cloud</span> if
              on-device inference is unavailable. Only the sanitized text would be sent.
            </span>
          </label>
        ) : null}

        {CLOUD_MODES.has(mode) ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-400/20 bg-indigo-400/[0.05] p-3">
            <Checkbox
              checked={consent.cloud}
              onCheckedChange={(checked) => setConsent((current) => ({ ...current, cloud: Boolean(checked) }))}
              className="mt-0.5"
            />
            <span className="text-[11.5px] leading-relaxed text-muted-foreground">
              I confirm the <span className="text-foreground/90">sanitized text only</span> may be sent to{" "}
              <span className="font-mono text-foreground/90">gemini-4-hydrogen</span>
              {mode === "CLOUD_PREFERRED" ? " (cloud-preferred; may fall back to this device)" : " for deep synthesis"}.
            </span>
          </label>
        ) : null}

        {mode === "LOCAL_ONLY" ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-3">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              No cloud request is possible in this mode. If the on-device model is unavailable, the run fails with a clear
              message instead of escalating.
            </p>
          </div>
        ) : null}

        {device.status === "downloading" || device.status === "preparing" ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-3 w-3" /> Preparing on-device model
              </span>
              <span className="font-mono">{device.progress ?? 0}%</span>
            </div>
            <Progress value={device.progress ?? 0} className="h-1.5 bg-white/[0.06]" />
          </div>
        ) : null}

        {device.status === "unavailable" && device.message ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <p className="text-[11.5px] leading-relaxed text-amber-100/80">{device.message}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onRun(mode)} disabled={busy || !canRun} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {phase === "running" ? "Running inference…" : phase === "preparing" ? "Preparing model…" : `Run ${spec.label}`}
          </Button>
          {spec.local ? (
            <Button
              variant="outline"
              onClick={onPrepareLocal}
              disabled={busy}
              className="gap-2 border-white/[0.08] bg-white/[0.03]"
            >
              <Cpu className="h-4 w-4" /> Prepare local AI
            </Button>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            {!canRun ? "Load content and inspect it first." : "Only the sanitized string is passed to Firebase AI Logic."}
          </span>
        </div>
      </div>
    </Panel>
  );
}