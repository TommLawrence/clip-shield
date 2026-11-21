# @clipshield/privacy-core

Framework-independent, deterministic privacy and OT-safety engine shared by the
ClipShield web workspace and the Chrome companion extension.

No network access, no framework dependencies, no persistence. The redaction
engine is the **only** place raw sensitive values exist; callers receive the
sanitized text plus an in-memory rehydration mapping that must never be persisted.

## Modules

- `redaction.js` — deterministic detection, masking, rehydration and the
  Infrastructure/OT sensitivity profile.
- `risk-engine.js` — explainable, bounded exposure scoring from findings only.
- `placeholders.js` — placeholder pattern utilities.
- `ot-guardrail.js` — deterministic operational-technology safety detection
  (interlock bypasses, control overrides, repeated alarms, temperature/vibration
  trends, exposed PLC/SCADA/HMI identifiers, OT network ranges, remote-access
  credentials, unverified firmware references). Detection only — it never issues
  instructions to disable, bypass, reset or override safety mechanisms.

## Consumption

Both consumers import the source directly (no build step):

```js
// web workspace (via the src/lib compatibility shims)
import { detectFindings } from "@/lib/redaction";

// extension
import { detectFindings } from "@clipshield/privacy-core/redaction";
```

## Profiles

`detectFindings(text, { profile })` accepts `"standard"` (default — masks personal
information, credentials, service accounts, host IDs, IPs and network ranges) or
`"ot"` (additionally auto-masks infrastructure/equipment identifiers such as
`PUMP-L2-04`). In the standard profile, infrastructure findings are still
detected and shown as reviewable items with `include: false`, so operational
context is preserved until the user chooses to mask them.
