import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw, PlayCircle, Wifi } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/billing")({ component: BillingPage });

type Config = { configured: boolean; env?: string; hasWebhookToken?: boolean; defaultBillingType?: string; currency?: string };
type Overview = {
  subscriptions: { active: number; trial: number; pastDue: number; canceled: number; total: number };
  mrrCents: number;
  arrCents: number;
  invoices: { total: number; paidAmountCents: number; overdue: number };
};
type Subscription = {
  id: string;
  ownerType: string;
  ownerId: string;
  ownerName: string;
  status: string;
  currentPeriodEnd: string | null;
  provider: string | null;
  providerSubscriptionId: string | null;
  plan: { name: string; priceMonthly: number };
  invoices: { id: string; status: string; amountCents: number; dueDate: string | null; pdfUrl: string | null }[];
};

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusColor(s: string) {
  return (
    {
      active: "bg-emerald-500/15 text-emerald-500",
      trial: "bg-sky-500/15 text-sky-500",
      past_due: "bg-amber-500/15 text-amber-500",
      canceled: "bg-red-500/15 text-red-500",
    }[s] ?? "bg-secondary text-muted-foreground"
  );
}

function BillingPage() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["billing", "config"], queryFn: () => api<Config>("/billing/config") });
  const overview = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: () => api<Overview>("/billing/overview"),
    enabled: cfg.data?.configured,
  });
  const subs = useQuery({
    queryKey: ["billing", "subscriptions"],
    queryFn: () => api<Subscription[]>("/billing/subscriptions"),
    enabled: cfg.data?.configured,
  });
  const ping = useMutation({
    mutationFn: () => api<{ ok: boolean; env?: string; totalCustomers?: number; error?: string }>("/billing/config/ping"),
    onSuccess: (d) => {
      if (d.ok) toast.success(`Conectado ao Asaas (${d.env}) — ${d.totalCustomers} clientes`);
      else toast.error(d.error ?? "Falha na conexão");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dunning = useMutation({
    mutationFn: () => api<{ processed: number }>("/billing/dunning/run", { method: "POST" }),
    onSuccess: (d) => {
      toast.success(`Dunning processado: ${d.processed} assinatura(s)`);
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/billing/subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Assinatura cancelada");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Cobrança (Asaas)"
        description="Visão consolidada de MRR, assinaturas, inadimplência e faturas. Configure as credenciais em Configurações → Cobrança."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => ping.mutate()} disabled={!cfg.data?.configured || ping.isPending}>
              <Wifi className="mr-2 h-3.5 w-3.5" /> Testar conexão
            </Button>
            <Button variant="outline" size="sm" onClick={() => dunning.mutate()} disabled={!cfg.data?.configured || dunning.isPending}>
              <PlayCircle className="mr-2 h-3.5 w-3.5" /> Rodar dunning
            </Button>
            <Button size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["billing"] })}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        }
      />

      {!cfg.isLoading && !cfg.data?.configured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <div className="font-medium">Asaas ainda não configurado</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre <code>asaas_api_key</code>, <code>asaas_env</code> e <code>asaas_webhook_token</code> em
              Configurações → Cobrança. Depois cole a URL do webhook no painel Asaas.
            </p>
            <Link to="/admin/settings" className="mt-3 inline-block text-sm text-accent underline">
              Ir para Configurações →
            </Link>
          </div>
        </div>
      )}

      {cfg.data?.configured && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Conectado ao Asaas — ambiente <b className="mx-1">{cfg.data.env}</b> · moeda {cfg.data.currency} · cobrança padrão {cfg.data.defaultBillingType}
          {!cfg.data.hasWebhookToken && (
            <span className="ml-auto text-amber-500">⚠ Webhook token não configurado</span>
          )}
        </div>
      )}

      {overview.data && (
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Kpi label="MRR" value={money(overview.data.mrrCents)} tone="accent" />
          <Kpi label="ARR" value={money(overview.data.arrCents)} />
          <Kpi label="Assinaturas ativas" value={String(overview.data.subscriptions.active)} sub={`de ${overview.data.subscriptions.total}`} />
          <Kpi label="Inadimplência" value={String(overview.data.invoices.overdue)} sub="faturas vencidas" tone={overview.data.invoices.overdue ? "warn" : undefined} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-lg">Assinaturas</h2>
          <div className="text-xs text-muted-foreground">{subs.data?.length ?? 0} registro(s)</div>
        </div>
        <div className="divide-y divide-border">
          {subs.data?.map((s) => (
            <div key={s.id} className="grid gap-3 p-5 md:grid-cols-[1fr,120px,120px,140px,140px] md:items-center">
              <div>
                <div className="font-medium">{s.ownerName}</div>
                <div className="text-xs text-muted-foreground">
                  {s.ownerType} · {s.plan.name} · {money(s.plan.priceMonthly)}/mês
                </div>
              </div>
              <Badge className={statusColor(s.status)}>{s.status}</Badge>
              <div className="text-xs text-muted-foreground">
                {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("pt-BR") : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground truncate" title={s.providerSubscriptionId ?? ""}>
                {s.providerSubscriptionId ?? "sem provedor"}
              </div>
              <div className="flex justify-end">
                {s.status !== "canceled" && (
                  <Button size="sm" variant="ghost" onClick={() => confirm(`Cancelar assinatura de ${s.ownerName}?`) && cancel.mutate(s.id)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
          {subs.data?.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma assinatura ainda.</div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm">
        <div className="font-medium">URL do webhook para colar no Asaas</div>
        <code className="mt-2 block break-all rounded-md bg-secondary/50 p-3 text-xs">
          {typeof window !== "undefined"
            ? `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api/public/asaas`
            : "/api/public/asaas"}
        </code>
        <p className="mt-3 text-xs text-muted-foreground">
          No painel Asaas → Configurações → Notificações → Webhooks: cole a URL acima, cole o mesmo <code>asaas_webhook_token</code> no campo "Token de autenticação" e ative os eventos de pagamento (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, PAYMENT_DELETED).
        </p>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "accent" | "warn" }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl ${tone === "accent" ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
