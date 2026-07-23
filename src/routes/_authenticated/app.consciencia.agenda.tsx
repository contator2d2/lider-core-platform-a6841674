import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Check, Trash2, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/consciencia/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda de liderança · LíderCore" },
      { name: "description", content: "Ações do líder — capturadas por voz ou manualmente." },
    ],
  }),
});

type Item = {
  id: string;
  title: string;
  detail: string | null;
  kind: string;
  memberLabel: string | null;
  scheduledAt: string | null;
  done: boolean;
  source: string;
  createdAt: string;
};

const KINDS: Array<{ value: string; label: string }> = [
  { value: "acao", label: "Ação" },
  { value: "1on1", label: "1:1" },
  { value: "feedback", label: "Feedback" },
  { value: "delegacao", label: "Delegação" },
  { value: "ritual", label: "Ritual" },
];

function AgendaPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState("acao");
  const [memberLabel, setMemberLabel] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["agenda", orgId],
    enabled: !!orgId,
    queryFn: () => api<{ items: Item[] }>(`/organization/${orgId}/consciencia/agenda`),
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/agenda`, {
        method: "POST",
        body: {
          title: title.trim(),
          detail: detail.trim() || null,
          kind,
          memberLabel: memberLabel.trim() || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          source: "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Item registrado");
      setTitle(""); setDetail(""); setMemberLabel(""); setScheduledAt("");
      qc.invalidateQueries({ queryKey: ["agenda", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const toggle = useMutation({
    mutationFn: (it: Item) =>
      api(`/organization/${orgId}/consciencia/agenda/${it.id}`, {
        method: "PATCH",
        body: { done: !it.done },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda", orgId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/agenda/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda", orgId] }),
  });

  if (!orgId) return null;
  const items = data?.items ?? [];
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Módulo C · Agenda de liderança
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">O que o líder combinou consigo</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Registro rápido de ações, 1:1s, feedbacks e delegações. Também recebe capturas por voz.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> Novo item
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: 1:1 com Marina sobre atraso na demanda" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Liderado (opcional)</Label>
            <Input value={memberLabel} onChange={(e) => setMemberLabel(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label>Quando</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Detalhes</Label>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Contexto, decisão esperada, critério de aceite…" rows={3} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <ItemList title="Pendentes" items={pending} onToggle={(i) => toggle.mutate(i)} onDelete={(id) => remove.mutate(id)} />
          {done.length > 0 && (
            <ItemList title="Concluídos" items={done} onToggle={(i) => toggle.mutate(i)} onDelete={(id) => remove.mutate(id)} muted />
          )}
        </>
      )}
    </div>
  );
}

function ItemList({ title, items, onToggle, onDelete, muted }: {
  title: string; items: Item[]; onToggle: (i: Item) => void; onDelete: (id: string) => void; muted?: boolean;
}) {
  if (!items.length) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Nada em "{title.toLowerCase()}".
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title} · {items.length}
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className={"flex items-start gap-3 p-4 " + (muted ? "opacity-60" : "")}>
            <button
              onClick={() => onToggle(it)}
              className={
                "mt-0.5 grid h-5 w-5 place-items-center rounded border transition-colors " +
                (it.done ? "border-foreground bg-foreground text-background" : "border-border")
              }
              aria-label={it.done ? "Marcar como pendente" : "Concluir"}
            >
              {it.done && <Check className="h-3 w-3" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <div className={"font-medium " + (it.done ? "line-through" : "")}>{it.title}</div>
                <span className="rounded-full border border-border px-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{it.kind}</span>
                {it.source === "voice" && (
                  <span className="rounded-full border border-primary/40 px-1.5 text-[10px] uppercase tracking-widest text-primary">voz</span>
                )}
                {it.memberLabel && <span className="text-xs text-muted-foreground">· {it.memberLabel}</span>}
              </div>
              {it.scheduledAt && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {new Date(it.scheduledAt).toLocaleString("pt-BR")}
                </div>
              )}
              {it.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{it.detail}</p>}
            </div>
            <button onClick={() => onDelete(it.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}