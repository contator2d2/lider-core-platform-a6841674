/**
 * Camada BASE do app — disponível para qualquer módulo ativo.
 * - Notas rápidas e reuniões (com participantes, pauta e transcrição)
 * - Resumo + ações automáticas por IA (sempre com a Inteligência Neo)
 * - Pergunta livre à IA já ancorada na metodologia
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { completeChat, type ChatMessage } from "../lib/ai-gateway.js";
import { neoContextMessage } from "../lib/neo-context.js";

export const baseRouter = Router();
baseRouter.use(requireAuth);

async function assertOrgAccess(userId: string, orgId: string) {
  const superRole = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["super_admin", "neo_admin"] } },
  });
  if (superRole) return true;
  const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgId } });
  return !!m;
}

const noteSchema = z.object({
  kind: z.enum(["nota", "reuniao"]).default("nota"),
  title: z.string().min(1).max(160),
  content: z.string().max(20000).default(""),
  transcript: z.string().max(40000).nullish(),
  source: z.enum(["manual", "voz"]).default("manual"),
  participants: z.array(z.string().max(120)).max(30).default([]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  meetingAt: z.string().datetime().nullish(),
  durationMin: z.number().int().min(0).max(1440).nullish(),
  pinned: z.boolean().default(false),
});

// GET /:orgId/base/notes?kind=&q=
baseRouter.get("/:orgId/base/notes", async (req, res) => {
  const { orgId } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const kind = typeof req.query.kind === "string" && req.query.kind !== "all" ? req.query.kind : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const notes = await prisma.baseNote.findMany({
    where: {
      organizationId: orgId,
      userId: req.userId!,
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { content: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  res.json(notes);
});

baseRouter.post("/:orgId/base/notes", async (req, res) => {
  const { orgId } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;
  const note = await prisma.baseNote.create({
    data: {
      organizationId: orgId,
      userId: req.userId!,
      kind: d.kind,
      title: d.title,
      content: d.content,
      transcript: d.transcript ?? null,
      source: d.source,
      participants: d.participants,
      tags: d.tags,
      meetingAt: d.meetingAt ? new Date(d.meetingAt) : null,
      durationMin: d.durationMin ?? null,
      pinned: d.pinned,
    },
  });
  res.status(201).json(note);
});

baseRouter.patch("/:orgId/base/notes/:id", async (req, res) => {
  const { orgId, id } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const parsed = noteSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const existing = await prisma.baseNote.findFirst({ where: { id, organizationId: orgId, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Nota não encontrada" });
  const d = parsed.data;
  const note = await prisma.baseNote.update({
    where: { id },
    data: {
      ...(d.kind !== undefined ? { kind: d.kind } : {}),
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.content !== undefined ? { content: d.content } : {}),
      ...(d.transcript !== undefined ? { transcript: d.transcript ?? null } : {}),
      ...(d.participants !== undefined ? { participants: d.participants } : {}),
      ...(d.tags !== undefined ? { tags: d.tags } : {}),
      ...(d.meetingAt !== undefined ? { meetingAt: d.meetingAt ? new Date(d.meetingAt) : null } : {}),
      ...(d.durationMin !== undefined ? { durationMin: d.durationMin ?? null } : {}),
      ...(d.pinned !== undefined ? { pinned: d.pinned } : {}),
    },
  });
  res.json(note);
});

baseRouter.delete("/:orgId/base/notes/:id", async (req, res) => {
  const { orgId, id } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const existing = await prisma.baseNote.findFirst({ where: { id, organizationId: orgId, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Nota não encontrada" });
  await prisma.baseNote.delete({ where: { id } });
  res.json({ ok: true });
});

// POST /:orgId/base/notes/:id/ai — resumo + ações, ancorado na metodologia Neo
baseRouter.post("/:orgId/base/notes/:id/ai", async (req, res) => {
  const { orgId, id } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const note = await prisma.baseNote.findFirst({ where: { id, organizationId: orgId, userId: req.userId! } });
  if (!note) return res.status(404).json({ error: "Nota não encontrada" });

  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Você é o assistente do líder no Líder C.O.R.E. Responda sempre em português do Brasil, " +
          "curto e acionável, usando a metodologia Neo abaixo como referência conceitual.",
      },
      await neoContextMessage(),
      {
        role: "user",
        content:
          `Tipo: ${note.kind === "reuniao" ? "reunião" : "nota"}\n` +
          `Título: ${note.title}\n` +
          (note.participants.length ? `Participantes: ${note.participants.join(", ")}\n` : "") +
          `Conteúdo:\n${note.content || note.transcript || ""}\n\n` +
          "Responda APENAS um JSON válido:\n" +
          `{"resumo":"3-5 linhas em markdown","pontos":["..."],"acoes":[{"titulo":"...","responsavel":null,"prazo":null}],"perguntas":["..."],"conexaoMetodologia":"qual competência/pilar da metodologia Neo isso toca"}`,
      },
    ];
    const raw = await completeChat({ messages, temperature: 0.4 });
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const parsed = start >= 0 && end > start ? JSON.parse(clean.slice(start, end + 1)) : { resumo: raw };

    const updated = await prisma.baseNote.update({
      where: { id },
      data: {
        aiSummary: typeof parsed.resumo === "string" ? parsed.resumo : raw,
        aiActions: parsed,
        aiGeneratedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("[base/notes/ai]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao analisar" });
  }
});

// POST /:orgId/base/ask — pergunta livre à IA com metodologia Neo
baseRouter.post("/:orgId/base/ask", async (req, res) => {
  const { orgId } = req.params;
  if (!(await assertOrgAccess(req.userId!, orgId))) return res.status(403).json({ error: "Forbidden" });
  const parsed = z.object({ question: z.string().min(2).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const answer = await completeChat({
      messages: [
        {
          role: "system",
          content:
            "Você é o Coach C.O.R.E. Responda em pt-BR, markdown enxuto, no máximo 3 recomendações, " +
            "sempre ancorado na metodologia Neo abaixo.",
        },
        await neoContextMessage(),
        { role: "user", content: parsed.data.question },
      ],
    });
    res.json({ answer, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Falha na IA" });
  }
});
