import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const invitesRouter = Router();
export const publicInvitesRouter = Router();

const TRACKS = ["mentored", "basic"] as const;

function newToken() {
  return crypto.randomBytes(18).toString("base64url");
}

async function canManage(userId: string) {
  const r = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  return !!r;
}

// ---------------- Público: resolver convite ----------------
publicInvitesRouter.get("/invites/:token", async (req, res) => {
  try {
    const invite = await prisma.leaderInvite.findUnique({ where: { token: req.params.token } });
    if (!invite || invite.revokedAt) return res.status(404).json({ error: "Convite inválido" });
    if (invite.expiresAt && invite.expiresAt < new Date())
      return res.status(410).json({ error: "Convite expirado" });
    if (invite.usedCount >= invite.maxUses)
      return res.status(410).json({ error: "Convite já utilizado" });

    let plan: { slug: string; name: string } | null = null;
    if (invite.planSlug) {
      const p = await prisma.signupPlan.findUnique({ where: { slug: invite.planSlug } });
      if (p) plan = { slug: p.slug, name: p.name };
    }
    res.json({
      valid: true,
      token: invite.token,
      email: invite.email,
      fullName: invite.fullName,
      track: invite.track,
      note: invite.note,
      plan,
    });
  } catch (err) {
    console.error("[invites] falha ao resolver convite", err);
    res.status(500).json({ error: "Falha ao validar convite" });
  }
});

// ---------------- Admin ----------------
invitesRouter.use(requireAuth);

invitesRouter.get("/", async (req, res) => {
  if (!(await canManage(req.userId!))) return res.status(403).json({ error: "Forbidden" });
  const invites = await prisma.leaderInvite.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ invites });
});

const createSchema = z.object({
  email: z.string().email().optional().nullable(),
  fullName: z.string().optional().nullable(),
  planSlug: z.string().optional().nullable(),
  track: z.enum(TRACKS).default("mentored"),
  note: z.string().optional().nullable(),
  maxUses: z.number().int().min(1).max(500).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

invitesRouter.post("/", async (req, res) => {
  try {
    if (!(await canManage(req.userId!))) return res.status(403).json({ error: "Forbidden" });
    const data = createSchema.parse(req.body ?? {});
    const created = await prisma.leaderInvite.create({
      data: {
        token: newToken(),
        email: data.email?.trim().toLowerCase() || null,
        fullName: data.fullName?.trim() || null,
        planSlug: data.planSlug || null,
        track: data.track,
        note: data.note || null,
        maxUses: data.maxUses,
        createdByUserId: req.userId!,
        expiresAt: data.expiresInDays
          ? new Date(Date.now() + data.expiresInDays * 86_400_000)
          : null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

invitesRouter.post("/:id/revoke", async (req, res) => {
  if (!(await canManage(req.userId!))) return res.status(403).json({ error: "Forbidden" });
  const updated = await prisma.leaderInvite.update({
    where: { id: req.params.id },
    data: { revokedAt: new Date() },
  });
  res.json(updated);
});

invitesRouter.delete("/:id", async (req, res) => {
  if (!(await canManage(req.userId!))) return res.status(403).json({ error: "Forbidden" });
  await prisma.leaderInvite.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
