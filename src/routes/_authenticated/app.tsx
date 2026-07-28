import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/features";
import {
  Brain,
  Calendar,
  Compass,
  Gauge,
  Home,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Target,
  Users,
  Zap,
  BookOpen,
  Building,
  HelpCircle,
  UsersRound,
  Activity,
  Radar,
  Mic,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LeaderOnboarding } from "@/components/onboarding/LeaderOnboarding";
import { TeamHealthPill } from "@/components/team/TeamHealthPill";
import { useCurrentOrg } from "@/lib/use-current-org";
import { api } from "@/lib/api";
import { VoiceCapture, type VoiceIntent } from "@/components/voice/VoiceCapture";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  component: AppShell,
});

// module = which feature module gates the item. "*" = always show.
const nav = [
  { to: "/app", label: "Hoje", icon: Home, section: "Consciência", module: "consciencia" },
  { to: "/app/consciencia", label: "Meu perfil", icon: Brain, section: "Consciência", module: "consciencia" },
  { to: "/app/team", label: "Minha equipe", icon: Users, section: "Consciência", module: "consciencia" },
  { to: "/app/organization", label: "Organização", icon: Building, section: "Organização", module: "organizacao" },
  { to: "/app/one-on-ones", label: "1:1s", icon: MessageSquare, section: "Organização", module: "organizacao" },
  { to: "/app/indicators", label: "Indicadores", icon: Target, section: "Resultado", module: "resultado" },
  { to: "/app/results", label: "Gestão à vista", icon: Activity, section: "Resultado", module: "resultado" },
  { to: "/app/evolution", label: "Evolução", icon: Gauge, section: "Evolução", module: "evolucao" },
  { to: "/app/pdis", label: "PDIs", icon: BookOpen, section: "Evolução", module: "evolucao" },
  { to: "/app/360", label: "360 leve", icon: UsersRound, section: "Evolução", module: "evolucao" },
  { to: "/app/feedbacks", label: "Feedbacks", icon: Compass, section: "Evolução", module: "evolucao" },
  { to: "/app/ai", label: "IA Coach", icon: Sparkles, section: "Evolução", module: "evolucao" },
  { to: "/app/coach", label: "Coach preditivo", icon: Radar, section: "Evolução", module: "evolucao" },
  { to: "/app/help", label: "Ajuda", icon: HelpCircle, section: "Ajuda", module: "*" },
] as const;

const mobileNav = [
  { to: "/app", label: "Início", icon: Home, module: "consciencia" },
  { to: "/app/organization/agenda", label: "Agenda", icon: Calendar, module: "organizacao" },
  { to: "/app/team", label: "Equipe", icon: Users, module: "consciencia" },
  { to: "/app/ai", label: "Ações", icon: Zap, module: "evolucao" },
  { to: "/app/help", label: "Mais", icon: MoreHorizontal, module: "*" },
] as const;

const conscienciaOnlyNav = [
  { to: "/app/consciencia", label: "Início", icon: Home, section: "Consciência", module: "consciencia" },
  { to: "/app/team", label: "Minha equipe", icon: Users, section: "Consciência", module: "consciencia" },
  { to: "/app/help", label: "Ajuda", icon: HelpCircle, section: "Ajuda", module: "*" },
] as const;

const conscienciaOnlyMobileNav = [
  { to: "/app/consciencia", label: "Início", icon: Home, module: "consciencia" },
  { to: "/app/consciencia/agenda", label: "Agenda", icon: Calendar, module: "consciencia" },
  { to: "/app/team", label: "Equipe", icon: Users, module: "consciencia" },
  { to: "/app/consciencia/pdi", label: "PDI", icon: Zap, module: "consciencia" },
  { to: "/app/help", label: "Mais", icon: MoreHorizontal, module: "*" },
] as const;

type ShellNavItem = {
  to: (typeof nav)[number]["to"] | (typeof conscienciaOnlyNav)[number]["to"];
  label: string;
  icon: (typeof nav)[number]["icon"];
  section: string;
  module: string;
};

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();
  const { orgId } = useCurrentOrg();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const featuresQ = useFeatures();
  const roles = featuresQ.data?.roles ?? [];
  const isAdmin = roles.includes("super_admin") || roles.includes("neo_admin");
  const enabledModules = (() => {
    if (isAdmin) return null; // null = show all
    // While features are loading OR the request failed, don't hide anything.
    // Otherwise a transient 401/CORS blip would wipe the whole navigation.
    if (!featuresQ.data) return null;
    const set = new Set<string>();
    const feats = featuresQ.data?.features ?? {};
    for (const key of Object.keys(feats)) {
      const anyOn = Object.values(feats[key] ?? {}).some(Boolean);
      if (anyOn) set.add(key.split(".")[0]);
    }
    return set;
  })();
  const isModuleAllowed = (mod: string) =>
    mod === "*" || !enabledModules || enabledModules.has(mod);

  const conscienciaOnly = !!enabledModules && enabledModules.size === 1 && enabledModules.has("consciencia");
  const baseNav = conscienciaOnly ? conscienciaOnlyNav : nav;
  const baseMobileNav = conscienciaOnly ? conscienciaOnlyMobileNav : mobileNav;
  const quickActionTo = conscienciaOnly ? "/app/consciencia/agenda" : "/app/organization/delegations";

  const visibleNav = baseNav.filter((n) => isModuleAllowed(n.module));
  const visibleMobileNav = baseMobileNav.filter((n) => isModuleAllowed(n.module));

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    toast.success("Até logo.");
    navigate({ to: "/auth", replace: true });
  };

  const handleVoiceIntent = async (intent: VoiceIntent) => {
    if (!orgId) return;
    try {
      if (conscienciaOnly) {
        await api(`/organization/${orgId}/consciencia/agenda`, {
          method: "POST",
          body: {
            title: intent.titulo || intent.resumo.slice(0, 90) || "Registro por voz",
            detail: intent.resumo || intent.transcricao,
            kind:
              intent.tipo === "delegacao"
                ? "delegacao"
                : intent.tipo === "feedback"
                  ? "feedback"
                  : intent.tipo === "agenda"
                    ? "acao"
                    : "acao",
            memberLabel: intent.membroSugerido ?? null,
            scheduledAt: intent.prazoISO ?? null,
            source: "voice",
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["agenda", orgId] });
        setVoiceOpen(false);
        toast.success("Voz registrada na agenda de liderança.");
        navigate({ to: "/app/consciencia/agenda" });
        return;
      }

      if (typeof window !== "undefined") {
        const key =
          intent.tipo === "feedback"
            ? "voice-draft-feedback"
            : intent.tipo === "delegacao"
              ? "voice-draft-delegacao"
              : "voice-draft-nota";
        window.sessionStorage.setItem(key, JSON.stringify(intent));
      }
      setVoiceOpen(false);
      if (intent.tipo === "feedback") {
        toast.success("Feedback capturado", { description: "Abrindo Feedbacks…" });
        navigate({ to: "/app/feedbacks" });
      } else if (intent.tipo === "delegacao") {
        toast.success("Delegação capturada", { description: "Abrindo Delegações…" });
        navigate({ to: "/app/organization/delegations" });
      } else {
        toast.success("Nota salva", { description: intent.resumo.slice(0, 120) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar áudio");
    }
  };

  const grouped = visibleNav.reduce<Record<string, ShellNavItem[]>>((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});

  const isActiveRoute = (to: string) => {
    if (to === "/app") return pathname === "/app";
    if (to === "/app/consciencia") return pathname === "/app/consciencia";
    return pathname === to || pathname.startsWith(to + "/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px,1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <Logo className="h-7 w-auto max-w-[160px]" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Neo Pessoas
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="mb-6">
              <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {section}
              </div>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => {
                  const active = isActiveRoute(to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        className={
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                          (active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
                        }
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 border-t border-sidebar-border px-6 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>

      <div className="flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-5 py-3 backdrop-blur md:px-10 md:py-4">
          <Logo className="h-6 w-auto max-w-[130px] md:hidden" />
          <div className="hidden text-xs uppercase tracking-widest text-muted-foreground md:block">
            {formatToday()}
          </div>
          <div className="flex items-center gap-3">
            <TeamHealthPill orgId={orgId} />
            <NotificationBell />
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-medium ring-2 ring-border">
              <Logo variant="mark" className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-28 md:px-10 md:py-12 md:pb-12">
          <Outlet />
        </main>
        <LeaderOnboarding />

        {/* Ações globais do líder: ficam acima do menu inferior em qualquer tela do app. */}
        {orgId && (
          <div
            className="fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 md:hidden"
            style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              aria-label="Ditar ação por voz"
              className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background text-foreground shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] transition active:scale-95"
            >
              <Mic className="h-5 w-5" strokeWidth={2} />
            </button>
            <Link
              to={quickActionTo}
              aria-label={conscienciaOnly ? "Novo item na agenda" : "Nova ação"}
              className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-[0_16px_36px_-10px_color-mix(in_oklab,var(--accent)_60%,transparent)] transition active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Link>
          </div>
        )}

        <Dialog open={voiceOpen} onOpenChange={setVoiceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Captura por voz</DialogTitle>
              <DialogDescription>
                {conscienciaOnly
                  ? "Fale uma ação, feedback, delegação ou lembrete. O registro entra na sua Agenda de liderança."
                  : "Fale um feedback, delegação ou nota. A IA transcreve, classifica e leva você direto para o lugar certo."}
              </DialogDescription>
            </DialogHeader>
            {orgId && (
              <div className="pt-2">
                <VoiceCapture orgId={orgId} onConfirm={handleVoiceIntent} label="Iniciar gravação" />
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Exemplos: <em>"Dar feedback positivo à Ana"</em> · <em>"Delegar ao João o relatório até sexta"</em> · <em>"Lembrar de preparar a 1:1"</em>.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bottom navigation (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
          <ul
            className="mx-auto grid max-w-3xl"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleMobileNav.length)}, minmax(0, 1fr))` }}
          >
            {visibleMobileNav.map(({ to, label, icon: Icon }) => {
              const active = isActiveRoute(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors " +
                      (active ? "text-accent" : "text-muted-foreground")
                    }
                  >
                    <span className={"grid h-9 w-9 place-items-center rounded-full transition-colors " + (active ? "bg-accent/10" : "")}>
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </div>
    </div>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}