import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Install affordance for the Progressive Web App. Captures the browser's
 * `beforeinstallprompt` event and exposes an "Install app" action. When the
 * prompt is unavailable (unsupported browser, already installed, or the app
 * is already running standalone) the button is not shown; the How it Works
 * page carries the fallback installation instructions for those cases.
 */
export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
    if (standalone) setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !promptEvent) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-white/[0.08] bg-white/[0.03]"
      title="Install ClipShield as a standalone app"
      onClick={async () => {
        promptEvent.prompt();
        try {
          await promptEvent.userChoice;
        } finally {
          setPromptEvent(null);
        }
      }}
    >
      <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}