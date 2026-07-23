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
  planSlug: z.string().min(1).optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, fullName, planSlug } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email já cadastrado" });

  // Resolve o plano selecionado (opcional)
  let plan: { slug: string; targetRole: "super_admin" | "neo_admin" | "franchise_owner" | "hr_admin" | "leader" | "collaborator"; planTier: "essencial" | "profissional" | "enterprise" } | null = null;
  if (planSlug) {
    const found = await prisma.signupPlan.findUnique({ where: { slug: planSlug } });
    if (found && found.active) {
      plan = { slug: found.slug, targetRole: found.targetRole, planTier: found.planTier };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: { create: { fullName } },
    },
  });

  // Aplica papel do plano selecionado (default = leader se nenhum plano foi passado)
  const roleToApply = plan?.targetRole ?? "leader";
  try {
    await prisma.userRole.create({ data: { userId: user.id, role: roleToApply } });
  } catch (err) {
    console.error("[auth] falha ao aplicar role no registro", err);
  }

  const token = signToken({ sub: user.id, email: user.email });
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName },
    plan: plan ? { slug: plan.slug, role: plan.targetRole, tier: plan.planTier } : null,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Informe um email válido e a senha." });
    const { password } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos." });

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, avatarUrl: true },
    }).catch((err) => {
      console.error("[auth] falha ao carregar perfil no login", err);
      return null;
    });

    const token = signToken({ sub: user.id, email: user.email });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: profile?.fullName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
    });
  } catch (err) {
    console.error("[auth] falha no login", err);
    return res.status(500).json({ error: "Não foi possível entrar agora. Tente novamente em instantes." });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
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

    const profile = await prisma.profile.findUnique({
      where: { id: req.userId! },
      select: {
        fullName: true,
        avatarUrl: true,
        jobTitle: true,
        phone: true,
        whatsapp: true,
        onboardingCompletedAt: true,
        onboardingSteps: true,
      },
    }).catch((err) => {
      console.error("[auth] falha ao carregar perfil em /me", err);
      return null;
    });

    return res.json({
      id: user.id,
      email: user.email,
      fullName: profile?.fullName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      jobTitle: profile?.jobTitle ?? null,
      phone: profile?.phone ?? null,
      whatsapp: profile?.whatsapp ?? null,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      onboardingSteps: profile?.onboardingSteps ?? null,
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
  } catch (err) {
    console.error("[auth] falha em /me", err);
    return res.status(500).json({ error: "Não foi possível carregar sua sessão agora." });
  }
});

authRouter.get("/me/permissions", requireAuth, async (req, res) => {
  const perms = await resolveUserPermissions(req.userId!);
  res.json(perms);
});

// -----------------------------------------------------------
// Onboarding do líder — marca etapas concluídas e o término.
// Também aceita salvar dados básicos de perfil (nome, cargo,
// telefone/WhatsApp) durante o fluxo.
// -----------------------------------------------------------
authRouter.post("/me/onboarding", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as {
    step?: string;
    completed?: boolean;
    profile?: {
      fullName?: string;
      jobTitle?: string;
      phone?: string;
      whatsapp?: string;
    };
  };

  const current = await prisma.profile.findUnique({ where: { id: req.userId! } });
  const steps =
    (current?.onboardingSteps as Record<string, string> | null | undefined) ?? {};
  if (body.step) steps[body.step] = new Date().toISOString();

  const data: Record<string, unknown> = {
    onboardingSteps: steps as never,
  };
  if (body.completed) data.onboardingCompletedAt = new Date();
  if (body.profile) {
    if (typeof body.profile.fullName === "string") data.fullName = body.profile.fullName.trim();
    if (typeof body.profile.jobTitle === "string") data.jobTitle = body.profile.jobTitle.trim();
    if (typeof body.profile.phone === "string") data.phone = body.profile.phone.trim();
    if (typeof body.profile.whatsapp === "string") data.whatsapp = body.profile.whatsapp.trim();
  }

  const updated = await prisma.profile.upsert({
    where: { id: req.userId! },
    update: data,
    create: { id: req.userId!, ...data },
  });
  res.json({
    ok: true,
    onboardingCompletedAt: updated.onboardingCompletedAt,
    onboardingSteps: updated.onboardingSteps,
  });
});