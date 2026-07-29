import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles } from "../auth.js";
import { recordAudit, shallowDiff } from "../lib/audit.js";

export const neoRouter = Router();
neoRouter.use(requireAuth, requireRoles("super_admin", "neo_admin"));

// ============================================================
// Helpers
// ============================================================
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base || `item-${Date.now()}`;
  let i = 2;
  while (await exists(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ============================================================
// Methodology Items
// ============================================================
const methodologyTypes = [
  "competencia", "valor", "pilar", "modulo_core", "ritual", "ferramenta",
  "modelo_lideranca", "comp_tecnica", "comp_comportamental", "comp_emocional",
] as const;
const itemStatuses = ["draft", "active", "archived"] as const;

const methodologyItemSchema = z.object({
  type: z.enum(methodologyTypes),
  slug: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  content: z.any().optional(),
  tags: z.array(z.string()).optional().default([]),
  orderIndex: z.number().int().min(0).optional().default(0),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/methodology-items", async (req, res) => {
  const type = req.query.type as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.methodologyItem.findMany({
    where: {
      AND: [
        type ? { type: type as never } : {},
        q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
        ] } : {},
      ],
    },
    orderBy: [{ orderIndex: "asc" }, { updatedAt: "desc" }],
    take: 500,
  });
  res.json(items);
});

neoRouter.get("/methodology-items/:id", async (req, res) => {
  const item = await prisma.methodologyItem.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!item) return res.status(404).json({ error: "Item não encontrado" });
  res.json(item);
});

neoRouter.post("/methodology-items", async (req, res) => {
  const parsed = methodologyItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.methodologyItem.findUnique({ where: { slug: s } })));
  const item = await prisma.methodologyItem.create({
    data: {
      ...parsed.data,
      slug,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null, note: "criação" },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "create", actorId: req.userId, diff: { after: item } });
  res.status(201).json(item);
});

neoRouter.patch("/methodology-items/:id", async (req, res) => {
  const parsed = methodologyItemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.methodologyItem.update({
    where: { id: req.params.id },
    data: { ...parsed.data, version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null, note: (req.body?.note as string) ?? null },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "update", actorId: req.userId, diff: shallowDiff(before as never, item as never) });
  res.json(item);
});

neoRouter.delete("/methodology-items/:id", async (req, res) => {
  const before = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(204).end();
  await prisma.methodologyItem.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "methodology_item", entityId: before.id, action: "delete", actorId: req.userId, diff: { before } });
  res.status(204).end();
});

neoRouter.get("/methodology-items/:id/versions", async (req, res) => {
  const versions = await prisma.methodologyItemVersion.findMany({
    where: { itemId: req.params.id },
    orderBy: { version: "desc" },
  });
  res.json(versions);
});

neoRouter.post("/methodology-items/:id/restore/:version", async (req, res) => {
  const target = await prisma.methodologyItemVersion.findUnique({
    where: { itemId_version: { itemId: req.params.id, version: Number(req.params.version) } },
  });
  if (!target) return res.status(404).json({ error: "Versão não encontrada" });
  const snap = target.snapshot as never as { name?: string; description?: string | null; objective?: string | null; content?: unknown; tags?: string[]; category?: string | null; orderIndex?: number; status?: never; type?: never };
  const current = await prisma.methodologyItem.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Item não encontrado" });
  const nextVersion = current.version + 1;
  const item = await prisma.methodologyItem.update({
    where: { id: req.params.id },
    data: {
      name: snap.name ?? current.name,
      description: snap.description ?? current.description,
      objective: snap.objective ?? current.objective,
      content: (snap.content ?? current.content) as never,
      tags: snap.tags ?? current.tags,
      category: snap.category ?? current.category,
      orderIndex: snap.orderIndex ?? current.orderIndex,
      version: nextVersion,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.methodologyItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null, note: `restaurado da versão ${target.version}` },
  });
  await recordAudit({ entity: "methodology_item", entityId: item.id, action: "restore", actorId: req.userId, note: `v${target.version}` });
  res.json(item);
});

// ============================================================
// Knowledge Items
// ============================================================
const knowledgeKinds = [
  "conceito", "playbook", "boa_pratica", "caso", "recomendacao", "tecnica",
  "exercicio", "leitura", "video", "ferramenta", "template", "modelo_feedback",
  "modelo_pdi", "ritual",
] as const;
const difficulties = ["iniciante", "intermediario", "avancado"] as const;

const knowledgeSchema = z.object({
  kind: z.enum(knowledgeKinds),
  slug: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  body: z.any().optional(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  competencyIds: z.array(z.string()).optional().default([]),
  coreModule: z.string().optional().nullable(),
  difficulty: z.enum(difficulties).optional().nullable(),
  audience: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/knowledge", async (req, res) => {
  const kind = req.query.kind as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.knowledgeItem.findMany({
    where: {
      AND: [
        kind ? { kind: kind as never } : {},
        q ? { OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
        ] } : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  res.json(items);
});

neoRouter.get("/knowledge/:id", async (req, res) => {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!item) return res.status(404).json({ error: "Não encontrado" });
  res.json(item);
});

neoRouter.post("/knowledge", async (req, res) => {
  const parsed = knowledgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.title);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.knowledgeItem.findUnique({ where: { slug: s } })));
  const item = await prisma.knowledgeItem.create({
    data: {
      ...parsed.data,
      slug,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : null,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.knowledgeItemVersion.create({
    data: { itemId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null, note: "criação" },
  });
  await recordAudit({ entity: "knowledge_item", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/knowledge/:id", async (req, res) => {
  const parsed = knowledgeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.knowledgeItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.knowledgeItem.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : undefined,
      version: nextVersion,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.knowledgeItemVersion.create({
    data: { itemId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null },
  });
  await recordAudit({ entity: "knowledge_item", entityId: item.id, action: "update", actorId: req.userId, diff: shallowDiff(before as never, item as never) });
  res.json(item);
});

neoRouter.delete("/knowledge/:id", async (req, res) => {
  const before = await prisma.knowledgeItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(204).end();
  await prisma.knowledgeItem.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "knowledge_item", entityId: before.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// ============================================================
// Templates
// ============================================================
const templateKinds = ["feedback", "pdi", "exercicio", "one_on_one", "plano", "checklist", "avaliacao"] as const;
const templateSchema = z.object({
  kind: z.enum(templateKinds),
  slug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  body: z.any(),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(itemStatuses).optional().default("active"),
});

neoRouter.get("/templates", async (req, res) => {
  const kind = req.query.kind as string | undefined;
  const items = await prisma.template.findMany({
    where: kind ? { kind: kind as never } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  res.json(items);
});

neoRouter.post("/templates", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.template.findUnique({ where: { slug: s } })));
  const item = await prisma.template.create({
    data: {
      ...parsed.data,
      body: (parsed.data.body ?? {}) as never,
      slug,
      createdById: req.userId ?? null,
      updatedById: req.userId ?? null,
    },
  });
  await prisma.templateVersion.create({ data: { templateId: item.id, version: 1, snapshot: item as never, authorId: req.userId ?? null } });
  await recordAudit({ entity: "template", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/templates/:id", async (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = before.version + 1;
  const item = await prisma.template.update({
    where: { id: req.params.id },
    data: { ...parsed.data, version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.templateVersion.create({ data: { templateId: item.id, version: nextVersion, snapshot: item as never, authorId: req.userId ?? null } });
  await recordAudit({ entity: "template", entityId: item.id, action: "update", actorId: req.userId });
  res.json(item);
});

neoRouter.delete("/templates/:id", async (req, res) => {
  await prisma.template.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "template", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// ============================================================
// Assessments (metadata + builder blocks/questions)
// ============================================================
const assessmentSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  objective: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  competency: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  estimatedTime: z.number().int().min(0).optional().nullable(),
  frequency: z.string().optional().nullable(),
  weight: z.number().int().min(1).optional().default(1),
  coreModule: z.string().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("draft"),
  randomize: z.boolean().optional().default(false),
});

neoRouter.get("/assessments", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const items = await prisma.assessment.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { blocks: true } } },
  });
  res.json(items);
});

neoRouter.get("/assessments/:id", async (req, res) => {
  const a = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            include: { options: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      versions: { orderBy: { version: "desc" }, take: 20 },
    },
  });
  if (!a) return res.status(404).json({ error: "Não encontrado" });
  res.json(a);
});

neoRouter.post("/assessments", async (req, res) => {
  const parsed = assessmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.assessment.findUnique({ where: { slug: s } })));
  const item = await prisma.assessment.create({
    data: { ...parsed.data, slug, createdById: req.userId ?? null, updatedById: req.userId ?? null },
  });
  await recordAudit({ entity: "assessment", entityId: item.id, action: "create", actorId: req.userId });
  res.status(201).json(item);
});

neoRouter.patch("/assessments/:id", async (req, res) => {
  const parsed = assessmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.assessment.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Não encontrado" });
  const item = await prisma.assessment.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updatedById: req.userId ?? null },
  });
  await recordAudit({ entity: "assessment", entityId: item.id, action: "update", actorId: req.userId });
  res.json(item);
});

neoRouter.post("/assessments/:id/publish", async (req, res) => {
  const current = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: { blocks: { include: { questions: { include: { options: true } } } } },
  });
  if (!current) return res.status(404).json({ error: "Não encontrado" });
  const nextVersion = current.version + 1;
  const updated = await prisma.assessment.update({
    where: { id: req.params.id },
    data: { status: "active", version: nextVersion, updatedById: req.userId ?? null },
  });
  await prisma.assessmentVersion.create({
    data: { assessmentId: current.id, version: nextVersion, snapshot: current as never, authorId: req.userId ?? null, note: "publicação" },
  });
  await recordAudit({ entity: "assessment", entityId: current.id, action: "publish", actorId: req.userId });
  res.json(updated);
});

neoRouter.delete("/assessments/:id", async (req, res) => {
  await prisma.assessment.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "assessment", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

// blocks
const blockSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional().default(0),
});
neoRouter.post("/assessments/:id/blocks", async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.assessmentBlock.create({ data: { ...parsed.data, assessmentId: req.params.id } });
  res.status(201).json(b);
});
neoRouter.patch("/blocks/:blockId", async (req, res) => {
  const parsed = blockSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.assessmentBlock.update({ where: { id: req.params.blockId }, data: parsed.data });
  res.json(b);
});
neoRouter.delete("/blocks/:blockId", async (req, res) => {
  await prisma.assessmentBlock.delete({ where: { id: req.params.blockId } }).catch(() => null);
  res.status(204).end();
});

// questions
const questionTypes = ["unica", "multipla", "likert", "slider", "ranking", "texto", "cenario", "autoavaliacao"] as const;
const questionSchema = z.object({
  type: z.enum(questionTypes),
  prompt: z.string().min(1),
  helpText: z.string().optional().nullable(),
  required: z.boolean().optional().default(true),
  weight: z.number().int().min(0).optional().default(1),
  scaleMin: z.number().int().optional().nullable(),
  scaleMax: z.number().int().optional().nullable(),
  showIf: z.any().optional(),
  orderIndex: z.number().int().min(0).optional().default(0),
  options: z.array(z.object({
    label: z.string(), value: z.string(), score: z.number().int().optional().default(0), orderIndex: z.number().int().optional().default(0),
  })).optional(),
});
neoRouter.post("/blocks/:blockId/questions", async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { options, ...rest } = parsed.data;
  const q = await prisma.assessmentQuestion.create({
    data: {
      ...rest,
      blockId: req.params.blockId,
      options: options ? { create: options } : undefined,
    },
    include: { options: true },
  });
  res.status(201).json(q);
});
neoRouter.patch("/questions/:questionId", async (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { options, ...rest } = parsed.data;
  const q = await prisma.assessmentQuestion.update({
    where: { id: req.params.questionId },
    data: rest,
  });
  if (options) {
    await prisma.assessmentOption.deleteMany({ where: { questionId: q.id } });
    await prisma.assessmentOption.createMany({ data: options.map((o) => ({ ...o, questionId: q.id })) });
  }
  const fresh = await prisma.assessmentQuestion.findUnique({ where: { id: q.id }, include: { options: true } });
  res.json(fresh);
});
neoRouter.delete("/questions/:questionId", async (req, res) => {
  await prisma.assessmentQuestion.delete({ where: { id: req.params.questionId } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// Journeys
// ============================================================
const journeySchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  coreModule: z.string().optional().nullable(),
  status: z.enum(itemStatuses).optional().default("draft"),
});
const stepKinds = ["assessment", "video", "texto", "exercicio", "quiz", "documento", "pdi", "conteudo", "aprovacao"] as const;
const stepSchema = z.object({
  kind: z.enum(stepKinds),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  refId: z.string().optional().nullable(),
  content: z.any().optional(),
  requires: z.array(z.string()).optional().default([]),
  orderIndex: z.number().int().min(0).optional().default(0),
});

neoRouter.get("/journeys", async (_req, res) => {
  const items = await prisma.journey.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  res.json(items);
});

neoRouter.get("/journeys/:id", async (req, res) => {
  const j = await prisma.journey.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });
  if (!j) return res.status(404).json({ error: "Não encontrado" });
  res.json(j);
});

neoRouter.post("/journeys", async (req, res) => {
  const parsed = journeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const base = slugify(parsed.data.slug || parsed.data.name);
  const slug = await ensureUniqueSlug(base, async (s) => !!(await prisma.journey.findUnique({ where: { slug: s } })));
  const j = await prisma.journey.create({ data: { ...parsed.data, slug, createdById: req.userId ?? null, updatedById: req.userId ?? null } });
  await recordAudit({ entity: "journey", entityId: j.id, action: "create", actorId: req.userId });
  res.status(201).json(j);
});

neoRouter.patch("/journeys/:id", async (req, res) => {
  const parsed = journeySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const j = await prisma.journey.update({ where: { id: req.params.id }, data: { ...parsed.data, updatedById: req.userId ?? null } });
  await recordAudit({ entity: "journey", entityId: j.id, action: "update", actorId: req.userId });
  res.json(j);
});

neoRouter.delete("/journeys/:id", async (req, res) => {
  await prisma.journey.delete({ where: { id: req.params.id } }).catch(() => null);
  await recordAudit({ entity: "journey", entityId: req.params.id, action: "delete", actorId: req.userId });
  res.status(204).end();
});

neoRouter.post("/journeys/:id/steps", async (req, res) => {
  const parsed = stepSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const step = await prisma.journeyStep.create({ data: { ...parsed.data, journeyId: req.params.id } });
  res.status(201).json(step);
});
neoRouter.patch("/steps/:stepId", async (req, res) => {
  const parsed = stepSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const step = await prisma.journeyStep.update({ where: { id: req.params.stepId }, data: parsed.data });
  res.json(step);
});
neoRouter.delete("/steps/:stepId", async (req, res) => {
  await prisma.journeyStep.delete({ where: { id: req.params.stepId } }).catch(() => null);
  res.status(204).end();
});

// ============================================================
// Audit — read-only for admin
// ============================================================
neoRouter.get("/audit", async (req, res) => {
  const entity = req.query.entity as string | undefined;
  const entityId = req.query.entityId as string | undefined;
  const items = await prisma.auditEntry.findMany({
    where: { entity: entity ?? undefined, entityId: entityId ?? undefined },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(items);
});

// ============================================================
// Overview — for admin home
// ============================================================
neoRouter.get("/overview", async (_req, res) => {
  const [methodology, knowledge, templates, assessments, journeys, audit] = await Promise.all([
    prisma.methodologyItem.count(),
    prisma.knowledgeItem.count(),
    prisma.template.count(),
    prisma.assessment.count(),
    prisma.journey.count(),
    prisma.auditEntry.count(),
  ]);
  res.json({ methodology, knowledge, templates, assessments, journeys, audit });
});

// ============================================================
// AI Knowledge Context — served to AI callers
// ============================================================
neoRouter.get("/ai-context", async (_req, res) => {
  const [methodology, competencies, playbooks, templates, activeAssessments, activeJourneys] = await Promise.all([
    prisma.methodologyItem.findMany({ where: { status: "active" }, take: 200 }),
    prisma.methodologyItem.findMany({ where: { type: "competencia", status: "active" }, take: 100 }),
    prisma.knowledgeItem.findMany({ where: { kind: "playbook", status: "active" }, take: 50 }),
    prisma.template.findMany({ where: { status: "active" }, take: 50 }),
    prisma.assessment.findMany({ where: { status: "active" }, take: 50 }),
    prisma.journey.findMany({ where: { status: "active" }, take: 20 }),
  ]);
  res.json({ methodology, competencies, playbooks, templates, assessments: activeAssessments, journeys: activeJourneys });
});