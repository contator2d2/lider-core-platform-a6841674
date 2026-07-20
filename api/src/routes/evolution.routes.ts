import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * MÓDULO E — Evolução.
 *
 * Score de sustentação (§6):
 *   35% adesão a rituais (30d)
 *   35% cumprimento de delegações no prazo
 *   30% indicadores dentro da meta
 *
 * Leitura diagnóstica: sempre que o score cai, apontar o módulo de origem
 * (não devolver número solto).
 *
 * Dashboard executivo (§7): agregado por líder/área para roles owner/hr.
 * Nunca expõe conteúdo do módulo C individual — só cobertura e score.
 */
export const evolutionRouter = Router();
evolutionRouter.use(requireAuth);

async function isSuper(userId: string) {
  const r = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  return !!r;
}
async function isExec(userId: string, orgId: string) {
  if (await isSuper(userId)) return true;
  const m = await prisma.membership.findFirst({
    where: { userId, organizationId: orgId, role: { in: ["hr_admin", "franchise_owner"] } },
  });
  return !!m;
}
async function assertOrgAccess(userId: string, orgId: string) {
  if (await isSuper(userId)) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}
function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

evolutionRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// ============================================================
// Cálculo do score
// ============================================================
export type ScoreBreakdown = {
  ritualsScore: number;
  delegScore: number;
  indicatorsScore: number;
  rituals: { done: number; planned: number };
  delegations: { onTime: number; total: number; overdue: number };
  indicators: { onTarget: number; withReadings: number };
};

export type DimensionBreakdown = {
  score: number; // 0..100
  parts: Array<{ label: string; value: number; hint?: string }>;
  diagnostic: string;
};

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdown;
  diagnostic: string;
  hard: DimensionBreakdown;
  soft: DimensionBreakdown;
  heart: DimensionBreakdown;
};

export async function computeScoreForUser(orgId: string, userId: string): Promise<ScoreResult> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000);

  // Rituais em que o líder é owner OU participante
  const [ownerRituals, partRituals] = await Promise.all([
    prisma.ritual.findMany({
      where: { organizationId: orgId, ownerId: userId },
      select: { id: true },
    }),
    prisma.ritualParticipant.findMany({
      where: { membership: { organizationId: orgId, userId } },
      select: { ritualId: true },
    }),
  ]);
  const ritualIds = Array.from(new Set([...ownerRituals.map((r) => r.id), ...partRituals.map((r) => r.ritualId)]));

  const occurrences = ritualIds.length
    ? await prisma.ritualOccurrence.findMany({
        where: { ritualId: { in: ritualIds }, scheduledAt: { gte: since30, lte: now } },
        select: { status: true },
      })
    : [];
  const done = occurrences.filter((o) => o.status === "done").length;
  const planned = occurrences.length;
  const ritualsScore = planned ? done / planned : ritualIds.length ? 0.5 : 0;

  // Delegações do líder (que ele delegou)
  const delegations = await prisma.delegation.findMany({
    where: {
      organizationId: orgId,
      delegatorId: userId,
      OR: [
        { status: { in: ["done", "canceled"] } },
        { status: { notIn: ["done", "canceled"] } },
      ],
    },
    select: { status: true, dueAt: true, doneAt: true, updatedAt: true, createdAt: true },
  });
  let onTime = 0;
  let counted = 0;
  let overdue = 0;
  for (const d of delegations) {
    if (d.status === "done") {
      counted += 1;
      if (!d.dueAt || (d.doneAt && d.doneAt <= d.dueAt)) onTime += 1;
    } else if (d.status !== "canceled") {
      counted += 1;
      if (d.dueAt && d.dueAt < now) overdue += 1;
      else onTime += 1; // ainda no prazo
    }
  }
  const delegScore = counted ? onTime / counted : 0;

  // Indicadores sob owner = userId (nível liderança) OU sem owner explícito (todos os do org)
  const indicators = await prisma.indicator.findMany({
    where: {
      organizationId: orgId,
      active: true,
      target: { not: null },
      OR: [{ ownerUserId: userId }, { level: "leadership" }],
    },
    include: { readings: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 1 } },
  });
  let onTarget = 0;
  let withReadings = 0;
  for (const i of indicators) {
    const last = i.readings[0];
    if (!last || i.target == null) continue;
    withReadings += 1;
    const on = i.direction === "higher_better" ? last.value >= i.target : last.value <= i.target;
    if (on) onTarget += 1;
  }
  const indicatorsScore = withReadings ? onTarget / withReadings : 0;

  const score = Math.round(100 * (0.35 * ritualsScore + 0.35 * delegScore + 0.3 * indicatorsScore));

  const diagnostic = buildDiagnostic({
    ritualsScore,
    delegScore,
    indicatorsScore,
    rituals: { done, planned },
    delegations: { onTime, total: counted, overdue },
    indicators: { onTarget, withReadings },
  });

  // ============================================================
  // Dimensões H/S/H (spec §6)
  // ============================================================

  // HARD — estrutura: cadência de rituais + % metas SMART + % indicadores com meta
  const [allIndicators, cycleGoals] = await Promise.all([
    prisma.indicator.count({ where: { organizationId: orgId, active: true } }),
    prisma.cycleGoal.count({
      where: {
        cycle: { organizationId: orgId, status: { in: ["active", "planned"] } },
      },
    }),
  ]);
  const indicatorsWithTarget = await prisma.indicator.count({
    where: { organizationId: orgId, active: true, target: { not: null } },
  });
  const smartCoverage = allIndicators ? Math.min(1, cycleGoals / allIndicators) : cycleGoals ? 1 : 0;
  const targetCoverage = allIndicators ? indicatorsWithTarget / allIndicators : 0;
  const hardScoreRaw = 0.5 * ritualsScore + 0.25 * smartCoverage + 0.25 * targetCoverage;
  const hardScore = Math.round(hardScoreRaw * 100);
  const hard: DimensionBreakdown = {
    score: hardScore,
    parts: [
      { label: "Cadência de rituais", value: ritualsScore, hint: `${done}/${planned} feitos em 30d` },
      { label: "Metas SMART do ciclo", value: smartCoverage, hint: `${cycleGoals} meta(s) para ${allIndicators} indicador(es)` },
      { label: "Indicadores com meta", value: targetCoverage, hint: `${indicatorsWithTarget}/${allIndicators}` },
    ],
    diagnostic:
      hardScore >= 70
        ? "Estrutura sustentando: rituais rodando e metas calibradas."
        : ritualsScore < 0.6
          ? "Cadência dos rituais está baixa — sem ritmo, a estrutura vaza."
          : smartCoverage < 0.5
            ? "Faltam metas SMART formalizadas no ciclo ativo."
            : "Nem todos os indicadores têm meta — a leitura fica incompleta.",
  };

  // SOFT — execução: 1:1 no ritmo + delegações no prazo + feedbacks entregues
  const [oneOnOnes, feedbacksGiven, directs] = await Promise.all([
    prisma.oneOnOne.count({
      where: {
        organizationId: orgId,
        leaderId: userId,
        scheduledAt: { gte: since30 },
        status: "done",
      },
    }),
    prisma.feedbackRecord.count({
      where: { organizationId: orgId, authorId: userId, createdAt: { gte: since30 } },
    }),
    prisma.membership.count({
      where: { organizationId: orgId, directLeaderId: userId },
    }),
  ]);
  const expected1on1 = Math.max(directs, 1);
  const oneOnOneScore = Math.min(1, oneOnOnes / expected1on1);
  const feedbackScore = Math.min(1, feedbacksGiven / Math.max(expected1on1 * 2, 4));
  const softScoreRaw = 0.4 * oneOnOneScore + 0.35 * delegScore + 0.25 * feedbackScore;
  const softScore = Math.round(softScoreRaw * 100);
  const soft: DimensionBreakdown = {
    score: softScore,
    parts: [
      { label: "1:1 no mês", value: oneOnOneScore, hint: `${oneOnOnes} realizadas / ${expected1on1} liderado(s)` },
      { label: "Delegações no prazo", value: delegScore, hint: `${onTime}/${counted}` },
      { label: "Feedbacks entregues", value: feedbackScore, hint: `${feedbacksGiven} em 30d` },
    ],
    diagnostic:
      softScore >= 70
        ? "Execução consistente — 1:1, delegação e feedback fluem."
        : oneOnOneScore < 0.5
          ? "1:1 abaixo do ritmo esperado com o time direto."
          : delegScore < 0.6
            ? "Delegações escapando do prazo — revise clareza e prioridade."
            : "Feedbacks estão raros — o time está sem espelho.",
  };

  // HEART — cultura: regularidade de feedback + clima positivo + reconhecimento
  const since90 = new Date(now.getTime() - 90 * 86400000);
  const [feedbackWeekly, kudosCount, pulseSends] = await Promise.all([
    prisma.feedbackRecord.findMany({
      where: { organizationId: orgId, authorId: userId, createdAt: { gte: since90 } },
      select: { createdAt: true },
    }),
    prisma.kudos.count({
      where: { organizationId: orgId, authorId: userId, createdAt: { gte: since30 } },
    }),
    prisma.pulseSend.findMany({
      where: {
        organizationId: orgId,
        senderId: userId,
        createdAt: { gte: since90 },
      },
      select: { status: true, answeredAt: true },
    }),
  ]);
  // regularidade: quantas das últimas 12 semanas tiveram ao menos 1 feedback
  const weekBuckets = new Set<string>();
  for (const f of feedbackWeekly) {
    const d = new Date(f.createdAt);
    const wk = `${d.getUTCFullYear()}-${Math.floor((d.getUTCDate() + d.getUTCMonth() * 31) / 7)}`;
    weekBuckets.add(wk);
  }
  const regularity = Math.min(1, weekBuckets.size / 12);
  const answeredPulses = pulseSends.filter((p) => !!p.answeredAt).length;
  const climate = pulseSends.length ? answeredPulses / pulseSends.length : 0;
  const recognition = Math.min(1, kudosCount / 4);
  const heartScoreRaw = 0.4 * regularity + 0.35 * climate + 0.25 * recognition;
  const heartScore = Math.round(heartScoreRaw * 100);
  const heart: DimensionBreakdown = {
    score: heartScore,
    parts: [
      { label: "Regularidade de feedback", value: regularity, hint: `${weekBuckets.size}/12 semanas ativas` },
      { label: "Engajamento em pulsos", value: climate, hint: `${answeredPulses}/${pulseSends.length} respondidos em 90d` },
      { label: "Reconhecimento (kudos)", value: recognition, hint: `${kudosCount} kudos em 30d` },
    ],
    diagnostic:
      heartScore >= 70
        ? "Cultura viva — feedback constante, clima saudável, reconhecimento circulando."
        : regularity < 0.5
          ? "Feedback é intermitente — o vínculo depende de constância."
          : climate < 0.6
            ? "Clima nos pulsos está frio — vale ouvir o time com mais profundidade."
            : "Falta reconhecimento — kudos custam pouco e movem muito.",
  };

  return {
    score,
    breakdown: {
      ritualsScore,
      delegScore,
      indicatorsScore,
      rituals: { done, planned },
      delegations: { onTime, total: counted, overdue },
      indicators: { onTarget, withReadings },
    },
    diagnostic,
    hard,
    soft,
    heart,
  };
}

function buildDiagnostic(b: ScoreBreakdown): string {
  const parts: string[] = [];
  if (b.rituals.planned && b.ritualsScore < 0.7) {
    parts.push(`cadência dos rituais em ${Math.round(b.ritualsScore * 100)}% (${b.rituals.done}/${b.rituals.planned} feitos em 30d)`);
  }
  if (b.delegations.total && b.delegScore < 0.7) {
    parts.push(`${b.delegations.overdue} delegação(ões) atrasada(s) em ${b.delegations.total} ativa(s)`);
  }
  if (b.indicators.withReadings && b.indicatorsScore < 0.7) {
    parts.push(`${b.indicators.withReadings - b.indicators.onTarget} indicador(es) fora da meta em ${b.indicators.withReadings}`);
  }
  if (!parts.length) {
    if (!b.rituals.planned && !b.delegations.total && !b.indicators.withReadings) {
      return "Sem dados suficientes ainda. Registre rituais, delegue com prazo e alimente indicadores para o score começar a se formar.";
    }
    return "Sustentação em dia — cadência, entrega e resultado equilibrados.";
  }
  const source = parts.length === 1 ? "problema concentrado em um só ponto" : "queda distribuída entre módulos";
  return `Queda acompanha: ${parts.join("; ")}. É ${source} — foco na causa, não no número.`;
}

// ============================================================
// GET /:orgId/evolution/me — score + tendência + diagnóstico
// ============================================================
evolutionRouter.get("/:orgId/evolution/me", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const current = await computeScoreForUser(orgId, userId);

    const trend = await prisma.leadershipScoreSnapshot.findMany({
      where: { organizationId: orgId, userId },
      orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      take: 12,
    });

    const commitments = await prisma.mentorshipCommitment.findMany({
      where: { organizationId: orgId, userId, status: { in: ["active", "in_progress"] } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ current, trend, commitments });
  } catch (err) {
    badReq(res, err);
  }
});

// ============================================================
// POST /:orgId/evolution/snapshot — grava snapshot do mês atual
// ============================================================
evolutionRouter.post("/:orgId/evolution/snapshot", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const now = new Date();
    const periodYear = now.getUTCFullYear();
    const periodMonth = now.getUTCMonth() + 1;
    const r = await computeScoreForUser(orgId, userId);
    const snap = await prisma.leadershipScoreSnapshot.upsert({
      where: {
        organizationId_userId_periodYear_periodMonth: {
          organizationId: orgId,
          userId,
          periodYear,
          periodMonth,
        },
      },
      update: {
        score: r.score,
        ritualsScore: r.breakdown.ritualsScore,
        delegScore: r.breakdown.delegScore,
        indicatorsScore: r.breakdown.indicatorsScore,
        diagnostic: r.diagnostic,
        breakdown: r.breakdown as never,
        hardScore: r.hard.score,
        softScore: r.soft.score,
        heartScore: r.heart.score,
        hardBreakdown: r.hard as never,
        softBreakdown: r.soft as never,
        heartBreakdown: r.heart as never,
      },
      create: {
        organizationId: orgId,
        userId,
        periodYear,
        periodMonth,
        score: r.score,
        ritualsScore: r.breakdown.ritualsScore,
        delegScore: r.breakdown.delegScore,
        indicatorsScore: r.breakdown.indicatorsScore,
        diagnostic: r.diagnostic,
        breakdown: r.breakdown as never,
        hardScore: r.hard.score,
        softScore: r.soft.score,
        heartScore: r.heart.score,
        hardBreakdown: r.hard as never,
        softBreakdown: r.soft as never,
        heartBreakdown: r.heart as never,
      },
    });
    res.json(snap);
  } catch (err) {
    badReq(res, err);
  }
});

// ============================================================
// GET /:orgId/evolution/dashboard — visão executiva
// Apenas roles: super_admin, neo_admin, hr_admin, franchise_owner
// ============================================================
evolutionRouter.get("/:orgId/evolution/dashboard", async (req, res) => {
  // (implementação abaixo)
  return dashboardHandler(req, res);
});

// Timeline pessoal do líder (Etapa 3): snapshots + delegações concluídas +
// PDIs criados + feedbacks recebidos, ordenados por data desc.
evolutionRouter.get("/:orgId/evolution/timeline", async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.userId!;
    const since = new Date(Date.now() - 180 * 86400000);
    const [snapshots, delegs, pdis, feedbacks] = await Promise.all([
      prisma.leadershipScoreSnapshot.findMany({
        where: { organizationId: orgId, userId },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        take: 12,
      }),
      prisma.delegation.findMany({
        where: {
          organizationId: orgId,
          delegatorId: userId,
          status: "done",
          doneAt: { gte: since },
        },
        select: { id: true, title: true, doneAt: true, dueAt: true },
        orderBy: { doneAt: "desc" },
        take: 20,
      }),
      prisma.pdi.findMany({
        where: { organizationId: orgId, authorId: userId, createdAt: { gte: since } },
        select: { id: true, title: true, subjectUserId: true, createdAt: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.feedbackRecord.findMany({
        where: { organizationId: orgId, subjectUserId: userId, createdAt: { gte: since } },
        select: { id: true, type: true, fact: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    type Ev = {
      id: string;
      kind: "snapshot" | "delegation" | "pdi" | "feedback";
      at: string;
      title: string;
      detail?: string | null;
      score?: number;
    };
    const events: Ev[] = [];
    for (const s of snapshots) {
      const at = new Date(Date.UTC(s.periodYear, s.periodMonth - 1, 28)).toISOString();
      events.push({
        id: `snap-${s.id}`,
        kind: "snapshot",
        at,
        title: `Score ${s.score}/100 · ${String(s.periodMonth).padStart(2, "0")}/${s.periodYear}`,
        detail: s.diagnostic,
        score: s.score,
      });
    }
    for (const d of delegs) {
      const onTime = !d.dueAt || (d.doneAt && d.doneAt <= d.dueAt);
      events.push({
        id: `del-${d.id}`,
        kind: "delegation",
        at: (d.doneAt ?? new Date()).toISOString(),
        title: `Delegação concluída: ${d.title}`,
        detail: onTime ? "No prazo" : "Fora do prazo",
      });
    }
    for (const p of pdis) {
      events.push({
        id: `pdi-${p.id}`,
        kind: "pdi",
        at: p.createdAt.toISOString(),
        title: `PDI criado: ${p.title}`,
        detail: `status ${p.status}`,
      });
    }
    for (const f of feedbacks) {
      events.push({
        id: `fb-${f.id}`,
        kind: "feedback",
        at: f.createdAt.toISOString(),
        title: `Feedback recebido (${f.type})`,
        detail: f.fact,
      });
    }
    events.sort((a, b) => (a.at < b.at ? 1 : -1));
    res.json(events.slice(0, 60));
  } catch (err) {
    badReq(res, err);
  }
});

async function dashboardHandler(req: Request, res: Response) {
  try {
    const orgId = req.params.orgId;
    if (!(await isExec(req.userId!, orgId))) {
      return res.status(403).json({ error: "Somente RH/dono podem ver o painel executivo" });
    }

    const memberships = await prisma.membership.findMany({
      where: { organizationId: orgId, role: { in: ["leader", "hr_admin", "franchise_owner"] } },
      include: { user: { include: { profile: true } }, area: true },
    });

    const leaders = await Promise.all(
      memberships.map(async (m) => {
        const r = await computeScoreForUser(orgId, m.userId);
        const last = await prisma.leadershipScoreSnapshot.findFirst({
          where: { organizationId: orgId, userId: m.userId },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          skip: 1, // penúltimo, para tendência
        });
        const delta = last ? r.score - last.score : null;
        return {
          userId: m.userId,
          name: m.user.profile?.fullName ?? m.user.email,
          avatarUrl: m.user.profile?.avatarUrl ?? null,
          areaId: m.areaId,
          areaName: m.area?.name ?? null,
          score: r.score,
          ritualsScore: r.breakdown.ritualsScore,
          delegScore: r.breakdown.delegScore,
          indicatorsScore: r.breakdown.indicatorsScore,
          diagnostic: r.diagnostic,
          delta,
        };
      }),
    );

    // Agregados por área
    const byArea = new Map<string, { areaId: string | null; areaName: string; scores: number[] }>();
    for (const l of leaders) {
      const key = l.areaId ?? "__none__";
      const bucket = byArea.get(key) ?? {
        areaId: l.areaId,
        areaName: l.areaName ?? "Sem área",
        scores: [],
      };
      bucket.scores.push(l.score);
      byArea.set(key, bucket);
    }
    const areas = Array.from(byArea.values()).map((b) => ({
      areaId: b.areaId,
      areaName: b.areaName,
      leaderCount: b.scores.length,
      avgScore: b.scores.length ? Math.round(b.scores.reduce((s, v) => s + v, 0) / b.scores.length) : 0,
    }));

    // Mapa de risco: rituais quebrados, concentração, atraso sistemático
    const [crossSignals, brokenRituals] = await Promise.all([
      prisma.crossSignal.findMany({
        where: { organizationId: orgId, dismissedAt: null },
        select: { severity: true, kind: true },
      }),
      prisma.ritual.count({ where: { organizationId: orgId, status: "paused" } }),
    ]);

    const risk = {
      highSignals: crossSignals.filter((s) => s.severity === "high").length,
      mediumSignals: crossSignals.filter((s) => s.severity === "medium").length,
      concentrationCount: crossSignals.filter((s) => s.kind === "concentration_high").length,
      brokenRituals,
    };

    // Adesão ao programa
    const [totalMembers, profiled, assessed, areasCount, teamsCount, ritualsCount] = await Promise.all([
      prisma.membership.count({ where: { organizationId: orgId } }),
      prisma.leaderProfile.count({ where: { organizationId: orgId } }),
      prisma.leaderProfile.count({ where: { organizationId: orgId, assessmentType: { not: null } } }),
      prisma.area.count({ where: { organizationId: orgId } }),
      prisma.team.count({ where: { organizationId: orgId } }),
      prisma.ritual.count({ where: { organizationId: orgId, status: "active" } }),
    ]);

    // Maturidade organizacional 1-5 (agregado, nunca individual)
    const avgOrg = leaders.length ? leaders.reduce((s, v) => s + v.score, 0) / leaders.length : 0;
    let maturity = 1;
    if (avgOrg >= 80) maturity = 5;
    else if (avgOrg >= 65) maturity = 4;
    else if (avgOrg >= 50) maturity = 3;
    else if (avgOrg >= 30) maturity = 2;

    res.json({
      leaders: leaders.sort((a, b) => b.score - a.score),
      areas: areas.sort((a, b) => b.avgScore - a.avgScore),
      risk,
      adoption: {
        totalMembers,
        profiled,
        assessed,
        assessedPct: totalMembers ? Math.round((assessed / totalMembers) * 100) : 0,
        profiledPct: totalMembers ? Math.round((profiled / totalMembers) * 100) : 0,
        structureReady: areasCount > 0 && teamsCount > 0 && ritualsCount > 0,
      },
      maturity,
      avgScore: Math.round(avgOrg),
    });
  } catch (err) {
    badReq(res, err);
  }
}