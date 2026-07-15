import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
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
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LeaderOnboarding } from "@/components/onboarding/LeaderOnboarding";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

const nav = [
  { to: "/app", label: "Hoje", icon: Home, section: "Consciência" },
  { to: "/app/consciencia", label: "Meu perfil", icon: Brain, section: "Consciência" },
  { to: "/app/team", label: "Minha equipe", icon: Users, section: "Consciência" },
  { to: "/app/organization", label: "Organização", icon: Building, section: "Organização" },
  { to: "/app/one-on-ones", label: "1:1s", icon: MessageSquare, section: "Organização" },
  { to: "/app/indicators", label: "Indicadores", icon: Target, section: "Resultado" },
  { to: "/app/evolution", label: "Evolução", icon: Gauge, section: "Evolução" },
  { to: "/app/pdis", label: "PDIs", icon: BookOpen, section: "Evolução" },
  { to: "/app/feedbacks", label: "Feedbacks", icon: Compass, section: "Evolução" },
  { to: "/app/ai", label: "IA Coach", icon: Sparkles, section: "Evolução" },
  { to: "/app/help", label: "Ajuda", icon: HelpCircle, section: "Ajuda" },
] as const;

const mobileNav = [
  { to: "/app", label: "Início", icon: Home },
  { to: "/app/organization/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/team", label: "Equipe", icon: Users },
  { to: "/app/ai", label: "Ações", icon: Zap },
  { to: "/app/help", label: "Mais", icon: MoreHorizontal },
] as const;

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    toast.success("Até logo.");
    navigate({ to: "/auth", replace: true });
  };

  const grouped = nav.reduce<Record<string, typeof nav[number][]>>((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});

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
                  const active =
                    to === "/app" ? pathname === "/app" : pathname.startsWith(to);
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

        {/* Bottom navigation (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
          <ul className="mx-auto grid max-w-3xl grid-cols-5">
            {mobileNav.map(({ to, label, icon: Icon }) => {
              const active = to === "/app" ? pathname === "/app" : pathname === to || pathname.startsWith(to + "/");
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