import test from "node:test";
import assert from "node:assert/strict";
import {
  addManualFinding,
  buildRedaction,
  containsRawValues,
  countPlaceholders,
  detectFindings,
  rehydrate,
} from "../src/lib/redaction.js";
import { assessExposure } from "../src/lib/risk-engine.js";
import { detectOtFindings, OT_DISCLAIMER } from "../src/lib/ot-guardrail.js";
import { buildPrompt, parseStructured } from "../src/lib/hybrid-modes.js";
import { clearEvents, getEvents, recordEvent } from "../src/lib/telemetry.js";
import { SCENARIOS } from "../src/lib/scenarios.js";

const redact = (text, terms = []) => {
  const findings = detectFindings(text, { customTerms: terms });
  return { findings, ...buildRedaction(text, findings) };
};

test("detects a personal name and an email address with stable placeholders", () => {
  const text = "Reporter: Amina Nakato <amina.nakato@northwind-fictional.example>";
  const { findings, sanitized, mapping } = redact(text);

  const person = findings.find((finding) => finding.category === "PERSON");
  const email = findings.find((finding) => finding.category === "EMAIL");
  assert.ok(person, "a personal name must be detected");
  assert.ok(email, "an email must be detected");
  assert.equal(person.value, "Amina Nakato");
  assert.equal(person.token, "[PERSON_1]");
  assert.equal(email.token, "[EMAIL_1]");
  assert.ok(sanitized.includes("[PERSON_1]"));
  assert.ok(sanitized.includes("[EMAIL_1]"));
  assert.ok(!sanitized.includes("Amina Nakato"));
  assert.ok(!sanitized.includes("amina.nakato@northwind-fictional.example"));
  assert.equal(mapping.find((entry) => entry.category === "EMAIL").value, "amina.nakato@northwind-fictional.example");
});

test("detects international phone numbers including +256", () => {
  const { findings, sanitized } = redact("Callback: +256 772 555 014 and mobile +1 415 555 0182");
  const phones = findings.filter((finding) => finding.category === "PHONE");

  assert.equal(phones.length, 2);
  assert.ok(sanitized.includes("[PHONE_1]"));
  assert.ok(!sanitized.includes("772 555 014"));
});

test("detects IPv4 addresses without treating them as phone numbers", () => {
  const { findings, sanitized } = redact("Gateway 10.24.8.12, host 192.168.44.7");
  const ips = findings.filter((finding) => finding.category === "IPV4");

  assert.equal(ips.length, 2);
  assert.equal(findings.filter((finding) => finding.category === "PHONE").length, 0);
  assert.ok(sanitized.includes("[IPV4_1]"));
});

test("detects cloud keys, provider tokens and private key blocks", () => {
  const text = [
    "AWS_ACCESS_KEY_ID=AKIA3F7KQ2ZP5M9XW1LD",
    "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY",
    "token ghp_16C7e42F292c6912E7710c838347Ae178B4a",
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");

  const { findings, sanitized, mapping } = redact(text);
  const categories = new Set(findings.map((finding) => finding.category));

  assert.ok(categories.has("AWS_KEY"));
  assert.ok(categories.has("SECRET"));
  assert.ok(categories.has("PRIVATE_KEY"));
  assert.ok(!sanitized.includes("AKIA3F7KQ2ZP5M9XW1LD"));
  assert.ok(!sanitized.includes("wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY"));
  assert.ok(!sanitized.includes("MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn"));
  assert.ok(mapping.some((entry) => entry.category === "PRIVATE_KEY"));
});

test("detects bearer tokens and JWTs without overlapping replacements", () => {
  const jwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdmMtc2Nhbm5lciIsInJvbGUiOiJhZG1pbiJ9.7Xk2pQ9rTb4mZs1vYc8Ld3Nh6Wq0Rf5Gj2Kp9Xt4Bv1";
  const text = `Authorization: Bearer ${jwt}`;
  const { findings, sanitized } = redact(text);

  assert.ok(findings.length >= 1);
  assert.ok(!sanitized.includes(jwt));

  const sorted = [...findings].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i].start >= sorted[i - 1].end, "findings must not overlap");
  }
});

test("masks a password value but leaves ordinary prose untouched", () => {
  const text = "I signed in using the password MailOps!2026-Nov. The password rotation was last week.";
  const { findings, sanitized } = redact(text);

  assert.ok(findings.some((finding) => finding.category === "SECRET"));
  assert.ok(!sanitized.includes("MailOps!2026-Nov"));
  assert.ok(sanitized.includes("password rotation"), "the word rotation must not be treated as a secret");
});

test("custom terms and manual selections are maskable", () => {
  const text = "Project Halcyon is delayed. Owner: Priya Raman.";
  const findings = detectFindings(text, { customTerms: ["Halcyon", "Priya Raman"] });
  const manual = addManualFinding(text, findings, text.indexOf("delayed"), text.indexOf("delayed") + 7);
  const { sanitized, mapping } = buildRedaction(text, manual);

  assert.ok(sanitized.includes("[CUSTOM_1]"));
  assert.ok(sanitized.includes("[MANUAL_1]"));
  assert.ok(!sanitized.includes("Halcyon"));
  assert.ok(!sanitized.includes("Priya Raman"));
  assert.ok(mapping.some((entry) => entry.category === "MANUAL"));
});

test("the same value reuses one placeholder and one mapping entry", () => {
  const { findings, sanitized, mapping } = redact("a@fictional.example wrote to a@fictional.example");
  assert.equal(findings.filter((finding) => finding.category === "EMAIL").length, 2);
  assert.equal(mapping.length, 1);
  assert.equal(countPlaceholders(sanitized), 2);
});

test("excluding a finding keeps that value and lowers the exposure score", () => {
  const text = "Contact amina@fictional.example or call +256 772 555 014";
  const findings = detectFindings(text);
  const included = buildRedaction(text, findings);
  const excluded = buildRedaction(
    text,
    findings.map((finding) => (finding.category === "EMAIL" ? { ...finding, include: false } : finding)),
  );

  assert.ok(!included.sanitized.includes("amina@fictional.example"));
  assert.ok(excluded.sanitized.includes("amina@fictional.example"));
  assert.ok(assessExposure(findings).score > assessExposure(findings.map((f) => (f.category === "EMAIL" ? { ...f, include: false } : f))).score);
});

test("rehydration is explicit, reversible and complete", () => {
  const text = "Reporter amina.nakato@fictional.example, host 10.24.8.51";
  const { sanitized, mapping } = redact(text);
  const restored = rehydrate(sanitized, mapping);

  assert.equal(restored, text);
  assert.ok(!sanitized.includes("amina.nakato@fictional.example"));
});

test("sanitized output never contains a masked original value", () => {
  const text = [
    "Reporter: Amina Nakato <amina.nakato@northwind-fictional.example>",
    "Callback: +256 772 555 014",
    "Host: 10.24.8.51",
    "X-Api-Key: example_api_value_0123456789",
  ].join("\n");

  const findings = detectFindings(text);
  const { sanitized } = buildRedaction(text, findings);
  const masked = findings.filter((finding) => finding.include);

  assert.equal(containsRawValues(sanitized, masked), false);
  for (const finding of masked) {
    assert.ok(!sanitized.includes(finding.value), `${finding.label} leaked into the sanitized payload`);
  }
});

test("containsRawValues detects a deliberate leak", () => {
  const findings = [{ value: "amina@fictional.example", include: true }];
  assert.equal(containsRawValues("Send to amina@fictional.example", findings), true);
  assert.equal(containsRawValues("Send to [EMAIL_1]", findings), false);
});

test("empty input produces an empty, safe payload", () => {
  const { sanitized, mapping, maskedCount } = redact("");
  assert.equal(sanitized, "");
  assert.equal(mapping.length, 0);
  assert.equal(maskedCount, 0);
});

test("exposure scoring is deterministic, explainable and bounded", () => {
  const low = detectFindings("Host 10.24.8.51");
  const high = detectFindings(
    "amina@fictional.example +256 772 555 014 10.24.8.51 AKIA3F7KQ2ZP5M9XW1LD example_api_value_0123456789",
  );

  const lowScore = assessExposure(low);
  const highScore = assessExposure(high);

  assert.ok(lowScore.score < highScore.score);
  assert.ok(highScore.score <= 100);
  assert.equal(highScore.score, assessExposure(high).score, "same findings must produce the same score");
  assert.ok(highScore.factors.length > 0);
  assert.ok(highScore.factors.every((factor) => factor.points > 0 && factor.explanation));
  assert.equal(assessExposure([]).score, 0);
});

test("prompts are built from sanitized text only", () => {
  const original = "Reporter amina.nakato@fictional.example on 10.24.8.51";
  const { sanitized, findings } = redact(original);
  const prompt = buildPrompt("CLOUD", sanitized);

  assert.ok(prompt.includes("[EMAIL_1]"));
  assert.ok(!prompt.includes("amina.nakato@fictional.example"));
  for (const finding of findings) {
    assert.ok(!prompt.includes(finding.value));
  }
});

test("structured output parsing tolerates fences and rejects junk", () => {
  assert.deepEqual(parseStructured('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(parseStructured("no json here"), null);
  assert.equal(parseStructured(""), null);
});

test("telemetry never records prompt content or raw values", () => {
  clearEvents();
  recordEvent("inference", {
    mode: "CLOUD",
    inferenceSource: "IN_CLOUD",
    latencyMs: 812,
    prompt: "amina@fictional.example",
    raw: "secret",
    sanitizedText: "text",
  });

  const [event] = getEvents();
  assert.equal(event.mode, "CLOUD");
  assert.equal(event.latencyMs, 812);
  assert.equal("prompt" in event, false);
  assert.equal("raw" in event, false);
  assert.equal("sanitizedText" in event, false);
  clearEvents();
});

// ---------------------------------------------------------------------------
// Phase 2 / Phase 4 regression coverage against the fictional incident
// scenarios. These assert that configured masking policies protect every
// required class of sensitive value, and that operational observations
// (temperatures, vibration readings, event descriptions, time sequences) are
// preserved. No real data is used anywhere.
// ---------------------------------------------------------------------------

const IT_TICKET = SCENARIOS.find((scenario) => scenario.id === "it-ticket");
const OT_LOG = SCENARIOS.find((scenario) => scenario.id === "ot-maintenance");

const assertNonePresent = (sanitized, values) => {
  for (const value of values) {
    assert.ok(!sanitized.includes(value), `sensitive value leaked into sanitized payload: ${value}`);
  }
};

test("INC-4471 IT support scenario: standard profile masks personal info, service account, host, IPs and credentials", () => {
  const findings = detectFindings(IT_TICKET.text, { profile: "standard" });
  const { sanitized } = buildRedaction(IT_TICKET.text, findings);

  assertNonePresent(sanitized, [
    "Amina Nakato",
    "amina.nakato@northwind-fictional.example",
    "+256 772 555 014",
    "svc-mailops",
    "WS-1142",
    "10.24.8.51",
    "10.24.8.12",
    "MailOps!2026-Nov",
  ]);

  const categories = new Set(findings.map((finding) => finding.category));
  assert.ok(categories.has("PERSON"));
  assert.ok(categories.has("EMAIL"));
  assert.ok(categories.has("PHONE"));
  assert.ok(categories.has("SVCACCT"));
  assert.ok(categories.has("HOST"));
  assert.ok(categories.has("IPV4"));
  assert.ok(categories.has("SECRET"));

  // The buildPrompt output (what would be sent to the cloud) must contain none
  // of the masked original values.
  const prompt = buildPrompt("CLOUD", sanitized);
  assertNonePresent(prompt, [
    "Amina Nakato",
    "amina.nakato@northwind-fictional.example",
    "+256 772 555 014",
    "svc-mailops",
    "WS-1142",
    "MailOps!2026-Nov",
  ]);
  assert.equal(containsRawValues(sanitized, findings.filter((finding) => finding.include)), false);
});

test("INC-4471 preserves operational context — Outlook, credential cache, the rotation and the .x range reference", () => {
  const findings = detectFindings(IT_TICKET.text, { profile: "standard" });
  const { sanitized } = buildRedaction(IT_TICKET.text, findings);
  assert.ok(sanitized.includes("Outlook"), "the product name is operational context, not PII");
  assert.ok(sanitized.includes("credential cache"), "operational description must survive redaction");
  assert.ok(sanitized.includes("password rotation"), "the phrase rotation must not be treated as a secret");
  assert.ok(sanitized.includes("10.24.8.x"), "the descriptive .x range reference must be preserved");
});

test("PUMP-L2-04 OT maintenance scenario: OT profile masks operator name, equipment, PLC IP, CIDR and the VPN credential", () => {
  const findings = detectFindings(OT_LOG.text, { profile: "ot" });
  const { sanitized } = buildRedaction(OT_LOG.text, findings);

  assertNonePresent(sanitized, [
    "Grace Achieng",
    "grace.achieng@northwind-fictional.example",
    "+254 712 555 903",
    "PUMP-L2-04",
    "FICT-88213-A",
    "192.168.44.7",
    "192.168.44.0/24",
    "OT-VPN-2026!Kampala",
    "Kelvin Otieno",
  ]);

  const categories = new Set(findings.map((finding) => finding.category));
  assert.ok(categories.has("PERSON"));
  assert.ok(categories.has("EMAIL"));
  assert.ok(categories.has("PHONE"));
  assert.ok(categories.has("IPV4"));
  assert.ok(categories.has("CIDR"));
  assert.ok(categories.has("INFRA"), "equipment identifiers must be detected under the OT profile");
  assert.ok(categories.has("VPN_CRED"));

  const prompt = buildPrompt("CLOUD", sanitized);
  assertNonePresent(prompt, ["Grace Achieng", "PUMP-L2-04", "OT-VPN-2026!Kampala", "192.168.44.0/24"]);
  assert.equal(containsRawValues(sanitized, findings.filter((finding) => finding.include)), false);
});

test("OT profile preserves operational observations — temperature readings, vibration alarms, shift times and event descriptions", () => {
  const findings = detectFindings(OT_LOG.text, { profile: "ot" });
  const { sanitized } = buildRedaction(OT_LOG.text, findings);
  assert.ok(sanitized.includes("61°C"), "the starting temperature reading is operational context");
  assert.ok(sanitized.includes("88°C"), "the peak temperature reading is operational context");
  assert.ok(/VIB[-_]\d+/.test(sanitized) || sanitized.includes("Vibration"), "the vibration observation context is preserved");
  assert.ok(sanitized.includes("backwash cycle"), "the event description is operational context");
  assert.ok(sanitized.includes("17 Nov 2026"), "the time sequence is preserved");
});

test("the Infrastructure/OT profile gates equipment masking — standard keeps PUMP-L2-04, OT masks it", () => {
  const standard = detectFindings(OT_LOG.text, { profile: "standard" });
  const ot = detectFindings(OT_LOG.text, { profile: "ot" });

  const standardInfra = standard.filter((finding) => finding.category === "INFRA");
  const otInfra = ot.filter((finding) => finding.category === "INFRA");
  assert.ok(standardInfra.length > 0, "infra identifiers are detected even in the standard profile");
  assert.ok(standardInfra.every((finding) => finding.include === false), "infra findings are not masked by default in the standard profile");
  assert.ok(otInfra.some((finding) => finding.include === true), "infra findings are masked under the OT profile");

  const standardSanitized = buildRedaction(OT_LOG.text, standard).sanitized;
  const otSanitized = buildRedaction(OT_LOG.text, ot).sanitized;
  assert.ok(standardSanitized.includes("PUMP-L2-04"), "standard profile preserves the equipment identifier");
  assert.ok(!otSanitized.includes("PUMP-L2-04"), "OT profile masks the equipment identifier");
});

test("names are detected contextually, never by naive capitalization", () => {
  const prose = "The Outlook client keeps prompting. Windows credential cache was cleared. No change observed.";
  const findings = detectFindings(prose, { profile: "standard" });
  assert.equal(findings.some((finding) => finding.category === "PERSON"), false, "ordinary capitalized prose must not be treated as a personal name");
});

test("service accounts and workstation/server identifiers are detected", () => {
  const { findings, sanitized } = redact("Logged in as svc-mailops from WS-1142, also seen on SRV-001.");
  assert.ok(findings.some((finding) => finding.category === "SVCACCT" && finding.value === "svc-mailops"));
  assert.ok(findings.some((finding) => finding.category === "HOST" && finding.value === "WS-1142"));
  assert.ok(findings.some((finding) => finding.category === "HOST" && finding.value === "SRV-001"));
  assert.ok(!sanitized.includes("svc-mailops"));
  assert.ok(!sanitized.includes("WS-1142"));
  assert.ok(!sanitized.includes("SRV-001"));
});

test("CIDR network ranges are masked as a single token and take precedence over bare IPs", () => {
  const { findings, sanitized } = redact("OT segment 192.168.44.0/24 and host 10.24.8.51");
  assert.ok(findings.some((finding) => finding.category === "CIDR" && finding.value === "192.168.44.0/24"));
  assert.ok(findings.some((finding) => finding.category === "IPV4" && finding.value === "10.24.8.51"));
  assert.ok(!findings.some((finding) => finding.category === "IPV4" && finding.value === "192.168.44.0"));
  assert.ok(sanitized.includes("[CIDR_1]"));
  assert.ok(!sanitized.includes("192.168.44.0/24"));
});

// ---------------------------------------------------------------------------
// Phase 4 — OT / critical-infrastructure guardrail
// ---------------------------------------------------------------------------

test("OT guardrail flags the interlock bypass, temperature trend, vibration alarm, exposed PLC and remote-access credential", () => {
  const findings = detectOtFindings(OT_LOG.text);
  const types = new Set(findings.map((finding) => finding.type));
  assert.ok(types.has("INTERLOCK_BYPASS"), "interlock bypass must be flagged as safety-critical");
  assert.ok(types.has("TEMP_TREND"), "unusual temperature trend must be flagged");
  assert.ok(types.has("VIBRATION_TREND"), "vibration alarm must be flagged");
  assert.ok(types.has("EXPOSED_OT_ID"), "exposed PLC/SCADA/HMI identifier must be flagged");
  assert.ok(types.has("REMOTE_ACCESS_CRED"), "remote-access credential must be flagged");
  assert.ok(types.has("OT_NETWORK"), "OT network range must be flagged");

  const interlock = findings.find((finding) => finding.type === "INTERLOCK_BYPASS");
  assert.equal(interlock.requiresHumanVerification, true);
  assert.equal(interlock.severity, "critical");
});

test("OT guardrail detection is never prescriptive — it issues no bypass/reset/override instructions", () => {
  const findings = detectOtFindings(OT_LOG.text);
  for (const finding of findings) {
    const text = `${finding.title} ${finding.description}`;
    // A prohibition ("do not reset", "Never disable") is allowed; a positive
    // imperative to disable/bypass/reset/override a safety mechanism is not.
    const prescriptive = /(?<!not )(?<!never )(?<!do not )(?<!should not )(?<!must not )(?<!don't )(disable|bypass|reset|override)\s+(?:the\s+)?(interlock|safety|protective|trip|limit|alarm)/i;
    assert.ok(!prescriptive.test(text), `finding must not instruct a safety override: ${finding.title}`);
  }
  assert.ok(OT_DISCLAIMER.toLowerCase().includes("never disable"));
  assert.ok(OT_DISCLAIMER.toLowerCase().includes("approved site procedures"));
});

test("OT guardrail leaves the IT support scenario without safety flags", () => {
  const findings = detectOtFindings(IT_TICKET.text);
  const safetyTypes = findings.filter((finding) => finding.requiresHumanVerification);
  assert.equal(safetyTypes.length, 0, "the IT scenario has no OT safety-critical events");
});

test("raw sensitive values never appear in telemetry, prompts or error surfaces", () => {
  const findings = detectFindings(IT_TICKET.text, { profile: "standard" });
  const { sanitized } = buildRedaction(IT_TICKET.text, findings);
  clearEvents();
  recordEvent("inference", { mode: "CLOUD", inferenceSource: "IN_CLOUD", latencyMs: 500, sanitizedText: sanitized });
  const [event] = getEvents();
  assert.equal("sanitizedText" in event, false);
  for (const finding of findings.filter((finding) => finding.include)) {
    assert.ok(!event.mode.includes(finding.value), "a sensitive value must not leak into an allow-listed telemetry field");
  }
  clearEvents();
});