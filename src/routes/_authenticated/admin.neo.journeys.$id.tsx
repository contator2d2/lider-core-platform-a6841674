import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, GripVertical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { AiGenerateDialog } from "./admin.neo.assessments.$id";

type Step = {
  id: string;
  kind: "assessment"|"video"|"texto"|"exercicio"|"quiz"|"documento"|"pdi"|"conteudo"|"aprovacao";
  title: string;
  description: string | null;
  orderIndex: number;
  refId: string | null;
  config: unknown;
};
type Journey = {
  id: string; name: string; description: string | null; audience: string | null;
  coreModule: string | null; status: string; steps: Step[];
};

const KINDS: { value: Step["kind"]; label: string }[] = [
  { value: "texto", label: "Texto / reflexão" },
  { value: "video", label: "Vídeo" },
  { value: "assessment", label: "Assessment" },
  { value: "exercicio", label: "Exercício" },
  { value: "quiz", label: "Quiz" },
  { value: "documento", label: "Documento" },
  { value: "pdi", label: "PDI" },
  { value: "conteudo", label: "Conteúdo (playbook)" },
  { value: "aprovacao", label: "Aprovação" },
];

export const Route = createFileRoute("/_authenticated/admin/neo/journeys/$id")({
  component: Page,
});

function Page() {
  const { id } = useParams({ from: "/_authenticated/admin/neo/journeys/$id" });
  const qc = useQueryClient();
  const query = useQuery<Journey>({
    queryKey: ["/admin/neo/journeys", id],
    queryFn: () => api<Journey>(`/admin/neo/journeys/${id}`),
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [dialog, setDialog] = useState<{ step?: Step } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/admin/neo/journeys", id] });

  const remove = useMutation({
    mutationFn: (sId: string) => api(`/admin/neo/steps/${sId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Etapa removida"); invalidate(); },
  });

  const j = query.data;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b neo-hairline pb-6">
        <div>
          <Link to="/_authenticated/admin/neo/journeys" className="mb-3 inline-flex items-center gap-1 text-xs text-[color:var(--neo-muted)] hover:text-[color:var(--neo-ink)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar às jornadas
          </Link>
          <div className="neo-eyebrow">Jornada</div>
          <h1 className="mt-2 text-4xl md:text-5xl">{j?.name ?? "Carregando…"}</h1>
          {j?.description && (
            <p className="mt-2 max-w-2xl text-[15px] text-[color:var(--neo-muted)]">{j.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAiOpen(true)} variant="outline" className="rounded-full border-[color:var(--neo-line)] bg-white/70">
            <Sparkles className="mr-1.5 h-4 w-4" /> Gerar com IA
          </Button>
          <Button
            onClick={() => setDialog({})}
            className="rounded-full bg-[color:var(--neo-ink)] px-5 text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova etapa
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="text-[color:var(--neo-muted)]">Carregando…</div>
      ) : !j?.steps?.length ? (
        <div className="rounded-2xl border neo-hairline bg-white p-12 text-center">
          <p className="text-[color:var(--neo-muted)]">
            Nenhuma etapa ainda. Comece manualmente ou peça uma sugestão à IA.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {j.steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 rounded-2xl border neo-hairline bg-white p-4">
              <GripVertical className="mt-1 h-4 w-4 text-[color:var(--neo-muted)]" />
              <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[color:var(--neo-cream)] text-xs font-medium">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="neo-eyebrow">{KINDS.find((k) => k.value === s.kind)?.label ?? s.kind}</div>
                <div className="text-base font-medium">{s.title}</div>
                {s.description && <p className="mt-1 text-sm text-[color:var(--neo-muted)]">{s.description}</p>}
              </div>
              <button
                onClick={() => setDialog({ step: s })}
                className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-[color:var(--neo-cream)] hover:text-[color:var(--neo-ink)]"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => confirm("Remover etapa?") && remove.mutate(s.id)}
                className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {aiOpen && j && (
        <AiGenerateDialog
          scope={{ kind: "journey", id: j.id, name: j.name }}
          onClose={() => setAiOpen(false)}
          onDone={invalidate}
        />
      )}
      {dialog && j && (
        <StepDialog
          journeyId={j.id}
          nextIndex={j.steps.length}
          step={dialog.step}
          onClose={() => setDialog(null)}
          onDone={invalidate}
        />
      )}
    </>
  );
}

function StepDialog({
  journeyId, nextIndex, step, onClose, onDone,
}: {
  journeyId: string;
  nextIndex: number;
  step?: Step;
  onClose: () => void;
  onDone: () => void;
}) {
  const [s, setS] = useState<Partial<Step>>(
    step ?? { kind: "texto", title: "", description: "", orderIndex: nextIndex },
  );
  const save = useMutation({
    mutationFn: () => {
      const body = {
        kind: s.kind,
        title: s.title,
        description: s.description ?? null,
        orderIndex: s.orderIndex ?? nextIndex,
        refId: s.refId ?? null,
      };
      return step
        ? api(`/admin/neo/steps/${step.id}`, { method: "PATCH", body })
        : api(`/admin/neo/journeys/${journeyId}/steps`, { method: "POST", body });
    },
    onSuccess: () => { toast.success("Etapa salva"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl">
            {step ? "Editar etapa" : "Nova etapa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={s.kind} onValueChange={(v) => setS({ ...s, kind: v as Step["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={s.title ?? ""} onChange={(e) => setS({ ...s, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={3} value={s.description ?? ""} onChange={(e) => setS({ ...s, description: e.target.value })} />
          </div>
          {(s.kind === "assessment" || s.kind === "conteudo" || s.kind === "documento") && (
            <div className="space-y-1.5">
              <Label className="text-xs">ID referenciado (opcional)</Label>
              <Input
                value={s.refId ?? ""}
                placeholder="id do assessment / conteúdo"
                onChange={(e) => setS({ ...s, refId: e.target.value })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !s.title}
            className="bg-[color:var(--neo-ink)] text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}