import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building,
  Gauge,
  Loader2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/company/leadership")({
  component: LeadershipDashboardPage,
});

type Leader = {
  userId: string;
  name: string;
  areaName: string | null;
  score: number;
  ritualsScore: number;
  delegScore: number;
  indicatorsScore: number;
  diagnostic: string;
  delta: number | null;
};

type Dashboard = {
  leaders: Leader[];
  areas: Array<{ areaId: string | null; areaName: string; leaderCount: number; avgScore: number }>;
  risk: {
    highSignals: number;
    mediumSignals: number;
    concentrationCount: number;
    brokenRituals: number;
  };
  adoption: {
    totalMembers: number;
    profiled: number;
    assessed: number;
    profiledPct: number;
    assessedPct: number;
    structureReady: boolean;
  };
  maturity: number;
  avgScore: number;
};

function LeadershipDashboardPage() {
  const { user } = useAuth();
  const primary =
    user?.memberships?.find((m) => ["franchise_owner", "hr_admin"].includes(m.role)) ??
    user?.memberships?.[0];
  const orgId = primary?.organization.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["evolution", "dashboard", orgId],
    enabled: !!orgId,
    queryFn: () => api<Dashboard>(`/organization/${orgId}/evolution/dashboard`),
  });

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
        Sem empresa associada.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Dashboard executivo
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Sustentação da liderança</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Visão agregada — nunca conteúdo individual de perfil, feedback ou decisão.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Falha ao carregar"}
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Kpi
              icon={Gauge}
              label="Score médio da organização"
              value={`${data.avgScore}`}
              hint={`Maturidade nível ${data.maturity}/5`}
            />
            <Kpi
              icon={Users}
              label="Líderes acompanhados"
              value={`${data.leaders.length}`}
              hint={`${data.adoption.profiledPct}% com perfil no módulo C`}
            />
            <Kpi
              icon={ShieldAlert}
              label="Sinais de alta severidade"
              value={`${data.risk.highSignals}`}
              hint={`${data.risk.mediumSignals} médios · ${data.risk.concentrationCount} concentração`}
              warn={data.risk.highSignals > 0}
            />
            <Kpi
              icon={Building}
              label="Estrutura pronta"
              value={data.adoption.structureReady ? "Sim" : "Parcial"}
              hint={`Assessment feito por ${data.adoption.assessedPct}%`}
            />
          </section>

          <section>
            <h2 className="mb-3 font-display text-xl">Score por líder</h2>
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Líder</th>
                    <th className="px-4 py-2 text-left">Área</th>
                    <th className="px-4 py-2 text-right">Score</th>
                    <th className="px-4 py-2 text-right">Δ mês</th>
                    <th className="px-4 py-2 text-left">Leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaders.map((l) => (
                    <tr key={l.userId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.areaName ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                            (l.score >= 70
                              ? "bg-success/15 text-success"
                              : l.score >= 50
                              ? "bg-accent/15 text-accent"
                              : "bg-destructive/15 text-destructive")
                          }
                        >
                          {l.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {l.delta == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              "inline-flex items-center gap-0.5 " +
                              (l.delta > 0 ? "text-success" : l.delta < 0 ? "text-destructive" : "text-muted-foreground")
                            }
                          >
                            {l.delta > 0 ? <ArrowUp className="h-3 w-3" /> : l.delta < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                            {l.delta > 0 ? "+" : ""}
                            {l.delta}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.diagnostic}</td>
                    </tr>
                  ))}
                  {data.leaders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nenhum líder cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-3 font-display text-xl">Por área</h2>
              <ul className="space-y-2">
                {data.areas.map((a) => (
                  <li
                    key={a.areaId ?? "none"}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
                  >
                    <div>
                      <div className="text-sm font-medium">{a.areaName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.leaderCount} líder(es)
                      </div>
                    </div>
                    <div className="text-lg font-medium">{a.avgScore}</div>
                  </li>
                ))}
                {data.areas.length === 0 && (
                  <li className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Sem áreas com líderes.
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 font-display text-xl">Mapa de risco</h2>
              <ul className="space-y-2">
                <RiskRow label="Sinais críticos ativos" value={data.risk.highSignals} tone={data.risk.highSignals > 0 ? "high" : "ok"} />
                <RiskRow label="Sinais médios" value={data.risk.mediumSignals} tone={data.risk.mediumSignals > 3 ? "med" : "ok"} />
                <RiskRow label="Líderes com concentração excessiva" value={data.risk.concentrationCount} tone={data.risk.concentrationCount > 0 ? "med" : "ok"} />
                <RiskRow label="Rituais pausados" value={data.risk.brokenRituals} tone={data.risk.brokenRituals > 0 ? "med" : "ok"} />
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-secondary/20 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Adesão ao programa
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Adoption label="Perfil no módulo C" value={`${data.adoption.profiled}/${data.adoption.totalMembers}`} pct={data.adoption.profiledPct} />
              <Adoption label="Assessment aplicado" value={`${data.adoption.assessed}/${data.adoption.totalMembers}`} pct={data.adoption.assessedPct} />
              <Adoption label="Maturidade organizacional" value={`Nível ${data.maturity}/5`} pct={data.maturity * 20} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className={"rounded-2xl border p-5 " + (warn ? "border-destructive/40 bg-destructive/5" : "border-border bg-background")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function RiskRow({ label, value, tone }: { label: string; value: number; tone: "ok" | "med" | "high" }) {
  const cls =
    tone === "high"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "med"
      ? "border-accent/40 bg-accent/5"
      : "border-border bg-background";
  return (
    <li className={"flex items-center justify-between rounded-xl border p-4 " + cls}>
      <span className="flex items-center gap-2 text-sm">
        {tone !== "ok" && <AlertTriangle className="h-4 w-4" />}
        {label}
      </span>
      <span className="text-lg font-medium">{value}</span>
    </li>
  );
}

function Adoption({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}