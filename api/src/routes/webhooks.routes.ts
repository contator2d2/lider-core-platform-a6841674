// PUBLIC webhook + cron endpoints. Mounted BEFORE auth middleware.
// Asaas envia um header `asaas-access-token` com o valor que você
// cadastrou no painel Asaas. Comparamos em tempo constante com o
// valor salvo em PlatformSetting (billing.asaas_webhook_token).

import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma.js";
import { handleAsaasEvent, runDunning } from "../lib/billing.js";
import { getBillingSetting } from "../lib/asaas.js";

export const webhooksRouter = Router();

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

webhooksRouter.post("/asaas", async (req, res) => {
  const expected = await getBillingSetting("asaas_webhook_token");
  const provided = (req.headers["asaas-access-token"] as string | undefined) ?? "";
  if (!expected) {
    console.warn("[webhook/asaas] token não configurado — rejeitando");
    return res.status(412).json({ error: "Webhook token not configured" });
  }
  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: "Invalid webhook token" });
  }
  const body = req.body ?? {};
  const event: string = body.event ?? "UNKNOWN";
  try {
    await handleAsaasEvent(event, body.payment);
    // audit trail
    await prisma.auditLog
      .create({
        data: {
          action: `webhook.asaas.${event.toLowerCase()}`,
          targetType: body.payment?.subscription ? "subscription" : "payment",
          targetId: body.payment?.id ?? null,
          metadata: { event, paymentId: body.payment?.id, status: body.payment?.status } as never,
        },
      })
      .catch(() => null);
    res.json({ ok: true });
  } catch (err) {
    console.error("[webhook/asaas] erro processando", err);
    // Return 200 anyway so Asaas doesn't retry a poison event forever;
    // we've logged it.
    res.json({ ok: false, error: (err as Error).message });
  }
});

// Cron endpoint for dunning. Protected by a shared secret from settings.
// Configure `billing.cron_secret` and call: POST /api/public/cron/dunning
// with header `x-cron-secret: <value>`.
webhooksRouter.post("/cron/dunning", async (req, res) => {
  const expected = await getBillingSetting("cron_secret");
  const provided = (req.headers["x-cron-secret"] as string | undefined) ?? "";
  if (!expected || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: "Invalid cron secret" });
  }
  const results = await runDunning();
  res.json({ processed: results.length, results });
});

webhooksRouter.get("/health", (_req, res) => res.json({ ok: true }));
