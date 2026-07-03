import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { LogOut, Shield, Building2, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminHome,
});

type AdminStats = {
  organizations: number;
  users: number;
  superAdmins: number;
};

function AdminHome() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isSuperAdmin = user?.roles?.includes("super_admin");

  useEffect(() => {
    if (user && !isSuperAdmin) navigate({ to: "/app", replace: true });
  }, [user, isSuperAdmin, navigate]);

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<AdminStats>("/admin/stats").catch(() => null),
    enabled: !!isSuperAdmin,
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    toast.success("Até logo.");
    navigate({ to: "/auth", replace: true });
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-auto max-w-[160px]" />
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Ver como líder →
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Painel Global · Neo Pessoas
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
          Bem-vindo,{" "}
          <span className="italic text-accent">
            {user?.fullName?.split(" ")[0] ?? "admin"}
          </span>
        </h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Você tem acesso total à plataforma LÍDER C.O.R.E. Gerencie organizações,
          usuários e configurações globais.
        </p>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Building2}
            label="Organizações"
            value={stats.data?.organizations ?? "—"}
          />
          <StatCard
            icon={Users}
            label="Usuários"
            value={stats.data?.users ?? "—"}
          />
          <StatCard
            icon={Shield}
            label="Super admins"
            value={stats.data?.superAdmins ?? "—"}
          />
        </section>

        <section className="mt-10 grid gap-3">
          <AdminAction
            title="Organizações"
            description="Criar, editar e suspender tenants."
            to="/admin"
          />
          <AdminAction
            title="Usuários & Papéis"
            description="Promover super admins, gerenciar acessos globais."
            to="/admin"
          />
          <AdminAction
            title="Consumo de IA"
            description="Monitorar uso por organização, limites e billing."
            to="/admin"
          />
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Módulos administrativos entram na Fase 3 do roadmap. Este painel é o
          ponto de entrada — cada card vira uma tela dedicada conforme priorizarmos.
        </p>
      </main>
    </div>
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

function AdminAction({
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