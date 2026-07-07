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
import { Plus, Trash2, Building2, Network, Users2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hierarchy")({
  component: HierarchyPage,
});

type Org = { id: string; name: string; slug: string };
type Branch = { id: string; name: string; code: string | null; city: string | null; active: boolean; _count: { areas: number; memberships: number } };
type Area = { id: string; name: string; branch: { id: string; name: string } | null; _count: { teams: number; memberships: number } };
type Team = { id: string; name: string; area: { id: string; name: string }; _count: { memberships: number } };

function HierarchyPage() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations") });
  const [orgId, setOrgId] = useState<string>("");
  const activeOrg = useMemo(() => orgs.data?.find((o) => o.id === orgId) ?? orgs.data?.[0], [orgs.data, orgId]);
  const currentOrgId = activeOrg?.id ?? "";

  const branches = useQuery({
    queryKey: ["platform", "branches", currentOrgId],
    queryFn: () => api<Branch[]>(`/platform/organizations/${currentOrgId}/branches`),
    enabled: !!currentOrgId,
  });
  const areas = useQuery({
    queryKey: ["platform", "areas", currentOrgId],
    queryFn: () => api<Area[]>(`/platform/organizations/${currentOrgId}/areas`),
    enabled: !!currentOrgId,
  });
  const teams = useQuery({
    queryKey: ["platform", "teams", currentOrgId],
    queryFn: () => api<Team[]>(`/platform/organizations/${currentOrgId}/teams`),
    enabled: !!currentOrgId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform", "branches", currentOrgId] });
    qc.invalidateQueries({ queryKey: ["platform", "areas", currentOrgId] });
    qc.invalidateQueries({ queryKey: ["platform", "teams", currentOrgId] });
  };

  return (
    <>
      <AdminPageHeader
        title="Hierarquia interna"
        description="Filiais, áreas e equipes de cada empresa. Reutilizado por indicadores, PDIs, feedbacks e 1:1."
        action={
          <select
            value={currentOrgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        }
      />

      {!currentOrgId ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Cadastre uma empresa primeiro em <b>Empresas</b>.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <BranchesCard orgId={currentOrgId} data={branches.data ?? []} onChanged={invalidate} />
          <AreasCard orgId={currentOrgId} branches={branches.data ?? []} data={areas.data ?? []} onChanged={invalidate} />
          <TeamsCard orgId={currentOrgId} areas={areas.data ?? []} data={teams.data ?? []} onChanged={invalidate} />
        </div>
      )}
    </>
  );
}

function Card({ icon: Icon, title, action, children }: { icon: typeof Building2; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        {action}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function BranchesCard({ orgId, data, onChanged }: { orgId: string; data: Branch[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [city, setCity] = useState("");
  const create = useMutation({
    mutationFn: () => api(`/platform/organizations/${orgId}/branches`, { method: "POST", body: { name, code: code || null, city: city || null } }),
    onSuccess: () => { toast.success("Filial criada."); setOpen(false); setName(""); setCode(""); setCity(""); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/platform/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Removida."); onChanged(); },
  });
  return (
    <Card icon={Building2} title={`Filiais (${data.length})`} action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova filial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={!name} onClick={() => create.mutate()}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      {data.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma filial.</div>}
      {data.map((b) => (
        <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <div className="text-sm font-medium">{b.name}</div>
            <div className="text-xs text-muted-foreground">{b.code ?? "—"} · {b.city ?? "—"} · {b._count.areas} áreas · {b._count.memberships} pessoas</div>
          </div>
          <button onClick={() => { if (confirm(`Remover "${b.name}"?`)) remove.mutate(b.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </Card>
  );
}

function AreasCard({ orgId, branches, data, onChanged }: { orgId: string; branches: Branch[]; data: Area[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [branchId, setBranchId] = useState<string>("");
  const create = useMutation({
    mutationFn: () => api(`/platform/organizations/${orgId}/areas`, { method: "POST", body: { name, branchId: branchId || null } }),
    onSuccess: () => { toast.success("Área criada."); setOpen(false); setName(""); setBranchId(""); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/platform/areas/${id}`, { method: "DELETE" }), onSuccess: () => { toast.success("Removida."); onChanged(); } });
  return (
    <Card icon={Network} title={`Áreas (${data.length})`} action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova área</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Financeiro, RH, Comercial" /></div>
            <div className="space-y-1.5"><Label>Filial (opcional)</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">— Matriz —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter><Button disabled={!name} onClick={() => create.mutate()}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      {data.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma área.</div>}
      {data.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <div className="text-sm font-medium">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.branch?.name ?? "Matriz"} · {a._count.teams} equipes · {a._count.memberships} pessoas</div>
          </div>
          <button onClick={() => { if (confirm(`Remover "${a.name}"?`)) remove.mutate(a.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </Card>
  );
}

function TeamsCard({ orgId, areas, data, onChanged }: { orgId: string; areas: Area[]; data: Team[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [areaId, setAreaId] = useState<string>("");
  const create = useMutation({
    mutationFn: () => api(`/platform/organizations/${orgId}/teams`, { method: "POST", body: { name, areaId } }),
    onSuccess: () => { toast.success("Equipe criada."); setOpen(false); setName(""); setAreaId(""); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/platform/teams/${id}`, { method: "DELETE" }), onSuccess: () => { toast.success("Removida."); onChanged(); } });
  return (
    <Card icon={Users2} title={`Equipes (${data.length})`} action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" variant="outline" disabled={areas.length === 0}><Plus className="h-3.5 w-3.5" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova equipe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Área</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">— selecione —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter><Button disabled={!name || !areaId} onClick={() => create.mutate()}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      {data.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma equipe.</div>}
      {data.map((t) => (
        <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <div className="text-sm font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.area.name} · {t._count.memberships} pessoas</div>
          </div>
          <button onClick={() => { if (confirm(`Remover "${t.name}"?`)) remove.mutate(t.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </Card>
  );
}