import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { KpiCard, TenantPageHeader } from "@/components/tenant/TenantShell";

export const Route = createFileRoute("/_authenticated/company/")({ component: CompanyDashboard });

type Kpis = {
  members: number;
  leaders: number;
  branches: number;
  areas: number;
  teams: number;
  activeLicenses: number;
  aiTokens30d: number;
  aiCostCents30d: number;
};

function CompanyDashboard() {
  const { user } = useAuth();
  const org = user?.memberships?.[0]?.organization;
  const q = useQuery({
    queryKey: ["company", "kpis", org?.id],
    queryFn: () => api<Kpis>(`/companies/${org!.id}/kpis`),
    enabled: !!org,
  });
  if (!org) return null;
  const k = q.data;
  return (
    <>
      <TenantPageHeader eyebrow="Painel da empresa" title={org.name} description={`Plano: ${org.plan}`} />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Colaboradores" value={k?.members ?? "—"} />
        <KpiCard label="Líderes" value={k?.leaders ?? "—"} />
        <KpiCard label="Licenças ativas" value={k?.activeLicenses ?? "—"} />
        <KpiCard label="Filiais" value={k?.branches ?? "—"} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <KpiCard label="Áreas" value={k?.areas ?? "—"} />
        <KpiCard label="Equipes" value={k?.teams ?? "—"} />
        <KpiCard label="Tokens IA (30d)" value={(k?.aiTokens30d ?? 0).toLocaleString("pt-BR")} hint={`R$ ${((k?.aiCostCents30d ?? 0) / 100).toFixed(2)}`} />
      </div>
    </>
  );
}
