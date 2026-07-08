import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, getToken } from "@/lib/api";
import { Download, Upload, FileSpreadsheet, FileText, Users, Building2, Network, Receipt, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/data")({
  component: DataPage,
});

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type Entity = "organizations" | "hierarchy" | "users";
type ImportRowResult = { row: number; ok: boolean; message?: string; created?: boolean; updated?: boolean };
type ImportResult = { total: number; ok: number; failed: number; created: number; updated: number; rows: ImportRowResult[] };

const ENTITIES: { key: Entity; label: string; icon: typeof Users; columns: string; hint: string }[] = [
  {
    key: "organizations",
    label: "Empresas / Igrejas",
    icon: Building2,
    columns: "name, slug, cnpj, plan, status, city, state, phone, email",
    hint: "slug é único (letras minúsculas e hifens). Existentes serão atualizados.",
  },
  {
    key: "hierarchy",
    label: "Hierarquia (Filiais / Áreas / Equipes)",
    icon: Network,
    columns: "organization_slug, branch_code, branch_name, area_name, team_name",
    hint: "Uma linha por equipe. Filial e área são criadas se não existirem.",
  },
  {
    key: "users",
    label: "Usuários / Membros",
    icon: Users,
    columns: "email, full_name, password, role, organization_slug, branch_code, area_name, team_name, phone, whatsapp, cpf, job_title",
    hint: "Sem password, uma senha temporária é gerada (ou usa a senha padrão do topo).",
  },
];

function DataPage() {
  const [tab, setTab] = useState<"import" | "export">("import");
  return (
    <>
      <AdminPageHeader
        title="Dados — Importar / Exportar"
        description="CSV compatível com Excel/Google Sheets. Suporte a dry-run para validar antes de gravar."
      />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {(["import", "export"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "import" ? <Upload className="h-4 w-4" strokeWidth={1.5} /> : <Download className="h-4 w-4" strokeWidth={1.5} />}
            {t === "import" ? "Importar" : "Exportar"}
          </button>
        ))}
      </div>
      {tab === "import" ? <ImportPanel /> : <ExportPanel />}
    </>
  );
}

function ImportPanel() {
  const [entity, setEntity] = useState<Entity>("organizations");
  const [csv, setCsv] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const meta = ENTITIES.find((e) => e.key === entity)!;

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<ImportResult>(`/data/import/${entity}`, {
        method: "POST",
        body: { csv, dryRun, defaultPassword: defaultPassword || undefined },
      }),
    onSuccess: (r) => {
      setResult(r);
      toast[r.failed ? "warning" : "success"](
        `${r.ok}/${r.total} ok — ${r.created} criados, ${r.updated} atualizados, ${r.failed} falhas`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    toast.success(`${f.name} carregado (${(f.size / 1024).toFixed(1)} KB)`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-2">
        {ENTITIES.map((e) => {
          const Icon = e.icon;
          const active = e.key === entity;
          return (
            <button
              key={e.key}
              onClick={() => { setEntity(e.key); setResult(null); }}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                active ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60"
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <div className="font-medium">{e.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{e.hint}</div>
              </div>
            </button>
          );
        })}
      </aside>
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg">{meta.label}</h3>
              <p className="mt-1 text-xs font-mono text-muted-foreground">{meta.columns}</p>
            </div>
            <a
              href={`${API_URL}/data/sample/${entity}`}
              onClick={(e) => { e.preventDefault(); downloadWithAuth(`/data/sample/${entity}`, `${entity}-sample.csv`); }}
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.5} />
              Baixar modelo
            </a>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Enviar arquivo .csv</Label>
                <Input type="file" accept=".csv,text/csv" onChange={pickFile} />
              </div>
              {entity === "users" && (
                <div>
                  <Label>Senha padrão (opcional)</Label>
                  <Input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} placeholder="ex: TrocarAgora@2026" />
                </div>
              )}
            </div>
            <div>
              <Label>Ou cole o CSV aqui</Label>
              <Textarea
                rows={10}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={meta.columns}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => run.mutate(true)} disabled={!csv || run.isPending}>
                {run.isPending ? "Validando…" : "Validar (dry-run)"}
              </Button>
              <Button onClick={() => run.mutate(false)} disabled={!csv || run.isPending}>
                {run.isPending ? "Importando…" : "Importar de verdade"}
              </Button>
            </div>
          </div>
        </div>

        {result && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h4 className="font-display text-base">Resultado</h4>
              <Badge variant="secondary">Total: {result.total}</Badge>
              <Badge>OK: {result.ok}</Badge>
              <Badge variant="secondary">Criados: {result.created}</Badge>
              <Badge variant="secondary">Atualizados: {result.updated}</Badge>
              {result.failed > 0 && <Badge variant="destructive">Falhas: {result.failed}</Badge>}
            </div>
            <div className="max-h-[400px] overflow-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/60">
                  <tr>
                    <th className="p-2 text-left">Linha</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 500).map((r) => (
                    <tr key={r.row} className="border-t border-border">
                      <td className="p-2 font-mono">{r.row}</td>
                      <td className="p-2">
                        {r.ok ? <Badge>{r.created ? "criado" : r.updated ? "atualizado" : "ok"}</Badge> : <Badge variant="destructive">erro</Badge>}
                      </td>
                      <td className="p-2">{r.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 500 && (
                <p className="p-2 text-center text-muted-foreground">…{result.rows.length - 500} linhas adicionais</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ExportPanel() {
  const items: { path: string; filename: string; label: string; icon: typeof Users; description: string }[] = [
    { path: "/data/export/organizations", filename: "organizations.csv", label: "Empresas / Igrejas", icon: Building2, description: "Cadastro completo com plano, status e contatos." },
    { path: "/data/export/hierarchy", filename: "hierarchy.csv", label: "Hierarquia completa", icon: Network, description: "Filiais → Áreas → Equipes em CSV plano." },
    { path: "/data/export/users", filename: "users.csv", label: "Usuários / Membros", icon: Users, description: "Perfis, papéis e organizações vinculadas." },
    { path: "/data/export/invoices", filename: "invoices.csv", label: "Faturas", icon: Receipt, description: "Cobranças emitidas com status e valor." },
    { path: "/data/export/audit?take=10000", filename: "audit.csv", label: "Auditoria (últimos 10k)", icon: ShieldCheck, description: "Registro completo de ações da plataforma." },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.path} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="rounded-lg bg-secondary p-3">
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-base">{it.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{it.description}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => downloadWithAuth(it.path, it.filename)}
              >
                <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Baixar CSV
              </Button>
            </div>
          </div>
        );
      })}
      <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" strokeWidth={1.5} />
          Todos os arquivos são UTF-8 com BOM — abrem corretamente no Excel.
        </div>
      </div>
    </div>
  );
}

async function downloadWithAuth(path: string, filename: string) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    toast.error((err as Error).message);
  }
}