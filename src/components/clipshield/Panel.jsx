import { cn } from "@/lib/utils";

export default function Panel({ className, children, ...props }) {
  return (
    <section className={cn("cs-panel min-w-0 p-4 sm:p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeading({ step, title, hint, right, icon: Icon }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {step ? (
        <span className="cs-mono grid h-6 min-w-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 text-[10px] text-muted-foreground">
          {step}
        </span>
      ) : Icon ? (
        <span className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] text-muted-foreground">
          <Icon className="h-3 w-3" />
        </span>
      ) : null}
      <h2 className="font-heading text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
      {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}