import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { completeChat } from "../lib/ai-gateway.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * 360 leve — Rodada trimestral com 3 perguntas fixas por avaliador.
 * Perguntas:
 *  1. O que devo CONTINUAR fazendo?
 *  2. O que devo COMEÇAR a fazer?
 *  3. O que devo PARAR de fazer?
 * Cada uma tem nota 1..5 + comentário. Consolidação anônima com IA.
 */
export const threeSixtyRouter = Router();
threeSixtyRouter.use(requireAuth);

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

threeSixtyRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

export const THREE_SIXTY_QUESTIONS = [
  "O que devo CONTINUAR fazendo?",
  "O que devo COMEÇAR a fazer?",
  "O que devo PARAR de fazer?",
] as const;

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

// GET /:orgId/three-sixty — lista rodadas visíveis para o líder
threeSixtyRouter.get("/:orgId/three-sixty", async (req, res) => {
  const orgId = req.params.orgId;
  const userId = req.userId!;
  const list = await prisma.threeSixtyRound.findMany({
    where: {
      organizationId: orgId,
      OR: [{ subjectUserId: userId }, { createdById: userId }],
    },
    include: { responses: { select: { id: true, evaluatorId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

// GET /:orgId/three-sixty/pending — rodadas em que sou avaliador convidado
// (por simplicidade: qualquer rodada aberta da minha org onde eu ainda não respondi
//  e não sou o próprio avaliado)
threeSixtyRouter.get("/:orgId/three-sixty/pending", async (req, res) => {
  const orgId = req.params.orgId;
  const userId = req.userId!;
  const open = await prisma.threeSixtyRound.findMany({
    where: {
      organizationId: orgId,
      status: "open",
      subjectUserId: { not: userId },
    },
    include: { responses: { where: { evaluatorId: userId }, select: { id: true } } },
  });
  res.json(open.filter((r) => r.responses.length === 0));
});

const roundSchema = z.object({
  subjectUserId: z.string().uuid(),
  title: z.string().min(3).max(140),
  quarter: z.string().optional(),
  evaluatorIds: z.array(z.string().uuid()).optional(),
});

threeSixtyRouter.post("/:orgId/three-sixty", async (req, res) => {
  try {
    const data = roundSchema.parse(req.body);
    const created = await prisma.threeSixtyRound.create({
      data: {
        organizationId: req.params.orgId,
        createdById: req.userId!,
        subjectUserId: data.subjectUserId,
        title: data.title,
        quarter: data.quarter ?? currentQuarter(),
      },
    });
    // Notifica avaliadores convidados
    if (data.evaluatorIds?.length) {
      await Promise.all(
        data.evaluatorIds
          .filter((id) => id !== req.userId)
          .map((id) =>
            notifyInApp({
              userId: id,
              organizationId: req.params.orgId,
              title: "Convite para 360",
              body: `Você foi convidado para responder um 360 sobre ${data.title}.`,
              linkUrl: "/app/360",
            }).catch(() => null),
          ),
      );
    }
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

// GET /:orgId/three-sixty/:id — detalhes (líder criador ou avaliado veem tudo; outros veem só perguntas)
threeSixtyRouter.get("/:orgId/three-sixty/:id", async (req, res) => {
  const orgId = req.params.orgId;
  const userId = req.userId!;
  const round = await prisma.threeSixtyRound.findFirst({
    where: { id: req.params.id, organizationId: orgId },
    include: { responses: true },
  });
  if (!round) return res.status(404).json({ error: "Not found" });
  const canSeeAll =
    round.subjectUserId === userId || round.createdById === userId || (await isSuper(userId));
  const myResponse = round.responses.find((r) => r.evaluatorId === userId) ?? null;
  res.json({
    id: round.id,
    subjectUserId: round.subjectUserId,
    createdById: round.createdById,
    title: round.title,
    quarter: round.quarter,
    status: round.status,
    summaryMarkdown: round.summaryMarkdown,
    closedAt: round.closedAt,
    createdAt: round.createdAt,
    questions: THREE_SIXTY_QUESTIONS,
    myResponse,
    responseCount: round.responses.length,
    responses: canSeeAll
      ? round.responses.map((r) => ({
          // anônimo: nunca expor evaluatorId para o avaliado
          id: r.id,
          score1: r.score1,
          score2: r.score2,
          score3: r.score3,
          comment1: r.comment1,
          comment2: r.comment2,
          comment3: r.comment3,
          createdAt: r.createdAt,
        }))
      : undefined,
  });
});

const responseSchema = z.object({
  score1: z.number().int().min(1).max(5),
  score2: z.number().int().min(1).max(5),
  score3: z.number().int().min(1).max(5),
  comment1: z.string().max(1000).optional().nullable(),
  comment2: z.string().max(1000).optional().nullable(),
  comment3: z.string().max(1000).optional().nullable(),
});

threeSixtyRouter.post("/:orgId/three-sixty/:id/responses", async (req, res) => {
  try {
    const round = await prisma.threeSixtyRound.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
    });
    if (!round) return res.status(404).json({ error: "Not found" });
    if (round.status !== "open") return res.status(400).json({ error: "Rodada fechada" });
    if (round.subjectUserId === req.userId) {
      return res.status(400).json({ error: "Você não pode responder o seu próprio 360" });
    }
    const data = responseSchema.parse(req.body);
    const saved = await prisma.threeSixtyResponse.upsert({
      where: { roundId_evaluatorId: { roundId: round.id, evaluatorId: req.userId! } },
      update: {
        score1: data.score1,
        score2: data.score2,
        score3: data.score3,
        comment1: data.comment1 ?? null,
        comment2: data.comment2 ?? null,
        comment3: data.comment3 ?? null,
      },
      create: {
        roundId: round.id,
        evaluatorId: req.userId!,
        score1: data.score1,
        score2: data.score2,
        score3: data.score3,
        comment1: data.comment1 ?? null,
        comment2: data.comment2 ?? null,
        comment3: data.comment3 ?? null,
      },
    });
    res.status(201).json({ id: saved.id });
  } catch (err) {
    badReq(res, err);
  }
});

// POST /:orgId/three-sixty/:id/close — fecha a rodada e gera consolidação com IA
threeSixtyRouter.post("/:orgId/three-sixty/:id/close", async (req, res) => {
  try {
    const round = await prisma.threeSixtyRound.findFirst({
      where: { id: req.params.id, organizationId: req.params.orgId },
      include: { responses: true },
    });
    if (!round) return res.status(404).json({ error: "Not found" });
    if (round.createdById !== req.userId && !(await isSuper(req.userId!))) {
      return res.status(403).json({ error: "Apenas o criador da rodada pode fechá-la" });
    }

    let summary: string | null = null;
    if (round.responses.length >= 1) {
      const anon = round.responses.map((r, i) => ({
        avaliador: `Avaliador ${i + 1}`,
        continuar: { nota: r.score1, comentario: r.comment1 },
        comecar: { nota: r.score2, comentario: r.comment2 },
        parar: { nota: r.score3, comentario: r.comment3 },
      }));
      try {
        summary = await completeChat({
          messages: [
            {
              role: "system",
              content:
                "Você consolida respostas anônimas de um 360. Em pt-BR, tom direto e respeitoso. " +
                "NUNCA cite nomes de avaliadores. Preserve anonimato.",
            },
            {
              role: "user",
              content:
                "Consolide as respostas abaixo em markdown, com estas seções:\n" +
                "## Temas para CONTINUAR\n## Temas para COMEÇAR\n## Temas para PARAR\n## Convergências e divergências\n## 3 ações sugeridas\n\n" +
                "Respostas (JSON):\n```json\n" +
                JSON.stringify(anon, null, 2) +
                "\n```",
            },
          ],
        });
      } catch (err) {
        console.error("[three-sixty/close] IA falhou, fechando sem sumário", err);
      }
    }

    const updated = await prisma.threeSixtyRound.update({
      where: { id: round.id },
      data: { status: "closed", closedAt: new Date(), summaryMarkdown: summary },
    });

    if (round.subjectUserId !== req.userId) {
      void notifyInApp({
        userId: round.subjectUserId,
        organizationId: round.organizationId,
        title: "Seu 360 foi fechado",
        body: `${round.title} — consolidação disponível.`,
        linkUrl: "/app/360",
      }).catch(() => null);
    }

    res.json(updated);
  } catch (err) {
    badReq(res, err);
  }
});

threeSixtyRouter.delete("/:orgId/three-sixty/:id", async (req, res) => {
  const round = await prisma.threeSixtyRound.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!round) return res.status(404).json({ error: "Not found" });
  if (round.createdById !== req.userId && !(await isSuper(req.userId!))) {
    return res.status(403).json({ error: "Apenas o criador pode excluir" });
  }
  await prisma.threeSixtyRound.delete({ where: { id: round.id } });
  res.status(204).end();
});