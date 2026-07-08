import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const franchiseRouter = Router();
franchiseRouter.use(requireAuth);

// Helper: is the current user a member of this franchise?
async function assertFranchiseAccess(userId: string, franchiseId: string, roles?: string[]) {
  const isSuper = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (isSuper) return true;
  const member = await prisma.franchiseMember.findUnique({
    where: { franchiseId_userId: { franchiseId, userId } },
  });
  if (!member) return false;
  if (roles && !roles.includes(member.role)) return false;
  return true;
}

// List franchises the current user belongs to
franchiseRouter.get("/mine", async (req, res) => {
  const memberships = await prisma.franchiseMember.findMany({
    where: { userId: req.userId! },
    include: {
      franchise: {
        include: {
          plan: true,
          _count: { select: { organizations: true, members: true } },
        },
      },
    },
  });
  res.json(memberships);
});

franchiseRouter.get("/:id", async (req, res) => {
  if (!(await assertFranchiseAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const f = await prisma.franchise.findUnique({
    where: { id: req.params.id },
    include: {
      plan: true,
      members: { include: { user: { include: { profile: true } } } },
      organizations: { include: { _count: { select: { memberships: true } } } },
    },
  });
  if (!f) return res.status(404).json({ error: "Não encontrada" });
  res.json(f);
});

// Franchise members
const memberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(1).optional(),
  role: z.enum(["owner", "admin", "consultant"]).default("consultant"),
});

franchiseRouter.post("/:id/members", async (req, res) => {
  if (!(await assertFranchiseAccess(req.userId!, req.params.id, ["owner", "admin"]))) {
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

  const m = await prisma.franchiseMember.upsert({
    where: { franchiseId_userId: { franchiseId: req.params.id, userId: user.id } },
    update: { role },
    create: { franchiseId: req.params.id, userId: user.id, role },
  });
  res.status(201).json(m);
});

franchiseRouter.delete("/:id/members/:userId", async (req, res) => {
  if (!(await assertFranchiseAccess(req.userId!, req.params.id, ["owner", "admin"]))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.franchiseMember
    .delete({
      where: { franchiseId_userId: { franchiseId: req.params.id, userId: req.params.userId } },
    })
    .catch(() => null);
  res.status(204).end();
});

// Companies under this franchise
const orgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  cnpj: z.string().optional().nullable(),
});

franchiseRouter.post("/:id/organizations", async (req, res) => {
  if (!(await assertFranchiseAccess(req.userId!, req.params.id, ["owner", "admin"]))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const org = await prisma.organization.create({
    data: { ...parsed.data, franchiseId: req.params.id },
  });
  res.status(201).json(org);
});
// KPIs consolidados da franquia
franchiseRouter.get("/:id/kpis", async (req, res) => {
  if (!(await assertFranchiseAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [orgs, orgsActive, leaders, licenses, aiUsage, members] = await Promise.all([
    prisma.organization.count({ where: { franchiseId: req.params.id } }),
    prisma.organization.count({ where: { franchiseId: req.params.id, status: "active" } }),
    prisma.membership.count({
      where: { organization: { franchiseId: req.params.id }, role: { in: ["leader", "hr_admin"] } },
    }),
    prisma.license.count({
      where: { organization: { franchiseId: req.params.id }, status: "active" },
    }),
    prisma.aIUsage.aggregate({
      _sum: { promptTokens: true, completionTokens: true, costCents: true },
      where: {
        franchiseId: req.params.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.franchiseMember.count({ where: { franchiseId: req.params.id } }),
  ]);
  res.json({
    organizations: orgs,
    organizationsActive: orgsActive,
    leaders,
    activeLicenses: licenses,
    members,
    aiTokens30d: (aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0),
    aiCostCents30d: aiUsage._sum.costCents ?? 0,
  });
});
