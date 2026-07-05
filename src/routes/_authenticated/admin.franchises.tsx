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

export const Route = createFileRoute("/_authenticated/admin/franchises")({
  component: FranchisesPage,
});

type Franchise = {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  status: string;
  createdAt: string;
  plan: { name: string; slug: string } | null;
  owner: { email: string; profile: { fullName: string | null } | null } | null;
  _count: { organizations: number; members: number };
};

function FranchisesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");

  const list = useQuery({
    queryKey: ["admin", "franchises"],
    queryFn: () => api<Franchise[]>("/admin/franchises"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Franchise>("/admin/franchises", {
        method: "POST",
        body: { name, slug, cnpj: cnpj || null },
      }),
    onSuccess: () => {
      toast.success("Franquia criada.");
      setOpen(false);
      setName("");
      setSlug("");
      setCnpj("");
      qc.invalidateQueries({ queryKey: ["admin", "franchises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/franchises/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Franquia removida.");
      qc.invalidateQueries({ queryKey: ["admin", "franchises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Franquias"
        description="Tenants regionais e parceiros que revendem a plataforma."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Nova franquia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova franquia</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="minha-franquia"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ (opcional)</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!name || !slug || create.isPending}
                >
                  {create.isPending ? "Criando..." : "Criar franquia"}
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
              <Th>Franquia</Th>
              <Th>Plano</Th>
              <Th>Empresas</Th>
              <Th>Membros</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma franquia cadastrada ainda.
                </td>
              </tr>
            )}
            {list.data?.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <Td>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.slug}</div>
                </Td>
                <Td>{f.plan?.name ?? "—"}</Td>
                <Td>{f._count.organizations}</Td>
                <Td>{f._count.members}</Td>
                <Td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      f.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : f.status === "trial"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.status}
                  </span>
                </Td>
                <Td>
                  <button
                    onClick={() => {
                      if (confirm(`Remover franquia "${f.name}"?`)) remove.mutate(f.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}