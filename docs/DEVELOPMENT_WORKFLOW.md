# Development workflow and project provenance

This note explains how ClipShield was scaffolded, developed, tested, and made available for judging. It is intended to make the project easier to review and reproduce; the workflow itself is not a separate hackathon scoring category.

## Project and runtime

ClipShield began from Base44's TanStack Start starter. The application is a JavaScript/React project, hosted by Base44 on its Cloudflare Workers runtime. Firebase AI Logic is the inference layer: `src/lib/hybrid-ai.js` imports `getGenerativeModel` from `firebase/ai`, creates hybrid models, and calls `generateContent`. Firebase App Check is initialized in `src/lib/firebase.js` with `ReCaptchaEnterpriseProvider`.

The app provides four inference modes. It sanitizes and reviews text in the browser before inference, and the routing inspector shows the route reported by Firebase AI Logic. Cloud inference has been verified on the published site. On-device Gemini Nano remains a separate hardware-dependent check; a cloud result must not be described as an on-device result.

## How the development pieces fit together

1. **Base44 scaffold and hosted app:** Base44 supplied the initial TanStack Start project structure and hosts the published app. Base44's builder and Dashboard → Secrets configure the deployed app.
2. **Local development:** The authenticated Base44 CLI links the local checkout to the Base44 development workflow. Run `npx base44 dev` to use the Base44 runtime locally. Firebase project configuration used by this app is supplied through the Base44 secret store for the hosted runtime; local App Check testing also requires the local hostname to be allowed by the reCAPTCHA Enterprise key. The temporary localhost setup is documented in [the on-device test guide](./ON_DEVICE_TESTING.md).
3. **Firebase setup and verification:** The Firebase project and web app provide Firebase AI Logic and App Check. The Firebase CLI was used for project access and configuration checks; it is not required at runtime. No service-account key is needed or included in this repository.
4. **Keeping sources aligned:** Changes intended for the submission were reconciled between the local checkout and the Base44 project before publishing. The public Git repository is the reviewable source snapshot; Base44 remains the hosted deployment. Before a release, compare the local source with the Base44 project, run the checks below, publish the intended source to Base44, then commit and push that same reviewed source to GitHub. Do not commit generated build output or secret values.
5. **Public review:** The repository is public and licensed under Apache 2.0. Its source includes the Firebase AI Logic import and runtime calls, setup instructions, and a [judge-facing on-device test guide](./ON_DEVICE_TESTING.md). The deployed workspace is available at [clipshield.base44.app](https://clipshield.base44.app/).

## Reproduce the checks

From a checkout with Node.js/npm and access to the Base44 development app:

```bash
npm ci
npx base44 dev
```

The app's Firebase web configuration and reCAPTCHA Enterprise site key must be configured in Base44 Dashboard → Secrets. Do not put production secrets in source control. For the device-specific Gemini Nano check, follow [ON_DEVICE_TESTING.md](./ON_DEVICE_TESTING.md) on a supported Chrome desktop and verify that the routing inspector reports `ON_DEVICE`.

The repository's available static and automated checks are:

```bash
npm run lint
npm test
npx base44 build
```

## Submission-period work and disclosure

The submission-period work includes ClipShield's privacy workflow, deterministic redaction and exposure scoring, synthetic workplace scenarios, Firebase AI Logic hybrid routing and visible route reporting, the workspace experience, automated checks, and judge-facing documentation. The project uses Base44's TanStack Start starter and the open-source dependencies declared in `package.json`. The hackathon submission description should separately summarize this work and explain the value ClipShield adds, as required by the contest rules.

The hosted cloud route has been verified. The on-device route is not claimed as verified until it has completed successfully on a qualifying device. This distinction is reflected in the README and the test guide.
