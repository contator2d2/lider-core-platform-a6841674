import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Gauge,
  IdCard,
  LayoutGrid,
  Network,
  ScrollText,
  Workflow,
} from "lucide-react";
import { useCurrentOrg } from "@/lib/use-current-org";

export const Route = createFileRoute("/_authenticated/app/organization")({
  component: OrganizationLayout,
});

type NavItem = { to: string; label: string; icon: typeof Gauge; exact?: boolean };
const nav: NavItem[] = [
  { to: "/app/organization", label: "Painel", icon: Gauge, exact: true },
  { to: "/app/organization/map", label: "Mapa da empresa", icon: Network },
  { to: "/app/organization/areas", label: "Áreas", icon: LayoutGrid },
  { to: "/app/organization/roles", label: "Cargos", icon: IdCard },
  { to: "/app/organization/rituals", label: "Rituais", icon: Workflow },
  { to: "/app/organization/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/organization/delegations", label: "Delegações", icon: ClipboardList },
  { to: "/app/organization/decisions", label: "Decisões", icon: ScrollText },
  { to: "/app/organization/documents", label: "Base documental", icon: FileText },
];

function OrganizationLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { current, orgs, setOrgId } = useCurrentOrg();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Módulo Organização
          </div>
          <h1 className="mt-1 font-display text-4xl">Ambiente do líder</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Estrutura, rituais, delegações e decisões — a base para a IA gerar diagnósticos e recomendações.
          </p>
        </div>
        {orgs.length > 1 && current && (
          <select
            value={current.id}
            onChange={(e) => setOrgId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-border">
        {nav.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={
                "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors " +
                (active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {!current ? (
        <EmptyOrg />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

function EmptyOrg() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        Você ainda não pertence a nenhuma organização. Peça a um administrador
        para incluir você em uma empresa.
      </p>
    </div>
  );
}
