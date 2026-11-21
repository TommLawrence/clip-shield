/**
 * ClipShield — Layer C: local semantic inspection merge helper.
 *
 * Local semantic inspection (the browser's on-device Prompt API) produces
 * *proposals*. This module never runs a model itself — the host surface owns
 * the local inference call — and it never transmits raw content to a cloud
 * service. Proposals are folded into the existing finding set as reviewable
 * entries (include: false) so a human confirms every AI-suggested mask.
 *
 * Reused by both the Chrome companion (which runs window.LanguageModel) and
 * any web surface that exposes the same local API. Deterministic and
 * contextual detection (Layers A/B) always run first; semantic proposals only
 * add coverage the deterministic engine missed.
 */
import { CATEGORIES } from "./categories.js";

const SEMANTIC_CATEGORY_ALIASES = {
  person: "PERSON",
  name: "PERSON",
  email: "EMAIL",
  phone: "PHONE",
  telephone: "PHONE",
  address: "ADDRESS",
  dob: "DOB",
  "date of birth": "DOB",
  "gov id": "GOV_ID",
  iban: "IBAN",
  "bank account": "IBAN",
  card: "CARD",
  "credit card": "CARD",
  salary: "SALARY",
  "patient id": "PATIENT_ID",
  mrn: "MRN",
  "medical record": "MRN",
  "student id": "STUDENT_ID",
  host: "HOST",
  ip: "IPV4",
  infra: "INFRA",
  serial: "SERIAL",
  secret: "SECRET",
  credential: "SECRET",
  customer: "CUSTOMER_ID",
  project: "PROJECT_CODE",
  case: "CASE_ID",
};

function aliasToCategory(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return SEMANTIC_CATEGORY_ALIASES[key] || null;
}

/**
 * Merge semantic proposals into an existing findings array.
 * `proposals` is a list of { value, category } objects from a local model.
 * Only values not already covered by an existing finding span are added, and
 * every merged proposal is reviewable (include: false) and tagged
 * source: "semantic" so the UI can mark it as an AI suggestion.
 */
export function mergeSemanticProposals(text, findings, proposals = []) {
  if (!text || !Array.isArray(proposals) || proposals.length === 0) return findings;

  const existing = findings.filter((f) => f.source !== "semantic");
  const occupied = (start, end) => existing.some((f) => f.start < end && start < f.end);

  const counters = {};
  const tokenByValue = new Map();
  for (const f of existing) {
    if (!tokenByValue.has(f.value)) tokenByValue.set(f.value, f.token);
  }

  const added = [];
  for (const proposal of proposals) {
    const value = String(proposal?.value || "").trim();
    if (value.length < 2) continue;
    const category = CATEGORIES[proposal.category] ? proposal.category : aliasToCategory(proposal.category);
    if (!category) continue;

    const regex = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied(start, end)) continue;
      occupied(start, end); // mark
      const meta = CATEGORIES[category];
      let token = tokenByValue.get(value);
      if (!token) {
        counters[meta.prefix] = (counters[meta.prefix] || 0) + 1;
        token = `[${meta.prefix}_${counters[meta.prefix]}]`;
        tokenByValue.set(value, token);
      }
      added.push({
        id: `SEMANTIC-${category}-${start}-${end}`,
        category,
        label: meta.label,
        severity: meta.severity,
        prefix: meta.prefix,
        weight: meta.weight,
        start,
        end,
        value: match[0],
        token,
        include: false,
        source: "semantic",
        profileOnly: false,
      });
    }
  }

  return [...existing, ...added].sort((a, b) => a.start - b.start);
}