import { Router, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Tela 3 — Mapa da Equipe.
 * Visão por colaborador: papel, entregas esperadas, indicadores centrais,
 * nível de autonomia, feedback histórico, delegações abertas.
 *
 * Regra: agrega fatos que já existem no sistema. O único conteúdo próprio
 * é o TeamMemberProfile (definido pelo líder).
 */
export const teamRouter = Router();
teamRouter.use(requireAuth);

async function isSuper(userId: string) {
  const r = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  return !!r;
}
async function assertOrgAccess(userId: string, orgId: string) {
  if (await isSuper(userId)) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}
function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

teamRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /:orgId/team — lista consolidada
teamRouter.get("/:orgId/team", async (req, res) => {
  const orgId = req.params.orgId;
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: {
      user: { include: { profile: true } },
      area: true,
      team: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const profiles = await prisma.teamMemberProfile.findMany({
    where: { organizationId: orgId },
  });
  const profileByMembership = new Map(profiles.map((p) => [p.membershipId, p]));

  const userIds = memberships.map((m) => m.userId);

  const [openDelegs, feedbacks, pdis] = await Promise.all([
    prisma.delegation.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: orgId,
        assigneeId: { in: userIds },
        status: { notIn: ["done", "canceled"] },
      },
      _count: { _all: true },
    }),
    prisma.feedbackRecord.groupBy({
      by: ["subjectUserId"],
      where: { organizationId: orgId, subjectUserId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.pdi.findMany({
      where: { organizationId: orgId, subjectUserId: { in: userIds }, status: "ativo" },
      select: { subjectUserId: true },
    }),
  ]);

  const delegCount = new Map(openDelegs.map((d) => [d.assigneeId, d._count._all]));
  const feedbackCount = new Map(feedbacks.map((f) => [f.subjectUserId, f._count._all]));
  const activePdi = new Set(pdis.map((p) => p.subjectUserId));

  res.json(
    memberships.map((m) => {
      const profile = profileByMembership.get(m.id);
      return {
        membershipId: m.id,
        userId: m.userId,
        role: m.role,
        fullName: m.user.profile?.fullName ?? m.user.email,
        email: m.user.email,
        avatarUrl: m.user.profile?.avatarUrl ?? null,
        areaName: m.area?.name ?? null,
        teamName: m.team?.name ?? null,
        whatsapp: m.user.profile?.whatsapp ?? m.user.profile?.phone ?? null,
        phone: m.user.profile?.phone ?? null,
        profile: profile
          ? {
              roleTitle: profile.roleTitle,
              expectedDeliverables: profile.expectedDeliverables,
              keyIndicators: profile.keyIndicators,
              autonomyLevel: profile.autonomyLevel,
              strengths: profile.strengths,
              developPoints: profile.developPoints,
              notes: profile.notes,
            }
          : null,
        openDelegations: delegCount.get(m.userId) ?? 0,
        feedbackCount: feedbackCount.get(m.userId) ?? 0,
        hasActivePdi: activePdi.has(m.userId),
      };
    }),
  );
});

// GET /:orgId/team/:membershipId — detalhe
teamRouter.get("/:orgId/team/:membershipId", async (req, res) => {
  const { orgId, membershipId } = req.params;
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: orgId },
    include: { user: { include: { profile: true } }, area: true, team: true },
  });
  if (!m) return res.status(404).json({ error: "Not found" });

  const [profile, feedbacks, delegations, pdis] = await Promise.all([
    prisma.teamMemberProfile.findUnique({ where: { membershipId } }),
    prisma.feedbackRecord.findMany({
      where: { organizationId: orgId, subjectUserId: m.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.delegation.findMany({
      where: { organizationId: orgId, assigneeId: m.userId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 30,
    }),
    prisma.pdi.findMany({
      where: { organizationId: orgId, subjectUserId: m.userId },
      include: { goals: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({
    membershipId: m.id,
    userId: m.userId,
    fullName: m.user.profile?.fullName ?? m.user.email,
    email: m.user.email,
    avatarUrl: m.user.profile?.avatarUrl ?? null,
    role: m.role,
    areaName: m.area?.name ?? null,
    teamName: m.team?.name ?? null,
    profile,
    feedbacks,
    delegations,
    pdis,
  });
});

const profileSchema = z.object({
  roleTitle: z.string().optional().nullable(),
  expectedDeliverables: z.array(z.string()).default([]),
  keyIndicators: z.array(z.string()).default([]),
  autonomyLevel: z.enum(["n1_direciono", "n2_acompanho", "n3_valido", "n4_delego", "n5_autonomo"]),
  strengths: z.array(z.string()).default([]),
  developPoints: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

teamRouter.put("/:orgId/team/:membershipId/profile", async (req, res) => {
  try {
    const { orgId, membershipId } = req.params;
    const m = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });
    if (!m) return res.status(404).json({ error: "Not found" });
    const data = profileSchema.parse(req.body);
    const saved = await prisma.teamMemberProfile.upsert({
      where: { membershipId },
      update: {
        roleTitle: data.roleTitle ?? null,
        expectedDeliverables: data.expectedDeliverables,
        keyIndicators: data.keyIndicators,
        autonomyLevel: data.autonomyLevel,
        strengths: data.strengths,
        developPoints: data.developPoints,
        notes: data.notes ?? null,
        updatedBy: req.userId!,
      },
      create: {
        organizationId: orgId,
        membershipId,
        roleTitle: data.roleTitle ?? null,
        expectedDeliverables: data.expectedDeliverables,
        keyIndicators: data.keyIndicators,
        autonomyLevel: data.autonomyLevel,
        strengths: data.strengths,
        developPoints: data.developPoints,
        notes: data.notes ?? null,
        updatedBy: req.userId!,
      },
    });
    res.json(saved);
  } catch (err) {
    badReq(res, err);
  }
});