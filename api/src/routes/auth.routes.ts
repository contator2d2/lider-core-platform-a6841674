import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, requireAuth } from "../auth.js";
import { resolveUserPermissions } from "../rbac.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, fullName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email já cadastrado" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: { create: { fullName } },
    },
  });

  const token = signToken({ sub: user.id, email: user.email });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = signToken({ sub: user.id, email: user.email });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
    },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: {
      profile: true,
      roles: { select: { role: true } },
      memberships: {
        include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
      },
      franchiseMemberships: {
        include: { franchise: { select: { id: true, name: true, slug: true, status: true } } },
      },
    },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    jobTitle: user.profile?.jobTitle ?? null,
    roles: user.roles.map((r: { role: string }) => r.role),
    memberships: user.memberships.map((m: { role: string; organization: { id: string; name: string; slug: string; plan: string } }) => ({
      role: m.role,
      organization: m.organization,
    })),
    franchiseMemberships: user.franchiseMemberships.map((m: { role: string; franchise: { id: string; name: string; slug: string; status: string } }) => ({
      role: m.role,
      franchise: m.franchise,
    })),
  });
});

authRouter.get("/me/permissions", requireAuth, async (req, res) => {
  const perms = await resolveUserPermissions(req.userId!);
  res.json(perms);
});