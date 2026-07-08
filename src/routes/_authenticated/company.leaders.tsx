import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { TenantPageHeader } from "@/components/tenant/TenantShell";

export const Route = createFileRoute("/_authenticated/company/leaders")({ component: LeadersPage });

type Leader = {
  id: string;
  role: string;
  user: { id: string; email: string; profile: { fullName: string | null; jobTitle: string | null } | null };
  branch: { name: string } | null;
  area: { name: string } | null;
  team: { name: string } | null;
};

function LeadersPage() {
  const { user } = useAuth();
  const org = user?.memberships?.[0]?.organization;
  const q = useQuery({
    queryKey: ["company", "leaders", org?.id],
    queryFn: () => api<Leader[]>(`/companies/${org!.id}/leaders`),
    enabled: !!org,
  });
  if (!org) return null;
  return (
    <>
      <TenantPageHeader
        eyebrow="Pessoas"
        title="Líderes"
        description="Usuários finais avaliados pela metodologia C.O.R.E."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.map((l) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-medium">{l.user.profile?.fullName ?? l.user.email}</div>
            <div className="text-xs text-muted-foreground">{l.user.email}</div>
            {l.user.profile?.jobTitle && <div className="mt-1 text-xs">{l.user.profile.jobTitle}</div>}
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {l.branch && <span className="rounded bg-secondary px-1.5 py-0.5">Filial: {l.branch.name}</span>}
              {l.area && <span className="rounded bg-secondary px-1.5 py-0.5">Área: {l.area.name}</span>}
              {l.team && <span className="rounded bg-secondary px-1.5 py-0.5">Equipe: {l.team.name}</span>}
            </div>
          </div>
        ))}
        {q.data && q.data.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum líder cadastrado.
          </div>
        )}
      </div>
    </>
  );
}
