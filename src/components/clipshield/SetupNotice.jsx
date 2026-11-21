import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";

const REQUIRED_NAMES = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_APP_ID",
];

export default function SetupNotice({ missing = [] }) {
  return (
    <Panel className="border-amber-400/20 bg-amber-400/[0.03]">
      <SectionHeading
        step="!"
        title="Connect your Firebase project to enable inference"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10.5px] text-amber-300">
            <KeyRound className="h-3 w-3" /> configuration required
          </span>
        }
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <p>
            The local privacy airlock, exposure scoring and redaction preview all work without Firebase. Genuine hybrid
            inference needs this app connected to a Firebase project with AI Logic and App Check enabled.
          </p>
          <ol className="space-y-1.5">
            <li>
              1. Firebase console → <span className="text-foreground/90">Project settings → Your apps → Web app</span> →
              copy the SDK configuration.
            </li>
            <li>
              2. App settings → <span className="text-foreground/90">Secrets</span> → add the values below (plus the App
              Check reCAPTCHA site key).
            </li>
            <li>
              3. App Check → register the web app with <span className="text-foreground/90">reCAPTCHA Enterprise</span>, then
              set <span className="font-mono text-[11px]">FIREBASE_APP_CHECK_SITE_KEY</span>.
            </li>
            <li>4. Reload this page and run a mode — the routing inspector will show the real inference source.</li>
          </ol>
          <p className="flex items-start gap-1.5 text-[11px]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
            The configuration is read on the server per request and only project identifiers reach the browser. No service
            account or private key is used.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
          <p className="cs-mono text-[9.5px] text-muted-foreground">Required secrets</p>
          <ul className="mt-2 space-y-1">
            {REQUIRED_NAMES.map((name) => (
              <li key={name} className="flex items-center justify-between gap-2 font-mono text-[11px] text-foreground/85">
                {name}
                <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  {missing.includes(name) ? "missing" : "set"}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 pt-1 font-mono text-[11px] text-foreground/85">
              FIREBASE_APP_CHECK_SITE_KEY
              <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">optional</span>
            </li>
          </ul>
          <a
            href="https://firebase.google.com/docs/ai-logic/hybrid/web/get-started"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
          >
            Firebase hybrid web setup <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Panel>
  );
}