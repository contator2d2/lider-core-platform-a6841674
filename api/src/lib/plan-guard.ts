// Plan / module / seat enforcement middlewares.
// Look up the active subscription for the caller's organization and reject
// requests that don't meet the requirement.

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";

type Tier = "essencial" | "profissional" | "enterprise";
const RANK: Record<Tier, number> = { essencial: 1, profissional: 2, enterprise: 3 };

async function primaryOrg(userId: string) {
  const m = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return m?.organization ?? null;
}

export function requirePlan(minTier: Tier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const org = await primaryOrg(req.userId);
    if (!org) return res.status(403).json({ error: "Sem empresa associada" });
    if (RANK[org.plan as Tier] < RANK[minTier])
      return res.status(402).json({ error: `Requer plano ${minTier} ou superior`, currentPlan: org.plan });
    if (org.status === "suspended" || org.status === "canceled")
      return res.status(402).json({ error: "Assinatura inativa", status: org.status });
    next();
  };
}

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const org = await primaryOrg(req.userId);
    if (!org) return res.status(403).json({ error: "Sem empresa associada" });
    const plan = await prisma.plan.findFirst({
      where: { slug: org.plan },
      include: { planModules: { include: { module: true } } },
    });
    const has = plan?.planModules.some((pm) => pm.module.code === moduleCode);
    if (!has)
      return res.status(402).json({ error: `Módulo '${moduleCode}' não incluído no plano`, currentPlan: org.plan });
    next();
  };
}

// Checks license seat availability before creating a new user assignment.
export async function ensureSeatAvailable(organizationId: string): Promise<{ ok: boolean; used: number; total: number }> {
  const licenses = await prisma.license.findMany({
    where: { organizationId, status: "active" },
    include: { _count: { select: { assignments: true } } },
  });
  const total = licenses.reduce((s, l) => s + l.seats, 0);
  const used = licenses.reduce((s, l) => s + l._count.assignments, 0);
  return { ok: used < total, used, total };
}
