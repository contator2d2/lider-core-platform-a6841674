/** Trilha heurística de 4 semanas para o liderado (fallback sem IA). */
export type TrackStep = {
  week: number;
  title: string;
  focus: string;
  practice: string;
  leaderAction: string;
};

export function heuristicTrack(a: {
  memberLabel: string;
  discPrimary: string | null;
  cerebralPrimary: string | null;
  sabotageScores: unknown;
}): TrackStep[] {
  const topSabotage = (() => {
    const s = a.sabotageScores as Record<string, number> | null;
    if (!s) return null;
    const sorted = Object.entries(s).sort((x, y) => y[1] - x[1]);
    return sorted[0]?.[0] ?? null;
  })();

  const discFocus: Record<string, string> = {
    D: "escuta e paciência com o ritmo do time",
    I: "disciplina de método e follow-up",
    S: "posicionamento e conversas difíceis",
    C: "decisão com informação parcial",
  };
  const focus = discFocus[a.discPrimary ?? ""] ?? "consciência do próprio padrão de atuação";

  return [
    {
      week: 1,
      title: "Espelho",
      focus: "Ver o próprio padrão sem julgamento",
      practice: `Registrar 1 situação por dia em que o padrão ${topSabotage ? `"${topSabotage}"` : "dominante"} apareceu.`,
      leaderAction: `Apresentar o resultado do assessment para ${a.memberLabel} em 1:1 e combinar o foco do ciclo.`,
    },
    {
      week: 2,
      title: "Interceptação",
      focus,
      practice: "Escolher 1 situação por dia para agir de forma diferente do impulso automático.",
      leaderAction: "Dar 1 feedback específico sobre uma situação observada nesta semana.",
    },
    {
      week: 3,
      title: "Prática assistida",
      focus: "Transferir o comportamento novo para uma entrega real",
      practice: "Conduzir sozinho 1 entrega/reunião que hoje depende do líder.",
      leaderAction: "Delegar 1 responsabilidade real e acompanhar sem assumir de volta.",
    },
    {
      week: 4,
      title: "Consolidação",
      focus: "Transformar prática em rotina",
      practice: "Escrever o que mudou, o que travou e o próximo compromisso.",
      leaderAction: "Fazer a retrospectiva do ciclo e definir o próximo passo do PDI.",
    },
  ];
}

