# ClipShield

**A privacy-first workspace for analysing sensitive workplace text with hybrid AI.**

ClipShield helps people use generative AI with support tickets, incident reports, maintenance notes, and vendor documents. It detects sensitive values in the browser, lets the user review and redact them, then makes the inference route and result visible.

> Sanitize first. Route consciously. Make privacy observable.

ClipShield is a hackathon project, not a certified security product. Detection is best-effort pattern matching; users must review redactions and generated recommendations.

## Live demo and source

- **Live workspace:** [clipshield.base44.app](https://clipshield.base44.app/)
- **Public source repository:** [github.com/TommLawrence/clip-shield](https://github.com/TommLawrence/clip-shield)
- **Hackathon:** [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)
- **On-device testing:** [Judge and developer test guide](./docs/ON_DEVICE_TESTING.md)

The live workspace is open to visitors during the judging period. Access is temporary and may be removed after judging.

## How it works

1. **Add text.** Paste a workplace record or choose one of the synthetic demonstration scenarios.
2. **Inspect locally.** Deterministic detectors identify common personal, credential, and infrastructure values. An explainable exposure score helps prioritize review.
3. **Review redactions.** Edit findings, add custom terms, or select text the detectors missed. Inspect the sanitized preview before inference.
4. **Choose a route.** Run locally when Gemini Nano is available, require local-only execution, or explicitly send sanitized text to the cloud.
5. **Check the result.** The routing inspector reports the requested mode, actual source returned by Firebase AI Logic, model, latency, fallback, and masked count.

| Mode | Behavior |
| --- | --- |
| Local-first (**PREFER_ON_DEVICE**) | Tries on-device Gemini Nano; cloud fallback is possible only with consent. |
| Local-only (**ONLY_ON_DEVICE**) | Stays on the device and fails closed if the model is unavailable. |
| Deep cloud (**ONLY_IN_CLOUD**) | Sends sanitized text after confirmation and requests a structured report. |
| Cloud-preferred (**PREFER_IN_CLOUD**) | Prefers cloud inference and can use the device if cloud inference is unavailable. |

## Privacy model and limitations

- Detection, redaction, and the placeholder-to-value vault run in the browser.
- Raw input, detected original values, and the rehydration mapping are not sent to Firebase AI Logic.
- Cloud inference receives only the sanitized text, after the relevant confirmation.
- The vault and workspace content remain in the current tab. Reset controls clear the input and mappings.
- In the hosted app, only the theme preference is saved in browser storage. The service worker caches static app resources, not workspace content or inference requests.
- Routing telemetry is an in-memory allow-list of mode, source, latency, counts, and outcome fields. It excludes prompt text, raw values, and tokens.

Pattern matching can miss sensitive data or flag harmless text. Model output can be incorrect or incomplete. A person must verify both the redactions and recommendations. ClipShield does not provide operational approval or replace site procedures.

## Architecture

ClipShield is a JavaScript application built with React 19, TanStack Start, and Vite. The hosted app runs on Base44's Cloudflare Workers runtime.

| Area | Implementation |
| --- | --- |
| Redaction and exposure scoring | Browser-side deterministic logic in src/lib/redaction.js and src/lib/risk-engine.js |
| Firebase setup | Firebase AI Logic and App Check in src/lib/firebase.js |
| Inference routing | Modes, prompts, model calls, structured output, and error handling in src/lib/hybrid-modes.js and src/lib/hybrid-ai.js |
| Workspace state | src/hooks/useClipShield.js |
| Reusable interface | src/components/clipshield/ |
| Routes | TanStack file routes in src/routes/ |
| Shared detector package | packages/privacy-core/ |
| Tests | Node test suites in tests/ |

Firebase AI Logic performs inference. App Check uses ReCaptchaEnterpriseProvider with a reCAPTCHA Enterprise web key registered for the Firebase web app. The app does not use a Firebase service-account credential.

## On-device requirements

Web on-device inference uses Firebase AI Logic's hybrid web support and Chrome's built-in Prompt API. It needs Chrome desktop version 139 or newer and a device that meets Chrome's current built-in model requirements. The model may need to download before first use.

See the [Firebase hybrid web guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started), [Chrome built-in AI requirements](https://developer.chrome.com/docs/ai/get-started), and the [step-by-step test guide](./docs/ON_DEVICE_TESTING.md).

A cloud success does not verify the on-device path. Confirm an actual ON_DEVICE response in the routing inspector before claiming a local inference pass.

## Configuration

For the hosted app, set these values in **Base44 Dashboard → Secrets**. The server reads them with base44:runtime; a plain Vite process does not automatically read the dashboard secret store.

Required Firebase web configuration:

~~~text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
FIREBASE_APP_CHECK_SITE_KEY
~~~

Optional values:

~~~text
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_WEB_CONFIG
FIREBASE_APPCHECK_DEBUG_TOKEN
~~~

FIREBASE_WEB_CONFIG can provide the Firebase web config and App Check fields as one JSON value instead of individual values. Firebase web configuration and the reCAPTCHA site key are public identifiers delivered to the browser; never put a service-account key or other server credential in the client bundle.

Keep FIREBASE_APPCHECK_DEBUG_TOKEN unset in production. .env.example documents variable names only. Do not commit .env.local or production values.

## Local development

1. Install Node.js and npm, then install locked dependencies:

   ~~~bash
   npm ci
   ~~~

2. Authenticate and link this checkout with the [Base44 CLI](https://docs.db.com/developers/references/cli/get-started/overview.md). Set the Firebase values in the linked app's **Dashboard → Secrets**.
3. Start the app with the Base44 runtime:

   ~~~bash
   npx base44 dev
   ~~~

4. For local App Check, temporarily allow the hostname localhost in the reCAPTCHA Enterprise key's allowed domains. Do not use a debug token. See the [on-device testing guide](./docs/ON_DEVICE_TESTING.md).

Useful checks:

~~~bash
npm run lint
npm test
npx base44 build
~~~

## Verification status

- **Hosted cloud path:** verified on the published Base44 site. App Check reported the Enterprise provider active, the site key loaded, and debug mode inactive; a cloud inference returned IN_CLOUD.
- **On-device path:** not yet verified on a qualifying device. Follow the test guide and confirm the response inspector reports ON_DEVICE.

## Hackathon disclosure

The privacy workflow, exposure scoring, demonstration scenarios, hybrid inference, workspace, tests, and project documentation were developed for this submission. The project also uses the Base44 TanStack Start starter and open-source dependencies listed in package.json.

## License

ClipShield is licensed under the [Apache License 2.0](./LICENSE).
