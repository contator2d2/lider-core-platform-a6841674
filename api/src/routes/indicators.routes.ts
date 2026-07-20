import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { parseCsv } from "../lib/csv.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * MÓDULO R — Indicadores em 3 níveis (área / equipe / liderança) +
 * cálculo do Indicador de Concentração ("carga na própria mão").
 *
 * Regra da Especificação Funcional §5.3: acima de 30% das delegações
 * ativas sob responsabilidade direta do próprio líder, o sistema
 * sinaliza risco de centralização.
 */
export const indicatorsRouter = Router();
indicatorsRouter.use(requireAuth);

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

indicatorsRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// ------------------------------------------------------------
// CRUD Indicators
// ------------------------------------------------------------
const indicatorSchema = z.object({
  level: z.enum(["area", "team", "leadership"]).default("area"),
  areaId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  direction: z.enum(["higher_better", "lower_better"]).default("higher_better"),
  target: z.number().optional().nullable(),
  minTarget: z.number().optional().nullable(),
  maxTarget: z.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

indicatorsRouter.get("/:orgId/indicators", async (req, res) => {
  const level = req.query.level as string | undefined;
  const items = await prisma.indicator.findMany({
    where: {
      organizationId: req.params.orgId,
      ...(level ? { level: level as never } : {}),
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: {
      readings: {
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        take: 12,
      },
    },
  });
  res.json(items.map(withStatus));
});

indicatorsRouter.post("/:orgId/indicators", async (req, res) => {
  try {
    const data = indicatorSchema.parse(req.body);
    const i = await prisma.indicator.create({
      data: {
        ...data,
        organizationId: req.params.orgId,
        createdBy: req.userId,
        updatedBy: req.userId,
      },
    });
    res.status(201).json(i);
  } catch (err) {
    badReq(res, err);
  }
});

indicatorsRouter.patch("/:orgId/indicators/:id", async (req, res) => {
  try {
    const data = indicatorSchema.partial().parse(req.body);
    const i = await prisma.indicator.update({
      where: { id: req.params.id },
      data: { ...data, updatedBy: req.userId },
    });
    res.json(i);
  } catch (err) {
    badReq(res, err);
  }
});

indicatorsRouter.delete("/:orgId/indicators/:id", async (req, res) => {
  await prisma.indicator.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ------------------------------------------------------------
// Leituras mensais
// ------------------------------------------------------------
const readingSchema = z.object({
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  value: z.number(),
  notes: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
  doAction: z.string().optional().nullable(),
  check: z.string().optional().nullable(),
  act: z.string().optional().nullable(),
  source: z.enum(["manual", "csv", "api"]).default("manual"),
});

indicatorsRouter.post("/:orgId/indicators/:id/readings", async (req, res) => {
  try {
    const data = readingSchema.parse(req.body);
    // Estado ANTES do upsert — para detectar transição para "fora da meta"
    const before = await prisma.indicator.findUnique({
      where: { id: req.params.id },
      include: {
        readings: {
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          take: 2,
        },
      },
    });
    const r = await prisma.indicatorReading.upsert({
      where: {
        indicatorId_periodYear_periodMonth: {
          indicatorId: req.params.id,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
        },
      },
      update: {
        value: data.value,
        notes: data.notes ?? undefined,
        plan: data.plan ?? undefined,
        doAction: data.doAction ?? undefined,
        check: data.check ?? undefined,
        act: data.act ?? undefined,
        source: data.source,
        recordedBy: req.userId,
      },
      create: {
        indicatorId: req.params.id,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        value: data.value,
        notes: data.notes ?? undefined,
        plan: data.plan ?? undefined,
        doAction: data.doAction ?? undefined,
        check: data.check ?? undefined,
        act: data.act ?? undefined,
        source: data.source,
        recordedBy: req.userId,
      },
    });
    // Fase 2 · item 5 — Alerta de resultado
    if (before) {
      await maybeNotifyOffTarget(before, data.value, req.params.orgId).catch(() => undefined);
    }
    res.status(201).json(r);
  } catch (err) {
    badReq(res, err);
  }
});

indicatorsRouter.delete("/:orgId/readings/:id", async (req, res) => {
  await prisma.indicatorReading.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ------------------------------------------------------------
// CSV Import — colunas: indicatorId,year,month,value[,notes]
// ou: name,level,year,month,value  (cria indicador se não existir)
// ------------------------------------------------------------
indicatorsRouter.post("/:orgId/indicators/import", async (req, res) => {
  try {
    const { csv } = z.object({ csv: z.string().min(1) }).parse(req.body);
    const rows = parseCsv(csv);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const year = Number(row.year ?? row.ano ?? row.periodYear);
      const month = Number(row.month ?? row.mes ?? row.periodMonth);
      const value = Number(String(row.value ?? row.valor ?? "").replace(",", "."));
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(value)) {
        skipped++;
        continue;
      }
      let indicatorId = row.indicatorId ?? row.id ?? "";
      if (!indicatorId && row.name) {
        const level = (row.level as never) || "area";
        const found = await prisma.indicator.findFirst({
          where: { organizationId: req.params.orgId, name: row.name, level },
        });
        const created = found ?? (await prisma.indicator.create({
          data: {
            organizationId: req.params.orgId,
            name: row.name,
            level,
            unit: row.unit ?? null,
            target: row.target ? Number(String(row.target).replace(",", ".")) : null,
            createdBy: req.userId,
            updatedBy: req.userId,
          },
        }));
        indicatorId = created.id;
      }
      if (!indicatorId) { skipped++; continue; }
      await prisma.indicatorReading.upsert({
        where: { indicatorId_periodYear_periodMonth: { indicatorId, periodYear: year, periodMonth: month } },
        update: { value, source: "csv", recordedBy: req.userId },
        create: { indicatorId, periodYear: year, periodMonth: month, value, source: "csv", recordedBy: req.userId },
      });
      imported++;
    }
    res.json({ imported, skipped, total: rows.length });
  } catch (err) {
    badReq(res, err);
  }
});

// ------------------------------------------------------------
// Concentração — "carga na própria mão"
// ------------------------------------------------------------
indicatorsRouter.get("/:orgId/indicators/concentration", async (req, res) => {
  const { total, byLeader, threshold } = await computeConcentration(req.params.orgId);
  res.json({ threshold, total, byLeader });
});

// ------------------------------------------------------------
// Gestão à vista — semáforos por área + metas do ciclo ativo
// ------------------------------------------------------------
indicatorsRouter.get("/:orgId/results-overview", async (req, res) => {
  const orgId = req.params.orgId;
  const [indicators, areas, activeCycle] = await Promise.all([
    prisma.indicator.findMany({
      where: { organizationId: orgId, active: true },
      include: {
        readings: {
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          take: 12,
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.area.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.cycle.findFirst({
      where: { organizationId: orgId, status: "active" },
      orderBy: { startAt: "desc" },
      include: { goals: true },
    }),
  ]);

  const scored = indicators.map(withStatus);
  const buckets = new Map<string, typeof scored>();
  for (const i of scored) {
    const key = i.areaId ?? "__none__";
    const arr = buckets.get(key) ?? [];
    arr.push(i);
    buckets.set(key, arr);
  }

  const areaBlocks = [
    ...areas.map((a) => ({ id: a.id, name: a.name, indicators: buckets.get(a.id) ?? [] })),
    ...(buckets.get("__none__")?.length
      ? [{ id: null as string | null, name: "Sem área", indicators: buckets.get("__none__") ?? [] }]
      : []),
  ]
    .map((b) => {
      const counts = b.indicators.reduce(
        (acc, i) => {
          acc[i.status] = (acc[i.status] ?? 0) + 1;
          return acc;
        },
        { on_target: 0, warning: 0, off_target: 0, unknown: 0 } as Record<string, number>,
      );
      const known = counts.on_target + counts.warning + counts.off_target;
      const health = known
        ? Math.round(((counts.on_target + counts.warning * 0.5) / known) * 100)
        : null;
      return { ...b, counts, health };
    })
    .filter((b) => b.indicators.length > 0);

  const totals = scored.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    },
    { on_target: 0, warning: 0, off_target: 0, unknown: 0 } as Record<string, number>,
  );

  const goalsRanked = (activeCycle?.goals ?? []).slice().sort((a, b) => {
    const order: Record<string, number> = { off_track: 0, at_risk: 1, on_track: 2, done: 3, dropped: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  res.json({
    totals,
    areas: areaBlocks,
    activeCycle: activeCycle
      ? {
          id: activeCycle.id,
          name: activeCycle.name,
          startAt: activeCycle.startAt,
          endAt: activeCycle.endAt,
          goals: goalsRanked,
        }
      : null,
  });
});

export async function computeConcentration(orgId: string) {
  const threshold = 0.3;
  const active = await prisma.delegation.findMany({
    where: { organizationId: orgId, status: { notIn: ["done", "canceled"] } },
    select: { assigneeId: true, delegatorId: true },
  });
  const total = active.length;
  const grouped = new Map<string, { total: number; ownedByDelegator: number }>();
  for (const d of active) {
    if (!d.delegatorId) continue;
    const g = grouped.get(d.delegatorId) ?? { total: 0, ownedByDelegator: 0 };
    g.total += 1;
    if (d.assigneeId && d.assigneeId === d.delegatorId) g.ownedByDelegator += 1;
    // sem assignee OU assignee === delegator → considerado "na própria mão"
    if (!d.assigneeId) g.ownedByDelegator += 1;
    grouped.set(d.delegatorId, g);
  }
  const byLeader = Array.from(grouped.entries()).map(([leaderId, g]) => ({
    leaderId,
    total: g.total,
    ownedByLeader: g.ownedByDelegator,
    ratio: g.total ? g.ownedByDelegator / g.total : 0,
    overThreshold: g.total ? g.ownedByDelegator / g.total > threshold : false,
  }));
  return { threshold, total, byLeader };
}

// ------------------------------------------------------------
// Status helper — farol dentro/fora da meta
// ------------------------------------------------------------
type IndicatorWithReadings = Awaited<ReturnType<typeof prisma.indicator.findMany>>[number] & {
  readings: Awaited<ReturnType<typeof prisma.indicatorReading.findMany>>;
};
function withStatus(i: IndicatorWithReadings) {
  const last = i.readings[0] ?? null;
  const prev = i.readings[1] ?? null;
  let status: "on_target" | "off_target" | "warning" | "unknown" = "unknown";
  if (last && i.target != null) {
    const on =
      i.direction === "higher_better" ? last.value >= i.target : last.value <= i.target;
    if (on) status = "on_target";
    else {
      // dentro de 10% ainda é warning
      const gap = Math.abs(last.value - i.target) / Math.max(Math.abs(i.target), 1);
      status = gap <= 0.1 ? "warning" : "off_target";
    }
  }
  const delta = last && prev ? last.value - prev.value : null;
  return { ...i, lastReading: last, prevReading: prev, delta, status };
}

// ------------------------------------------------------------
// Sinais para a Sala de Liderança
// ------------------------------------------------------------
export async function computeIndicatorSignals(orgId: string) {
  const [indicators, concentration] = await Promise.all([
    prisma.indicator.findMany({
      where: { organizationId: orgId, active: true, target: { not: null } },
      include: { readings: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 2 } },
    }),
    computeConcentration(orgId),
  ]);

  const signals: Array<{
    kind: "indicator_off" | "concentration";
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
  }> = [];

  for (const i of indicators) {
    const last = i.readings[0];
    if (!last || i.target == null) continue;
    const on = i.direction === "higher_better" ? last.value >= i.target : last.value <= i.target;
    if (on) continue;
    const gap = Math.abs(last.value - i.target) / Math.max(Math.abs(i.target), 1);
    if (gap <= 0.1) continue;
    signals.push({
      kind: "indicator_off",
      severity: gap > 0.3 ? "high" : "medium",
      title: `${i.name} fora da meta`,
      detail: `Último valor ${last.value}${i.unit ?? ""} vs. meta ${i.target}${i.unit ?? ""}`,
    });
  }

  for (const l of concentration.byLeader.filter((x) => x.overThreshold)) {
    signals.push({
      kind: "concentration",
      severity: l.ratio > 0.5 ? "high" : "medium",
      title: "Carga na própria mão acima do saudável",
      detail: `${Math.round(l.ratio * 100)}% das delegações ativas estão sob sua responsabilidade direta (limiar ${Math.round(concentration.threshold * 100)}%). Considere delegar.`,
    });
  }

  return { signals, concentration };
}

// ------------------------------------------------------------
// Alerta de resultado (Fase 2 · item 5)
// Notifica in-app o dono do indicador (ou os líderes da org) quando
// o indicador transita para "fora da meta" (gap > 10%).
// ------------------------------------------------------------
function evalStatus(
  target: number | null | undefined,
  direction: "higher_better" | "lower_better",
  value: number | null | undefined,
): "on_target" | "warning" | "off_target" | "unknown" {
  if (value == null || target == null) return "unknown";
  const on = direction === "higher_better" ? value >= target : value <= target;
  if (on) return "on_target";
  const gap = Math.abs(value - target) / Math.max(Math.abs(target), 1);
  return gap <= 0.1 ? "warning" : "off_target";
}

async function maybeNotifyOffTarget(
  indicator: {
    id: string; name: string; unit: string | null;
    target: number | null; direction: string;
    ownerUserId: string | null; organizationId: string;
    readings: Array<{ value: number; periodYear: number; periodMonth: number }>;
  },
  newValue: number,
  orgId: string,
) {
  const dir = (indicator.direction === "lower_better" ? "lower_better" : "higher_better") as
    | "higher_better"
    | "lower_better";
  const prev = indicator.readings[0]?.value ?? null;
  const prevStatus = evalStatus(indicator.target, dir, prev);
  const nextStatus = evalStatus(indicator.target, dir, newValue);
  if (nextStatus !== "off_target" || prevStatus === "off_target") return;

  const unit = indicator.unit ?? "";
  const title = `⚠️ ${indicator.name} fora da meta`;
  const body = `Último valor ${newValue}${unit} vs. meta ${indicator.target}${unit}. Abra um ciclo PDCA para reagir.`;
  const linkUrl = "/app/indicators";

  const recipients = new Set<string>();
  if (indicator.ownerUserId) recipients.add(indicator.ownerUserId);
  if (recipients.size === 0) {
    const leaders = await prisma.membership.findMany({
      where: { organizationId: orgId, role: { in: ["owner", "admin", "leader"] } },
      select: { userId: true },
    });
    for (const l of leaders) recipients.add(l.userId);
  }
  await Promise.all(
    Array.from(recipients).map((userId) =>
      notifyInApp({ userId, organizationId: orgId, title, body, linkUrl }).catch(() => undefined),
    ),
  );
}