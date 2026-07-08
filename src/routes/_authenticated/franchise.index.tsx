import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { KpiCard, TenantPageHeader } from "@/components/tenant/TenantShell";

export const Route = createFileRoute("/_authenticated/franchise/")({
  component: FranchiseDashboard,
});

type MineItem = {
  role: string;
  franchise: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: { name: string } | null;
    _count: { organizations: number; members: number };
  };
};

type Kpis = {
  organizations: number;
  organizationsActive: number;
  leaders: number;
  activeLicenses: number;
  members: number;
  aiTokens30d: number;
  aiCostCents30d: number;
};

function FranchiseDashboard() {
  const mine = useQuery({ queryKey: ["franchises", "mine"], queryFn: () => api<MineItem[]>("/franchises/mine") });
  const first = mine.data?.[0];
  const kpis = useQuery({
    queryKey: ["franchise", "kpis", first?.franchise.id],
    queryFn: () => api<Kpis>(`/franchises/${first!.franchise.id}/kpis`),
    enabled: !!first,
  });

  if (!first) {
    return (
      <TenantPageHeader eyebrow="Franquia" title="Sem franquia vinculada" description="Você ainda não é membro de nenhuma franquia." />
    );
  }

  const k = kpis.data;
  return (
    <>
      <TenantPageHeader
        eyebrow="Painel da franquia"
        title={first.franchise.name}
        description={`Status: ${first.franchise.status} · Plano: ${first.franchise.plan?.name ?? "—"} · seu papel: ${first.role}`}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Empresas" value={k?.organizations ?? "—"} hint={`${k?.organizationsActive ?? 0} ativas`} />
        <KpiCard label="Líderes" value={k?.leaders ?? "—"} />
        <KpiCard label="Licenças ativas" value={k?.activeLicenses ?? "—"} />
        <KpiCard label="Membros da franquia" value={k?.members ?? "—"} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <KpiCard label="Tokens IA (30d)" value={(k?.aiTokens30d ?? 0).toLocaleString("pt-BR")} />
        <KpiCard label="Custo IA (30d)" value={`R$ ${((k?.aiCostCents30d ?? 0) / 100).toFixed(2)}`} />
      </div>
    </>
  );
}
