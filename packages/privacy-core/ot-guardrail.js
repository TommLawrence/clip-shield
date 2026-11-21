/**
 * ClipShield — privacy-core: OT / critical-infrastructure safety guardrail.
 *
 * Deterministic detection of operational-technology and safety indicators in
 * sanitized-ready text. This module performs DETECTION ONLY. It never issues,
 * suggests or implies instructions to disable, bypass, reset or override any
 * safety interlock, protective control or alarm, and never represents a
 * generated recommendation as permission to operate equipment.
 *
 * Findings here are surfaced alongside the AI-generated analysis for human
 * verification against approved site procedures. They are not masked by
 * default — useful operational observations (temperatures, vibration readings,
 * event descriptions, time sequences) are preserved so analysts keep context.
 */

export const OT_TYPES = {
  INTERLOCK_BYPASS: { id: "INTERLOCK_BYPASS", label: "Safety interlock bypass", severity: "critical", requiresHumanVerification: true },
  CONTROL_OVERRIDE: { id: "CONTROL_OVERRIDE", label: "Protective-control override", severity: "high", requiresHumanVerification: true },
  REPEATED_ALARM: { id: "REPEATED_ALARM", label: "Repeated equipment alarm", severity: "high", requiresHumanVerification: true },
  TEMP_TREND: { id: "TEMP_TREND", label: "Unusual temperature trend", severity: "medium", requiresHumanVerification: false },
  VIBRATION_TREND: { id: "VIBRATION_TREND", label: "Vibration trend / alarm", severity: "medium", requiresHumanVerification: false },
  EXPOSED_OT_ID: { id: "EXPOSED_OT_ID", label: "Exposed PLC / SCADA / HMI identifier", severity: "medium", requiresHumanVerification: false },
  OT_NETWORK: { id: "OT_NETWORK", label: "OT network range exposed", severity: "high", requiresHumanVerification: false },
  REMOTE_ACCESS_CRED: { id: "REMOTE_ACCESS_CRED", label: "Remote-access credential exposed", severity: "high", requiresHumanVerification: true },
  FIRMWARE_REF: { id: "FIRMWARE_REF", label: "Unverified firmware / vendor reference", severity: "medium", requiresHumanVerification: true },
};

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const RULES = [
  {
    type: "INTERLOCK_BYPASS",
    pattern: /\b(?:bypass(?:ed|ing)?\s+(?:the\s+)?interlock|interlock\s+bypass|defeat(?:ed|ing)?\s+(?:the\s+)?(?:safety|interlock)|safety\s+bypass|jump(?:ed|ing)?\s+(?:the\s+)?interlock)\b/gi,
    description: "A safety interlock appears to have been bypassed. This is a safety-critical event that must be verified against approved site procedures before any action.",
  },
  {
    type: "CONTROL_OVERRIDE",
    pattern: /\b(?:manual\s+override|protective[-\s]control\s+override|overrode\s+(?:the\s+)?(?:control|limit|trip)|forced\s+(?:the\s+)?(?:trip|limit|control)|disabled\s+(?:the\s+)?(?:trip|limit|protection))\b/gi,
    description: "A protective control or trip appears to have been overridden. Confirm the override was authorized and that the protection has since been restored.",
  },
  {
    type: "REPEATED_ALARM",
    pattern: /\b(?:alarm\s+(?:triggered|fired|activated)\s+(?:twice|three\s+times|\d+\s+times)|triggered\s+(?:twice|three\s+times|\d+\s+times)|repeated\s+alarm|alarm\s+repeated)\b/gi,
    description: "An equipment alarm repeated during the event. Repeated alarms can indicate an underlying fault that should be investigated, not silenced.",
  },
  {
    type: "TEMP_TREND",
    pattern: /\b(?:temperature\s+(?:climbed|rose|spiked|increased|rose\s+rapidly)|(?:climbed|rose|spiked)\s+from\s+\d+\s*°?C\s+to\s+\d+\s*°?C|overheat(?:ing|ed))\b/gi,
    description: "An unusual temperature trend was recorded. Preserve the readings for engineering review; do not reset limits to suppress the trend.",
  },
  {
    type: "VIBRATION_TREND",
    pattern: /\b(?:vibration\s+(?:alarm|analysis|high|exceeded|trend)|vibration\s+(?:alarm\s+)?(?:VIB[-_]?\d+)?\s*triggered)\b/gi,
    description: "A vibration reading or vibration alarm was recorded. Keep the readings for the scheduled vibration analysis.",
  },
  {
    type: "EXPOSED_OT_ID",
    pattern: /\b(?:PLC\s+(?:gateway|controller)|SCADA(?:\s+(?:system|server|gateway))?|HMI(?:\s+(?:panel|terminal))?|modbus\/tcp)\b/gi,
    description: "An OT system identifier (PLC, SCADA, HMI, or protocol) is exposed in the record. Consider masking it under the Infrastructure/OT profile before sharing widely.",
  },
  {
    type: "OT_NETWORK",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:3[0-2]|[12]?\d)\b|\bmodbus\b|\bport\s*502\b|\b(?:192\.168|10\.|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/gi,
    description: "An OT network range, modbus reference or control-system port is exposed. OT networks should not be reachable from general IT or remote paths.",
  },
  {
    type: "REMOTE_ACCESS_CRED",
    pattern: /\b(?:remote[-\s]access\s+credential|plant\s+VPN|remote\s+support\s+(?:credential|password|session)|VPN\s+credential)\b/gi,
    description: "A remote-access or plant-VPN credential is referenced. Rotate exposed remote-access credentials and review who holds remote access to the OT network.",
  },
  {
    type: "FIRMWARE_REF",
    pattern: /\b(?:firmware\s+version|vendor\s+bulletin|VB[-_]?\d{4}[-_]?\d+|unverified\s+firmware)\b/gi,
    description: "A firmware version or vendor security bulletin is referenced but not verified against the current approved baseline.",
  },
];

/**
 * Detect OT / critical-infrastructure safety indicators in `text`.
 * Returns deterministic findings (never masked, never prescriptive) intended
 * to be displayed alongside the AI analysis and verified by a human.
 */
export function detectOtFindings(text) {
  if (!text) return [];
  const seen = new Set();
  const findings = [];

  RULES.forEach((rule) => {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      const key = `${rule.type}:${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = OT_TYPES[rule.type];
      findings.push({
        id: key,
        type: rule.type,
        label: meta.label,
        severity: meta.severity,
        requiresHumanVerification: meta.requiresHumanVerification,
        title: meta.label,
        description: rule.description,
        evidence: match[0],
        start,
        end,
      });
    }
  });

  findings.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) || a.start - b.start);
  return findings;
}

/**
 * The safety disclaimer shown next to OT findings. Detection only — never a
 * permission to operate, and never an instruction to alter a safety mechanism.
 */
export const OT_DISCLAIMER =
  "These are deterministic safety observations, not operating instructions. Never disable, bypass, reset or override a safety interlock or protective control based on generated output. Verify every safety-critical item against approved site procedures.";