import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Tela 6 — Feedback e Conversas Difíceis.
 * Estrutura obrigatória: Fato → Impacto → Expectativa → Combinado → Prazo.
 * Cada registro gera acompanhamento e vira sinal para a Sala de Liderança.
 */
export const feedbacksRouter = Router();
feedbacksRouter.use(requireAuth);

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

feedbacksRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /organization/:orgId/feedbacks?subjectUserId=&type=&status=&mine=1
feedbacksRouter.get("/:orgId/feedbacks", async (req, res) => {
  const orgId = req.params.orgId;
  const q = req.query;
  const where: Record<string, unknown> = { organizationId: orgId };
  if (typeof q.subjectUserId === "string") where.subjectUserId = q.subjectUserId;
  if (typeof q.type === "string") where.type = q.type;
  if (typeof q.status === "string") where.status = q.status;
  if (q.mine === "1") where.authorId = req.userId!;

  const list = await prisma.feedbackRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(list);
});

const feedbackSchema = z.object({
  type: z.enum([
    "positivo",
    "corretivo",
    "alinhamento",
    "cobranca",
    "conflito",
    "desligamento",
    "reconhecimento",
  ]),
  subjectUserId: z.string().uuid().optional().nullable(),
  subjectLabel: z.string().optional().nullable(),
  fact: z.string().min(3),
  impact: z.string().min(3),
  expectation: z.string().min(3),
  agreement: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable(),
  status: z
    .enum(["registrado", "em_acompanhamento", "concluido", "reaberto"])
    .default("registrado"),
  tags: z.array(z.string()).default([]),
});

feedbacksRouter.post("/:orgId/feedbacks", async (req, res) => {
  try {
    const data = feedbackSchema.parse(req.body);
    const created = await prisma.feedbackRecord.create({
      data: {
        organizationId: req.params.orgId,
        authorId: req.userId!,
        type: data.type,
        subjectUserId: data.subjectUserId ?? null,
        subjectLabel: data.subjectLabel ?? null,
        fact: data.fact,
        impact: data.impact,
        expectation: data.expectation,
        agreement: data.agreement ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : null,
        status: data.status,
        tags: data.tags,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

feedbacksRouter.patch("/:orgId/feedbacks/:id", async (req, res) => {
  try {
    const existing = await prisma.feedbackRecord.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = feedbackSchema.partial().parse(req.body);
    const updated = await prisma.feedbackRecord.update({
      where: { id: req.params.id },
      data: {
        ...(data.type ? { type: data.type } : {}),
        ...(data.subjectUserId !== undefined ? { subjectUserId: data.subjectUserId ?? null } : {}),
        ...(data.subjectLabel !== undefined ? { subjectLabel: data.subjectLabel ?? null } : {}),
        ...(data.fact ? { fact: data.fact } : {}),
        ...(data.impact ? { impact: data.impact } : {}),
        ...(data.expectation ? { expectation: data.expectation } : {}),
        ...(data.agreement !== undefined ? { agreement: data.agreement ?? null } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.followUpAt !== undefined
          ? { followUpAt: data.followUpAt ? new Date(data.followUpAt) : null }
          : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.tags ? { tags: data.tags } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

feedbacksRouter.delete("/:orgId/feedbacks/:id", async (req, res) => {
  const existing = await prisma.feedbackRecord.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.feedbackRecord.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Templates fixos (frases-guia) — usados no frontend
feedbacksRouter.get("/:orgId/feedbacks-templates", async (_req, res) => {
  res.json(FEEDBACK_TEMPLATES);
});

const FEEDBACK_TEMPLATES = [
  {
    type: "positivo",
    label: "Feedback positivo",
    fact: "Observei que você [ação concreta] em [contexto].",
    impact: "O impacto foi [resultado observável no time/cliente].",
    expectation: "Espero manter essa referência como padrão do time.",
    agreement: "Combinado: repetir esse comportamento nas próximas [situações].",
  },
  {
    type: "corretivo",
    label: "Feedback corretivo",
    fact: "Observei que [comportamento específico] aconteceu em [data/contexto].",
    impact: "Isso gerou [consequência concreta].",
    expectation: "Espero que a partir de agora [comportamento esperado].",
    agreement: "Combinado: [ação concreta] até [prazo].",
  },
  {
    type: "alinhamento",
    label: "Alinhamento de expectativas",
    fact: "Estamos alinhando o que se espera do papel de [função].",
    impact: "Sem esse combinado ficamos sujeitos a retrabalho e ruído.",
    expectation: "Entregas centrais: [lista].",
    agreement: "Revisão em [prazo].",
  },
  {
    type: "cobranca",
    label: "Cobrança de combinado",
    fact: "Combinamos [entrega] até [data] e não foi cumprido.",
    impact: "Isso trava [processo/pessoa].",
    expectation: "Preciso entender o que aconteceu e o novo prazo real.",
    agreement: "Novo prazo: [data]. Se falhar de novo, [consequência].",
  },
  {
    type: "conflito",
    label: "Conversa de conflito",
    fact: "Percebo tensão entre [pessoas] em [situação].",
    impact: "O time sente e a entrega perde velocidade.",
    expectation: "Preciso que resolvamos direto, sem terceiros.",
    agreement: "Combinado: [conduta] daqui pra frente.",
  },
  {
    type: "desligamento",
    label: "Conversa de desligamento",
    fact: "Chegamos a este ponto após [fatos e tentativas anteriores].",
    impact: "A relação profissional se encerra aqui.",
    expectation: "Encerrar com respeito e clareza dos próximos passos.",
    agreement: "Datas, entrega de acessos e comunicação combinadas.",
  },
  {
    type: "reconhecimento",
    label: "Reconhecimento",
    fact: "Reconheço [entrega/atitude] neste ciclo.",
    impact: "Isso elevou [resultado/cultura].",
    expectation: "Que essa referência inspire o time.",
    agreement: "Registrado publicamente em [ritual/canal].",
  },
] as const;