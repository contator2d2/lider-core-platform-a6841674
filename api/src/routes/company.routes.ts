import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const companyRouter = Router();
companyRouter.use(requireAuth);

async function assertCompanyAccess(userId: string, orgId: string, roles?: string[]) {
  const isSuper = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (isSuper) return true;
  // Also allow franchise owners/admins of the parent franchise
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return false;
  if (org.franchiseId) {
    const fm = await prisma.franchiseMember.findUnique({
      where: { franchiseId_userId: { franchiseId: org.franchiseId, userId } },
    });
    if (fm && ["owner", "admin"].includes(fm.role)) return true;
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  if (!membership) return false;
  if (roles && !roles.includes(membership.role)) return false;
  return true;
}

companyRouter.get("/mine", async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.userId! },
    include: {
      organization: { include: { franchise: true, _count: { select: { memberships: true } } } },
    },
  });
  res.json(memberships);
});

companyRouter.get("/:id", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      franchise: true,
      memberships: { include: { user: { include: { profile: true } } } },
    },
  });
  if (!org) return res.status(404).json({ error: "Não encontrada" });
  res.json(org);
});

const memberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(1).optional(),
  role: z.enum(["franchise_owner", "hr_admin", "leader", "collaborator"]).default("leader"),
});

companyRouter.post("/:id/members", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id, ["franchise_owner", "hr_admin"]))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, fullName, role } = parsed.data;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!password || !fullName) {
      return res.status(400).json({ error: "password e fullName obrigatórios para novo usuário" });
    }
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        profile: { create: { fullName } },
      },
    });
  }

  const m = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: req.params.id } },
    update: { role },
    create: { userId: user.id, organizationId: req.params.id, role },
  });
  res.status(201).json(m);
});

companyRouter.delete("/:id/members/:userId", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id, ["franchise_owner", "hr_admin"]))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.membership
    .delete({
      where: { userId_organizationId: { userId: req.params.userId, organizationId: req.params.id } },
    })
    .catch(() => null);
  res.status(204).end();
});
// KPIs consolidados da empresa
companyRouter.get("/:id/kpis", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [members, leaders, branches, areas, teams, licenses, aiUsage] = await Promise.all([
    prisma.membership.count({ where: { organizationId: req.params.id } }),
    prisma.membership.count({ where: { organizationId: req.params.id, role: "leader" } }),
    prisma.branch.count({ where: { organizationId: req.params.id } }),
    prisma.area.count({ where: { organizationId: req.params.id } }),
    prisma.team.count({ where: { organizationId: req.params.id } }),
    prisma.license.count({ where: { organizationId: req.params.id, status: "active" } }),
    prisma.aIUsage.aggregate({
      _sum: { promptTokens: true, completionTokens: true, costCents: true },
      where: {
        organizationId: req.params.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  res.json({
    members,
    leaders,
    branches,
    areas,
    teams,
    activeLicenses: licenses,
    aiTokens30d: (aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0),
    aiCostCents30d: aiUsage._sum.costCents ?? 0,
  });
});

// Líderes da empresa (útil para o painel Company)
companyRouter.get("/:id/leaders", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const list = await prisma.membership.findMany({
    where: { organizationId: req.params.id, role: "leader" },
    include: {
      user: { include: { profile: true } },
      branch: { select: { id: true, name: true } },
      area: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});
