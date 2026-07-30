import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Check,
  Trash2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Bell,
  User,
  CalendarDays,
  List,
  X,
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/consciencia/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda do líder · LíderCore" },
      { name: "description", content: "Calendário de 1:1s, feedbacks, delegações e rituais do líder." },
      { property: "og:title", content: "Agenda do líder · LíderCore" },
      {
        property: "og:description",
        content: "Veja o mês inteiro, com quem, e receba alertas do que está atrasado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

const KIND_STYLE: Record<string, { dot: string; chip: string }> = {
  acao: { dot: "bg-primary", chip: "border-primary/35 bg-primary/12 text-primary" },
  "1on1": { dot: "bg-sky-500", chip: "border-sky-500/35 bg-sky-500/12 text-sky-600 dark:text-sky-400" },
  feedback: { dot: "bg-accent", chip: "border-accent/40 bg-accent/15 text-accent" },
  delegacao: {
    dot: "bg-violet-500",
    chip: "border-violet-500/35 bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
  ritual: { dot: "bg-success", chip: "border-success/40 bg-success/15 text-success" },
};

function kindStyle(k: string) {
  return KIND_STYLE[k] ?? KIND_STYLE.acao;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dayKey(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AgendaPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [view, setView] = useState<"mes" | "semana" | "lista">("mes");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(() => dayKey(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["agenda", orgId],
    enabled: !!orgId,
    queryFn: () => api<{ items: Item[] }>(`/organization/${orgId}/consciencia/agenda`),
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

  const items = data?.items ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      if (!it.scheduledAt) continue;
      const k = dayKey(it.scheduledAt);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    }
    return map;
  }, [items]);

  const now = new Date();
  const overdue = items.filter((i) => !i.done && i.scheduledAt && new Date(i.scheduledAt) < now);
  const next24 = items.filter((i) => {
    if (i.done || !i.scheduledAt) return false;
    const t = new Date(i.scheduledAt).getTime();
    return t >= now.getTime() && t <= now.getTime() + 86400000;
  });
  const unscheduled = items.filter((i) => !i.done && !i.scheduledAt);

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const weekCells = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(addDays(cursor, -cursor.getDay()), i)),
    [cursor],
  );

  if (!orgId) return null;

  const todayKey = dayKey(new Date());
  const dayItems = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  function openNew(dateKey?: string) {
    if (dateKey) {
      const d = new Date(`${dateKey}T09:00`);
      setPrefillDate(toLocalInput(d));
    } else {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      setPrefillDate(toLocalInput(addDays(d, 0)));
    }
    setFormOpen(true);
  }

  function shift(dir: number) {
    setCursor((c) =>
      view === "mes" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * 7),
    );
  }

  const periodLabel =
    view === "mes"
      ? `${MONTHS[cursor.getMonth()]} de ${cursor.getFullYear()}`
      : `${weekCells[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${weekCells[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-3xl bg-ink-gradient p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-foreground/60">
              Módulo C · Agenda do líder
            </div>
            <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
              Seu calendário de liderança
            </h1>
            <p className="mt-3 text-sm text-ink-foreground/70">
              1:1s, feedbacks, delegações e rituais em uma visão de calendário — com quem, quando e o
              que está atrasado.
            </p>
          </div>
          <Button variant="premium" className="gap-2" onClick={() => openNew(selectedDay ?? undefined)}>
            <Plus className="h-4 w-4" /> Novo compromisso
          </Button>
        </div>
      </header>

      {(overdue.length > 0 || next24.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {overdue.length > 0 && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/8 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> {overdue.length} atrasado(s)
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {overdue.slice(0, 3).map((i) => (
                  <li key={i.id} className="truncate text-muted-foreground">
                    <span className="text-foreground">{i.title}</span>
                    {i.memberLabel ? ` · ${i.memberLabel}` : ""} ·{" "}
                    {new Date(i.scheduledAt!).toLocaleDateString("pt-BR")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {next24.length > 0 && (
            <div className="rounded-2xl border border-primary/35 bg-primary/8 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Bell className="h-4 w-4" /> Próximas 24 horas · {next24.length}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {next24.slice(0, 3).map((i) => (
                  <li key={i.id} className="truncate text-muted-foreground">
                    <span className="text-foreground">{timeLabel(i.scheduledAt!)}</span> — {i.title}
                    {i.memberLabel ? ` · ${i.memberLabel}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setCursor(startOfDay(new Date()));
                setSelectedDay(todayKey);
              }}
            >
              Hoje
            </Button>
            <div className="ml-2 font-display text-lg capitalize">{periodLabel}</div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
            {([
              { v: "mes", label: "Mês", icon: CalendarDays },
              { v: "semana", label: "Semana", icon: CalendarClock },
              { v: "lista", label: "Lista", icon: List },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setView(o.v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  view === o.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <o.icon className="h-3.5 w-3.5" /> {o.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda…
          </div>
        ) : view === "lista" ? (
          <AgendaList
            items={items}
            onToggle={(i) => toggle.mutate(i)}
            onDelete={(id) => remove.mutate(id)}
          />
        ) : view === "mes" ? (
          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((d) => {
                const k = dayKey(d);
                const list = byDay.get(k) ?? [];
                const otherMonth = d.getMonth() !== cursor.getMonth();
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedDay(k)}
                    onDoubleClick={() => openNew(k)}
                    className={cn(
                      "min-h-[74px] rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px]",
                      selectedDay === k
                        ? "border-primary bg-primary/8"
                        : "border-border hover:border-primary/40 hover:bg-secondary/60",
                      otherMonth && "opacity-40",
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold",
                        k === todayKey ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {d.getDate()}
                    </div>
                    <div className="mt-1 space-y-1">
                      {list.slice(0, 2).map((it) => (
                        <div
                          key={it.id}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                            it.done ? "bg-secondary text-muted-foreground line-through" : "bg-secondary",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", kindStyle(it.kind).dot)} />
                          <span className="truncate">{it.title}</span>
                        </div>
                      ))}
                      {list.length > 2 && (
                        <div className="px-1 text-[10px] font-medium text-primary">
                          +{list.length - 2}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-7">
            {weekCells.map((d) => {
              const k = dayKey(d);
              const list = byDay.get(k) ?? [];
              return (
                <div
                  key={k}
                  className={cn(
                    "min-h-[180px] rounded-xl border p-2",
                    k === todayKey ? "border-primary/50 bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {WEEKDAYS[d.getDay()]} {d.getDate()}
                    </div>
                    <button
                      type="button"
                      onClick={() => openNew(k)}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Adicionar neste dia"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {list.length === 0 && (
                      <div className="text-[11px] text-muted-foreground">Livre</div>
                    )}
                    {list.map((it) => (
                      <div
                        key={it.id}
                        className={cn("rounded-lg border p-2 text-[11px]", kindStyle(it.kind).chip)}
                      >
                        <div className="font-semibold">{timeLabel(it.scheduledAt!)}</div>
                        <div className={cn("text-foreground", it.done && "line-through opacity-60")}>
                          {it.title}
                        </div>
                        {it.memberLabel && (
                          <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" /> {it.memberLabel}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {view !== "lista" && selectedDay && (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {new Date(`${selectedDay}T12:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
              {" · "}
              {dayItems.length} compromisso(s)
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openNew(selectedDay)}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          {dayItems.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              Nenhum compromisso neste dia. Bom momento para marcar uma 1:1.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {dayItems.map((it) => (
                <AgendaRow
                  key={it.id}
                  item={it}
                  onToggle={() => toggle.mutate(it)}
                  onDelete={() => remove.mutate(it.id)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {unscheduled.length > 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-secondary/30">
          <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sem data definida · {unscheduled.length}
          </div>
          <ul className="divide-y divide-border">
            {unscheduled.map((it) => (
              <AgendaRow
                key={it.id}
                item={it}
                onToggle={() => toggle.mutate(it)}
                onDelete={() => remove.mutate(it.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <NewItemDialog
        orgId={orgId}
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={prefillDate}
        onDone={() => {
          setFormOpen(false);
          qc.invalidateQueries({ queryKey: ["agenda", orgId] });
        }}
      />
    </div>
  );
}

function AgendaRow({
  item,
  onToggle,
  onDelete,
}: {
  item: Item;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const late = !item.done && item.scheduledAt && new Date(item.scheduledAt) < new Date();
  return (
    <li className={cn("flex items-start gap-3 p-4", item.done && "opacity-60")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
          item.done ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
        )}
        aria-label={item.done ? "Marcar como pendente" : "Concluir"}
      >
        {item.done && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium", item.done && "line-through")}>{item.title}</span>
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
              kindStyle(item.kind).chip,
            )}
          >
            {KIND_LABEL[item.kind] ?? item.kind}
          </span>
          {item.source === "voice" && (
            <span className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-accent">
              voz
            </span>
          )}
          {late && (
            <span className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> atrasado
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.scheduledAt && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {new Date(item.scheduledAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {item.memberLabel && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {item.memberLabel}
            </span>
          )}
        </div>
        {item.detail && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AgendaList({
  items,
  onToggle,
  onDelete,
}: {
  items: Item[];
  onToggle: (i: Item) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999");
  });
  if (!sorted.length) {
    return <div className="p-6 text-sm text-muted-foreground">Nenhum compromisso registrado ainda.</div>;
  }
  return (
    <ul className="divide-y divide-border">
      {sorted.map((it) => (
        <AgendaRow key={it.id} item={it} onToggle={() => onToggle(it)} onDelete={() => onDelete(it.id)} />
      ))}
    </ul>
  );
}

function NewItemDialog({
  orgId,
  open,
  onOpenChange,
  defaultDate,
  onDone,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState("1on1");
  const [memberLabel, setMemberLabel] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDate);

  const { data: team = [] } = useQuery<Array<{ userId: string; fullName: string }>>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId && open,
    queryFn: () => api<Array<{ userId: string; fullName: string }>>(`/organization/${orgId}/team`),
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
      toast.success("Compromisso agendado");
      setTitle("");
      setDetail("");
      setMemberLabel("");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setScheduledAt(defaultDate);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo compromisso</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: 1:1 com Marina sobre prazos"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Com quem</Label>
            {team.length > 0 ? (
              <Select value={memberLabel} onValueChange={setMemberLabel}>
                <SelectTrigger><SelectValue placeholder="Selecione o liderado" /></SelectTrigger>
                <SelectContent>
                  {team.map((t) => (
                    <SelectItem key={t.userId} value={t.fullName}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={memberLabel}
                onChange={(e) => setMemberLabel(e.target.value)}
                placeholder="Nome do liderado"
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Quando</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Detalhes</Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Contexto, decisão esperada, critério de aceite…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
