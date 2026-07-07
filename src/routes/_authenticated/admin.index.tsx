import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useAuth } from "@/lib/auth-context";
import {
  Building2, Store, Users, CreditCard, ArrowRight, KeyRound, Brain,
  TrendingUp, ClipboardCheck, Activity, DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type KPIs = {
  organizations: number;
  organizationsActive: number;
  organizationsImplantation: number;
  users: number;
  franchises: number;
  leaders: number;
  activeSubscriptions: number;
  activeLicenses: number;
  mrrCents: number;
  aiTokens30d: number;
  aiCostCents30d: number;
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminHome() {
  const { user } = useAuth();
  const kpis = useQuery({
    queryKey: ["admin", "kpis"],
    queryFn: () => api<KPIs>("/platform/kpis").catch(() => null),
  });
  const d = kpis.data;

  return (
    <>
      <AdminPageHeader
        title={`Olá, ${user?.fullName?.split(" ")[0] ?? "admin"}`}
        description="Painel global da plataforma LÍDER C.O.R.E. — hierarquia, receita, uso de IA e implantações."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Receita recorrente (MRR)" value={d ? fmtBRL(d.mrrCents) : "—"} accent />
        <Kpi icon={Store} label="Franquias" value={d?.franchises ?? "—"} />
        <Kpi icon={Building2} label="Empresas ativas" value={d ? `${d.organizationsActive} / ${d.organizations}` : "—"} />
        <Kpi icon={ClipboardCheck} label="Em implantação" value={d?.organizationsImplantation ?? "—"} />
        <Kpi icon={Users} label="Usuários" value={d?.users ?? "—"} />
        <Kpi icon={TrendingUp} label="Líderes" value={d?.leaders ?? "—"} />
        <Kpi icon={KeyRound} label="Licenças ativas" value={d?.activeLicenses ?? "—"} />
        <Kpi icon={CreditCard} label="Assinaturas ativas" value={d?.activeSubscriptions ?? "—"} />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            Consumo IA (últimos 30 dias)
            <Brain className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="mt-3 flex items-baseline gap-6">
            <div>
              <div className="font-display text-3xl">{d ? d.aiTokens30d.toLocaleString("pt-BR") : "—"}</div>
              <div className="text-xs text-muted-foreground">tokens</div>
            </div>
            <div>
              <div className="font-display text-3xl">{d ? fmtBRL(d.aiCostCents30d) : "—"}</div>
              <div className="text-xs text-muted-foreground">custo estimado</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            Atalhos
            <Activity className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="mt-3 grid gap-2">
            <Action to="/admin/franchises" label="Cadastrar franquia" />
            <Action to="/admin/organizations" label="Cadastrar empresa" />
            <Action to="/admin/onboarding" label="Ver implantações em andamento" />
            <Action to="/admin/logs" label="Auditoria" />
          </div>
        </div>
      </section>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof Building2; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="mt-3 font-display text-2xl">{value}</div>
    </div>
  );
}

function Action({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="group flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary">
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}