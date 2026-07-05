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

export const Route = createFileRoute("/_authenticated/admin/methodology")({
  component: MethodologyPage,
});

type Comp = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  orderIndex: number;
  active: boolean;
};

function MethodologyPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "", weight: 1, orderIndex: 0 });

  const list = useQuery({ queryKey: ["admin", "methodology"], queryFn: () => api<Comp[]>("/admin/methodology") });
  const create = useMutation({
    mutationFn: () => api("/admin/methodology", { method: "POST", body: form }),
    onSuccess: () => {
      toast.success("Competência criada.");
      setOpen(false);
      setForm({ code: "", name: "", description: "", weight: 1, orderIndex: 0 });
      qc.invalidateQueries({ queryKey: ["admin", "methodology"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/methodology/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "methodology"] });
    },
  });

  return (
    <>
      <AdminPageHeader
        title="Metodologia C.O.R.E."
        description="Competências que compõem o Score de Liderança."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Nova competência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova competência</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                    <Label>Peso</Label>
                    <Input
                      type="number"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ordem</Label>
                    <Input
                      type="number"
                      value={form.orderIndex}
                      onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.code || !form.name || create.isPending}>
                  {create.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-3">
        {list.data?.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.code}</div>
              <div className="font-medium">{c.name}</div>
              {c.description && <div className="text-sm text-muted-foreground">{c.description}</div>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-muted-foreground">peso {c.weight}</div>
              <button
                onClick={() => {
                  if (confirm(`Remover "${c.name}"?`)) remove.mutate(c.id);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}