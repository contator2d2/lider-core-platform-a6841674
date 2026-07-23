import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/consciencia/pdi")({
  component: PdiAutoPage,
  head: () => ({
    meta: [
      { title: "PDI automático · LíderCore" },
      { name: "description", content: "PDI gerado a partir do radar, sabotadores e descrição de atividades." },
    ],
  }),
});

type Goal = { title: string; description: string; priority: "high" | "medium" | "low"; source: string };

function PdiAutoPage() {
  const { orgId } = useCurrentOrg();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () =>
      api<{ goals: Goal[]; generatedAt: string }>(
        `/organization/${orgId}/consciencia/pdi/auto-generate`,
        { method: "POST", body: {} },
      ),
    onSuccess: (r) => {
      setGoals(r.goals);
      setGeneratedAt(r.generatedAt);
      toast.success(`${r.goals.length} objetivos sugeridos.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar"),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · PDI automático
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Seu PDI cruzando radar × sabotadores × atividades</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          O sistema pega sua dimensão HSH mais frágil, seus sabotadores predominantes e a
          descrição do que você faz e devolve um esqueleto de PDI. Você refina depois.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="gap-2">
          {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar PDI agora
        </Button>
        {generatedAt && (
          <span className="text-xs text-muted-foreground">
            Gerado {new Date(generatedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      {goals.length > 0 && (
        <section className="space-y-3">
          {goals.map((g, i) => (
            <article key={i} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <PriorityBadge p={g.priority} />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{g.source}</span>
              </div>
              <h2 className="mt-2 flex items-start gap-2 font-display text-lg">
                <Flag className="mt-0.5 h-4 w-4 text-primary" />
                {g.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
            </article>
          ))}
        </section>
      )}

      {!gen.isPending && goals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Sem PDI gerado ainda. Clique em <strong>Gerar PDI agora</strong> — precisa ter concluído o assessment.
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ p }: { p: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "Prioridade alta", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
    medium: { label: "Prioridade média", cls: "border-accent/40 bg-accent/10 text-accent" },
    low: { label: "Prioridade baixa", cls: "border-border bg-secondary text-muted-foreground" },
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${map[p].cls}`}>
      {map[p].label}
    </span>
  );
}