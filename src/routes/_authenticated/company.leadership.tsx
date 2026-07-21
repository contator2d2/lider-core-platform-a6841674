import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building,
  Gauge,
  Loader2,
  Lock,
  Coins,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MetricCard, SectionHeader } from "@/components/ui/metric-card";
import { RankBars } from "@/components/charts";
import { FadeIn, StaggerItem, StaggerList } from "@/components/motion";

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

type Roi = {
  invest: { totalCents: number; currency: string; invoices: number };
  delta: { overall: number; hard: number; soft: number; heart: number; sampleRecent: number; samplePrev: number };
  roi: { pointsPerThousandBRL: number | null; leadersMeasured: number; leadersHealthy: number; leadersAtRisk: number };
};

type PrivacyAudit = {
  contract: string;
  updatedAt: string;
  rules: Array<{ area: string; scope: string; exposed: string[]; protected: string[] }>;
  note: string;
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

  const { data: roi } = useQuery({
    queryKey: ["company", "roi", orgId],
    enabled: !!orgId,
    queryFn: () => api<Roi>(`/companies/${orgId}/roi`),
  });
  const { data: audit } = useQuery({
    queryKey: ["company", "privacy-audit", orgId],
    enabled: !!orgId,
    queryFn: () => api<PrivacyAudit>(`/companies/${orgId}/privacy-audit`),
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
      <FadeIn>
        <SectionHeader
          eyebrow="Dashboard executivo"
          title="Sustentação da liderança"
          description="Visão agregada — nunca conteúdo individual de perfil, feedback ou decisão."
        />
      </FadeIn>

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
          {roi && (
            <FadeIn>
              <section className="card-elevated p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> ROI do programa · últimos 12 meses
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <RoiTile
                    icon={<Coins className="h-4 w-4" />}
                    label="Investimento"
                    value={
                      "R$ " +
                      (roi.invest.totalCents / 100).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    }
                    hint={`${roi.invest.invoices} fatura(s) paga(s)`}
                  />
                  <RoiTile
                    label="Δ score médio"
                    value={(roi.delta.overall > 0 ? "+" : "") + roi.delta.overall}
                    hint={`${roi.delta.sampleRecent} snapshots recentes vs ${roi.delta.samplePrev}`}
                    tone={roi.delta.overall > 0 ? "good" : roi.delta.overall < 0 ? "bad" : "default"}
                  />
                  <RoiTile
                    label="Retorno"
                    value={
                      roi.roi.pointsPerThousandBRL != null
                        ? `${roi.roi.pointsPerThousandBRL} pts/R$1k`
                        : "—"
                    }
                    hint={`${roi.roi.leadersMeasured} líder(es) medidos`}
                    tone={
                      (roi.roi.pointsPerThousandBRL ?? 0) > 0
                        ? "good"
                        : (roi.roi.pointsPerThousandBRL ?? 0) < 0
                        ? "bad"
                        : "default"
                    }
                  />
                  <RoiTile
                    label="Distribuição"
                    value={`${roi.roi.leadersHealthy} ✓ · ${roi.roi.leadersAtRisk} ⚠`}
                    hint="Saudáveis vs em risco (score <50)"
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <DimensionDelta label="Hard" value={roi.delta.hard} />
                  <DimensionDelta label="Soft" value={roi.delta.soft} />
                  <DimensionDelta label="Heart" value={roi.delta.heart} />
                </div>
              </section>
            </FadeIn>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              eyebrow="Score médio"
              icon={<Gauge className="h-4 w-4" />}
              value={data.avgScore}
              hint={`Maturidade nível ${data.maturity}/5`}
              highlight
              delay={0}
            />
            <MetricCard
              eyebrow="Líderes acompanhados"
              icon={<Users className="h-4 w-4" />}
              value={data.leaders.length}
              hint={`${data.adoption.profiledPct}% com perfil no módulo C`}
              delay={0.05}
            />
            <MetricCard
              eyebrow="Sinais críticos"
              icon={<ShieldAlert className="h-4 w-4" />}
              value={data.risk.highSignals}
              tone={data.risk.highSignals > 0 ? "bad" : "default"}
              hint={`${data.risk.mediumSignals} médios · ${data.risk.concentrationCount} concentração`}
              delay={0.1}
            />
            <MetricCard
              eyebrow="Estrutura pronta"
              icon={<Building className="h-4 w-4" />}
              value={data.adoption.structureReady ? "Sim" : "Parcial"}
              hint={`Assessment feito por ${data.adoption.assessedPct}%`}
              delay={0.15}
            />
          </section>

          <FadeIn delay={0.2}>
            <section className="card-elevated p-6">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="eyebrow">Ranking</div>
                  <h3 className="mt-1 font-display text-xl">Score por líder</h3>
                </div>
                <div className="text-xs text-muted-foreground">{data.leaders.length} líder(es)</div>
              </div>
              {data.leaders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                  Nenhum líder cadastrado ainda.
                </div>
              ) : (
                <RankBars
                  height={Math.max(200, data.leaders.length * 32 + 40)}
                  data={data.leaders
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 12)
                    .map((l) => ({
                      label: l.name,
                      value: l.score,
                      tone: l.score >= 70 ? "good" : l.score >= 50 ? "warn" : "bad",
                    }))}
                />
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.25}>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="eyebrow">Detalhamento</div>
                  <h3 className="mt-1 font-display text-xl">Diagnóstico por líder</h3>
                </div>
              </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
          </FadeIn>

          <FadeIn delay={0.3}>
          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3">
                <div className="eyebrow">Por área</div>
                <h3 className="mt-1 font-display text-xl">Média de score</h3>
              </div>
              <StaggerList className="space-y-2">
                {data.areas.map((a) => (
                  <StaggerItem key={a.areaId ?? "none"}>
                  <div className="card-elevated card-elevated-hover flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-medium">{a.areaName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.leaderCount} líder(es)
                      </div>
                    </div>
                    <div className="metric-number text-2xl text-accent-gradient">{a.avgScore}</div>
                  </div>
                  </StaggerItem>
                ))}
                {data.areas.length === 0 && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Sem áreas com líderes.
                  </div>
                )}
              </StaggerList>
            </div>

            <div>
              <div className="mb-3">
                <div className="eyebrow">Risco</div>
                <h3 className="mt-1 font-display text-xl">Mapa consolidado</h3>
              </div>
              <ul className="space-y-2">
                <RiskRow label="Sinais críticos ativos" value={data.risk.highSignals} tone={data.risk.highSignals > 0 ? "high" : "ok"} />
                <RiskRow label="Sinais médios" value={data.risk.mediumSignals} tone={data.risk.mediumSignals > 3 ? "med" : "ok"} />
                <RiskRow label="Líderes com concentração excessiva" value={data.risk.concentrationCount} tone={data.risk.concentrationCount > 0 ? "med" : "ok"} />
                <RiskRow label="Rituais pausados" value={data.risk.brokenRituals} tone={data.risk.brokenRituals > 0 ? "med" : "ok"} />
              </ul>
            </div>
          </section>
          </FadeIn>

          <FadeIn delay={0.35}>
          <section className="card-elevated p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Adesão ao programa
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Adoption label="Perfil no módulo C" value={`${data.adoption.profiled}/${data.adoption.totalMembers}`} pct={data.adoption.profiledPct} />
              <Adoption label="Assessment aplicado" value={`${data.adoption.assessed}/${data.adoption.totalMembers}`} pct={data.adoption.assessedPct} />
              <Adoption label="Maturidade organizacional" value={`Nível ${data.maturity}/5`} pct={data.maturity * 20} />
            </div>
          </section>
          </FadeIn>

          {audit && (
            <FadeIn delay={0.4}>
              <section className="card-elevated p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Foro íntimo · contrato {audit.contract}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{audit.note}</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Área</th>
                        <th className="px-3 py-2 text-left">Escopo</th>
                        <th className="px-3 py-2 text-left">Empresa vê</th>
                        <th className="px-3 py-2 text-left">Protegido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.rules.map((r) => (
                        <tr key={r.area} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{r.area}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                          <td className="px-3 py-2 text-success">{r.exposed.join(", ") || "—"}</td>
                          <td className="px-3 py-2 text-destructive">{r.protected.join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}

function RoiTile({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const toneCls =
    tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={"metric-number mt-2 text-2xl " + toneCls}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DimensionDelta({ label, value }: { label: string; value: number }) {
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground";
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Sparkles;
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={"inline-flex items-center gap-1 text-sm font-medium " + tone}>
        <Icon className="h-3.5 w-3.5" />
        {value > 0 ? "+" : ""}
        {value}
      </span>
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
        <div
          className="h-full rounded-full bg-accent-gradient transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}