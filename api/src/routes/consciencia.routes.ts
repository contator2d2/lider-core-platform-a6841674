import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * MÓDULO C — Consciência.
 *
 * Regra de visibilidade: perfil detalhado (assessment, sabotadores, riscos)
 * é SOMENTE do próprio líder. A organização vê apenas cobertura agregada
 * (existência do perfil, não conteúdo).
 */
export const conscienciaRouter = Router();
conscienciaRouter.use(requireAuth);

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

conscienciaRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// ------------------------------------------------------------
// GET /:orgId/consciencia/me — perfil + compromissos + alertas
// ------------------------------------------------------------
conscienciaRouter.get("/:orgId/consciencia/me", async (req, res) => {
  const userId = req.userId!;
  const orgId = req.params.orgId;

  const [profile, commitments, signals] = await Promise.all([
    prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    }),
    prisma.mentorshipCommitment.findMany({
      where: { organizationId: orgId, userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.crossSignal.findMany({
      where: { organizationId: orgId, userId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const stale = profile?.assessmentAt
    ? Date.now() - profile.assessmentAt.getTime() > 90 * 86400000
    : profile != null;

  res.json({ profile, commitments, signals, assessmentStale: stale });
});

// ------------------------------------------------------------
// PUT /:orgId/consciencia/me — upsert do meu perfil
// ------------------------------------------------------------
const profileSchema = z.object({
  declaredRole: z.string().optional().nullable(),
  assessmentType: z.enum(["disc", "big_five", "other"]).optional().nullable(),
  assessmentTraits: z.record(z.any()).optional().nullable(),
  sabotages: z.array(z.string()).default([]),
  communicationStyle: z.string().optional().nullable(),
  riskFlags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  markAssessedNow: z.boolean().optional(),
});

conscienciaRouter.put("/:orgId/consciencia/me", async (req, res) => {
  try {
    const data = profileSchema.parse(req.body);
    const userId = req.userId!;
    const orgId = req.params.orgId;
    const assessmentAt = data.markAssessedNow ? new Date() : undefined;

    const saved = await prisma.leaderProfile.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      update: {
        declaredRole: data.declaredRole ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        ...(assessmentAt ? { assessmentAt } : {}),
      },
      create: {
        organizationId: orgId,
        userId,
        declaredRole: data.declaredRole ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        assessmentAt: assessmentAt ?? new Date(),
      },
    });

    // Recomputa sinais cruzados assim que o perfil muda
    await computeCrossSignals(orgId, userId).catch((e) => console.error("[cross-signals]", e));

    res.json(saved);
  } catch (err) {
    badReq(res, err);
  }
});

// ------------------------------------------------------------
// COVERAGE — só quantitativo, jamais conteúdo
// ------------------------------------------------------------
conscienciaRouter.get("/:orgId/consciencia/coverage", async (req, res) => {
  const orgId = req.params.orgId;
  const [totalMembers, profiled, assessed] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.leaderProfile.count({ where: { organizationId: orgId } }),
    prisma.leaderProfile.count({
      where: { organizationId: orgId, assessmentType: { not: null } },
    }),
  ]);
  res.json({ totalMembers, profiled, assessed });
});

// ------------------------------------------------------------
// COMPROMISSOS de mentoria (CRUD do próprio usuário)
// ------------------------------------------------------------
const commitmentSchema = z.object({
  phrase: z.string().min(3),
  reviewAt: z.string().datetime().optional().nullable(),
  status: z.enum(["active", "in_progress", "done", "dropped"]).default("active"),
});

conscienciaRouter.post("/:orgId/consciencia/commitments", async (req, res) => {
  try {
    const data = commitmentSchema.parse(req.body);
    const c = await prisma.mentorshipCommitment.create({
      data: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        phrase: data.phrase,
        status: data.status,
        reviewAt: data.reviewAt ? new Date(data.reviewAt) : null,
      },
    });
    res.status(201).json(c);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.patch("/:orgId/consciencia/commitments/:id", async (req, res) => {
  try {
    const existing = await prisma.mentorshipCommitment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Not found" });
    const data = commitmentSchema.partial().parse(req.body);
    const c = await prisma.mentorshipCommitment.update({
      where: { id: req.params.id },
      data: {
        ...(data.phrase != null ? { phrase: data.phrase } : {}),
        ...(data.status != null ? { status: data.status } : {}),
        ...(data.reviewAt !== undefined
          ? { reviewAt: data.reviewAt ? new Date(data.reviewAt) : null }
          : {}),
      },
    });
    res.json(c);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.delete("/:orgId/consciencia/commitments/:id", async (req, res) => {
  const existing = await prisma.mentorshipCommitment.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Not found" });
  await prisma.mentorshipCommitment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

conscienciaRouter.post("/:orgId/consciencia/signals/:id/dismiss", async (req, res) => {
  const s = await prisma.crossSignal.findUnique({ where: { id: req.params.id } });
  if (!s || (s.userId && s.userId !== req.userId)) return res.status(404).json({ error: "Not found" });
  await prisma.crossSignal.update({
    where: { id: req.params.id },
    data: { dismissedAt: new Date() },
  });
  res.status(204).end();
});

// ============================================================
// MOTOR DE ALERTAS CRUZADOS
// Regras (§3.4 da especificação):
//   perfil_risco[controle]       + rituais caíram >30% em 14d
//   perfil_risco[evita_conflito] + delegação atrasada 2x mesmo owner
//   assessment > 90 dias         → sinal de auto-percepção defasada
// Sempre dado objetivo + leitura comportamental.
// ============================================================
export async function computeCrossSignals(orgId: string, userId?: string) {
  const profiles = await prisma.leaderProfile.findMany({
    where: { organizationId: orgId, ...(userId ? { userId } : {}) },
  });

  const created: string[] = [];

  for (const p of profiles) {
    const risks = new Set(p.riskFlags);

    // 1) controle: adesão a rituais caiu > 30% nos últimos 14d vs 14d anteriores
    if (risks.has("controle")) {
      const now = new Date();
      const d14 = new Date(now.getTime() - 14 * 86400000);
      const d28 = new Date(now.getTime() - 28 * 86400000);

      const [recent, previous] = await Promise.all([
        prisma.ritualOccurrence.findMany({
          where: {
            ritual: { organizationId: orgId },
            scheduledAt: { gte: d14, lte: now },
          },
          select: { status: true },
        }),
        prisma.ritualOccurrence.findMany({
          where: {
            ritual: { organizationId: orgId },
            scheduledAt: { gte: d28, lt: d14 },
          },
          select: { status: true },
        }),
      ]);
      const adh = (arr: { status: string }[]) => {
        if (!arr.length) return null;
        const done = arr.filter((r) => r.status === "done").length;
        return done / arr.length;
      };
      const rec = adh(recent);
      const prev = adh(previous);
      if (rec != null && prev != null && prev > 0 && (prev - rec) / prev > 0.3) {
        await upsertSignal(orgId, p.userId, {
          kind: "ritual_drop_control",
          severity: "high",
          title: "Adesão a rituais caiu — cuidado com o padrão de controle",
          detail: `Últimos 14d: ${Math.round(rec * 100)}% de rituais no prazo (vs ${Math.round(prev * 100)}% nas 2 semanas anteriores). Perfil sinaliza tendência de controle; quando a cadência cai, o time perde referência.`,
        });
        created.push("ritual_drop_control");
      }
    }

    // 2) evita_conflito: mesmo assignee com 2+ delegações atrasadas
    if (risks.has("evita_conflito")) {
      const overdue = await prisma.delegation.findMany({
        where: {
          organizationId: orgId,
          delegatorId: p.userId,
          status: { notIn: ["done", "canceled"] },
          dueAt: { lt: new Date() },
        },
        select: { assigneeId: true },
      });
      const counts = new Map<string, number>();
      for (const d of overdue) if (d.assigneeId) counts.set(d.assigneeId, (counts.get(d.assigneeId) ?? 0) + 1);
      const offenders = Array.from(counts.entries()).filter(([, n]) => n >= 2);
      if (offenders.length) {
        await upsertSignal(orgId, p.userId, {
          kind: "delegation_delay_conflict_avoidance",
          severity: "high",
          title: "Atrasos concentrados sem conversa dura",
          detail: `${offenders.length} pessoa(s) com 2+ delegações atrasadas suas. Perfil sinaliza evitar conflito; o silêncio virou padrão.`,
          sourceRefs: { assignees: offenders.map(([id]) => id) },
        });
        created.push("delegation_delay_conflict_avoidance");
      }
    }

    // 3) auto-percepção defasada (>90d desde último assessment)
    if (p.assessmentAt && Date.now() - p.assessmentAt.getTime() > 90 * 86400000) {
      await upsertSignal(orgId, p.userId, {
        kind: "self_awareness_stale",
        severity: "low",
        title: "Rever o próprio perfil (90 dias)",
        detail: `Última atualização em ${p.assessmentAt.toLocaleDateString("pt-BR")}. A metodologia pede revisão trimestral do assessment.`,
      });
      created.push("self_awareness_stale");
    }
  }

  return { created };
}

async function upsertSignal(
  orgId: string,
  userId: string,
  s: { kind: "ritual_drop_control" | "delegation_delay_conflict_avoidance" | "concentration_high" | "self_awareness_stale" | "other"; severity: "low" | "medium" | "high"; title: string; detail: string; sourceRefs?: Record<string, unknown> },
) {
  // Evita duplicar sinal ativo do mesmo tipo para o mesmo usuário
  const existing = await prisma.crossSignal.findFirst({
    where: { organizationId: orgId, userId, kind: s.kind, dismissedAt: null },
  });
  if (existing) {
    await prisma.crossSignal.update({
      where: { id: existing.id },
      data: { severity: s.severity, title: s.title, detail: s.detail, sourceRefs: (s.sourceRefs ?? null) as never },
    });
  } else {
    await prisma.crossSignal.create({
      data: {
        organizationId: orgId,
        userId,
        kind: s.kind,
        severity: s.severity,
        title: s.title,
        detail: s.detail,
        sourceRefs: (s.sourceRefs ?? null) as never,
      },
    });
  }
}