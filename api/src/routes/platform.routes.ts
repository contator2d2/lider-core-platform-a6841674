import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles } from "../auth.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireRoles("super_admin", "neo_admin"));

// ------------------------------------------------------------
// Audit helper — every mutation should call this.
// ------------------------------------------------------------
async function audit(
  actorUserId: string | undefined,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: metadata ? (metadata as never) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao gravar", err);
  }
}

// ============================================================
// DASHBOARD KPIs
// ============================================================
platformRouter.get("/kpis", async (_req, res) => {
  const [
    orgs,
    orgsActive,
    orgsImplantation,
    users,
    franchises,
    leaders,
    activeSubs,
    subs,
    licenses,
    aiUsage,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "active" } }),
    prisma.organization.count({ where: { status: "trial" } }),
    prisma.user.count(),
    prisma.franchise.count(),
    prisma.userRole.count({ where: { role: { in: ["leader", "hr_admin", "franchise_owner"] } } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trial"] } },
      include: { plan: { select: { priceMonthly: true } } },
    }),
    prisma.license.count({ where: { status: "active" } }),
    prisma.aIUsage.aggregate({
      _sum: { promptTokens: true, completionTokens: true, costCents: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const mrrCents = subs.reduce((sum, s) => sum + (s.plan?.priceMonthly ?? 0), 0);

  res.json({
    organizations: orgs,
    organizationsActive: orgsActive,
    organizationsImplantation: orgsImplantation,
    users,
    franchises,
    leaders,
    activeSubscriptions: activeSubs,
    activeLicenses: licenses,
    mrrCents,
    aiTokens30d: (aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0),
    aiCostCents30d: aiUsage._sum.costCents ?? 0,
  });
});

// ============================================================
// BRANCHES / AREAS / TEAMS
// ============================================================
platformRouter.get("/organizations/:orgId/branches", async (req, res) => {
  const list = await prisma.branch.findMany({
    where: { organizationId: req.params.orgId },
    include: { _count: { select: { areas: true, memberships: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

const branchSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  responsibleUserId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});

platformRouter.post("/organizations/:orgId/branches", async (req, res) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.branch.create({ data: { ...parsed.data, organizationId: req.params.orgId } });
  res.status(201).json(b);
});

platformRouter.patch("/branches/:id", async (req, res) => {
  const parsed = branchSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.branch.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(b);
});

platformRouter.delete("/branches/:id", async (req, res) => {
  await prisma.branch.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

platformRouter.get("/organizations/:orgId/areas", async (req, res) => {
  const list = await prisma.area.findMany({
    where: { organizationId: req.params.orgId },
    include: {
      branch: { select: { id: true, name: true } },
      _count: { select: { teams: true, memberships: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

const areaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  managerUserId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});

platformRouter.post("/organizations/:orgId/areas", async (req, res) => {
  const parsed = areaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const a = await prisma.area.create({ data: { ...parsed.data, organizationId: req.params.orgId } });
  res.status(201).json(a);
});

platformRouter.patch("/areas/:id", async (req, res) => {
  const parsed = areaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const a = await prisma.area.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(a);
});

platformRouter.delete("/areas/:id", async (req, res) => {
  await prisma.area.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

platformRouter.get("/organizations/:orgId/teams", async (req, res) => {
  const list = await prisma.team.findMany({
    where: { organizationId: req.params.orgId },
    include: {
      area: { select: { id: true, name: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

const teamSchema = z.object({
  name: z.string().min(1),
  areaId: z.string().uuid(),
  objectives: z.string().optional().nullable(),
  responsibleUserId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});

platformRouter.post("/organizations/:orgId/teams", async (req, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const t = await prisma.team.create({ data: { ...parsed.data, organizationId: req.params.orgId } });
  res.status(201).json(t);
});

platformRouter.patch("/teams/:id", async (req, res) => {
  const parsed = teamSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const t = await prisma.team.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(t);
});

platformRouter.delete("/teams/:id", async (req, res) => {
  await prisma.team.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// PRODUCT MODULES + PLAN <-> MODULE
// ============================================================
platformRouter.get("/modules", async (_req, res) => {
  const list = await prisma.productModule.findMany({ orderBy: [{ category: "asc" }, { orderIndex: "asc" }] });
  res.json(list);
});

const moduleSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum(["core", "ia", "analytics", "people", "integrations"]).default("core"),
  orderIndex: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

platformRouter.post("/modules", async (req, res) => {
  const parsed = moduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const m = await prisma.productModule.create({ data: parsed.data });
  res.status(201).json(m);
});

platformRouter.patch("/modules/:id", async (req, res) => {
  const parsed = moduleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const m = await prisma.productModule.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(m);
});

platformRouter.delete("/modules/:id", async (req, res) => {
  await prisma.productModule.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

platformRouter.get("/plans/:planId/modules", async (req, res) => {
  const list = await prisma.planModule.findMany({
    where: { planId: req.params.planId },
    include: { module: true },
  });
  res.json(list);
});

platformRouter.post("/plans/:planId/modules/:moduleId", async (req, res) => {
  const pm = await prisma.planModule.upsert({
    where: { planId_moduleId: { planId: req.params.planId, moduleId: req.params.moduleId } },
    update: {},
    create: { planId: req.params.planId, moduleId: req.params.moduleId },
  });
  res.status(201).json(pm);
});

platformRouter.delete("/plans/:planId/modules/:moduleId", async (req, res) => {
  await prisma.planModule
    .delete({
      where: { planId_moduleId: { planId: req.params.planId, moduleId: req.params.moduleId } },
    })
    .catch(() => null);
  res.status(204).end();
});

// ============================================================
// PERMISSIONS (RBAC granular)
// ============================================================
const ALL_RESOURCES = [
  "organizations",
  "franchises",
  "users",
  "branches",
  "areas",
  "teams",
  "plans",
  "licenses",
  "subscriptions",
  "invoices",
  "ai_settings",
  "branding",
  "methodology",
  "modules",
  "onboarding",
  "audit_log",
  "settings",
  "reports",
] as const;

const ALL_ACTIONS = ["view", "edit", "delete", "export", "admin"] as const;
const ALL_ROLES = [
  "super_admin",
  "neo_admin",
  "franchise_owner",
  "hr_admin",
  "leader",
  "collaborator",
] as const;

platformRouter.get("/permissions", async (_req, res) => {
  const list = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { resource: "asc" }] });
  res.json({
    resources: ALL_RESOURCES,
    actions: ALL_ACTIONS,
    roles: ALL_ROLES,
    grants: list,
  });
});

const permSchema = z.object({
  role: z.enum(ALL_ROLES),
  resource: z.string().min(1),
  action: z.enum(ALL_ACTIONS),
});

platformRouter.post("/permissions", async (req, res) => {
  const parsed = permSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = await prisma.rolePermission.upsert({
    where: { role_resource_action: parsed.data },
    update: {},
    create: parsed.data,
  });
  res.status(201).json(p);
});

platformRouter.delete("/permissions", async (req, res) => {
  const parsed = permSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.rolePermission
    .delete({ where: { role_resource_action: parsed.data } })
    .catch(() => null);
  res.status(204).end();
});

// ============================================================
// LICENSES + ASSIGNMENTS
// ============================================================
platformRouter.get("/licenses", async (req, res) => {
  const orgId = req.query.organizationId as string | undefined;
  const list = await prisma.license.findMany({
    where: orgId ? { organizationId: orgId } : undefined,
    include: {
      plan: { select: { id: true, name: true, slug: true } },
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

const licenseSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  seats: z.number().int().min(1).default(1),
  status: z.enum(["active", "suspended", "canceled", "expired"]).default("active"),
  activatedAt: z.string().datetime().optional().nullable(),
  renewsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

platformRouter.post("/licenses", async (req, res) => {
  const parsed = licenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const l = await prisma.license.create({
    data: {
      ...parsed.data,
      activatedAt: parsed.data.activatedAt ? new Date(parsed.data.activatedAt) : null,
      renewsAt: parsed.data.renewsAt ? new Date(parsed.data.renewsAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });
  res.status(201).json(l);
});

platformRouter.patch("/licenses/:id", async (req, res) => {
  const parsed = licenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const l = await prisma.license.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      activatedAt: parsed.data.activatedAt ? new Date(parsed.data.activatedAt) : undefined,
      renewsAt: parsed.data.renewsAt ? new Date(parsed.data.renewsAt) : undefined,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    },
  });
  res.json(l);
});

platformRouter.delete("/licenses/:id", async (req, res) => {
  await prisma.license.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

platformRouter.get("/licenses/:id/assignments", async (req, res) => {
  const list = await prisma.licenseAssignment.findMany({ where: { licenseId: req.params.id } });
  res.json(list);
});

platformRouter.post("/licenses/:id/assignments", async (req, res) => {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const a = await prisma.licenseAssignment.upsert({
    where: { licenseId_userId: { licenseId: req.params.id, userId: parsed.data.userId } },
    update: { revokedAt: null },
    create: { licenseId: req.params.id, userId: parsed.data.userId },
  });
  res.status(201).json(a);
});

platformRouter.delete("/licenses/:id/assignments/:userId", async (req, res) => {
  await prisma.licenseAssignment
    .delete({ where: { licenseId_userId: { licenseId: req.params.id, userId: req.params.userId } } })
    .catch(() => null);
  res.status(204).end();
});

// ============================================================
// ONBOARDING CHECKLIST
// ============================================================
const ONBOARDING_KEYS = [
  "company_created",
  "users_imported",
  "leaders_defined",
  "teams_created",
  "areas_created",
  "rituals_configured",
  "assessments_setup",
  "ai_configured",
  "training_completed",
] as const;

platformRouter.get("/organizations/:orgId/onboarding", async (req, res) => {
  const existing = await prisma.onboardingItem.findMany({
    where: { organizationId: req.params.orgId },
  });
  const map = new Map(existing.map((i) => [i.key, i]));
  const full = ONBOARDING_KEYS.map((key) => map.get(key) ?? {
    id: null,
    organizationId: req.params.orgId,
    key,
    completed: false,
    completedAt: null,
    notes: null,
  });
  res.json(full);
});

platformRouter.patch("/organizations/:orgId/onboarding/:key", async (req, res) => {
  const parsed = z
    .object({ completed: z.boolean().optional(), notes: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const key = req.params.key as (typeof ONBOARDING_KEYS)[number];
  const item = await prisma.onboardingItem.upsert({
    where: { organizationId_key: { organizationId: req.params.orgId, key } },
    update: {
      completed: parsed.data.completed ?? undefined,
      completedAt: parsed.data.completed ? new Date() : parsed.data.completed === false ? null : undefined,
      notes: parsed.data.notes ?? undefined,
    },
    create: {
      organizationId: req.params.orgId,
      key,
      completed: parsed.data.completed ?? false,
      completedAt: parsed.data.completed ? new Date() : null,
      notes: parsed.data.notes ?? null,
    },
  });
  res.json(item);
});

// ============================================================
// AUDIT LOG viewer (filtros)
// ============================================================
platformRouter.get("/logs", async (req, res) => {
  const action = req.query.action as string | undefined;
  const actorUserId = req.query.actorUserId as string | undefined;
  const targetType = req.query.targetType as string | undefined;
  const take = Math.min(Number(req.query.take ?? 200), 500);
  const logs = await prisma.auditLog.findMany({
    where: {
      action: action ? { contains: action, mode: "insensitive" } : undefined,
      actorUserId: actorUserId || undefined,
      targetType: targetType || undefined,
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { include: { profile: { select: { fullName: true } } } } },
  });
  res.json(logs);
});

// ============================================================
// GLOBAL SEARCH (⌘K palette)
// ============================================================
platformRouter.get("/search", async (req, res) => {
  const q = ((req.query.q as string) ?? "").trim();
  if (!q) return res.json({ organizations: [], franchises: [], users: [], branches: [], areas: [], teams: [] });
  const like = { contains: q, mode: "insensitive" as const };
  const [organizations, franchises, users, branches, areas, teams] = await Promise.all([
    prisma.organization.findMany({
      where: { OR: [{ name: like }, { slug: like }, { cnpj: like }, { legalName: like }] },
      select: { id: true, name: true, slug: true, status: true },
      take: 6,
    }),
    prisma.franchise.findMany({
      where: { OR: [{ name: like }, { slug: like }, { cnpj: like }] },
      select: { id: true, name: true, slug: true, status: true },
      take: 6,
    }),
    prisma.user.findMany({
      where: { OR: [{ email: like }, { profile: { fullName: like } }] },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
      take: 8,
    }),
    prisma.branch.findMany({
      where: { OR: [{ name: like }, { code: like }, { city: like }] },
      select: { id: true, name: true, city: true, organizationId: true },
      take: 6,
    }),
    prisma.area.findMany({
      where: { name: like },
      select: { id: true, name: true, organizationId: true },
      take: 6,
    }),
    prisma.team.findMany({
      where: { name: like },
      select: { id: true, name: true, organizationId: true, areaId: true },
      take: 6,
    }),
  ]);
  res.json({ organizations, franchises, users, branches, areas, teams });
});

// ============================================================
// USERS — full detail, profile edit, memberships
// ============================================================
platformRouter.get("/users/:id", async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      profile: true,
      roles: true,
      memberships: {
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json({
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    profile: u.profile,
    roles: u.roles.map((r) => r.role),
    memberships: u.memberships,
  });
});

const profilePatchSchema = z.object({
  fullName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  mfaEnabled: z.boolean().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

platformRouter.patch("/users/:id/profile", async (req, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = await prisma.profile.upsert({
    where: { id: req.params.id },
    update: parsed.data,
    create: { id: req.params.id, ...parsed.data },
  });
  await audit(req.userId, "user.profile.update", "user", req.params.id, parsed.data);
  res.json(p);
});

platformRouter.patch("/users/:id/password", async (req, res) => {
  const parsed = z.object({ password: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  await audit(req.userId, "user.password.reset", "user", req.params.id);
  res.status(204).end();
});

const membershipSchema = z.object({
  organizationId: z.string().uuid(),
  role: z.enum(["super_admin", "neo_admin", "franchise_owner", "hr_admin", "leader", "collaborator"]).default("collaborator"),
  branchId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  directLeaderId: z.string().uuid().optional().nullable(),
});

platformRouter.post("/users/:id/memberships", async (req, res) => {
  const parsed = membershipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const m = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: req.params.id, organizationId: parsed.data.organizationId } },
    update: {
      role: parsed.data.role,
      branchId: parsed.data.branchId ?? null,
      areaId: parsed.data.areaId ?? null,
      teamId: parsed.data.teamId ?? null,
      directLeaderId: parsed.data.directLeaderId ?? null,
    },
    create: {
      userId: req.params.id,
      organizationId: parsed.data.organizationId,
      role: parsed.data.role,
      branchId: parsed.data.branchId ?? null,
      areaId: parsed.data.areaId ?? null,
      teamId: parsed.data.teamId ?? null,
      directLeaderId: parsed.data.directLeaderId ?? null,
    },
  });
  await audit(req.userId, "user.membership.upsert", "user", req.params.id, parsed.data as never);
  res.status(201).json(m);
});

platformRouter.delete("/users/:id/memberships/:orgId", async (req, res) => {
  await prisma.membership
    .delete({ where: { userId_organizationId: { userId: req.params.id, organizationId: req.params.orgId } } })
    .catch(() => null);
  await audit(req.userId, "user.membership.remove", "user", req.params.id, { organizationId: req.params.orgId });
  res.status(204).end();
});

// ============================================================
// USER BATCH IMPORT (CSV/JSON rows)
// ============================================================
const importRowSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8).optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  whatsapp: z.string().optional(),
});
const importSchema = z.object({
  organizationId: z.string().uuid().optional(),
  defaultRole: z.enum(["leader", "collaborator", "hr_admin"]).default("collaborator"),
  rows: z.array(importRowSchema).min(1).max(500),
});

platformRouter.post("/users/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const results: { email: string; status: "created" | "updated" | "skipped"; id?: string; error?: string }[] = [];

  for (const row of parsed.data.rows) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: row.email } });
      let userId: string;
      if (existing) {
        userId = existing.id;
        await prisma.profile.upsert({
          where: { id: userId },
          update: {
            fullName: row.fullName,
            jobTitle: row.jobTitle ?? undefined,
            phone: row.phone ?? undefined,
            cpf: row.cpf ?? undefined,
            whatsapp: row.whatsapp ?? undefined,
          },
          create: {
            id: userId,
            fullName: row.fullName,
            jobTitle: row.jobTitle ?? null,
            phone: row.phone ?? null,
            cpf: row.cpf ?? null,
            whatsapp: row.whatsapp ?? null,
          },
        });
        results.push({ email: row.email, status: "updated", id: userId });
      } else {
        const pass = row.password ?? Math.random().toString(36).slice(2, 12) + "A1!";
        const created = await prisma.user.create({
          data: {
            email: row.email,
            passwordHash: await bcrypt.hash(pass, 10),
            profile: {
              create: {
                fullName: row.fullName,
                jobTitle: row.jobTitle ?? null,
                phone: row.phone ?? null,
                cpf: row.cpf ?? null,
                whatsapp: row.whatsapp ?? null,
              },
            },
          },
        });
        userId = created.id;
        results.push({ email: row.email, status: "created", id: userId });
      }

      if (parsed.data.organizationId) {
        await prisma.membership.upsert({
          where: { userId_organizationId: { userId, organizationId: parsed.data.organizationId } },
          update: {},
          create: {
            userId,
            organizationId: parsed.data.organizationId,
            role: parsed.data.defaultRole,
          },
        });
      }
    } catch (err) {
      results.push({ email: row.email, status: "skipped", error: (err as Error).message });
    }
  }

  await audit(req.userId, "users.import", "batch", undefined, {
    total: parsed.data.rows.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  });

  res.status(201).json({
    total: parsed.data.rows.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  });
});
// ============================================================
// PLATFORM SETTINGS — Central de Configurações (global scope)
// SMTP, WhatsApp, SSO, Backup, Billing, Security, Integrations
// ============================================================
const settingSchema = z.object({
  category: z.enum(["general", "smtp", "whatsapp", "sso", "backup", "billing", "security", "integrations"]),
  key: z.string().min(1),
  value: z.string().nullable().optional(),
  secret: z.boolean().optional().default(false),
});

platformRouter.get("/settings", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const list = await prisma.platformSetting.findMany({
    where: {
      scope: "global",
      ...(category ? { category: category as never } : {}),
    },
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
  // mask secret values so we never leak them to the frontend
  res.json(
    list.map((s) => ({
      ...s,
      value: s.secret && s.value ? "••••••••" : s.value,
      hasValue: !!s.value,
    })),
  );
});

platformRouter.post("/settings", async (req, res) => {
  const parsed = settingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { category, key, value, secret } = parsed.data;
  const setting = await prisma.platformSetting.upsert({
    where: {
      scope_scopeId_category_key: { scope: "global", scopeId: null as never, category, key },
    },
    update: { value: value ?? null, secret: secret ?? false, updatedBy: req.userId ?? null },
    create: {
      scope: "global",
      category,
      key,
      value: value ?? null,
      secret: secret ?? false,
      updatedBy: req.userId ?? null,
    },
  });
  await audit(req.userId, "settings.upsert", "platform_setting", setting.id, { category, key });
  res.json({ ...setting, value: setting.secret && setting.value ? "••••••••" : setting.value, hasValue: !!setting.value });
});

platformRouter.delete("/settings/:id", async (req, res) => {
  const s = await prisma.platformSetting.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!s) return res.status(404).json({ error: "Não encontrado" });
  await audit(req.userId, "settings.delete", "platform_setting", s.id, { category: s.category, key: s.key });
  res.status(204).end();
});
