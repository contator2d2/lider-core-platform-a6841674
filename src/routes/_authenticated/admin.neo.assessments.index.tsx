import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

type AssessmentRow = Record<string, unknown> & {
  id: string;
  name?: string;
  coreModule?: string;
  frequency?: string;
  status?: string;
  _count?: { blocks?: number };
};

export const Route = createFileRoute("/_authenticated/admin/neo/assessments/")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Biblioteca de Assessments · Neo Admin · LíderCore" },
      { name: "description", content: "Administre assessments, blocos e perguntas da metodologia C.O.R.E. no LíderCore." },
      { property: "og:title", content: "Biblioteca de Assessments · Neo Admin · LíderCore" },
      { property: "og:description", content: "Administre assessments, blocos e perguntas da metodologia C.O.R.E. no LíderCore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <>
    <NeoCrudPage<AssessmentRow>
      eyebrow="Neo · Inteligência"
      title="Biblioteca de Assessments"
      description="Catálogo dos assessments disponíveis. O construtor de perguntas fica em cada assessment aberto."
      endpoint="/admin/neo/assessments"
      entityLabel="assessment"
      help={{
        what:
          "Assessment é o teste aplicado ao líder ou ao liderado (DISC, Quociente Positivo, Dominância Cerebral, Radar H.S.H, Sabotadores). Aqui você cria o teste; as perguntas ficam dentro dele.",
        why: [
          "Gera o diagnóstico que alimenta o radar, o 9-Box e o PDI.",
          "Dá à IA os dados reais da pessoa para análises e recomendações.",
          "Pode ser respondido por link público, sem login, e enviado por WhatsApp.",
        ],
        steps: [
          "Clique em Novo (ou em Gerar com IA para criar o teste a partir de um texto/objetivo).",
          "Defina Nome, Módulo C.O.R.E. e Frequência (único, mensal, trimestral…).",
          "Clique no nome do assessment para abrir o construtor de blocos e perguntas.",
          "Use os presets prontos (Quociente Positivo, DISC, Dominância Cerebral, Radar H.S.H) ou monte manualmente.",
          "Gere um Link público na aba do construtor e envie ao respondente.",
          "Acompanhe as respostas no painel do assessment e clique no ícone de análise para a leitura da IA.",
        ],
        examples: [
          "Quociente Positivo (24 itens, 2 blocos)",
          "DISC (20 itens)",
          "Radar H.S.H (30 itens)",
          "Dominância Cerebral — Herrmann (25 itens)",
        ],
        tips: [
          "A coluna Conteúdo mostra quantos blocos e perguntas o teste já tem — se estiver zerado, o teste ainda não está pronto.",
          "Só ative o assessment depois de responder você mesmo pelo link público, para conferir a escala.",
          "Presets já vêm com o cálculo oficial do resultado; perguntas manuais não têm score automático.",
        ],
      }}
      defaultValues={{ status: "draft", frequency: "one_off", weight: 1, competencies: [] }}
      headerExtra={
        <Button
          type="button"
          variant="outline"
          onClick={() => setAiOpen(true)}
          className="rounded-full border-[color:var(--neo-line)] bg-white/70"
        >
          <Sparkles className="mr-1.5 h-4 w-4" /> Gerar com IA
        </Button>
      }
      fields={[
        { kind: "text", name: "name", label: "Nome", required: true },
        { kind: "textarea", name: "objective", label: "Objetivo", rows: 3 },
        { kind: "text", name: "audience", label: "Público" },
        { kind: "text", name: "category", label: "Categoria" },
        { kind: "select", name: "coreModule", label: "Módulo C.O.R.E.", options: [
          { value: "C", label: "C · Consciência" },
          { value: "O", label: "O · Organização" },
          { value: "R", label: "R · Resultado" },
          { value: "E", label: "E · Evolução" },
        ] },
        { kind: "select", name: "frequency", label: "Frequência", options: [
          { value: "one_off", label: "Única" },
          { value: "monthly", label: "Mensal" },
          { value: "quarterly", label: "Trimestral" },
          { value: "yearly", label: "Anual" },
        ] },
        { kind: "number", name: "estimatedMinutes", label: "Tempo estimado (min)" },
        { kind: "number", name: "weight", label: "Peso" },
        { kind: "tags", name: "competencies", label: "Competências relacionadas" },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "name", label: "Nome", render: (it) => (
          <Link
            to="/admin/neo/assessments/$id"
            params={{ id: it.id }}
            className="font-medium text-[color:var(--neo-ink)] underline decoration-transparent underline-offset-2 hover:decoration-current"
          >
            {String(it.name ?? "—")}
          </Link>
        ) },
        { key: "_count", label: "Conteúdo", render: (it) => {
          const blocks = it._count?.blocks ?? 0;
          return (
            <Link
              to="/admin/neo/assessments/$id"
              params={{ id: it.id }}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--neo-line)] bg-white px-3 py-1 text-xs font-medium text-[color:var(--neo-ink)] hover:bg-[color:var(--neo-cream)]"
            >
              {blocks > 0 ? `${blocks} bloco${blocks === 1 ? "" : "s"}` : "Sem perguntas"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          );
        } },
        { key: "coreModule", label: "CORE" },
        { key: "frequency", label: "Frequência" },
        { key: "status", label: "Status" },
      ]}
    />
    {aiOpen && <QuickAiDialog onClose={() => setAiOpen(false)} />}
    </>
  );
}

function QuickAiDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [coreModule, setCoreModule] = useState("C");
  const [brief, setBrief] = useState("");
  const [blocks, setBlocks] = useState(2);
  const [perBlock, setPerBlock] = useState(12);

  const run = useMutation({
    mutationFn: async () => {
      const created = await api<{ id: string }>("/admin/neo/assessments", {
        method: "POST",
        body: { name, objective, coreModule, status: "draft", frequency: "one_off", weight: 1, competencies: [] },
      });
      await api(`/admin/neo/assessments/${created.id}/ai-generate`, {
        method: "POST",
        body: { brief, blocks, perBlock },
      });
      return created.id;
    },
    onSuccess: (id) => {
      toast.success("Assessment gerado com IA");
      qc.invalidateQueries({ queryKey: ["/admin/neo/assessments"] });
      onClose();
      navigate({ to: "/admin/neo/assessments/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl">Gerar assessment com IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--neo-muted)]">
            A IA cria blocos e perguntas com base na metodologia Neo. Você pode revisar e editar tudo depois.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do assessment</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sabotadores, Quociente Positivo, Predominância Cerebral" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivo (opcional)</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Módulo</Label>
              <select
                value={coreModule}
                onChange={(e) => setCoreModule(e.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--neo-line)] bg-white px-3 text-sm"
              >
                <option value="C">C · Consciência</option>
                <option value="O">O · Organização</option>
                <option value="R">R · Resultado</option>
                <option value="E">E · Evolução</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Blocos</Label>
                  <Input type="number" value={String(blocks)} onChange={(e) => setBlocks(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perguntas/bloco</Label>
                  <Input type="number" value={String(perBlock)} onChange={(e) => setPerBlock(Math.max(2, Number(e.target.value) || 2))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instruções extras</Label>
            <Textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Cole aqui as perguntas numeradas ou descreva o teste. Ex.: 24 itens de emoções, escala 1-5: Nem um pouco, Um pouco, Moderadamente, Muito, Extremamente."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => run.mutate()}
            disabled={run.isPending || !name.trim()}
            className="bg-[color:var(--neo-ink)] text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {run.isPending ? "Gerando…" : "Gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}