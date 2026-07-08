import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  RotateCcw,
  ScrollText,
  Undo2,
  User,
  X,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export type DrawerTarget =
  | { kind: "person"; orgId: string; person: { membershipId: string; userId: string; name: string; signals: Array<{ reason: string; action: string; severity: "high" | "medium" | "low" }> } }
  | { kind: "delegation"; orgId: string; delegation: { id: string; title: string; dueAt: string | null; priority: string; status: string } }
  | { kind: "decision"; orgId: string; decision: { id: string; title: string; status: string; dueAt: string | null; updatedAt: string } };

type Props = {
  target: DrawerTarget | null;
  onClose: () => void;
};

export function LeadershipDrawer({ target, onClose }: Props) {
  const open = !!target;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        {target && (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                {target.kind === "person" && <><User className="h-3.5 w-3.5" /> Pessoa</>}
                {target.kind === "delegation" && <><ClipboardList className="h-3.5 w-3.5" /> Delegação</>}
                {target.kind === "decision" && <><ScrollText className="h-3.5 w-3.5" /> Decisão</>}
              </div>
              <SheetTitle className="font-display text-2xl leading-tight">
                {target.kind === "person" ? target.person.name : target.kind === "delegation" ? target.delegation.title : target.decision.title}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {target.kind === "person" && <PersonBody target={target} onDone={onClose} />}
              {target.kind === "delegation" && <DelegationBody target={target} onDone={onClose} />}
              {target.kind === "decision" && <DecisionBody target={target} onDone={onClose} />}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// --------- PERSON ---------
function PersonBody({ target, onDone }: { target: Extract<DrawerTarget, { kind: "person" }>; onDone: () => void }) {
  const p = target.person;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Sinais de atenção</h3>
        <ul className="mt-2 space-y-2">
          {p.signals.map((s, i) => (
            <li key={i} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-sm font-medium">{s.reason}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">Severidade {s.severity}</div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Ações</h3>
        <div className="mt-2 grid gap-2">
          <ActionLink to="/app/one-on-ones" icon={CalendarClock} onNavigate={onDone}>Agendar 1:1</ActionLink>
          <ActionLink to="/app/organization/delegations" icon={ClipboardList} onNavigate={onDone}>Delegar tarefa</ActionLink>
          <ActionLink to="/app/organization/rituals" icon={MessageSquare} onNavigate={onDone}>Registrar feedback</ActionLink>
        </div>
      </section>
    </div>
  );
}

// --------- DELEGATION ---------
function DelegationBody({ target, onDone }: { target: Extract<DrawerTarget, { kind: "delegation" }>; onDone: () => void }) {
  const d = target.delegation;
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/organization/${target.orgId}/delegations/${d.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leadership-room", target.orgId] });
      qc.invalidateQueries({ queryKey: ["org", "health", target.orgId] });
    },
  });

  const comment = useMutation({
    mutationFn: (body: string) =>
      api(`/organization/${target.orgId}/delegations/${d.id}/comments`, { method: "POST", body: { body } }),
  });

  const run = async (label: string, body: Record<string, unknown>) => {
    try {
      await patch.mutateAsync(body);
      toast.success(label);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  };

  const reschedule = async (days: number) => {
    const base = d.dueAt ? new Date(d.dueAt) : new Date();
    const next = new Date(Math.max(base.getTime(), Date.now()) + days * 86400000);
    await run(`Prazo movido para ${next.toLocaleDateString("pt-BR")}`, { dueAt: next.toISOString() });
  };

  const submitComment = async () => {
    if (!note.trim()) return;
    try {
      await comment.mutateAsync(note.trim());
      setNote("");
      toast.success("Comentário registrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao comentar");
    }
  };

  const busy = patch.isPending;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 text-xs">
        <Meta label="Status" value={statusLabel(d.status)} />
        <Meta label="Prioridade" value={d.priority} />
        <Meta label="Prazo" value={d.dueAt ? new Date(d.dueAt).toLocaleDateString("pt-BR") : "—"} />
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Ações rápidas</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton disabled={busy} onClick={() => run("Delegação concluída", { status: "done" })} icon={CheckCircle2} tone="good">
            Marcar concluída
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => run("Em execução", { status: "in_progress" })} icon={Zap}>
            Em execução
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => run("Bloqueada", { status: "blocked" })} icon={X} tone="warn">
            Marcar bloqueada
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => reschedule(7)} icon={CalendarClock}>
            Adiar +7 dias
          </ActionButton>
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Registrar acompanhamento</h3>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: falei com o responsável, retomamos amanhã"
          className="mt-2 min-h-[90px]"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!note.trim() || comment.isPending}
            onClick={submitComment}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
          >
            {comment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            Registrar
          </button>
        </div>
      </section>

      <ActionLink to="/app/organization/delegations" icon={ArrowUpRight} onNavigate={onDone}>Abrir na lista completa</ActionLink>
    </div>
  );
}

// --------- DECISION ---------
function DecisionBody({ target, onDone }: { target: Extract<DrawerTarget, { kind: "decision" }>; onDone: () => void }) {
  const d = target.decision;
  const qc = useQueryClient();

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/organization/${target.orgId}/decisions/${d.id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leadership-room", target.orgId] }),
  });

  const run = async (label: string, body: Record<string, unknown>) => {
    try {
      await patch.mutateAsync(body);
      toast.success(label);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  };

  const busy = patch.isPending;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 text-xs">
        <Meta label="Status" value={statusLabel(d.status)} />
        <Meta label="Prazo" value={d.dueAt ? new Date(d.dueAt).toLocaleDateString("pt-BR") : "—"} />
        <Meta label="Atualizada" value={new Date(d.updatedAt).toLocaleDateString("pt-BR")} />
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Ações rápidas</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton disabled={busy} onClick={() => run("Decisão concluída", { status: "done" })} icon={CheckCircle2} tone="good">
            Marcar concluída
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => run("Em execução", { status: "in_progress" })} icon={Zap}>
            Em execução
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => run("Reaberta", { status: "open" })} icon={RotateCcw}>
            Reabrir
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => run("Decisão revertida", { status: "reverted" })} icon={Undo2} tone="warn">
            Reverter
          </ActionButton>
        </div>
      </section>

      <ActionLink to="/app/organization/decisions" icon={ArrowUpRight} onNavigate={onDone}>Abrir na lista completa</ActionLink>
    </div>
  );
}

// --------- Primitives ---------
function ActionButton({
  children, onClick, disabled, icon: Icon, tone = "default",
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon: typeof CheckCircle2; tone?: "default" | "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "border-success/40 text-success hover:bg-success/10"
      : tone === "warn"
      ? "border-accent/40 text-accent hover:bg-accent/10"
      : "border-border hover:bg-secondary/50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-3 py-3 text-xs font-medium transition-colors disabled:opacity-50 ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function ActionLink({ to, icon: Icon, children, onNavigate }: { to: string; icon: typeof ArrowUpRight; children: React.ReactNode; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm transition-colors hover:bg-secondary/40"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        {children}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    open: "Aberta",
    in_progress: "Em execução",
    done: "Concluída",
    blocked: "Bloqueada",
    canceled: "Cancelada",
    reverted: "Revertida",
  };
  return map[s] ?? s;
}

// Silence unused import if any bundler complains
export const __used = { useMemo };