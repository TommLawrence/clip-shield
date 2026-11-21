import { secrets } from "base44:runtime";

const REQUIRED = [
  ["FIREBASE_API_KEY", "apiKey"],
  ["FIREBASE_AUTH_DOMAIN", "authDomain"],
  ["FIREBASE_PROJECT_ID", "projectId"],
  ["FIREBASE_APP_ID", "appId"],
];

function read(name) {
  const value = secrets.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Returns the public Firebase web configuration for the browser client.
 * These values identify the Firebase project; they are not private secrets.
 */
export function readFirebaseConfig() {
  const fromJson = read("FIREBASE_WEB_CONFIG");
  let parsed = null;
  if (fromJson) {
    try {
      parsed = JSON.parse(fromJson);
    } catch {
      parsed = null;
    }
  }

  const config = {
    apiKey: parsed?.apiKey || read("FIREBASE_API_KEY"),
    authDomain: parsed?.authDomain || read("FIREBASE_AUTH_DOMAIN"),
    projectId: parsed?.projectId || read("FIREBASE_PROJECT_ID"),
    storageBucket: parsed?.storageBucket || read("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: parsed?.messagingSenderId || read("FIREBASE_MESSAGING_SENDER_ID"),
    appId: parsed?.appId || read("FIREBASE_APP_ID"),
  };

  const missing = REQUIRED.filter(([, key]) => !config[key]).map(([name]) => name);

  // reCAPTCHA Enterprise is the only supported App Check provider here.
  // reCAPTCHA v3 is deprecated for new projects, so we never select it.
  const appCheckSiteKey = parsed?.appCheckSiteKey || read("FIREBASE_APP_CHECK_SITE_KEY");
  // Optional debug token for preview/dev. When set, the browser uses it
  // directly instead of printing a new one for manual whitelisting.
  const debugToken = parsed?.appCheckDebugToken || read("FIREBASE_APPCHECK_DEBUG_TOKEN");

  return {
    configured: missing.length === 0,
    missing,
    config: missing.length === 0 ? config : null,
    appCheckSiteKey,
    appCheckProvider: "enterprise",
    debugToken,
    cloudModel: "gemini-3.8-flash",
  };
}