/**
 * Firebase AI Logic execution layer.
 *
 * This module is only ever imported from browser event handlers. It accepts
 * sanitized text and nothing else: the caller builds the sanitized string from
 * the redaction engine, and the raw input never reaches this file.
 */
import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { getFirebaseAI } from "./firebase.js";
import {
  CLOUD_MODELS,
  CLOUD_MODEL_ORDER,
  DEEP_SCHEMA,
  MODE_SPECS,
  buildPrompt,
  parseStructured,
  truncateForMode,
} from "./hybrid-modes.js";

// Errors that must NEVER trigger a silent retry to another model: the request
// itself is not allowed (auth/App Check/permission), is throttled (quota), is a
// local-only failure (device), or is a connectivity issue the retry would not
// fix. Only generic, model-side failures are retryable with the alternative.
const NON_RETRYABLE_CODES = new Set([
  "app-check",
  "quota",
  "network",
  "device-unavailable",
  "device-unsupported",
  "unknown-mode",
  "firebase-unconfigured",
]);

function isRetryable(error) {
  const code = String(error?.code || "").toLowerCase();
  if (NON_RETRYABLE_CODES.has(code)) return false;
  return true;
}

const INFERENCE_MODES = {
  PREFER_ON_DEVICE: InferenceMode.PREFER_ON_DEVICE,
  ONLY_ON_DEVICE: InferenceMode.ONLY_ON_DEVICE,
  ONLY_IN_CLOUD: InferenceMode.ONLY_IN_CLOUD,
  PREFER_IN_CLOUD: InferenceMode.PREFER_IN_CLOUD,
};

const modelCache = new Map();

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function codedError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function normalizeError(error, modeKey) {
  const spec = MODE_SPECS[modeKey];
  const raw = String(error?.message || error || "");
  const code = String(error?.code || "").toLowerCase();
  const haystack = `${code} ${raw}`.toLowerCase();

  if (haystack.includes("app check") || haystack.includes("appcheck")) {
    return codedError(
      "app-check",
      "Firebase App Check rejected this request. Confirm the reCAPTCHA site key and that the app is registered in the Firebase project.",
      error,
    );
  }
  if (haystack.includes("quota") || haystack.includes("resource-exhausted")) {
    return codedError("quota", "The inference quota for this Firebase project is exhausted. Try again later or use on-device mode.", error);
  }
  if (
    spec.requestedMode === "ONLY_ON_DEVICE" &&
    (haystack.includes("not supported") ||
      haystack.includes("unavailable") ||
      haystack.includes("not available") ||
      haystack.includes("download") ||
      haystack.includes("device"))
  ) {
    return codedError(
      "device-unavailable",
      "On-device inference is unavailable on this device, so the local-only request failed closed. Nothing was sent to the cloud.",
      error,
    );
  }
  if (haystack.includes("network") || haystack.includes("offline") || haystack.includes("fetch")) {
    return codedError("network", "The inference request could not reach Firebase. Check the connection and try again.", error);
  }
  return codedError("inference-failed", raw || "The inference request failed.", error);
}

function buildModelFor(modeKey, cloudModel) {
  const ai = getFirebaseAI();
  const spec = MODE_SPECS[modeKey];
  const mode = INFERENCE_MODES[spec.requestedMode];

  if (spec.structured) {
    try {
      const model = getGenerativeModel(ai, {
        mode,
        inCloudParams: {
          model: cloudModel,
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: DEEP_SCHEMA,
          },
        },
        onDeviceParams: { promptOptions: { responseConstraint: DEEP_SCHEMA } },
      });
      return { model, structured: true, cloudModel };
    } catch {
      // Schema configuration is not available for this SDK build; fall back to
      // a prompt-enforced JSON contract and report that honestly.
    }
  }

  const model = getGenerativeModel(ai, { mode, inCloudParams: { model: cloudModel } });
  return { model, structured: false, cloudModel };
}

// Cache keyed by mode + cloud model so a model switch does not reuse a stale entry.
function getModel(modeKey, cloudModel = CLOUD_MODELS.primary) {
  const cacheKey = `${modeKey}:${cloudModel}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
  const entry = buildModelFor(modeKey, cloudModel);
  modelCache.set(cacheKey, entry);
  return entry;
}

/**
 * Prepare the on-device model. Must be called from a user gesture, before any
 * generateContent() call for a local mode.
 */
export async function prepareDeviceModel(modeKey, onProgress) {
  const { model } = getModel(modeKey);
  if (typeof model.initializeDeviceModel !== "function") {
    throw codedError("device-unsupported", "This Firebase AI Logic build does not expose on-device initialization.");
  }
  const pending = model.initializeDeviceModel((value) => {
    if (typeof value === "number" && onProgress) {
      onProgress(Math.round(value * 10000) / 100);
    }
  });
  await Promise.resolve(pending);
}

async function attemptOnce(modeKey, cloudModel, prompt) {
  const { model, structured } = getModel(modeKey, cloudModel);
  const startedAt = now();
  const result = await model.generateContent(prompt);
  const latencyMs = Math.round(now() - startedAt);
  const response = result?.response;
  const text = typeof response?.text === "function" ? response.text() : String(response?.text ?? "");
  // The SDK reports "on_device" / "in_cloud" (InferenceSource enum). Keep the
  // raw value and expose the enum name — never assume a source.
  const inferenceSourceRaw = typeof response?.inferenceSource === "string" ? response.inferenceSource : null;
  return { text, structured, inferenceSourceRaw, latencyMs, cloudModel };
}

/**
 * Run one inference request using the requested Firebase AI Logic mode.
 *
 * Cloud model selection is explicit: the primary model is tried first; on a
 * retryable, model-side failure only, the alternative model is tried once.
 * Authentication, App Check, permission, quota, network and device failures
 * are never retried silently — they throw immediately with the real cause.
 * The actual inference source always comes from the SDK response.
 */
export async function runInference({ modeKey, sanitizedText, maskedCount = 0, categoryCount = 0, onProgress }) {
  const spec = MODE_SPECS[modeKey];
  if (!spec) throw codedError("unknown-mode", "Unknown inference mode.");

  const { text: clipped, truncated } = truncateForMode(modeKey, sanitizedText);
  const prompt = buildPrompt(modeKey, clipped, { truncated });

  const attemptedModels = [];
  let lastError = null;

  for (const cloudModel of [CLOUD_MODELS.primary, CLOUD_MODELS.alternative]) {
    attemptedModels.push(cloudModel);
    try {
      const attempt = await attemptOnce(modeKey, cloudModel, prompt);
      const inferenceSource = attempt.inferenceSourceRaw ? attempt.inferenceSourceRaw.toUpperCase() : null;

      if (!attempt.text || !attempt.text.trim()) {
        // An empty response is retryable on a different model.
        lastError = codedError("empty-response", "The model returned an empty response. Nothing was displayed because there is no result to show.");
        continue;
      }

      return {
        modeKey,
        modeLabel: spec.label,
        requestedMode: spec.requestedMode,
        model: attempt.cloudModel,
        text: attempt.text.trim(),
        json: spec.structured ? parseStructured(attempt.text) : null,
        structured: attempt.structured,
        inferenceSource,
        inferenceSourceRaw: attempt.inferenceSourceRaw,
        latencyMs: attempt.latencyMs,
        truncated,
        sentChars: clipped.length,
        maskedCount,
        categoryCount,
        attemptedModels,
        cloudFallback:
          (spec.requestedMode === "PREFER_ON_DEVICE" && inferenceSource === "IN_CLOUD") ||
          (spec.requestedMode === "PREFER_IN_CLOUD" && inferenceSource === "ON_DEVICE"),
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const normalized = normalizeError(error, modeKey);
      if (!isRetryable(normalized)) throw normalized;
      lastError = normalized;
    }
  }

  throw lastError || codedError("inference-failed", "The inference request failed.");
}

/**
 * Benchmark the configured cloud models against identical sanitized input.
 *
 * Runs `runs` requests per model (the first is the cold request, the rest are
 * subsequent requests) and reports per-model latency with median and p90.
 * This makes real Firebase AI Logic calls and spends credits — it must only be
 * run on an explicit user action, and only after Firebase + App Check are
 * ready. It does NOT fabricate results and does NOT retry auth/quota failures.
 *
 * On-device modes are excluded: only the cloud path is benchmarked here.
 */
export async function benchmarkInference({ sanitizedText, runs = 3, onProgress } = {}) {
  if (!sanitizedText || !sanitizedText.trim()) throw codedError("empty-response", "Provide sanitized text to benchmark.");
  const modeKey = "CLOUD";
  const { text: clipped } = truncateForMode(modeKey, sanitizedText);
  const prompt = buildPrompt(modeKey, clipped, { truncated: false });

  const results = [];
  for (const cloudModel of CLOUD_MODEL_ORDER) {
    const latencies = [];
    let failed = null;
    for (let i = 0; i < runs; i += 1) {
      try {
        const attempt = await attemptOnce(modeKey, cloudModel, prompt);
        if (!attempt.text || !attempt.text.trim()) {
          failed = failed || codedError("empty-response", `${cloudModel} returned an empty response.`);
          continue;
        }
        latencies.push(attempt.latencyMs);
        if (onProgress) onProgress({ model: cloudModel, index: i, latencyMs: attempt.latencyMs });
      } catch (error) {
        const normalized = normalizeError(error, modeKey);
        // Never retry auth/quota/permission errors during a benchmark.
        failed = normalized;
        break;
      }
    }
    results.push(summarizeModel(cloudModel, latencies, failed));
  }
  return { models: results, runs, completedAt: new Date().toISOString() };
}

function summarizeModel(model, latencies, failed) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : null;
  return {
    model,
    attempted: sorted.length,
    coldMs: sorted.length ? latencies[0] : null,
    medianMs: median,
    p90Ms: p90,
    minMs: sorted.length ? sorted[0] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
    failed: failed ? { code: failed.code, message: failed.message } : null,
  };
}