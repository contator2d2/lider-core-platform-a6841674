import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/neo/audit")({
  component: Page,
});

type AuditEntry = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  diff: unknown;
  createdAt: string;
  actorId: string | null;
};

function Page() {
  const q = useQuery<AuditEntry[]>({
    queryKey: ["/admin/neo/audit"],
    queryFn: () => api("/admin/neo/audit"),
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Neo · Auditoria"
        title="Trilha de mudanças"
        description="Cada criação, alteração e remoção nos módulos da inteligência Neo é registrada aqui — quem, quando e o quê mudou."
      />
      <div className="overflow-hidden rounded-2xl border neo-hairline bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b neo-hairline bg-[color:var(--neo-cream)]">
              <th className="px-4 py-3 text-left neo-eyebrow">Quando</th>
              <th className="px-4 py-3 text-left neo-eyebrow">Entidade</th>
              <th className="px-4 py-3 text-left neo-eyebrow">Ação</th>
              <th className="px-4 py-3 text-left neo-eyebrow">ID do registro</th>
              <th className="px-4 py-3 text-left neo-eyebrow">Autor</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[color:var(--neo-muted)]">Carregando…</td></tr>
            ) : !q.data || q.data.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--neo-muted)]">Sem eventos ainda.</td></tr>
            ) : (
              q.data.map((e) => (
                <tr key={e.id} className="border-b neo-hairline last:border-none">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">{e.entity}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border neo-hairline bg-[color:var(--neo-cream)] px-2 py-0.5 text-[11px] uppercase tracking-wider">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--neo-muted)]">{e.entityId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-[color:var(--neo-muted)]">{e.actorId?.slice(0, 8) ?? "sistema"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}