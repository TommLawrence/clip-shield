import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dark/light theme toggle. Renders an intermediate state on the server and
 * until hydration so the SSR markup matches the first client render (no
 * hydration mismatch). Toggling only flips the `light` class on <html> via
 * next-themes — it does not remount the app or touch any workspace state, so
 * in-memory content (raw input, findings, the rehydration vault) is preserved.
 * Only the theme preference itself is persisted (localStorage, this origin).
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle colour theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}