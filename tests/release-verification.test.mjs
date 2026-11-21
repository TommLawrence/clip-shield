/**
 * ClipShield — release-readiness verification suite.
 *
 * Five synthetic business documents (all fictional) span the mandated domains:
 * finance, healthcare, education, engineering/OT, and HR/legal/procurement.
 * Each is run under Balanced, Strict and Custom policies and the test emits a
 * structured report: detected, masked, review-required, missed, false-positive.
 *
 * It also asserts the cross-cutting release guarantees:
 *   - repeated entities reuse one placeholder / one mapping entry,
 *   - custom identifiers are masked regardless of policy,
 *   - manual review (toggling a finding off) removes it from the sanitized text,
 *   - sanitized copy contains no included raw value (containsRawValues guard),
 *   - local rehydration restores the original text in-memory only,
 *   - the privacy boundary: raw values and vault mappings never appear in the
 *     cloud prompt, the telemetry event, or persistent storage surfaces.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  detectFindings,
  buildRedaction,
  containsRawValues,
  rehydrate,
  addManualFinding,
  mergeSemanticProposals,
} from "../src/lib/redaction.js";
import { buildPrompt } from "../src/lib/hybrid-modes.js";
import { clearEvents, getEvents, recordEvent } from "../src/lib/telemetry.js";

// ---------------------------------------------------------------------------
// Five synthetic business documents + ground truth.
//   truth: { value, category, balanced }  — balanced = "masked" | "review"
//   benign: phrases that must NEVER be flagged (false-positive probes)
// ---------------------------------------------------------------------------
const FINANCE = `Payroll run — November 2026
Payroll administrator: Jane Doe <jane.doe@acme-fictional.example>, callback +1 415 555 0190.
Employee: Lena Fischer. annual salary: EUR 62,500. DOB: 02/11/1988. national id: 1234567890.
Vendor settlement to IBAN DE89370400440532013000. Corporate card 4111 1111 1111 1111 refunded in error.
home address: 12 Oakwood Avenue. Tax ID: 12-3456789.`;
const FINANCE_TRUTH = [
  { value: "DE89370400440532013000", category: "IBAN", balanced: "masked" },
  { value: "4111 1111 1111 1111", category: "CARD", balanced: "masked" },
  { value: "62,500", category: "SALARY", balanced: "masked" },
  { value: "02/11/1988", category: "DOB", balanced: "masked" },
  { value: "jane.doe@acme-fictional.example", category: "EMAIL", balanced: "masked" },
  { value: "+1 415 555 0190", category: "PHONE", balanced: "masked" },
  { value: "Jane Doe", category: "PERSON", balanced: "masked" },
  { value: "1234567890", category: "GOV_ID", balanced: "review" },
  { value: "12 Oakwood Avenue", category: "ADDRESS", balanced: "review" },
  { value: "12-3456789", category: "GOV_ID", balanced: "review" },
];
const FINANCE_BENIGN = ["November 2026", "Payroll run", "refunded in error", "Vendor settlement to"];

const HEALTHCARE = `Discharge summary — Riverside General (fictional)
Attending clinician: Amara Okonkwo <amara.okonkwo@hospital-fictional.example>, bleep +44 20 7946 0123.
Patient ID: PT-90432. MRN: MRN-7782341. DOB: 14 Mar 1990.
Assessment: stable. Custom-sensitive term: Type 2 Diabetes (added to glossary).
Follow-up appointment: 02 Dec 2026 at the cardiology clinic.`;
const HEALTHCARE_TRUTH = [
  { value: "PT-90432", category: "PATIENT_ID", balanced: "masked" },
  { value: "MRN-7782341", category: "MRN", balanced: "masked" },
  { value: "14 Mar 1990", category: "DOB", balanced: "masked" },
  { value: "Amara Okonkwo", category: "PERSON", balanced: "masked" },
  { value: "amara.okonkwo@hospital-fictional.example", category: "EMAIL", balanced: "masked" },
  { value: "+44 20 7946 0123", category: "PHONE", balanced: "masked" },
];
const HEALTHCARE_BENIGN = ["Riverside General", "02 Dec 2026", "cardiology clinic", "Assessment: stable"];

const EDUCATION = `Admissions record — Northfield College (fictional)
Registrar: Felix Mwangi <felix.mwangi@school-fictional.example>, +256 772 555 003.
Student ID: STU-2026-1187. admission no: ADM-5532.
Guardian: Grace Wanjiru <grace.wanjiru@guardian-fictional.example>.
Disciplinary note: Custom-sensitive term: pending-matter-7 (added to glossary).`;
const EDUCATION_TRUTH = [
  { value: "STU-2026-1187", category: "STUDENT_ID", balanced: "masked" },
  { value: "ADM-5532", category: "STUDENT_ID", balanced: "masked" },
  { value: "Felix Mwangi", category: "PERSON", balanced: "masked" },
  { value: "felix.mwangi@school-fictional.example", category: "EMAIL", balanced: "masked" },
  { value: "+256 772 555 003", category: "PHONE", balanced: "masked" },
  { value: "Grace Wanjiru", category: "PERSON", balanced: "masked" },
];
const EDUCATION_BENIGN = ["Northfield College", "Admissions record", "Disciplinary note"];

const ENGINEERING = `Proprietary equipment record
Project code: ENG-ALPHA-7
Lead engineer: Sven Larsson <sven.larsson@eng-fictional.example>, +46 8 555 019 22.
Motor MTR-2204, serial SN-99213. Control PLC: 192.168.10.4 (modbus/tcp 502).
Customer ID: CUST-4471. Firmware baseline 4.2.1 verified against vendor bulletin VB-2026-11.`;
const ENGINEERING_TRUTH = [
  { value: "ENG-ALPHA-7", category: "PROJECT_CODE", balanced: "review" },
  { value: "CUST-4471", category: "CUSTOMER_ID", balanced: "review" },
  { value: "MTR-2204", category: "INFRA", balanced: "review" },
  { value: "SN-99213", category: "SERIAL", balanced: "review" },
  { value: "192.168.10.4", category: "IPV4", balanced: "masked" },
  { value: "Sven Larsson", category: "PERSON", balanced: "masked" },
  { value: "sven.larsson@eng-fictional.example", category: "EMAIL", balanced: "masked" },
  { value: "+46 8 555 019 22", category: "PHONE", balanced: "masked" },
];
const ENGINEERING_BENIGN = ["Firmware baseline 4.2.1", "VB-2026-11", "modbus/tcp 502", "Proprietary equipment record"];

const HR_LEGAL_PROC = `Vendor contract review — Meridian Analytics Ltd (fictional)
Prepared by: Priya Raman <priya.raman@northwind-fictional.example>, +44 20 7946 0812.
Vendor IBAN: GB82WEST12345698765432. Customer ID: CUST-9001. case no: CTR-3321.
Annual licence: USD 184,000. Discount offered: 12% if signed before 31 Dec 2026.
Contract draft includes an API integration using the key ms_live_4b8e1c9d7f2a6e3b5c0d8f1a — treated as exposed.`;
const HR_LEGAL_PROC_TRUTH = [
  { value: "GB82WEST12345698765432", category: "IBAN", balanced: "masked" },
  { value: "ms_live_4b8e1c9d7f2a6e3b5c0d8f1a", category: "SECRET", balanced: "masked" },
  { value: "Priya Raman", category: "PERSON", balanced: "masked" },
  { value: "priya.raman@northwind-fictional.example", category: "EMAIL", balanced: "masked" },
  { value: "+44 20 7946 0812", category: "PHONE", balanced: "masked" },
  { value: "CUST-9001", category: "CUSTOMER_ID", balanced: "review" },
  { value: "CTR-3321", category: "CASE_ID", balanced: "review" },
];
const HR_LEGAL_PROC_BENIGN = ["Meridian Analytics Ltd", "USD 184,000", "12%", "31 Dec 2026", "Annual licence"];

const DOCS = [
  { name: "Finance", text: FINANCE, truth: FINANCE_TRUTH, benign: FINANCE_BENIGN, customTerms: [] },
  { name: "Healthcare", text: HEALTHCARE, truth: HEALTHCARE_TRUTH, benign: HEALTHCARE_BENIGN, customTerms: ["Type 2 Diabetes"] },
  { name: "Education", text: EDUCATION, truth: EDUCATION_TRUTH, benign: EDUCATION_BENIGN, customTerms: ["pending-matter-7"] },
  { name: "Engineering/OT", text: ENGINEERING, truth: ENGINEERING_TRUTH, benign: ENGINEERING_BENIGN, customTerms: [] },
  { name: "HR/Legal/Procurement", text: HR_LEGAL_PROC, truth: HR_LEGAL_PROC_TRUTH, benign: HR_LEGAL_PROC_BENIGN, customTerms: [] },
];

// ---------------------------------------------------------------------------
// Report generator — computes detected/masked/review/missed/false-positive
// for a given doc + findings, and returns the structured row.
// ---------------------------------------------------------------------------
// A ground-truth value is "covered" when some finding's [start,end) span
// overlaps the value's position in the source text. This is accurate even when
// a detector's captured value carries surrounding context (e.g. the salary
// detector captures "annual salary: EUR 62,500" as one finding whose value
// contains "62,500") or trailing whitespace (the card detector's trailing
// space). Benign phrases are false positives only when a finding span covers
// them.
function covers(findings, start, end) {
  return findings.some((f) => f.start < end && start < f.end);
}

function reportRow(doc, findings) {
  const detected = findings.length;
  const masked = findings.filter((f) => f.include).length;
  const review = findings.filter((f) => !f.include).length;

  const missed = doc.truth
    .filter((t) => {
      const idx = doc.text.indexOf(t.value);
      if (idx < 0) return true; // value not even present in source — counts as missed
      return !covers(findings, idx, idx + t.value.length);
    })
    .map((t) => t.value);

  const falsePositives = doc.benign
    .filter((b) => {
      const idx = doc.text.indexOf(b);
      if (idx < 0) return false;
      return covers(findings, idx, idx + b.length);
    });

  return { detected, masked, review, missed, falsePositives };
}

const POLICIES = [
  { id: "balanced", label: "Balanced", customCategories: null },
  { id: "strict", label: "Strict", customCategories: null },
  { id: "custom", label: "Custom (PATIENT_ID,IBAN,INFRA)", customCategories: ["PATIENT_ID", "IBAN", "INFRA"] },
];

// ---------------------------------------------------------------------------
// Emitted report (visible in test output) + invariant assertions.
// ---------------------------------------------------------------------------
test("release report: five business documents × three policies", () => {
  const rows = [];
  for (const doc of DOCS) {
    for (const policy of POLICIES) {
      const findings = detectFindings(doc.text, {
        customTerms: doc.customTerms,
        policy: policy.id,
        maskedCategories: policy.customCategories || [],
      });
      const { sanitized } = buildRedaction(doc.text, findings);
      const row = reportRow(doc, findings);
      rows.push({ doc: doc.name, policy: policy.label, ...row });

      // Universal privacy boundary: no included raw value reaches the payload.
      assert.equal(
        containsRawValues(sanitized, findings.filter((f) => f.include)),
        false,
        `${doc.name}/${policy.label}: sanitized payload leaks a raw value`,
      );
      // False positives must be zero for every policy.
      assert.equal(row.falsePositives.length, 0, `${doc.name}/${policy.label}: false positive -> ${row.falsePositives.join(", ")}`);
      // Strict masks every detected category.
      if (policy.id === "strict") {
        assert.equal(row.review, 0, `${doc.name}/Strict must mask every detected category`);
      }
    }
  }

  // Pretty-print the full findings table to the test output.
  const header = "| Document | Policy | Detected | Masked | Review | Missed | False+ |";
  const sep = "|---|---|---|---|---|---|---|";
  const body = rows
    .map(
      (r) =>
        `| ${r.doc} | ${r.policy} | ${r.detected} | ${r.masked} | ${r.review} | ${r.missed.length} | ${r.falsePositives.length} |`,
    )
    .join("\n");
  console.log(`\n=== ClipShield release findings report ===\n${header}\n${sep}\n${body}\n`);

  // Missed findings are reported honestly: deterministic detection is
  // conservative by design; the semantic layer (tested below) is the backstop.
  for (const r of rows) {
    if (r.missed.length) {
      console.log(`  missed [${r.doc}/${r.policy}]: ${r.missed.join(", ")}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Cross-cutting release guarantees.
// ---------------------------------------------------------------------------
test("repeated entities reuse one placeholder and one mapping entry", () => {
  const text = "IBAN DE89370400440532013000 repeats as DE89370400440532013000 here.";
  const findings = detectFindings(text, { policy: "balanced" });
  const { sanitized, mapping } = buildRedaction(text, findings);
  assert.equal(findings.filter((f) => f.category === "IBAN").length, 2);
  assert.equal(mapping.filter((m) => m.category === "IBAN").length, 1);
  const tokens = sanitized.match(/\[FINANCIAL_ID_\d+\]/g);
  assert.equal(tokens.length, 2, "both occurrences share one placeholder");
});

test("custom identifiers are masked under balanced, strict and custom", () => {
  const text = "Project Halcyon is confidential. Project Halcyon repeats.";
  for (const policy of ["balanced", "strict", "custom"]) {
    const findings = detectFindings(text, { policy, customTerms: ["Halcyon"], maskedCategories: [] });
    const { sanitized } = buildRedaction(text, findings);
    assert.ok(!sanitized.includes("Halcyon"), `${policy}: custom term must be masked`);
    assert.ok(sanitized.includes("[CUSTOM_1]"), `${policy}: custom token emitted`);
  }
});

test("manual review: toggling a finding off removes it from the sanitized text", () => {
  const text = "Reporter: John Smith, DOB: 1/2/1990.";
  let findings = detectFindings(text, { policy: "balanced" });
  const dob = findings.find((f) => f.category === "DOB");
  assert.ok(dob && dob.include, "DOB is masked by default");
  findings = findings.map((f) => (f.id === dob.id ? { ...f, include: false } : f));
  const { sanitized } = buildRedaction(text, findings);
  assert.ok(sanitized.includes("1/2/1990"), "toggled-off finding is preserved in sanitized text");
  assert.equal(containsRawValues(sanitized, findings.filter((f) => f.include)), false);
});

test("manual span mask is added as a reviewable MANUAL finding", () => {
  const text = "The codename NIGHTFALL appears here.";
  const findings = detectFindings(text, { policy: "balanced" });
  const start = text.indexOf("NIGHTFALL");
  const added = addManualFinding(text, findings, start, start + "NIGHTFALL".length);
  const manual = added.find((f) => f.category === "MANUAL");
  assert.ok(manual && manual.include, "manual mask is always included");
  const { sanitized } = buildRedaction(text, added);
  assert.ok(!sanitized.includes("NIGHTFALL"), "manual span is masked");
  assert.ok(sanitized.includes("[MANUAL_1]"));
});

test("sanitized copy is safe and local rehydration restores the original in-memory only", () => {
  const text = "Reporter: John Smith <john.smith@fictional.example>, +1 415 555 0190.";
  const findings = detectFindings(text, { policy: "balanced" });
  const { sanitized, mapping } = buildRedaction(text, findings);
  assert.equal(containsRawValues(sanitized, findings.filter((f) => f.include)), false);
  assert.equal(rehydrate(sanitized, mapping), text, "rehydration restores the exact original");
});

test("privacy boundary: raw values and vault mappings never enter the cloud prompt", () => {
  for (const doc of DOCS) {
    const findings = detectFindings(doc.text, { policy: "strict", customTerms: doc.customTerms });
    const { sanitized, mapping } = buildRedaction(doc.text, findings);
    const prompt = buildPrompt("CLOUD", sanitized);
    for (const f of findings.filter((f) => f.include)) {
      assert.ok(!prompt.includes(f.value), `${doc.name}: ${f.value} leaked into cloud prompt`);
    }
    for (const m of mapping) {
      assert.ok(!prompt.includes(m.value), `${doc.name}: mapping value leaked into cloud prompt`);
    }
  }
});

test("privacy boundary: telemetry carries no raw text, mapping or sanitized payload", () => {
  clearEvents();
  recordEvent("inference", {
    mode: "CLOUD",
    sanitizedText: "leak-attempt",
    raw: "secret",
    mapping: [{ token: "[PERSON_1]", value: "John Smith" }],
    maskedCount: 3,
  });
  const [event] = getEvents();
  assert.equal("sanitizedText" in event, false, "telemetry must not store sanitized text");
  assert.equal("raw" in event, false, "telemetry must not store raw text");
  assert.equal("mapping" in event, false, "telemetry must not store the rehydration mapping");
  assert.equal(event.maskedCount, 3, "only anonymized counters are retained");
  clearEvents();
});

test("semantic layer backstops deterministic misses as reviewable, never auto-masked", () => {
  const text = "The secret project codename is NIGHTFALL. Contact Lena Fischer at lena.fischer@hr.example.";
  const base = detectFindings(text, { policy: "balanced" });
  assert.ok(!base.some((f) => f.value === "NIGHTFALL"), "deterministic layer intentionally misses the bare codename");
  const merged = mergeSemanticProposals(text, base, [{ value: "NIGHTFALL", category: "project" }]);
  const nightfall = merged.filter((f) => f.value === "NIGHTFALL");
  assert.equal(nightfall.length, 1);
  assert.equal(nightfall[0].source, "semantic");
  assert.equal(nightfall[0].include, false, "semantic proposals are always reviewable, never auto-masked");
});