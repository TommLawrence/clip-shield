import test from "node:test";
import assert from "node:assert/strict";
import {
  detectFindings,
  buildRedaction,
  containsRawValues,
  mergeSemanticProposals,
} from "../src/lib/redaction.js";
import { assessExposure } from "../src/lib/risk-engine.js";
import { detectOtFindings } from "../src/lib/ot-guardrail.js";
import { buildPrompt } from "../src/lib/hybrid-modes.js";
import { clearEvents, getEvents, recordEvent } from "../src/lib/telemetry.js";

// The web workspace and the Chrome extension import the SAME privacy-core
// source. Asserting the shim and the package export the identical function
// proves both surfaces stay consistent.
import { detectFindings as coreDetect } from "../packages/privacy-core/redaction.js";

const redact = (text, opts = {}) => {
  const findings = detectFindings(text, { customTerms: opts.customTerms || [], policy: opts.policy || "balanced" });
  return { findings, ...buildRedaction(text, findings) };
};

const assertNonePresent = (sanitized, values) => {
  for (const value of values) {
    assert.ok(!sanitized.includes(value), `sensitive value leaked into sanitized payload: ${value}`);
  }
};

// ---------------------------------------------------------------------------
// Universal sensitive-information taxonomy — eight representative synthetic
// documents (all fictional). Each asserts appropriate classification and
// masking under the balanced policy, that raw values never reach a cloud
// prompt, and that operational / non-sensitive context is preserved.
// ---------------------------------------------------------------------------

const PAYROLL = `Payroll run — November 2026
Payroll administrator: Jane Doe <jane.doe@acme-fictional.example>, callback +1 415 555 0190.
Employee: Lena Fischer. annual salary: EUR 62,500. DOB: 02/11/1988. national id: 1234567890.
Vendor settlement to IBAN DE89370400440532013000. Corporate card 4111 1111 1111 1111 refunded in error.
home address: 12 Oakwood Avenue. Tax ID: 12-3456789.`;

const HEALTHCARE = `Discharge summary — Riverside General (fictional)
Attending clinician: Amara Okonkwo <amara.okonkwo@hospital-fictional.example>, bleep +44 20 7946 0123.
Patient ID: PT-90432. MRN: MRN-7782341. DOB: 14 Mar 1990.
Assessment: stable. Custom-sensitive term: Type 2 Diabetes (added to glossary).
Follow-up appointment: 02 Dec 2026 at the cardiology clinic.`;

const EDUCATION = `Admissions record — Northfield College (fictional)
Registrar: Felix Mwangi <felix.mwangi@school-fictional.example>, +256 772 555 003.
Student ID: STU-2026-1187. admission no: ADM-5532.
Guardian: Grace Wanjiru <grace.wanjiru@guardian-fictional.example>.
Disciplinary note: Custom-sensitive term: pending-matter-7 (added to glossary).`;

const ENGINEERING = `Proprietary equipment record
Project code: ENG-ALPHA-7
Lead engineer: Sven Larsson <sven.larsson@eng-fictional.example>, +46 8 555 019 22.
Motor MTR-2204, serial SN-99213. Control PLC: 192.168.10.4 (modbus/tcp 502).
Customer ID: CUST-4471. Firmware baseline 4.2.1 verified against vendor bulletin VB-2026-11.`;

const IT_SECURITY = `Incident ITRC-2026-0912 — Unauthorized API access
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdmMtc2Nhbm5lciJ9.7Xk2pQ9rTb4mZs1vYc8Ld3Nh6Wq0Rf5Gj2Kp9Xt4Bv1
X-Api-Key: example_api_value_0123456789
Source IP: 203.0.113.42. Key owner: Devon Mensah <devon.mensah@northwind-fictional.example>, +1 415 555 0182.`;

const HR = `Employee record — HR file 4471
Employee: Lena Fischer <lena.fischer@hr-fictional.example>, +49 30 555 0 221.
DOB: 02/11/1988. annual salary: EUR 62,500. national id: 1234567890.
home address: 12 Oakwood Avenue. Manager: Tomas Berg.`;

const PROCUREMENT = `Vendor contract review — Meridian Analytics Ltd (fictional)
Prepared by: Priya Raman <priya.raman@northwind-fictional.example>, +44 20 7946 0812.
Vendor IBAN: GB82WEST12345698765432. Customer ID: CUST-9001. case no: CTR-3321.
Annual licence: USD 184,000. Discount offered: 12% if signed before 31 Dec 2026.
Contract draft includes an API integration using the key ms_live_4b8e1c9d7f2a6e3b5c0d8f1a — treated as exposed.`;

const OT = `Maintenance log OT-8817 — Water treatment plant, Line 2
Asset: PUMP-L2-04 (serial FICT-88213-A)
Operator: Grace Achieng <grace.achieng@northwind-fictional.example> · +254 712 555 903
PLC gateway: 192.168.44.7 (modbus/tcp 502)
Bearing temperature on PUMP-L2-04 climbed from 61°C to 88°C. Vibration alarm VIB-2 triggered twice.
The operator bypassed the interlock for 12 minutes to finish the backwash cycle, then restored it.
Plant VPN credential used for remote support was OT-VPN-2026!Kampala — please rotate.`;

test("payroll: IBAN, card, salary, DOB and personal contact are masked; pricing-free context preserved", () => {
  const { findings, sanitized } = redact(PAYROLL);
  assertNonePresent(sanitized, [
    "DE89370400440532013000", "4111 1111 1111 1111", "62,500", "02/11/1988",
    "jane.doe@acme-fictional.example", "+1 415 555 0190", "Jane Doe",
  ]);
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("IBAN"));
  assert.ok(cats.has("CARD"));
  assert.ok(cats.has("SALARY"));
  assert.ok(cats.has("DOB"));
  assert.ok(cats.has("PERSON"));
  // Tax ID and address are contextual/low-confidence — reviewable under balanced.
  assert.ok(findings.some((f) => f.category === "GOV_ID" && !f.include));
  assert.ok(findings.some((f) => f.category === "ADDRESS" && !f.include));
  assert.equal(containsRawValues(sanitized, findings.filter((f) => f.include)), false);
});

test("healthcare: patient ID, MRN, DOB and clinician contact are masked; appointment date preserved", () => {
  const { findings, sanitized } = redact(HEALTHCARE, { customTerms: ["Type 2 Diabetes"] });
  assertNonePresent(sanitized, ["PT-90432", "MRN-7782341", "14 Mar 1990", "Amara Okonkwo", "amara.okonkwo@hospital-fictional.example"]);
  assert.ok(sanitized.includes("02 Dec 2026"), "appointment date is operational context");
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("PATIENT_ID"));
  assert.ok(cats.has("MRN"));
  assert.ok(cats.has("DOB"));
  assert.ok(cats.has("CUSTOM"));
});

test("education: student and admission IDs and registrar contact are masked", () => {
  const { findings, sanitized } = redact(EDUCATION, { customTerms: ["pending-matter-7"] });
  assertNonePresent(sanitized, ["STU-2026-1187", "ADM-5532", "Felix Mwangi", "felix.mwangi@school-fictional.example", "pending-matter-7"]);
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("STUDENT_ID"));
  assert.ok(cats.has("CUSTOM"));
});

test("engineering: project/customer IDs detected; equipment and serial reviewable under balanced, masked under strict", () => {
  const bal = detectFindings(ENGINEERING, { policy: "balanced" });
  const strict = detectFindings(ENGINEERING, { policy: "strict" });
  const balSan = buildRedaction(ENGINEERING, bal).sanitized;
  const strictSan = buildRedaction(ENGINEERING, strict).sanitized;

  assert.ok(bal.some((f) => f.category === "PROJECT_CODE" && !f.include));
  assert.ok(bal.some((f) => f.category === "CUSTOMER_ID" && !f.include));
  assert.ok(bal.some((f) => f.category === "INFRA" && !f.include));
  assert.ok(bal.some((f) => f.category === "SERIAL" && !f.include));

  assertNonePresent(strictSan, ["ENG-ALPHA-7", "CUST-4471", "MTR-2204", "SN-99213", "192.168.10.4", "Sven Larsson"]);
  assert.ok(balSan.includes("ENG-ALPHA-7"), "project code is reviewable under balanced");
  assert.ok(balSan.includes("MTR-2204"), "equipment id is reviewable under balanced");
  assert.ok(strictSan.includes("4.2.1"), "firmware version is operational context, not masked");
  assert.ok(strictSan.includes("VB-2026-11"), "vendor bulletin reference is preserved for review");
});

test("IT/security: tokens, keys, IPs and key-owner contact are masked without overlap", () => {
  const { findings, sanitized } = redact(IT_SECURITY);
  assertNonePresent(sanitized, [
    "example_api_value_0123456789",
    "203.0.113.42",
    "Devon Mensah",
    "devon.mensah@northwind-fictional.example",
  ]);
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("BEARER") || cats.has("JWT"));
  assert.ok(cats.has("SECRET"));
  assert.ok(cats.has("IPV4"));
  assert.ok(cats.has("PERSON"));
  const sorted = [...findings].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i].start >= sorted[i - 1].end, "findings must not overlap");
  }
});

test("HR: employee DOB, salary, national id and address are masked under strict; manager name masked", () => {
  const { findings, sanitized } = redact(HR, { policy: "strict" });
  assertNonePresent(sanitized, ["02/11/1988", "62,500", "1234567890", "12 Oakwood Avenue", "Lena Fischer", "Tomas Berg"]);
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("DOB"));
  assert.ok(cats.has("SALARY"));
  assert.ok(cats.has("GOV_ID"));
  assert.ok(cats.has("ADDRESS"));
});

test("procurement: IBAN and exposed key are masked; commercial pricing is preserved (not auto-classified)", () => {
  const { findings, sanitized } = redact(PROCUREMENT);
  assertNonePresent(sanitized, ["GB82WEST12345698765432", "ms_live_4b8e1c9d7f2a6e3b5c0d8f1a", "Priya Raman"]);
  assert.ok(sanitized.includes("USD 184,000"), "commercial pricing is not auto-masked without a salary/confidential label");
  assert.ok(sanitized.includes("12%"), "discount figure is preserved");
  const cats = new Set(findings.map((f) => f.category));
  assert.ok(cats.has("IBAN"));
  assert.ok(cats.has("SECRET"));
  // Customer/case IDs are business-confidential — reviewable under balanced.
  assert.ok(findings.some((f) => f.category === "CUSTOMER_ID" && !f.include));
  assert.ok(findings.some((f) => f.category === "CASE_ID" && !f.include));
});

test("OT: equipment and serial masked under strict; operator contact and VPN credential masked; observations preserved", () => {
  const strict = detectFindings(OT, { policy: "strict" });
  const { sanitized } = buildRedaction(OT, strict);
  assertNonePresent(sanitized, [
    "PUMP-L2-04", "FICT-88213-A", "Grace Achieng", "grace.achieng@northwind-fictional.example",
    "+254 712 555 903", "192.168.44.7", "OT-VPN-2026!Kampala",
  ]);
  assert.ok(sanitized.includes("61°C"), "starting temperature is operational context");
  assert.ok(sanitized.includes("88°C"), "peak temperature is operational context");
  assert.ok(sanitized.includes("backwash cycle"), "event description is preserved");
  const otGuard = detectOtFindings(OT);
  assert.ok(new Set(otGuard.map((f) => f.type)).has("INTERLOCK_BYPASS"));
});

// ---------------------------------------------------------------------------
// Cross-cutting: policy, false positives, overlap, repetition, ambiguity,
// custom terms, semantic merge, telemetry and shared-engine consistency.
// ---------------------------------------------------------------------------

test("strict policy masks every detected category; balanced leaves business-confidential for review", () => {
  const bal = detectFindings(PROCUREMENT, { policy: "balanced" });
  const strict = detectFindings(PROCUREMENT, { policy: "strict" });
  assert.equal(bal.some((f) => !f.include), true, "balanced surfaces reviewable findings");
  assert.equal(strict.filter((f) => !f.include).length, 0, "strict masks every detected category");
});

test("custom policy masks only the caller-enabled categories plus always-on contact/credentials", () => {
  const custom = detectFindings(HEALTHCARE, {
    policy: "custom",
    maskedCategories: ["PATIENT_ID"],
    customTerms: ["Type 2 Diabetes"],
  });
  const { sanitized } = buildRedaction(HEALTHCARE, custom);
  assert.ok(!sanitized.includes("PT-90432"), "enabled category is masked");
  assert.ok(sanitized.includes("MRN-7782341"), "disabled category stays reviewable");
  assert.ok(!sanitized.includes("amara.okonkwo@hospital-fictional.example"), "email is always-on");
  assert.ok(!sanitized.includes("Type 2 Diabetes"), "custom term is always masked");
});

test("false positives: ordinary monetary amounts, dates, capitalized prose and project-like words are not masked", () => {
  const prose = `The Q3 report shows USD 1.2M revenue. Meeting on 15 Dec 2026. Project Atlas launches next quarter. The Outlook client keeps prompting.`;
  const { findings, sanitized } = redact(prose);
  assert.equal(findings.length, 0, "no sensitive categories should fire on generic business prose");
  assert.equal(sanitized, prose);
});

test("repeated identifiers reuse one placeholder and one mapping entry", () => {
  const { findings, sanitized, mapping } = redact("IBAN DE89370400440532013000 repeats as DE89370400440532013000 here.");
  const ibans = findings.filter((f) => f.category === "IBAN");
  assert.equal(ibans.length, 2);
  assert.equal(mapping.filter((m) => m.category === "IBAN").length, 1);
  const matches = sanitized.match(/\[FINANCIAL_ID_\d+\]/g);
  assert.ok(matches && matches.length === 2, "both occurrences share one placeholder");
});

test("multiple countries and identifier formats are detected", () => {
  const text = "Call +256 772 555 014, +44 20 7946 0812, +49 30 555 0 221. IBAN GB82WEST12345698765432 and DE89370400440532013000.";
  const { findings } = redact(text);
  assert.equal(findings.filter((f) => f.category === "PHONE").length, 3);
  assert.equal(findings.filter((f) => f.category === "IBAN").length, 2);
});

test("validated detectors reject malformed identifiers (IBAN checksum, card Luhn)", () => {
  const { findings } = redact("Bad IBAN GB82WEST12345698765433 and bad card 4111111111111112.");
  assert.equal(findings.filter((f) => f.category === "IBAN").length, 0, "invalid IBAN must not match");
  assert.equal(findings.filter((f) => f.category === "CARD").length, 0, "Luhn-invalid card must not match");
});

test("ambiguous finding with a DOB label is masked; a bare date is not", () => {
  const { findings, sanitized } = redact("Reporter: John Smith, DOB: 1/2/1990. Appointment on 15 Dec 2026.");
  assert.ok(findings.some((f) => f.category === "PERSON" && f.value === "John Smith"));
  assert.ok(findings.some((f) => f.category === "DOB" && f.include));
  assert.ok(!sanitized.includes("1/2/1990"), "DOB-labeled date is masked");
  assert.ok(sanitized.includes("15 Dec 2026"), "bare appointment date is preserved");
});

test("custom terms are masked regardless of policy and use the CUSTOM token", () => {
  const { findings, sanitized } = redact("Project Halcyon is confidential.", { customTerms: ["Halcyon"] });
  assert.ok(findings.some((f) => f.category === "CUSTOM" && f.include));
  assert.ok(sanitized.includes("[CUSTOM_1]"));
  assert.ok(!sanitized.includes("Halcyon"));
});

test("local semantic proposals are merged as reviewable, never duplicating existing findings", () => {
  const text = "Contact Lena Fischer at lena.fischer@hr.example. The secret project codename is NIGHTFALL.";
  const base = detectFindings(text, { policy: "balanced" });
  const merged = mergeSemanticProposals(text, base, [
    { value: "Lena Fischer", category: "PERSON" }, // already covered — must not duplicate
    { value: "NIGHTFALL", category: "project" }, // missed by deterministic — added as reviewable
  ]);
  const nightfall = merged.filter((f) => f.value === "NIGHTFALL");
  assert.equal(nightfall.length, 1);
  assert.equal(nightfall[0].source, "semantic");
  assert.equal(nightfall[0].include, false, "semantic proposals are reviewable, never auto-masked");
  assert.equal(merged.filter((f) => f.value === "Lena Fischer").length, 1, "existing finding is not duplicated");
});

test("raw sensitive values never appear in telemetry, prompts or error surfaces across all documents", () => {
  for (const [name, text] of [["payroll", PAYROLL], ["hr", HR], ["procurement", PROCUREMENT], ["ot", OT]]) {
    const findings = detectFindings(text, { policy: "strict" });
    const { sanitized } = buildRedaction(text, findings);
    const prompt = buildPrompt("CLOUD", sanitized);
    assert.equal(containsRawValues(sanitized, findings.filter((f) => f.include)), false, `${name}: sanitized leaks`);
    for (const f of findings.filter((f) => f.include)) {
      assert.ok(!prompt.includes(f.value), `${name}: ${f.value} leaked into prompt`);
    }
  }
  clearEvents();
  recordEvent("inference", { mode: "CLOUD", sanitizedText: "leak-attempt", raw: "secret" });
  const [event] = getEvents();
  assert.equal("sanitizedText" in event, false);
  assert.equal("raw" in event, false);
  clearEvents();
});

test("the web shim and the privacy-core package export the same detectFindings (web + extension consistency)", () => {
  assert.equal(detectFindings, coreDetect);
});

test("exposure scoring remains bounded and deterministic with the universal taxonomy", () => {
  const findings = detectFindings(PAYROLL, { policy: "strict" });
  const score = assessExposure(findings);
  assert.ok(score.score <= 100);
  assert.equal(score.score, assessExposure(findings).score);
  assert.ok(score.factors.length > 0);
});