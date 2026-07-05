import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  component: () => (
    <>
      <AdminPageHeader
        title="Faturas"
        description="Histórico de cobranças. Emissão automática entra na integração com Stripe."
      />
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Nenhuma fatura registrada. Ative a integração de pagamentos para começar a emitir cobranças automaticamente.
      </div>
    </>
  ),
});