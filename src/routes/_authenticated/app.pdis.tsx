import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/pdis")({
  component: PdisPage,
});

type GoalStatus = "a_fazer" | "em_andamento" | "concluido" | "atrasado";
type PdiStatus = "ativo" | "concluido" | "pausado" | "cancelado";

type Goal = {
  id: string;
  title: string;
  action: string | null;
  dueAt: string | null;
  status: GoalStatus;
  evidence: string | null;
};
type Pdi = {
  id: string;
  subjectUserId: string;
  title: string;
  focus: string | null;
  summary: string | null;
  reviewAt: string | null;
  status: PdiStatus;
  createdAt: string;
  goals: Goal[];
};

type TeamOption = { membershipId: string; userId: string; fullName: string };

const GOAL_STATUS: Record<GoalStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};
const PDI_STATUS: Record<PdiStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

function PdisPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: pdis = [], isLoading } = useQuery<Pdi[]>({
    queryKey: ["pdis", orgId],
    enabled: !!orgId,
    queryFn: () => api<Pdi[]>(`/organization/${orgId}/pdis`),
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/pdis/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdis", orgId] }),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PdiStatus }) =>
      api(`/organization/${orgId}/pdis/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdis", orgId] }),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            PDIs — Planos de Desenvolvimento Individual
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Evolução das pessoas</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Um PDI por liderado. Foco central + metas concretas com prazo. Alimenta a Sala em "pessoas que precisam de atenção".
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo PDI
            </Button>
          </DialogTrigger>
          <NewPdiDialog
            orgId={orgId}
            team={team}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["pdis", orgId] });
            }}
          />
        </Dialog>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && pdis.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum PDI cadastrado</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pelo liderado com maior necessidade de desenvolvimento identificada.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {pdis.map((p) => {
          const subject = team.find((t) => t.userId === p.subjectUserId);
          return (
            <li key={p.id} className="rounded-xl border border-border bg-background p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {subject?.fullName ?? "—"} · {PDI_STATUS[p.status]}
                  </div>
                  <h3 className="mt-1 text-lg font-medium">{p.title}</h3>
                  {p.focus && <div className="mt-1 text-sm text-muted-foreground">Foco: {p.focus}</div>}
                  {p.reviewAt && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Rever em {new Date(p.reviewAt).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={p.status}
                    onValueChange={(v) => patchStatus.mutate({ id: p.id, status: v as PdiStatus })}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PDI_STATUS) as PdiStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{PDI_STATUS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => del.mutate(p.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {p.summary && <p className="mt-3 text-sm text-muted-foreground">{p.summary}</p>}

              <Goals orgId={orgId} pdi={p} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Goals({ orgId, pdi }: { orgId: string; pdi: Pdi }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [action, setAction] = useState("");
  const [dueAt, setDueAt] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdis", orgId] });

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals`, {
        method: "POST",
        body: {
          title,
          action: action || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setAction("");
      setDueAt("");
      setAdding(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const patchGoal = useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals/${id}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: invalidate,
  });

  const delGoal = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pdis/${pdi.id}/goals/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Metas</div>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Nova
        </Button>
      </div>
      {adding && (
        <div className="mb-3 space-y-2 rounded-md border border-border bg-background p-3">
          <Input placeholder="Título da meta" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Ação concreta" value={action} onChange={(e) => setAction(e.target.value)} />
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => create.mutate()} disabled={!title || create.isPending}>
              {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
      {pdi.goals.length === 0 && !adding && (
        <div className="text-xs text-muted-foreground">Sem metas cadastradas.</div>
      )}
      <ul className="space-y-2">
        {pdi.goals.map((g) => (
          <li key={g.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
            <div className="flex-1">
              <div className={g.status === "concluido" ? "line-through text-muted-foreground" : "font-medium"}>
                {g.title}
              </div>
              {g.action && <div className="text-xs text-muted-foreground">{g.action}</div>}
              {g.dueAt && (
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Prazo: {new Date(g.dueAt).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Select
                value={g.status}
                onValueChange={(v) => patchGoal.mutate({ id: g.id, status: v as GoalStatus })}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_STATUS) as GoalStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{GOAL_STATUS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => delGoal.mutate(g.id)}
                className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir meta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewPdiDialog({
  orgId,
  team,
  onDone,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
}) {
  const [subjectUserId, setSubjectUserId] = useState("");
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [summary, setSummary] = useState("");
  const [reviewAt, setReviewAt] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/pdis`, {
        method: "POST",
        body: {
          subjectUserId,
          title,
          focus: focus || null,
          summary: summary || null,
          reviewAt: reviewAt ? new Date(reviewAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("PDI criado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Novo PDI</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Liderado</Label>
          <Select value={subjectUserId} onValueChange={setSubjectUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>{t.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Desenvolver comunicação com pares" />
        </div>
        <div>
          <Label>Foco central</Label>
          <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Competência ou módulo C.O.R.E." />
        </div>
        <div>
          <Label>Resumo</Label>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-[90px]" />
        </div>
        <div>
          <Label>Data de revisão</Label>
          <Input type="date" value={reviewAt} onChange={(e) => setReviewAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !subjectUserId || !title}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Criar PDI
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
