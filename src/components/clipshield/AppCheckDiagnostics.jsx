import { Bug, ShieldCheck, TriangleAlert } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Stat({ label, value, tone = "default" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <p className="cs-mono text-[9px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-[12px] leading-tight",
          tone === "emerald" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * App Check diagnostics HUD. Renders once Firebase is initialized so judges
 * can see exactly which provider, site key and debug state are active, and
 * can enable debug mode on preview hosts where reCAPTCHA Enterprise hasn't
 * propagated yet.
 */
export default function AppCheckDiagnostics({ diagnostics, debugToken, onEnableDebugMode }) {
  if (!diagnostics) return null;

  const { provider, siteKeyLoaded, debugTokenActive, hostname, status, error } = diagnostics;
  const showDebugToggle = !debugToken && typeof window !== "undefined";

  return (
    <Panel>
      <SectionHeading
        step="AC"
        title="App Check diagnostics"
        hint="Firebase App Check"
        right={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px]",
              status === "initialized"
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                : status === "failed" || status === "not-configured"
                  ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground",
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {status === "initialized" ? "active" : status === "not-configured" ? "not configured" : status === "failed" ? "failed" : status}
          </span>
        }
      />

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Provider" value={provider} tone="emerald" />
        <Stat label="Site key loaded" value={siteKeyLoaded ? "true" : "false"} tone={siteKeyLoaded ? "emerald" : "warn"} />
        <Stat label="Debug token active" value={debugTokenActive ? "true" : "false"} tone={debugTokenActive ? "warn" : "default"} />
        <Stat label="Current hostname" value={hostname} />
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2.5">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
          <p className="text-[11.5px] leading-relaxed text-rose-100/80">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-rose-300">init error</span> — {error}
          </p>
        </div>
      ) : null}

      {showDebugToggle ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] leading-relaxed text-amber-100/80">
            On preview hosts where reCAPTCHA Enterprise hasn't propagated, enable debug mode to print a fresh App Check
            debug token to the DevTools console. Whitelist that token in Firebase Console → App Check → Apps.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onEnableDebugMode}
            className="shrink-0 gap-2 border-amber-400/30 bg-amber-400/[0.06] text-amber-200 hover:bg-amber-400/[0.12]"
          >
            <Bug className="h-4 w-4" /> Enable App Check debug mode
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}