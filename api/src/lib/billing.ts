// High-level billing helpers built on top of the Asaas client.
// Persists customer/subscription IDs in the existing Subscription/Invoice models.

import { prisma } from "../prisma.js";
import { getAsaasClient, type AsaasCustomer, type AsaasPayment, type AsaasSubscription } from "./asaas.js";

type OwnerType = "franchise" | "organization";

interface OwnerSnapshot {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
}

async function loadOwner(ownerType: OwnerType, ownerId: string): Promise<OwnerSnapshot | null> {
  if (ownerType === "organization") {
    const o = await prisma.organization.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, cnpj: true, email: true, phone: true },
    });
    return o ?? null;
  }
  const f = await prisma.franchise.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, cnpj: true, owner: { select: { email: true } } },
  });
  if (!f) return null;
  return { id: f.id, name: f.name, cnpj: f.cnpj, email: f.owner?.email ?? null, phone: null };
}

// Returns the existing Asaas customer id if we have any prior subscription
// for this owner, otherwise creates a new customer on Asaas and returns its id.
export async function ensureAsaasCustomer(ownerType: OwnerType, ownerId: string): Promise<string> {
  const prior = await prisma.subscription.findFirst({
    where: { ownerType, ownerId, providerCustomerId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (prior?.providerCustomerId) return prior.providerCustomerId;

  const owner = await loadOwner(ownerType, ownerId);
  if (!owner) throw new Error("Owner não encontrado");

  const client = await getAsaasClient();
  const created = await client.request<AsaasCustomer>("POST", "/customers", {
    name: owner.name,
    cpfCnpj: owner.cnpj ?? undefined,
    email: owner.email ?? undefined,
    phone: owner.phone ?? undefined,
    externalReference: `${ownerType}:${owner.id}`,
    notificationDisabled: false,
  });
  return created.id;
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// Creates (or replaces) an active subscription for the owner on Asaas + local DB.
// If there was a previous active subscription, it is canceled first.
export async function createSubscription(params: {
  ownerType: OwnerType;
  ownerId: string;
  planId: string;
  billingType?: string; // BOLETO | CREDIT_CARD | PIX | UNDEFINED (user picks)
  cycle?: "MONTHLY" | "YEARLY";
}) {
  const { ownerType, ownerId, planId } = params;
  const cycle = params.cycle ?? "MONTHLY";

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plano não encontrado");
  const priceCents = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
  if (!priceCents || priceCents <= 0) throw new Error("Plano sem preço configurado");

  const customerId = await ensureAsaasCustomer(ownerType, ownerId);
  const client = await getAsaasClient();
  const billingType = (params.billingType ?? client.config.defaultBillingType).toUpperCase();

  // Cancel active previous subscription (both sides)
  const previous = await prisma.subscription.findFirst({
    where: { ownerType, ownerId, status: { in: ["active", "trial", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });
  if (previous?.providerSubscriptionId) {
    try {
      await client.request("DELETE", `/subscriptions/${previous.providerSubscriptionId}`);
    } catch (err) {
      console.error("[billing] falha ao cancelar assinatura anterior no Asaas", err);
    }
  }
  if (previous) {
    await prisma.subscription.update({
      where: { id: previous.id },
      data: { status: "canceled", cancelAt: new Date() },
    });
  }

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + 3);
  const created = await client.request<AsaasSubscription>("POST", "/subscriptions", {
    customer: customerId,
    billingType,
    value: priceCents / 100,
    nextDueDate: nextDue.toISOString().slice(0, 10),
    cycle,
    description: `Assinatura Líder C.O.R.E. — ${plan.name}`,
    externalReference: `${ownerType}:${ownerId}:${plan.slug}`,
  });

  const sub = await prisma.subscription.create({
    data: {
      ownerType,
      ownerId,
      planId,
      status: "trial",
      provider: "asaas",
      providerCustomerId: customerId,
      providerSubscriptionId: created.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), cycle === "YEARLY" ? 12 : 1),
    },
  });
  return sub;
}

export async function cancelSubscription(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Assinatura não encontrada");
  if (sub.providerSubscriptionId) {
    const client = await getAsaasClient();
    try {
      await client.request("DELETE", `/subscriptions/${sub.providerSubscriptionId}`);
    } catch (err) {
      console.error("[billing] cancel provider fail", err);
    }
  }
  return prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "canceled", cancelAt: new Date() },
  });
}

// One-time charge (e.g. setup fee)
export async function createOneTimeCharge(params: {
  ownerType: OwnerType;
  ownerId: string;
  amountCents: number;
  description: string;
  billingType?: string;
  dueInDays?: number;
}) {
  const customerId = await ensureAsaasCustomer(params.ownerType, params.ownerId);
  const client = await getAsaasClient();
  const due = new Date();
  due.setDate(due.getDate() + (params.dueInDays ?? 3));
  const payment = await client.request<AsaasPayment>("POST", "/payments", {
    customer: customerId,
    billingType: (params.billingType ?? client.config.defaultBillingType).toUpperCase(),
    value: params.amountCents / 100,
    dueDate: due.toISOString().slice(0, 10),
    description: params.description,
    externalReference: `${params.ownerType}:${params.ownerId}:onetime`,
  });
  return payment;
}

// Fetch PIX QR code for a payment
export async function getPixQr(paymentId: string) {
  const client = await getAsaasClient();
  return client.request<{ encodedImage: string; payload: string; expirationDate: string }>(
    "GET",
    `/payments/${paymentId}/pixQrCode`,
  );
}

// ----- Webhook event ingestion -----
export async function handleAsaasEvent(event: string, payment?: AsaasPayment) {
  if (!payment) return;
  // Find the subscription this payment belongs to
  const sub = payment.subscription
    ? await prisma.subscription.findFirst({ where: { providerSubscriptionId: payment.subscription } })
    : null;

  // Upsert invoice
  if (sub) {
    const existing = await prisma.invoice.findFirst({
      where: { providerInvoiceId: payment.id },
    });
    const data = {
      subscriptionId: sub.id,
      amountCents: Math.round(payment.value * 100),
      currency: "BRL",
      status: mapPaymentStatus(payment.status),
      dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      paidAt: payment.paymentDate ? new Date(payment.paymentDate) : null,
      providerInvoiceId: payment.id,
      pdfUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
    };
    if (existing) await prisma.invoice.update({ where: { id: existing.id }, data });
    else await prisma.invoice.create({ data });
  }

  // Update subscription lifecycle
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "active" },
        });
        await activateOwner(sub.ownerType as OwnerType, sub.ownerId);
      }
      break;
    case "PAYMENT_OVERDUE":
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "past_due" },
        });
      }
      break;
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "past_due" },
        });
      }
      break;
    case "PAYMENT_DELETED":
      break;
  }
}

function mapPaymentStatus(status: string): "draft" | "open" | "paid" | "void" | "uncollectible" {
  const s = status.toUpperCase();
  if (s === "CONFIRMED" || s === "RECEIVED" || s === "RECEIVED_IN_CASH") return "paid";
  if (s === "REFUNDED" || s === "CHARGEBACK_DISPUTE" || s === "CHARGEBACK_REVERSAL") return "void";
  if (s === "OVERDUE") return "uncollectible";
  if (s === "DELETED") return "void";
  return "open";
}

async function activateOwner(ownerType: OwnerType, ownerId: string) {
  if (ownerType === "organization") {
    await prisma.organization.update({
      where: { id: ownerId },
      data: { status: "active" },
    }).catch(() => null);
  } else {
    await prisma.franchise.update({
      where: { id: ownerId },
      data: { status: "active" },
    }).catch(() => null);
  }
}

// ----- Dunning (run periodically) -----
// D+3 lembrete, D+7 suspende módulos não essenciais (status past_due),
// D+15 suspende owner, D+30 cancela.
export async function runDunning() {
  const now = Date.now();
  const past = await prisma.subscription.findMany({
    where: { status: { in: ["past_due", "active"] } },
    include: { invoices: { where: { status: "uncollectible" }, orderBy: { dueDate: "asc" }, take: 1 } },
  });
  const results: { subscriptionId: string; action: string }[] = [];
  for (const sub of past) {
    const inv = sub.invoices[0];
    if (!inv?.dueDate) continue;
    const days = Math.floor((now - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (days < 3) continue;
    if (days >= 30) {
      await cancelSubscription(sub.id).catch(() => null);
      if (sub.ownerType === "organization")
        await prisma.organization.update({ where: { id: sub.ownerId }, data: { status: "canceled" } }).catch(() => null);
      else
        await prisma.franchise.update({ where: { id: sub.ownerId }, data: { status: "canceled" } }).catch(() => null);
      results.push({ subscriptionId: sub.id, action: "canceled" });
    } else if (days >= 15) {
      if (sub.ownerType === "organization")
        await prisma.organization.update({ where: { id: sub.ownerId }, data: { status: "suspended" } }).catch(() => null);
      else
        await prisma.franchise.update({ where: { id: sub.ownerId }, data: { status: "suspended" } }).catch(() => null);
      results.push({ subscriptionId: sub.id, action: "suspended" });
    } else if (days >= 7) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } }).catch(() => null);
      results.push({ subscriptionId: sub.id, action: "flagged_past_due" });
    } else {
      results.push({ subscriptionId: sub.id, action: "reminder" });
    }
  }
  return results;
}
