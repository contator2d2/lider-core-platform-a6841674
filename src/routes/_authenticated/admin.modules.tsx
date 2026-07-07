import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/modules")({
  component: ModulesPage,
});

type Module = { id: string; code: string; name: string; description: string | null; category: string; orderIndex: number; active: boolean };
type Plan = { id: string; name: string; slug: string };
type PlanModule = { moduleId: string; module: Module };

const CATEGORIES = ["core", "ia", "analytics", "people", "integrations"] as const;

function ModulesPage() {
  const qc = useQueryClient();
  const modules = useQuery({ queryKey: ["platform", "modules"], queryFn: () => api<Module[]>("/platform/modules") });
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api<Plan[]>("/admin/plans") });
  const [planId, setPlanId] = useState<string>("");
  const activePlanId = planId || plans.data?.[0]?.id || "";
  const planModules = useQuery({
    queryKey: ["platform", "plan-modules", activePlanId],
    queryFn: () => api<PlanModule[]>(`/platform/plans/${activePlanId}/modules`),
    enabled: !!activePlanId,
  });
  const enabledSet = useMemo(() => new Set(planModules.data?.map((p) => p.moduleId) ?? []), [planModules.data]);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", name: "", description: "", category: "core" as (typeof CATEGORIES)[number], orderIndex: 0 });

  const create = useMutation({
    mutationFn: () => api("/platform/modules", { method: "POST", body: f }),
    onSuccess: () => { toast.success("Módulo criado."); setOpen(false); setF({ code: "", name: "", description: "", category: "core", orderIndex: 0 }); qc.invalidateQueries({ queryKey: ["platform", "modules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) =>
      api(`/platform/plans/${activePlanId}/modules/${moduleId}`, { method: enabled ? "DELETE" : "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "plan-modules", activePlanId] }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Module[]>();
    for (const m of modules.data ?? []) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    return map;
  }, [modules.data]);

  return (
    <>
      <AdminPageHeader
        title="Módulos do produto"
        description="Catálogo de módulos habilitáveis por plano. À medida que novas funcionalidades são lançadas, cadastre aqui e libere no plano correspondente."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Novo módulo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo módulo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Código</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></div>
                <div className="space-y-1.5"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Categoria</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as (typeof CATEGORIES)[number] })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter><Button disabled={!f.code || !f.name} onClick={() => create.mutate()}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Label className="text-xs text-muted-foreground">Habilitar módulos no plano:</Label>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={activePlanId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat} className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</div>
            <div className="divide-y divide-border">
              {items.map((m) => {
                const enabled = enabledSet.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => activePlanId && toggle.mutate({ moduleId: m.id, enabled })}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                  >
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.description ?? m.code}</div>
                    </div>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${enabled ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                      {enabled && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}