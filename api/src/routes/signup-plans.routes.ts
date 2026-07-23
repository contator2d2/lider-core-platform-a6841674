import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const signupPlansRouter = Router();

const ROLES = ["super_admin", "neo_admin", "franchise_owner", "hr_admin", "leader", "collaborator"] as const;
const TIERS = ["essencial", "profissional", "enterprise"] as const;

async function isSuperAdmin(userId: string) {
  const r = await prisma.userRole.findFirst({ where: { userId, role: "super_admin" } });
  return !!r;
}

// Público — usado na tela de cadastro
export const publicSignupPlansRouter = Router();
publicSignupPlansRouter.get("/signup-plans", async (_req, res) => {
  try {
    const plans = await prisma.signupPlan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        description: true,
        targetRole: true,
        planTier: true,
      },
    });
    res.json({ plans });
  } catch (err) {
    console.error("[signup-plans] falha ao listar", err);
    res.status(500).json({ error: "Falha ao listar planos" });
  }
});

// ---- Admin CRUD ----
signupPlansRouter.use(requireAuth);

signupPlansRouter.get("/", async (req, res) => {
  if (!(await isSuperAdmin(req.userId!))) return res.status(403).json({ error: "Forbidden" });
  const plans = await prisma.signupPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({ plans });
});

const upsertSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "slug deve ser minúsculo com hífens"),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  targetRole: z.enum(ROLES),
  planTier: z.enum(TIERS).default("essencial"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

signupPlansRouter.post("/", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.userId!))) return res.status(403).json({ error: "Forbidden" });
    const data = upsertSchema.parse(req.body);
    const created = await prisma.signupPlan.create({ data });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

signupPlansRouter.put("/:id", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.userId!))) return res.status(403).json({ error: "Forbidden" });
    const data = upsertSchema.partial().parse(req.body);
    const updated = await prisma.signupPlan.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

signupPlansRouter.delete("/:id", async (req, res) => {
  try {
    if (!(await isSuperAdmin(req.userId!))) return res.status(403).json({ error: "Forbidden" });
    await prisma.signupPlan.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Bootstrap — cria três planos default de validação se nenhum existir
export async function bootstrapSignupPlans() {
  try {
    const count = await prisma.signupPlan.count();
    if (count > 0) return;
    await prisma.signupPlan.createMany({
      data: [
        {
          slug: "lider-essencial",
          name: "Líder — Essencial",
          description: "Líder direto com acesso à Consciência, Rituais, PDI e Coach C.O.R.E.",
          targetRole: "leader",
          planTier: "essencial",
          sortOrder: 1,
        },
        {
          slug: "rh-profissional",
          name: "RH — Profissional",
          description: "RH/People Ops com gestão da organização, ciclos e templates.",
          targetRole: "hr_admin",
          planTier: "profissional",
          sortOrder: 2,
        },
        {
          slug: "colaborador-teste",
          name: "Colaborador — Teste",
          description: "Perfil de liderado para responder pulses e ver o próprio PDI.",
          targetRole: "collaborator",
          planTier: "essencial",
          sortOrder: 3,
        },
      ],
    });
    console.log("[bootstrap] signup plans default criados");
  } catch (err) {
    console.error("[bootstrap] falha ao criar signup plans", err);
  }
}