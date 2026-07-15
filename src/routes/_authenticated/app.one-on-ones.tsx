import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Smile,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/one-on-ones")({
  component: OneOnOnesPage,
});

type Status = "scheduled" | "in_progress" | "done" | "canceled";
type ItemKind =
  | "wins"
  | "challenges"
  | "feedback"
  | "development"
  | "personal"
  | "action"
  | "note";

type Item = {
  id: string;
  kind: ItemKind;
  content: string;
  done: boolean;
  dueAt: string | null;
  orderIndex: number;
};

type OneOnOne = {
  id: string;
  subjectUserId: string;
  scheduledAt: string;
  durationMin: number;
  status: Status;
  summary: string | null;
  privateNotes: string | null;
  mood: number | null;
  items: Item[];
};

type TeamOption = { membershipId: string; userId: string; fullName: string };

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  done: "Concluída",
  canceled: "Cancelada",
};

const KIND_LABEL: Record<ItemKind, string> = {
  wins: "Vitórias",
  challenges: "Desafios",
  feedback: "Feedback mútuo",
  development: "Desenvolvimento",
  personal: "Pessoal",
  action: "Ações combinadas",
  note: "Notas",
};

const KIND_ORDER: ItemKind[] = [
  "wins",
  "challenges",
  "feedback",
  "development",
  "personal",
  "action",
  "note",
];

function OneOnOnesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<OneOnOne[]>({
    queryKey: ["one-on-ones", orgId],
    enabled: !!orgId,
    queryFn: () => api<OneOnOne[]>(`/organization/${orgId}/one-on-ones`),
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/one-on-ones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["one-on-ones", orgId] }),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api(`/organization/${orgId}/one-on-ones/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["one-on-ones", orgId] }),
  });

  if (!orgId) return null;

  const upcoming = sessions.filter((s) => s.status === "scheduled").length;
  const pendingActions = sessions.reduce(
    (acc, s) => acc + s.items.filter((i) => i.kind === "action" && !i.done).length,
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            1:1s — Conversas guiadas com o time
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Reuniões que geram ação</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Roteiro pré-definido, histórico por liderado e ações com prazo. A cada 1:1 concluído, os compromissos
            entram no radar da Sala de Liderança.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova 1:1
            </Button>
          </DialogTrigger>
          <NewDialog
            orgId={orgId}
            team={team}
            onDone={() => {
              setOpenNew(false);
              qc.invalidateQueries({ queryKey: ["one-on-ones", orgId] });
            }}
          />
        </Dialog>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Agendadas" value={upcoming} icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label="Ações pendentes" value={pendingActions} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Total no histórico" value={sessions.length} icon={<MessageSquare className="h-4 w-4" />} />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhuma 1:1 registrada</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pelo liderado com quem você tem menos regularidade. O roteiro padrão já cobre vitórias, desafios,
            feedback, desenvolvimento e pessoal.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sessions.map((s) => {
          const subject = team.find((t) => t.userId === s.subjectUserId);
          const isOpen = expanded === s.id;
          const actions = s.items.filter((i) => i.kind === "action");
          const doneActions = actions.filter((i) => i.done).length;
          return (
            <li key={s.id} className="rounded-xl border border-border bg-background">
              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-secondary/30"
              >
                <div className="flex flex-1 items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {subject?.fullName ?? "—"} · {STATUS_LABEL[s.status]}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">
                        {new Date(s.scheduledAt).toLocaleString("pt-BR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.durationMin} min</span>
                      {actions.length > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {doneActions}/{actions.length} ações
                        </span>
                      )}
                      {s.mood != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <Smile className="h-3 w-3" /> {s.mood}/5
                        </span>
                      )}
                    </div>
                    {s.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{s.summary}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={s.status}
                    onValueChange={(v) => patchStatus.mutate({ id: s.id, status: v as Status })}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as Status[]).map((st) => (
                        <SelectItem key={st} value={st}>
                          {STATUS_LABEL[st]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => del.mutate(s.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>

              {isOpen && <SessionDetail orgId={orgId} session={s} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}

function SessionDetail({ orgId, session }: { orgId: string; session: OneOnOne }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["one-on-ones", orgId] });

  const grouped = useMemo(() => {
    const map: Record<ItemKind, Item[]> = {
      wins: [],
      challenges: [],
      feedback: [],
      development: [],
      personal: [],
      action: [],
      note: [],
    };
    for (const i of session.items) map[i.kind].push(i);
    return map;
  }, [session.items]);

  const patchSession = useMutation({
    mutationFn: (body: Partial<OneOnOne>) =>
      api(`/organization/${orgId}/one-on-ones/${session.id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: invalidate,
  });

  return (
    <div className="border-t border-border bg-secondary/20 p-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          {KIND_ORDER.map((kind) => (
            <KindBlock
              key={kind}
              orgId={orgId}
              sessionId={session.id}
              kind={kind}
              items={grouped[kind]}
              onChanged={invalidate}
            />
          ))}
        </div>

        <aside className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Humor do liderado
            </Label>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => patchSession.mutate({ mood: n })}
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-md border text-sm transition " +
                    (session.mood === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-secondary")
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Resumo compartilhado
            </Label>
            <Textarea
              defaultValue={session.summary ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (session.summary ?? "")) {
                  patchSession.mutate({ summary: e.target.value });
                }
              }}
              className="mt-1 min-h-[80px] text-sm"
              placeholder="O que o liderado leva desta conversa?"
            />
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Notas privadas do líder
            </Label>
            <Textarea
              defaultValue={session.privateNotes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (session.privateNotes ?? "")) {
                  patchSession.mutate({ privateNotes: e.target.value });
                }
              }}
              className="mt-1 min-h-[80px] text-sm"
              placeholder="Impressões, sinais, hipóteses…"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function KindBlock({
  orgId,
  sessionId,
  kind,
  items,
  onChanged,
}: {
  orgId: string;
  sessionId: string;
  kind: ItemKind;
  items: Item[];
  onChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [dueAt, setDueAt] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/one-on-ones/${sessionId}/items`, {
        method: "POST",
        body: {
          kind,
          content,
          dueAt: kind === "action" && dueAt ? new Date(dueAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setContent("");
      setDueAt("");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const patchItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Item> }) =>
      api(`/organization/${orgId}/one-on-ones/${sessionId}/items/${id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: onChanged,
  });

  const delItem = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/one-on-ones/${sessionId}/items/${id}`, {
        method: "DELETE",
      }),
    onSuccess: onChanged,
  });

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {KIND_LABEL[kind]}
      </div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-start justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <label className="flex flex-1 cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={i.done}
                onChange={(e) => patchItem.mutate({ id: i.id, body: { done: e.target.checked } })}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <div className="flex-1">
                <div className={i.done ? "line-through text-muted-foreground" : ""}>{i.content}</div>
                {i.dueAt && (
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Prazo: {new Date(i.dueAt).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </label>
            <button
              onClick={() => delItem.mutate(i.id)}
              className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={kind === "action" ? "Nova ação combinada…" : "Adicionar item…"}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && content) create.mutate();
          }}
        />
        {kind === "action" && (
          <Input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-8 w-full text-sm sm:w-40"
          />
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => content && create.mutate()}
          disabled={!content || create.isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </section>
  );
}

function NewDialog({
  orgId,
  team,
  onDone,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
}) {
  const [subjectUserId, setSubjectUserId] = useState("");
  const nowIso = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);
  const [scheduledAt, setScheduledAt] = useState(nowIso);
  const [durationMin, setDurationMin] = useState(30);

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/one-on-ones`, {
        method: "POST",
        body: {
          subjectUserId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMin,
        },
      }),
    onSuccess: () => {
      toast.success("1:1 criada com roteiro padrão");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar"),
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nova 1:1</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Liderado</Label>
          <Select value={subjectUserId} onValueChange={setSubjectUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data e hora</Label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div>
          <Label>Duração (min)</Label>
          <Input
            type="number"
            min={5}
            max={240}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value) || 30)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          O roteiro padrão (vitórias, desafios, feedback, desenvolvimento e pessoal) já será criado — você pode
          editar dentro da sessão.
        </p>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !subjectUserId}
          onClick={() => create.mutate()}
        >
          {create.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Criar 1:1
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
