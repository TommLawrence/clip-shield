import { Link } from "@tanstack/react-router";
import { ShieldHalf } from "lucide-react";
import DemoAccessBanner from "@/components/clipshield/DemoAccessBanner";

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
      activeProps={{ className: "bg-white/[0.08] text-foreground" }}
    >
      {children}
    </Link>
  );
}

export default function AppShell({ children, status }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] cs-grid-texture" />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/12 ring-1 ring-inset ring-primary/30">
              <ShieldHalf className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
            </span>
            <span className="leading-none">
              <span className="block font-heading text-[15px] font-semibold tracking-[-0.01em] text-foreground">ClipShield</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">Hybrid privacy workspace</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/">Workspace</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {status}
            <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground sm:inline">
              Chrome desktop 139+
            </span>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <DemoAccessBanner />
        {children}
      </main>

      <footer className="mt-16 border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-5 py-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>ClipShield — #BuildHybridAI 2026 · Firebase AI Logic hybrid inference</p>
          <p className="text-muted-foreground/80">Detection is best-effort and always requires human review. Not a certified security product.</p>
        </div>
      </footer>
    </div>
  );
}