import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { TenantPageHeader } from "@/components/tenant/TenantShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/franchise/companies")({
  component: Companies,
});

type Mine = { role: string; franchise: { id: string; name: string } };
type Franchise = {
  organizations: Array<{ id: string; name: string; slug: string; status: string; cnpj: string | null; _count: { memberships: number } }>;
};

function Companies() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["franchises", "mine"], queryFn: () => api<Mine[]>("/franchises/mine") });
  const first = mine.data?.[0];
  const q = useQuery({
    queryKey: ["franchise", "detail", first?.franchise.id],
    queryFn: () => api<Franchise>(`/franchises/${first!.franchise.id}`),
    enabled: !!first,
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api(`/franchises/${first!.franchise.id}/organizations`, {
        method: "POST",
        body: { name, slug, cnpj: cnpj || undefined },
      }),
    onSuccess: () => {
      toast.success("Empresa criada");
      qc.invalidateQueries({ queryKey: ["franchise", "detail", first?.franchise.id] });
      setOpen(false); setName(""); setSlug(""); setCnpj("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!first) return <div className="p-6 text-sm text-muted-foreground">Sem franquia.</div>;

  return (
    <>
      <TenantPageHeader
        eyebrow="Empresas"
        title="Empresas vinculadas"
        description="Cadastre e acompanhe as empresas da sua rede."
        action={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Nova empresa</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader><SheetTitle>Nova empresa</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-3">
                <div><Label>Razão social</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Slug (URL)</Label><Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
                <div><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
                <Button className="w-full" onClick={() => create.mutate()} disabled={!name || !slug || create.isPending}>
                  {create.isPending ? "Criando…" : "Criar empresa"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.organizations.map((o) => (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary"><Building2 className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.slug} · {o.status} · {o._count.memberships} membros</div>
            </div>
          </div>
        ))}
        {q.data && q.data.organizations.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma empresa vinculada ainda.
          </div>
        )}
      </div>
    </>
  );
}
