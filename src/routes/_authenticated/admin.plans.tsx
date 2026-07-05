import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: PlansPage,
});

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  limits: Record<string, unknown> | null;
  active: boolean;
};

function formatMoney(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function PlansPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    priceMonthly: 0,
    priceYearly: 0,
    features: "",
  });

  const list = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api<Plan[]>("/admin/plans"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Plan>("/admin/plans", {
        method: "POST",
        body: {
          ...form,
          features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Plano criado.");
      setOpen(false);
      setForm({ name: "", slug: "", description: "", priceMonthly: 0, priceYearly: 0, features: "" });
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Plano removido.");
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Planos & Preços"
        description="Defina os planos que franquias e empresas podem contratar."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Novo plano
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo plano</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) =>
                        setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Preço mensal (centavos)</Label>
                    <Input
                      type="number"
                      value={form.priceMonthly}
                      onChange={(e) => setForm({ ...form, priceMonthly: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço anual (centavos)</Label>
                    <Input
                      type="number"
                      value={form.priceYearly}
                      onChange={(e) => setForm({ ...form, priceYearly: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Features (uma por linha)</Label>
                  <Textarea
                    rows={4}
                    value={form.features}
                    onChange={(e) => setForm({ ...form, features: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.name || !form.slug || create.isPending}
                >
                  {create.isPending ? "Criando..." : "Criar plano"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {list.data?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{p.slug}</div>
                <div className="font-display text-xl">{p.name}</div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remover plano "${p.name}"?`)) remove.mutate(p.id);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 font-display text-3xl">{formatMoney(p.priceMonthly, p.currency)}</div>
            <div className="text-xs text-muted-foreground">
              anual: {formatMoney(p.priceYearly, p.currency)}
            </div>
            {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
            <ul className="mt-4 space-y-1 text-sm">
              {p.features.map((f, i) => (
                <li key={i} className="text-muted-foreground">
                  • {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}