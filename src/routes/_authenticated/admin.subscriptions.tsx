import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: SubsPage,
});

type Sub = {
  id: string;
  ownerType: string;
  ownerId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  plan: { name: string; slug: string };
};
type Plan = { id: string; name: string };
type Franchise = { id: string; name: string };
type Org = { id: string; name: string };

function SubsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ownerType, setOwnerType] = useState<"franchise" | "organization">("franchise");
  const [ownerId, setOwnerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<"trial" | "active" | "past_due" | "canceled">("active");

  const list = useQuery({ queryKey: ["admin", "subs"], queryFn: () => api<Sub[]>("/admin/subscriptions") });
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api<Plan[]>("/admin/plans") });
  const franchises = useQuery({
    queryKey: ["admin", "franchises"],
    queryFn: () => api<Franchise[]>("/admin/franchises"),
  });
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations") });

  const create = useMutation({
    mutationFn: () =>
      api("/admin/subscriptions", {
        method: "POST",
        body: { ownerType, ownerId, planId, status },
      }),
    onSuccess: () => {
      toast.success("Assinatura criada.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/admin/subscriptions/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["admin", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownerName = (s: Sub) => {
    if (s.ownerType === "franchise") return franchises.data?.find((f) => f.id === s.ownerId)?.name ?? s.ownerId;
    return orgs.data?.find((o) => o.id === s.ownerId)?.name ?? s.ownerId;
  };

  return (
    <>
      <AdminPageHeader
        title="Assinaturas & Licenças"
        description="Vincule planos a franquias ou empresas. Cobrança manual por enquanto — Stripe/Paddle plugáveis."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Nova assinatura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova assinatura</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de titular</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ownerType}
                    onChange={(e) => {
                      setOwnerType(e.target.value as "franchise" | "organization");
                      setOwnerId("");
                    }}
                  >
                    <option value="franchise">Franquia</option>
                    <option value="organization">Empresa</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Titular</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {(ownerType === "franchise" ? franchises.data : orgs.data)?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plano</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {plans.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Ativa</option>
                    <option value="past_due">Inadimplente</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!ownerId || !planId || create.isPending}
                >
                  {create.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Titular</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Plano</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Vigência</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma assinatura ainda.
                </td>
              </tr>
            )}
            {list.data?.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{ownerName(s)}</td>
                <td className="px-4 py-3">{s.ownerType}</td>
                <td className="px-4 py-3">{s.plan.name}</td>
                <td className="px-4 py-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={s.status}
                    onChange={(e) => setStatusMut.mutate({ id: s.id, status: e.target.value })}
                  >
                    <option value="trial">trial</option>
                    <option value="active">active</option>
                    <option value="past_due">past_due</option>
                    <option value="canceled">canceled</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {s.currentPeriodStart?.slice(0, 10) ?? "—"} →{" "}
                  {s.currentPeriodEnd?.slice(0, 10) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}