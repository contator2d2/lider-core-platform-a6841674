import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Brain,
  CheckCircle2,
  Compass,
  Gauge,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

type Step = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  cta?: { label: string; to: string };
};

const TOUR_STEPS: Step[] = [
  {
    key: "welcome",
    title: "Bem-vindo ao Líder C.O.R.E.",
    description:
      "Este é o sistema operacional da sua liderança. Vamos rodar 4 pontos essenciais em ~2 minutos.",
    icon: Sparkles,
  },
  {
    key: "profile",
    title: "Confirme seus dados",
    description: "Isso ajuda o Coach de IA a personalizar suas orientações.",
    icon: Brain,
  },
  {
    key: "consciencia",
    title: "Consciência — sua base",
    description:
      "No módulo 'Meu perfil' você faz o diagnóstico de estilo e recebe seus pontos fortes e riscos.",
    icon: Brain,
    cta: { label: "Abrir Meu perfil", to: "/app/consciencia" },
  },
  {
    key: "organizacao",
    title: "Organização — sua operação",
    description:
      "Cadastre rituais (1:1, semanal, mensal), delegações e decisões. É a base do seu score.",
    icon: Users,
    cta: { label: "Abrir Organização", to: "/app/organization" },
  },
  {
    key: "resultado",
    title: "Resultado — seus indicadores",
    description:
      "Registre indicadores chave. O Coach cruza com rituais e delegações para gerar insights.",
    icon: Target,
    cta: { label: "Abrir Indicadores", to: "/app/indicators" },
  },
  {
    key: "evolucao",
    title: "Evolução — seu crescimento",
    description:
      "Acompanhe seu score, PDIs e feedbacks. Converse com o IA Coach quando quiser.",
    icon: Gauge,
    cta: { label: "Falar com IA Coach", to: "/app/ai" },
  },
  {
    key: "done",
    title: "Tudo pronto",
    description:
      "Você já pode começar. Se quiser rever esta introdução, o menu 'Ajuda' tem tudo.",
    icon: CheckCircle2,
  },
];

const LOCAL_SKIP_KEY = "lc_onboarding_skipped";

export function LeaderOnboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.onboardingCompletedAt) return;
    const skipped = typeof window !== "undefined" && window.sessionStorage.getItem(LOCAL_SKIP_KEY);
    if (skipped) return;
    setFullName(user.fullName ?? "");
    setJobTitle(user.jobTitle ?? "");
    setWhatsapp(user.whatsapp ?? "");
    setOpen(true);
  }, [user]);

  const step = TOUR_STEPS[idx];
  const total = TOUR_STEPS.length;
  const isLast = idx === total - 1;
  const Icon = step.icon;

  const percent = useMemo(() => Math.round(((idx + 1) / total) * 100), [idx, total]);

  const persist = async (payload: {
    step?: string;
    completed?: boolean;
    profile?: Record<string, string>;
  }) => {
    await api("/auth/me/onboarding", { method: "POST", body: payload });
  };

  const skip = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(LOCAL_SKIP_KEY, "1");
    setOpen(false);
    void persist({ step: "skipped" }).catch(() => null);
  };

  const next = async () => {
    setSaving(true);
    try {
      if (step.key === "profile") {
        await persist({
          step: step.key,
          profile: {
            fullName: fullName.trim(),
            jobTitle: jobTitle.trim(),
            whatsapp: whatsapp.trim(),
          },
        });
      } else {
        await persist({ step: step.key });
      }
      if (isLast) {
        await persist({ step: "done", completed: true });
        await refresh();
        toast.success("Onboarding concluído!");
        setOpen(false);
      } else {
        setIdx((i) => i + 1);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const goCta = () => {
    if (!step.cta) return;
    setOpen(false);
    navigate({ to: step.cta.to });
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <button
          onClick={skip}
          aria-label="Pular"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="px-8 pb-6 pt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Passo {idx + 1} de {total}
              </div>
              <h2 className="font-display text-2xl">{step.title}</h2>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>

          {step.key === "profile" && (
            <div className="mt-5 grid gap-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo / Função</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex.: Líder de célula, Pastor, Gerente…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp (com DDD)</Label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
            </div>
          )}

          {step.key === "welcome" && (
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {[
                { i: Brain, t: "Consciência" },
                { i: Users, t: "Organização" },
                { i: Target, t: "Resultado" },
                { i: Gauge, t: "Evolução" },
                { i: MessageSquare, t: "1:1s" },
                { i: Compass, t: "Feedbacks" },
              ].map(({ i: I, t }) => (
                <div
                  key={t}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2"
                >
                  <I className="h-3.5 w-3.5 text-accent" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-background/40 px-8 py-4">
          <button
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            {step.cta && (
              <Button variant="outline" size="sm" onClick={goCta}>
                {step.cta.label}
              </Button>
            )}
            <Button size="sm" onClick={next} disabled={saving}>
              {saving ? "Salvando…" : isLast ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}