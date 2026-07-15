import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallButton({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className={"text-xs text-muted-foreground " + (className ?? "")}>
        App instalado — abra pelo ícone na tela inicial.
      </div>
    );
  }

  const handleClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    if (isIOS()) {
      setShowIOS(true);
      return;
    }
    setShowIOS(true);
  };

  return (
    <div className={className}>
      <Button onClick={handleClick} size="sm" className="gap-2">
        <Download className="h-4 w-4" /> Instalar no dispositivo
      </Button>
      {showIOS && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          {isIOS() ? (
            <div className="flex items-start gap-2">
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <strong className="text-foreground">iOS:</strong> toque em{" "}
                <em>Compartilhar</em> e depois em <em>Adicionar à Tela de Início</em>.
              </div>
            </div>
          ) : (
            <div>
              Se o botão não abrir o instalador, use o menu do navegador (⋮) e
              escolha <em>Instalar aplicativo</em> ou <em>Adicionar à tela inicial</em>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}