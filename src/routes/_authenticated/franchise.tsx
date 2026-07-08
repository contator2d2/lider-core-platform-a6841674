import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { TenantShell } from "@/components/tenant/TenantShell";
import { LayoutDashboard, Building2, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/franchise")({
  component: FranchiseLayout,
});

type FranchiseMembership = {
  role: string;
  franchise: {
    id: string;
    name: string;
    slug: string;
    plan: { name: string } | null;
    _count: { organizations: number; members: number };
  };
};

function FranchiseLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.roles?.includes("super_admin");

  const q = useQuery({
    queryKey: ["franchises", "mine"],
    queryFn: () => api<FranchiseMembership[]>("/franchises/mine"),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || q.isLoading) return;
    if (!isSuper && (!q.data || q.data.length === 0)) navigate({ to: "/app", replace: true });
  }, [user, q.isLoading, q.data, isSuper, navigate]);

  if (q.isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando franquia…</div>;

  const first = q.data?.[0];
  const scopeName = first?.franchise.name ?? (isSuper ? "Modo super admin" : "Nenhuma franquia");

  return (
    <TenantShell
      scopeLabel="Franquia"
      scopeName={scopeName}
      nav={[
        { to: "/franchise", label: "Dashboard", icon: LayoutDashboard },
        { to: "/franchise/companies", label: "Empresas vinculadas", icon: Building2 },
        { to: "/franchise/members", label: "Membros da franquia", icon: Users },
        { to: "/franchise/billing", label: "Cobrança e plano", icon: CreditCard },
      ]}
    />
  );
}
