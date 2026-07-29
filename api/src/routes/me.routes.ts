import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

/**
 * Rotas do "eu logado" — dados agregados para a Home (Briefing do dia),
 * jornada inicial (onboarding pós mentoria Neo) e importação do CORE DNA.
 *
 * O app do líder deve ser DESACOPLADO da metodologia: essas rotas leem
 * jornadas/assessments criados pelo admin Neo e devolvem o mínimo que a Home
 * precisa exibir.
 */
export const meRouter = Router();
meRouter.use(requireAuth);

// GET /me/home/briefing
// Devolve o "o que precisa da minha atenção hoje?".
meRouter.get("/home/briefing", async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [profile, notifications, dna] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        onboardingCompletedAt: true,
        onboardingSteps: true,
        didNeoMentorship: true,
      },
    }),
    prisma.notification
      .findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => []),
    prisma.leaderDNA
      .findUnique({ where: { userId }, select: { scores: true, strengths: true, improvements: true, updatedAt: true } })
      .catch(() => null),
  ]);

  // Próxima jornada inicial disponível (usada no onboarding pós-mentoria)
  const initialJourney = await prisma.journey
    .findFirst({
      where: { isInitial: true, status: "published" as never },
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, name: true, description: true },
    })
    .catch(() => null);

  res.json({
    generatedAt: new Date().toISOString(),
    greeting: buildGreeting(profile?.fullName ?? null),
    profile: {
      fullName: profile?.fullName ?? null,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      didNeoMentorship: profile?.didNeoMentorship ?? false,
    },
    dna: dna ?? null,
    initialJourney,
    notifications: notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
    })),
    windows: {
      today: startOfDay.toISOString(),
      weekEnd: endOfWeek.toISOString(),
    },
  });
});

function buildGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const first = (name ?? "").trim().split(" ")[0];
  const prefix = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return first ? `${prefix}, ${first}` : prefix;
}

// GET /me/dna — CORE DNA do usuário logado
meRouter.get("/dna", async (req, res) => {
  const dna = await prisma.leaderDNA.findUnique({ where: { userId: req.userId! } });
  res.json({ dna });
});

// POST /me/dna/import — importa DNA já gerado (usuários que fizeram a mentoria Neo)
const importSchema = z.object({
  scores: z.record(z.number()).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  behavioral: z.record(z.unknown()).optional(),
  emotional: z.record(z.unknown()).optional(),
  technical: z.record(z.unknown()).optional(),
  communication: z.record(z.unknown()).optional(),
  source: z.string().optional(),
});

meRouter.post("/dna/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const dna = await prisma.leaderDNA.upsert({
    where: { userId: req.userId! },
    update: {
      scores: (d.scores ?? undefined) as never,
      strengths: d.strengths ?? undefined,
      improvements: d.improvements ?? undefined,
      behavioral: (d.behavioral ?? undefined) as never,
      emotional: (d.emotional ?? undefined) as never,
      technical: (d.technical ?? undefined) as never,
      communication: (d.communication ?? undefined) as never,
    },
    create: {
      userId: req.userId!,
      scores: (d.scores ?? {}) as never,
      strengths: d.strengths ?? [],
      improvements: d.improvements ?? [],
      behavioral: (d.behavioral ?? {}) as never,
      emotional: (d.emotional ?? {}) as never,
      technical: (d.technical ?? {}) as never,
      communication: (d.communication ?? {}) as never,
    },
  });
  await prisma.leaderDNAEvent.create({
    data: {
      dnaId: dna.id,
      kind: "import",
      payload: parsed.data as never,
      source: d.source ?? "manual",
    },
  });
  res.json({ ok: true, dna });
});

// POST /me/onboarding/neo-mentorship — grava se o usuário já fez a mentoria Neo
meRouter.post("/onboarding/neo-mentorship", async (req, res) => {
  const schema = z.object({ did: z.boolean() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid payload" });
  await prisma.profile.upsert({
    where: { id: req.userId! },
    update: { didNeoMentorship: parsed.data.did },
    create: { id: req.userId!, didNeoMentorship: parsed.data.did },
  });
  res.json({ ok: true });
});

// GET /me/journey/initial — jornada inicial publicada + step atual (best-effort)
meRouter.get("/journey/initial", async (_req, res) => {
  const journey = await prisma.journey.findFirst({
    where: { isInitial: true, status: "published" as never },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!journey) return res.json({ journey: null });
  res.json({ journey });
});