import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScrollText, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/decisions")({
  component: DecisionsPage,
});

type Decision = {
  id: string; title: string; context: string | null; decision: string;
  status: "open" | "in_progress" | "done" | "reverted";
  dueAt: string | null; expectedResult: string | null; createdAt: string; tags: string[];
};

const STATUS = [
  { v: "open", l: "Aberta" }, { v: "in_progress", l: "Em execução" },
  { v: "done", l: "Concluída" }, { v: "reverted", l: "Revertida" },
] as const;

function DecisionsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["org", "decisions", orgId],
    queryFn: () => api<Decision[]>(`/organization/${orgId}/decisions`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/organization/${orgId}/decisions`, { method: "POST", body }),
    onSuccess: () => { toast.success("Decisão registrada."); qc.invalidateQueries({ queryKey: ["org", "decisions", orgId] }); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/organization/${orgId}/decisions/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org", "decisions", orgId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Nova decisão</Button></DialogTrigger>
          <DialogContent><CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} /></DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {q.data?.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <ScrollText className="h-3.5 w-3.5" /> {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                </div>
                <div className="mt-1 font-display text-xl">{d.title}</div>
                {d.context && <div className="mt-2 text-sm text-muted-foreground"><b>Contexto:</b> {d.context}</div>}
                <div className="mt-2 text-sm"><b>Decisão:</b> {d.decision}</div>
                {d.expectedResult && <div className="mt-2 text-sm text-muted-foreground"><b>Resultado esperado:</b> {d.expectedResult}</div>}
                {d.dueAt && <div className="mt-2 text-xs text-muted-foreground">Prazo: {new Date(d.dueAt).toLocaleDateString("pt-BR")}</div>}
              </div>
              <select
                value={d.status}
                onChange={(e) => patch.mutate({ id: d.id, body: { status: e.target.value } })}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
        ))}
        {q.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Toda reunião gera decisões. Registre a primeira para começar a memória da sua liderança.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateForm({ onSave, saving }: { onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [decision, setDecision] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [dueAt, setDueAt] = useState("");
  return (
    <div className="space-y-4">
      <DialogHeader><DialogTitle>Nova decisão</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Contexto</Label><Textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Decisão tomada</Label><Textarea rows={3} value={decision} onChange={(e) => setDecision(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Resultado esperado</Label><Textarea rows={2} value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
      <DialogFooter>
        <Button disabled={!title || !decision || saving} onClick={() => onSave({
          title, context: context || null, decision,
          expectedResult: expectedResult || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        })}>{saving ? "Salvando…" : "Registrar"}</Button>
      </DialogFooter>
    </div>
  );
}
