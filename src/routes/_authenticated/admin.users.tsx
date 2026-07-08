import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Upload, Shield, ShieldOff, User as UserIcon, Trash2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

type UserRow = { id: string; email: string; fullName: string | null; roles: string[]; createdAt: string };

const ROLE_OPTIONS = [
  "super_admin",
  "neo_admin",
  "franchise_owner",
  "hr_admin",
  "leader",
  "collaborator",
] as const;
type Role = (typeof ROLE_OPTIONS)[number];

type Profile = {
  fullName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  phone: string | null;
  cpf: string | null;
  whatsapp: string | null;
  mfaEnabled: boolean;
  status: string;
  lastLoginAt: string | null;
};

type UserDetail = {
  id: string;
  email: string;
  createdAt: string;
  profile: Profile | null;
  roles: Role[];
  memberships: {
    id: string;
    organizationId: string;
    role: Role;
    branchId: string | null;
    areaId: string | null;
    teamId: string | null;
    directLeaderId: string | null;
    organization: { id: string; name: string; slug: string };
    branch: { id: string; name: string } | null;
    area: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
  }[];
};

type Org = { id: string; name: string };
type Branch = { id: string; name: string };
type Area = { id: string; name: string };
type Team = { id: string; name: string };

function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  // create form
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newName, setNewName] = useState("");

  const list = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api<UserRow[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const create = useMutation({
    mutationFn: () => api("/admin/users", { method: "POST", body: { email: newEmail, password: newPass, fullName: newName } }),
    onSuccess: () => {
      toast.success("Usuário criado.");
      setOpenCreate(false);
      setNewEmail(""); setNewPass(""); setNewName("");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Usuários"
        description="Cadastro global de usuários — perfil completo, papéis, vínculos com empresas, filiais, áreas e equipes."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="mr-1 h-4 w-4" /> Importar
            </Button>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" /> Novo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Nome completo</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Senha inicial (mín. 8)</Label><Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} minLength={8} /></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => create.mutate()} disabled={!newEmail || !newPass || !newName || create.isPending}>
                    {create.isPending ? "Criando…" : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email…" className="pl-9 max-w-md" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              <th className="px-4 py-3 text-left font-medium">Papéis</th>
              <th className="px-4 py-3 text-right font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">Nenhum usuário.</td></tr>}
            {list.data?.map((u) => (
              <tr
                key={u.id}
                onClick={() => { setSelectedId(u.id); setOpenDetail(true); }}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      {(u.fullName ?? u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{u.fullName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {u.roles.map((r) => (
                      <span key={r} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        {r === "super_admin" && <Shield className="h-3 w-3 text-accent" />}
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          open={openDetail}
          onOpenChange={(v) => { setOpenDetail(v); if (!v) setSelectedId(null); }}
        />
      )}

      <ImportDialog open={openImport} onOpenChange={setOpenImport} />
    </>
  );
}

// ============================================================
// Detail Drawer
// ============================================================
function UserDrawer({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => api<UserDetail>(`/platform/users/${userId}`),
  });

  const [p, setP] = useState<Partial<Profile>>({});
  const [dirty, setDirty] = useState(false);

  // sync when detail loads
  useMemo(() => {
    if (detail.data?.profile) { setP(detail.data.profile); setDirty(false); }
  }, [detail.data]);

  const saveProfile = useMutation({
    mutationFn: () => api(`/platform/users/${userId}/profile`, { method: "PATCH", body: p }),
    onSuccess: () => {
      toast.success("Perfil salvo.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRole = useMutation({
    mutationFn: (role: string) => api(`/admin/users/${userId}/roles`, { method: "POST", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "user", userId] }),
  });
  const removeRole = useMutation({
    mutationFn: (role: string) => api(`/admin/users/${userId}/roles/${role}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "user", userId] }),
  });

  const [newPass, setNewPass] = useState("");
  const resetPass = useMutation({
    mutationFn: () => api(`/platform/users/${userId}/password`, { method: "PATCH", body: { password: newPass } }),
    onSuccess: () => { toast.success("Senha redefinida."); setNewPass(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const u = detail.data;
  const roles = u?.roles ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {(u?.profile?.fullName ?? u?.email ?? "").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div>{u?.profile?.fullName ?? "Sem nome"}</div>
              <div className="text-xs font-normal text-muted-foreground">{u?.email}</div>
            </div>
          </SheetTitle>
          <SheetDescription>Cadastro completo, papéis globais e vínculos organizacionais.</SheetDescription>
        </SheetHeader>

        {!u ? <div className="mt-8 text-sm text-muted-foreground">Carregando…</div> : (
          <Tabs defaultValue="profile" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="roles">Papéis</TabsTrigger>
              <TabsTrigger value="memberships">Vínculos</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome completo">
                  <Input value={p.fullName ?? ""} onChange={(e) => { setP({ ...p, fullName: e.target.value }); setDirty(true); }} />
                </Field>
                <Field label="Cargo">
                  <Input value={p.jobTitle ?? ""} onChange={(e) => { setP({ ...p, jobTitle: e.target.value }); setDirty(true); }} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone">
                  <Input value={p.phone ?? ""} onChange={(e) => { setP({ ...p, phone: e.target.value }); setDirty(true); }} />
                </Field>
                <Field label="WhatsApp">
                  <Input value={p.whatsapp ?? ""} onChange={(e) => { setP({ ...p, whatsapp: e.target.value }); setDirty(true); }} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CPF">
                  <Input value={p.cpf ?? ""} onChange={(e) => { setP({ ...p, cpf: e.target.value }); setDirty(true); }} />
                </Field>
                <Field label="Avatar (URL)">
                  <Input value={p.avatarUrl ?? ""} onChange={(e) => { setP({ ...p, avatarUrl: e.target.value }); setDirty(true); }} />
                </Field>
              </div>
              <Field label="Status">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={p.status ?? "active"} onChange={(e) => { setP({ ...p, status: e.target.value }); setDirty(true); }}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="suspended">Suspenso</option>
                </select>
              </Field>
              <div className="text-xs text-muted-foreground">
                Último acesso: {u.profile?.lastLoginAt ? new Date(u.profile.lastLoginAt).toLocaleString("pt-BR") : "nunca"}
              </div>
              <Button className="w-full" disabled={!dirty || saveProfile.isPending} onClick={() => saveProfile.mutate()}>
                {saveProfile.isPending ? "Salvando…" : "Salvar perfil"}
              </Button>
            </TabsContent>

            <TabsContent value="roles" className="space-y-3 pt-4">
              <div className="text-xs text-muted-foreground">Papéis globais da plataforma. Permissões concedidas pela matriz RBAC.</div>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((r) => {
                  const has = roles.includes(r);
                  return (
                    <div key={r} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        {r === "super_admin" && <Shield className="h-4 w-4 text-accent" />}
                        <span className="text-sm">{r}</span>
                      </div>
                      <Switch checked={has} onCheckedChange={(v) => v ? addRole.mutate(r) : removeRole.mutate(r)} />
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="memberships" className="space-y-3 pt-4">
              <MembershipManager userId={userId} memberships={u.memberships} onChange={() => qc.invalidateQueries({ queryKey: ["admin", "user", userId] })} />
            </TabsContent>

            <TabsContent value="security" className="space-y-3 pt-4">
              <Field label="MFA">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">Autenticação em 2 fatores</span>
                  <Switch checked={!!p.mfaEnabled} onCheckedChange={(v) => { setP({ ...p, mfaEnabled: v }); setDirty(true); }} />
                </div>
              </Field>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Redefinir senha</Label>
                <div className="flex gap-2">
                  <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Nova senha (mín. 8)" minLength={8} />
                  <Button variant="outline" disabled={newPass.length < 8 || resetPass.isPending} onClick={() => resetPass.mutate()}>
                    <KeyRound className="mr-1 h-4 w-4" />
                    {resetPass.isPending ? "…" : "Redefinir"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Membership manager
// ============================================================
function MembershipManager({ userId, memberships, onChange }: { userId: string; memberships: UserDetail["memberships"]; onChange: () => void }) {
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations") });
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState<Role>("collaborator");
  const [branchId, setBranchId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [teamId, setTeamId] = useState("");

  const branches = useQuery({
    queryKey: ["platform", "branches", orgId],
    queryFn: () => api<Branch[]>(`/platform/organizations/${orgId}/branches`),
    enabled: !!orgId,
  });
  const areas = useQuery({
    queryKey: ["platform", "areas", orgId],
    queryFn: () => api<Area[]>(`/platform/organizations/${orgId}/areas`),
    enabled: !!orgId,
  });
  const teams = useQuery({
    queryKey: ["platform", "teams", orgId],
    queryFn: () => api<Team[]>(`/platform/organizations/${orgId}/teams`),
    enabled: !!orgId,
  });

  const upsert = useMutation({
    mutationFn: () =>
      api(`/platform/users/${userId}/memberships`, {
        method: "POST",
        body: {
          organizationId: orgId,
          role,
          branchId: branchId || null,
          areaId: areaId || null,
          teamId: teamId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Vínculo salvo.");
      setOrgId(""); setBranchId(""); setAreaId(""); setTeamId("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (organizationId: string) =>
      api(`/platform/users/${userId}/memberships/${organizationId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Vínculo removido."); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {memberships.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Sem vínculos.</div>}
        {memberships.map((m) => (
          <div key={m.id} className="flex items-start justify-between rounded-lg border border-border p-3">
            <div className="text-sm">
              <div className="font-medium">{m.organization.name}</div>
              <div className="text-xs text-muted-foreground">
                {[
                  m.role,
                  m.branch?.name && `Filial: ${m.branch.name}`,
                  m.area?.name && `Área: ${m.area.name}`,
                  m.team?.name && `Equipe: ${m.team.name}`,
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button onClick={() => remove.mutate(m.organizationId)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar / atualizar vínculo</div>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={orgId} onChange={(e) => { setOrgId(e.target.value); setBranchId(""); setAreaId(""); setTeamId(""); }}>
          <option value="">— Empresa —</option>
          {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!orgId}>
            <option value="">— Filial —</option>
            {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!orgId}>
            <option value="">— Área —</option>
            {areas.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!orgId}>
            <option value="">— Equipe —</option>
            {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <Button size="sm" className="w-full" disabled={!orgId || upsert.isPending} onClick={() => upsert.mutate()}>
          {upsert.isPending ? "…" : "Salvar vínculo"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Import CSV
// ============================================================
function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations"), enabled: open });
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState<"collaborator" | "leader" | "hr_admin">("collaborator");
  const [csv, setCsv] = useState("email,fullName,jobTitle,phone,whatsapp,cpf\njoao@empresa.com,João Silva,Gerente,,,\n");
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((ln) => {
      const cells = ln.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    }).filter((r) => r.email && r.fullName);
  };

  const run = useMutation({
    mutationFn: () => {
      const rows = parseCsv(csv);
      return api<{ created: number; updated: number; skipped: number }>("/platform/users/import", {
        method: "POST",
        body: { organizationId: orgId || undefined, defaultRole: role, rows },
      });
    },
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Importação concluída: ${r.created} novos, ${r.updated} atualizados, ${r.skipped} ignorados.`);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (f: File) => {
    const text = await f.text();
    setCsv(text);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar usuários (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Empresa (opcional — cria vínculo)">
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Papel padrão">
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as "collaborator" | "leader" | "hr_admin")}>
                <option value="collaborator">collaborator</option>
                <option value="leader">leader</option>
                <option value="hr_admin">hr_admin</option>
              </select>
            </Field>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Arquivo CSV</Label>
            <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-xs text-muted-foreground hover:bg-secondary">
              <Upload className="mr-2 h-4 w-4" /> Escolher arquivo .csv
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </div>
          <Field label="Prévia CSV (colunas: email, fullName, jobTitle, phone, whatsapp, cpf, password)">
            <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
          </Field>
          {result && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-500"><div className="text-lg font-semibold">{result.created}</div>criados</div>
              <div className="rounded-lg bg-blue-500/10 p-3 text-blue-500"><div className="text-lg font-semibold">{result.updated}</div>atualizados</div>
              <div className="rounded-lg bg-muted p-3 text-muted-foreground"><div className="text-lg font-semibold">{result.skipped}</div>ignorados</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending || !csv.trim()}>
            {run.isPending ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// keep icon import used
void UserIcon;