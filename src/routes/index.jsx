import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/clipshield/AppShell";
import InputWorkspace from "@/components/clipshield/InputWorkspace";
import PrivacyInspection from "@/components/clipshield/PrivacyInspection";
import RedactionPreview from "@/components/clipshield/RedactionPreview";
import InferenceControls from "@/components/clipshield/InferenceControls";
import RoutingInspector from "@/components/clipshield/RoutingInspector";
import AnalysisReport from "@/components/clipshield/AnalysisReport";
import OtGuardrailPanel from "@/components/clipshield/OtGuardrailPanel";
import AppCheckDiagnostics from "@/components/clipshield/AppCheckDiagnostics";
import SetupNotice from "@/components/clipshield/SetupNotice";
import SessionControls from "@/components/clipshield/SessionControls";
import useClipShield from "@/hooks/useClipShield";
import { SCENARIOS } from "@/lib/scenarios";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClipShield — privacy-first hybrid AI workspace" },
      {
        name: "description",
        content:
          "Redact sensitive workplace information locally, then run Firebase AI Logic hybrid inference with visible on-device or cloud routing.",
      },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const cs = useClipShield();

  const status = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
      <Lock className="h-3 w-3" />
      {cs.firebase.status === "ready" ? "Firebase connected" : "Local airlock active"}
    </span>
  );

  return (
    <AppShell status={status}>
      <div className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="cs-mono text-primary">Privacy gateway for generative AI</p>
            <h1 className="mt-3 font-heading text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[38px]">
              Sanitize first. Route consciously.
              <span className="block text-muted-foreground">Make privacy observable.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Paste a support ticket, incident report or vendor document. ClipShield masks sensitive values in this tab,
              shows you exactly what would be sent, and reports where inference actually ran.
            </p>
          </div>
          <SessionControls
            onCopy={cs.copySanitized}
            onClearInput={cs.clearInput}
            onClearMappings={cs.clearMappings}
            onReset={cs.resetAll}
            disabled={!cs.raw.trim()}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <InputWorkspace
            value={cs.raw}
            onChange={cs.setInput}
            scenarios={SCENARIOS}
            onLoadScenario={cs.loadScenario}
            onInspect={() => cs.inspect()}
            inspected={cs.inspected}
            maskedCount={cs.redaction.maskedCount}
            busy={cs.busy}
            onClear={cs.clearInput}
          />
          <PrivacyInspection
            exposure={cs.exposure}
            findings={cs.findings}
            inspected={cs.inspected}
            onToggle={cs.toggleFinding}
            customTerms={cs.customTerms}
            onAddTerm={cs.addCustomTerm}
            onRemoveTerm={cs.removeCustomTerm}
            onRescan={() => cs.inspect()}
            hasContent={Boolean(cs.raw.trim())}
            policy={cs.policy}
            onSetPolicy={cs.setPolicy}
          />
        </div>

        <div className="mt-4">
          <RedactionPreview
            raw={cs.raw}
            sanitized={cs.redaction.sanitized}
            mapping={cs.redaction.mapping}
            maskedCount={cs.redaction.maskedCount}
            onMaskSelection={cs.maskSelection}
            onCopySanitized={cs.copySanitized}
            onCopyRestored={cs.copyRestored}
            inspected={cs.inspected}
          />
        </div>

        <div className="mt-4">
          <InferenceControls
            mode={cs.mode}
            setMode={cs.setMode}
            consent={cs.consent}
            setConsent={cs.setConsent}
            onRun={cs.runMode}
            onPrepareLocal={cs.prepareLocal}
            phase={cs.phase}
            device={cs.device}
            firebase={cs.firebase}
            runtime={cs.runtime}
            canRun={Boolean(cs.raw.trim())}
          />
        </div>

        {cs.firebase.status === "unconfigured" ? (
          <div className="mt-4">
            <SetupNotice missing={cs.firebase.missing} />
          </div>
        ) : null}

        {cs.firebase.status === "ready" && cs.firebase.diagnostics ? (
          <div className="mt-4">
            <AppCheckDiagnostics
              diagnostics={cs.firebase.diagnostics}
              debugToken={cs.firebase.debugToken}
              onEnableDebugMode={cs.enableDebugMode}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <OtGuardrailPanel findings={cs.otFindings} hasContent={Boolean(cs.raw.trim())} />
        </div>

        <div className="mt-4">
          <RoutingInspector
            mode={cs.mode}
            result={cs.run.result}
            error={cs.run.error}
            device={cs.device}
            runtime={cs.runtime}
            firebase={cs.firebase}
            maskedCount={cs.redaction.maskedCount}
            phase={cs.phase}
          />
        </div>

        <div className="mt-4">
          <AnalysisReport result={cs.run.result} error={cs.run.error} busy={cs.busy} mapping={cs.redaction.mapping} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-primary/80" /> Raw input and the rehydration vault never leave this tab
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-primary/80" /> Nothing is written to a database or browser storage
          </span>
        </div>
      </div>
    </AppShell>
  );
}