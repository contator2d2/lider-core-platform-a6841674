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
