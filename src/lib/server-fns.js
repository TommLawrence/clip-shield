import { createServerFn } from "@tanstack/react-start";
import { readFirebaseConfig } from "./firebase-config.server.js";

/**
 * Public Firebase web configuration for the browser client.
 * Read-only, contains no secrets — only project identifiers.
 */
export const getFirebaseConfig = createServerFn({ method: "GET" }).handler(async () => {
  return readFirebaseConfig();
});