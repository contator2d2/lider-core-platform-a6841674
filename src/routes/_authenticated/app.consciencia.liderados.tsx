import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Users, Route as RouteIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/consciencia/liderados")({
  component: SubordinatesPage,
  head: () => ({
    meta: [
      { title: "Mapa dos liderados · LíderCore" },
      {
        name: "description",
        content: "Perfis comportamentais dos seus liderados e a trilha individual de cada um.",
      },
    ],
  }),
});

type TrackStep = {
  week: number;
  title: string;
  focus: string;
  practice: string;
  leaderAction: string;
};

type Item = {
  id: string;
  memberLabel: string;
  discPrimary: string | null;
  cerebralPrimary: string | null;
  aiReading: string | null;
  aiTrack: string | null;
  trackSteps: TrackStep[] | null;
  trackGeneratedAt: string | null;
  updatedAt: string;
};

const MODE_LABEL: Record<string, string> = {
  aguia: "Águia",
  lobo: "Lobo",
  gato: "Gato",
  tubarao: "Tubarão",
};

function SubordinatesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "subordinates", orgId],
    enabled: !!orgId,
    queryFn: () => api<{ items: Item[] }>(`/organization/${orgId}/consciencia/subordinate-map`),
  });

  const generate = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/subordinate-map/${id}/track`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Trilha individual gerada.");
      qc.invalidateQueries({ queryKey: ["consciencia", "subordinates", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar trilha"),
  });

  if (!orgId) return null;
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Liderados
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Mapa comportamental do time</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cada liderado que responde um assessment enviado por você ganha uma leitura e uma trilha
          individual de 4 semanas — com a prática dele e a sua ação como líder.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum liderado respondeu ainda. Envie um assessment pelo módulo de Pulsos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <section key={it.id} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">{it.memberLabel}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.discPrimary && <Badge variant="secondary">DISC {it.discPrimary}</Badge>}
                    {it.cerebralPrimary && (
                      <Badge variant="secondary">
                        Modo {MODE_LABEL[it.cerebralPrimary] ?? it.cerebralPrimary}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={generate.isPending}
                  onClick={() => generate.mutate(it.id)}
                >
                  {generate.isPending && generate.variables === it.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {it.trackGeneratedAt ? "Regerar trilha" : "Gerar trilha"}
                </Button>
              </div>

              {it.aiReading && <p className="mt-4 text-sm text-muted-foreground">{it.aiReading}</p>}

              {it.trackSteps?.length ? (
                <ol className="mt-5 space-y-3">
                  {it.trackSteps.map((s) => (
                    <li key={s.week} className="rounded-xl border border-border/70 bg-background p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <RouteIcon className="h-3.5 w-3.5" /> Semana {s.week} · {s.title}
                      </div>
                      <p className="mt-2 text-sm font-medium">{s.focus}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <strong>Prática do liderado:</strong> {s.practice}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <strong>Sua ação:</strong> {s.leaderAction}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Ainda sem trilha gerada para esta pessoa.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}