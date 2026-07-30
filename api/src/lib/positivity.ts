/**
 * Quociente Positivo (Positivity Ratio — Barbara Fredrickson).
 * Escala 1..5 (Nem um pouco -> Extremamente) sobre as ultimas 24h.
 * Metodo original: conta itens positivos e negativos marcados com grau >= 3
 * (moderadamente ou mais) e divide positivos / negativos.
 */

export type PositivityItem = { prompt: string; polarity: "positive" | "negative"; emotion: string };

export const POSITIVITY_SLUG = "quociente-positivo";

export const POSITIVITY_ITEMS: PositivityItem[] = [
  { emotion: "Interesse", polarity: "positive", prompt: "Em que grau você se sentiu intrigado, encantado ou fascinado?" },
  { emotion: "Estresse", polarity: "negative", prompt: "Em que grau você se sentiu preocupado, ansioso ou estressado?" },
  { emotion: "Amor", polarity: "positive", prompt: "Em que grau você sentiu carinho, compaixão ou amor?" },
  { emotion: "Culpa", polarity: "negative", prompt: "Em que grau você se sentiu culpado, com remorso ou arrependido?" },
  { emotion: "Diversão", polarity: "positive", prompt: "Em que grau você se sentiu brincalhão, apreciador de diversão ou despreocupado?" },
  { emotion: "Medo", polarity: "negative", prompt: "Em que grau você sentiu medo, temor ou pavor?" },
  { emotion: "Admiração", polarity: "positive", prompt: "Em que grau você sentiu assombro, espanto ou admiração?" },
  { emotion: "Aversão", polarity: "negative", prompt: "Em que grau você sentiu ódio, desconfiança ou aversão?" },
  { emotion: "Inspiração", polarity: "positive", prompt: "Em que grau você sentiu inspiração, fascinação ou empolgação?" },
  { emotion: "Desprezo", polarity: "negative", prompt: "Em que grau você sentiu desdém, escárnio ou desprezo?" },
  { emotion: "Confiança", polarity: "positive", prompt: "Em que grau você se sentiu confiante, seguro e teve certeza?" },
  { emotion: "Defensividade", polarity: "negative", prompt: "Em que grau você se sentiu na defensiva, ressentido ou com autopiedade?" },
];

export const POSITIVITY_HELP =
  "Escala: 1 Nem um pouco · 2 Um pouco · 3 Moderadamente · 4 Muito · 5 Extremamente";

export const POSITIVITY_BLOCK_TITLE = "Sentimentos — últimas 24h";
export const POSITIVITY_BLOCK_DESCRIPTION =
  "Deste mesmo horário ontem até agora, qual é o maior grau que você teve os sentimentos a seguir?";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const POLARITY_BY_PROMPT = new Map(POSITIVITY_ITEMS.map((i) => [normalize(i.prompt), i] as const));

export type PositivityScore = {
  kind: "positivity_ratio";
  ratio: number | null;
  positiveHits: number;
  negativeHits: number;
  positiveAvg: number;
  negativeAvg: number;
  band: "florescimento" | "equilibrio" | "atencao" | "risco";
  breakdown: Array<{ emotion: string; polarity: "positive" | "negative"; value: number }>;
};

export function isPositivityAssessment(slug: string | null | undefined) {
  return (slug ?? "").startsWith(POSITIVITY_SLUG);
}

/** Calcula o quociente a partir das respostas cruas (questionId -> valor). */
export function scorePositivity(
  questions: Array<{ id: string; prompt: string }>,
  answers: Record<string, unknown>,
): PositivityScore | null {
  const breakdown: PositivityScore["breakdown"] = [];
  let posSum = 0;
  let posCount = 0;
  let negSum = 0;
  let negCount = 0;
  let posHits = 0;
  let negHits = 0;

  for (const q of questions) {
    const item = POLARITY_BY_PROMPT.get(normalize(q.prompt));
    if (!item) continue;
    const raw = answers[q.id];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) continue;
    breakdown.push({ emotion: item.emotion, polarity: item.polarity, value });
    if (item.polarity === "positive") {
      posSum += value;
      posCount += 1;
      if (value >= 3) posHits += 1;
    } else {
      negSum += value;
      negCount += 1;
      if (value >= 3) negHits += 1;
    }
  }

  if (posCount === 0 && negCount === 0) return null;

  const ratio = negHits > 0 ? Number((posHits / negHits).toFixed(2)) : posHits > 0 ? null : 0;
  const effective = ratio ?? 99;
  const band: PositivityScore["band"] =
    effective >= 3 ? "florescimento" : effective >= 2 ? "equilibrio" : effective >= 1 ? "atencao" : "risco";

  return {
    kind: "positivity_ratio",
    ratio,
    positiveHits: posHits,
    negativeHits: negHits,
    positiveAvg: posCount ? Number((posSum / posCount).toFixed(2)) : 0,
    negativeAvg: negCount ? Number((negSum / negCount).toFixed(2)) : 0,
    band,
    breakdown,
  };
}
