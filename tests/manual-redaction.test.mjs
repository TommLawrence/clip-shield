/**
 * Manual redaction regression tests: single mask, repeated-value consistency,
 * category prefixes, rehydration, payload safety, sanitized→raw offset
 * mapping, and overlap rejection. Runs against the shared privacy-core engine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectFindings,
  addManualFinding,
  buildRedaction,
  rehydrate,
  sanitizeOffsetToRaw,
  containsRawValues,
} from "../packages/privacy-core/redaction.js";

test("single manual mask produces [MANUAL_1] and rehydrates", () => {
  const text = "Log entry: zeta-nine encountered on 10.0.0.5.";
  let findings = detectFindings(text, { policy: "balanced" });
  const before = findings.length;
  const idx = text.indexOf("zeta-nine");
  findings = addManualFinding(text, findings, idx, idx + "zeta-nine".length);
  assert.equal(findings.length, before + 1);
  const red = buildRedaction(text, findings);
  assert.ok(red.sanitized.includes("[MANUAL_1]"));
  assert.ok(!red.sanitized.includes("zeta-nine"));
  assert.equal(rehydrate(red.sanitized, red.mapping), text);
});

test("repeated value reuses one placeholder across all occurrences", () => {
  const text = "server alpha and server alpha again, yes server alpha";
  let findings = [];
  const idx = text.indexOf("server alpha");
  findings = addManualFinding(text, findings, idx, idx + "server alpha".length, { allOccurrences: true });
  const red = buildRedaction(text, findings);
  const manualEntries = red.mapping.filter((m) => m.token.startsWith("[MANUAL"));
  assert.equal(manualEntries.length, 1);
  assert.equal((red.sanitized.match(/\[MANUAL_1\]/g) || []).length, 3);
  assert.equal(rehydrate(red.sanitized, red.mapping), text);
});

test("category choice changes the placeholder prefix", () => {
  const text = "reach host alpha-7 for details";
  let findings = [];
  const idx = text.indexOf("alpha-7");
  findings = addManualFinding(text, findings, idx, idx + "alpha-7".length, { category: "HOST" });
  const red = buildRedaction(text, findings);
  assert.ok(red.sanitized.includes("[HOST_1]"));
  assert.ok(!red.sanitized.includes("alpha-7"));
});

test("manual masks keep raw values out of the sanitized payload", () => {
  const text = "Project Falcon is led by a small team.";
  let findings = detectFindings(text, { policy: "balanced" });
  const idx = text.indexOf("Project Falcon");
  findings = addManualFinding(text, findings, idx, idx + "Project Falcon".length);
  const red = buildRedaction(text, findings);
  assert.equal(containsRawValues(red.sanitized, findings.filter((f) => f.include)), false);
});

test("sanitizeOffsetToRaw maps plain text and rejects token offsets", () => {
  const text = "email is jane@example.com please reply";
  const findings = detectFindings(text, { policy: "balanced" });
  const red = buildRedaction(text, findings);
  assert.ok(red.sanitizeMap.length > 0);
  assert.equal(sanitizeOffsetToRaw(red.sanitizeMap, 0), 0);
  const tokenStart = red.sanitized.indexOf("[EMAIL_");
  assert.equal(sanitizeOffsetToRaw(red.sanitizeMap, tokenStart + 2), null);
});

test("manual selection overlapping an existing finding is rejected", () => {
  const text = "email is jane@example.com please reply";
  const findings = detectFindings(text, { policy: "balanced" });
  const emailFinding = findings.find((f) => f.category === "EMAIL");
  const next = addManualFinding(text, findings, emailFinding.start, emailFinding.end);
  assert.equal(next.length, findings.length);
});