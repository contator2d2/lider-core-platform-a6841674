import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/consciencia/coach")({
  component: CoachTrackPage,
  head: () => ({
    meta: [
      { title: "Trilha do coach C.O.R.E. · LíderCore" },
      { name: "description", content: "Trilha periódica do líder, travada na metodologia C.O.R.E." },
    ],
  }),
});

type Me = {
  profile: {
    coachCadence: "weekly" | "biweekly" | "monthly" | null;
    coachTrackMarkdown: string | null;
    coachTrackGeneratedAt: string | null;
  } | null;
};

function CoachTrackPage() {
  const { orgId } = useCurrentOrg();
  const [cadence, setCadence] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [md, setMd] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const r = await api<Me>(`/organization/${orgId}/consciencia/me`);
      if (r.profile?.coachCadence) setCadence(r.profile.coachCadence);
      if (r.profile?.coachTrackMarkdown) setMd(r.profile.coachTrackMarkdown);
      if (r.profile?.coachTrackGeneratedAt) setAt(r.profile.coachTrackGeneratedAt);
      return r;
    },
  });

  const gen = useMutation({
    mutationFn: () =>
      api<{ markdown: string; generatedAt: string }>(
        `/organization/${orgId}/consciencia/coach/plan`,
        { method: "POST", body: { cadence } },
      ),
    onSuccess: (r) => {
      setMd(r.markdown);
      setAt(r.generatedAt);
      toast.success("Trilha atualizada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Coach C.O.R.E.
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">Sua trilha periódica</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          O coach da plataforma monta uma trilha travada na metodologia C.O.R.E. — Consciência,
          Organização, Resultado, Evolução — baseada no seu radar HSH e nos seus sabotadores.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label>Cadência</Label>
            <Select value={cadence} onValueChange={(v) => setCadence(v as "weekly" | "biweekly" | "monthly")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="gap-2">
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar trilha
          </Button>
        </div>
        {at && (
          <p className="mt-3 text-xs text-muted-foreground">
            Última geração: {new Date(at).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : md ? (
        <article className="prose prose-sm max-w-none rounded-2xl border border-border bg-card p-6 whitespace-pre-wrap font-mono text-sm">
          {md}
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma trilha ainda. Escolha a cadência e clique em <strong>Gerar trilha</strong>.
        </div>
      )}
    </div>
  );
}