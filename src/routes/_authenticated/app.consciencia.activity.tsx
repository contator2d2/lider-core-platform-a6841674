import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, FileText, ArrowRight, Upload, CheckCircle2, ChevronLeft } from "lucide-react";
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
    activityDocName?: string | null;
    activityDocAt?: string | null;
  } | null;
};

function ActivityPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);

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
    mutationFn: (_opts?: { next?: boolean }) =>
      api(`/organization/${orgId}/consciencia/me/activity`, {
        method: "PUT",
        body: {
          activityDescription: text.trim() || null,
          activityDescriptionUrl: url.trim() || null,
        },
      }),
    onSuccess: (_r, vars) => {
      toast.success("Descrição de atividades salva.");
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
      if (vars?.next) navigate({ to: "/app/consciencia/pdi" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Envie um documento de até 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      const r = await api<{ extractedText: string }>(
        `/organization/${orgId}/consciencia/me/activity/document`,
        {
          method: "POST",
          body: {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            base64,
            replaceDescription: text.trim().length === 0,
          },
        },
      );
      if (!text.trim()) setText(r.extractedText);
      toast.success("Documento lido e anexado à sua descrição.");
      qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler esse documento.");
    } finally {
      setUploading(false);
    }
  }

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <header>
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/app/consciencia" })}
            className="rounded-full bg-white/50 backdrop-blur-sm border border-border/50 hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="h-1 flex-1 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[65%]" />
          </div>
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
          Módulo C · Descrição de atividades
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">O que você faz de verdade</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground/80">
          Descreva com clareza o que ocupa suas horas hoje. Esta descrição cruza com o radar
          <span className="font-medium text-foreground"> Hard·Soft·Heart</span> e com os sabotadores para gerar seu PDI automático.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <section className="rounded-3xl border border-border bg-white/40 backdrop-blur-xl p-8 shadow-sm space-y-8">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Descrição livre</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: acompanho 8 lideranças diretas, revisor final de propostas comerciais, respondo cliente C-level..."
              className="min-h-[220px] bg-white border-border/60 focus:border-primary/50 focus:ring-primary/10 rounded-2xl p-4 text-[15px] transition-all resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Seja específico: entregas, decisões, reuniões recorrentes, retrabalhos.
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <FileText className="h-4 w-4 text-primary" /> Link para documento externo (opcional)
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="bg-white border-border/60 rounded-xl h-12 px-4 transition-all focus:ring-primary/10"
            />
          </div>
          <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 transition-colors hover:bg-primary/10 group">
            <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <Upload className="h-4 w-4 text-primary" /> Enviar documento (PDF, DOCX, TXT ou imagem)
            </Label>
            <p className="mt-1 text-xs text-muted-foreground/70">
              A IA lê o arquivo e transforma em descrição de atividades automaticamente.
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,image/*"
              className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleFile(f);
              }}
            />
            {uploading && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo o documento…
              </p>
            )}
            {data?.profile?.activityDocName && !uploading && (
              <p className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {data.profile.activityDocName}
              </p>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate({ to: "/app/consciencia" })}
                className="text-muted-foreground hover:text-foreground order-last sm:order-first"
              >
                Responder depois
              </Button>
              <div className="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate(undefined)}
                  className="gap-2 h-12 px-6 border-border/60 bg-white hover:bg-white/80 rounded-xl font-medium"
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar rascunho
                </Button>
                <Button
                  disabled={save.isPending || text.trim().length < 20}
                  onClick={() => save.mutate({ next: true })}
                  className="gap-2 h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Salvar e avançar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {text.trim().length < 20 && (
              <p className="text-right text-xs text-muted-foreground">
                Escreva pelo menos 20 caracteres para avançar.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}