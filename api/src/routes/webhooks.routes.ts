// PUBLIC webhook + cron endpoints. Mounted BEFORE auth middleware.
// Asaas envia um header `asaas-access-token` com o valor que você
// cadastrou no painel Asaas. Comparamos em tempo constante com o
// valor salvo em PlatformSetting (billing.asaas_webhook_token).

import { Router } from "express";
import { timingSafeEqual, createHmac } from "node:crypto";
import { prisma } from "../prisma.js";
import { handleAsaasEvent, runDunning } from "../lib/billing.js";
import { getBillingSetting } from "../lib/asaas.js";
import { loadNotificationsConfig } from "../lib/notifications.js";

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

// ============================================================
// WhatsApp — uazapi
// Configure em uazapi Webhooks → URL: /api/public/webhooks/uazapi
// Header:  token: <uazapi_webhook_token>  (você define no admin)
// ============================================================
webhooksRouter.post("/webhooks/uazapi", async (req, res) => {
  const cfg = await loadNotificationsConfig();
  const expected = cfg.uazapiWebhookToken;
  const provided = (req.headers["token"] as string | undefined) ?? "";
  if (!expected) return res.status(412).json({ error: "uazapi webhook token não configurado" });
  if (!provided || !safeEqual(provided, expected)) return res.status(401).json({ error: "Invalid token" });

  const evt = (req.body ?? {}) as {
    event?: string;
    type?: string;
    message?: { id?: string; text?: string; from?: string; type?: string; status?: string };
    messageid?: string;
    status?: string;
  };
  const providerId = evt.messageid ?? evt.message?.id ?? null;
  const nextStatus =
    evt.status === "READ" || evt.message?.status === "READ"
      ? "read"
      : evt.status === "DELIVERED" || evt.message?.status === "DELIVERED"
        ? "delivered"
        : evt.status === "SENT"
          ? "sent"
          : null;

  try {
    if (providerId && nextStatus) {
      await prisma.notificationLog.updateMany({
        where: { providerId, channel: "whatsapp_uazapi" },
        data: { status: nextStatus as never },
      });
    }
    // Se for mensagem recebida (inbound) — grava log
    if ((evt.event === "messages" || evt.type === "message") && evt.message?.text) {
      await prisma.notificationLog.create({
        data: {
          channel: "whatsapp_uazapi",
          direction: "inbound",
          status: "delivered",
          to: cfg.defaultSenderName,
          from: evt.message.from ?? "unknown",
          body: evt.message.text,
          providerId,
          providerRaw: evt as never,
        },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[webhook/uazapi]", err);
    res.json({ ok: false, error: (err as Error).message });
  }
});

// ============================================================
// WhatsApp — Meta Cloud API (homologação)
// GET  — verificação hub.challenge
// POST — eventos (validação HMAC opcional via app_secret)
// ============================================================
webhooksRouter.get("/webhooks/meta", async (req, res) => {
  const cfg = await loadNotificationsConfig();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && cfg.metaWebhookVerifyToken && token === cfg.metaWebhookVerifyToken) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.status(403).json({ error: "verify_token inválido" });
});

webhooksRouter.post("/webhooks/meta", async (req, res) => {
  const cfg = await loadNotificationsConfig();

  // Validação opcional de assinatura X-Hub-Signature-256
  if (cfg.metaAppSecret) {
    const signature = (req.headers["x-hub-signature-256"] as string | undefined) ?? "";
    const raw = JSON.stringify(req.body ?? {});
    const expected = "sha256=" + createHmac("sha256", cfg.metaAppSecret).update(raw).digest("hex");
    if (!signature || !safeEqual(signature, expected)) {
      return res.status(401).json({ error: "assinatura inválida" });
    }
  }

  const body = req.body ?? {};
  try {
    const entries: unknown[] = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes: unknown[] = Array.isArray((entry as { changes?: unknown[] })?.changes)
        ? ((entry as { changes: unknown[] }).changes)
        : [];
      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> }).value ?? {};
        const statuses = Array.isArray(value.statuses) ? (value.statuses as Array<Record<string, unknown>>) : [];
        for (const st of statuses) {
          const providerId = String(st.id ?? "");
          const s = String(st.status ?? "").toLowerCase();
          const mapped = s === "read" ? "read" : s === "delivered" ? "delivered" : s === "sent" ? "sent" : s === "failed" ? "failed" : null;
          if (providerId && mapped) {
            await prisma.notificationLog.updateMany({
              where: { providerId, channel: "whatsapp_meta" },
              data: { status: mapped as never },
            });
          }
        }
        const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];
        for (const msg of messages) {
          const from = String(msg.from ?? "unknown");
          const text = ((msg.text as { body?: string } | undefined)?.body) ?? null;
          await prisma.notificationLog.create({
            data: {
              channel: "whatsapp_meta",
              direction: "inbound",
              status: "delivered",
              to: cfg.metaPhoneNumberId ?? "meta",
              from,
              body: text,
              providerId: String(msg.id ?? ""),
              providerRaw: msg as never,
            },
          });
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[webhook/meta]", err);
    res.json({ ok: false, error: (err as Error).message });
  }
});
