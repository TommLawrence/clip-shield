# On-device inference test guide

This guide is for judges using the hosted demo and for developers running the
app locally. A cloud result is not evidence of on-device inference.

## Hardware and browser

Use Chrome desktop version 139 or newer on Windows 10/11, macOS 13+, Linux,
or a supported Chromebook Plus device. Chrome's built-in model requires either:

- At least 16 GB of system RAM and 4 or more CPU cores; or
- A GPU with more than 4 GB of VRAM.

Chrome also needs at least 22 GB of free space on the volume containing its
profile. The initial model download requires an unmetered connection. Model
availability can vary by device and Chrome version.

Check Chrome's current model status at `chrome://on-device-internals`. If the
Prompt API is unavailable, check the Firebase setup guidance for the current
Chrome flag and model download steps. For current requirements, see the
[Firebase hybrid web guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started)
and [Chrome built-in AI hardware requirements](https://developer.chrome.com/docs/ai/get-started).

## Judges: test the hosted demo

1. Open [clipshield.base44.app](https://clipshield.base44.app/) in supported
   desktop Chrome. No project credentials are needed for the hosted demo.
2. Load one of the synthetic scenarios and select **Inspect & sanitize**.
   Review the findings and sanitized preview before running inference.
3. In **Inference controls**, choose **Local-only private brief** (or enable
   **Force on-device only**). This mode fails closed if the local model cannot
   run; it cannot fall back to cloud inference.
4. Select **Prepare local AI**. Keep the browser open while Chrome obtains and
   prepares the model. The app displays download progress.
5. Select **Run Local-only private brief** after preparation finishes.
6. In **Hybrid routing inspector**, confirm the actual inference source is
   `ON_DEVICE`, the selected mode is `ONLY_ON_DEVICE`, and fallback is `No`.
   The source must come from the Firebase AI Logic response; do not treat
   “Chrome Prompt API detected” or “On-device model ready” alone as a successful
   inference.
7. Confirm **App Check diagnostics** reports the Enterprise provider active,
   the site key loaded, and debug mode inactive.

If model preparation remains unavailable on a qualifying device, update Chrome,
restart it, and inspect `chrome://on-device-internals` for model or broker
errors. Firebase's current setup guide describes enabling the Prompt API flag
and starting the initial download when Chrome requires those steps.

Use only synthetic sample content. If the device reports the model unavailable,
that result is honest: choose a qualifying device and try again. You can still
test the cloud mode separately, but label that result `IN_CLOUD`.

## Developers: test a local checkout

1. Use a machine that meets the browser and hardware requirements above.
2. Link the checkout to the existing Base44 app and run it through the Base44
   CLI so the server configuration is available:

   ~~~bash
   npx base44 dev
   ~~~

3. Set the Firebase web configuration and reCAPTCHA Enterprise site key in
   **Base44 Dashboard → Secrets**. Do not add a service-account key.
4. For App Check on `localhost`, temporarily add the hostname `localhost` to
   the reCAPTCHA Enterprise key's allowed domains. Keep the same site key
   registered for the Firebase web app. Remove the local hostname after the
   test if it should not remain allow-listed.
5. Open the local URL printed by the CLI in supported desktop Chrome and follow
   the judge steps above.

Do not set an App Check debug token for this test. If local App Check fails but
the hosted demo works, first check the local hostname allow-list and that the
local app is receiving the intended Firebase config.

## What to report

Record the Chrome version, device class, test origin, selected mode, actual
inference source, fallback status, and any readiness error. A valid local-only
pass requires a completed response with `ON_DEVICE`; capability detection or
model preparation by itself is not a pass.
