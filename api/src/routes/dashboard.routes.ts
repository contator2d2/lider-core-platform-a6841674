import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Dashboard "Hoje você precisa..." — lista priorizada de ações do líder.
 * Agrega delegações vencendo/atrasadas, rituais pendentes, 1:1s próximos,
 * cross-signals críticos e membros do time em queda.
 */
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function assertOrgAccess(userId: string, orgId: string) {
  const superRole = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (superRole) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}

export type TodayItem = {
  id: string;
  type: "delegation_overdue" | "delegation_due_soon" | "ritual_today" | "one_on_one" | "signal" | "team_drop";
  priority: 1 | 2 | 3;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
};

dashboardRouter.get("/:orgId/dashboard/today", async (req, res) => {
  const orgId = req.params.orgId;
  const userId = req.userId!;
  if (!(await assertOrgAccess(userId, orgId))) return res.status(403).json({ error: "Forbidden" });

  const now = new Date();
  const in2days = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfTomorrow = new Date(startOfToday.getTime() + 48 * 3600 * 1000);

  const [overdueDelegs, dueSoonDelegs, todaysRituals, upcoming1on1s, signals] = await Promise.all([
    prisma.delegation.findMany({
      where: {
        organizationId: orgId,
        delegatorId: userId,
        status: { in: ["open", "in_progress", "blocked"] },
        dueAt: { lt: now },
      },
      orderBy: { dueAt: "asc" },
      take: 10,
    }).catch(() => []),
    prisma.delegation.findMany({
      where: {
        organizationId: orgId,
        delegatorId: userId,
        status: { in: ["open", "in_progress"] },
        dueAt: { gte: now, lte: in2days },
      },
      orderBy: { dueAt: "asc" },
      take: 10,
    }).catch(() => []),
    prisma.ritualOccurrence.findMany({
      where: {
        ritual: { organizationId: orgId, ownerId: userId },
        scheduledAt: { gte: startOfToday, lte: endOfTomorrow },
        status: { in: ["scheduled", "in_progress"] },
      },
      include: { ritual: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }).catch(() => []),
    prisma.oneOnOne.findMany({
      where: {
        organizationId: orgId,
        leaderId: userId,
        scheduledAt: { gte: startOfToday, lte: endOfTomorrow },
        status: "scheduled",
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }).catch(() => []),
    prisma.crossSignal.findMany({
      where: {
        organizationId: orgId,
        userId,
        dismissedAt: null,
        severity: { in: ["high", "critical"] as never },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }).catch(() => []),
  ]);

  const items: TodayItem[] = [];

  for (const d of overdueDelegs) {
    items.push({
      id: `del-${d.id}`,
      type: "delegation_overdue",
      priority: 1,
      title: d.title,
      subtitle: `Atrasada${d.dueAt ? " desde " + d.dueAt.toLocaleDateString("pt-BR") : ""}`,
      cta: "Cobrar",
      href: "/app/organization/delegations",
    });
  }
  for (const s of signals) {
    items.push({
      id: `sig-${s.id}`,
      type: "signal",
      priority: 1,
      title: s.title,
      subtitle: s.detail.slice(0, 120),
      cta: "Analisar",
      href: "/app/consciencia",
    });
  }
  for (const o of upcoming1on1s) {
    const when = o.scheduledAt.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    items.push({
      id: `oo-${o.id}`,
      type: "one_on_one",
      priority: 2,
      title: "1:1 marcado",
      subtitle: `Preparar briefing — ${when}`,
      cta: "Preparar",
      href: "/app/one-on-ones",
    });
  }
  for (const r of todaysRituals) {
    items.push({
      id: `rit-${r.id}`,
      type: "ritual_today",
      priority: 2,
      title: r.ritual.name,
      subtitle: `Hoje às ${r.scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      cta: "Marcar feito",
      href: "/app/organization/rituals",
    });
  }
  for (const d of dueSoonDelegs) {
    items.push({
      id: `dels-${d.id}`,
      type: "delegation_due_soon",
      priority: 3,
      title: d.title,
      subtitle: d.dueAt ? `Vence em ${d.dueAt.toLocaleDateString("pt-BR")}` : "Sem prazo",
      cta: "Ver",
      href: "/app/organization/delegations",
    });
  }

  items.sort((a, b) => a.priority - b.priority);

  res.json({
    generatedAt: now.toISOString(),
    items: items.slice(0, 20),
    counts: {
      overdue: overdueDelegs.length,
      dueSoon: dueSoonDelegs.length,
      rituals: todaysRituals.length,
      oneOnOnes: upcoming1on1s.length,
      signals: signals.length,
    },
  });
});

dashboardRouter.get("/:orgId/team/health-summary", async (req, res) => {
  const orgId = req.params.orgId;
  const userId = req.userId!;
  if (!(await assertOrgAccess(userId, orgId))) return res.status(403).json({ error: "Forbidden" });

  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { include: { profile: { select: { fullName: true, avatarUrl: true } } } } },
    take: 100,
  });
  const userIds = memberships.map((m) => m.userId);
  if (!userIds.length) {
    return res.json({ score: null, delta: 0, membersAtRisk: 0, members: [] });
  }

  const snapshots = await prisma.leadershipScoreSnapshot.findMany({
    where: { organizationId: orgId, userId: { in: userIds } },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  }).catch(() => []);

  // pegar último snapshot de cada usuário e penúltimo pra delta
  const byUser = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const arr = byUser.get(s.userId) ?? [];
    arr.push(s);
    byUser.set(s.userId, arr);
  }

  const members = memberships.map((m) => {
    const list = byUser.get(m.userId) ?? [];
    const current = list[0]?.score ?? null;
    const previous = list[1]?.score ?? null;
    const delta = current != null && previous != null ? current - previous : 0;
    return {
      membershipId: m.id,
      userId: m.userId,
      name: m.user.profile?.fullName ?? m.user.email,
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      score: current,
      delta,
      atRisk: current != null && current < 60,
    };
  });

  const scored = members.filter((x) => x.score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + (x.score ?? 0), 0) / scored.length) : null;
  const prevAvg = (() => {
    const prev = members.map((m) => {
      const list = byUser.get(m.userId) ?? [];
      return list[1]?.score;
    }).filter((x): x is number => typeof x === "number");
    return prev.length ? Math.round(prev.reduce((s, x) => s + x, 0) / prev.length) : null;
  })();
  const delta = avg != null && prevAvg != null ? avg - prevAvg : 0;

  res.json({
    score: avg,
    delta,
    membersAtRisk: members.filter((m) => m.atRisk).length,
    members: members.sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 12),
  });
});