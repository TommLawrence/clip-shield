/**
 * ClipShield — privacy-core: deterministic local privacy airlock.
 *
 * Framework-independent. Consumed by both the web workspace (via the
 * `src/lib/redaction.js` compatibility shim) and the Chrome companion
 * extension. Everything here runs synchronously, with no network access.
 *
 * This is the only place raw sensitive values exist. Callers must pass the
 * *sanitized* string to any AI request and must never persist `raw`, `mapping`
 * or the finding values.
 *
 * Detection is layered:
 *   Layer A — deterministic pattern + validation detectors (high confidence)
 *   Layer B — contextual detectors, gated by a label/proximity cue
 *   Layer C — local semantic proposals (merged in semantic.js, always reviewable)
 *   Layer D — the protection policy resolves each finding's default mask state
 * Every finding remains reviewable; nothing is trusted automatically.
 */
import {
  CATEGORIES,
  PLACEHOLDER_PATTERN,
} from "./categories.js";
import { DETECTORS } from "./detectors.js";
import { resolveMaskedSet, isMasked } from "./policy.js";

export { CATEGORIES, SEVERITY_ORDER, PLACEHOLDER_PATTERN } from "./categories.js";
export { GROUPS, TAXONOMY_GROUPS } from "./categories.js";
export { DETECTORS, luhn, ibanChecksum } from "./detectors.js";
export { POLICIES, resolveMaskedSet, isMasked } from "./policy.js";
export { mergeSemanticProposals } from "./semantic.js";

export const PROFILES = {
  STANDARD: "standard",
  OT: "ot",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Find sensitive spans in `text`.
 *
 * Options:
 *   customTerms       — user-defined terms (always masked, CUSTOM category)
 *   profile           — legacy "standard" | "ot" (ot adds INFRA masking)
 *   policy            — "balanced" (default) | "strict" | "custom"
 *   maskedCategories  — array of categories to mask (custom policy only)
 *
 * Person names use contextual cues plus a common-word rejection list — never
 * a naive capitalized-words regex. Infrastructure / equipment identifiers
 * (INFRA) are always detected; they are masked under the OT profile or the
 * strict policy, and otherwise appear as reviewable findings.
 */
export function detectFindings(text, { customTerms = [], profile, policy = "balanced", maskedCategories } = {}) {
  if (!text) return [];

  const maskedSet = resolveMaskedSet({ policy, profile, maskedCategories });
  const candidates = [];

  DETECTORS.forEach((detector, priority) => {
    const regex = new RegExp(detector.pattern.source, detector.pattern.flags.includes("g") ? detector.pattern.flags : `${detector.pattern.flags}g`);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      if (detector.validate && !detector.validate(match)) continue;

      const value = detector.maskGroup ? match[detector.maskGroup] : match[0];
      if (!value) continue;

      const offset = detector.maskGroup ? match[0].indexOf(value) : 0;
      const start = match.index + Math.max(0, offset);
      candidates.push({
        category: detector.category,
        priority,
        start,
        end: start + value.length,
        value,
        source: "detector",
        detectorId: detector.id,
        method: detector.method,
        confidence: detector.confidence,
      });
    }
  });

  // Explicit custom terms take precedence over auto-detection so a value the
  // user flagged is always masked with its CUSTOM token.
  customTerms
    .map((term) => String(term || "").trim())
    .filter((term) => term.length >= 2)
    .forEach((term) => {
      const regex = new RegExp(escapeRegExp(term), "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          category: "CUSTOM",
          priority: -1,
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          source: "custom",
          method: "user",
          confidence: "high",
        });
      }
    });

  candidates.sort((a, b) => a.priority - b.priority || a.start - b.start || b.end - a.end);

  const accepted = [];
  for (const candidate of candidates) {
    if (accepted.some((existing) => overlaps(existing, candidate))) continue;
    accepted.push(candidate);
  }

  accepted.sort((a, b) => a.start - b.start);

  const counters = {};
  const tokenByValue = new Map();

  return accepted.map((candidate) => {
    const meta = CATEGORIES[candidate.category];
    const key = `${meta.prefix}:${candidate.value}`;
    let token = tokenByValue.get(key);
    if (!token) {
      counters[meta.prefix] = (counters[meta.prefix] || 0) + 1;
      token = `[${meta.prefix}_${counters[meta.prefix]}]`;
      tokenByValue.set(key, token);
    }

    const include = isMasked(candidate.category, maskedSet);

    return {
      id: `${candidate.category}-${candidate.start}-${candidate.end}`,
      category: candidate.category,
      label: meta.label,
      severity: meta.severity,
      prefix: meta.prefix,
      weight: meta.weight,
      group: meta.group,
      start: candidate.start,
      end: candidate.end,
      value: candidate.value,
      token,
      include,
      source: candidate.source,
      method: candidate.method,
      confidence: candidate.confidence,
      detectorId: candidate.detectorId,
      profileOnly: candidate.category === "INFRA",
    };
  });
}

/** Add a manually selected span as a finding (offsets are relative to the raw text). */
export function addManualFinding(text, findings, start, end) {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (!text || to - from < 2) return findings;
  if (findings.some((finding) => finding.start < to && from < finding.end)) return findings;

  const value = text.slice(from, to);
  const manualCount = findings.filter((finding) => finding.category === "MANUAL").length;

  return [
    ...findings,
    {
      id: `MANUAL-${from}-${to}`,
      category: "MANUAL",
      label: CATEGORIES.MANUAL.label,
      severity: CATEGORIES.MANUAL.severity,
      prefix: CATEGORIES.MANUAL.prefix,
      weight: CATEGORIES.MANUAL.weight,
      group: CATEGORIES.MANUAL.group,
      start: from,
      end: to,
      value,
      token: `[MANUAL_${manualCount + 1}]`,
      include: true,
      source: "manual",
      method: "user",
      confidence: "high",
      profileOnly: false,
    },
  ].sort((a, b) => a.start - b.start);
}

/**
 * Build the sanitized text plus the in-memory rehydration mapping.
 * The mapping is returned to the caller and must stay in memory only.
 */
export function buildRedaction(text, findings) {
  const included = findings.filter((finding) => finding.include).sort((a, b) => a.start - b.start);

  let sanitized = "";
  let cursor = 0;
  const mapping = [];
  const seen = new Set();

  for (const finding of included) {
    if (finding.start < cursor) continue;
    sanitized += text.slice(cursor, finding.start);
    sanitized += finding.token;
    cursor = finding.end;
    if (!seen.has(finding.token)) {
      seen.add(finding.token);
      mapping.push({ token: finding.token, category: finding.category, label: finding.label, value: finding.value });
    }
  }
  sanitized += text.slice(cursor);

  return {
    sanitized,
    mapping,
    maskedCount: included.length,
    uniqueTokens: mapping.length,
    categories: [...new Set(included.map((finding) => finding.category))],
  };
}

/** Explicit, user-requested restoration. Never call this on generated reports. */
export function rehydrate(text, mapping) {
  let restored = text;
  for (const entry of mapping) {
    restored = restored.split(entry.token).join(entry.value);
  }
  return restored;
}

export function countPlaceholders(text) {
  return (text.match(PLACEHOLDER_PATTERN) || []).length;
}

/** Safety check used before an AI request: the payload must contain no finding values. */
export function containsRawValues(payload, findings) {
  return findings.some((finding) => finding.value && finding.include !== false && payload.includes(finding.value));
}