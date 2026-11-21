/**
 * ClipShield — universal protection policy.
 *
 * A policy resolves which detected categories are auto-masked (include: true)
 * versus surfaced for human review (include: false). It configures the shared
 * detector registry — it never instantiates a separate redaction engine.
 *
 * Three policies ship initially:
 *   balanced — mask high-confidence personal, credential, financial-id,
 *              healthcare, education and technical-network categories.
 *              Business-confidential, infrastructure and country-specific /
 *              low-confidence categories are detected but left for review.
 *   strict   — mask every detected category.
 *   custom   — caller supplies the set of masked categories (plus custom terms
 *              and manual masks, which are always masked).
 *
 * The legacy `profile` option ("standard" | "ot") is preserved as a
 * backward-compatible alias: "ot" adds INFRA to the balanced set.
 */

export const POLICIES = {
  balanced: {
    id: "balanced",
    label: "Balanced",
    description:
      "Mask high-confidence personal, credential, financial, healthcare, education and network categories. Business-confidential and infrastructure identifiers are detected for review.",
  },
  strict: {
    id: "strict",
    label: "Strict",
    description:
      "Mask every detected sensitive category, including infrastructure, serials, addresses, government IDs, salary and business-confidential identifiers.",
  },
  custom: {
    id: "custom",
    label: "Custom",
    description:
      "Mask only the categories you enable, plus custom terms and manual masks. Everything else is detected for review.",
  },
};

// Categories masked in the balanced policy. Credentials and validated
// identifiers are always on; contextual business/confidential and
// infrastructure categories stay reviewable unless the policy adds them.
const BALANCED_MASKED = new Set([
  "PRIVATE_KEY", "AWS_KEY", "SECRET", "BEARER", "JWT", "VPN_CRED", "SVCACCT",
  "EMAIL", "PHONE", "PERSON", "DOB", "SALARY",
  "IBAN", "CARD",
  "PATIENT_ID", "MRN", "STUDENT_ID",
  "HOST", "IPV4", "CIDR",
]);

// Categories that are always masked regardless of policy — credentials and
// direct personal contact are never left exposed by a weaker policy. Custom
// terms and manual masks are also always masked.
const ALWAYS_MASKED = new Set([
  "PRIVATE_KEY", "AWS_KEY", "SECRET", "BEARER", "JWT", "VPN_CRED", "SVCACCT",
  "EMAIL", "PHONE", "PERSON", "CUSTOM", "MANUAL",
]);

/**
 * Resolve the set of masked categories for a detection pass.
 * Returns null to mean "mask every detected category" (strict).
 */
export function resolveMaskedSet({ policy = "balanced", profile, maskedCategories } = {}) {
  if (policy === "strict") return null;

  const base = new Set(policy === "custom" ? [] : BALANCED_MASKED);

  if (policy === "custom" && Array.isArray(maskedCategories)) {
    for (const category of maskedCategories) base.add(category);
  }

  // The legacy OT profile adds infrastructure masking to any policy.
  if (profile === "ot") base.add("INFRA");

  // Credentials, personal contact, custom and manual are always masked.
  for (const category of ALWAYS_MASKED) base.add(category);

  return base;
}

/** Whether a finding's category should be auto-masked under the resolved set. */
export function isMasked(category, maskedSet) {
  if (maskedSet === null) return true;
  return maskedSet.has(category);
}