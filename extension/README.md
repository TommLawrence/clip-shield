# ClipShield Companion — Chrome MV3 Extension

A Manifest V3 browser extension that protects selected webpage text with the
**same** local deterministic redaction engine as the ClipShield web workspace,
*before* you paste it into any AI tool. No cloud inference runs inside the
extension — the hosted web workspace remains the cloud inference destination.

## What it does

1. **Toolbar action** opens a Chrome Side Panel.
2. **Right-click → "Protect selection with ClipShield"** on any selected text
   sends only that explicit selection to the side panel.
3. The side panel runs the shared `@clipshield/privacy-core` redaction engine
   (the exact same source the web app uses) and shows an **editable preview**
   with detected categories.
4. Optional **local semantic inspection** via Chrome's built-in Prompt API
   (`window.LanguageModel`) when available; when it is not, the deterministic
   workflow continues and the panel says so.
5. **Copy Sanitized Text** — a user-initiated action only.
6. **Open ClipShield Web Workspace** — opens the hosted app for cloud inference.

## What it does NOT do

- Never silently collects all webpage text or monitors browsing activity.
- No `host_permissions`, no content scripts, no `scripting` permission.
- No automatic clipboard writes, hidden transmission, remote code execution
  or background page scraping.
- Raw selected content and the rehydration mapping live only in memory and are
  never written to `chrome.storage`.
- No Firebase / cloud inference inside the extension.

## Permissions

The extension declares `sidePanel`, `contextMenus`, `clipboardRead`, and
`clipboardWrite`. Clipboard access is used only after the user clicks **Paste**
or **Copy sanitized text**. Selection text is provided by Chrome's context-menu
API (`info.selectionText`), so the extension needs no access to page contents.

## Build

Use desktop Chrome 114 or newer for the side-panel extension. The optional
Prompt API semantic scan requires supported desktop Chrome 139+ hardware; the
deterministic redaction and review flow does not require Gemini Nano.

```bash
cd extension
npm install
npm run build      # outputs extension/dist/
```

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/dist/`
4. Select text on any page → right-click → **Protect selection with ClipShield**.

## Shared engine

Both the extension and the web workspace import from
`packages/privacy-core/` (alias `@privacy-core` in the extension's vite
config). There is exactly one redaction implementation across the product.
