/**
 * ClipShield — data-driven detector registry.
 *
 * Each detector is a self-contained definition with:
 *   id           — stable detector identifier
 *   category     — the CATEGORIES entry it emits
 *   method       — "pattern" | "validation" | "context" (layer A/B)
 *   confidence   — "high" | "medium" | "low"
 *   pattern       — the source regex (global)
 *   maskGroup     — 1-based capture group to mask (defaults to the whole match)
 *   validate      — optional (match) => boolean for checksum/format checks
 *   context       — optional human note describing when it applies
 *
 * Layer A (deterministic) = pattern + validation detectors.
 * Layer B (contextual)    = context detectors, gated by a surrounding label or
 *                           proximity cue plus a common-word rejection list.
 * Layer C (local semantic) lives in semantic.js and the host surface; it never
 * runs in this module.
 *
 * Detection is deliberately conservative: nothing here treats every monetary
 * amount, capitalized word, date, location or project number as sensitive.
 * Findings depend on a validated format or an explicit contextual cue, and
 * every finding stays reviewable (Layer D, resolved by policy.js).
 */

// --- Validation helpers -----------------------------------------------------

/** Luhn checksum for payment-card numbers (13–19 digits). */
export function luhn(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum > 0 && sum % 10 === 0;
}

/** IBAN mod-97 checksum. Country-agnostic, handles spaces. */
export function ibanChecksum(value) {
  const compact = String(value).replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,29}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  // BigInt is available in all target runtimes (Node 20+, Chrome 67+).
  let remainder = 0n;
  for (const ch of expanded) {
    remainder = (remainder * 10n + BigInt(ch.charCodeAt(0) - 48)) % 97n;
  }
  return remainder === 1n;
}

// --- Contextual name detection (Layer B) -----------------------------------

// Capitalized tokens that must never be treated as a person name even when a
// contextual cue is present. This is the guard against a naive capitalized-words
// detector: a name is accepted only when a cue is present AND none of the
// captured words are ordinary prose or operational terms.
const COMMON_NAME_WORDS = new Set([
  "The", "This", "That", "These", "Those", "Our", "Your", "Their", "We", "They", "He", "She", "It", "An", "No", "All",
  "Some", "Any", "Each", "Every", "Both", "Either", "Neither", "One", "Two", "Three", "First", "Last", "Next", "Then",
  "Now", "Please", "Since", "After", "Before", "During", "While", "When", "If", "Because", "Although", "However",
  "Therefore", "Meanwhile", "Finally", "Moreover", "Outlook", "Windows", "Browser", "Internal", "Host", "Workstation",
  "Server", "Gateway", "Site", "Shift", "Asset", "Source", "Target", "Ticket", "Incident", "Maintenance", "Plant",
  "Line", "Floor", "Version", "Firmware", "Bearing", "Temperature", "Vibration", "Duty", "Coupling", "Backwash",
  "Interlock", "Alarm", "Rotation", "Callback", "Mobile", "Account", "Sales", "Annual", "Implementation", "Discount",
  "Payment", "Vendor", "Field", "Details", "Summary", "Action", "Follow", "Observation", "Request", "Notes",
  "Reduced", "Greased", "Scheduled", "Verified", "Reported", "Detected", "Observed", "Completed", "Pending", "Open",
  "Closed", "Replaced", "Restored", "Bypassed", "Disabled", "Enabled", "Updated", "Rotated", "Issued", "Reissued",
  "Review", "Customer", "Client", "Supplier", "Project", "Matter", "Case", "Patient", "Student", "Employee",
]);

const NAME_LABELS =
  "(?:Prepared\\s+by|Submitted\\s+by|Key\\s+owner|Reporter|Owner|Operator|Author|Reviewer|Lead|Engineer|Analyst|Technician|Supervisor|Manager|Nurse|Doctor|Clinician|by)";

const NAME_GROUP = "([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})";

function isValidName(capture) {
  const words = String(capture || "").trim().split(/\s+/);
  if (words.length < 2) return false;
  return words.every((word) => !COMMON_NAME_WORDS.has(word));
}

// --- The registry -----------------------------------------------------------
// Order matters: earlier detectors win overlapping spans (highest specificity
// and confidence first). Validated financial identifiers precede phones; CIDR
// precedes bare IPv4; infrastructure precedes generic serials.

export const DETECTORS = [
  // Layer A — credentials (highest confidence, always masked).
  { id: "private-key-block", category: "PRIVATE_KEY", method: "pattern", confidence: "high", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g, context: "PEM private key block" },
  { id: "aws-access-key", category: "AWS_KEY", method: "pattern", confidence: "high", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, context: "AWS access key id" },
  { id: "aws-secret", category: "SECRET", method: "pattern", confidence: "high", pattern: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{20,})["']?/g, maskGroup: 1, context: "AWS secret access key assignment" },
  { id: "github-token", category: "SECRET", method: "pattern", confidence: "high", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, context: "GitHub personal access token" },
  { id: "github-fine-grained", category: "SECRET", method: "pattern", confidence: "high", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, context: "GitHub fine-grained token" },
  { id: "stripe-key", category: "SECRET", method: "pattern", confidence: "high", pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g, context: "Stripe secret/publishable key" },
  { id: "mollie-key", category: "SECRET", method: "pattern", confidence: "high", pattern: /\bms_(?:live|test)_[A-Za-z0-9]{12,}\b/g, context: "Mollie API key" },
  { id: "slack-token", category: "SECRET", method: "pattern", confidence: "high", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, context: "Slack token" },
  { id: "google-api-key", category: "SECRET", method: "pattern", confidence: "high", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g, context: "Google API key" },
  { id: "generic-secret-assignment", category: "SECRET", method: "pattern", confidence: "high", pattern: /(?:api[_-]?key|apikey|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{12,})["']?/gi, maskGroup: 1, context: "key=… / secret=… assignment" },
  { id: "password-phrase", category: "SECRET", method: "context", confidence: "medium", pattern: /\b(?:password|passphrase)\s+(?:is\s+|was\s+)?([A-Za-z0-9!@#$%^&*._+/=-]{8,})\b/gi, maskGroup: 1, validate: (match) => /\d/.test(match[1] || ""), context: "password is <value> (requires a digit)" },
  { id: "vpn-credential", category: "VPN_CRED", method: "pattern", confidence: "high", pattern: /\b([A-Z][A-Z0-9]{0,6}-VPN-[A-Za-z0-9!@#$%^&*._+/=-]{4,})\b/g, maskGroup: 1, context: "OT/VPN credential token" },
  { id: "jwt", category: "JWT", method: "pattern", confidence: "high", pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, context: "JWT three-part token" },
  { id: "bearer-token", category: "BEARER", method: "pattern", confidence: "high", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, context: "Authorization: Bearer …" },
  { id: "service-account", category: "SVCACCT", method: "pattern", confidence: "high", pattern: /\bsvc[-_][a-z0-9][-a-z0-9]{1,}\b/gi, context: "svc-* service account" },

  // Layer A — validated financial identifiers (checksum-gated, country-agnostic).
  { id: "iban", category: "IBAN", method: "validation", confidence: "high", pattern: /\b[A-Z]{2}\d{2}(?:[A-Z0-9]\s?){10,30}\b/g, validate: (match) => ibanChecksum(match[0]), context: "IBAN with mod-97 checksum" },
  { id: "payment-card", category: "CARD", method: "validation", confidence: "high", pattern: /\b(?:\d[ -]?){13,19}\b|\b\d{13,19}\b/g, validate: (match) => luhn(match[0]), context: "Luhn-valid card number (13–19 digits)" },

  // Layer B — contextual personal identity.
  { id: "person-by-label", category: "PERSON", method: "context", confidence: "medium", pattern: new RegExp(`${NAME_LABELS}\\s*[-:()]?\\s*${NAME_GROUP}\\b`, "g"), maskGroup: 1, validate: (match) => isValidName(match[1]), context: "Reporter/Owner/…: <Name>" },
  { id: "person-by-email", category: "PERSON", method: "context", confidence: "medium", pattern: new RegExp(`${NAME_GROUP}\\s*[(<]\\s*[A-Za-z0-9._%+-]+@`, "g"), maskGroup: 1, validate: (match) => isValidName(match[1]), context: "<Name> <email>" },
  { id: "person-by-phone", category: "PERSON", method: "context", confidence: "medium", pattern: new RegExp(`${NAME_GROUP}\\s*,\\s*\\+\\d{1,3}`, "g"), maskGroup: 1, validate: (match) => isValidName(match[1]), context: "<Name>, +<phone>" },
  { id: "email", category: "EMAIL", method: "pattern", confidence: "high", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, context: "email address" },
  { id: "phone-intl", category: "PHONE", method: "pattern", confidence: "high", pattern: /\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,4}\b/g, context: "+<country> phone" },
  { id: "phone-local", category: "PHONE", method: "pattern", confidence: "medium", pattern: /\b0\d{2,4}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g, context: "local 0xx phone" },
  { id: "dob", category: "DOB", method: "context", confidence: "medium", pattern: /\b(?:DOB|date\s+of\s+birth|born\s+on|birthday)\s*[-:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/gi, maskGroup: 1, context: "DOB: <date>" },
  { id: "address", category: "ADDRESS", method: "context", confidence: "low", pattern: /\b(?:address|residence|home\s+address|street)\s*[-:]?\s*(\d{1,5}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Place|Pl|Close|Way))\b/gi, maskGroup: 1, context: "street-address cue + number + road suffix" },
  { id: "gov-id", category: "GOV_ID", method: "context", confidence: "low", pattern: /\b(?:SSN|national\s+(?:id|insurance)|passport\s+(?:no|number|#)|NIN|tax\s+(?:id|number))\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{5,})\b/gi, maskGroup: 1, context: "government-id label + value" },

  // Layer B — contextual healthcare identifiers (require an explicit clinical label).
  { id: "mrn", category: "MRN", method: "context", confidence: "high", pattern: /\b(?:MRN|medical\s+record\s+(?:number|no|id))\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi, maskGroup: 1, context: "MRN: <value>" },
  { id: "patient-id", category: "PATIENT_ID", method: "context", confidence: "high", pattern: /\bpatient\s+(?:id|no|number|ref(?:erence)?)\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi, maskGroup: 1, context: "Patient ID: <value>" },

  // Layer B — contextual education identifiers.
  { id: "student-id", category: "STUDENT_ID", method: "context", confidence: "high", pattern: /\b(?:student|admission)\s+(?:id|no|number)\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi, maskGroup: 1, context: "Student ID: <value>" },

  // Layer A — technical & infrastructure.
  { id: "cidr", category: "CIDR", method: "pattern", confidence: "high", pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:3[0-2]|[12]?\d)\b/g, context: "CIDR network range" },
  { id: "ipv4", category: "IPV4", method: "pattern", confidence: "high", pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, context: "IPv4 address" },
  { id: "host-id", category: "HOST", method: "pattern", confidence: "high", pattern: /\b(?:WS|SRV|WKSTN|SERVER)[-_]?[A-Z0-9]{2,}\b/g, context: "WS-/SRV- host identifier" },
  { id: "infra-equipment", category: "INFRA", method: "pattern", confidence: "medium", pattern: /\b(?:PUMP|PLC|SCADA|HMI|VSD|VFD|MOTOR|VALVE|TANK|COMP|GEN|RTU|FTC|FICT|MTR|FLT)[-:]?[A-Z0-9]{1,}(?:[-][A-Z0-9]+)*\b/g, context: "equipment/asset identifier (OT profile masks)" },
  { id: "serial-number", category: "SERIAL", method: "context", confidence: "medium", pattern: /\bserial\s*(?:no|number|#)?\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi, maskGroup: 1, context: "serial: <value>" },

  // Layer B — business-confidential contextual identifiers.
  { id: "customer-id", category: "CUSTOMER_ID", method: "context", confidence: "low", pattern: /\b(?:customer|client|supplier|vendor)\s+(?:id|no|number|code)\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/gi, maskGroup: 1, context: "Customer/Supplier ID: <value>" },
  { id: "project-code", category: "PROJECT_CODE", method: "context", confidence: "low", pattern: /\b(?:project|engagement)\s+(?:code|id|no|number)\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/gi, maskGroup: 1, context: "Project code: <value>" },
  { id: "case-id", category: "CASE_ID", method: "context", confidence: "low", pattern: /\b(?:case|matter)\s+(?:id|no|number|reference|ref)\s*[-:]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/gi, maskGroup: 1, context: "Case/Matter ID: <value>" },
  { id: "salary", category: "SALARY", method: "context", confidence: "medium", pattern: /\b(?:salary|annual\s+salary|gross\s+pay|base\s+pay|payroll|remuneration|compensation)\s*[-:]?\s*(USD|EUR|GBP|UGX|KES|NGN|ZAR|CAD|AUD|\$|€|£|USh)\s?([\d,]+(?:\.\d{2})?)\b/gi, maskGroup: 0, context: "salary/payroll <currency amount>" },
];

export const DETECTOR_BY_ID = Object.fromEntries(DETECTORS.map((d) => [d.id, d]));