import { prisma } from "../prisma.js";
import {
  POSITIVITY_BLOCK_DESCRIPTION,
  POSITIVITY_BLOCK_TITLE,
  POSITIVITY_HELP,
  POSITIVITY_ITEMS,
  POSITIVITY_SLUG,
} from "./positivity.js";

/**
 * Garante que os assessments canônicos da metodologia existam no banco.
 * Roda no boot da API — nunca exige criação manual.
 */
export async function bootstrapCoreAssessments() {
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
