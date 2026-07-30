import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/consciencia/coach")({
  component: CoachTrackPage,
  head: () => ({
    meta: [
      { title: "Plano de ação do líder · LíderCore" },
      {
        name: "description",
        content:
          "Diagnóstico direto e as próximas ações do líder, geradas pela metodologia C.O.R.E.",
      },
      { property: "og:title", content: "Plano de ação do líder · LíderCore" },
      {
        property: "og:description",
        content: "Diagnóstico direto e as próximas ações do líder na metodologia C.O.R.E.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Cadence = "weekly" | "biweekly" | "monthly";

type CoachAction = {
  id: string;
  title: string;
  why: string;
  how: string;
  when: string;
  dimension: "C" | "O" | "R" | "E";
  minutes: number;
};

type CoachPlan = {
  headline: string;
  focus: "Hard" | "Soft" | "Heart";
  diagnosis: string;
  actions: CoachAction[];
  ritual: { title: string; cadence: string; script: string[] };
  metric: { name: string; target: string; checkAt: string };
  watchOut: string;
};

type Me = {
  profile: {
    coachCadence: Cadence | null;
    coachTrackPlan: CoachPlan | null;
    coachTrackGeneratedAt: string | null;
    hardSelfScore: number | null;
    softSelfScore: number | null;
    heartSelfScore: number | null;
  } | null;
};

const CADENCES: Array<{ value: Cadence; label: string }> = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
];

const DIMENSION_LABEL: Record<CoachAction["dimension"], string> = {
  C: "Consciência",
  O: "Organização",
  R: "Resultado",
  E: "Evolução",
};

function CoachTrackPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const { isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const r = await api<Me>(`/organization/${orgId}/consciencia/me`);
      if (r.profile?.coachCadence) setCadence(r.profile.coachCadence);
      if (r.profile?.coachTrackPlan) setPlan(r.profile.coachTrackPlan);
      if (r.profile?.coachTrackGeneratedAt) setAt(r.profile.coachTrackGeneratedAt);
      return r;
    },
  });

  const gen = useMutation({
    mutationFn: () =>
      api<{ plan: CoachPlan; generatedAt: string }>(
        `/organization/${orgId}/consciencia/coach/plan`,
        { method: "POST", body: { cadence } },
      ),
    onSuccess: (r) => {
      setPlan(r.plan);
      setAt(r.generatedAt);
      setDone({});
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      toast.success("Plano atualizado. Comece pela ação 1.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar plano"),
  });

  const schedule = useMutation({
    mutationFn: (a: CoachAction) =>
      api(`/organization/${orgId}/consciencia/agenda`, {
        method: "POST",
        body: {
          title: a.title,
          detail: `${a.how}\n\nPor quê: ${a.why}`,
          kind: "coach_action",
          source: "coach_plan",
        },
      }),
    onSuccess: () => toast.success("Ação enviada para a sua agenda."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao agendar"),
  });

  const progress = useMemo(() => {
    if (!plan?.actions.length) return 0;
    const total = plan.actions.length;
    const finished = plan.actions.filter((a) => done[a.id]).length;
    return Math.round((finished / total) * 100);
  }, [plan, done]);

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Plano de ação
        </div>
        <h1 className="font-display text-3xl leading-tight">O que fazer agora</h1>
        <p className="text-sm text-muted-foreground">
          Sem texto longo: um diagnóstico curto e as ações da rodada, com tempo e roteiro.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CADENCES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCadence(c.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition",
                cadence === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {c.label}
            </button>
          ))}
          <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="ml-auto gap-2">
            {gen.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : plan ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {plan ? "Refazer plano" : "Gerar plano"}
          </Button>
        </div>
        {at && (
          <p className="mt-3 text-xs text-muted-foreground">
            Gerado em {new Date(at).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : !plan ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Escolha a cadência e gere seu plano. Ele nasce do seu radar H.S.H e dos seus
            sabotadores.
          </p>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl border border-border bg-primary text-primary-foreground">
            <div className="p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
                Foco da rodada · {plan.focus}
              </div>
              <h2 className="mt-2 font-display text-2xl leading-snug">{plan.headline}</h2>
              <p className="mt-3 text-sm opacity-90">{plan.diagnosis}</p>
            </div>
            <div className="flex items-center gap-3 border-t border-primary-foreground/20 px-6 py-3 text-xs">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-foreground/25">
                <div
                  className="h-full rounded-full bg-primary-foreground transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-semibold">{progress}% concluído</span>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Faça agora
            </h3>
            {plan.actions.map((a, i) => {
              const isDone = !!done[a.id];
              return (
                <article
                  key={a.id}
                  className={cn(
                    "rounded-2xl border p-4 transition",
                    isDone ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setDone((d) => ({ ...d, [a.id]: !d[a.id] }))}
                      aria-label={isDone ? "Desmarcar ação" : "Marcar ação como feita"}
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        isDone
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : i + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {a.dimension} · {DIMENSION_LABEL[a.dimension]}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {a.when} · {a.minutes} min
                        </span>
                      </div>
                      <h4
                        className={cn(
                          "mt-1.5 font-display text-lg leading-snug",
                          isDone && "line-through opacity-60",
                        )}
                      >
                        {a.title}
                      </h4>
                      {a.how && <p className="mt-1 text-sm text-foreground/80">{a.how}</p>}
                      {a.why && (
                        <p className="mt-1 text-xs text-muted-foreground">Por quê: {a.why}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-1.5"
                        disabled={schedule.isPending}
                        onClick={() => schedule.mutate(a)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> Colocar na agenda
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Ritual · {plan.ritual.cadence}
              </div>
              <h4 className="mt-1 font-display text-lg">{plan.ritual.title}</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
                {plan.ritual.script.map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="text-muted-foreground">—</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Métrica da rodada
              </div>
              <h4 className="mt-1 font-display text-lg">{plan.metric.name}</h4>
              <p className="mt-1 text-3xl font-semibold text-primary">{plan.metric.target}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checar em: {plan.metric.checkAt}
              </p>
            </div>
          </section>

          <section className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-foreground/85">{plan.watchOut}</p>
          </section>
        </>
      )}
    </div>
  );
}
