# ClipShield — Landing Page

A self-contained, static marketing landing page for ClipShield. **No build step,
no dependencies, no frameworks.** Open `index.html` in a browser, or drop the
whole `landing/` folder onto any static host (Netlify, GitHub Pages, Cloudflare
Pages, Vercel, S3).

This folder is intentionally separate from the ClipShield workspace app so it
can be exported and deployed as its own project.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup, meta, content. CTA buttons link to the live app. |
| `styles.css` | All styling. Mirrors the workspace palette (obsidian + emerald/indigo). |
| `script.js` | Progressive enhancement only — the page is fully usable without it. |

## Run locally

Just open `index.html`. No server required. (To test `target="_blank"` app
links during judging, the live workspace is at
`https://clipshield.base44.app/`.)

## Deploy

1. Copy this entire `landing/` folder.
2. Upload its contents to any static host. The entry point is `index.html`.

## Where the buttons go

Every "Take me in" / "Open ClipShield" button opens the live workspace
(`https://clipshield.base44.app/`) in a new tab. The URL is defined once as
`APP_URL` in `script.js` and also appears as the plain `href` in the HTML as a
no-JavaScript fallback.

## Interactions

Sticky header, smooth anchor nav with a mobile hamburger, one-shot scroll
reveals, hover lifts, a native `<details>` FAQ, a pure-CSS product mockup with
gently bobbing cards, wired CTAs, and a living footer with back-to-top. All
animations disable under `prefers-reduced-motion`, and the page is fully
visible with JavaScript disabled.
