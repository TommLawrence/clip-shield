/**
 * Convex client for ClipShield — an optional persistence layer wired alongside
 * the in-memory / Firebase flow.
 *
 * Nothing here runs until a deployment URL is configured (the
 * `CONVEX_DEPLOYMENT_URL` secret, served by GET /api/convex-config). Before
 * that, every helper no-ops and the app behaves exactly as it did without
 * Convex. Calls are fire-and-forget: failures are caught and logged so the
 * inference flow is never blocked by the persistence layer.
 *
 * Privacy: only sanitized outputs, custom glossary terms, and allow-listed
 * telemetry are ever sent. Raw input and rehydration mappings never reach
 * this module.
 */
let client = null;
let ConvexReactClientCtor = null;

// In-memory, per-tab session id. Never written to localStorage or any browser
// storage — keeps the Convex layer consistent with the workspace's no-persistence
// privacy promise. Resets on reload, which is fine: the app only writes (it does
// not read cross-session), and Convex is opt-in (no-ops without CONVEX_DEPLOYMENT_URL).
let sessionMemoryId = null;
function getSessionId() {
  if (typeof window === "undefined") return null;
  if (sessionMemoryId) return sessionMemoryId;
  sessionMemoryId =
    window.crypto?.randomUUID?.() ||
    `cs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return sessionMemoryId;
}

/**
 * Initialize the Convex client. Idempotent. Dynamic-imports `convex/react` so
 * the package is only loaded when Convex is actually configured, keeping the
 * default app load unaffected.
 */
export async function initConvex(config) {
  if (client) return client;
  if (!config?.url) return null;
  try {
    if (!ConvexReactClientCtor) {
      const mod = await import("convex/react");
      ConvexReactClientCtor = mod.ConvexReactClient;
    }
    client = new ConvexReactClientCtor(config.url);
    return client;
  } catch (error) {
    console.warn("[convex] client initialization failed", error);
    client = null;
    return null;
  }
}

export function isConvexConfigured() {
  return Boolean(client);
}

export function getConvexClient() {
  return client;
}

async function safeMutation(name, args) {
  if (!client) return null;
  try {
    return await client.mutation(name, args);
  } catch (error) {
    console.warn(`[convex] ${name} failed`, error);
    return null;
  }
}

/** Persist a completed inference result (sanitized output + metadata only). */
export async function saveReport(result) {
  const sessionId = getSessionId();
  if (!sessionId || !result) return null;
  return safeMutation("reports:save", {
    sessionId,
    userId: null,
    modeKey: result.modeKey,
    model: result.model,
    inferenceSource: result.inferenceSource || null,
    latencyMs: result.latencyMs,
    maskedCount: result.maskedCount,
    categoryCount: result.categoryCount,
    sentChars: result.sentChars,
    structured: Boolean(result.structured),
    text: result.text,
    json: result.json ? JSON.stringify(result.json) : null,
  });
}

/** Upsert the session's custom redaction term list. */
export async function syncGlossary(terms) {
  const sessionId = getSessionId();
  if (!sessionId) return null;
  return safeMutation("glossaries:sync", {
    sessionId,
    userId: null,
    terms: Array.isArray(terms) ? terms.map(String) : [],
  });
}

/** Push an allow-listed telemetry event alongside the local recordEvent. */
export async function recordTelemetry(event, payload = {}) {
  const sessionId = getSessionId();
  if (!sessionId) return null;
  return safeMutation("telemetry:record", { sessionId, event, payload });
}