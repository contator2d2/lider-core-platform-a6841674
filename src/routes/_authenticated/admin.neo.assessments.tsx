import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/assessments")({
  component: Page,
});

function Page() {
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <>
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Biblioteca de Assessments"
      description="Catálogo dos assessments disponíveis. O construtor de perguntas fica em cada assessment aberto."
      endpoint="/admin/neo/assessments"
      entityLabel="assessment"
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
  const [blocks, setBlocks] = useState(3);
  const [perBlock, setPerBlock] = useState(5);

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
              placeholder="Ex.: Teste de Sabotadores (Shirzad Chamine) — 10 sabotadores, Likert 1-5, tom acolhedor."
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