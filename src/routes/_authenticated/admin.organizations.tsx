import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  component: OrgsPage,
});

type Org = {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  plan: string;
  status: string;
  franchiseId: string | null;
  franchise: { name: string; slug: string } | null;
  _count: { memberships: number };
};
type Franchise = { id: string; name: string };

function OrgsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [franchiseId, setFranchiseId] = useState<string>("");

  const list = useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => api<Org[]>("/admin/organizations"),
  });
  const franchises = useQuery({
    queryKey: ["admin", "franchises", "brief"],
    queryFn: () => api<Franchise[]>("/admin/franchises"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Org>("/admin/organizations", {
        method: "POST",
        body: { name, slug, cnpj: cnpj || null, franchiseId: franchiseId || null },
      }),
    onSuccess: () => {
      toast.success("Empresa criada.");
      setOpen(false);
      setName("");
      setSlug("");
      setCnpj("");
      setFranchiseId("");
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/organizations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Empresa removida.");
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Empresas"
        description="Todas as empresas — vinculadas a franquias ou diretas."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ (opcional)</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Franquia (opcional — deixe vazio para empresa direta)</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={franchiseId}
                    onChange={(e) => setFranchiseId(e.target.value)}
                  >
                    <option value="">— Nenhuma (empresa direta) —</option>
                    {franchises.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!name || !slug || create.isPending}>
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
              <th className="px-4 py-3 text-left font-medium">Empresa</th>
              <th className="px-4 py-3 text-left font-medium">Franquia</th>
              <th className="px-4 py-3 text-left font-medium">Plano</th>
              <th className="px-4 py-3 text-left font-medium">Membros</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma empresa ainda.
                </td>
              </tr>
            )}
            {list.data?.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.slug}</div>
                </td>
                <td className="px-4 py-3">{o.franchise?.name ?? "— direta —"}</td>
                <td className="px-4 py-3">{o.plan}</td>
                <td className="px-4 py-3">{o._count.memberships}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{o.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      if (confirm(`Remover empresa "${o.name}"?`)) remove.mutate(o.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}