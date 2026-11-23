/**
 * Compatibility shim — re-exports the canonical engine from
 * @clipshield/privacy-core so existing `@/lib/redaction` imports keep working
 * unchanged. The web workspace and the Chrome extension share this one
 * implementation.
 */
export {
  PROFILES,
  CATEGORIES,
  GROUPS,
  TAXONOMY_GROUPS,
  SEVERITY_ORDER,
  PLACEHOLDER_PATTERN,
  POLICIES,
  DETECTORS,
  detectFindings,
  addManualFinding,
  buildRedaction,
  rehydrate,
  countPlaceholders,
  containsRawValues,
  resolveMaskedSet,
  mergeSemanticProposals,
  sanitizeOffsetToRaw,
} from "../../packages/privacy-core/redaction.js";