import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  CalendarClock,
  Loader2,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceCapture, type VoiceIntent } from "@/components/voice/VoiceCapture";

export const Route = createFileRoute("/_authenticated/app/notes")({
  component: NotesPage,
});

type BaseNote = {
  id: string;
  kind: "nota" | "reuniao";
  title: string;
  content: string;
  transcript: string | null;
  source: "manual" | "voz";
  participants: string[];
  tags: string[];
  meetingAt: string | null;
  durationMin: number | null;
  aiSummary: string | null;
  aiActions: {
    resumo?: string;
    pontos?: string[];
    acoes?: { titulo: string; responsavel?: string | null; prazo?: string | null }[];
    perguntas?: string[];
    conexaoMetodologia?: string;
  } | null;
  pinned: boolean;
  createdAt: string;
};

const TABS = [
  { key: "all", label: "Tudo" },
  { key: "nota", label: "Notas" },
  { key: "reuniao", label: "Reuniões" },
] as const;

function NotesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BaseNote | null>(null);

  const [kind, setKind] = useState<"nota" | "reuniao">("nota");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [participants, setParticipants] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [source, setSource] = useState<"manual" | "voz">("manual");
  const [transcript, setTranscript] = useState<string | null>(null);

  const listQ = useQuery({
    enabled: !!orgId,
    queryKey: ["base-notes", orgId, tab, q],
    queryFn: () =>
      api<BaseNote[]>(`/organization/${orgId}/base/notes?kind=${tab}&q=${encodeURIComponent(q)}`),
  });

  const notes = listQ.data ?? [];
  const stats = useMemo(
    () => ({
      total: notes.length,
      reunioes: notes.filter((n) => n.kind === "reuniao").length,
      voz: notes.filter((n) => n.source === "voz").length,
      comIA: notes.filter((n) => !!n.aiSummary).length,
    }),
    [notes],
  );

  function reset() {
    setKind("nota");
    setTitle("");
    setContent("");
    setParticipants("");
    setMeetingAt("");
    setSource("manual");
    setTranscript(null);
  }

  const save = useMutation({
    mutationFn: () =>
      api<BaseNote>(`/organization/${orgId}/base/notes`, {
        method: "POST",
        body: {
          kind,
          title: title.trim() || (kind === "reuniao" ? "Reunião sem título" : "Nota rápida"),
          content,
          transcript,
          source,
          participants: participants
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          meetingAt: meetingAt ? new Date(meetingAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Registro salvo.");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["base-notes", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analyze = useMutation({
    mutationFn: (id: string) =>
      api<BaseNote>(`/organization/${orgId}/base/notes/${id}/ai`, { method: "POST" }),
    onSuccess: (note) => {
      setEditing(note);
      qc.invalidateQueries({ queryKey: ["base-notes", orgId] });
      toast.success("Análise da IA pronta.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: (n: BaseNote) =>
      api(`/organization/${orgId}/base/notes/${n.id}`, { method: "PATCH", body: { pinned: !n.pinned } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["base-notes", orgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/base/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["base-notes", orgId] });
      toast.success("Registro removido.");
    },
  });

  function handleVoice(intent: VoiceIntent) {
    setKind(intent.tipo === "nota" ? "nota" : "nota");
    setTitle(intent.titulo || intent.resumo.slice(0, 80));
    setContent(intent.resumo || intent.transcricao);
    setTranscript(intent.transcricao);
    setSource("voz");
    setOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-6 md:px-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Base do líder
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Notas & Reuniões
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Registre por texto ou por voz. A IA resume, extrai ações e conecta o que você escreveu
              com a metodologia C.O.R.E.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {orgId && <VoiceCapture orgId={orgId} onConfirm={handleVoice} label="Ditar" />}
            <Button
              onClick={() => {
                reset();
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo registro
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Registros", value: stats.total, icon: NotebookPen },
          { label: "Reuniões", value: stats.reunioes, icon: Users },
          { label: "Por voz", value: stats.voz, icon: Sparkles },
          { label: "Com IA", value: stats.comIA, icon: Sparkles },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <s.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "rounded-full px-4 py-1.5 text-sm transition " +
                (tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título ou conteúdo…"
            className="pl-9"
          />
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <NotebookPen className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nada registrado ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece ditando uma nota ou registrando a próxima reunião.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setEditing(n)}
              className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {n.kind === "reuniao" ? <CalendarClock className="h-3 w-3" /> : <NotebookPen className="h-3 w-3" />}
                  {n.kind === "reuniao" ? "Reunião" : "Nota"}
                  {n.source === "voz" && " · voz"}
                </span>
                {n.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="mt-2 line-clamp-1 font-medium">{n.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                {n.aiSummary || n.content || n.transcript}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {new Date(n.meetingAt ?? n.createdAt).toLocaleString("pt-BR")}
                {n.participants.length ? ` · ${n.participants.length} participante(s)` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Criar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo registro</DialogTitle>
            <DialogDescription>Nota rápida ou registro de reunião.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex gap-2">
              {(["nota", "reuniao"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    "flex-1 rounded-xl border px-3 py-2 text-sm transition " +
                    (kind === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")
                  }
                >
                  {k === "nota" ? "Nota" : "Reunião"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Alinhamento semanal" />
            </div>
            {kind === "reuniao" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quando</Label>
                  <Input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Participantes</Label>
                  <Input
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="Ana, Bruno"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.title}</DialogTitle>
                <DialogDescription>
                  {new Date(editing.meetingAt ?? editing.createdAt).toLocaleString("pt-BR")}
                  {editing.participants.length ? ` · ${editing.participants.join(", ")}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  {editing.content || editing.transcript || "—"}
                </div>

                {editing.aiSummary && (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Análise da IA
                    </p>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{editing.aiSummary}</ReactMarkdown>
                    </div>
                    {!!editing.aiActions?.acoes?.length && (
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {editing.aiActions.acoes.map((a, i) => (
                          <li key={i} className="rounded-lg bg-background px-3 py-2">
                            <span className="font-medium">{a.titulo}</span>
                            {a.responsavel ? ` · ${a.responsavel}` : ""}
                            {a.prazo ? ` · ${a.prazo}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editing.aiActions?.conexaoMetodologia && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Metodologia: {editing.aiActions.conexaoMetodologia}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => togglePin.mutate(editing)}
                  disabled={togglePin.isPending}
                >
                  {editing.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                  {editing.pinned ? "Desafixar" : "Fixar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => remove.mutate(editing.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
                <Button onClick={() => analyze.mutate(editing.id)} disabled={analyze.isPending}>
                  {analyze.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Analisar com IA
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
