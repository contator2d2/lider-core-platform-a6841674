import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { TenantShell } from "@/components/tenant/TenantShell";
import { LayoutDashboard, Users, UserCheck, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company")({ component: CompanyLayout });

function CompanyLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.roles?.includes("super_admin");
  const primary = user?.memberships?.find((m) => ["franchise_owner", "hr_admin"].includes(m.role)) ?? user?.memberships?.[0];

  useEffect(() => {
    if (!user) return;
    if (!isSuper && !primary) navigate({ to: "/app", replace: true });
  }, [user, isSuper, primary, navigate]);

  const scopeName = primary?.organization.name ?? "Empresa";

  return (
    <TenantShell
      scopeLabel="Empresa"
      scopeName={scopeName}
      nav={[
        { to: "/company", label: "Dashboard", icon: LayoutDashboard },
        { to: "/company/members", label: "Colaboradores", icon: Users },
        { to: "/company/leaders", label: "Líderes", icon: UserCheck },
        { to: "/admin/branding", label: "Configurações", icon: Settings2 },
      ]}
    />
  );
}
