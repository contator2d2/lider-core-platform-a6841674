import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsPage,
});

type Log = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { email: string; profile: { fullName: string | null } | null } | null;
};

function LogsPage() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const q = useQuery({
    queryKey: ["platform", "logs", action, targetType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (targetType) params.set("targetType", targetType);
      return api<Log[]>(`/platform/logs${params.size ? `?${params}` : ""}`);
    },
  });

  return (
    <>
      <AdminPageHeader
        title="Logs de auditoria"
        description="Todas as ações críticas — logins, criações, alterações, exclusões, uso de IA, faturas."
        action={
          <div className="flex gap-2">
            <Input placeholder="Ação (login, create…)" value={action} onChange={(e) => setAction(e.target.value)} className="w-48" />
            <Input placeholder="Tipo alvo (org, user…)" value={targetType} onChange={(e) => setTargetType(e.target.value)} className="w-40" />
          </div>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Quando</th>
              <th className="px-4 py-3 text-left font-medium">Ator</th>
              <th className="px-4 py-3 text-left font-medium">Ação</th>
              <th className="px-4 py-3 text-left font-medium">Alvo</th>
              <th className="px-4 py-3 text-left font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum log encontrado.</td></tr>}
            {q.data?.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{l.actor?.profile?.fullName ?? l.actor?.email ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded bg-secondary px-2 py-0.5 text-xs">{l.action}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.targetType ?? "—"} {l.targetId ? `· ${l.targetId.slice(0, 8)}…` : ""}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">{l.metadata ? JSON.stringify(l.metadata) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}