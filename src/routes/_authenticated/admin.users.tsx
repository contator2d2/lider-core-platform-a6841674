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
import { Plus, Shield, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

type U = { id: string; email: string; fullName: string | null; roles: string[]; createdAt: string };
const ROLE_OPTIONS = [
  "super_admin",
  "neo_admin",
  "franchise_owner",
  "hr_admin",
  "leader",
  "collaborator",
] as const;

function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const list = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api<U[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api("/admin/users", { method: "POST", body: { email, password, fullName } }),
    onSuccess: () => {
      toast.success("Usuário criado.");
      setOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api(`/admin/users/${id}/roles`, { method: "POST", body: { role } }),
    onSuccess: () => {
      toast.success("Papel atribuído.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api(`/admin/users/${id}/roles/${role}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Papel removido.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Usuários"
        description="Gestão global de contas e papéis (roles) da plataforma."
        action={
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> Novo usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo usuário</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Senha inicial</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!email || !password || !fullName || create.isPending}
                  >
                    {create.isPending ? "Criando..." : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              <th className="px-4 py-3 text-left font-medium">Papéis</th>
              <th className="px-4 py-3 text-left font-medium">Atribuir</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum usuário.
                </td>
              </tr>
            )}
            {list.data?.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.fullName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">sem papéis</span>
                    )}
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {r === "super_admin" && <Shield className="h-3 w-3 text-accent" />}
                        {r}
                        <button
                          onClick={() => removeRole.mutate({ id: u.id, role: r })}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remover"
                        >
                          <ShieldOff className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addRole.mutate({ id: u.id, role: e.target.value });
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">+ atribuir papel…</option>
                    {ROLE_OPTIONS.filter((r) => !u.roles.includes(r)).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}