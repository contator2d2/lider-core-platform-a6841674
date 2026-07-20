import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Ciclos com metas SMART (Fase 1 · item 5).
 * Trimestre / semestre / campanha com metas ligadas a indicadores existentes.
 */
export const cyclesRouter = Router();
cyclesRouter.use(requireAuth);

function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

async function assertOrgAccess(userId: string, orgId: string) {
  const su = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (su) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}

cyclesRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

cyclesRouter.get("/:orgId/cycles", async (req, res) => {
  const cycles = await prisma.cycle.findMany({
    where: { organizationId: req.params.orgId },
    orderBy: [{ status: "asc" }, { startAt: "desc" }],
    include: { goals: true },
  });
  res.json(cycles);
});

const cycleSchema = z.object({
  name: z.string().min(2),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  status: z.enum(["planning", "active", "closed"]).default("planning"),
  summary: z.string().optional().nullable(),
});

cyclesRouter.post("/:orgId/cycles", async (req, res) => {
  try {
    const data = cycleSchema.parse(req.body);
    const c = await prisma.cycle.create({
      data: {
        organizationId: req.params.orgId,
        name: data.name,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        status: data.status,
        summary: data.summary ?? null,
        createdBy: req.userId!,
      },
    });
    res.status(201).json(c);
  } catch (err) { badReq(res, err); }
});

cyclesRouter.patch("/:orgId/cycles/:id", async (req, res) => {
  try {
    const data = cycleSchema.partial().parse(req.body);
    const c = await prisma.cycle.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startAt !== undefined ? { startAt: new Date(data.startAt) } : {}),
        ...(data.endAt !== undefined ? { endAt: new Date(data.endAt) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.summary !== undefined ? { summary: data.summary ?? null } : {}),
      },
    });
    res.json(c);
  } catch (err) { badReq(res, err); }
});

cyclesRouter.delete("/:orgId/cycles/:id", async (req, res) => {
  await prisma.cycle.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

const goalSchema = z.object({
  title: z.string().min(2),
  specific: z.string().optional().nullable(),
  measurable: z.string().optional().nullable(),
  achievable: z.string().optional().nullable(),
  relevant: z.string().optional().nullable(),
  timeBound: z.string().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  indicatorId: z.string().uuid().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  status: z.enum(["on_track", "at_risk", "off_track", "done", "dropped"]).optional(),
});

cyclesRouter.post("/:orgId/cycles/:cycleId/goals", async (req, res) => {
  try {
    const data = goalSchema.parse(req.body);
    const g = await prisma.cycleGoal.create({
      data: {
        cycleId: req.params.cycleId,
        title: data.title,
        specific: data.specific ?? null,
        measurable: data.measurable ?? null,
        achievable: data.achievable ?? null,
        relevant: data.relevant ?? null,
        timeBound: data.timeBound ?? null,
        ownerUserId: data.ownerUserId ?? null,
        areaId: data.areaId ?? null,
        indicatorId: data.indicatorId ?? null,
        targetValue: data.targetValue ?? null,
        status: data.status ?? "on_track",
      },
    });
    res.status(201).json(g);
  } catch (err) { badReq(res, err); }
});

cyclesRouter.patch("/:orgId/cycles/:cycleId/goals/:goalId", async (req, res) => {
  try {
    const data = goalSchema.partial().parse(req.body);
    const g = await prisma.cycleGoal.update({
      where: { id: req.params.goalId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.specific !== undefined ? { specific: data.specific ?? null } : {}),
        ...(data.measurable !== undefined ? { measurable: data.measurable ?? null } : {}),
        ...(data.achievable !== undefined ? { achievable: data.achievable ?? null } : {}),
        ...(data.relevant !== undefined ? { relevant: data.relevant ?? null } : {}),
        ...(data.timeBound !== undefined ? { timeBound: data.timeBound ?? null } : {}),
        ...(data.ownerUserId !== undefined ? { ownerUserId: data.ownerUserId ?? null } : {}),
        ...(data.areaId !== undefined ? { areaId: data.areaId ?? null } : {}),
        ...(data.indicatorId !== undefined ? { indicatorId: data.indicatorId ?? null } : {}),
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    res.json(g);
  } catch (err) { badReq(res, err); }
});

cyclesRouter.delete("/:orgId/cycles/:cycleId/goals/:goalId", async (req, res) => {
  await prisma.cycleGoal.delete({ where: { id: req.params.goalId } }).catch(() => null);
  res.status(204).end();
});