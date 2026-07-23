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
  notMine: z.string().optional().nullable(),
  assessmentType: z.enum(["disc", "big_five", "other"]).optional().nullable(),
  assessmentTraits: z.record(z.any()).optional().nullable(),
  sabotages: z.array(z.string()).default([]),
  communicationStyle: z.string().optional().nullable(),
  mbtiType: z.string().max(4).optional().nullable(),
  discPrimary: z.enum(["D", "I", "S", "C"]).optional().nullable(),
  egogramaTraits: z.record(z.any()).optional().nullable(),
  hardSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  softSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  heartSelfScore: z.number().int().min(0).max(100).optional().nullable(),
  riskFlags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  markAssessedNow: z.boolean().optional(),
});

// Módulo C v2 — extensão do perfil
const profileV2Schema = profileSchema.extend({
  activityDescription: z.string().optional().nullable(),
  sabotageScores: z.record(z.number()).optional().nullable(),
  cerebralProfile: z.record(z.number()).optional().nullable(),
  cerebralPrimary: z.enum(["aguia", "lobo", "gato", "tubarao"]).optional().nullable(),
  qpScore: z.number().int().min(0).max(100).optional().nullable(),
  hardAnswers: z.array(z.number()).optional().nullable(),
  softAnswers: z.array(z.number()).optional().nullable(),
  heartAnswers: z.array(z.number()).optional().nullable(),
  discAnswers: z.record(z.any()).optional().nullable(),
  discProfile: z.record(z.any()).optional().nullable(),
  coachCadence: z.enum(["weekly", "biweekly", "monthly"]).optional(),
});

conscienciaRouter.put("/:orgId/consciencia/me", async (req, res) => {
  try {
    const data = profileV2Schema.parse(req.body);
    const userId = req.userId!;
    const orgId = req.params.orgId;
    const assessmentAt = data.markAssessedNow ? new Date() : undefined;

    const v2Fields = {
      ...(data.activityDescription !== undefined ? { activityDescription: data.activityDescription ?? null } : {}),
      ...(data.sabotageScores !== undefined ? { sabotageScores: (data.sabotageScores ?? null) as never } : {}),
      ...(data.cerebralProfile !== undefined ? { cerebralProfile: (data.cerebralProfile ?? null) as never } : {}),
      ...(data.cerebralPrimary !== undefined ? { cerebralPrimary: data.cerebralPrimary ?? null } : {}),
      ...(data.qpScore !== undefined ? { qpScore: data.qpScore ?? null } : {}),
      ...(data.hardAnswers !== undefined ? { hardAnswers: (data.hardAnswers ?? null) as never } : {}),
      ...(data.softAnswers !== undefined ? { softAnswers: (data.softAnswers ?? null) as never } : {}),
      ...(data.heartAnswers !== undefined ? { heartAnswers: (data.heartAnswers ?? null) as never } : {}),
      ...(data.discAnswers !== undefined ? { discAnswers: (data.discAnswers ?? null) as never } : {}),
      ...(data.discProfile !== undefined ? { discProfile: (data.discProfile ?? null) as never } : {}),
      ...(data.coachCadence !== undefined ? { coachCadence: data.coachCadence } : {}),
    };

    const saved = await prisma.leaderProfile.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      update: {
        declaredRole: data.declaredRole ?? null,
        notMine: data.notMine ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        mbtiType: data.mbtiType ?? null,
        discPrimary: data.discPrimary ?? null,
        egogramaTraits: (data.egogramaTraits ?? null) as never,
        hardSelfScore: data.hardSelfScore ?? null,
        softSelfScore: data.softSelfScore ?? null,
        heartSelfScore: data.heartSelfScore ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        ...(assessmentAt ? { assessmentAt } : {}),
        ...v2Fields,
      },
      create: {
        organizationId: orgId,
        userId,
        declaredRole: data.declaredRole ?? null,
        notMine: data.notMine ?? null,
        assessmentType: data.assessmentType ?? null,
        assessmentTraits: (data.assessmentTraits ?? null) as never,
        sabotages: data.sabotages,
        communicationStyle: data.communicationStyle ?? null,
        mbtiType: data.mbtiType ?? null,
        discPrimary: data.discPrimary ?? null,
        egogramaTraits: (data.egogramaTraits ?? null) as never,
        hardSelfScore: data.hardSelfScore ?? null,
        softSelfScore: data.softSelfScore ?? null,
        heartSelfScore: data.heartSelfScore ?? null,
        riskFlags: data.riskFlags,
        strengths: data.strengths,
        notes: data.notes ?? null,
        assessmentAt: assessmentAt ?? new Date(),
        ...v2Fields,
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

// ============================================================
// MÓDULO C v2 — Atividade · PDI auto · Agenda · Coach · Mapa
// ============================================================

// -------- Descrição de atividades --------
conscienciaRouter.put("/:orgId/consciencia/me/activity", async (req, res) => {
  try {
    const parsed = z
      .object({
        activityDescription: z.string().max(20000).optional().nullable(),
        activityDescriptionUrl: z.string().url().optional().nullable(),
      })
      .parse(req.body);
    const saved = await prisma.leaderProfile.upsert({
      where: {
        organizationId_userId: { organizationId: req.params.orgId, userId: req.userId! },
      },
      update: {
        activityDescription: parsed.activityDescription ?? null,
        activityDescriptionUrl: parsed.activityDescriptionUrl ?? null,
      },
      create: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        activityDescription: parsed.activityDescription ?? null,
        activityDescriptionUrl: parsed.activityDescriptionUrl ?? null,
      },
    });
    res.json(saved);
  } catch (err) {
    badReq(res, err);
  }
});

// -------- PDI auto-gerado (heurístico) --------
conscienciaRouter.post("/:orgId/consciencia/pdi/auto-generate", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const profile = await prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!profile)
      return res.status(400).json({ error: "Preencha o assessment antes de gerar o PDI." });

    const goals: Array<{ title: string; description: string; priority: "high" | "medium" | "low"; source: string }> = [];

    const scores = [
      { k: "hard", label: "Hard — método e indicadores", v: profile.hardSelfScore ?? 50 },
      { k: "soft", label: "Soft — decisão e delegação", v: profile.softSelfScore ?? 50 },
      { k: "heart", label: "Heart — escuta e coerência", v: profile.heartSelfScore ?? 50 },
    ].sort((a, b) => a.v - b.v);
    const lowest = scores[0];
    goals.push({
      title: `Elevar ${lowest.label} de ${lowest.v} → 75 em 90 dias`,
      description:
        "Trilha C.O.R.E. quinzenal focada nessa dimensão + 1 aplicação prática por semana no time.",
      priority: "high",
      source: "hsh_gap",
    });

    const sabotageScores = (profile.sabotageScores as Record<string, number> | null) ?? null;
    if (sabotageScores) {
      const top = Object.entries(sabotageScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .filter(([, v]) => v >= 40);
      for (const [name, score] of top) {
        goals.push({
          title: `Neutralizar o sabotador "${name}"`,
          description: `Score ${score}/100. Prática: 1 interceptação por dia + journaling quinzenal.`,
          priority: score >= 70 ? "high" : "medium",
          source: `sabotage:${name}`,
        });
      }
    } else if (profile.sabotages?.length) {
      for (const s of profile.sabotages.slice(0, 3)) {
        goals.push({
          title: `Reduzir o padrão "${s}"`,
          description: "Prática: 1 interceptação por dia + revisão semanal em 1:1 consigo mesmo.",
          priority: "medium",
          source: `sabotage:${s}`,
        });
      }
    }

    for (const r of (profile.riskFlags ?? []).slice(0, 2)) {
      goals.push({
        title: `Trabalhar o risco declarado "${r}"`,
        description:
          "Combinar prática com ritual quinzenal do time e feedback direto do liderado mais afetado.",
        priority: "medium",
        source: `risk:${r}`,
      });
    }

    if (profile.activityDescription && profile.activityDescription.length > 60) {
      goals.push({
        title: "Delegar 2 entregas presas no papel do líder",
        description:
          "Sua descrição de atividades sinaliza acúmulo executivo. Escolha 2 entregas para delegar nas próximas 2 semanas com critério de aceite claro.",
        priority: "medium",
        source: "activity_delegation",
      });
    }

    await prisma.leaderProfile.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { autoPdiGeneratedAt: new Date() },
    });

    res.json({ generatedAt: new Date().toISOString(), goals });
  } catch (err) {
    badReq(res, err);
  }
});

// -------- Trilha do coach (metodologia C.O.R.E.) --------
conscienciaRouter.post("/:orgId/consciencia/coach/plan", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const { cadence } = z
      .object({ cadence: z.enum(["weekly", "biweekly", "monthly"]) })
      .parse(req.body);
    const profile = await prisma.leaderProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!profile) return res.status(400).json({ error: "Preencha o assessment antes." });

    const cadenceLabel = cadence === "weekly" ? "Semanal" : cadence === "biweekly" ? "Quinzenal" : "Mensal";
    const h = profile.hardSelfScore ?? 50;
    const s = profile.softSelfScore ?? 50;
    const hr = profile.heartSelfScore ?? 50;
    const focus = h <= s && h <= hr ? "Hard" : s <= hr ? "Soft" : "Heart";
    const sabotages = (profile.sabotages ?? []).slice(0, 2).join(", ") || "seus padrões internos";

    const md = [
      `# Trilha ${cadenceLabel} — Metodologia C.O.R.E.`,
      ``,
      `**Foco desta rodada:** ${focus} — dimensão mais frágil hoje.`,
      ``,
      `## C — Consciência`,
      `Observe durante a rodada quando "${sabotages}" aparece. Anote 3 gatilhos concretos.`,
      ``,
      `## O — Organização`,
      focus === "Hard"
        ? "Traduza a meta do trimestre em 1 indicador claro. Revise em cada 1:1."
        : focus === "Soft"
        ? "Delegue 1 entrega travada com critério de aceite, prazo e 1 checkpoint."
        : "Reserve 30 min sem agenda com o liderado mais crítico. Só escuta.",
      ``,
      `## R — Resultado`,
      "Defina 1 KPI de rota e 1 KPI de saída para acompanhar até a próxima trilha.",
      ``,
      `## E — Evolução`,
      `Ao final, avalie de 0 a 10 quanto a prática moveu "${focus}". Registre 1 aprendizado.`,
    ].join("\n");

    await prisma.leaderProfile.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: {
        coachTrackMarkdown: md,
        coachTrackGeneratedAt: new Date(),
        coachCadence: cadence,
      },
    });

    res.json({ markdown: md, cadence, generatedAt: new Date().toISOString() });
  } catch (err) {
    badReq(res, err);
  }
});

// -------- Agenda de liderança --------
const agendaSchema = z.object({
  title: z.string().min(1),
  detail: z.string().optional().nullable(),
  kind: z.string().optional(),
  memberLabel: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  source: z.string().optional(),
});

conscienciaRouter.get("/:orgId/consciencia/agenda", async (req, res) => {
  const items = await prisma.leaderAgendaItem.findMany({
    where: { organizationId: req.params.orgId, userId: req.userId! },
    orderBy: [{ done: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
  });
  res.json({ items });
});

conscienciaRouter.post("/:orgId/consciencia/agenda", async (req, res) => {
  try {
    const data = agendaSchema.parse(req.body);
    const item = await prisma.leaderAgendaItem.create({
      data: {
        organizationId: req.params.orgId,
        userId: req.userId!,
        title: data.title,
        detail: data.detail ?? null,
        kind: data.kind ?? "acao",
        memberLabel: data.memberLabel ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        source: data.source ?? "manual",
      },
    });
    res.status(201).json(item);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.patch("/:orgId/consciencia/agenda/:id", async (req, res) => {
  try {
    const existing = await prisma.leaderAgendaItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.userId !== req.userId)
      return res.status(404).json({ error: "Not found" });
    const data = agendaSchema
      .partial()
      .extend({ done: z.boolean().optional() })
      .parse(req.body);
    const item = await prisma.leaderAgendaItem.update({
      where: { id: req.params.id },
      data: {
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.detail !== undefined ? { detail: data.detail ?? null } : {}),
        ...(data.kind != null ? { kind: data.kind } : {}),
        ...(data.memberLabel !== undefined ? { memberLabel: data.memberLabel ?? null } : {}),
        ...(data.scheduledAt !== undefined
          ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }
          : {}),
        ...(data.done !== undefined ? { done: data.done } : {}),
      },
    });
    res.json(item);
  } catch (err) {
    badReq(res, err);
  }
});

conscienciaRouter.delete("/:orgId/consciencia/agenda/:id", async (req, res) => {
  const existing = await prisma.leaderAgendaItem.findUnique({
    where: { id: req.params.id },
  });
  if (!existing || existing.userId !== req.userId)
    return res.status(404).json({ error: "Not found" });
  await prisma.leaderAgendaItem.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// -------- Mapa comportamental dos liderados --------
conscienciaRouter.get("/:orgId/consciencia/subordinate-map", async (req, res) => {
  const items = await prisma.subordinateAssessment.findMany({
    where: { organizationId: req.params.orgId, leaderId: req.userId! },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ items });
});