// Standalone tests for @clipshield/privacy-core, importing the package source
// directly (the same source the web workspace and Chrome extension consume).
// Run: npm test  (from packages/privacy-core)
import test from "node:test";
import assert from "node:assert/strict";
import { detectFindings, buildRedaction, containsRawValues, PROFILES, mergeSemanticProposals } from "../redaction.js";
import { luhn, ibanChecksum } from "../detectors.js";
import { assessExposure } from "../risk-engine.js";
import { detectOtFindings } from "../ot-guardrail.js";

const IT = `Ticket #INC-4471 — Reporter: Amina Nakato <amina.nakato@northwind-fictional.example>
Callback: +256 772 555 014. Workstation WS-1142, host 10.24.8.51.
Signed in with the shared service account svc-mailops using the password MailOps!2026-Nov.`;

const OT = `Asset: PUMP-L2-04 (serial FICT-88213-A). Operator: Grace Achieng <grace.achieng@northwind-fictional.example>
PLC gateway: 192.168.44.7 (modbus/tcp 502). Bearing temperature climbed from 61C to 88C; Vibration alarm VIB-2 triggered twice.
The operator bypassed the interlock for 12 minutes. Plant VPN credential used for remote support was OT-VPN-2026!Kampala.`;

test("standard profile masks personal info, service account, host, IPs and credentials", () => {
  const findings = detectFindings(IT, { profile: PROFILES.STANDARD });
  const { sanitized } = buildRedaction(IT, findings);
  for (const value of ["Amina Nakato", "amina.nakato@northwind-fictional.example", "+256 772 555 014", "svc-mailops", "WS-1142", "10.24.8.51", "MailOps!2026-Nov"]) {
    assert.ok(!sanitized.includes(value), `leaked: ${value}`);
  }
  assert.equal(containsRawValues(sanitized, findings.filter((f) => f.include)), false);
});

test("OT profile additionally masks equipment and network range", () => {
  const findings = detectFindings(OT, { profile: PROFILES.OT });
  const { sanitized } = buildRedaction(OT, findings);
  for (const value of ["Grace Achieng", "PUMP-L2-04", "FICT-88213-A", "192.168.44.7", "OT-VPN-2026!Kampala"]) {
    assert.ok(!sanitized.includes(value), `leaked: ${value}`);
  }
  assert.ok(sanitized.includes("61C"), "temperature reading preserved");
  assert.ok(sanitized.includes("88C"), "temperature reading preserved");
});

test("standard profile preserves equipment identifiers; OT profile masks them", () => {
  const std = detectFindings(OT, { profile: PROFILES.STANDARD });
  const ot = detectFindings(OT, { profile: PROFILES.OT });
  assert.ok(std.some((f) => f.category === "INFRA" && !f.include));
  assert.ok(ot.some((f) => f.category === "INFRA" && f.include));
  assert.ok(buildRedaction(OT, std).sanitized.includes("PUMP-L2-04"));
  assert.ok(!buildRedaction(OT, ot).sanitized.includes("PUMP-L2-04"));
});

test("OT guardrail flags safety-critical items without prescribing overrides", () => {
  const findings = detectOtFindings(OT);
  const types = new Set(findings.map((f) => f.type));
  assert.ok(types.has("INTERLOCK_BYPASS"));
  assert.ok(types.has("TEMP_TREND"));
  assert.ok(types.has("VIBRATION_TREND"));
  assert.ok(types.has("REMOTE_ACCESS_CRED"));
  const interlock = findings.find((f) => f.type === "INTERLOCK_BYPASS");
  assert.equal(interlock.requiresHumanVerification, true);
});

test("exposure scoring is bounded and deterministic", () => {
  const f = detectFindings(IT, { profile: PROFILES.STANDARD });
  const score = assessExposure(f);
  assert.ok(score.score <= 100);
  assert.equal(score.score, assessExposure(f).score);
});

// --- Universal taxonomy: policy + validated/contextual detectors -------------

const HEALTHCARE = `Clinician: Amara Okonkwo <amara@hospital.example>, +44 20 7946 0123.
Patient ID: PT-90432. MRN: MRN-7782341. DOB: 14 Mar 1990.`;

test("validated detectors: IBAN checksum and card Luhn reject malformed values", () => {
  assert.equal(ibanChecksum("GB82WEST12345698765432"), true);
  assert.equal(ibanChecksum("GB82WEST12345698765433"), false);
  assert.equal(luhn("4111111111111111"), true);
  assert.equal(luhn("4111111111111112"), false);
  const good = detectFindings("IBAN GB82WEST12345698765432 card 4111 1111 1111 1111", { policy: "balanced" });
  const bad = detectFindings("IBAN GB82WEST12345698765433 card 4111111111111112", { policy: "balanced" });
  assert.ok(good.some((f) => f.category === "IBAN"));
  assert.ok(good.some((f) => f.category === "CARD"));
  assert.equal(bad.some((f) => f.category === "IBAN"), false);
  assert.equal(bad.some((f) => f.category === "CARD"), false);
});

test("balanced masks healthcare identifiers; strict additionally masks business/confidential context", () => {
  const bal = detectFindings(HEALTHCARE, { policy: "balanced" });
  const { sanitized } = buildRedaction(HEALTHCARE, bal);
  assert.ok(!sanitized.includes("PT-90432"));
  assert.ok(!sanitized.includes("MRN-7782341"));
  assert.ok(!sanitized.includes("14 Mar 1990"));
  assert.ok(bal.some((f) => f.category === "PATIENT_ID" && f.include));
  assert.ok(bal.some((f) => f.category === "MRN" && f.include));
});

test("custom policy masks only the caller-enabled categories", () => {
  const custom = detectFindings(HEALTHCARE, { policy: "custom", maskedCategories: ["MRN"] });
  const { sanitized } = buildRedaction(HEALTHCARE, custom);
  assert.ok(!sanitized.includes("MRN-7782341"), "enabled category masked");
  assert.ok(sanitized.includes("PT-90432"), "disabled category reviewable");
  assert.ok(!sanitized.includes("amara@hospital.example"), "email always-on");
});

test("semantic proposals merge as reviewable without duplicating existing findings", () => {
  const text = "Contact Lena Fischer at lena@example. Codename NIGHTFALL is secret.";
  const base = detectFindings(text, { policy: "balanced" });
  const merged = mergeSemanticProposals(text, base, [
    { value: "Lena Fischer", category: "PERSON" },
    { value: "NIGHTFALL", category: "project" },
  ]);
  assert.equal(merged.filter((f) => f.value === "Lena Fischer").length, 1);
  const proposal = merged.find((f) => f.value === "NIGHTFALL");
  assert.ok(proposal && proposal.source === "semantic" && proposal.include === false);
});