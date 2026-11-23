import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addManualFinding,
  buildRedaction,
  containsRawValues,
  detectFindings,
  rehydrate,
} from "@/lib/redaction";
import { assessExposure } from "@/lib/risk-engine";
import { MODE_SPECS, detectRuntime } from "@/lib/hybrid-modes";
import { clearEvents, recordEvent } from "@/lib/telemetry";
import { detectOtFindings } from "@/lib/ot-guardrail";
// Public Firebase web config is served by a stable GET server route rather
// than a server-function RPC: the RPC endpoint returns the preview "starting
// up" splash HTML on cold preview starts, which surfaced as inference-failed.
async function fetchFirebaseConfig() {
  const res = await fetch("/api/firebase-config", { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const error = new Error(`Firebase config endpoint returned ${res.status}.`);
    error.code = "firebase-unconfigured";
    throw error;
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error("Firebase config endpoint returned a non-JSON response. The preview may be starting up — retry in a moment.");
    error.code = "firebase-unconfigured";
    throw error;
  }
  return res.json();
}

const EMPTY_RUN = { status: "idle", result: null, error: null };

export default function useClipShield() {
  const [raw, setRaw] = useState("");
  const [customTerms, setCustomTerms] = useState([]);
  const [findings, setFindings] = useState([]);
  const [inspected, setInspected] = useState(false);
  const [policy, setPolicy] = useState("balanced");
  const [mode, setMode] = useState("LOCAL_FIRST");
  const [consent, setConsent] = useState({ fallback: false, cloud: false });
  const [phase, setPhase] = useState("idle");
  const [device, setDevice] = useState({ status: "unknown", progress: null, message: null });
  const [firebase, setFirebase] = useState({
    status: "unknown",
    missing: [],
    appCheck: null,
    diagnostics: null,
    debugToken: null,
  });
  const [run, setRun] = useState(EMPTY_RUN);
  const [runtime, setRuntime] = useState(null);

  useEffect(() => {
    setRuntime(detectRuntime());
  }, []);

  const redaction = useMemo(() => buildRedaction(raw, findings), [raw, findings]);
  const exposure = useMemo(() => assessExposure(findings), [findings]);
  const busy = phase === "preparing" || phase === "running";

  const resetRun = useCallback(() => setRun(EMPTY_RUN), []);

  const setInput = useCallback(
    (value) => {
      setRaw(value);
      setFindings([]);
      setInspected(false);
      resetRun();
    },
    [resetRun],
  );

  const inspect = useCallback(
    (text = raw, terms = customTerms) => {
      const detected = detectFindings(text, { customTerms: terms, policy });
      setFindings(detected);
      setInspected(true);
      resetRun();
      return detected;
    },
    [raw, customTerms, policy, resetRun],
  );

  const loadScenario = useCallback(
    (scenario) => {
      setRaw(scenario.text);
      const detected = detectFindings(scenario.text, { customTerms, policy });
      setFindings(detected);
      setInspected(true);
      resetRun();
      toast.success(`${scenario.name} loaded — ${detected.length} potential entities found locally.`);
    },
    [customTerms, resetRun],
  );

  const toggleFinding = useCallback(
    (id) => {
      setFindings((current) => current.map((f) => (f.id === id ? { ...f, include: !f.include } : f)));
      resetRun();
    },
    [resetRun],
  );

  const addCustomTerm = useCallback(
    (term) => {
      const clean = String(term || "").trim();
      if (clean.length < 2) {
        toast.error("Custom terms need at least 2 characters.");
        return;
      }
      if (customTerms.some((existing) => existing.toLowerCase() === clean.toLowerCase())) return;
      const next = [...customTerms, clean];
      setCustomTerms(next);
      if (raw) inspect(raw, next);
    },
    [customTerms, raw, inspect],
  );

  const removeCustomTerm = useCallback(
    (term) => {
      const next = customTerms.filter((existing) => existing !== term);
      setCustomTerms(next);
      if (raw) inspect(raw, next);
    },
    [customTerms, raw, inspect, policy],
  );

  const otFindings = useMemo(() => detectOtFindings(raw), [raw]);

  const maskSelection = useCallback(
    (start, end, options) => {
      if (!raw) return;
      const next = addManualFinding(raw, findings, start, end, options);
      if (next.length === findings.length) {
        toast.error("Select text that is not already masked.");
        return;
      }
      const added = next.length - findings.length;
      setFindings(next);
      setInspected(true);
      resetRun();
      toast.success(
        options?.allOccurrences && added > 1
          ? `Masked ${added} occurrences with one placeholder.`
          : "Selection added as a manual mask.",
      );
    },
    [raw, findings, resetRun],
  );

  const clearInput = useCallback(() => {
    setRaw("");
    setFindings([]);
    setInspected(false);
    resetRun();
  }, [resetRun]);

  const clearMappings = useCallback(() => {
    setFindings([]);
    setInspected(false);
    resetRun();
    toast.success("Rehydration mapping cleared from memory.");
  }, [resetRun]);

  const resetAll = useCallback(() => {
    setRaw("");
    setFindings([]);
    setInspected(false);
    setCustomTerms([]);
    setConsent({ fallback: false, cloud: false });
    setMode("LOCAL_FIRST");
    setPolicy("balanced");
    setDevice({ status: "unknown", progress: null, message: null });
    setRun(EMPTY_RUN);
    clearEvents();
    toast.success("Workspace reset. Nothing is stored.");
  }, []);

  const ensureFirebase = useCallback(async () => {
    if (firebase.status === "ready") return;
    const payload = await fetchFirebaseConfig();
    if (!payload.configured) {
      setFirebase({
        status: "unconfigured",
        missing: payload.missing,
        appCheck: null,
        diagnostics: null,
        debugToken: payload.debugToken || null,
      });
      const error = new Error("Firebase AI Logic is not connected to this app yet.");
      error.code = "firebase-unconfigured";
      throw error;
    }
    const { initializeFirebaseServices } = await import("@/lib/firebase");
    const state = initializeFirebaseServices({
      ...payload.config,
      appCheckSiteKey: payload.appCheckSiteKey,
      appCheckProvider: payload.appCheckProvider,
      debugToken: payload.debugToken,
    });
    setFirebase({
      status: "ready",
      missing: [],
      appCheck: state.appCheckStatus,
      diagnostics: state.diagnostics,
      debugToken: payload.debugToken || null,
    });
  }, [firebase.status]);

  // Enable App Check debug mode on preview/non-production hosts: sets the
  // SDK's debug-token placeholder so the browser prints a fresh token to the
  // DevTools console for whitelisting in Firebase Console, then reloads so the
  // App Check provider picks it up before initialization.
  const enableDebugMode = useCallback(() => {
    if (typeof self === "undefined") return;
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const prepareLocal = useCallback(async () => {
    if (busy) return;
    setPhase("preparing");
    setDevice({ status: "preparing", progress: 0, message: null });
    try {
      await ensureFirebase();
      const { prepareDeviceModel } = await import("@/lib/hybrid-ai");
      await prepareDeviceModel("LOCAL_FIRST", (progress) =>
        setDevice({ status: "downloading", progress, message: null }),
      );
      setDevice({ status: "ready", progress: 100, message: null });
      toast.success("On-device model is ready.");
    } catch (error) {
      setDevice({
        status: "unavailable",
        progress: null,
        message: error?.message || "On-device model could not be prepared.",
      });
      if (error?.code === "firebase-unconfigured") {
        setFirebase((current) => ({ ...current, status: "unconfigured" }));
      }
    } finally {
      setPhase("idle");
    }
  }, [busy, ensureFirebase]);

  const runMode = useCallback(
    async (modeKey) => {
      if (busy) return;
      if (!raw.trim()) {
        toast.error("Paste content or load a sample scenario first.");
        return;
      }
      if (modeKey === "LOCAL_FIRST" && !consent.fallback) {
        toast.error("Confirm the cloud-fallback consent before running local-first inference.");
        return;
      }
      if ((modeKey === "CLOUD" || modeKey === "CLOUD_PREFERRED") && !consent.cloud) {
        toast.error("Confirm that the sanitized text may be sent to the cloud model.");
        return;
      }

      const currentFindings = inspected ? findings : inspect();
      const built = buildRedaction(raw, currentFindings);
      const included = currentFindings.filter((finding) => finding.include);

      if (containsRawValues(built.sanitized, included)) {
        setRun({
          status: "error",
          result: null,
          error: {
            code: "safety-check",
            message:
              "A masked value is still present in the sanitized text. Review the findings before sending anything.",
          },
        });
        return;
      }

      setPhase("preparing");
      setRun(EMPTY_RUN);
      setMode(modeKey);

      try {
        await ensureFirebase();
        const { prepareDeviceModel, runInference } = await import("@/lib/hybrid-ai");

        if (MODE_SPECS[modeKey].local) {
          setDevice({ status: "preparing", progress: 0, message: null });
          try {
            await prepareDeviceModel(modeKey, (progress) =>
              setDevice({ status: "downloading", progress, message: null }),
            );
            setDevice({ status: "ready", progress: 100, message: null });
          } catch (deviceError) {
            if (modeKey === "LOCAL_ONLY") throw deviceError;
            setDevice({
              status: "unavailable",
              progress: null,
              message: deviceError?.message || "On-device model unavailable.",
            });
          }
        }

        setPhase("running");
        const result = await runInference({
          modeKey,
          sanitizedText: built.sanitized,
          maskedCount: built.maskedCount,
          categoryCount: built.categories.length,
        });

        setRun({ status: "done", result, error: null });
        const successEvent = {
          mode: modeKey,
          requestedMode: result.requestedMode,
          inferenceSource: result.inferenceSource || "unreported",
          latencyMs: result.latencyMs,
          maskedCount: result.maskedCount,
          categoryCount: result.categoryCount,
          fallback: result.cloudFallback,
          outcome: "success",
          model: result.model,
          structured: result.structured,
          sentChars: result.sentChars,
        };
        recordEvent("inference", successEvent);
      } catch (error) {
        const code = error?.code || "inference-failed";
        setRun({
          status: "error",
          result: null,
          error: { code, message: error?.message || "The inference request failed." },
        });
        if (code === "device-unavailable" || code === "device-unsupported") {
          setDevice({
            status: "unavailable",
            progress: null,
            message: error?.message || "On-device model unavailable.",
          });
        }
        if (code === "firebase-unconfigured") {
          setFirebase((current) => ({ ...current, status: "unconfigured" }));
        }
        const errorEvent = {
          mode: modeKey,
          outcome: "error",
          errorCode: code,
          maskedCount: built.maskedCount,
        };
        recordEvent("inference", errorEvent);
      } finally {
        setPhase("idle");
      }
    },
    [busy, raw, consent, inspected, findings, inspect, ensureFirebase],
  );

  const copySanitized = useCallback(async () => {
    if (!redaction.sanitized) {
      toast.error("There is no sanitized text to copy yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(redaction.sanitized);
      toast.success("Sanitized text copied. Placeholders only.");
    } catch {
      toast.error("Copy failed — select the sanitized text manually.");
    }
  }, [redaction.sanitized]);

  const copyRestored = useCallback(
    async (token) => {
      const restored = token
        ? rehydrate(token, redaction.mapping)
        : rehydrate(redaction.sanitized, redaction.mapping);
      try {
        await navigator.clipboard.writeText(restored);
        toast.success("Original values restored in this browser only.");
      } catch {
        toast.error("Copy failed.");
      }
    },
    [redaction.mapping, redaction.sanitized],
  );

  return {
    raw,
    setInput,
    customTerms,
    addCustomTerm,
    removeCustomTerm,
    findings,
    inspected,
    inspect,
    loadScenario,
    toggleFinding,
    maskSelection,
    clearInput,
    clearMappings,
    resetAll,
    redaction,
    exposure,
    mode,
    setMode,
    consent,
    setConsent,
    phase,
    busy,
    device,
    firebase,
    run,
    runtime,
    policy,
    setPolicy,
    otFindings,
    prepareLocal,
    runMode,
    enableDebugMode,
    copySanitized,
    copyRestored,
  };
}
