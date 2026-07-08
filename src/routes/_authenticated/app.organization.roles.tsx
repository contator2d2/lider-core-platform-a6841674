import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { IdCard, Plus, Star, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/roles")({
  component: RolesPage,
});

type Role = {
  id: string; title: string; mission: string | null; isLeader: boolean;
  responsibilities: string[]; deliverables: string[]; competencies: string[]; relationships: string[];
  contextMd: string | null; tags: string[];
  _count: { assignments: number };
};

function RolesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["org", "roles", orgId],
    queryFn: () => api<Role[]>(`/organization/${orgId}/roles`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (body: Partial<Role>) => api(`/organization/${orgId}/roles`, { method: "POST", body }),
    onSuccess: () => { toast.success("Cargo criado."); qc.invalidateQueries({ queryKey: ["org", "roles", orgId] }); setCreating(false); },
  });
  const patch = useMutation({
    mutationFn: (body: Partial<Role>) => api(`/organization/${orgId}/roles/${editing!.id}`, { method: "PATCH", body }),
    onSuccess: () => { toast.success("Cargo atualizado."); qc.invalidateQueries({ queryKey: ["org", "roles", orgId] }); setEditing(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["org", "roles", orgId] }); },
  });

  if (!orgId) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Novo cargo</Button></DialogTrigger>
          <DialogContent><RoleDialog onSave={(v) => create.mutate(v)} saving={create.isPending} /></DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.map((r) => (
          <div key={r.id} className="group rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <button className="text-left" onClick={() => setEditing(r)}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <IdCard className="h-3.5 w-3.5" /> Cargo
                  {r.isLeader && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200 flex items-center gap-1"><Star className="h-2.5 w-2.5" /> Líder</span>}
                </div>
                <div className="mt-2 font-display text-xl">{r.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.mission ?? "Sem missão."}</div>
                <div className="mt-3 text-xs text-muted-foreground">{r.responsibilities.length} responsabilidades · {r._count.assignments} atribuições</div>
              </button>
              <button
                onClick={() => { if (confirm(`Remover ${r.title}?`)) remove.mutate(r.id); }}
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              ><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {q.data?.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Ainda não há cargos definidos. Cadastre o primeiro para preparar a base para IA.
          </div>
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing?.title}</SheetTitle></SheetHeader>
          {editing && <RoleDialog key={editing.id} initial={editing} onSave={(v) => patch.mutate(v)} saving={patch.isPending} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RoleDialog({ initial, onSave, saving }: { initial?: Role; onSave: (v: Partial<Role>) => void; saving: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [mission, setMission] = useState(initial?.mission ?? "");
  const [isLeader, setIsLeader] = useState(initial?.isLeader ?? false);
  const [responsibilities, setResponsibilities] = useState((initial?.responsibilities ?? []).join("\n"));
  const [deliverables, setDeliverables] = useState((initial?.deliverables ?? []).join("\n"));
  const [competencies, setCompetencies] = useState((initial?.competencies ?? []).join(", "));
  const [contextMd, setContextMd] = useState(initial?.contextMd ?? "");

  return (
    <div className="mt-2 space-y-4">
      {!initial && <DialogHeader><DialogTitle>Novo cargo</DialogTitle></DialogHeader>}
      <div className="space-y-1.5"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Missão</Label><Textarea rows={2} value={mission} onChange={(e) => setMission(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isLeader} onChange={(e) => setIsLeader(e.target.checked)} />
        Cargo de liderança
      </label>
      <div className="space-y-1.5"><Label>Responsabilidades (uma por linha)</Label><Textarea rows={4} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Entregas esperadas (uma por linha)</Label><Textarea rows={3} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Competências (separadas por vírgula)</Label><Input value={competencies} onChange={(e) => setCompetencies(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Contexto para IA</Label><Textarea rows={3} value={contextMd} onChange={(e) => setContextMd(e.target.value)} /></div>
      <DialogFooter>
        <Button disabled={!title || saving} onClick={() => onSave({
          title, mission: mission || null, isLeader,
          responsibilities: responsibilities.split("\n").map((s) => s.trim()).filter(Boolean),
          deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          competencies: competencies.split(",").map((s) => s.trim()).filter(Boolean),
          contextMd: contextMd || null,
        })}>{saving ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </div>
  );
}
