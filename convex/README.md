# ClipShield — Convex backend (migration)

This folder holds the Convex backend for ClipShield, migrated from the
in-memory / Firebase-only runtime. It is **standalone**: these files run on a
Convex deployment, not on the Base44 app server, and are deployed with the
Convex CLI.

## Tables (privacy contract)

| Table | Stored | Never stored |
|---|---|---|
| `reports` | sanitized model output (`text`/`json`) + routing metadata | raw input, sanitized text sent, rehydration mapping |
| `glossaries` | user-supplied custom redaction term lists | detected PII from documents |
| `telemetry` | allow-listed routing/latency metrics (mode, latency, counts…) | prompt text, tokens, mapping entries |

Records are keyed by an anonymous, in-memory `sessionId` generated per tab
load (never written to `localStorage` or any browser storage), with an optional
`userId` slot for when Firebase anonymous auth is added.

## Deploy

1. Create a Convex project: `npx convex dev` (from the repo root). This also
   generates `convex/_generated/`.
2. Push the schema + functions: `npx convex dev` (or `npx convex deploy`).
3. Set the deployment URL as a Base44 secret named `CONVEX_DEPLOYMENT_URL`
   (Settings → Secrets). The app reads it via `GET /api/convex-config`.
4. Until that secret is set, every Convex call in the app no-ops and the
   in-memory / Firebase flow runs unchanged.

## App wiring

The app talks to Convex through `src/lib/convex-client.js` (imperative
`ConvexReactClient`, string function references — no generated `api` import
required). Writes fire alongside the existing flow:

- `reports:save` — after a successful inference.
- `glossaries:sync` — when a custom redaction term is added or removed.
- `telemetry:record` — alongside each local `recordEvent`.
