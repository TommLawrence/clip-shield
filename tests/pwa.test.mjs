/**
 * PWA verification: manifest validity (name, short_name, standalone display,
 * theme/background colours, maskable + 192/512 icons) and the service worker's
 * privacy-safe caching contract (static same-origin only; never /api or
 * cross-origin / Firebase AI).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "..", "..");

test("manifest has required PWA fields and maskable icons", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "public", "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(typeof manifest.name === "string" && manifest.name.length > 0);
  assert.ok(typeof manifest.short_name === "string" && manifest.short_name.length > 0);
  assert.ok(manifest.background_color && manifest.theme_color);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(manifest.icons.some((i) => i.purpose && i.purpose.includes("maskable")));
  assert.ok(manifest.icons.some((i) => i.sizes && /192/.test(i.sizes)));
  assert.ok(manifest.icons.some((i) => i.sizes && /512/.test(i.sizes)));
});

test("service worker caches only static same-origin resources", () => {
  const sw = readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.ok(sw.includes("addEventListener"));
  // Must explicitly bypass API routes and all cross-origin requests.
  assert.ok(sw.includes("url.pathname.startsWith(\"/api/\")"));
  assert.ok(sw.includes("url.origin !== self.location.origin"));
  assert.ok(sw.includes("request.method !== \"GET\""));
  // App-shell (navigation) fallback is cached; nothing else sensitive is.
  assert.ok(sw.includes('request.mode === "navigate"'));
  // The worker must not cache Firebase / AI / auth tokens: confirm the
  // cross-origin bypass is the only caching boundary and no googleapis
  // caching path exists.
  assert.ok(!/caches?\.(put|add)\(.*(googleapis|firebase)/.test(sw));
});

test("icons exist and are valid SVG", () => {
  for (const file of ["shield.svg", "shield-maskable.svg"]) {
    const svg = readFileSync(path.join(root, "public", "icons", file), "utf8");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("viewBox=\"0 0 512 512\""));
  }
});