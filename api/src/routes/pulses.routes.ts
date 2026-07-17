import { Router, type Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { notifyInApp } from "../lib/notifications.js";

/**
 * Pulsos — links públicos com token para o liderado responder
 * sem precisar de login. Suporta 4 tipos:
 *  - feedback: perguntas abertas + escala (feedback solicitado)
 *  - climate: pulse curto (humor/carga/clareza)
 *  - disc: 24 pares forçados
 *  - custom: montado pelo líder
 */

// ---------------------- helpers ----------------------

function badReq(res: Response, err: unknown) {
  return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
}

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

function genToken() {
  // 32 chars url-safe
  return randomBytes(24).toString("base64url");
}

// ---------------------- default templates ----------------------

type Q =
  | { id: string; type: "scale"; label: string; min?: number; max?: number; minLabel?: string; maxLabel?: string; required?: boolean }
  | { id: string; type: "text"; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: "choice"; label: string; options: string[]; multi?: boolean; required?: boolean }
  | { id: string; type: "disc_pair"; label: string; options: { text: string; dim: "D" | "I" | "S" | "C" }[] };

const SYSTEM_TEMPLATES: Array<{
  slug: string;
  kind: "feedback" | "climate" | "disc" | "custom";
  title: string;
  intro: string;
  questions: Q[];
}> = [
  {
    slug: "feedback_leader",
    kind: "feedback",
    title: "Feedback pro seu líder",
    intro:
      "Sua resposta é confidencial e ajuda a melhorar a forma como somos liderados. Leva 2 minutos.",
    questions: [
      { id: "clarity", type: "scale", label: "Quão clara está a direção do time?", minLabel: "Nada clara", maxLabel: "Muito clara", required: true },
      { id: "autonomy", type: "scale", label: "Você sente que tem autonomia pra decidir?", minLabel: "Pouca", maxLabel: "Muita", required: true },
      { id: "feedback_quality", type: "scale", label: "Como está a qualidade dos feedbacks que recebe?", minLabel: "Baixa", maxLabel: "Excelente", required: true },
      { id: "keep", type: "text", label: "O que seu líder deveria CONTINUAR fazendo?", required: true },
      { id: "start", type: "text", label: "O que ele deveria COMEÇAR a fazer?", required: true },
      { id: "stop", type: "text", label: "O que ele deveria PARAR de fazer?" },
    ],
  },
  {
    slug: "climate_weekly",
    kind: "climate",
    title: "Pulse semanal — 30 segundos",
    intro: "Três perguntas rápidas pra gente saber como você tá essa semana.",
    questions: [
      { id: "mood", type: "scale", label: "Como você tá se sentindo essa semana?", minLabel: "Muito mal", maxLabel: "Muito bem", required: true },
      { id: "workload", type: "scale", label: "Como tá sua carga de trabalho?", minLabel: "Baixíssima", maxLabel: "Insustentável", required: true },
      { id: "clarity", type: "scale", label: "Quão claro tá o que se espera de você?", minLabel: "Confuso", maxLabel: "Cristalino", required: true },
      { id: "note", type: "text", label: "Algo que você queira contar? (opcional)" },
    ],
  },
  {
    slug: "disc_light",
    kind: "disc",
    title: "DISC leve — Perfil comportamental",
    intro:
      "Em cada par, escolha a frase que MAIS te descreve. Não existe resposta certa. Leva 5 minutos.",
    questions: buildDiscPairs(),
  },
  {
    slug: "custom_blank",
    kind: "custom",
    title: "Pesquisa personalizada",
    intro: "Responda com sinceridade.",
    questions: [
      { id: "q1", type: "text", label: "Pergunta 1", required: true },
    ],
  },
];

function buildDiscPairs(): Q[] {
  // 24 forced-choice pairs — 6 per DISC dimension across pairs
  const pairs: Array<[[string, "D" | "I" | "S" | "C"], [string, "D" | "I" | "S" | "C"]]> = [
    [["Direto ao ponto", "D"], ["Divertido em grupo", "I"]],
    [["Paciente com pessoas", "S"], ["Detalhista com dados", "C"]],
    [["Gosto de comandar", "D"], ["Gosto de acolher", "S"]],
    [["Falo com entusiasmo", "I"], ["Sigo regras à risca", "C"]],
    [["Assumo riscos", "D"], ["Analiso antes de agir", "C"]],
    [["Convenço pessoas", "I"], ["Escuto antes de opinar", "S"]],
    [["Foco em resultado", "D"], ["Foco em qualidade", "C"]],
    [["Alegro o ambiente", "I"], ["Mantenho a harmonia", "S"]],
    [["Decido rápido", "D"], ["Decido com cuidado", "C"]],
    [["Gosto de novidades", "I"], ["Prefiro rotina", "S"]],
    [["Enfrento conflitos", "D"], ["Evito conflitos", "S"]],
    [["Sou espontâneo", "I"], ["Sou reservado", "C"]],
    [["Impaciente com lentidão", "D"], ["Paciente por natureza", "S"]],
    [["Comunico com humor", "I"], ["Comunico com precisão", "C"]],
    [["Competitivo", "D"], ["Colaborativo", "S"]],
    [["Otimista sempre", "I"], ["Cético saudável", "C"]],
    [["Direto e firme", "D"], ["Diplomático", "S"]],
    [["Persuasivo", "I"], ["Rigoroso", "C"]],
    [["Tomo iniciativa", "D"], ["Aguardo alinhamento", "S"]],
    [["Improviso bem", "I"], ["Planejo tudo", "C"]],
    [["Gosto de mudar as coisas", "D"], ["Gosto de estabilidade", "S"]],
    [["Falo mais que ouço", "I"], ["Ouço mais que falo", "C"]],
    [["Motivo pela pressão", "D"], ["Motivo pelo apoio", "S"]],
    [["Motivo pelo entusiasmo", "I"], ["Motivo pela lógica", "C"]],
  ];
  return pairs.map((p, i) => ({
    id: `p${i + 1}`,
    type: "disc_pair" as const,
    label: `Par ${i + 1}`,
    options: [
      { text: p[0][0], dim: p[0][1] },
      { text: p[1][0], dim: p[1][1] },
    ],
  }));
}

function scoreDisc(answers: Record<string, unknown>, questions: Q[]) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  for (const q of questions) {
    if (q.type !== "disc_pair") continue;
    const val = answers[q.id];
    const chosen = q.options.find((o) => o.text === val);
    if (chosen) counts[chosen.dim] += 1;
  }
  const total = counts.D + counts.I + counts.S + counts.C || 1;
  const pct = {
    D: Math.round((counts.D / total) * 100),
    I: Math.round((counts.I / total) * 100),
    S: Math.round((counts.S / total) * 100),
    C: Math.round((counts.C / total) * 100),
  };
  const primary = (Object.keys(pct) as Array<keyof typeof pct>).sort((a, b) => pct[b] - pct[a])[0];
  return { counts, pct, primary };
}

function summarize(kind: string, answers: Record<string, unknown>, questions: Q[]) {
  const parts: string[] = [];
  for (const q of questions) {
    if (q.type === "scale") {
      const v = answers[q.id];
      if (typeof v === "number") parts.push(`${q.label} → ${v}/5`);
    } else if (q.type === "text") {
      const v = answers[q.id];
      if (typeof v === "string" && v.trim()) parts.push(`${q.label} → "${v.trim().slice(0, 120)}"`);
    } else if (q.type === "choice") {
      const v = answers[q.id];
      if (v) parts.push(`${q.label} → ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
  }
  if (kind === "disc") return "Perfil DISC calculado."; // detail lives in discProfile
  return parts.slice(0, 4).join(" · ");
}

async function ensureSystemTemplates() {
  for (const t of SYSTEM_TEMPLATES) {
    const existing = await prisma.pulseTemplate.findFirst({
      where: { organizationId: null, isSystem: true, kind: t.kind, title: t.title },
    });
    if (!existing) {
      await prisma.pulseTemplate.create({
        data: {
          organizationId: null,
          kind: t.kind,
          title: t.title,
          intro: t.intro,
          questions: t.questions as unknown as object,
          isSystem: true,
        },
      });
    }
  }
}
void ensureSystemTemplates().catch((e) => console.error("[pulses] seed error", e));

// ---------------------- authenticated router ----------------------

export const pulsesRouter = Router();
pulsesRouter.use(requireAuth);

pulsesRouter.param("orgId", async (req, res, next, orgId) => {
  if (!(await assertOrgAccess(req.userId!, orgId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// Templates (system + org custom)
pulsesRouter.get("/:orgId/pulses/templates", async (req, res) => {
  const list = await prisma.pulseTemplate.findMany({
    where: { OR: [{ isSystem: true }, { organizationId: req.params.orgId }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
  });
  res.json(list);
});

// Create custom template
const templateSchema = z.object({
  kind: z.enum(["feedback", "climate", "disc", "custom"]),
  title: z.string().min(2),
  intro: z.string().optional().nullable(),
  questions: z.array(z.any()).min(1),
});

pulsesRouter.post("/:orgId/pulses/templates", async (req, res) => {
  try {
    const d = templateSchema.parse(req.body);
    const created = await prisma.pulseTemplate.create({
      data: {
        organizationId: req.params.orgId,
        kind: d.kind,
        title: d.title,
        intro: d.intro ?? null,
        questions: d.questions as unknown as object,
        isSystem: false,
        createdById: req.userId!,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

pulsesRouter.delete("/:orgId/pulses/templates/:id", async (req, res) => {
  const t = await prisma.pulseTemplate.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId, isSystem: false },
  });
  if (!t) return res.status(404).json({ error: "Not found" });
  await prisma.pulseTemplate.delete({ where: { id: t.id } });
  res.status(204).end();
});

// List sends
pulsesRouter.get("/:orgId/pulses", async (req, res) => {
  const list = await prisma.pulseSend.findMany({
    where: { organizationId: req.params.orgId },
    include: { template: true, answer: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(list);
});

// Create + send
const sendSchema = z.object({
  templateId: z.string().uuid(),
  subjectUserId: z.string().uuid().optional().nullable(),
  subjectLabel: z.string().optional().nullable(),
  subjectPhone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(60).default(7),
});

pulsesRouter.post("/:orgId/pulses", async (req, res) => {
  try {
    const d = sendSchema.parse(req.body);
    const template = await prisma.pulseTemplate.findFirst({
      where: {
        id: d.templateId,
        OR: [{ isSystem: true }, { organizationId: req.params.orgId }],
      },
    });
    if (!template) return res.status(404).json({ error: "Template not found" });

    let subjectLabel = d.subjectLabel ?? null;
    let subjectPhone = d.subjectPhone ?? null;
    if (d.subjectUserId) {
      const profile = await prisma.profile.findUnique({ where: { id: d.subjectUserId } });
      if (profile) {
        subjectLabel = subjectLabel ?? profile.fullName;
        subjectPhone = subjectPhone ?? profile.whatsapp ?? profile.phone;
      }
    }

    const token = genToken();
    const expiresAt = new Date(Date.now() + d.expiresInDays * 24 * 60 * 60 * 1000);
    const created = await prisma.pulseSend.create({
      data: {
        organizationId: req.params.orgId,
        templateId: template.id,
        senderId: req.userId!,
        subjectUserId: d.subjectUserId ?? null,
        subjectLabel,
        subjectPhone,
        token,
        message: d.message ?? null,
        expiresAt,
      },
      include: { template: true },
    });
    res.status(201).json(created);
  } catch (err) {
    badReq(res, err);
  }
});

// Revoke
pulsesRouter.patch("/:orgId/pulses/:id/revoke", async (req, res) => {
  const s = await prisma.pulseSend.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!s) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.pulseSend.update({
    where: { id: s.id },
    data: { status: "revoked" },
  });
  res.json(updated);
});

pulsesRouter.delete("/:orgId/pulses/:id", async (req, res) => {
  const s = await prisma.pulseSend.findFirst({
    where: { id: req.params.id, organizationId: req.params.orgId },
  });
  if (!s) return res.status(404).json({ error: "Not found" });
  await prisma.pulseSend.delete({ where: { id: s.id } });
  res.status(204).end();
});

// ---------------------- PUBLIC router (no auth) ----------------------

export const publicPulsesRouter = Router();

publicPulsesRouter.get("/pulse/:token", async (req, res) => {
  const s = await prisma.pulseSend.findUnique({
    where: { token: req.params.token },
    include: { template: true, answer: true },
  });
  if (!s) return res.status(404).json({ error: "Link inválido." });
  if (s.status === "revoked") return res.status(410).json({ error: "Este link foi cancelado." });
  if (s.answeredAt || s.status === "answered")
    return res.status(410).json({ error: "Esta pesquisa já foi respondida." });
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.pulseSend.update({ where: { id: s.id }, data: { status: "expired" } }).catch(() => null);
    return res.status(410).json({ error: "Este link expirou." });
  }

  // fetch sender name for context
  const sender = await prisma.profile.findUnique({ where: { id: s.senderId } });
  res.json({
    id: s.id,
    token: s.token,
    subjectLabel: s.subjectLabel,
    message: s.message,
    senderName: sender?.fullName ?? "Seu líder",
    template: {
      kind: s.template.kind,
      title: s.template.title,
      intro: s.template.intro,
      questions: s.template.questions,
    },
    expiresAt: s.expiresAt,
  });
});

const submitSchema = z.object({
  answers: z.record(z.string(), z.any()),
});

publicPulsesRouter.post("/pulse/:token", async (req, res) => {
  try {
    const { answers } = submitSchema.parse(req.body);
    const s = await prisma.pulseSend.findUnique({
      where: { token: req.params.token },
      include: { template: true },
    });
    if (!s) return res.status(404).json({ error: "Link inválido." });
    if (s.status !== "pending") return res.status(410).json({ error: "Link não está mais disponível." });
    if (s.expiresAt.getTime() < Date.now())
      return res.status(410).json({ error: "Link expirado." });

    const qs = (s.template.questions as unknown as Q[]) ?? [];
    // required check
    for (const q of qs) {
      if ("required" in q && q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") {
          return res.status(400).json({ error: `Responda: ${q.label}` });
        }
      }
    }

    const discProfile = s.template.kind === "disc" ? scoreDisc(answers, qs) : null;
    const summary = summarize(s.template.kind, answers, qs);

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    await prisma.$transaction([
      prisma.pulseAnswer.create({
        data: {
          sendId: s.id,
          answers: answers as unknown as object,
          aiSummary: summary || null,
          discProfile: (discProfile as unknown as object) ?? undefined,
          respondentIp: ip,
          userAgent: (req.headers["user-agent"] as string | undefined)?.slice(0, 200) ?? null,
        },
      }),
      prisma.pulseSend.update({
        where: { id: s.id },
        data: { status: "answered", answeredAt: new Date() },
      }),
    ]);

    // Notify sender
    void notifyInApp({
      userId: s.senderId,
      organizationId: s.organizationId,
      title: `Resposta recebida — ${s.template.title}`,
      body: (s.subjectLabel ?? "Um liderado") + " respondeu sua pesquisa.",
      linkUrl: "/app/pulses",
    }).catch(() => null);

    res.json({ ok: true });
  } catch (err) {
    badReq(res, err);
  }
});
