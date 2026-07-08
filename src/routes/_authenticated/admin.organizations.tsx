import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Trash2, Building2, Users2, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  component: OrgsPage,
});

type Org = {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  legalName: string | null;
  tradeName: string | null;
  stateRegistration: string | null;
  segment: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  employeeCount: number | null;
  leaderCount: number | null;
  licenseCount: number | null;
  notes: string | null;
  plan: string;
  status: string;
  franchiseId: string | null;
  franchise: { name: string; slug: string } | null;
  _count: { memberships: number };
};
type Franchise = { id: string; name: string };

const EMPTY: Partial<Org> = {
  name: "",
  slug: "",
  cnpj: "",
  legalName: "",
  tradeName: "",
  stateRegistration: "",
  segment: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "BR",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  employeeCount: null,
  leaderCount: null,
  licenseCount: null,
  notes: "",
  franchiseId: null,
};

const STATUSES = ["trial", "active", "suspended", "canceled"] as const;
const SEGMENTS = ["Educação", "Saúde", "Varejo", "Indústria", "Serviços", "Tecnologia", "Financeiro", "ONG", "Outro"];

function OrgsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [franchiseFilter, setFranchiseFilter] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Org> | null>(null);

  const list = useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => api<Org[]>("/admin/organizations"),
  });
  const franchises = useQuery({
    queryKey: ["admin", "franchises", "brief"],
    queryFn: () => api<Franchise[]>("/admin/franchises"),
  });

  const filtered = useMemo(() => {
    const src = list.data ?? [];
    return src.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (franchiseFilter === "__direct__" && o.franchiseId) return false;
      if (franchiseFilter && franchiseFilter !== "__direct__" && o.franchiseId !== franchiseFilter) return false;
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        o.name.toLowerCase().includes(needle) ||
        o.slug.toLowerCase().includes(needle) ||
        (o.cnpj ?? "").includes(needle) ||
        (o.legalName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [list.data, q, statusFilter, franchiseFilter]);

  const save = useMutation({
    mutationFn: async (data: Partial<Org>) => {
      const payload = { ...data };
      // strip empty strings for optional fields; convert to null
      Object.keys(payload).forEach((k) => {
        const v = (payload as Record<string, unknown>)[k];
        if (v === "") (payload as Record<string, unknown>)[k] = null;
      });
      if (data.id) {
        return api<Org>(`/admin/organizations/${data.id}`, { method: "PATCH", body: payload });
      }
      return api<Org>("/admin/organizations", { method: "POST", body: payload });
    },
    onSuccess: (o) => {
      toast.success(editing?.id ? "Empresa atualizada." : "Empresa criada.");
      setDrawerOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
      void o;
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

  const openCreate = () => {
    setEditing({ ...EMPTY });
    setDrawerOpen(true);
  };
  const openEdit = (o: Org) => {
    setEditing({ ...o });
    setDrawerOpen(true);
  };

  const statusColor = (s: string) =>
    s === "active" ? "bg-emerald-500/15 text-emerald-500" : s === "trial" ? "bg-amber-500/15 text-amber-500" : s === "suspended" ? "bg-orange-500/15 text-orange-500" : "bg-muted text-muted-foreground";

  return (
    <>
      <AdminPageHeader
        title="Empresas"
        description="Cadastro completo de empresas — vinculadas a franquias ou diretas — com dados fiscais, endereço, contato e capacidade."
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Nova empresa
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, slug, CNPJ ou razão social…" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={franchiseFilter} onChange={(e) => setFranchiseFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todas as franquias</option>
          <option value="__direct__">— Diretas —</option>
          {franchises.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nenhuma empresa encontrada.
          </div>
        )}
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => openEdit(o)}
            className="group flex flex-col rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt="" className="h-10 w-10 rounded-lg border border-border object-contain bg-white" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div className="font-medium leading-tight">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.slug}</div>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusColor(o.status)}`}>{o.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Users2 className="h-3 w-3" />{o._count.memberships}</div>
              <div className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{o.plan}</div>
              <div className="truncate">{o.franchise?.name ?? "direta"}</div>
            </div>
            {(o.city || o.segment) && (
              <div className="mt-2 truncate text-xs text-muted-foreground">
                {[o.segment, o.city && o.state ? `${o.city}/${o.state}` : o.city].filter(Boolean).join(" · ")}
              </div>
            )}
          </button>
        ))}
      </div>

      <Sheet open={drawerOpen} onOpenChange={(v) => { setDrawerOpen(v); if (!v) setEditing(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Editar empresa" : "Nova empresa"}</SheetTitle>
            <SheetDescription>Preencha os dados completos para relatórios, faturamento e onboarding.</SheetDescription>
          </SheetHeader>

          {editing && (
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Identificação</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="address">Endereço</TabsTrigger>
                <TabsTrigger value="capacity">Capacidade</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3 pt-4">
                <Field label="Nome fantasia *">
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
                <Field label="Slug *">
                  <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Franquia (opcional)">
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editing.franchiseId ?? ""} onChange={(e) => setEditing({ ...editing, franchiseId: e.target.value || null })}>
                      <option value="">— Direta —</option>
                      {franchises.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editing.status ?? "trial"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Segmento">
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editing.segment ?? ""} onChange={(e) => setEditing({ ...editing, segment: e.target.value })}>
                    <option value="">— selecione —</option>
                    {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email de contato">
                    <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                  </Field>
                  <Field label="Website">
                    <Input value={editing.website ?? ""} onChange={(e) => setEditing({ ...editing, website: e.target.value })} placeholder="https://" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                  </Field>
                  <Field label="WhatsApp">
                    <Input value={editing.whatsapp ?? ""} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} />
                  </Field>
                </div>
                <Field label="Observações internas">
                  <Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                </Field>
              </TabsContent>

              <TabsContent value="fiscal" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CNPJ">
                    <Input value={editing.cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })} />
                  </Field>
                  <Field label="Inscrição estadual">
                    <Input value={editing.stateRegistration ?? ""} onChange={(e) => setEditing({ ...editing, stateRegistration: e.target.value })} />
                  </Field>
                </div>
                <Field label="Razão social">
                  <Input value={editing.legalName ?? ""} onChange={(e) => setEditing({ ...editing, legalName: e.target.value })} />
                </Field>
                <Field label="Nome comercial">
                  <Input value={editing.tradeName ?? ""} onChange={(e) => setEditing({ ...editing, tradeName: e.target.value })} />
                </Field>
              </TabsContent>

              <TabsContent value="address" className="space-y-3 pt-4">
                <Field label="Endereço">
                  <Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Cidade">
                    <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                  </Field>
                  <Field label="UF">
                    <Input maxLength={2} value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="CEP">
                    <Input value={editing.zipCode ?? ""} onChange={(e) => setEditing({ ...editing, zipCode: e.target.value })} />
                  </Field>
                </div>
                <Field label="País">
                  <Input value={editing.country ?? "BR"} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
                </Field>
              </TabsContent>

              <TabsContent value="capacity" className="space-y-3 pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Nº colaboradores">
                    <Input type="number" min={0} value={editing.employeeCount ?? ""} onChange={(e) => setEditing({ ...editing, employeeCount: e.target.value ? Number(e.target.value) : null })} />
                  </Field>
                  <Field label="Nº líderes">
                    <Input type="number" min={0} value={editing.leaderCount ?? ""} onChange={(e) => setEditing({ ...editing, leaderCount: e.target.value ? Number(e.target.value) : null })} />
                  </Field>
                  <Field label="Licenças contratadas">
                    <Input type="number" min={0} value={editing.licenseCount ?? ""} onChange={(e) => setEditing({ ...editing, licenseCount: e.target.value ? Number(e.target.value) : null })} />
                  </Field>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  Configure licenças reais na aba <strong>Licenças</strong>. Estes campos são apenas metadados comerciais.
                </div>
              </TabsContent>
            </Tabs>
          )}

          <SheetFooter className="mt-6 flex-row justify-between gap-2">
            {editing?.id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (confirm(`Remover "${editing.name}"?`)) {
                    remove.mutate(editing.id!);
                    setDrawerOpen(false);
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
              <Button onClick={() => editing && save.mutate(editing)} disabled={!editing?.name || !editing?.slug || save.isPending}>
                {save.isPending ? "Salvando…" : editing?.id ? "Salvar alterações" : "Criar empresa"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}