import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/consciencia/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Descrição de atividades · LíderCore" },
      { name: "description", content: "Registre o que você faz no dia a dia. Alimenta o PDI automático." },
    ],
  }),
});

type Me = {
  profile: {
    activityDescription: string | null;
    activityDescriptionUrl: string | null;
  } | null;
};

function ActivityPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<Me>(`/organization/${orgId}/consciencia/me`),
  });

  useEffect(() => {
    if (!data?.profile) return;
    setText(data.profile.activityDescription ?? "");
    setUrl(data.profile.activityDescriptionUrl ?? "");
  }, [data?.profile?.activityDescription, data?.profile?.activityDescriptionUrl]);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me/activity`, {
        method: "PUT",
        body: {
          activityDescription: text.trim() || null,
          activityDescriptionUrl: url.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Descrição de atividades salva.");
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Descrição de atividades
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">O que você faz de verdade</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Descreva com clareza o que ocupa suas horas hoje. Esta descrição cruza com o radar
          Hard·Soft·Heart e com os sabotadores para gerar seu PDI automático.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div>
            <Label>Descrição livre</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: acompanho 8 lideranças diretas, revisor final de propostas comerciais, respondo cliente C-level..."
              className="min-h-[220px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Seja específico: entregas, decisões, reuniões recorrentes, retrabalhos.
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Link para documento externo (opcional)
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={save.isPending} onClick={() => save.mutate()} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}