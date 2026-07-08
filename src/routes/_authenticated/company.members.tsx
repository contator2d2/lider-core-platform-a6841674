import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { TenantPageHeader } from "@/components/tenant/TenantShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company/members")({ component: MembersPage });

type Detail = {
  memberships: Array<{
    id: string;
    role: string;
    user: { id: string; email: string; profile: { fullName: string | null } | null };
  }>;
};

function MembersPage() {
  const { user } = useAuth();
  const org = user?.memberships?.[0]?.organization;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["company", "detail", org?.id],
    queryFn: () => api<Detail>(`/companies/${org!.id}`),
    enabled: !!org,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", password: "", role: "collaborator" });
  const create = useMutation({
    mutationFn: () =>
      api(`/companies/${org!.id}/members`, {
        method: "POST",
        body: {
          email: form.email,
          fullName: form.fullName || undefined,
          password: form.password || undefined,
          role: form.role,
        },
      }),
    onSuccess: () => {
      toast.success("Colaborador adicionado");
      qc.invalidateQueries({ queryKey: ["company", "detail", org?.id] });
      setOpen(false);
      setForm({ email: "", fullName: "", password: "", role: "collaborator" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (userId: string) => api(`/companies/${org!.id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["company", "detail", org?.id] });
    },
  });

  if (!org) return null;
  return (
    <>
      <TenantPageHeader
        eyebrow="Equipe"
        title="Colaboradores"
        description="RH, gestores e outros colaboradores da empresa."
        action={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Novo colaborador</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader><SheetTitle>Adicionar colaborador</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-3">
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Nome (novo usuário)</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                <div><Label>Senha (novo usuário)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div>
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="franchise_owner">Dono / RH principal</SelectItem>
                      <SelectItem value="hr_admin">RH / Admin</SelectItem>
                      <SelectItem value="leader">Líder</SelectItem>
                      <SelectItem value="collaborator">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => create.mutate()} disabled={!form.email || create.isPending}>
                  {create.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nome</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Papel</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {q.data?.memberships.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{m.user.profile?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.user.email}</td>
                <td className="px-4 py-3"><span className="rounded bg-secondary px-2 py-0.5 text-xs">{m.role}</span></td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(m.user.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {q.data?.memberships.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum colaborador.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
