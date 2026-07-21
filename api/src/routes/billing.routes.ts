// Billing endpoints (authenticated). Public webhook is registered separately.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles } from "../auth.js";
import {
  createSubscription,
  cancelSubscription,
  createOneTimeCharge,
  getPixQr,
  runDunning,
  handleAsaasEvent,
} from "../lib/billing.js";
import { loadAsaasConfig, getAsaasClient } from "../lib/asaas.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

// ---------- Config status (any authenticated user of admin area) ----------
billingRouter.get("/config", requireRoles("super_admin", "neo_admin"), async (_req, res) => {
  const cfg = await loadAsaasConfig();
  if (!cfg) return res.json({ configured: false });
  res.json({
    configured: true,
    env: cfg.env,
    hasWebhookToken: !!cfg.webhookToken,
    hasWalletId: !!cfg.walletId,
    defaultBillingType: cfg.defaultBillingType,
    currency: cfg.currency,
  });
});

billingRouter.get("/config/ping", requireRoles("super_admin", "neo_admin"), async (_req, res) => {
  try {
    const c = await getAsaasClient();
    const info = await c.request<{ totalCount: number }>("GET", "/customers?limit=1");
    res.json({ ok: true, env: c.config.env, totalCustomers: info.totalCount });
  } catch (err) {
    const e = err as Error & { status?: number; body?: unknown };
    res.status(e.status ?? 500).json({ ok: false, error: e.message, body: e.body });
  }
});

// ---------- Global overview (super admin) ----------
billingRouter.get("/overview", requireRoles("super_admin", "neo_admin"), async (_req, res) => {
  const [subs, invoicesAll, invoicesPaid, invoicesOverdue] = await Promise.all([
    prisma.subscription.findMany({ include: { plan: { select: { name: true, priceMonthly: true } } } }),
    prisma.invoice.count(),
    prisma.invoice.aggregate({ _sum: { amountCents: true }, where: { status: "paid" } }),
    prisma.invoice.count({ where: { status: "uncollectible" } }),
  ]);

  const active = subs.filter((s) => s.status === "active");
  const trial = subs.filter((s) => s.status === "trial");
  const pastDue = subs.filter((s) => s.status === "past_due");
  const canceled = subs.filter((s) => s.status === "canceled");
  const mrrCents = active.reduce((sum, s) => sum + (s.plan?.priceMonthly ?? 0), 0);

  res.json({
    subscriptions: {
      active: active.length,
      trial: trial.length,
      pastDue: pastDue.length,
      canceled: canceled.length,
      total: subs.length,
    },
    mrrCents,
    arrCents: mrrCents * 12,
    invoices: {
      total: invoicesAll,
      paidAmountCents: invoicesPaid._sum.amountCents ?? 0,
      overdue: invoicesOverdue,
    },
  });
});

billingRouter.get("/subscriptions", requireRoles("super_admin", "neo_admin"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const list = await prisma.subscription.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      plan: { select: { id: true, name: true, slug: true, priceMonthly: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  // enrich with owner name
  const orgIds = list.filter((s) => s.ownerType === "organization").map((s) => s.ownerId);
  const frIds = list.filter((s) => s.ownerType === "franchise").map((s) => s.ownerId);
  const [orgs, frs] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
    prisma.franchise.findMany({ where: { id: { in: frIds } }, select: { id: true, name: true } }),
  ]);
  const nameOf = new Map<string, string>([
    ...orgs.map((o) => [o.id, o.name] as [string, string]),
    ...frs.map((f) => [f.id, f.name] as [string, string]),
  ]);
  res.json(list.map((s) => ({ ...s, ownerName: nameOf.get(s.ownerId) ?? "—" })));
});

billingRouter.get("/invoices", requireRoles("super_admin", "neo_admin"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const list = await prisma.invoice.findMany({
    where: status ? { status: status as never } : undefined,
    include: { subscription: { include: { plan: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(list);
});

// ---------- Actions ----------
const createSubSchema = z.object({
  ownerType: z.enum(["organization", "franchise"]),
  ownerId: z.string().uuid(),
  planId: z.string().uuid(),
  billingType: z.string().optional(),
  cycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
});

billingRouter.post("/subscriptions", requireRoles("super_admin", "neo_admin"), async (req, res) => {
  const parsed = createSubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const sub = await createSubscription(parsed.data);
    res.status(201).json(sub);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 400).json({ error: e.message });
  }
});

billingRouter.delete("/subscriptions/:id", requireRoles("super_admin", "neo_admin"), async (req, res) => {
  try {
    const sub = await cancelSubscription(req.params.id);
    res.json(sub);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

billingRouter.post("/charges", requireRoles("super_admin", "neo_admin"), async (req, res) => {
  const schema = z.object({
    ownerType: z.enum(["organization", "franchise"]),
    ownerId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    description: z.string().min(1),
    billingType: z.string().optional(),
    dueInDays: z.number().int().min(0).max(60).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const payment = await createOneTimeCharge(parsed.data);
    res.status(201).json(payment);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 400).json({ error: e.message });
  }
});

billingRouter.get("/payments/:id/pix", async (req, res) => {
  try {
    const qr = await getPixQr(req.params.id);
    res.json(qr);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 400).json({ error: e.message });
  }
});

// ---------- Tenant self-service (any authenticated user w/ membership) ----------
billingRouter.get("/me", async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.userId! },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  const org = memberships[0]?.organization;
  if (!org) return res.json({ organization: null });
  const sub = await prisma.subscription.findFirst({
    where: { ownerType: "organization", ownerId: org.id },
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { id: true, name: true, slug: true, priceMonthly: true, features: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  const licenses = await prisma.license.findMany({
    where: { organizationId: org.id },
    include: { plan: { select: { name: true } }, _count: { select: { assignments: true } } },
  });
  res.json({
    organization: { id: org.id, name: org.name, plan: org.plan, status: org.status },
    subscription: sub,
    licenses: licenses.map((l) => ({
      id: l.id,
      planName: l.plan.name,
      seats: l.seats,
      used: l._count.assignments,
      status: l.status,
      expiresAt: l.expiresAt,
    })),
  });
});

// Public plans list (any authenticated user) for the upgrade page
billingRouter.get("/plans", async (_req, res) => {
  const list = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      priceMonthly: true,
      priceYearly: true,
      features: true,
    },
  });
  res.json(list);
});

// User picks a plan for their org
billingRouter.post("/me/subscribe", async (req, res) => {
  const schema = z.object({
    planId: z.string().uuid(),
    billingType: z.string().optional(),
    cycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const m = await prisma.membership.findFirst({
    where: { userId: req.userId!, role: { in: ["hr_admin", "franchise_owner"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!m) return res.status(403).json({ error: "Somente admins da empresa podem alterar o plano" });
  try {
    const sub = await createSubscription({
      ownerType: "organization",
      ownerId: m.organizationId,
      planId: parsed.data.planId,
      billingType: parsed.data.billingType,
      cycle: parsed.data.cycle,
    });
    res.status(201).json(sub);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 400).json({ error: e.message });
  }
});

// ---------- Dunning (super admin trigger) ----------
billingRouter.post("/dunning/run", requireRoles("super_admin"), async (_req, res) => {
  const results = await runDunning();
  res.json({ processed: results.length, results });
});

// ---------- Simulate Asaas webhook (super admin, para validar fluxo end-to-end) ----------
// Constrói um payment sintético para uma assinatura existente e roda o
// handler de webhook. Perfeito pra testar suspensão / reativação sem
// precisar disparar cobrança real.
billingRouter.post("/simulate-webhook", requireRoles("super_admin"), async (req, res) => {
  const schema = z.object({
    subscriptionId: z.string().uuid(),
    event: z.enum([
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE",
      "PAYMENT_REFUNDED",
      "PAYMENT_DELETED",
    ]),
    amountCents: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sub = await prisma.subscription.findUnique({
    where: { id: parsed.data.subscriptionId },
    include: { plan: { select: { priceMonthly: true } } },
  });
  if (!sub) return res.status(404).json({ error: "Assinatura não encontrada" });
  const valueCents = parsed.data.amountCents ?? sub.plan?.priceMonthly ?? 0;
  const statusMap: Record<string, string> = {
    PAYMENT_CONFIRMED: "CONFIRMED",
    PAYMENT_RECEIVED: "RECEIVED",
    PAYMENT_OVERDUE: "OVERDUE",
    PAYMENT_REFUNDED: "REFUNDED",
    PAYMENT_DELETED: "DELETED",
  };
  const now = new Date();
  const payment = {
    id: `sim_${Date.now()}`,
    customer: sub.providerCustomerId ?? "sim_customer",
    subscription: sub.providerSubscriptionId ?? sub.id,
    value: valueCents / 100,
    billingType: "PIX",
    status: statusMap[parsed.data.event],
    dueDate: now.toISOString().slice(0, 10),
    paymentDate: parsed.data.event === "PAYMENT_CONFIRMED" || parsed.data.event === "PAYMENT_RECEIVED"
      ? now.toISOString().slice(0, 10)
      : null,
    invoiceUrl: null,
  };
  // Se a assinatura ainda não tem providerSubscriptionId, garantir vinculação
  if (!sub.providerSubscriptionId) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { providerSubscriptionId: sub.id, provider: sub.provider ?? "asaas-simulated" },
    });
    payment.subscription = sub.id;
  }
  try {
    await handleAsaasEvent(parsed.data.event, payment as never);
    const after = await prisma.subscription.findUnique({
      where: { id: sub.id },
      include: { invoices: { orderBy: { createdAt: "desc" }, take: 3 } },
    });
    res.json({ ok: true, event: parsed.data.event, subscription: after });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ---------- Individual plans (assinatura pessoal do usuário logado) ----------
billingRouter.get("/plans/individual", async (_req, res) => {
  const list = await prisma.plan.findMany({
    where: { active: true, target: "individual" },
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true, name: true, slug: true, description: true,
      priceMonthly: true, priceYearly: true, features: true,
    },
  });
  res.json(list);
});

billingRouter.get("/me/individual", async (req, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { ownerType: "individual", ownerId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { id: true, name: true, slug: true, priceMonthly: true, features: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  res.json({ subscription: sub });
});

billingRouter.post("/me/individual/subscribe", async (req, res) => {
  const schema = z.object({
    planId: z.string().uuid(),
    billingType: z.string().optional(),
    cycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
  if (plan.target !== "individual") return res.status(400).json({ error: "Plano não é individual" });
  try {
    const sub = await createSubscription({
      ownerType: "individual",
      ownerId: req.userId!,
      planId: parsed.data.planId,
      billingType: parsed.data.billingType,
      cycle: parsed.data.cycle,
    });
    res.status(201).json(sub);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 400).json({ error: e.message });
  }
});

billingRouter.delete("/me/individual", async (req, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { ownerType: "individual", ownerId: req.userId!, status: { in: ["active", "trial", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return res.status(404).json({ error: "Sem assinatura ativa" });
  try {
    const canceled = await cancelSubscription(sub.id);
    res.json(canceled);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
