import { secrets } from "base44:runtime";

/**
 * Returns the Convex deployment configuration for the browser client.
 * The deployment URL is public (it identifies the Convex project); the app
 * reads it exactly like the Firebase web config, and no private keys are
 * exposed. When the secret is absent, `configured` is false and the app's
 * Convex layer no-ops, leaving the in-memory / Firebase flow unchanged.
 */
export function readConvexConfig() {
  const raw = secrets.get("CONVEX_DEPLOYMENT_URL");
  const url = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return { configured: Boolean(url), url };
}