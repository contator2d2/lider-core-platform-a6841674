import { prisma } from "../prisma.js";
import {
  POSITIVITY_BLOCK_DESCRIPTION,
  POSITIVITY_BLOCK_TITLE,
  POSITIVITY_HELP,
  POSITIVITY_ITEMS,
  POSITIVITY_SLUG,
} from "./positivity.js";
import {
  HERRMANN_BLOCK_DESCRIPTION,
  HERRMANN_BLOCK_TITLE,
  HERRMANN_HELP,
  HERRMANN_ITEMS,
  HERRMANN_SLUG,
} from "./herrmann.js";
import { DISC_BLOCK_DESCRIPTION, DISC_BLOCK_TITLE, DISC_HELP, DISC_ITEMS, DISC_SLUG } from "./disc.js";
import { RADAR_HSH_BLOCKS, RADAR_HSH_HELP, RADAR_HSH_SLUG } from "./radar-hsh.js";

/**
 * Garante que os assessments canônicos da metodologia existam no banco.
 * Roda no boot da API — nunca exige criação manual.
 */
export async function bootstrapCoreAssessments() {
  await bootstrapPositivity();
  await bootstrapHerrmann();
  await bootstrapDisc();
  await bootstrapRadarHsh();
}

async function bootstrapPositivity() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: POSITIVITY_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: POSITIVITY_SLUG,
          name: "Quociente Positivo",
          objective:
            "Medir a razão entre emoções positivas e negativas vividas nas últimas 24 horas (Positivity Ratio de Barbara Fredrickson) e acompanhar a evolução do estado emocional do líder.",
          audience: "Líderes e liderados",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 4,
          frequency: "diario",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some((b) => b._count.questions > 0);
    if (hasQuestions) return;

    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: assessment.id,
        title: POSITIVITY_BLOCK_TITLE,
        description: POSITIVITY_BLOCK_DESCRIPTION,
        orderIndex: 0,
      },
    });

    await prisma.assessmentQuestion.createMany({
      data: POSITIVITY_ITEMS.map((item, index) => ({
        blockId: block.id,
        type: "likert" as const,
        prompt: item.prompt,
        helpText: POSITIVITY_HELP,
        required: true,
        weight: 1,
        scaleMin: 1,
        scaleMax: 5,
        orderIndex: index,
      })),
    });

    console.log(`[bootstrap] assessment "Quociente Positivo" garantido (${POSITIVITY_ITEMS.length} itens)`);
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessments canônicos", err);
  }
}

async function bootstrapHerrmann() {
  try {
    const existing = await prisma.assessment.findUnique({
      where: { slug: HERRMANN_SLUG },
      include: { blocks: { include: { _count: { select: { questions: true } } } } },
    });

    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          slug: HERRMANN_SLUG,
          name: "Dominância Cerebral (Herrmann)",
          objective:
            "Avaliação comportamental baseada no modelo de dominância cerebral de Ned Herrmann: identifica a preferência de pensamento do líder entre os quadrantes Analítico, Organizado, Relacional e Experimental.",
          audience: "Líderes e liderados",
          competency: "Autoconhecimento",
          category: "Consciência",
          coreModule: "C",
          estimatedTime: 10,
          frequency: "semestral",
          status: "active",
        },
        include: { blocks: { include: { _count: { select: { questions: true } } } } },
      }));

    const hasQuestions = (assessment.blocks ?? []).some((b) => b._count.questions > 0);
    if (hasQuestions) return;

    const block = await prisma.assessmentBlock.create({
      data: {
        assessmentId: assessment.id,
        title: HERRMANN_BLOCK_TITLE,
        description: HERRMANN_BLOCK_DESCRIPTION,
        orderIndex: 0,
      },
    });

    for (const [index, item] of HERRMANN_ITEMS.entries()) {
      await prisma.assessmentQuestion.create({
        data: {
          blockId: block.id,
          type: "unica",
          prompt: `${index + 1}) ${item.prompt}`,
          helpText: HERRMANN_HELP,
          required: true,
          weight: 1,
          orderIndex: index,
          options: {
            create: item.options.map((opt, i) => ({
              label: opt.label,
              value: opt.quadrant,
              score: 1,
              orderIndex: i,
            })),
          },
        },
      });
    }

    console.log(`[bootstrap] assessment "Dominância Cerebral (Herrmann)" garantido (${HERRMANN_ITEMS.length} questões)`);
  } catch (err) {
    console.error("[bootstrap] falha ao garantir assessment Herrmann", err);
  }
}
