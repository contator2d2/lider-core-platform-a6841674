import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Gauge,
  Loader2,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/evolution")({
  component: EvolutionPage,
});

type Snapshot = {
  id: string;
  periodYear: number;
  periodMonth: number;
  score: number;
  ritualsScore: number;
  delegScore: number;
  indicatorsScore: number;
  diagnostic: string | null;
};

type MeResponse = {
  current: {
    score: number;
    diagnostic: string;
    breakdown: {
      ritualsScore: number;
      delegScore: number;
      indicatorsScore: number;
      rituals: { done: number; planned: number };
      delegations: { onTime: number; total: number; overdue: number };
      indicators: { onTarget: number; withReadings: number };
    };
  };
  trend: Snapshot[];
  commitments: Array<{ id: string; phrase: string; status: string }>;
};

function EvolutionPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["evolution", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<MeResponse>(`/organization/${orgId}/evolution/me`),
  });

  const snapshot = useMutation({
    mutationFn: () => api(`/organization/${orgId}/evolution/snapshot`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Snapshot do mês registrado");
      qc.invalidateQueries({ queryKey: ["evolution", "me", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  if (!orgId) return null;

  const current = data?.current;
  const trend = data?.trend ?? [];
  const commitments = data?.commitments ?? [];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = current && prev ? current.score - prev.score : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Módulo E — Evolução
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Score de sustentação</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            35% cadência dos rituais · 35% delegações no prazo · 30% indicadores dentro da meta.
            O número é consequência dos fatos — nunca dado solto.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={snapshot.isPending}
          onClick={() => snapshot.mutate()}
        >
          {snapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Registrar snapshot
        </Button>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
        </div>
      )}

      {current && (
        <>
          <section className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Score atual
              </div>
              <div className="mt-3 flex items-end gap-4">
                <div className="font-display text-6xl leading-none">{current.score}</div>
                <div className="pb-1 text-sm text-muted-foreground">/100</div>
                {delta != null && (
                  <div
                    className={
                      "ml-auto flex items-center gap-1 text-sm " +
                      (delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")
                    }
                  >
                    {delta > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : delta < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : null}
                    {delta > 0 ? "+" : ""}
                    {delta} vs mês anterior
                  </div>
                )}
              </div>
              <p className="mt-5 text-sm leading-relaxed text-foreground/90">{current.diagnostic}</p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Composição</div>
              <div className="mt-4 space-y-4">
                <ScoreBar
                  label="Rituais (35%)"
                  icon={Activity}
                  value={current.breakdown.ritualsScore}
                  detail={`${current.breakdown.rituals.done}/${current.breakdown.rituals.planned} feitos em 30d`}
                />
                <ScoreBar
                  label="Delegações (35%)"
                  icon={ClipboardList}
                  value={current.breakdown.delegScore}
                  detail={`${current.breakdown.delegations.onTime}/${current.breakdown.delegations.total} no prazo · ${current.breakdown.delegations.overdue} atrasada(s)`}
                />
                <ScoreBar
                  label="Indicadores (30%)"
                  icon={Target}
                  value={current.breakdown.indicatorsScore}
                  detail={`${current.breakdown.indicators.onTarget}/${current.breakdown.indicators.withReadings} na meta`}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xl">Tendência (últimos meses)</h2>
            {trend.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Ainda não há snapshots. Clique em "Registrar snapshot" no fim de cada mês para começar a tendência.
              </div>
            ) : (
              <TrendChart data={trend} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Plano de ação (mentoria)</h2>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {commitments.length} ativo(s)
              </span>
            </div>
            {commitments.length === 0 ? (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                Nenhum compromisso ativo. Registre em Consciência → Compromissos de mentoria.
              </div>
            ) : (
              <ul className="space-y-2">
                {commitments.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                    <div className="text-sm font-medium">{c.phrase}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  icon: Icon,
  value,
  detail,
}: {
  label: string;
  icon: typeof Gauge;
  value: number;
  detail: string;
}) {
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? "bg-success" : pct >= 40 ? "bg-accent" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function TrendChart({ data }: { data: Snapshot[] }) {
  const w = 640;
  const h = 160;
  const pad = 24;
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1));
  const ys = data.map((d) => h - pad - ((d.score / 100) * (h - pad * 2)));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-accent" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r={3} className="fill-accent" />
            <text x={x} y={h - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {data[i].periodMonth.toString().padStart(2, "0")}/{String(data[i].periodYear).slice(2)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}