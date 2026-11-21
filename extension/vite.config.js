import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * The extension is independently buildable. It bundles the SAME privacy-core
 * source as the web workspace (alias @privacy-core → packages/privacy-core),
 * so there is exactly one redaction implementation across the product.
 *
 * Output: extension/dist/ — load it unpacked from chrome://extensions.
 * A relative base keeps asset URLs valid under chrome-extension://.
 */
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@privacy-core": here("../packages/privacy-core"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        background: here("src/background.js"),
        sidepanel: here("src/sidepanel/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});