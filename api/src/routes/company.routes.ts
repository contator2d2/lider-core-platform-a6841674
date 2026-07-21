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

// ============================================================
// Dashboard Empresa v2 — ROI + alertas agregados
// (Fase final — fecha spec §7 do documento funcional)
// ============================================================
companyRouter.get("/:id/roi", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const orgId = req.params.id;
  const now = new Date();
  const ymNow = now.getFullYear() * 12 + now.getMonth();

  // Custo: soma de invoices pagas nos últimos 12 meses das subscriptions
  // ligadas à organização (owner_type=organization) ou à franquia dela.
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const subOwners: Array<{ ownerType: "organization" | "franchise"; ownerId: string }> = [
    { ownerType: "organization", ownerId: orgId },
  ];
  if (org?.franchiseId) {
    subOwners.push({ ownerType: "franchise", ownerId: org.franchiseId });
  }
  const subs = await prisma.subscription.findMany({
    where: { OR: subOwners.map((o) => ({ ownerType: o.ownerType, ownerId: o.ownerId })) },
    select: { id: true },
  });
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(now.getMonth() - 12);
  const invoices = subs.length
    ? await prisma.invoice.findMany({
        where: {
          subscriptionId: { in: subs.map((s) => s.id) },
          status: "paid",
          paidAt: { gte: twelveMonthsAgo },
        },
        select: { amountCents: true, paidAt: true },
      })
    : [];
  const investCents12m = invoices.reduce((a, b) => a + (b.amountCents ?? 0), 0);

  // Ganho: delta médio de score H/S/H (últimos 3 meses vs 3 anteriores).
  const snaps = await prisma.leadershipScoreSnapshot.findMany({
    where: { organizationId: orgId },
    select: {
      userId: true,
      periodYear: true,
      periodMonth: true,
      score: true,
      hardScore: true,
      softScore: true,
      heartScore: true,
    },
  });
  const bucketRecent: number[] = [];
  const bucketPrev: number[] = [];
  const byDim = { hard: { r: [] as number[], p: [] as number[] }, soft: { r: [] as number[], p: [] as number[] }, heart: { r: [] as number[], p: [] as number[] } };
  for (const s of snaps) {
    const ym = s.periodYear * 12 + (s.periodMonth - 1);
    const diff = ymNow - ym;
    if (diff >= 0 && diff < 3) {
      bucketRecent.push(s.score);
      byDim.hard.r.push(s.hardScore);
      byDim.soft.r.push(s.softScore);
      byDim.heart.r.push(s.heartScore);
    } else if (diff >= 3 && diff < 6) {
      bucketPrev.push(s.score);
      byDim.hard.p.push(s.hardScore);
      byDim.soft.p.push(s.softScore);
      byDim.heart.p.push(s.heartScore);
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const deltaScore = Math.round((avg(bucketRecent) - avg(bucketPrev)) * 10) / 10;
  const deltaHard = Math.round((avg(byDim.hard.r) - avg(byDim.hard.p)) * 10) / 10;
  const deltaSoft = Math.round((avg(byDim.soft.r) - avg(byDim.soft.p)) * 10) / 10;
  const deltaHeart = Math.round((avg(byDim.heart.r) - avg(byDim.heart.p)) * 10) / 10;

  // ROI: pontos de score ganhos por R$ 1.000 investidos.
  const investBRL = investCents12m / 100;
  const roiPointsPerKBRL =
    investBRL > 0 ? Math.round(((deltaScore * bucketRecent.length) / (investBRL / 1000)) * 10) / 10 : null;

  // Alertas agregados de líderes em risco (só contagem + primeiros nomes p/ ação).
  const latestByUser = new Map<string, { score: number; ym: number }>();
  for (const s of snaps) {
    const ym = s.periodYear * 12 + (s.periodMonth - 1);
    const cur = latestByUser.get(s.userId);
    if (!cur || ym > cur.ym) latestByUser.set(s.userId, { score: s.score, ym });
  }
  const leadersAtRisk = Array.from(latestByUser.entries()).filter(([, v]) => v.score < 50).length;
  const leadersHealthy = Array.from(latestByUser.entries()).filter(([, v]) => v.score >= 70).length;

  res.json({
    period: { months: 12, from: twelveMonthsAgo.toISOString(), to: now.toISOString() },
    invest: { totalCents: investCents12m, currency: "BRL", invoices: invoices.length },
    delta: {
      overall: deltaScore,
      hard: deltaHard,
      soft: deltaSoft,
      heart: deltaHeart,
      sampleRecent: bucketRecent.length,
      samplePrev: bucketPrev.length,
    },
    roi: {
      pointsPerThousandBRL: roiPointsPerKBRL,
      leadersMeasured: latestByUser.size,
      leadersHealthy,
      leadersAtRisk,
    },
  });
});

// Auditoria de foro íntimo — endpoint declarativo que documenta e testa
// quais tabelas a Empresa PODE ver (agregados) e quais NÃO PODE (conteúdo bruto).
companyRouter.get("/:id/privacy-audit", async (req, res) => {
  if (!(await assertCompanyAccess(req.userId!, req.params.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  // Whitelist do que a Empresa vê. Se algum dia adicionarmos um endpoint
  // /companies/:id que retorne conteúdo bruto de feedback/1:1/assessment,
  // este audit precisa ser atualizado explicitamente.
  const rules = [
    { area: "Feedbacks", scope: "aggregate", exposed: ["contagem", "cadência", "data"], protected: ["texto", "autor", "destinatário"] },
    { area: "1:1s", scope: "aggregate", exposed: ["contagem", "cadência"], protected: ["notas", "briefing", "acordos"] },
    { area: "Assessment C (DISC/MBTI/sabotadores/H·S·H)", scope: "self-only", exposed: ["% aplicado", "% com perfil"], protected: ["respostas", "perfil individual", "gaps"] },
    { area: "Pulsos climáticos", scope: "aggregate", exposed: ["média", "distribuição"], protected: ["resposta individual", "identidade"] },
    { area: "Score H/S/H", scope: "aggregate + por líder", exposed: ["score final", "diagnóstico curto"], protected: ["evidências brutas", "logs de rituais"] },
    { area: "Kudos", scope: "public", exposed: ["mural"], protected: [] },
  ];
  res.json({
    contract: "foro-intimo-v1",
    updatedAt: new Date().toISOString(),
    rules,
    note: "Empresa nunca acessa conteúdo bruto de feedbacks, 1:1s ou assessments. Apenas sinais agregados e score.",
  });
});
