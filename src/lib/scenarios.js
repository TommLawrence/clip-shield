/**
 * Synthetic, clearly fictional demonstration scenarios.
 * No real company, customer, employer or production data is used anywhere.
 */

export const SCENARIOS = [
  {
    id: "it-ticket",
    name: "IT support ticket",
    tag: "Support",
    description: "Employee contact details, an internal host and a shared service password.",
    text: `Ticket #INC-4471 — Submitted 14 Nov 2026, 09:12 EAT
Reporter: Amina Nakato <amina.nakato@northwind-fictional.example>
Callback: +256 772 555 014
Site: Kampala HQ, Floor 3 — workstation WS-1142
Internal host: 10.24.8.51

Summary: Outlook keeps prompting for credentials after the 11 Nov password rotation.

Details: Since the rotation, Outlook on WS-1142 loops the sign-in prompt. I cleared the Windows credential cache and re-added the profile; no change. The device can reach the mail gateway at 10.24.8.12, but TLS handshakes to 10.24.8.51 time out. Browser access to mail works fine.

Temporary workaround: I signed in with the shared service account svc-mailops using the password MailOps!2026-Nov and it worked, so the mailbox itself is reachable.

Requested: Please re-issue the device certificate and confirm whether the 10.24.8.x range is still routed through the old proxy.`,
  },
  {
    id: "security-incident",
    name: "Security incident",
    tag: "Incident",
    description: "Fake cloud keys, a bearer token and internal payment infrastructure details.",
    text: `Incident SEC-2026-0912 — Unauthorized API access suspected
Detected: 16 Nov 2026 02:41 UTC by anomaly rule "off-hours key use"

Observed in edge logs:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdmMtc2Nhbm5lciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMTY4MDAwMH0.7Xk2pQ9rTb4mZs1vYc8Ld3Nh6Wq0Rf5Gj2Kp9Xt4Bv1
  X-Api-Key: example_api_value_0123456789
  AWS_ACCESS_KEY_ID=AKIA3F7KQ2ZP5M9XW1LD
  AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY

Source range: 203.0.113.42 (fictional TEST-NET-3)
Target service: payments-api.internal.northwind-fictional.example on 10.60.4.18:8443
Key owner: Devon Mensah <devon.mensah@northwind-fictional.example>, mobile +1 415 555 0182

Notes: The key pair was created 12 Aug 2026 for the vendor integration sandbox. It should have been revoked on 30 Sep. Rotation ticket OPS-2214 was closed without evidence. No customer records appear in the sampled payloads (200 events reviewed), but the key can read /v1/payouts.`,
  },
  {
    id: "ot-maintenance",
    name: "OT maintenance",
    tag: "Operations",
    description: "Equipment identifiers, operator contacts and an exposed plant VPN credential.",
    text: `Maintenance log OT-8817 — Water treatment plant, Line 2
Asset: PUMP-L2-04 (Grundfos, serial FICT-88213-A)
Operator: Grace Achieng <grace.achieng@northwind-fictional.example> · +254 712 555 903
Shift: 17 Nov 2026, 22:00–06:00 EAT
PLC gateway: 192.168.44.7 (modbus/tcp 502)

Observation: Bearing temperature on PUMP-L2-04 climbed from 61°C to 88°C over 40 minutes. Vibration alarm VIB-2 triggered twice. The operator bypassed the interlock for 12 minutes to finish the backwash cycle, then restored it.

Action taken: Reduced duty to 60%, greased the bearing housing, scheduled vibration analysis for 19 Nov. Vendor field engineer (Kelvin Otieno, +254 733 555 118) advised replacing the coupling at the next planned outage.

Follow-up: Verify the 192.168.44.0/24 gateway firmware version (currently 4.2.1) against vendor bulletin VB-2026-11. The plant VPN credential used for remote support was OT-VPN-2026!Kampala — please rotate.`,
  },
  {
    id: "vendor-procurement",
    name: "Vendor procurement",
    tag: "Commercial",
    description: "Confidential commercial figures, business contacts and a pasted integration key.",
    text: `Vendor assessment — Meridian Analytics Ltd (fictional)
Prepared by: Priya Raman <priya.raman@northwind-fictional.example> · +44 20 7946 0812
Review date: 12 Nov 2026

Commercial terms (confidential):
  Annual licence: USD 184,000
  Implementation: USD 42,500 one-off
  Discount offered: 12% if signed before 31 Dec 2026
  Payment terms: net 45, quarterly in advance
  Target internal budget cap: USD 210,000

Contacts: sales@meridian-analytics.example, account lead Tomas Berg (tomas.berg@meridian-analytics.example, +46 8 555 019 22)

Notes: Vendor proposes a shared analytics tenant in eu-west-1 with data residency in Ireland. Their security questionnaire returned 2 open items on the sub-processor list and retention. Contract draft includes an API integration using the key ms_live_4b8e1c9d7f2a6e3b5c0d8f1a — that key was pasted into email and must be treated as exposed.`,
  },
];

export const DEMO_CUSTOM_TERMS = ["Meridian Analytics", "PUMP-L2-04", "svc-mailops"];