/**
 * Mode metadata, prompts and schemas. No Firebase import, so this module is
 * safe to load during server rendering.
 */

/**
 * Cloud model configuration for Firebase AI Logic.
 *
 * Firebase AI Logic does NOT automatically chain multiple cloud models — an
 * explicit selection / retry strategy is implemented in hybrid-ai.js. The
 * primary model is the fast flash model; the alternative is a lighter model
 * tried on retryable, model-side failures only (never on auth, App Check,
 * quota, permission or network failures). The quality model is retained for
 * comparison and opt-in deep analysis.
 */
export const CLOUD_MODELS = {
  primary: "gemini-3.8-flash",
  alternative: "gemini-3.5-flash-lite",
  quality: "gemini-4-hydrogen",
};

export const CLOUD_MODEL_ORDER = [CLOUD_MODELS.primary, CLOUD_MODELS.alternative, CLOUD_MODELS.quality];

/** Backward-compatible default cloud model (the primary). */
export const CLOUD_MODEL = CLOUD_MODELS.primary;

export const MODE_SPECS = {
  LOCAL_FIRST: {
    key: "LOCAL_FIRST",
    label: "Local-first hybrid brief",
    shortLabel: "Local-first",
    requestedMode: "PREFER_ON_DEVICE",
    local: true,
    structured: false,
    maxChars: 6000,
    description:
      "Gemini Nano 4 through Chrome's Prompt API. Firebase AI Logic may fall back to the cloud model if on-device inference is unavailable — that fallback needs your consent.",
  },
  LOCAL_ONLY: {
    key: "LOCAL_ONLY",
    label: "Local-only private brief",
    shortLabel: "Local-only",
    requestedMode: "ONLY_ON_DEVICE",
    local: true,
    structured: false,
    maxChars: 6000,
    description:
      "Runs strictly on this device. If the on-device model is unavailable the request fails closed — it is never sent to the cloud.",
  },
  CLOUD: {
    key: "CLOUD",
    label: "Deep cloud synthesis",
    shortLabel: "Deep cloud",
    requestedMode: "ONLY_IN_CLOUD",
    local: false,
    structured: true,
    maxChars: 16000,
    description:
      "A structured risk report from the cloud-hosted model. Only the sanitized text is sent, and only after you confirm.",
  },
  CLOUD_PREFERRED: {
    key: "CLOUD_PREFERRED",
    label: "Cloud-preferred hybrid brief",
    shortLabel: "Cloud-preferred",
    requestedMode: "PREFER_IN_CLOUD",
    local: false,
    structured: false,
    maxChars: 8000,
    description:
      "Prefers the cloud model but may fall back to the device if the cloud is unreachable. Only the sanitized text is sent; fallback is reported.",
  },
};

export const MODE_ORDER = ["LOCAL_FIRST", "LOCAL_ONLY", "CLOUD", "CLOUD_PREFERRED"];

const BASE_INSTRUCTION = `You are an operations analyst inside ClipShield, a privacy gateway.
The text you receive has already been sanitized in the user's browser. Placeholders such as [EMAIL_1], [PHONE_1] or [SECRET_1] replace redacted values.
Rules:
- Never guess, reconstruct or invent a redacted value. Refer to it by its placeholder token.
- Do not ask for the original text.
- Be concise, factual and specific to the text provided.
- Do not claim to be a certified security tool.
- Never instruct anyone to disable, bypass, reset or override any safety interlock, protective control, trip, limit or alarm.
- Never present a recommendation, finding or analysis as permission to operate, restart or modify equipment.
- For operational-technology records, defer to approved site procedures and require human verification for any safety-critical item.`;

export const DEEP_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: { type: "string" },
    security_findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          explanation: { type: "string" },
        },
        required: ["title", "severity", "explanation"],
      },
    },
    risk_matrix: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          explanation: { type: "string" },
        },
        required: ["risk", "likelihood", "impact", "severity", "explanation"],
      },
    },
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          owner_role: { type: "string" },
          priority: { type: "string", enum: ["immediate", "this_week", "planned"] },
        },
        required: ["action", "owner_role", "priority"],
      },
    },
    operational_considerations: { type: "array", items: { type: "string" } },
    human_verification: { type: "array", items: { type: "string" } },
  },
  required: [
    "executive_summary",
    "security_findings",
    "risk_matrix",
    "action_items",
    "operational_considerations",
    "human_verification",
  ],
};

export function truncateForMode(modeKey, text) {
  const spec = MODE_SPECS[modeKey] || MODE_SPECS.LOCAL_FIRST;
  if (text.length <= spec.maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, spec.maxChars)}\n\n[Sanitized text truncated for this mode]`, truncated: true };
}

export function buildPrompt(modeKey, sanitizedText, { truncated = false } = {}) {
  const header = truncated
    ? `${BASE_INSTRUCTION}\nNote: the sanitized text was truncated to fit this mode's context window.\n`
    : `${BASE_INSTRUCTION}\n`;

  if (modeKey === "CLOUD") {
    return `${header}
Analyse the sanitized workplace record and return ONE JSON object only, with exactly these keys:
- "executive_summary": 2-4 sentences for a manager.
- "security_findings": array of {title, severity (critical|high|medium|low), explanation}.
- "risk_matrix": array of {risk, likelihood (high|medium|low), impact (high|medium|low), severity, explanation}.
- "action_items": array of {action, owner_role, priority (immediate|this_week|planned)}.
- "operational_considerations": array of short strings.
- "human_verification": array of short strings naming what a person must confirm.

No markdown fences, no commentary outside the JSON object.

Sanitized record:
"""
${sanitizedText}
"""`;
  }

  return `${header}
Write a short operational brief in plain text using exactly these four headings, each with 1-3 short sentences or bullets:

What happened
Likely impact
Immediate next steps
What a human must verify

Sanitized record:
"""
${sanitizedText}
"""`;
}

export function parseStructured(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Browser capability probe. Safe to call only in the browser. */
export function detectRuntime() {
  if (typeof navigator === "undefined") {
    return { isChrome: false, chromeVersion: null, supportsPromptApi: false, meetsVersion: false };
  }
  const ua = navigator.userAgent || "";
  const match = ua.match(/Chrome\/(\d+)/);
  const chromeVersion = match ? Number(match[1]) : null;
  const isChrome = Boolean(chromeVersion) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
  return {
    isChrome,
    chromeVersion,
    supportsPromptApi: typeof window !== "undefined" && "LanguageModel" in window,
    meetsVersion: Boolean(chromeVersion && chromeVersion >= 139),
  };
}