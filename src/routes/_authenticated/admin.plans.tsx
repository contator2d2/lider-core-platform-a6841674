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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { FEATURES_BY_CATEGORY, DEFAULT_LIMIT_FIELDS, findFeature, PLAN_FEATURES } from "@/lib/plan-features";

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
  target?: "organization" | "individual";
};

function formatMoney(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  active: boolean;
  features: string[];
  limits: Record<string, string>;
  target: "organization" | "individual";
};

const emptyForm: PlanForm = {
  name: "",
  slug: "",
  description: "",
  priceMonthly: 0,
  priceYearly: 0,
  currency: "BRL",
  active: true,
  features: [],
  limits: {},
  target: "organization",
};

function limitsToForm(l: Record<string, unknown> | null): Record<string, string> {
  if (!l) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(l)) {
    out[k] = v === null || v === undefined ? "" : String(v);
  }
  return out;
}

function limitsFromForm(f: Record<string, string>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v.trim() === "") out[k] = null;
    else {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

function PlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  const list = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api<Plan[]>("/admin/plans"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        priceMonthly: Number(form.priceMonthly) || 0,
        priceYearly: Number(form.priceYearly) || 0,
        currency: form.currency || "BRL",
        active: form.active,
        features: form.features,
        limits: limitsFromForm(form.limits),
        target: form.target,
      };
      return editing
        ? api<Plan>(`/admin/plans/${editing.id}`, { method: "PATCH", body })
        : api<Plan>("/admin/plans", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editing ? "Plano atualizado." : "Plano criado.");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
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

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      currency: p.currency ?? "BRL",
      active: p.active,
      features: p.features ?? [],
      limits: limitsToForm(p.limits),
      target: p.target ?? "organization",
    });
    setOpen(true);
  };

  const toggleFeature = (key: string) => {
    setForm((f) => ({
      ...f,
      features: f.features.includes(key)
        ? f.features.filter((k) => k !== key)
        : [...f.features, key],
    }));
  };

  const setLimit = (key: string, value: string) => {
    setForm((f) => ({ ...f, limits: { ...f.limits, [key]: value } }));
  };

  return (
    <>
      <AdminPageHeader
        title="Planos & Preços"
        description="Defina os planos, preços, limites e quais funcionalidades cada plano libera."
        action={
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Novo plano
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {list.data?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {p.slug}
                  {!p.active && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      inativo
                    </span>
                  )}
                </div>
                <div className="font-display text-xl">{p.name}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(p)}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Editar plano"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remover plano "${p.name}"?`)) remove.mutate(p.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  aria-label="Remover plano"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 font-display text-3xl">{formatMoney(p.priceMonthly, p.currency)}</div>
            <div className="text-xs text-muted-foreground">
              anual: {formatMoney(p.priceYearly, p.currency)}
            </div>
            {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
            <ul className="mt-4 space-y-1 text-sm">
              {(p.features ?? []).slice(0, 8).map((key) => {
                const def = findFeature(key);
                return (
                  <li key={key} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>{def?.label ?? key}</span>
                  </li>
                );
              })}
              {(p.features?.length ?? 0) > 8 && (
                <li className="text-xs text-muted-foreground">
                  + {(p.features?.length ?? 0) - 8} outras funcionalidades
                </li>
              )}
            </ul>
            {p.limits && Object.keys(p.limits).length > 0 && (
              <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                {Object.entries(p.limits).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span>{k}</span>
                    <span className="font-mono">{v === null ? "∞" : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditing(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar plano — ${editing.name}` : "Novo plano"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            {/* Identificação */}
            <section className="grid gap-3">
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
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
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
                <div className="space-y-1.5">
                  <Label>Moeda</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Plano ativo (visível para contratação)
              </label>
              <div className="space-y-1.5">
                <Label>Público-alvo</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value as "organization" | "individual" })}
                >
                  <option value="organization">Empresa / Franquia</option>
                  <option value="individual">Individual (líder pessoa física)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Planos individuais aparecem no upgrade pessoal do líder; planos de empresa aparecem no contrato da organização.
                </p>
              </div>
            </section>

            {/* Funcionalidades */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Funcionalidades incluídas</h3>
                  <p className="text-xs text-muted-foreground">
                    Marque o que este plano libera. {form.features.length} de {PLAN_FEATURES.length} selecionadas.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, features: PLAN_FEATURES.map((x) => x.key) }))}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    marcar tudo
                  </button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, features: [] }))}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    limpar
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {FEATURES_BY_CATEGORY.map(
                  (group) =>
                    group.items.length > 0 && (
                      <div key={group.category} className="rounded-lg border border-border bg-background/40 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.items.map((feat) => {
                            const on = form.features.includes(feat.key);
                            return (
                              <label
                                key={feat.key}
                                className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition-colors ${
                                  on ? "border-accent/60 bg-accent/5" : "border-border hover:bg-secondary/40"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleFeature(feat.key)}
                                  className="mt-0.5 h-4 w-4"
                                />
                                <span className="flex-1">
                                  <span className="block font-medium">{feat.label}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {feat.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ),
                )}
              </div>
            </section>

            {/* Limites */}
            <section>
              <h3 className="mb-1 text-sm font-semibold">Limites de uso</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Deixe em branco para ilimitado.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEFAULT_LIMIT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label>{f.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.limits[f.key] ?? ""}
                      onChange={(e) => setLimit(f.key, e.target.value)}
                      placeholder={f.hint}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.name || !form.slug || save.isPending}
            >
              {save.isPending
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Criar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}