# App Base — Sistema Operacional do Líder (só Módulo C ativo)

Alinhar o app do líder ao PROMPT 02: base modular, desacoplada da metodologia,
consumindo backend/Admin. Como só o módulo **C (Consciência)** está ativo, os
demais módulos aparecem como placeholders "em breve" — sem quebrar a nav.

## O que já existe (não refazer)
- Auth: login, `/auth/me`, roles, orgs pessoais para líder independente.
- Onboarding leve (`LeaderOnboarding.tsx`) com steps de perfil.
- Rotas do módulo C: `app.consciencia.*` (assessment, PDI, agenda, coach, activity).
- Feature flags por template (`useFeatures`), filtragem de nav em `app.tsx`.
- Neo Admin: Jornadas, Assessments, DNA, Knowledge, Recommendations, `/ai-context`.

## O que falta (este ciclo)

### 1. Backend — jornada inicial + CORE DNA do líder
- `GET  /me/journey/initial` → jornada marcada como "inicial" no Admin
  (nova flag `JourneyVersion.isInitial` publicada) + progresso do líder.
- `POST /me/journey/:versionId/steps/:stepId/complete` → grava evento no
  `DnaEvent` e avança o líder no `LeaderJourneyProgress`.
- `POST /me/dna/bootstrap` → agrega respostas e cria o `CoreDna` inicial;
  se o líder informar "já participei da mentoria", aceita JSON com dimensões
  e pula os steps.
- `GET  /me/dna` → CORE DNA atual (dimensões, traços, atualizado_em).
- `GET  /me/home/briefing` → agrega em uma chamada: agenda de hoje, feedbacks
  pendentes, próximas 1:1s, pendências da equipe, próxima etapa da jornada,
  PDI em andamento, insight do copiloto (usa `coachRouter`), indicadores
  rápidos (H/S/H do usuário).

### 2. Onboarding
Novo `OnboardingFlow.tsx` (substitui o wizard atual quando
`onboardingCompletedAt` estiver nulo). Passos:
1. Perfil básico (nome, cargo, whatsapp) — já existe.
2. Pergunta divisor: "Você já participou da mentoria Neo?" (sim/não).
3a. Sim → tela de importação de CORE DNA (textarea JSON ou "não tenho agora").
3b. Não → executa a Jornada Inicial passo a passo, cada step como card
    de experiência única (pergunta + escala/texto), sem expor "1 de N".
4. Ao terminar → chama `/me/dna/bootstrap` e leva para `/app`.

### 3. Home (`/app` → `app.index.tsx`)
Reescrita como **Briefing do dia**, respondendo "o que precisa de mim hoje?":
- Header com saudação + data + score H/S/H mini.
- Cards (ordem fixa, ocultam quando vazios):
  Agenda do dia · Feedbacks pendentes · Próxima 1:1 · Pendências da equipe ·
  Próxima etapa da jornada · PDI em andamento · Insight do Copiloto IA ·
  Indicadores rápidos.
- Todos consumidos de `/me/home/briefing` (1 chamada). Loading skeleton.

### 4. Estrutura de módulos base
Rotas placeholder para os módulos ainda não ativos — app nasce com a estrutura
completa. Cada uma verifica `useFeatures()` e mostra "em breve" quando o módulo
não estiver no template.

```
/app                  Home (briefing)      [ativo]
/app/journey          Jornada              [ativo — C]
/app/team             Equipe               [ativo — C]
/app/agenda           Agenda               [ativo — C, alias]
/app/feedbacks        Feedback             [placeholder se E off]
/app/pdis             PDI                  [ativo — C]
/app/ai               Copiloto IA          [ativo — C limitado]
/app/profile          Perfil               [ativo]
/app/settings         Configurações        [ativo]
/app/notifications    Notificações         [ativo]
```

Nav mobile (5 slots): Início · Jornada · Equipe · Agenda · Mais.
Nav desktop: seções "Meu dia", "Meu desenvolvimento" (C), "Em breve" (O/R/E).

### 5. Filtragem por módulo ativo
- `app.tsx` passa a usar uma fonte única (`src/lib/nav.ts`) com metadados
  `{ module, status: "active" | "coming_soon" }`. Itens `coming_soon` renderizam
  desabilitados com badge "em breve" — o líder vê o roadmap sem confusão.
- Ao clicar num item "em breve", toast "Disponível em breve — ative com seu plano".

## Detalhes técnicos
- Prisma: `JourneyVersion.isInitial Boolean @default(false)` + novo model
  `LeaderJourneyProgress { userId, versionId, currentStepId, completedSteps Json,
  startedAt, completedAt }`. Sincronizam no boot via `prisma db push`.
- `/me/home/briefing` compõe queries internas e devolve payload plano.
- Client: `src/lib/home.ts` (tipos + hooks), `app.index.tsx` vira consumidor
  puro sem regra de negócio.
- Zero refactor no C existente: `app.consciencia.*` fica onde está;
  `/app/journey` renderiza a jornada inicial e é reaproveitado pelo onboarding.

## Fora de escopo
- Módulos O, R, E além de placeholders.
- Import real de DNA da mentoria antiga (só aceita JSON manual por ora).
- Push notifications nativas (bell in-app já existe).
