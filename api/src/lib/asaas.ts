// Asaas API client. Credentials come from PlatformSetting (category=billing).
// The super admin cadastra as chaves em /admin/settings — nada de env var.
//
// Docs: https://docs.asaas.com/reference

import { prisma } from "../prisma.js";

export type AsaasEnv = "sandbox" | "production";

export interface AsaasConfig {
  apiKey: string;
  env: AsaasEnv;
  webhookToken: string | null;
  walletId: string | null;
  defaultBillingType: string;
  currency: string;
}

export async function getBillingSetting(key: string): Promise<string | null> {
  const s = await prisma.platformSetting.findFirst({
    where: { scope: "global", scopeId: null, category: "billing", key },
  });
  return s?.value ?? null;
}

export async function loadAsaasConfig(): Promise<AsaasConfig | null> {
  const [apiKey, envRaw, webhookToken, walletId, defaultBillingType, currency] =
    await Promise.all([
      getBillingSetting("asaas_api_key"),
      getBillingSetting("asaas_env"),
      getBillingSetting("asaas_webhook_token"),
      getBillingSetting("asaas_wallet_id"),
      getBillingSetting("default_billing_type"),
      getBillingSetting("default_currency"),
    ]);
  if (!apiKey) return null;
  const env: AsaasEnv = envRaw === "production" ? "production" : "sandbox";
  return {
    apiKey,
    env,
    webhookToken,
    walletId,
    defaultBillingType: (defaultBillingType || "UNDEFINED").toUpperCase(),
    currency: currency || "BRL",
  };
}

function baseUrlFor(env: AsaasEnv) {
  return env === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

export class AsaasError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface AsaasClient {
  config: AsaasConfig;
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
}

export async function getAsaasClient(): Promise<AsaasClient> {
  const config = await loadAsaasConfig();
  if (!config) {
    throw new AsaasError(
      "Credenciais Asaas não configuradas. Vá em Admin → Configurações → Cobrança.",
      412,
      null,
    );
  }
  const base = baseUrlFor(config.env);
  return {
    config,
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: config.apiKey,
          "User-Agent": "LiderCore/1.0",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const msg =
          (isJson && data && typeof data === "object" && "errors" in (data as object)
            ? JSON.stringify((data as { errors: unknown }).errors)
            : typeof data === "string"
              ? data
              : `Asaas HTTP ${res.status}`) || `Asaas HTTP ${res.status}`;
        throw new AsaasError(msg, res.status, data);
      }
      return data as T;
    },
  };
}

// ------- Types (subset we use) -------
export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
  phone?: string | null;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  subscription?: string | null;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  transactionReceiptUrl?: string | null;
  description?: string | null;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  billingType: string;
  status: string;
  description?: string | null;
}
