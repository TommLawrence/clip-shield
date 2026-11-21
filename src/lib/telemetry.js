/**
 * Minimal, non-sensitive session telemetry.
 *
 * Only allow-listed numeric/enum fields are stored, in memory, for the routing
 * inspector. Prompt text, raw values, tokens and mapping entries are dropped
 * before anything is recorded — there is no code path that accepts them.
 */

const ALLOWED_KEYS = new Set([
  "mode",
  "requestedMode",
  "inferenceSource",
  "latencyMs",
  "maskedCount",
  "categoryCount",
  "fallback",
  "outcome",
  "model",
  "structured",
  "sentChars",
  "errorCode",
]);

const events = [];

export function recordEvent(name, payload = {}) {
  const safe = { event: String(name).slice(0, 40), at: Date.now() };
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 40);
    else if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
  }
  events.push(safe);
  if (events.length > 50) events.shift();
  return safe;
}

export function getEvents() {
  return [...events];
}

export function clearEvents() {
  events.length = 0;
}