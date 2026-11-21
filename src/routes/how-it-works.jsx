import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  Globe2,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import AppShell from "@/components/clipshield/AppShell";
import Panel, { SectionHeading } from "@/components/clipshield/Panel";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How ClipShield works — privacy model and hybrid routing" },
      {
        name: "description",
        content:
          "ClipShield's privacy airlock, Firebase AI Logic inference modes, browser requirements and honest verification status.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const MODES = [
  {
    mode: "PREFER_ON_DEVICE",
    label: "Local-first hybrid brief",
    icon: Cpu,
    behavior:
      "Attempts Gemini Nano 4 on this device. Firebase AI Logic may fall back to the cloud model; the app asks for that consent first and reports whichever route was used.",
    model: "On-device model → gemini-4-hydrogen fallback",
  },
  {
    mode: "ONLY_ON_DEVICE",
    label: "Local-only private brief",
    icon: ShieldCheck,
    behavior:
      "Fails closed when the on-device model is unavailable or cannot download. No cloud request exists in this code path.",
    model: "On-device only",
  },
  {
    mode: "ONLY_IN_CLOUD",
    label: "Deep cloud synthesis",
    icon: Cloud,
    behavior:
      "Sends the sanitized payload to the cloud model after explicit confirmation and returns a structured report with findings, risk matrix and actions.",
    model: "gemini-4-hydrogen",
  },
];

function Row({ icon: Icon, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-3.5 w-3.5 text-primary/90" />
      </span>
      <div>
        <p className="text-[12.5px] font-medium text-foreground">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function HowItWorksPage() {
  return (
    <AppShell status={<span className="hidden" />}>
      <div className="mx-auto w-full max-w-[1080px] px-5 py-10 lg:px-8">
        <p className="cs-mono text-primary">Product and privacy model</p>
        <h1 className="mt-3 max-w-2xl font-heading text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[42px]">
          A privacy gateway between your sensitive text and a generative model.
        </h1>
        <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          ClipShield is a focused workspace, not a certified security platform. It reduces what leaves your browser, asks
          before anything does, and shows you where inference actually ran. Detection is deterministic pattern matching and
          always needs a human review.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            {
              step: "01",
              title: "Sanitize in the browser",
              body: "Emails, phone numbers, IP addresses, API keys, bearer tokens, JWTs, private keys and your own custom terms are replaced with reversible placeholders such as [EMAIL_1].",
            },
            {
              step: "02",
              title: "Route consciously",
              body: "Choose local-first, local-only or deep cloud. Local-first requires consent for cloud fallback; local-only can never escalate.",
            },
            {
              step: "03",
              title: "Observe the outcome",
              body: "The inspector reports the mode requested, the inference source the SDK returned, latency, fallback status and how many entities were masked.",
            },
          ].map((item) => (
            <Panel key={item.step} className="p-5">
              <span className="cs-mono text-[10px] text-primary">{item.step}</span>
              <h2 className="mt-2 font-heading text-[15px] font-semibold text-foreground">{item.title}</h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{item.body}</p>
            </Panel>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Panel>
            <SectionHeading step="A" title="Inference modes" hint="Firebase AI Logic" />
            <div className="mt-4 space-y-2.5">
              {MODES.map((mode) => (
                <div key={mode.mode} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-2">
                    <mode.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[12.5px] font-medium text-foreground">{mode.label}</span>
                    <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                      {mode.mode}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{mode.behavior}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">{mode.model}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading step="B" title="What is never stored" />
            <div className="mt-4 space-y-3.5">
              <Row icon={Lock} title="Raw input">
                Exists only in the textarea and in memory for the current tab. It is never sent to Firebase AI Logic and
                never written to a database, local storage or a log.
              </Row>
              <Row icon={Database} title="Rehydration vault">
                The placeholder-to-value mapping lives in React state. Clearing mappings or resetting the workspace drops it.
              </Row>
              <Row icon={Globe2} title="Telemetry">
                Only allow-listed numbers and enums (mode, source, latency, counts) are recorded, in memory. Prompt content is
                never accepted by the telemetry module.
              </Row>
              <Row icon={Cloud} title="Cloud payload">
                The sanitized string with placeholders, nothing else. No mapping, no findings, no original values.
              </Row>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <SectionHeading step="C" title="Requirements for on-device inference" />
            <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" /> Chrome desktop version 139 or newer,
                with the built-in Prompt API available.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" /> Sufficient disk space and memory for
                the Gemini Nano model; the first run may download several gigabytes.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" /> A Firebase project with AI Logic and
                App Check (reCAPTCHA Enterprise) enabled for this origin.
              </li>
              <li className="flex gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /> Other browsers and mobile Chrome
                cannot run on-device inference; use deep cloud synthesis there.
              </li>
            </ul>
          </Panel>

          <Panel>
            <SectionHeading step="D" title="Verification status" hint="Honest by design" />
            <div className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                <span className="text-emerald-300">Verified:</span> detection, placeholder construction, overlap handling,
                custom terms, manual masks, exposure scoring and the guarantee that sanitized output contains no detected
                original value — covered by unit tests in the repository.
              </p>
              <p>
                <span className="text-amber-300">Not yet verified here:</span> live on-device and cloud inference. This
                deployment has no Firebase project configuration attached, so no inference request has been executed. The
                routing inspector will show an explicit configuration message rather than a simulated result.
              </p>
              <p>
                <span className="text-sky-300">By design:</span> the inference source is only ever the value returned in{" "}
                <span className="font-mono text-[11px]">result.response.inferenceSource</span>. ClipShield never invents{" "}
                <span className="font-mono text-[11px]">ON_DEVICE</span>.
              </p>
            </div>
          </Panel>
        </div>

        <Panel className="mt-4">
          <SectionHeading step="E" title="Language coverage" hint="Built for mixed-language teams" />
          <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
            The airlock targets structured identifiers — email addresses, phone numbers in international formats, IP
            addresses, credentials and tokens — which behave the same in every language. Personal names, project codenames
            and internal jargon in any script are handled with custom sensitive terms, so a Japanese incident report and a
            German vendor contract follow the same review flow. Generated briefs follow the language of the sanitized input.
          </p>
        </Panel>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open the workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-[11.5px] text-muted-foreground">
            Built for Google #BuildHybridAI 2026 by an independent solo developer.
          </span>
        </div>
      </div>
    </AppShell>
  );
}