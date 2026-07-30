/**
 * Inteligência Neo → contexto para a IA.
 *
 * Toda chamada de IA do app (coach, notas, reuniões, briefings) recebe este
 * bloco: metodologia oficial, competências, playbooks, templates, assessments
 * e jornadas ativas. Assim a IA "sabe tudo" o que o admin cadastrou em
 * Neo · Inteligência, sem precisar repetir prompt em cada tela.
 */
import { prisma } from "../prisma.js";

let cache: { text: string; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

function clip(s: string | null | undefined, max = 280) {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export async function buildNeoContext(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const [items, knowledge, templates, assessments, journeys, competencies, doc] = await Promise.all([
    prisma.methodologyItem.findMany({
      where: { status: "active" },
      orderBy: [{ type: "asc" }, { orderIndex: "asc" }],
      take: 250,
    }).catch(() => []),
    prisma.knowledgeItem.findMany({ where: { status: "active" }, take: 80 }).catch(() => []),
    prisma.template.findMany({ where: { status: "active" }, take: 60 }).catch(() => []),
    prisma.assessment.findMany({ where: { status: "active" }, take: 40 }).catch(() => []),
    prisma.journey.findMany({
      where: { status: "active" },
      include: { steps: { orderBy: { orderIndex: "asc" }, take: 30 } },
      take: 20,
    }).catch(() => []),
    prisma.methodologyCompetency.findMany({ where: { active: true }, take: 60 }).catch(() => []),
    prisma.methodologyDoc.findFirst().catch(() => null),
  ]);

  const lines: string[] = [];
  lines.push("# Inteligência Neo — metodologia oficial do Líder C.O.R.E.");
  lines.push(
    "Use SOMENTE esta metodologia como referência conceitual. Se algo não estiver aqui, diga que ainda não faz parte da metodologia cadastrada.",
  );

  const byType = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byType.get(it.type) ?? [];
    arr.push(it);
    byType.set(it.type, arr);
  }
  for (const [type, arr] of byType) {
    lines.push(`\n## ${type}`);
    for (const it of arr) {
      lines.push(`- ${it.name}${it.category ? ` (${it.category})` : ""}: ${clip(it.description)}${it.objective ? ` | objetivo: ${clip(it.objective, 160)}` : ""}`);
    }
  }

  if (competencies.length) {
    lines.push("\n## competências (catálogo legado)");
    for (const c of competencies) {
      lines.push(
        `- ${c.name}: ${clip(c.description)}` +
          (c.behaviors?.length ? ` | comportamentos: ${c.behaviors.slice(0, 5).join("; ")}` : "") +
          (c.guidingQuestions?.length ? ` | perguntas-guia: ${c.guidingQuestions.slice(0, 3).join("; ")}` : ""),
      );
    }
  }

  if (knowledge.length) {
    lines.push("\n## base de conhecimento (playbooks, artigos, scripts)");
    for (const k of knowledge) {
      lines.push(`- [${k.kind}] ${k.title}${k.category ? ` (${k.category})` : ""}: ${clip(k.summary, 400)}`);
    }
  }

  if (doc) {
    lines.push("\n## identidade da metodologia");
    if (doc.mission) lines.push(`- Missão: ${clip(doc.mission, 400)}`);
    if (doc.vision) lines.push(`- Visão: ${clip(doc.vision, 400)}`);
    if (doc.manifesto) lines.push(`- Manifesto: ${clip(doc.manifesto, 600)}`);
    if (doc.leaderProfile) lines.push(`- Perfil do líder C.O.R.E.: ${clip(doc.leaderProfile, 600)}`);
    if (doc.principles?.length) lines.push(`- Princípios: ${doc.principles.join(" · ")}`);
    if (doc.aiSystemPrompt) lines.push(`- Orientação oficial à IA: ${clip(doc.aiSystemPrompt, 900)}`);
  }

  if (templates.length) {
    lines.push("\n## templates oficiais (feedback, PDI, rituais, 1:1)");
    for (const t of templates) lines.push(`- [${t.kind}] ${t.name}: ${clip(t.description, 200)}`);
  }

  if (assessments.length) {
    lines.push("\n## assessments disponíveis");
    for (const a of assessments) lines.push(`- ${a.name}${a.category ? ` (${a.category})` : ""}: ${clip(a.objective, 180)}`);
  }

  if (journeys.length) {
    lines.push("\n## jornadas de desenvolvimento");
    for (const j of journeys) {
      const steps = (j as { steps?: Array<{ title: string }> }).steps ?? [];
      lines.push(`- ${j.name}: ${clip(j.description, 160)}${steps.length ? ` | passos: ${steps.map((s) => s.title).join(" → ")}` : ""}`);
    }
  }

  const text = lines.join("\n");
  cache = { text, at: Date.now() };
  return text;
}

export function invalidateNeoContext() {
  cache = null;
}

/** Mensagem system pronta para injetar em qualquer chamada de IA. */
export async function neoContextMessage(): Promise<{ role: "system"; content: string }> {
  return { role: "system", content: await buildNeoContext() };
}
