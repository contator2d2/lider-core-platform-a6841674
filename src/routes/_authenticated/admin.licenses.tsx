import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/licenses")({
  component: LicensesPage,
});

type License = {
  id: string;
  seats: number;
  status: string;
  activatedAt: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
  plan: { id: string; name: string };
  organization: { id: string; name: string; slug: string };
  _count: { assignments: number };
};
type Org = { id: string; name: string };
type Plan = { id: string; name: string };

const STATUSES = ["active", "suspended", "canceled", "expired"] as const;

function LicensesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["platform", "licenses"], queryFn: () => api<License[]>("/platform/licenses") });
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations") });
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api<Plan[]>("/admin/plans") });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ organizationId: "", planId: "", seats: 5, renewsAt: "" });

  const create = useMutation({
    mutationFn: () => api("/platform/licenses", {
      method: "POST",
      body: {
        organizationId: f.organizationId,
        planId: f.planId,
        seats: Number(f.seats),
        activatedAt: new Date().toISOString(),
        renewsAt: f.renewsAt ? new Date(f.renewsAt).toISOString() : null,
      },
    }),
    onSuccess: () => { toast.success("Licença emitida."); setOpen(false); setF({ organizationId: "", planId: "", seats: 5, renewsAt: "" }); qc.invalidateQueries({ queryKey: ["platform", "licenses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/platform/licenses/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Removida."); qc.invalidateQueries({ queryKey: ["platform", "licenses"] }); },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/platform/licenses/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "licenses"] }),
  });

  return (
    <>
      <AdminPageHeader
        title="Licenças"
        description="Cada licença aloca N assentos de um plano para uma empresa. Assentos são consumidos ao vincular usuários."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Nova licença</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Emitir licença</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Empresa</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.organizationId} onChange={(e) => setF({ ...f, organizationId: e.target.value })}>
                    <option value="">— selecione —</option>
                    {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Plano</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
                    <option value="">— selecione —</option>
                    {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Assentos</Label><Input type="number" min={1} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Renova em (opcional)</Label><Input type="date" value={f.renewsAt} onChange={(e) => setF({ ...f, renewsAt: e.target.value })} /></div>
              </div>
              <DialogFooter><Button disabled={!f.organizationId || !f.planId} onClick={() => create.mutate()}>Emitir</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Empresa</th>
              <th className="px-4 py-3 text-left font-medium">Plano</th>
              <th className="px-4 py-3 text-left font-medium">Assentos</th>
              <th className="px-4 py-3 text-left font-medium">Uso</th>
              <th className="px-4 py-3 text-left font-medium">Renova</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.data?.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma licença emitida.</td></tr>}
            {list.data?.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{l.organization.name}</td>
                <td className="px-4 py-3">{l.plan.name}</td>
                <td className="px-4 py-3">{l.seats}</td>
                <td className="px-4 py-3">{l._count.assignments} / {l.seats}</td>
                <td className="px-4 py-3">{l.renewsAt ? new Date(l.renewsAt).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-4 py-3">
                  <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={l.status} onChange={(e) => updateStatus.mutate({ id: l.id, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { if (confirm("Remover licença?")) remove.mutate(l.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}