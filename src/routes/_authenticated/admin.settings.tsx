import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Mail, MessageCircle, ShieldCheck, Database, CreditCard, Lock, Puzzle, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type Category = "general" | "smtp" | "whatsapp" | "sso" | "backup" | "billing" | "security" | "integrations";
type Setting = {
  id: string;
  category: Category;
  key: string;
  value: string | null;
  secret: boolean;
  hasValue: boolean;
  updatedAt: string;
};

const CATEGORIES: { key: Category; label: string; description: string; icon: typeof Mail; keys: { key: string; label: string; secret?: boolean; placeholder?: string }[] }[] = [
  {
    key: "smtp",
    label: "E-mail (SMTP)",
    description: "Servidor de envio de e-mails transacionais (convites, redefinição, notificações).",
    icon: Mail,
    keys: [
      { key: "host", label: "Host", placeholder: "smtp.provider.com" },
      { key: "port", label: "Porta", placeholder: "587" },
      { key: "username", label: "Usuário", placeholder: "apikey" },
      { key: "password", label: "Senha", secret: true },
      { key: "from_email", label: "Remetente", placeholder: "nao-responda@empresa.com" },
      { key: "from_name", label: "Nome do remetente", placeholder: "Neo Pessoas" },
    ],
  },
  {
    key: "whatsapp",
    label: "WhatsApp Business",
    description: "Integração de notificações e disparos via WhatsApp Cloud API.",
    icon: MessageCircle,
    keys: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "1234567890" },
      { key: "business_account_id", label: "Business Account ID" },
      { key: "access_token", label: "Access Token", secret: true },
      { key: "webhook_verify_token", label: "Webhook Verify Token", secret: true },
    ],
  },
  {
    key: "sso",
    label: "SSO / SAML / OIDC",
    description: "Login corporativo — Google Workspace, Microsoft Entra ID, Okta.",
    icon: ShieldCheck,
    keys: [
      { key: "provider", label: "Provider", placeholder: "google | azure | okta" },
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client Secret", secret: true },
      { key: "issuer_url", label: "Issuer URL" },
      { key: "redirect_uri", label: "Redirect URI" },
    ],
  },
  {
    key: "backup",
    label: "Backup",
    description: "Rotina de backup automático do banco. Retenção e destino S3.",
    icon: Database,
    keys: [
      { key: "schedule_cron", label: "Cron", placeholder: "0 3 * * *" },
      { key: "s3_bucket", label: "S3 Bucket" },
      { key: "s3_region", label: "S3 Region", placeholder: "us-east-1" },
      { key: "s3_access_key", label: "Access Key" },
      { key: "s3_secret_key", label: "Secret Key", secret: true },
      { key: "retention_days", label: "Retenção (dias)", placeholder: "30" },
    ],
  },
  {
    key: "billing",
    label: "Cobrança (Asaas)",
    description:
      "Integração com Asaas — PIX, boleto e cartão. Cadastre a API Key do painel Asaas → Integrações → API. O Webhook Token é uma string aleatória que você define aqui e cola no painel Asaas em Configurações → Notificações → URL: /api/public/asaas.",
    icon: CreditCard,
    keys: [
      { key: "asaas_env", label: "Ambiente", placeholder: "sandbox | production" },
      { key: "asaas_api_key", label: "API Key (access_token)", secret: true, placeholder: "$aact_..." },
      { key: "asaas_webhook_token", label: "Webhook Token (você define)", secret: true, placeholder: "string aleatória" },
      { key: "asaas_wallet_id", label: "Wallet ID (opcional — split)", placeholder: "UUID" },
      { key: "default_billing_type", label: "Cobrança padrão", placeholder: "PIX | BOLETO | CREDIT_CARD | UNDEFINED" },
      { key: "default_currency", label: "Moeda", placeholder: "BRL" },
      { key: "cron_secret", label: "Cron Secret (dunning)", secret: true, placeholder: "string aleatória" },
    ],
  },
  {
    key: "security",
    label: "Segurança",
    description: "Políticas globais de senha, MFA e sessão.",
    icon: Lock,
    keys: [
      { key: "password_min_length", label: "Tamanho mínimo da senha", placeholder: "8" },
      { key: "require_mfa_for_admins", label: "MFA obrigatório para admins (true/false)", placeholder: "true" },
      { key: "session_timeout_minutes", label: "Timeout de sessão (min)", placeholder: "480" },
      { key: "allowed_email_domains", label: "Domínios permitidos (csv)" },
    ],
  },
  {
    key: "integrations",
    label: "Integrações",
    description: "Chaves de APIs de terceiros (Google, Slack, Zapier, etc.).",
    icon: Puzzle,
    keys: [
      { key: "google_calendar_client_id", label: "Google Calendar Client ID" },
      { key: "google_calendar_client_secret", label: "Google Calendar Client Secret", secret: true },
      { key: "slack_webhook_url", label: "Slack Webhook URL", secret: true },
      { key: "zapier_hook_url", label: "Zapier Hook URL" },
    ],
  },
  {
    key: "general",
    label: "Geral",
    description: "Chaves genéricas (customizáveis).",
    icon: Settings2,
    keys: [],
  },
];

function SettingsPage() {
  const [tab, setTab] = useState<Category>("smtp");
  return (
    <>
      <AdminPageHeader
        title="Central de Configurações"
        description="SMTP, WhatsApp, SSO, backup, cobrança, segurança e integrações — tudo em um lugar. Segredos são mascarados após salvar."
      />
      <div className="grid gap-6 md:grid-cols-[220px,1fr]">
        <nav className="space-y-1">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = c.key === tab;
            return (
              <button
                key={c.key}
                onClick={() => setTab(c.key)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {c.label}
              </button>
            );
          })}
        </nav>
        <CategoryPanel category={CATEGORIES.find((c) => c.key === tab)!} />
      </div>
    </>
  );
}

function CategoryPanel({ category }: { category: (typeof CATEGORIES)[number] }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["platform", "settings", category.key],
    queryFn: () => api<Setting[]>(`/platform/settings?category=${category.key}`),
  });

  const byKey = useMemo(() => {
    const m = new Map<string, Setting>();
    q.data?.forEach((s) => m.set(s.key, s));
    return m;
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: { category: Category; key: string; value: string; secret: boolean }) =>
      api<Setting>("/platform/settings", { method: "POST", body }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["platform", "settings", category.key] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/platform/settings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["platform", "settings", category.key] });
    },
  });

  const customKeys = q.data?.filter((s) => !category.keys.find((k) => k.key === s.key)) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">{category.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {category.keys.map((k) => {
            const existing = byKey.get(k.key);
            return (
              <SettingField
                key={k.key}
                categoryKey={category.key}
                fieldKey={k.key}
                label={k.label}
                placeholder={k.placeholder}
                secret={!!k.secret}
                existing={existing}
                onSave={(value) => save.mutate({ category: category.key, key: k.key, value, secret: !!k.secret })}
                onDelete={() => existing && del.mutate(existing.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">Chaves customizadas</h3>
            <p className="text-xs text-muted-foreground">Adicione qualquer par chave/valor extra para esta categoria.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {customKeys.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
              <div className="w-40 truncate text-xs font-medium">{s.key}</div>
              <div className="flex-1 truncate text-xs text-muted-foreground">{s.value ?? "—"}</div>
              {s.secret && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">secret</span>}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <CustomKeyForm category={category.key} onSubmit={(k, v, secret) => save.mutate({ category: category.key, key: k, value: v, secret })} />
        </div>
      </div>
    </div>
  );
}

function SettingField({
  categoryKey,
  fieldKey,
  label,
  placeholder,
  secret,
  existing,
  onSave,
  onDelete,
}: {
  categoryKey: string;
  fieldKey: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  existing?: Setting;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState("");
  const filled = existing?.hasValue;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label} {secret && <span className="ml-1 text-[10px] text-amber-500">(secret)</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          type={secret ? "password" : "text"}
          placeholder={filled ? (secret ? "••••••••  (definido)" : (existing?.value ?? placeholder)) : placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            if (!value) return;
            onSave(value);
            setValue("");
          }}
          disabled={!value}
        >
          Salvar
        </Button>
        {existing && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        <code>{categoryKey}.{fieldKey}</code>
      </div>
    </div>
  );
}

function CustomKeyForm({ category, onSubmit }: { category: Category; onSubmit: (key: string, value: string, secret: boolean) => void }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const [secret, setSecret] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
      <div className="flex-1 min-w-[140px]">
        <Label className="text-[10px] text-muted-foreground">Chave</Label>
        <Input placeholder="minha_chave" value={k} onChange={(e) => setK(e.target.value.replace(/[^a-z0-9_]/g, ""))} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <Label className="text-[10px] text-muted-foreground">Valor</Label>
        <Input type={secret ? "password" : "text"} placeholder="valor" value={v} onChange={(e) => setV(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={secret} onCheckedChange={setSecret} id={`sec-${category}`} />
        <Label htmlFor={`sec-${category}`} className="text-xs">Segredo</Label>
      </div>
      <Button
        size="sm"
        onClick={() => {
          if (!k || !v) return;
          onSubmit(k, v, secret);
          setK("");
          setV("");
          setSecret(false);
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}