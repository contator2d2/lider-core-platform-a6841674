import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, Loader2, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/organization/cycles")({
  component: CyclesPage,
});

type GoalStatus = "on_track" | "at_risk" | "off_track" | "done" | "dropped";
type CycleStatus = "planning" | "active" | "closed";
type Goal = {
  id: string; title: string; specific: string | null; measurable: string | null;
  achievable: string | null; relevant: string | null; timeBound: string | null;
  ownerUserId: string | null; indicatorId: string | null; targetValue: number | null;
  status: GoalStatus;
};
type Cycle = {
  id: string; name: string; startAt: string; endAt: string;
  status: CycleStatus; summary: string | null; goals: Goal[];
};

const STATUS_META: Record<CycleStatus, { label: string; cls: string }> = {
  planning: { label: "Planejamento", cls: "bg-secondary text-foreground" },
  active:   { label: "Ativo",        cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  closed:   { label: "Encerrado",    cls: "bg-muted text-muted-foreground" },
};
const GOAL_META: Record<GoalStatus, { label: string; dot: string }> = {
  on_track:  { label: "No prumo",  dot: "bg-emerald-500" },
  at_risk:   { label: "Em risco",  dot: "bg-amber-500" },
  off_track: { label: "Atrasada",  dot: "bg-rose-500" },
  done:      { label: "Concluída", dot: "bg-sky-500" },
  dropped:   { label: "Descartada",dot: "bg-muted-foreground" },
};

function CyclesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [openCycle, setOpenCycle] = useState(false);
  const [goalCycleId, setGoalCycleId] = useState<string | null>(null);
  const [retroCycle, setRetroCycle] = useState<Cycle | null>(null);

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["cycles", orgId],
    enabled: !!orgId,
    queryFn: () => api<Cycle[]>(`/organization/${orgId}/cycles`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/cycles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cycles", orgId] }),
  });

  const active = useMemo(() => cycles.filter((c) => c.status !== "closed"), [cycles]);
  const closed = useMemo(() => cycles.filter((c) => c.status === "closed"), [cycles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Defina horizontes (trimestre, campanha) e escreva metas <strong className="text-foreground">SMART</strong> ligadas aos indicadores da casa.
        </div>
        <Dialog open={openCycle} onOpenChange={setOpenCycle}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo ciclo</Button>
          </DialogTrigger>
          <CycleDialog onClose={() => setOpenCycle(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum ciclo ainda. Comece pelo trimestre atual.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...active, ...closed].map((c) => (
            <CycleCard
              key={c.id}
              cycle={c}
              onAddGoal={() => setGoalCycleId(c.id)}
              onRetro={() => setRetroCycle(c)}
              onDelete={() => {
                if (confirm(`Excluir ciclo "${c.name}"?`)) del.mutate(c.id);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={!!goalCycleId} onOpenChange={(o) => !o && setGoalCycleId(null)}>
        {goalCycleId && <GoalDialog cycleId={goalCycleId} onClose={() => setGoalCycleId(null)} />}
      </Dialog>

      <Dialog open={!!retroCycle} onOpenChange={(o) => !o && setRetroCycle(null)}>
        {retroCycle && <RetroDialog cycle={retroCycle} onClose={() => setRetroCycle(null)} />}
      </Dialog>
    </div>
  );
}

function CycleCard({ cycle, onAddGoal, onRetro, onDelete }: { cycle: Cycle; onAddGoal: () => void; onRetro: () => void; onDelete: () => void }) {
  const meta = STATUS_META[cycle.status];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl">{cycle.name}</h3>
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + meta.cls}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {new Date(cycle.startAt).toLocaleDateString("pt-BR")} — {new Date(cycle.endAt).toLocaleDateString("pt-BR")}
          </p>
          {cycle.summary && <p className="mt-2 text-sm text-foreground/80">{cycle.summary}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onAddGoal}>
            <Plus className="h-3.5 w-3.5" />Meta
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetro}>
            <Sparkles className="h-3.5 w-3.5" />Retrô
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {cycle.goals.length > 0 && (
        <ul className="mt-4 space-y-2">
          {cycle.goals.map((g) => {
            const gm = GOAL_META[g.status];
            return (
              <li key={g.id} className="rounded-xl border border-border/70 bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={"inline-block h-2 w-2 rounded-full " + gm.dot} />
                      <span className="font-medium">{g.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{gm.label}</span>
                    </div>
                    <SmartLine goal={g} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SmartLine({ goal }: { goal: Goal }) {
  const parts: string[] = [];
  if (goal.specific)   parts.push(`S · ${goal.specific}`);
  if (goal.measurable) parts.push(`M · ${goal.measurable}`);
  if (goal.achievable) parts.push(`A · ${goal.achievable}`);
  if (goal.relevant)   parts.push(`R · ${goal.relevant}`);
  if (goal.timeBound)  parts.push(`T · ${goal.timeBound}`);
  if (!parts.length) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

function CycleDialog({ onClose }: { onClose: () => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<CycleStatus>("active");
  const [summary, setSummary] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/organization/${orgId}/cycles`, {
      method: "POST",
      body: {
        name, status, summary: summary || null,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycles", orgId] });
      toast.success("Ciclo criado.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Novo ciclo</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 2026 · Aceleração comercial" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CycleStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planejamento</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="closed">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Resumo (opcional)</Label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!name || !start || !end || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function GoalDialog({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [S, setS] = useState(""); const [M, setM] = useState("");
  const [A, setA] = useState(""); const [R, setR] = useState("");
  const [T, setT] = useState("");

  const save = useMutation({
    mutationFn: () => api(`/organization/${orgId}/cycles/${cycleId}/goals`, {
      method: "POST",
      body: {
        title,
        specific: S || null, measurable: M || null, achievable: A || null,
        relevant: R || null, timeBound: T || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycles", orgId] });
      toast.success("Meta adicionada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>Nova meta SMART</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fechar 12 novos contratos até setembro" /></div>
        <div><Label>S · Específica</Label><Textarea rows={2} value={S} onChange={(e) => setS(e.target.value)} placeholder="O que exatamente?" /></div>
        <div><Label>M · Mensurável</Label><Input value={M} onChange={(e) => setM(e.target.value)} placeholder="Ex.: 12 contratos, R$ 300k MRR" /></div>
        <div><Label>A · Atingível</Label><Input value={A} onChange={(e) => setA(e.target.value)} placeholder="Recursos, capacidade" /></div>
        <div><Label>R · Relevante</Label><Input value={R} onChange={(e) => setR(e.target.value)} placeholder="Por que agora?" /></div>
        <div><Label>T · Temporal</Label><Input value={T} onChange={(e) => setT(e.target.value)} placeholder="Ex.: até 30/09" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!title || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}