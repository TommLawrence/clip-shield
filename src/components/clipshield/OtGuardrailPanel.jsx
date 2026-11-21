import { TriangleAlert, ShieldAlert, Cpu, Network, KeyRound, FileWarning, Thermometer, Activity } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { cn } from "@/lib/utils";
import { OT_DISCLAIMER } from "@/lib/ot-guardrail";

const SEVERITY_CLASSES = {
  critical: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  high: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  medium: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  low: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

const TYPE_ICONS = {
  INTERLOCK_BYPASS: ShieldAlert,
  CONTROL_OVERRIDE: ShieldAlert,
  REPEATED_ALARM: Activity,
  TEMP_TREND: Thermometer,
  VIBRATION_TREND: Activity,
  EXPOSED_OT_ID: Cpu,
  OT_NETWORK: Network,
  REMOTE_ACCESS_CRED: KeyRound,
  FIRMWARE_REF: FileWarning,
};

export default function OtGuardrailPanel({ findings, hasContent }) {
  const safetyCritical = findings.filter((finding) => finding.requiresHumanVerification);

  return (
    <Panel>
      <SectionHeading
        step="OT"
        title="OT & critical-infrastructure guardrail"
        hint="Deterministic · detection only"
        right={
          findings.length ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              {findings.length} finding{findings.length === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />

      <div className="mt-4">
        {!hasContent ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
            <ShieldAlert className="mx-auto h-5 w-5 text-muted-foreground/60" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Load an operational or maintenance record to surface deterministic OT safety observations.
            </p>
          </div>
        ) : findings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
            <p className="text-[12.5px] text-muted-foreground">
              No OT safety indicators detected in this record. General IT and enterprise content is unaffected.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {safetyCritical.length > 0 ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <p className="text-[11.5px] leading-relaxed text-rose-100/90">
                  <span className="font-medium text-rose-200">{safetyCritical.length} safety-critical item{safetyCritical.length === 1 ? "" : "s"}</span>{" "}
                  require human verification against approved site procedures before any action.
                </p>
              </div>
            ) : null}

            <ul className="space-y-2.5">
              {findings.map((finding) => {
                const Icon = TYPE_ICONS[finding.type] || ShieldAlert;
                return (
                  <li key={finding.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <span className="text-[12.5px] font-medium text-foreground">{finding.label}</span>
                      <span
                        className={cn(
                          "ml-auto rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em]",
                          SEVERITY_CLASSES[finding.severity] || SEVERITY_CLASSES.medium,
                        )}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{finding.description}</p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-foreground/55">
                      matched: <span className="text-foreground/75">{finding.evidence}</span>
                    </p>
                    {finding.requiresHumanVerification ? (
                      <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-rose-300/80">
                        Requires human verification
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className="text-[11px] leading-relaxed text-muted-foreground">{OT_DISCLAIMER}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}