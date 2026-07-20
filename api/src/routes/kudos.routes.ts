import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * Kudos — mural de reconhecimento.
 * Um líder pode registrar um kudos para um liderado (subjectUserId) ou
 * para alguém fora do sistema (subjectLabel livre).
 */
export const kudosRouter = Router();
kudosRouter.use(requireAuth);

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

kudosRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /organization/:orgId/kudos?subjectUserId=&limit=
kudosRouter.get("/:orgId/kudos", async (req, res) => {
  const orgId = req.params.orgId;
  const subjectUserId = typeof req.query.subjectUserId === "string" ? req.query.subjectUserId : undefined;
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const rows = await prisma.kudos.findMany({
    where: { organizationId: orgId, ...(subjectUserId ? { subjectUserId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const userIds = Array.from(
    new Set(rows.flatMap((k) => [k.authorId, k.subjectUserId].filter((v): v is string => !!v))),
  );
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, profile: { select: { fullName: true, avatarUrl: true } } },
      })
    : [];
  const byId = new Map(
    users.map((u) => [
      u.id,
      { id: u.id, fullName: u.profile?.fullName ?? u.email ?? null, avatarUrl: u.profile?.avatarUrl ?? null },
    ]),
  );

  res.json(
    rows.map((k) => ({
      id: k.id,
      category: k.category,
      message: k.message,
      tags: k.tags,
      createdAt: k.createdAt,
      author: byId.get(k.authorId) ?? { id: k.authorId, fullName: null, avatarUrl: null },
      subject: k.subjectUserId
        ? byId.get(k.subjectUserId) ?? { id: k.subjectUserId, fullName: k.subjectLabel ?? null, avatarUrl: null }
        : { id: null, fullName: k.subjectLabel ?? null, avatarUrl: null },
    })),
  );
});

const createSchema = z.object({
  subjectUserId: z.string().uuid().nullish(),
  subjectLabel: z.string().trim().max(120).nullish(),
  category: z.enum(["resultado", "atitude", "colaboracao", "aprendizado", "inovacao", "outro"]).default("atitude"),
  message: z.string().trim().min(3).max(600),
  tags: z.array(z.string().trim().max(40)).max(8).optional(),
});

// POST /organization/:orgId/kudos
kudosRouter.post("/:orgId/kudos", async (req, res) => {
  const orgId = req.params.orgId;
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) return badReq(res, parsed.error);
  const d = parsed.data;
  if (!d.subjectUserId && !d.subjectLabel) {
    return res.status(400).json({ error: "Informe quem está sendo reconhecido" });
  }

  const created = await prisma.kudos.create({
    data: {
      organizationId: orgId,
      authorId: req.userId!,
      subjectUserId: d.subjectUserId ?? null,
      subjectLabel: d.subjectLabel ?? null,
      category: d.category,
      message: d.message,
      tags: d.tags ?? [],
    },
  });

  if (d.subjectUserId && d.subjectUserId !== req.userId) {
    await notifyInApp({
      organizationId: orgId,
      userId: d.subjectUserId,
      title: "Você recebeu um kudos 🎉",
      body: d.message.slice(0, 140),
      linkUrl: "/app",
    }).catch(() => undefined);
  }

  res.status(201).json(created);
});

// DELETE /organization/:orgId/kudos/:id (autor apenas)
kudosRouter.delete("/:orgId/kudos/:id", async (req, res) => {
  const { orgId, id } = req.params;
  const k = await prisma.kudos.findUnique({ where: { id } });
  if (!k || k.organizationId !== orgId) return res.status(404).json({ error: "Not found" });
  if (k.authorId !== req.userId! && !(await isSuper(req.userId!))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await prisma.kudos.delete({ where: { id } });
  res.status(204).end();
});