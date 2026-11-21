import pluginJs from "@eslint/js";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: ["node_modules", "**/dist/**", ".wrangler", ".tanstack", "src/routeTree.gen.ts", "src/components/ui/**"],
  },
  pluginJs.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      // base44 / getAccessToken / createClientFromRequest are injected by the
      // Base44 platform tooling (Vite plugin + runtime) — not missing imports.
      globals: {
        ...globals.browser,
        ...globals.node,
        base44: "readonly",
        getAccessToken: "readonly",
        createClientFromRequest: "readonly",
      },
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": pluginReactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Chrome extension service worker + side panel use the chrome.* MV3 APIs.
    files: ["extension/**/*.js"],
    languageOptions: {
      globals: { chrome: "readonly" },
    },
  },
];