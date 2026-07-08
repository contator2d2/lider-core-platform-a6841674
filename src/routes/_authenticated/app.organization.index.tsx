import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { AlertTriangle, Calendar, CheckCircle2, FileText, LayoutGrid, ScrollText, Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/")({
  component: OrganizationDashboard,
});

type Dashboard = {
  ritualsCount: number;
  upcomingOccurrences: Array<{ id: string; scheduledAt: string; ritual: { name: string; type: string } }>;
  overdueDelegations: number;
  openDecisions: number;
  docsCount: number;
  areasCount: number;
  teamsCount: number;
};

type HealthScore = { score: number; breakdown: Record<string, { weight: number; score: number }> };

function OrganizationDashboard() {
  const { orgId } = useCurrentOrg();
  const dash = useQuery({
    queryKey: ["org", "dashboard", orgId],
    queryFn: () => api<Dashboard>(`/organization/${orgId}/dashboard`),
    enabled: !!orgId,
  });
  const health = useQuery({
    queryKey: ["org", "health", orgId],
    queryFn: () => api<HealthScore>(`/organization/${orgId}/health-score`),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Áreas" value={dash.data?.areasCount ?? "—"} icon={LayoutGrid} />
          <Kpi label="Equipes" value={dash.data?.teamsCount ?? "—"} icon={LayoutGrid} />
          <Kpi label="Rituais ativos" value={dash.data?.ritualsCount ?? "—"} icon={Workflow} />
          <Kpi label="Decisões abertas" value={dash.data?.openDecisions ?? "—"} icon={ScrollText} />
          <Kpi label="Delegações atrasadas" value={dash.data?.overdueDelegations ?? "—"} icon={AlertTriangle} tone={dash.data?.overdueDelegations ? "warn" : "default"} />
          <Kpi label="Documentos" value={dash.data?.docsCount ?? "—"} icon={FileText} />
          <Kpi label="Próximos rituais (7d)" value={dash.data?.upcomingOccurrences?.length ?? "—"} icon={Calendar} />
          <Kpi label="Health Score" value={health.data?.score ?? "—"} icon={CheckCircle2} tone={healthTone(health.data?.score)} />
        </div>

        <HealthCard data={health.data} />
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Próximos rituais
          </div>
          <span className="text-xs text-muted-foreground">Próximos 7 dias</span>
        </header>
        <ul className="divide-y divide-border">
          {dash.data?.upcomingOccurrences?.length ? (
            dash.data.upcomingOccurrences.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium">{o.ritual.name}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{o.ritual.type}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </li>
            ))
          ) : (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum ritual agendado.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function healthTone(score?: number): "default" | "warn" | "good" {
  if (score == null) return "default";
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "warn";
}

function Kpi({ label, value, icon: Icon, tone = "default" }: { label: string; value: number | string; icon: typeof LayoutGrid; tone?: "default" | "warn" | "good" }) {
  const toneCls = tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 font-display text-3xl ${toneCls}`}>{value}</div>
    </div>
  );
}

function HealthCard({ data }: { data?: HealthScore }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Health Score Organizacional</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-5xl">{data?.score ?? "—"}</div>
        <div className="text-sm text-muted-foreground">/ 100</div>
      </div>
      <div className="mt-4 space-y-2">
        {data && Object.entries(data.breakdown).map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">{k}</span>
              <span>{Math.round(v.score * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/80" style={{ width: `${v.score * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
