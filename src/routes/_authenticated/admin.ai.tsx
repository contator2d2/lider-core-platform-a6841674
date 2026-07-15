import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  component: AIPage,
});

type AISettings = {
  id: string;
  scope: string;
  scopeId: string | null;
  provider: "openai" | "gemini";
  model: string;
  apiKeySecretRef: string | null;
  apiKey: string | null;
  monthlyTokenLimit: number | null;
  temperature: number;
};

function AIPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "ai-settings"],
    queryFn: () => api<AISettings[]>("/admin/ai-settings"),
  });

  const global = list.data?.find((s) => s.scope === "global");

  const [provider, setProvider] = useState<AISettings["provider"]>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKeySecretRef, setApiKeySecretRef] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(1000000);
  const [temperature, setTemperature] = useState(0.7);

  const [initialized, setInitialized] = useState(false);
  if (!initialized && global) {
    setInitialized(true);
    setProvider(global.provider);
    setModel(global.model);
    setApiKeySecretRef(global.apiKeySecretRef ?? "");
    setMonthlyTokenLimit(global.monthlyTokenLimit ?? 1000000);
    setTemperature(global.temperature);
  }

  const save = useMutation({
    mutationFn: () =>
      api("/admin/ai-settings", {
        method: "POST",
        body: {
          scope: "global",
          scopeId: null,
          provider,
          model,
          apiKeySecretRef: apiKeySecretRef || null,
          apiKey: apiKey || null,
          monthlyTokenLimit,
          temperature,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração de IA salva.");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["admin", "ai-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; latencyMs?: number; sample?: string; error?: string }>(
        "/admin/ai-settings/test",
        { method: "POST" },
      ),
    onSuccess: (d) => {
      if (d.ok) toast.success(`IA respondeu em ${d.latencyMs}ms: ${d.sample ?? ""}`);
      else toast.error(d.error ?? "Falha no teste");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modelSuggestions: Record<AISettings["provider"], string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
  };

  const hasStoredKey = !!global?.apiKey; // vem como "••••••••" do backend quando existe

  return (
    <>
      <AdminPageHeader
        title="Provedor de IA"
        description="Configuração global. Cada franquia/empresa pode sobrescrever depois."
      />

      <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Provedor</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              onChange={(e) => {
                const p = e.target.value as AISettings["provider"];
                setProvider(p);
                setModel(modelSuggestions[p][0]);
              }}
            >
              <option value="openai">OpenAI (chave própria)</option>
              <option value="gemini">Google Gemini (chave própria)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Input list="models" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="models">
              {modelSuggestions[provider].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              API Key
              {hasStoredKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" /> chave salva
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasStoredKey
                    ? "Deixe em branco para manter a chave atual"
                    : provider === "openai"
                      ? "sk-proj-..."
                      : "AIza..."
                }
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Ocultar" : "Mostrar"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave fica armazenada no seu backend e nunca é enviada de volta ao navegador em texto claro.
            </p>
          </div>

          <details className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Avançado · usar variável de ambiente
            </summary>
            <div className="mt-2 space-y-1.5">
              <Label className="text-xs">Nome da variável no backend</Label>
              <Input
                value={apiKeySecretRef}
                onChange={(e) => setApiKeySecretRef(e.target.value)}
                placeholder="OPENAI_API_KEY"
              />
              <p className="text-[11px] text-muted-foreground">
                Se preenchido e nenhuma chave direta estiver salva, o backend lerá <code>process.env[nome]</code>.
              </p>
            </div>
          </details>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Limite mensal de tokens</Label>
              <Input
                type="number"
                value={monthlyTokenLimit}
                onChange={(e) => setMonthlyTokenLimit(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Input
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar configuração global"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending || (!hasStoredKey && !apiKey && !apiKeySecretRef)}
            >
              {test.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testando…
                </>
              ) : (
                <>Testar conexão</>
              )}
            </Button>
            {test.data && (
              <span
                className={
                  "inline-flex items-center gap-1 text-xs " +
                  (test.data.ok ? "text-success" : "text-destructive")
                }
              >
                {test.data.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {test.data.ok
                  ? `OK · ${test.data.latencyMs}ms`
                  : test.data.error ?? "Falha"}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}