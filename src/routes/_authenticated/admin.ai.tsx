import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  component: AIPage,
});

type AISettings = {
  id: string;
  scope: string;
  scopeId: string | null;
  provider: "openai" | "gemini" | "lovable_ai";
  model: string;
  apiKeySecretRef: string | null;
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

  const [provider, setProvider] = useState<AISettings["provider"]>("lovable_ai");
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [apiKeySecretRef, setApiKeySecretRef] = useState("");
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
          monthlyTokenLimit,
          temperature,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração de IA salva.");
      qc.invalidateQueries({ queryKey: ["admin", "ai-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modelSuggestions: Record<AISettings["provider"], string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
    lovable_ai: ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-5"],
  };

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
              <option value="lovable_ai">Lovable AI (gateway)</option>
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
          {provider !== "lovable_ai" && (
            <div className="space-y-1.5">
              <Label>
                Nome da variável de ambiente com a API Key
                <span className="text-muted-foreground"> (ex.: OPENAI_API_KEY)</span>
              </Label>
              <Input
                value={apiKeySecretRef}
                onChange={(e) => setApiKeySecretRef(e.target.value)}
                placeholder="OPENAI_API_KEY"
              />
              <p className="text-xs text-muted-foreground">
                A chave em si vive nas variáveis de ambiente do backend. Aqui você só referencia qual variável usar.
              </p>
            </div>
          )}
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
          <div className="pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar configuração global"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}