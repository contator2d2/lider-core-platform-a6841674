import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/signup-plans")({
  head: () => ({ meta: [{ title: "Planos de Cadastro — Admin" }] }),
  component: SignupPlansAdmin,
});

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  targetRole: string;
  planTier: string;
  active: boolean;
  sortOrder: number;
};

const ROLES = [
  { value: "leader", label: "Líder" },
  { value: "collaborator", label: "Colaborador" },
  { value: "hr_admin", label: "RH / People" },
  { value: "franchise_owner", label: "Franqueado" },
  { value: "neo_admin", label: "Neo Admin" },
];
const TIERS = [
  { value: "essencial", label: "Essencial" },
  { value: "profissional", label: "Profissional" },
  { value: "enterprise", label: "Enterprise" },
];

function SignupPlansAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "signup-plans"],
    queryFn: () => api<{ plans: Plan[] }>("/admin/signup-plans"),
  });
  const plans = data?.plans ?? [];

  const [draft, setDraft] = useState({
    slug: "",
    name: "",
    description: "",
    targetRole: "leader",
    planTier: "essencial",
    active: true,
    sortOrder: 0,
  });

  const createMut = useMutation({
    mutationFn: () => api<Plan>("/admin/signup-plans", { method: "POST", body: draft }),
    onSuccess: () => {
      toast.success("Plano criado");
      setDraft({ slug: "", name: "", description: "", targetRole: "leader", planTier: "essencial", active: true, sortOrder: 0 });
      qc.invalidateQueries({ queryKey: ["admin", "signup-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (p: Plan) =>
      api<Plan>(`/admin/signup-plans/${p.id}`, {
        method: "PUT",
        body: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          targetRole: p.targetRole,
          planTier: p.planTier,
          active: p.active,
          sortOrder: p.sortOrder,
        },
      }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["admin", "signup-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/admin/signup-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["admin", "signup-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl">Planos de Cadastro</h1>
        <p className="text-sm text-muted-foreground">
          Presets que aparecem na tela de criação de conta. Cada plano aplica um papel — que já tem seu template de módulos definido em Templates de módulos.
        </p>
      </header>

      {/* Novo plano */}
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Criar novo plano</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Slug (url)</Label>
            <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} placeholder="lider-teste-v1" />
          </div>
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Líder — Teste Módulo C" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Papel aplicado</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={draft.targetRole}
              onChange={(e) => setDraft({ ...draft, targetRole: e.target.value })}
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Nível</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={draft.planTier}
              onChange={(e) => setDraft({ ...draft, planTier: e.target.value })}
            >
              {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Ordem</Label>
            <Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
            <span className="text-sm">Ativo</span>
          </div>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={!draft.slug || !draft.name || createMut.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Criar plano
        </Button>
      </section>

      {/* Lista */}
      <section className="space-y-3">
        <h2 className="font-medium">Planos existentes ({plans.length})</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {plans.map((p) => (
          <div key={p.id} className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={p.slug} onChange={(e) => updateLocal(p.id, { slug: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={p.name} onChange={(e) => updateLocal(p.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={p.description ?? ""} onChange={(e) => updateLocal(p.id, { description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Papel</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={p.targetRole}
                  onChange={(e) => updateLocal(p.id, { targetRole: e.target.value })}
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Nível</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={p.planTier}
                  onChange={(e) => updateLocal(p.id, { planTier: e.target.value })}
                >
                  {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={p.active} onCheckedChange={(v) => updateLocal(p.id, { active: v })} />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMut.mutate(p)}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remover "${p.name}"?`)) deleteMut.mutate(p.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );

  function updateLocal(id: string, patch: Partial<Plan>) {
    qc.setQueryData<{ plans: Plan[] }>(["admin", "signup-plans"], (old) => {
      if (!old) return old;
      return { plans: old.plans.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    });
  }
}