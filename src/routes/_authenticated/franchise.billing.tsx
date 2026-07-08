import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TenantPageHeader } from "@/components/tenant/TenantShell";

export const Route = createFileRoute("/_authenticated/franchise/billing")({ component: Billing });

type Mine = { role: string; franchise: { id: string; name: string; plan: { id: string; name: string; priceMonthly: number } | null; status: string } };

function Billing() {
  const mine = useQuery({ queryKey: ["franchises", "mine"], queryFn: () => api<Mine[]>("/franchises/mine") });
  const first = mine.data?.[0];
  if (!first) return null;
  const plan = first.franchise.plan;
  return (
    <>
      <TenantPageHeader
        eyebrow="Comercial"
        title="Cobrança e plano"
        description="Plano contratado desta franquia e faturas em aberto."
      />
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Plano vigente</div>
        <div className="mt-1 font-display text-2xl">{plan?.name ?? "Sem plano"}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Status: {first.franchise.status}
          {plan && ` · R$ ${(plan.priceMonthly / 100).toFixed(2)} / mês`}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Para alterar plano, entre em contato com o super admin. Checkout automatizado será liberado na próxima release.
        </p>
      </div>
    </>
  );
}
