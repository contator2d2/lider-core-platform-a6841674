import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  component: PermissionsPage,
});

type Grant = { role: string; resource: string; action: string };
type Matrix = { resources: string[]; actions: string[]; roles: string[]; grants: Grant[] };

function PermissionsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform", "permissions"], queryFn: () => api<Matrix>("/platform/permissions") });

  const set = useMemo(() => {
    const s = new Set<string>();
    q.data?.grants.forEach((g) => s.add(`${g.role}::${g.resource}::${g.action}`));
    return s;
  }, [q.data]);

  const toggle = useMutation({
    mutationFn: async ({ role, resource, action, enabled }: Grant & { enabled: boolean }) => {
      const body = { role, resource, action };
      if (enabled) await api("/platform/permissions", { method: "DELETE", body });
      else await api("/platform/permissions", { method: "POST", body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "permissions"] }),
  });

  if (!q.data) return <div className="p-8 text-sm text-muted-foreground">Carregando permissões…</div>;

  return (
    <>
      <AdminPageHeader
        title="Permissões (RBAC granular)"
        description="Matriz recurso × ação por papel. Aplicada no backend em todos os endpoints. Toque em uma célula para conceder / revogar."
      />
      <div className="space-y-8">
        {q.data.roles.map((role) => (
          <div key={role} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">{role}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 bg-secondary/50 px-3 py-2 text-left font-medium">Recurso</th>
                    {q.data!.actions.map((a) => <th key={a} className="px-2 py-2 text-center font-medium uppercase tracking-wider">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {q.data!.resources.map((r) => (
                    <tr key={r} className="border-t border-border">
                      <td className="sticky left-0 bg-card px-3 py-2 font-medium">{r}</td>
                      {q.data!.actions.map((a) => {
                        const key = `${role}::${r}::${a}`;
                        const enabled = set.has(key);
                        return (
                          <td key={a} className="px-2 py-1 text-center">
                            <button
                              onClick={() => toggle.mutate({ role, resource: r, action: a, enabled })}
                              className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition ${enabled ? "border-accent bg-accent text-accent-foreground" : "border-border text-transparent hover:border-accent/50"}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}