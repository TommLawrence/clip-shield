import { Eye, EyeOff, FileLock2, Highlighter, KeyRound, Lock, Mail, Network, Phone, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  EMAIL: Mail,
  PHONE: Phone,
  IPV4: Network,
  SECRET: KeyRound,
  BEARER: KeyRound,
  JWT: KeyRound,
  AWS_KEY: KeyRound,
  PRIVATE_KEY: Lock,
  CUSTOM: Tag,
  MANUAL: Highlighter,
};

const SEVERITY_DOT = {
  critical: "bg-rose-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-sky-400",
};

export default function FindingsList({ findings, onToggle }) {
  if (!findings.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
        <FileLock2 className="mx-auto h-5 w-5 text-muted-foreground/60" />
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          No sensitive patterns detected yet. Inspect the content, or add a custom term below.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-[290px] space-y-1.5 overflow-y-auto pr-1" aria-label="Detected sensitive entities">
      {findings.map((finding) => {
        const Icon = ICONS[finding.category] || Lock;
        return (
          <li key={finding.id}>
            <button
              type="button"
              onClick={() => onToggle(finding.id)}
              aria-pressed={finding.include}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                finding.include
                  ? "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14]"
                  : "border-white/[0.04] bg-transparent opacity-55 hover:opacity-80",
              )}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[finding.severity])} aria-hidden="true" />
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11.5px] text-foreground/90" title={finding.value}>
                  {finding.value}
                </span>
                <span className="block text-[10.5px] text-muted-foreground">
                  {finding.label} · {finding.severity}
                </span>
              </span>
              <span className="cs-token shrink-0">{finding.token}</span>
              <span className="shrink-0 text-muted-foreground">
                {finding.include ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}