const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

# ClipShield

**A privacy-first hybrid AI workspace for sensitive workplace information.**
Built for Google **#BuildHybridAI 2026** by an independent solo developer.

ClipShield sits between the person and the model. It masks sensitive values in the browser, shows exactly what would be sent, lets you choose where inference runs, and then reports where it *actually* ran.

> Sanitize first. Route consciously. Make privacy observable.

Detection is best-effort pattern matching and always needs human review. ClipShield is not a certified security or zero-trust product.

> ## ⚠️ For judges and visitors — temporary open access (read this first)
>
> **You do not need to create an account or sign in to use ClipShield right now.**
> For the duration of the **#BuildHybridAI 2026** judging window the workspace at
> `https://clipshield.db.app/` is open — judges and visitors are taken straight
> into the working tool from the landing page's "Take me in" button.
>
> This **auto-access is temporary.** It will be removed on the **final day of
> judging** or as soon as the judges have made their final decision — whichever
> comes first. After that, a normal sign-in will be required, exactly as the
> landing page and workspace describe.
>
> Nothing about this changes the privacy model: your pasted text and the
> redaction vault still never leave your browser tab.
>
> **The standalone landing page lives in [`./landing/`](./landing).** It is a
> self-contained static site (no build, no dependencies) that can be exported and
> deployed as its own project separate from the workspace app.

---

## 1. What it does

| Step | What happens | Where |
| --- | --- | --- |
| 01 Input | Paste a ticket, incident report, maintenance log or vendor document, or load one of four synthetic scenarios | Browser |
| 02 Inspect | Deterministic detection of emails, international phone numbers, IPv4 addresses, API keys, bearer tokens, JWTs, GitHub/cloud credentials, private-key blocks, custom terms and manual selections. Explainable exposure score | Browser only |
| 03 Redact | Editable preview with reversible placeholders (`[EMAIL_1]`, `[PHONE_1]`, `[SECRET_1]`), per-finding toggles, custom masks and a memory-only rehydration vault | Browser only |
| 04 Route | Local-first (`PREFER_ON_DEVICE`), local-only (`ONLY_ON_DEVICE`), or deep cloud (`ONLY_IN_CLOUD`) | Firebase AI Logic |
| 05 Observe | Requested mode, actual `inferenceSource`, latency, fallback status, masked count, model, structured-output status | Firebase AI Logic response |
| 06 Read | Short brief, or a structured report with executive summary, security findings, risk matrix, actions, operational considerations and items requiring human verification | Browser |

Session controls clear the input, the mapping, or the entire workspace at any time. Nothing is persisted.

---

## 2. Architecture

```
src/lib/redaction.js       deterministic detection + placeholder mapping (browser only)
src/lib/risk-engine.js     explainable exposure scoring from findings (no model involved)
src/lib/firebase.js        Firebase app, App Check and AI Logic initialization
src/lib/hybrid-ai.js       inference execution, model configuration, error normalization
src/lib/hybrid-modes.js    mode metadata, prompts, JSON schema, capability probe
src/lib/telemetry.js       allow-listed, in-memory, content-free session metrics
src/lib/scenarios.js       four synthetic demonstration scenarios
src/lib/server-fns.js      server function returning the public Firebase web config
src/lib/firebase-config.server.js  reads the config from app secrets (server only)
src/hooks/useClipShield.js workspace state machine
src/components/clipshield/ reusable workspace UI
src/routes/index.jsx       the workspace
src/routes/how-it-works.jsx privacy model, requirements and verification status
tests/redaction.test.mjs   17 tests covering detection, redaction and security boundaries
```

The AI layer only ever receives the **sanitized** string. `useClipShield` builds it with `buildRedaction(raw, findings)` and runs a defensive `containsRawValues()` check before calling `runInference`. The raw input, the finding values and the rehydration mapping are never arguments to any Firebase call.

### Runtime note (important for judges)

The brief specified Next.js App Router. This submission runs on the Base44 platform, whose supported runtime is **TanStack Start** (React 19, Vite, Cloudflare Workers) with file-based routes and server functions. The module boundaries requested in the brief are preserved exactly (`redaction`, `risk-engine`, `hybrid-ai`, `firebase`, `telemetry`, reusable components, route pages); only the framework adapter differs. TypeScript was likewise delivered as plain ES modules, because this workspace's runtime and toolchain are JavaScript-only. Firebase AI Logic, App Check and the hybrid inference API usage are unchanged.

---

## 3. Privacy safeguards

- **Local airlock.** All detection and replacement happens synchronously in the browser before any request.
- **Sanitized-only inference.** The prompt builder receives the sanitized string; a safety check rejects a payload that still contains a masked original value.
- **Memory-only vault.** The placeholder-to-value mapping lives in React state. Clearing mappings or resetting the workspace drops it.
- **No persistence.** There are no Firestore writes, no `localStorage`, no `sessionStorage`, and no server-side storage of content in this build. `firestore.rules` ships deny-all in case sanitized-report persistence is added later.
- **Content-free telemetry.** `src/lib/telemetry.js` accepts an allow-list of numeric/enum fields only; prompt text, raw values and tokens are dropped. Nothing is transmitted.
- **Explicit restoration only.** Original values are never re-inserted into generated reports. “Copy with originals” is a deliberate click and happens in the browser.
- **Consent gates.** Local-first requires consent for possible cloud fallback; deep cloud requires explicit confirmation. Local-only has no cloud code path.

---

## 4. Inference modes

| Mode | Firebase AI Logic | Cloud model | Behaviour |
| --- | --- | --- | --- |
| Local-first hybrid brief | `InferenceMode.PREFER_ON_DEVICE` | `gemini-4-hydrogen` via `inCloudParams` | Tries Gemini Nano 4 on the device; may fall back to cloud. Consent required, fallback reported. |
| Local-only private brief | `InferenceMode.ONLY_ON_DEVICE` | none | Fails closed with a clear message when the device model is unavailable. Never escalates. |
| Deep cloud synthesis | `InferenceMode.ONLY_IN_CLOUD` | `gemini-4-hydrogen` | Structured JSON report after explicit confirmation. |

Model instances are created with `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })` from `getAI(app, { backend: new GoogleAIBackend() })`. On-device preparation calls `model.initializeDeviceModel(onProgress)` **only** from a user action (“Prepare local AI” or a run button) — never on page mount. Download progress is displayed.

`inferenceSource` is read from `result.response.inferenceSource` and normalized for display (`on_device` → `ON_DEVICE`, `in_cloud` → `IN_CLOUD`). If the SDK does not return a source, the inspector says so; no value is fabricated.

---

## 5. Setup

1. **Firebase project** with **AI Logic** enabled (Gemini Developer API) and a registered **web app**.
2. **App Check** registered for the web app with **reCAPTCHA Enterprise** (or reCAPTCHA v3).
3. Add these values as app secrets (App settings → Secrets):

```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
FIREBASE_STORAGE_BUCKET          # optional
FIREBASE_MESSAGING_SENDER_ID     # optional
FIREBASE_APP_CHECK_SITE_KEY      # reCAPTCHA site key used by App Check
FIREBASE_APP_CHECK_PROVIDER      # optional: "enterprise" (default) or "v3"
```

Alternatively set a single `FIREBASE_WEB_CONFIG` secret containing the JSON object from the Firebase console.

The configuration is read per request by a server function and only project identifiers reach the browser. No service account, private key or admin credential is used or required.

`.env.example` documents the same names for local experimentation. Never commit real values.

### Chrome requirements for on-device inference

- **Chrome desktop 139 or newer** (other browsers and mobile Chrome cannot run on-device inference).
- The Chrome **Prompt API** must be available; Gemini Nano may need to be downloaded (first run can take several gigabytes).
- Sufficient disk space and memory for the model.
- Firebase AI Logic hybrid web support requires SDK **v12.5.0+** (this project installs `firebase@^12.19.0`, which includes `initializeDeviceModel`, `InferenceMode` and `inferenceSource`).

When on-device inference is unavailable, the app shows the readiness reason and offers deep cloud synthesis instead. “Force on-device only” locks the workspace to `ONLY_ON_DEVICE` and disables cloud modes — it is not an offline-mode claim.

---

## 6. Verification

```bash
npm test        # 17 deterministic tests: detection, redaction, scoring, telemetry, prompts
npm run build   # production build
```

### Verified

- Email, `+256`-style international and local phone numbers, IPv4, API keys, AWS keys, GitHub tokens, bearer tokens, JWTs and private-key blocks are detected and replaced.
- Overlapping matches are resolved without corrupting the output.
- Custom terms and manual selections become masks; excluding a finding keeps that value and lowers the score.
- The same value reuses one placeholder; rehydration round-trips exactly.
- Sanitized output contains no masked original value, and `containsRawValues` catches a deliberate leak.
- Prompts built from sanitized text contain no finding values.
- Exposure scoring is deterministic, explainable and bounded to 0–100.
- Telemetry drops prompt content and raw values.

### Not verified in this deployment

- **No Firebase project configuration is attached to this workspace**, so no live `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE` or `ONLY_IN_CLOUD` request has been executed here. The app reports the missing configuration instead of simulating a result.
- Genuine on-device inference must be tested on supported Chrome desktop hardware with Gemini Nano available. A passing cloud run is not evidence of on-device execution.
- App Check behaviour against your project's reCAPTCHA registration is untested until the secrets above are set.

---

## 7. Hackathon scope and pre-existing material

**Created during the submission period (November 2026):** the privacy airlock, exposure engine, scenario data, hybrid inference layer, workspace UI, setup/verification pages, tests and documentation.

**Pre-existing starter material:** the Base44 TanStack Start application starter (routing, build configuration, UI primitives, auth components) and the open-source dependencies listed in `package.json`. No ClipShield feature existed before this build. No production credentials, personal data or App Check debug tokens are included.

Not implemented by design: a companion Chrome extension, multi-agent workflows, RAG, analytics infrastructure, persistence and access-control systems.

---

## 8. License

Apache-2.0. See [LICENSE](./LICENSE).
