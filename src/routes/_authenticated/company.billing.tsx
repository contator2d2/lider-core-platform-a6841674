import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBillingMe, type BillingMe } from "@/lib/plan-billing";
import { CreditCard, Zap, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company/billing")({ component: CompanyBilling });

type Plan = { id: string; name: string; slug: string; description: string | null; priceMonthly: number; features: string[] };

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CompanyBilling() {
  const qc = useQueryClient();
  const me = useBillingMe();
  const plans = useQuery({ queryKey: ["plans", "public"], queryFn: () => api<Plan[]>("/billing/plans").catch(() => [] as Plan[]) });

  const subscribe = useMutation({
    mutationFn: (planId: string) =>
      api("/billing/me/subscribe", { method: "POST", body: { planId, billingType: "PIX", cycle: "MONTHLY" } }),
    onSuccess: () => {
      toast.success("Assinatura criada — verifique o e-mail com a cobrança PIX.");
      qc.invalidateQueries({ queryKey: ["billing", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const org = me.data?.organization;
  const sub = me.data?.subscription;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Empresa</div>
        <h1 className="mt-1 font-display text-3xl">Plano e cobrança</h1>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Plano atual</div>
            <div className="mt-1 font-display text-2xl">{sub?.plan.name ?? org?.plan ?? "—"}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge>{sub?.status ?? "sem assinatura"}</Badge>
              <span className="text-xs text-muted-foreground">{org?.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Uso de licenças</div>
            <div className="mt-1 font-display text-xl">
              {me.data?.licenses.reduce((s: number, l: BillingMe["licenses"][number]) => s + l.used, 0) ?? 0}
              <span className="text-muted-foreground"> / {me.data?.licenses.reduce((s: number, l: BillingMe["licenses"][number]) => s + l.seats, 0) ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl">Alterar plano</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.map((p) => {
            const current = sub?.plan.id === p.id;
            return (
              <div key={p.id} className={`rounded-2xl border p-5 ${current ? "border-accent bg-accent/5" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg">{p.name}</div>
                  {current && <Badge className="bg-accent/20 text-accent">Atual</Badge>}
                </div>
                <div className="mt-2 font-display text-2xl">{money(p.priceMonthly)}<span className="text-sm text-muted-foreground">/mês</span></div>
                <p className="mt-2 min-h-[40px] text-sm text-muted-foreground">{p.description}</p>
                <ul className="mt-4 space-y-1 text-xs">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  disabled={current || subscribe.isPending}
                  onClick={() => subscribe.mutate(p.id)}
                >
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  {current ? "Plano ativo" : "Assinar"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl">Faturas recentes</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          {sub?.invoices?.length ? (
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Valor</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Boleto/QR</th>
                </tr>
              </thead>
              <tbody>
                {sub.invoices.map((inv: NonNullable<BillingMe["subscription"]>["invoices"][number]) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-2">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-2">{money(inv.amountCents)}</td>
                    <td className="px-4 py-2"><Badge>{inv.status}</Badge></td>
                    <td className="px-4 py-2 text-right">
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">
                          <CreditCard className="h-3 w-3" /> Abrir
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem faturas ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
