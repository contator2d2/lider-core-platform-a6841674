/**
 * Teste de Avaliação Comportamental — Dominância Cerebral (Ned Herrmann).
 * 25 perguntas de escolha única, cada alternativa vinculada a um quadrante:
 *  A = Analítico (lógico, racional, orientado a resultado)
 *  B = Organizado (sequencial, planejador, controlador)
 *  C = Relacional (emocional, interpessoal, colaborativo)
 *  D = Experimental (criativo, visionário, explorador)
 */

export type HerrmannQuadrant = "A" | "B" | "C" | "D";
export type HerrmannItem = { prompt: string; options: Array<{ label: string; quadrant: HerrmannQuadrant }> };

export const HERRMANN_SLUG = "dominancia-cerebral-herrmann";

export const HERRMANN_QUADRANTS: Record<HerrmannQuadrant, { name: string; short: string; description: string }> = {
  A: {
    name: "Analítico (Racional)",
    short: "Analítico",
    description: "Lógica, fatos, números, foco em resultado, decisão rápida e objetiva.",
  },
  B: {
    name: "Organizado (Sequencial)",
    short: "Organizado",
    description: "Planejamento, disciplina, processos, detalhe, previsibilidade e controle.",
  },
  C: {
    name: "Relacional (Emocional)",
    short: "Relacional",
    description: "Pessoas, empatia, colaboração, escuta, clima e construção de vínculos.",
  },
  D: {
    name: "Experimental (Criativo)",
    short: "Experimental",
    description: "Visão de futuro, ideias, inovação, liberdade, tolerância à ambiguidade.",
  },
};

export const HERRMANN_BLOCK_TITLE = "Dominância cerebral — 25 questões";
export const HERRMANN_BLOCK_DESCRIPTION =
  "Escolha em cada questão a alternativa que mais se parece com você. Não existe resposta certa ou errada — responda com espontaneidade.";
export const HERRMANN_HELP = "Selecione apenas uma alternativa.";

export const HERRMANN_ITEMS: HerrmannItem[] = [
  { prompt: "Eu sou...", options: [
    { label: "Idealista, criativo e visionário", quadrant: "D" },
    { label: "Divertido, espiritual e benéfico", quadrant: "C" },
    { label: "Confiável, meticuloso e previsível", quadrant: "B" },
    { label: "Focado, determinado e persistente", quadrant: "A" },
  ]},
  { prompt: "Eu gosto de...", options: [
    { label: "Ser piloto", quadrant: "A" },
    { label: "Conversar com os passageiros", quadrant: "C" },
    { label: "Planejar a viagem", quadrant: "B" },
    { label: "Explorar novas rotas", quadrant: "D" },
  ]},
  { prompt: "Se você quiser se dar bem comigo...", options: [
    { label: "Me dê liberdade", quadrant: "D" },
    { label: "Me deixa saber sua expectativa", quadrant: "B" },
    { label: "Lidere, siga ou saia do caminho", quadrant: "A" },
    { label: "Seja amigável, carinhoso e compreensível", quadrant: "C" },
  ]},
  { prompt: "Para conseguir obter bons resultados é preciso...", options: [
    { label: "Ter incertezas", quadrant: "D" },
    { label: "Controlar o essencial", quadrant: "A" },
    { label: "Diversão e celebração", quadrant: "C" },
    { label: "Planejar e obter recursos", quadrant: "B" },
  ]},
  { prompt: "Eu me divirto quando...", options: [
    { label: "Estou me exercitando", quadrant: "A" },
    { label: "Tenho novidades", quadrant: "D" },
    { label: "Estou com os outros", quadrant: "C" },
    { label: "Determino regras", quadrant: "B" },
  ]},
  { prompt: "Eu penso que...", options: [
    { label: "Unidos venceremos, divididos perderemos", quadrant: "C" },
    { label: "O ataque é a melhor defesa", quadrant: "A" },
    { label: "É bom ser manso, mas andar com um porrete", quadrant: "D" },
    { label: "O homem prevenido vale por dois", quadrant: "B" },
  ]},
  { prompt: "Minha preocupação é...", options: [
    { label: "Gerar a ideia global", quadrant: "D" },
    { label: "Fazer com que as pessoas gostem", quadrant: "C" },
    { label: "Fazer com que funcione", quadrant: "B" },
    { label: "Fazer com que aconteça", quadrant: "A" },
  ]},
  { prompt: "Eu prefiro...", options: [
    { label: "Perguntas a respostas", quadrant: "D" },
    { label: "Ter todos os detalhes", quadrant: "B" },
    { label: "Vantagens a meu favor", quadrant: "A" },
    { label: "Que todos tenham a chance de serem ouvidos", quadrant: "C" },
  ]},
  { prompt: "Eu gosto de...", options: [
    { label: "Fazer progresso", quadrant: "A" },
    { label: "Construir memórias", quadrant: "D" },
    { label: "Fazer sentido", quadrant: "B" },
    { label: "Tornar as pessoas confortáveis", quadrant: "C" },
  ]},
  { prompt: "Eu gosto de chegar...", options: [
    { label: "Na frente", quadrant: "A" },
    { label: "Junto", quadrant: "C" },
    { label: "Na hora", quadrant: "B" },
    { label: "Em outro lugar", quadrant: "D" },
  ]},
  { prompt: "Um ótimo dia para mim é quando...", options: [
    { label: "Consigo fazer muitas coisas", quadrant: "A" },
    { label: "Me divirto com meus amigos", quadrant: "C" },
    { label: "Tudo segue conforme o planejado", quadrant: "B" },
    { label: "Desfruto de coisas novas e estimulantes", quadrant: "D" },
  ]},
  { prompt: "Eu vejo a morte como...", options: [
    { label: "Uma grande aventura misteriosa", quadrant: "D" },
    { label: "Oportunidade para rever falecidos", quadrant: "C" },
    { label: "Um modo de receber recompensas", quadrant: "B" },
    { label: "Algo que sempre chega muito cedo", quadrant: "A" },
  ]},
  { prompt: "Minha filosofia de vida é...", options: [
    { label: "Há ganhadores e perdedores, e eu acredito ser um ganhador", quadrant: "A" },
    { label: "Para ganhar, ninguém precisa perder", quadrant: "C" },
    { label: "Para ganhar é preciso seguir as regras", quadrant: "B" },
    { label: "Para ganhar, é necessário inventar novas regras", quadrant: "D" },
  ]},
  { prompt: "Eu sempre gostei de...", options: [
    { label: "Explorar", quadrant: "D" },
    { label: "Evitar surpresas", quadrant: "B" },
    { label: "Focalizar a meta", quadrant: "A" },
    { label: "Realizar a abordagem natural", quadrant: "C" },
  ]},
  { prompt: "Eu gosto de mudanças se...", options: [
    { label: "Me der uma vantagem competitiva", quadrant: "A" },
    { label: "For divertido e puder ser compartilhado", quadrant: "C" },
    { label: "Me der mais liberdade e variedade", quadrant: "D" },
    { label: "Melhorar ou me der mais controle", quadrant: "B" },
  ]},
  { prompt: "Não existe nada errado em...", options: [
    { label: "Se colocar na frente", quadrant: "A" },
    { label: "Colocar os outros na frente", quadrant: "C" },
    { label: "Mudar de ideia", quadrant: "D" },
    { label: "Ser consistente", quadrant: "B" },
  ]},
  { prompt: "Eu gosto de buscar conselhos de...", options: [
    { label: "Pessoas bem sucedidas", quadrant: "A" },
    { label: "Anciões e conselheiros", quadrant: "C" },
    { label: "Autoridades no assunto", quadrant: "B" },
    { label: "Lugares, os mais estranhos", quadrant: "D" },
  ]},
  { prompt: "Meu lema é...", options: [
    { label: "Fazer o que precisar ser feito", quadrant: "A" },
    { label: "Fazer bem feito", quadrant: "B" },
    { label: "Fazer junto com grupo", quadrant: "C" },
    { label: "Simplesmente fazer", quadrant: "D" },
  ]},
  { prompt: "Eu gosto de...", options: [
    { label: "Complexidade, mesmo se confuso", quadrant: "D" },
    { label: "Ordem e sistematização", quadrant: "B" },
    { label: "Calor humano e animação", quadrant: "C" },
    { label: "Coisas claras e simples", quadrant: "A" },
  ]},
  { prompt: "O tempo para mim é...", options: [
    { label: "Algo que detesto desperdiçar", quadrant: "A" },
    { label: "Um grande ciclo", quadrant: "C" },
    { label: "Uma flecha que leva ao inevitável", quadrant: "B" },
    { label: "Irrelevante", quadrant: "D" },
  ]},
  { prompt: "Se eu fosse bilionário...", options: [
    { label: "Faria doações para entidades", quadrant: "C" },
    { label: "Criaria uma poupança avantajada", quadrant: "B" },
    { label: "Faria o que desse na cabeça", quadrant: "D" },
    { label: "Exibiria bastante com algumas pessoas", quadrant: "A" },
  ]},
  { prompt: "Eu acredito que...", options: [
    { label: "O destino é mais importante que a jornada", quadrant: "A" },
    { label: "A jornada é mais importante que o destino", quadrant: "C" },
    { label: "Um centavo economizado é um centavo ganho", quadrant: "B" },
    { label: "Bastam um navio e uma estrela para navegar", quadrant: "D" },
  ]},
  { prompt: "Eu acredito também que...", options: [
    { label: "Aquele que hesita está perdido", quadrant: "A" },
    { label: "De grão em grão a galinha enche o papo", quadrant: "B" },
    { label: "O que vai, volta", quadrant: "C" },
    { label: "Um sorriso ou uma careta é o mesmo para quem é cego", quadrant: "D" },
  ]},
  { prompt: "Eu acredito ainda que...", options: [
    { label: "É melhor prudência do que arrependimento", quadrant: "B" },
    { label: "A autoridade deve ser desafiada", quadrant: "D" },
    { label: "Ganhar é fundamental", quadrant: "A" },
    { label: "O coletivo é mais importante do que o individual", quadrant: "C" },
  ]},
  { prompt: "Eu penso que...", options: [
    { label: "Não é fácil ficar encurralado", quadrant: "D" },
    { label: "É preferível olhar, antes de pular", quadrant: "B" },
    { label: "Duas cabeças pensam melhor do que uma", quadrant: "C" },
    { label: "Se você não tem condições de competir, não compita", quadrant: "A" },
  ]},
];

export function isHerrmannAssessment(slug: string | null | undefined) {
  return (slug ?? "").startsWith(HERRMANN_SLUG);
}

// ------------------------------------------------------------
// Modo de ativação C.O.R.E. — nome prático em cima do quadrante
// A (analítico/resultado) → Tubarão
// B (organizador/processo) → Lobo
// C (relacional/pessoas)   → Gato
// D (visão/estratégia)     → Águia
// ------------------------------------------------------------
export type ActivationMode = "aguia" | "lobo" | "gato" | "tubarao";

export const ACTIVATION_BY_QUADRANT: Record<HerrmannQuadrant, ActivationMode> = {
  A: "tubarao",
  B: "lobo",
  C: "gato",
  D: "aguia",
};

export const ACTIVATION_MODES: Record<ActivationMode, { name: string; description: string }> = {
  aguia: {
    name: "Águia",
    description:
      "Ativa pela visão: enxerga o todo, conecta cenários e antecipa movimentos. Cuidado com a distância do chão da operação.",
  },
  lobo: {
    name: "Lobo",
    description:
      "Ativa pelo método: organiza, cria ritmo e faz o time andar em ordem. Cuidado com rigidez e excesso de controle.",
  },
  gato: {
    name: "Gato",
    description:
      "Ativa pela relação: lê o clima, cuida das pessoas e sustenta a confiança. Cuidado com evitar conversas duras.",
  },
  tubarao: {
    name: "Tubarão",
    description:
      "Ativa pelo resultado: decide rápido, cobra e vai direto ao alvo. Cuidado com atropelar pessoas e contexto.",
  },
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const QUADRANT_BY_LABEL = new Map<string, HerrmannQuadrant>();
for (const item of HERRMANN_ITEMS) {
  for (const opt of item.options) QUADRANT_BY_LABEL.set(normalize(opt.label), opt.quadrant);
}

export type HerrmannScore = {
  kind: "herrmann_dominance";
  answered: number;
  counts: Record<HerrmannQuadrant, number>;
  percents: Record<HerrmannQuadrant, number>;
  dominant: HerrmannQuadrant | null;
  dominantName: string | null;
  activationMode: ActivationMode | null;
  activationName: string | null;
  activationDescription: string | null;
  profile: string;
  ranking: Array<{ quadrant: HerrmannQuadrant; name: string; count: number; percent: number }>;
  breakdown: Array<{ emotion: string; polarity: "positive" | "negative"; value: number }>;
};

/** Calcula a dominância cerebral a partir das respostas (questionId -> value/label). */
export function scoreHerrmann(
  questions: Array<{ id: string; prompt: string; options?: Array<{ id: string; label: string; value: string }> }>,
  answers: Record<string, unknown>,
): HerrmannScore | null {
  const counts: Record<HerrmannQuadrant, number> = { A: 0, B: 0, C: 0, D: 0 };
  let answered = 0;

  for (const q of questions) {
    const raw = answers[q.id];
    if (raw == null || raw === "") continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      const str = String(v);
      let quadrant: HerrmannQuadrant | undefined;
      if (/^[ABCD]$/.test(str.trim().toUpperCase())) quadrant = str.trim().toUpperCase() as HerrmannQuadrant;
      if (!quadrant) {
        const opt = (q.options ?? []).find((o) => o.id === str || o.value === str || o.label === str);
        const candidate = opt?.value?.trim().toUpperCase();
        if (candidate && /^[ABCD]$/.test(candidate)) quadrant = candidate as HerrmannQuadrant;
        else if (opt) quadrant = QUADRANT_BY_LABEL.get(normalize(opt.label));
        else quadrant = QUADRANT_BY_LABEL.get(normalize(str));
      }
      if (!quadrant) continue;
      counts[quadrant] += 1;
      answered += 1;
    }
  }

  if (answered === 0) return null;

  const pct = (n: number) => Number(((n / answered) * 100).toFixed(1));
  const percents: Record<HerrmannQuadrant, number> = { A: pct(counts.A), B: pct(counts.B), C: pct(counts.C), D: pct(counts.D) };

  const ranking = (Object.keys(counts) as HerrmannQuadrant[])
    .map((q) => ({ quadrant: q, name: HERRMANN_QUADRANTS[q].short, count: counts[q], percent: percents[q] }))
    .sort((a, b) => b.count - a.count);

  const dominant = ranking[0].count > 0 ? ranking[0].quadrant : null;
  const activationMode = dominant ? ACTIVATION_BY_QUADRANT[dominant] : null;
  const activation = activationMode ? ACTIVATION_MODES[activationMode] : null;
  const strong = ranking.filter((r) => r.percent >= 25).map((r) => r.quadrant);
  const profile =
    strong.length >= 3
      ? `Perfil múltiplo (${strong.join("+")}) — pensamento equilibrado entre vários quadrantes`
      : strong.length === 2
        ? `Perfil duplo ${strong[0]}+${strong[1]} — ${HERRMANN_QUADRANTS[strong[0]].short} com ${HERRMANN_QUADRANTS[strong[1]].short}`
        : dominant
          ? `Dominância única ${dominant} — ${HERRMANN_QUADRANTS[dominant].name}`
          : "Sem dominância identificada";

  return {
    kind: "herrmann_dominance",
    answered,
    counts,
    percents,
    dominant,
    dominantName: dominant ? HERRMANN_QUADRANTS[dominant].name : null,
    activationMode,
    activationName: activation?.name ?? null,
    activationDescription: activation?.description ?? null,
    profile: activation ? `Modo de ativação: ${activation.name} · ${profile}` : profile,
    ranking,
    breakdown: ranking.map((r) => ({
      emotion: `${r.quadrant} · ${r.name} (${r.percent}%)`,
      polarity: "positive" as const,
      value: r.count,
    })),
  };
}
