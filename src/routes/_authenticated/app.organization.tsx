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

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/app/organization":              { title: "Painel do líder",     description: "Visão geral da estrutura, rituais e saúde da sua organização." },
  "/app/organization/map":          { title: "Mapa da empresa",     description: "Organograma vivo: pessoas, áreas e cadeia de decisão." },
  "/app/organization/areas":        { title: "Áreas da empresa",    description: "Estruture unidades, times e responsáveis." },
  "/app/organization/roles":        { title: "Cargos",              description: "Papéis, atribuições e níveis de senioridade." },
  "/app/organization/rituals":      { title: "Rituais",             description: "Cadência de rituais que sustentam a operação." },
  "/app/organization/agenda":       { title: "Agenda do líder",     description: "Visualize seus compromissos, rituais e prioridades dos próximos dias." },
  "/app/organization/delegations":  { title: "Delegações",          description: "Combinados claros com prazos e responsáveis." },
  "/app/organization/decisions":    { title: "Decisões",            description: "Registro vivo das decisões e seus desdobramentos." },
  "/app/organization/documents":    { title: "Base documental",     description: "Documentos, políticas e artefatos organizacionais." },
};

function OrganizationLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { current, orgs, setOrgId } = useCurrentOrg();
  const meta = PAGE_META[pathname] ?? PAGE_META["/app/organization"];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Módulo Organização
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{meta.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{meta.description}</p>
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

      {/* Grid de atalhos do módulo (ícones) */}
      <nav className="mb-8 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <ul className="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-9">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={
                    "flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                  }
                >
                  <span
                    className={
                      "grid h-10 w-10 place-items-center rounded-xl border " +
                      (active ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-background")
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-[11px] font-medium leading-tight">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
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
