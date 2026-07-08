import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { useEffect, useState } from "react";
import {
  LogOut,
  LayoutDashboard,
  Building2,
  Store,
  Users,
  CreditCard,
  Receipt,
  Brain,
  Palette,
  BookOpen,
  Package,
  ArrowLeftRight,
  Network,
  KeyRound,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  Boxes,
  Search,
  Settings2,
  Bell,
  type LucideIcon,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Visão",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Tenants",
    items: [
      { to: "/admin/franchises", label: "Franquias", icon: Store },
      { to: "/admin/organizations", label: "Empresas", icon: Building2 },
      { to: "/admin/hierarchy", label: "Filiais / Áreas / Equipes", icon: Network },
      { to: "/admin/users", label: "Usuários", icon: Users },
      { to: "/admin/permissions", label: "Permissões (RBAC)", icon: ShieldCheck },
    ],
  },
  {
    title: "Comercial",
    items: [
      { to: "/admin/plans", label: "Planos", icon: Package },
      { to: "/admin/modules", label: "Módulos do produto", icon: Boxes },
      { to: "/admin/licenses", label: "Licenças", icon: KeyRound },
      { to: "/admin/subscriptions", label: "Assinaturas", icon: CreditCard },
      { to: "/admin/invoices", label: "Faturas", icon: Receipt },
      { to: "/admin/billing", label: "Cobrança (Asaas)", icon: CreditCard },
    ],
  },
  {
    title: "Implantação",
    items: [
      { to: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { to: "/admin/ai", label: "Provedor IA", icon: Brain },
      { to: "/admin/branding", label: "Branding", icon: Palette },
      { to: "/admin/methodology", label: "Metodologia", icon: BookOpen },
      { to: "/admin/apps", label: "Apps & Versões", icon: Package },
      { to: "/admin/notifications", label: "Notificações", icon: Bell },
      { to: "/admin/settings", label: "Configurações", icon: Settings2 },
      { to: "/admin/logs", label: "Logs de auditoria", icon: FileText },
    ],
  },
];

export function AdminShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    toast.success("Até logo.");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Logo className="h-6 w-auto max-w-[140px]" />
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
              Super Admin
            </span>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Buscar em tudo…</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <nav className="flex-1 space-y-4 overflow-y-auto p-3">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-0.5">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const active =
                    item.to === "/admin"
                      ? pathname === "/admin" || pathname === "/admin/"
                      : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
              {user?.email}
            </div>
            <div className="grid gap-1">
              <Link
                to="/app"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Ver como líder
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur md:hidden">
            <Logo className="h-6 w-auto max-w-[120px]" />
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </header>
          <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Painel Super Admin
        </div>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}