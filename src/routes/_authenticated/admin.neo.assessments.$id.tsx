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
import { Plus, Sparkles, Trash2, ArrowLeft, GripVertical, Pencil, Link2, Copy, Ban, ExternalLink } from "lucide-react";

type Option = { id?: string; label: string; value: string; score?: number };
type Question = {
  id: string;
  type: "unica"|"multipla"|"likert"|"slider"|"ranking"|"texto"|"cenario"|"autoavaliacao";
  prompt: string;
  helpText: string | null;
  required: boolean;
  weight: number;
  scaleMin: number | null;
  scaleMax: number | null;
  orderIndex: number;
  options: Option[];
};
type Block = {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  questions: Question[];
};
type Assessment = {
  id: string; name: string; slug: string; objective: string | null; audience: string | null;
  competency: string | null; coreModule: string | null; status: string; version: number;
  blocks: Block[];
};

const QTYPES: { value: Question["type"]; label: string }[] = [
  { value: "unica", label: "Única escolha" },
  { value: "multipla", label: "Múltipla escolha" },
  { value: "likert", label: "Escala Likert" },
  { value: "slider", label: "Slider" },
  { value: "ranking", label: "Ranking" },
  { value: "texto", label: "Texto livre" },
  { value: "cenario", label: "Cenário" },
  { value: "autoavaliacao", label: "Autoavaliação" },
];

export const Route = createFileRoute("/_authenticated/admin/neo/assessments/$id")({
  component: Page,
});

function Page() {
  const { id } = useParams({ from: "/_authenticated/admin/neo/assessments/$id" });
  const qc = useQueryClient();
  const query = useQuery<Assessment>({
    queryKey: ["/admin/neo/assessments", id],
    queryFn: () => api<Assessment>(`/admin/neo/assessments/${id}`),
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [qDialog, setQDialog] = useState<{ blockId: string; q?: Question } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/admin/neo/assessments", id] });

  const addBlock = useMutation({
    mutationFn: () => api(`/admin/neo/assessments/${id}/blocks`, {
      method: "POST", body: { title: "Novo bloco", orderIndex: (query.data?.blocks?.length ?? 0) },
    }),
    onSuccess: () => { toast.success("Bloco criado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateBlock = useMutation({
    mutationFn: ({ bId, data }: { bId: string; data: Partial<Block> }) =>
      api(`/admin/neo/blocks/${bId}`, { method: "PATCH", body: data }),
    onSuccess: () => invalidate(),
  });
  const deleteBlock = useMutation({
    mutationFn: (bId: string) => api(`/admin/neo/blocks/${bId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Bloco removido"); invalidate(); },
  });
  const deleteQuestion = useMutation({
    mutationFn: (qId: string) => api(`/admin/neo/questions/${qId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Pergunta removida"); invalidate(); },
  });
  const publish = useMutation({
    mutationFn: () => api(`/admin/neo/assessments/${id}/publish`, { method: "POST" }),
    onSuccess: () => { toast.success("Publicado — nova versão criada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const a = query.data;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b neo-hairline pb-6">
        <div>
          <Link to="/admin/neo/assessments" className="mb-3 inline-flex items-center gap-1 text-xs text-[color:var(--neo-muted)] hover:text-[color:var(--neo-ink)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à biblioteca
          </Link>
          <div className="neo-eyebrow">Assessment · v{a?.version ?? "—"}</div>
          <h1 className="mt-2 text-4xl md:text-5xl">{a?.name ?? "Carregando…"}</h1>
          {a?.objective && (
            <p className="mt-2 max-w-2xl text-[15px] text-[color:var(--neo-muted)]">{a.objective}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setAiOpen(true)}
            variant="outline"
            className="rounded-full border-[color:var(--neo-line)] bg-white/70"
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Gerar com IA
          </Button>
          <Button
            onClick={() => addBlock.mutate()}
            className="rounded-full bg-[color:var(--neo-ink)] px-5 text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Novo bloco
          </Button>
          <Button
            onClick={() => publish.mutate()}
            variant="outline"
            className="rounded-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            disabled={publish.isPending}
          >
            Publicar versão
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="text-[color:var(--neo-muted)]">Carregando…</div>
      ) : !a?.blocks?.length ? (
        <div className="rounded-2xl border neo-hairline bg-white p-12 text-center">
          <p className="text-[color:var(--neo-muted)]">
            Este assessment ainda não tem blocos. Comece adicionando manualmente ou peça uma sugestão à IA.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {a.blocks.map((b, i) => (
            <div key={b.id} className="rounded-2xl border neo-hairline bg-white">
              <header className="flex items-start gap-3 border-b neo-hairline p-5">
                <GripVertical className="mt-1 h-4 w-4 text-[color:var(--neo-muted)]" />
                <div className="flex-1">
                  <div className="neo-eyebrow">Bloco {i + 1}</div>
                  <Input
                    value={b.title}
                    onChange={(e) => updateBlock.mutate({ bId: b.id, data: { title: e.target.value } })}
                    className="mt-1 border-none bg-transparent px-0 text-xl focus-visible:ring-0"
                  />
                  <Textarea
                    value={b.description ?? ""}
                    placeholder="Descrição do bloco…"
                    onChange={(e) => updateBlock.mutate({ bId: b.id, data: { description: e.target.value } })}
                    className="mt-1 border-none bg-transparent px-0 text-sm text-[color:var(--neo-muted)] focus-visible:ring-0"
                    rows={2}
                  />
                </div>
                <button
                  onClick={() => confirm("Remover bloco e suas perguntas?") && deleteBlock.mutate(b.id)}
                  className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </header>
              <ul className="divide-y neo-hairline">
                {b.questions.map((q, qi) => (
                  <li key={q.id} className="flex items-start gap-3 p-4">
                    <span className="mt-1 text-xs text-[color:var(--neo-muted)]">{qi + 1}.</span>
                    <div className="flex-1">
                      <div className="text-sm">{q.prompt}</div>
                      <div className="mt-1 text-xs text-[color:var(--neo-muted)]">
                        {QTYPES.find((t) => t.value === q.type)?.label ?? q.type}
                        {q.options.length > 0 && ` · ${q.options.length} opções`}
                        {q.scaleMin != null && q.scaleMax != null && ` · escala ${q.scaleMin}–${q.scaleMax}`}
                        {` · peso ${q.weight}`}
                      </div>
                    </div>
                    <button
                      onClick={() => setQDialog({ blockId: b.id, q })}
                      className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-[color:var(--neo-cream)] hover:text-[color:var(--neo-ink)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => confirm("Remover pergunta?") && deleteQuestion.mutate(q.id)}
                      className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t neo-hairline p-3">
                <Button
                  variant="ghost"
                  onClick={() => setQDialog({ blockId: b.id })}
                  className="text-sm"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar pergunta
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aiOpen && a && (
        <AiGenerateDialog
          scope={{ kind: "assessment", id: a.id, name: a.name }}
          onClose={() => setAiOpen(false)}
          onDone={invalidate}
        />
      )}
      {qDialog && (
        <QuestionDialog
          blockId={qDialog.blockId}
          question={qDialog.q}
          onClose={() => setQDialog(null)}
          onDone={invalidate}
        />
      )}
      {a && <SharePanel assessmentId={a.id} />}
    </>
  );
}

// ============================================================
// Share links (teste externo, sem login)
// ============================================================
type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string | null;
  maxResponses: number | null;
  revokedAt: string | null;
  createdAt: string;
  _count: { responses: number };
};

function SharePanel({ assessmentId }: { assessmentId: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [maxResponses, setMaxResponses] = useState<string>("");

  const links = useQuery<ShareLink[]>({
    queryKey: ["/admin/neo/assessments", assessmentId, "share-links"],
    queryFn: () => api<ShareLink[]>(`/admin/neo/assessments/${assessmentId}/share-links`),
  });

  const create = useMutation({
    mutationFn: () =>
      api<ShareLink>(`/admin/neo/assessments/${assessmentId}/share-links`, {
        method: "POST",
        body: {
          label: label || null,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          maxResponses: maxResponses ? Number(maxResponses) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Link gerado");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["/admin/neo/assessments", assessmentId, "share-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (linkId: string) =>
      api(`/admin/neo/assessments/share-links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Link revogado");
      qc.invalidateQueries({ queryKey: ["/admin/neo/assessments", assessmentId, "share-links"] });
    },
  });

  const publicUrl = (token: string) => `${window.location.origin}/pa/${token}`;

  return (
    <section className="mt-12 rounded-2xl border neo-hairline bg-white p-6">
      <div className="flex items-start gap-3 border-b neo-hairline pb-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--neo-cream)]">
          <Link2 className="h-4 w-4 text-[color:var(--neo-ink)]" />
        </div>
        <div>
          <div className="neo-eyebrow">Teste externo</div>
          <h2 className="text-2xl">Links públicos</h2>
          <p className="mt-1 text-sm text-[color:var(--neo-muted)]">
            Gere um link que qualquer pessoa possa abrir sem login para responder este assessment.
            Ótimo para testar como o convidado vê e para validar as perguntas.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_140px_auto]">
        <div>
          <Label className="text-xs text-[color:var(--neo-muted)]">Identificação (opcional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Teste beta — jul/26"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-[color:var(--neo-muted)]">Expira em (dias)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="30"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-[color:var(--neo-muted)]">Máx. respostas</Label>
          <Input
            type="number"
            min={1}
            value={maxResponses}
            onChange={(e) => setMaxResponses(e.target.value)}
            placeholder="ilimitado"
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="w-full rounded-full bg-[color:var(--neo-ink)] text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Gerar link
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {links.isLoading ? (
          <div className="text-sm text-[color:var(--neo-muted)]">Carregando…</div>
        ) : !links.data?.length ? (
          <div className="rounded-xl border neo-hairline bg-[color:var(--neo-cream)]/40 p-4 text-sm text-[color:var(--neo-muted)]">
            Nenhum link gerado ainda.
          </div>
        ) : (
          links.data.map((l) => {
            const url = publicUrl(l.token);
            const expired = l.expiresAt && new Date(l.expiresAt) < new Date();
            const disabled = !!l.revokedAt || expired;
            return (
              <div
                key={l.id}
                className={
                  "flex flex-wrap items-center gap-3 rounded-xl border neo-hairline p-3 " +
                  (disabled ? "bg-neutral-50 opacity-70" : "bg-white")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {l.label || "Link sem rótulo"}
                    {l.revokedAt && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        revogado
                      </span>
                    )}
                    {!l.revokedAt && expired && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        expirado
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-[color:var(--neo-muted)]">
                    {url}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[color:var(--neo-muted)]">
                    <span>{l._count.responses} resposta{l._count.responses === 1 ? "" : "s"}</span>
                    {l.expiresAt && <span>expira em {new Date(l.expiresAt).toLocaleDateString("pt-BR")}</span>}
                    {l.maxResponses && <span>limite {l.maxResponses}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast.success("Link copiado");
                    }}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 rounded-full border neo-hairline bg-white px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--neo-cream)] disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      "inline-flex items-center gap-1 rounded-full border neo-hairline bg-white px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--neo-cream)] " +
                      (disabled ? "pointer-events-none opacity-40" : "")
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </a>
                  {!l.revokedAt && (
                    <button
                      onClick={() => confirm("Revogar este link?") && revoke.mutate(l.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      <Ban className="h-3.5 w-3.5" /> Revogar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function QuestionDialog({
  blockId, question, onClose, onDone,
}: {
  blockId: string;
  question?: Question;
  onClose: () => void;
  onDone: () => void;
}) {
  const [q, setQ] = useState<Partial<Question>>(
    question ?? { type: "likert", prompt: "", required: true, weight: 1, scaleMin: 1, scaleMax: 5, options: [] },
  );
  const needsOptions = ["unica", "multipla", "ranking"].includes(q.type ?? "");
  const needsScale = ["likert", "slider"].includes(q.type ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = {
        type: q.type,
        prompt: q.prompt,
        helpText: q.helpText ?? null,
        required: q.required ?? true,
        weight: q.weight ?? 1,
        scaleMin: needsScale ? (q.scaleMin ?? 1) : null,
        scaleMax: needsScale ? (q.scaleMax ?? 5) : null,
        options: needsOptions ? (q.options ?? []).map(({ label, value, score }) => ({ label, value, score: score ?? 0 })) : [],
      };
      return question
        ? api(`/admin/neo/questions/${question.id}`, { method: "PATCH", body })
        : api(`/admin/neo/blocks/${blockId}/questions`, { method: "POST", body });
    },
    onSuccess: () => { toast.success("Pergunta salva"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl">
            {question ? "Editar pergunta" : "Nova pergunta"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={q.type} onValueChange={(v) => setQ({ ...q, type: v as Question["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QTYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Peso</Label>
              <Input
                type="number"
                value={String(q.weight ?? 1)}
                onChange={(e) => setQ({ ...q, weight: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Enunciado</Label>
            <Textarea
              rows={2}
              value={q.prompt ?? ""}
              onChange={(e) => setQ({ ...q, prompt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto de ajuda (opcional)</Label>
            <Input
              value={q.helpText ?? ""}
              onChange={(e) => setQ({ ...q, helpText: e.target.value })}
            />
          </div>
          {needsScale && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mínimo</Label>
                <Input type="number" value={String(q.scaleMin ?? 1)}
                  onChange={(e) => setQ({ ...q, scaleMin: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Máximo</Label>
                <Input type="number" value={String(q.scaleMax ?? 5)}
                  onChange={(e) => setQ({ ...q, scaleMax: Number(e.target.value) })} />
              </div>
            </div>
          )}
          {needsOptions && (
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {(q.options ?? []).map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_80px_auto] gap-2">
                  <Input
                    placeholder="Rótulo"
                    value={opt.label}
                    onChange={(e) => {
                      const list = [...(q.options ?? [])];
                      list[i] = { ...opt, label: e.target.value, value: opt.value || e.target.value.toLowerCase().replace(/\s+/g, "-") };
                      setQ({ ...q, options: list });
                    }}
                  />
                  <Input
                    placeholder="valor"
                    value={opt.value}
                    onChange={(e) => {
                      const list = [...(q.options ?? [])];
                      list[i] = { ...opt, value: e.target.value };
                      setQ({ ...q, options: list });
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="score"
                    value={String(opt.score ?? 0)}
                    onChange={(e) => {
                      const list = [...(q.options ?? [])];
                      list[i] = { ...opt, score: Number(e.target.value) };
                      setQ({ ...q, options: list });
                    }}
                  />
                  <button
                    className="rounded-md p-2 text-[color:var(--neo-muted)] hover:bg-red-50 hover:text-red-600"
                    onClick={() => setQ({ ...q, options: (q.options ?? []).filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() => setQ({ ...q, options: [...(q.options ?? []), { label: "", value: "", score: 0 }] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar opção
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !q.prompt}
            className="bg-[color:var(--neo-ink)] text-white hover:bg-[color:var(--neo-ink)]/90"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AiGenerateDialog({
  scope, onClose, onDone,
}: {
  scope: { kind: "assessment" | "journey"; id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(scope.kind === "assessment" ? 3 : 6);
  const [perBlock, setPerBlock] = useState(4);

  const run = useMutation({
    mutationFn: () => {
      const path = scope.kind === "assessment"
        ? `/admin/neo/assessments/${scope.id}/ai-generate`
        : `/admin/neo/journeys/${scope.id}/ai-generate`;
      const body = scope.kind === "assessment"
        ? { brief, blocks: count, perBlock }
        : { brief, steps: count };
      return api<{ created: number }>(path, { method: "POST", body });
    },
    onSuccess: (d) => { toast.success(`${d.created} itens gerados`); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-editorial text-2xl">
            Gerar com IA · {scope.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--neo-muted)]">
            A IA usará o provedor global configurado em <b>Admin → Provedor de IA</b> e o contexto da metodologia Neo.
            Você poderá revisar e editar tudo depois.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Instruções extras (opcional)</Label>
            <Textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={scope.kind === "assessment"
                ? "Ex.: foco em autoconhecimento para líderes de primeira viagem, tom acolhedor."
                : "Ex.: jornada de 30 dias para novos gestores comerciais."}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {scope.kind === "assessment" ? "Blocos" : "Etapas"}
              </Label>
              <Input
                type="number"
                value={String(count)}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            {scope.kind === "assessment" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Perguntas por bloco</Label>
                <Input
                  type="number"
                  value={String(perBlock)}
                  onChange={(e) => setPerBlock(Math.max(2, Number(e.target.value) || 2))}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => run.mutate()}
            disabled={run.isPending}
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