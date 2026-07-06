import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/lib/auth-context";
import { Building2, Store, Users, Shield, CreditCard, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type Stats = {
  organizations: number;
  users: number;
  superAdmins: number;
  franchises: number;
  activeSubs: number;
};

function AdminHome() {
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<Stats>("/admin/stats").catch(() => null),
  });

  return (
    <>
      <AdminPageHeader
        title={`Olá, ${user?.fullName?.split(" ")[0] ?? "admin"}`}
        description="Painel global da plataforma LÍDER C.O.R.E. — franquias, empresas, usuários, planos e configurações."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Store} label="Franquias" value={stats.data?.franchises ?? "—"} />
        <StatCard icon={Building2} label="Empresas" value={stats.data?.organizations ?? "—"} />
        <StatCard icon={Users} label="Usuários" value={stats.data?.users ?? "—"} />
        <StatCard icon={Shield} label="Super admins" value={stats.data?.superAdmins ?? "—"} />
        <StatCard icon={CreditCard} label="Assinaturas ativas" value={stats.data?.activeSubs ?? "—"} />
      </section>

      <section className="mt-10 grid gap-3 md:grid-cols-2">
        <ActionCard
          title="Cadastrar franquia"
          description="Criar um novo tenant regional/parceiro."
          to="/admin/franchises"
        />
        <ActionCard
          title="Cadastrar empresa direta"
          description="Empresa sem franquia, vinculada à Neo."
          to="/admin/organizations"
        />
        <ActionCard
          title="Gerenciar planos"
          description="Preços, limites e features de cada plano."
          to="/admin/plans"
        />
        <ActionCard
          title="Provedor de IA"
          description="OpenAI ou Gemini — modelo e limites."
          to="/admin/ai"
        />
      </section>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="mt-3 font-display text-3xl">{value}</div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-6 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary"
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}