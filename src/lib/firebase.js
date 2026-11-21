/**
 * Firebase initialization for ClipShield.
 *
 * The Firebase web configuration is public by design; it is served by a server
 * function so no keys live in the repository. Nothing here runs at page mount:
 * the app only initializes Firebase after an explicit inference action.
 *
 * App Check always uses ReCaptchaEnterpriseProvider (reCAPTCHA v3 is deprecated).
 * A debug token (from the FIREBASE_APPCHECK_DEBUG_TOKEN secret, or enabled via
 * the diagnostics HUD) is honored only on non-production loads.
 */
import { getApps, initializeApp } from "firebase/app";
import { getAI, GoogleAIBackend } from "firebase/ai";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

let state = {
  app: null,
  ai: null,
  appCheck: null,
  appCheckStatus: "not-initialized",
  appCheckError: null,
  diagnostics: null,
};

export function getFirebaseState() {
  return { ...state, initialized: Boolean(state.ai) };
}

export function isFirebaseReady() {
  return Boolean(state.ai);
}

/**
 * Initialize Firebase, App Check and AI Logic. Idempotent — a second call with
 * a different config is ignored (the first initialized app wins), which keeps
 * App Check a singleton across repeated inference actions.
 */
export function initializeFirebaseServices(config) {
  if (!config?.apiKey || !config?.projectId || !config?.appId) {
    const error = new Error("Firebase web configuration is incomplete.");
    error.code = "firebase-unconfigured";
    throw error;
  }

  if (state.ai) return getFirebaseState();

  const hostname =
    typeof window !== "undefined" && window.location ? window.location.hostname : "unknown";

  const app = getApps().length ? getApps()[0] : initializeApp(config);

  const siteKeyLoaded = Boolean(config.appCheckSiteKey);
  let debugTokenActive = false;

  // App Check must be initialized before any AI Logic request.
  if (siteKeyLoaded) {
    try {
      if (typeof self !== "undefined") {
        // An explicit debug token secret wins. Otherwise, a debug-mode flag
        // from the HUD sets the placeholder `true` so the SDK prints a fresh
        // token to the DevTools console for whitelisting. Never overwrite a
        // token that was already set (e.g. by the diagnostics toggle before reload).
        if (config.debugToken) {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = config.debugToken;
        } else if (config.debugMode && !self.FIREBASE_APPCHECK_DEBUG_TOKEN) {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        debugTokenActive = Boolean(self.FIREBASE_APPCHECK_DEBUG_TOKEN);
      }

      const provider = new ReCaptchaEnterpriseProvider(config.appCheckSiteKey);

      state.appCheck = initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      state.appCheckStatus = "initialized";
    } catch (error) {
      state.appCheckStatus = "failed";
      state.appCheckError = error?.message || "App Check could not be initialized.";
    }
  } else {
    state.appCheckStatus = "not-configured";
  }

  state.app = app;
  state.ai = getAI(app, { backend: new GoogleAIBackend() });
  state.diagnostics = {
    provider: "ReCaptchaEnterpriseProvider",
    siteKeyLoaded,
    debugTokenActive,
    hostname,
    status: state.appCheckStatus,
    error: state.appCheckError,
  };
  return getFirebaseState();
}

export function getFirebaseAI() {
  if (!state.ai) {
    const error = new Error("Firebase AI Logic is not initialized yet.");
    error.code = "firebase-unconfigured";
    throw error;
  }
  return state.ai;
}