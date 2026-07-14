
# Plano — completar o Líder C.O.R.E. conforme a Especificação Funcional

O documento consolida uma regra de ouro: **o líder registra fatos operacionais; o sistema infere padrões**. Nenhuma tela pode virar formulário de autoavaliação semanal. Todo módulo compartilha a mesma base de dados — os 4 motores são leituras diferentes sobre os mesmos fatos.

## Onde estamos (o que já existe)

- **Fase 1 (Esqueleto operacional)** — pronta: Mapa da área, rituais (feito/pendente/quebrado com regra de 2 ciclos), delegações com os 4 campos obrigatórios, decisões, documentos, Sala de Liderança com drawer e mutations.
- **Fase 2 (Indicadores)** — parcial: rota `/app/indicators` existe como stub, sem cálculo real nem "carga na própria mão".

## O que falta — construído em fases validáveis

### Fase 2 — Camada de Indicadores (Módulo R)
Cumprir a seção 5 da spec.
- Modelo `Indicator` em 3 níveis (`area` / `team` / `leadership`) com: nome, unidade, meta, tipo (maior=melhor / menor=melhor), owner opcional (pessoa), área.
- Modelo `IndicatorReading` mensal (valor, período, fonte: manual/importado).
- Cálculo automático do **Indicador de Concentração** ("carga na própria mão"): `% delegações ativas cujo owner = próprio líder`. Limiar 30% dispara sinal.
- Import CSV simples como fallback (a spec pede integração externa como ideal; CSV é o fallback aceito).
- Tela `/app/indicators`: painel por nível, cards com farol dentro/fora da meta, comparação mês a mês, alerta de concentração.
- Sinais novos alimentando a Sala de Liderança: "indicador fora da meta há 2 meses", "concentração > 30%".

### Fase 3 — Consciência (Módulo C) + Cruzamentos
Cumprir seção 3.
- Modelo `LeaderProfile` por membership: papel declarado, assessment (Big Five ou DISC — armazenar tipo + traços/percentis), sabotadores ativos (lista), estilo de comunicação (egograma), atualizado a cada 90 dias.
- Modelo `MentorshipCommitment`: frase, data de revisão, status.
- **Regra de visibilidade rígida**: perfil detalhado só o próprio líder vê. Empresa vê apenas *existência* do perfil (sim/não). RLS/guards no backend.
- Tela `/app/consciencia` (renomear/estender `/app/ai` ou criar): perfil resumido (1 força, 1 risco), compromissos ativos, **alertas cruzados**.
- **Motor de alertas cruzados** (regra fixa Fase 3): `perfil_risco[controle] + rituais caíram >30% em 14d → alerta`. `perfil_risco[evita_conflito] + delegação atrasada 2x mesmo owner → alerta`. `perfil_risco[cobrança_dura] + rotatividade/participação em queda → alerta`. Sempre com dado objetivo + leitura comportamental.

### Fase 4 — Evolução (Módulo E) + Dashboard Executivo
Cumprir seções 6 e 7.
- **Score de sustentação** por líder, calculado (não pedido):
  - 35% adesão a rituais (30d)
  - 35% cumprimento de delegações no prazo
  - 30% indicadores dentro da meta
- Histórico mensal em `LeadershipScoreSnapshot`.
- **Leitura diagnóstica automática**: sempre que o score cair, gerar frase apontando módulo de origem ("A queda acompanha rituais quebrados com X e atraso de Y — problema de cadência, não de indicador"). Sem número solto.
- Tela `/app/evolution`: score atual + tendência 6 meses + leitura diagnóstica + plano de ação (compromissos da mentoria).
- **Dashboard Executivo** (`/company/leadership` para roles de empresa/RH):
  - Score por líder/área com evolução mês a mês
  - Mapa de risco agregado (rituais quebrados recorrentes, concentração alta, atraso sistemático)
  - Nível de maturidade 1–5 (aqui **sim**, só como agregado organizacional)
  - Adesão ao programa (% mapa completo, % assessment feito)
  - **Nunca**: conteúdo de perfil individual, decisões/feedbacks textuais.

### Módulos-satélite alinhados à spec
- **Tela 6 — Feedback e Conversas Difíceis** (`/app/feedbacks`): modelos prontos (positivo, corretivo, alinhamento, cobrança, conflito, desligamento, reconhecimento) na estrutura Fato → Impacto → Expectativa → Combinado → Prazo → Acompanhamento. Cada registro vira sinal para Sala.
- **Tela 3 — Mapa da Equipe** (`/app/team`): visão por colaborador (cargo, entregas esperadas, indicadores, feedback histórico, nível de autonomia).
- **1:1s** (`/app/one-on-ones`): já é ritual — integrar como tipo especial de Ritual, sem dobrar modelo.
- **PDIs** (`/app/pdis`): plano de evolução do liderado, alimenta "pessoas que precisam de atenção" na Sala.

## Detalhes técnicos

- **Schema Prisma**: adicionar `Indicator`, `IndicatorReading`, `LeaderProfile`, `MentorshipCommitment`, `CrossSignal` (alertas gerados), `LeadershipScore`, `FeedbackRecord`, `TeamMemberProfile` (autonomia/pontos).
- **API**: rotas em `api/src/routes/` — `indicators.routes.ts`, `consciencia.routes.ts`, `evolution.routes.ts`, estender `organization.routes.ts` para expor sinais cruzados na Sala.
- **Job de cálculo**: função `recomputeSignals(orgId)` chamada após mutations relevantes (delegação, ritual, reading) — não precisa cron nesta fase, cálculo síncrono.
- **RBAC**: perfil detalhado do módulo C = só o próprio userId. Dashboard executivo = roles `owner` / `hr` da company.
- **Frontend**: novas rotas em `src/routes/_authenticated/`, componentes reutilizando padrão da Sala (cards, drawer, mutations com `queryClient.invalidateQueries`).

## Ordem de execução proposta

1. **Sprint A** — Fase 2 Indicadores completa + concentração + integração com Sala. ✅
2. **Sprint B** — Módulo C (perfil + compromissos + alertas cruzados). ✅
3. **Sprint C** — Módulo E (score + leitura diagnóstica) + Dashboard Executivo.
   ✅ Concluído — LeadershipScoreSnapshot, /evolution/me, /evolution/dashboard, tela /app/evolution e /company/leadership.
4. **Sprint D** — Feedbacks (Tela 6) + Mapa da Equipe (Tela 3) + PDIs.
   ✅ Concluído — FeedbackRecord, TeamMemberProfile, Pdi/PdiGoal + rotas
   `/organization/:orgId/feedbacks`, `/team`, `/pdis` e telas `/app/feedbacks`,
   `/app/team`, `/app/pdis`.

Cada sprint entrega backend + frontend + integração à Sala de Liderança.

## Confirmação antes de codar

Confirma:
1. Seguir esta ordem (A → D)?
2. Assessment inicial: começar com **DISC** (mais leve, 24 perguntas) ou **Big Five** (mais preciso, ~50)?
3. Indicadores: começar com **input manual mensal** + CSV, ou já quer prever integração externa (planilha Google/BI)?

Assim que confirmar, começo pela **Sprint A (Indicadores)**.
