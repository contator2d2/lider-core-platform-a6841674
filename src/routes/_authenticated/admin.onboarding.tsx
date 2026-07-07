import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/onboarding")({
  component: OnboardingPage,
});

type Org = { id: string; name: string };
type Item = { key: string; completed: boolean; completedAt: string | null; notes: string | null };

const LABELS: Record<string, string> = {
  company_created: "Empresa criada",
  users_imported: "Usuários importados",
  leaders_defined: "Líderes definidos",
  teams_created: "Equipes criadas",
  areas_created: "Áreas criadas",
  rituals_configured: "Rituais configurados",
  assessments_setup: "Avaliações prontas",
  ai_configured: "IA configurada",
  training_completed: "Treinamento concluído",
};

function OnboardingPage() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => api<Org[]>("/admin/organizations") });
  const [orgId, setOrgId] = useState<string>("");
  const currentOrgId = orgId || orgs.data?.[0]?.id || "";

  const items = useQuery({
    queryKey: ["platform", "onboarding", currentOrgId],
    queryFn: () => api<Item[]>(`/platform/organizations/${currentOrgId}/onboarding`),
    enabled: !!currentOrgId,
  });

  const toggle = useMutation({
    mutationFn: ({ key, completed }: { key: string; completed: boolean }) =>
      api(`/platform/organizations/${currentOrgId}/onboarding/${key}`, { method: "PATCH", body: { completed } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "onboarding", currentOrgId] }),
  });

  const progress = useMemo(() => {
    if (!items.data || items.data.length === 0) return 0;
    return Math.round((items.data.filter((i) => i.completed).length / items.data.length) * 100);
  }, [items.data]);

  return (
    <>
      <AdminPageHeader
        title="Implantação (Onboarding)"
        description="Checklist de go-live por empresa. À medida que os itens são concluídos, o cliente avança do status trial para ativo."
        action={
          <select value={currentOrgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        }
      />

      {!currentOrgId ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">Cadastre uma empresa primeiro.</div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Progresso</div>
              <div className="font-display text-2xl">{progress}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            {items.data?.map((i) => (
              <button
                key={i.key}
                onClick={() => toggle.mutate({ key: i.key, completed: !i.completed })}
                className="flex w-full items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-0 hover:bg-secondary/60"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${i.completed ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                  {i.completed && <Check className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${i.completed ? "text-muted-foreground line-through" : "font-medium"}`}>{LABELS[i.key] ?? i.key}</div>
                  {i.completedAt && <div className="text-xs text-muted-foreground">Concluído em {new Date(i.completedAt).toLocaleDateString("pt-BR")}</div>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}