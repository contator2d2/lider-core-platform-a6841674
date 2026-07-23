import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/feature-templates")({
  component: FeatureTemplatesPage,
});

type Action = "view" | "edit" | "export" | "delete" | "admin";
type FeatureDef = { key: string; label: string; description?: string; actions: Action[] };
type ModuleDef = { code: string; name: string; features: FeatureDef[] };

type TemplateItem = { featureKey: string; action: Action; enabled: boolean };
type Template = { id: string; role: string; name: string; description: string | null; items: TemplateItem[] };

const ROLES = [
  { key: "leader", label: "Líder" },
  { key: "franchise_owner", label: "Gestor / Franqueado" },
  { key: "hr_admin", label: "RH / Consultor" },
  { key: "collaborator", label: "Colaborador" },
  { key: "neo_admin", label: "Neo Admin" },
  { key: "super_admin", label: "Super Admin" },
] as const;

function FeatureTemplatesPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("leader");

  const catalog = useQuery({
    queryKey: ["feature-templates", "catalog"],
    queryFn: () => api<{ modules: ModuleDef[] }>("/admin/feature-templates/catalog"),
    staleTime: 5 * 60_000,
  });
  const list = useQuery({
    queryKey: ["feature-templates", "list"],
    queryFn: () => api<{ templates: Template[] }>("/admin/feature-templates"),
  });

  const current = useMemo(
    () => list.data?.templates.find((t) => t.role === role),
    [list.data, role],
  );

  // Estado local editável — {featureKey}:{action} -> enabled
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  // Sincroniza draft quando muda role/dados
  useMemo(() => {
    if (!current) return;
    const map: Record<string, boolean> = {};
    for (const it of current.items) map[`${it.featureKey}:${it.action}`] = it.enabled;
    setDraft(map);
    setDirty(false);
  }, [current?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => {
      const items: TemplateItem[] = [];
      if (catalog.data) {
        for (const mod of catalog.data.modules) {
          for (const feat of mod.features) {
            for (const action of feat.actions) {
              items.push({
                featureKey: feat.key,
                action,
                enabled: !!draft[`${feat.key}:${action}`],
              });
            }
          }
        }
      }
      return api(`/admin/feature-templates/${role}`, {
        method: "PUT",
        body: { items },
      });
    },
    onSuccess: () => {
      toast.success("Template salvo");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["feature-templates", "list"] });
      qc.invalidateQueries({ queryKey: ["me", "features"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const toggle = (key: string) => {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
    setDirty(true);
  };

  const loading = catalog.isLoading || list.isLoading;

  return (
    <div>
      <AdminPageHeader
        title="Templates de módulos"
        description="Ative ou desative funções por perfil. Cada template define o que o usuário desse tipo vê e pode editar no app."
        action={
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar template
          </Button>
        }
      />

      {/* Seletor de perfil */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              role === r.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!loading && catalog.data && (
        <div className="space-y-6">
          {catalog.data.modules.map((mod) => (
            <section key={mod.code} className="rounded-2xl border border-border bg-card">
              <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Módulo
                  </div>
                  <div className="font-display text-lg">{mod.name}</div>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {mod.features.map((feat) => (
                  <li key={feat.key} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{feat.label}</div>
                      {feat.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{feat.description}</p>
                      )}
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">{feat.key}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {feat.actions.map((action) => {
                        const key = `${feat.key}:${action}`;
                        const on = !!draft[key];
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => toggle(key)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-widest transition-colors ${
                              on
                                ? "border-success/40 bg-success/10 text-success"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {action} {on ? "on" : "off"}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}