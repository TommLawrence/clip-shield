import { useState } from "react";
import { ShieldCheck, X, Info } from "lucide-react";

/**
 * Temporary judging-access notice shown on the workspace.
 *
 * The workspace is intentionally open (no sign-in required) for the
 * #BuildHybridAI 2026 judging window so judges and users can try ClipShield
 * frictionlessly. This banner makes that state obvious on arrival and is
 * dismissible. Dismiss state is kept in memory only (no storage) to preserve
 * the workspace's no-persistence privacy promise.
 */
export default function DemoAccessBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative mx-auto mt-4 w-full max-w-[1440px] px-5 lg:px-8">
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/[0.07] px-4 py-3 text-[12.5px] text-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
        <p className="min-w-0 flex-1 leading-relaxed">
          <span className="font-semibold text-primary">Judging demo — you&rsquo;re signed in automatically.</span>{" "}
          No account is needed to use ClipShield during the #BuildHybridAI 2026 judging window. This open
          access is temporary and will be removed after the final day of judging or once the judges reach
          their decision. <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Your input and the redaction vault never leave this tab.</span>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          className="ml-1 -mr-1 mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}