## Gap Analysis — App atual vs. Especificação Funcional v2 (C.O.R.E. · Hard/Soft/Heart)

Base do diagnóstico: os 4 módulos da spec (C/O/R/E), a regra "não pedir o que dá pra inferir", e o faseamento em 4 fases validáveis (§8 do doc).

### Legenda
✅ existe e atende · 🟡 existe parcial / precisa ajuste · ❌ não existe

---

### Módulo C — Consciência

| Item da spec | Status | Onde está / o que falta |
|---|---|---|
| Papel declarado do líder | 🟡 | Onboarding cria perfil, mas não tem campo "pra que essa liderança existe / o que é seu / o que não é" |
| Assessment DISC | ✅ | `pulses` DISC 24 pares (pra liderados) — falta versão auto-aplicada pro próprio líder e salvar como perfil permanente |
| MBTI + sabotadores + egograma | ❌ | Nada disso existe |
| Autoavaliação Hard/Soft/Heart (curta, ponto de partida) | ❌ | `app.consciencia` existe mas não tem essa lente |
| Perfil resumido (força / risco) | 🟡 | `app.consciencia` mostra algo genérico, sem taxonomia H/S/H |
| Mapa de gaps por dimensão H/S/H | ❌ | — |
| Compromissos de mentoria com data de revisão | ❌ | — |
| Alertas cruzados vindos de E | ❌ | — |

### Módulo O — Organização (Hard)

| Item | Status | Notas |
|---|---|---|
| Mapa da área (propósito, entregas, estrutura) | 🟡 | `organization.areas`/`map`/`roles` existem, mas propósito e entregas não são campos estruturados |
| Job descriptions + SLAs por posição | 🟡 | `organization.roles` tem cargo, falta SLA e critério de "feito" |
| Indicadores de área e individuais | ✅ | `app.indicators` cobre |
| Metas SMART do ciclo | 🟡 | Indicadores existem mas sem ciclo/meta SMART formal ligada |
| Visão da equipe (perfil DISC + 9-box perf×potencial + gaps) | 🟡 | `app.team` lista pessoas, sem matriz 9-box nem perfil comportamental por membro |
| Rituais de gestão definidos (cadência) | ✅ | `organization.rituals` |
| Acordo de estrutura e pertencimento à cultura | ❌ | — |
| Taxa de adesão a rituais (dado bruto pra R) | 🟡 | Existe check-in mas não é exposto como KPI de O |

### Módulo R — Resultado (Soft + Heart)

| Item | Status |
|---|---|
| Rituais 1-toque feito/não feito | ✅ |
| Delegações c/ prazo + status | ✅ + follow-up ativo (etapa 3 concluída) |
| Feedback (fato + data) | ✅ `app.feedbacks` |
| 1:1 com briefing IA | ✅ |
| Reunião de análise de resultado (desvio→causa→plano) | ❌ Não existe ritual estruturado com PDCA |
| Gestão à vista (indicador visível pro time) | ❌ Indicadores hoje só o líder vê |
| Reconhecimento quando bate meta | ❌ |
| Agenda semanal: previsto × realizado | 🟡 `TodayList` mostra hoje, falta visão semanal comparativa |
| Bloco "Fazendo Certo" (cultura/valores/honestidade intelectual) | ❌ Nenhum registro estruturado |
| Pulsos / DISC pro liderado | ✅ (extra além da spec, ótimo) |

### Módulo E — Evolução

| Item | Status |
|---|---|
| Meta × Realizado por indicador | 🟡 `evolution` mostra evolução mas não meta calibrada |
| Análise de desvio (execução vs. meta mal calibrada) | ❌ |
| Score de sustentação **por dimensão H/S/H** (não único) | ❌ Hoje existe "CORE score" único |
| Cálculo 100% inferido (sem autoavaliação) | 🟡 Precisa revisar fórmula pra bater com regra da spec |
| Diagnóstico automático ("evoluiu em Hard, travou em Heart") | ❌ |
| Dashboard da Empresa (visão executiva, ROI, alertas de líderes em risco) | 🟡 `company.leadership` lista líderes, sem ROI nem alerta preditivo |
| Foro íntimo protegido (feedback/mentoria não expostos ao RH) | 🟡 RLS existe mas regra não está formalizada / auditada |

### Fora dos 4 módulos (extras já feitos)
- Multi-tenant (franquia/empresa/org), billing Asaas, notificações in-app, PWA, captura por voz, pulsos públicos por token, IA gateway configurável.

---

## Roadmap proposto (substitui `.lovable/plan.md`)

Realinha o plano de 12 itens à Fase 1→4 da spec. Cada fase entrega valor sozinha.

### Fase 1 — Fundação C+O completa (2 sprints)
Objetivo: diagnóstico do líder e da área ficam corretos e ricos, sem depender de R/E ainda.

1. **Assessment C completo**: novo fluxo `/app/consciencia/assessment` com (a) papel declarado, (b) DISC auto-aplicado, (c) MBTI curto (16 perguntas), (d) 10 sabotadores (checklist), (e) egograma leve, (f) autoavaliação H/S/H (3 perguntas por dimensão). Resultado vira `LeaderProfile` persistente com revisão a cada 90 dias.
2. **Perfil resumido H/S/H**: `app.consciencia` reformulado mostrando força/risco por dimensão, mapa de gaps, e ganchos pro PDI.
3. **Mapa da área estruturado**: adicionar `purpose`, `deliverables[]`, `slaByRole` em Area/Role; tela `organization.areas` ganha editor guiado.
4. **Visão da equipe 9-box**: matriz performance × potencial em `app.team`, com perfil DISC de cada membro (puxado do pulse DISC quando existir).
5. **Metas SMART do ciclo**: entidade `Cycle` (trimestre) + `CycleGoal` ligada a indicador; tela em `organization.index`.

### Fase 2 — Execução R sólida (1-2 sprints)
Objetivo: líder roda a semana inteira dentro do app, gerando dado bruto pra E.

6. **Agenda semanal previsto×realizado**: nova view em `/app` com semana atual, rituais/1:1/entregas planejados vs. feitos.
7. **Reunião de análise de resultado (PDCA)**: novo tipo de ritual com template desvio→causa raiz→plano; salva `RootCauseAnalysis` linkada ao indicador.
8. **Gestão à vista**: toggle "visível pro time" em cada indicador → membros veem em `/app/indicators/shared`.
9. **Bloco Fazendo Certo**: registro rápido de decisões por fato/dado, admissão de erro, reconhecimento — cada um gera evento comportamental usado em E.
10. **Reconhecimento automático**: quando indicador bate meta, sugestão IA de mensagem de reconhecimento + botão "enviar pulse de reconhecimento".

### Fase 3 — Medição E por dimensão (2 sprints)
Objetivo: score H/S/H separado, calculado, com diagnóstico automático.

11. **Motor de score H/S/H**:
    - **Hard**: adesão a rituais de gestão + % metas SMART definidas + % indicadores com meta clara.
    - **Soft**: frequência de 1:1 + delegações no prazo + feedbacks entregues (fato, não conteúdo).
    - **Heart**: consistência de feedback (regularidade), pulsos de clima positivos, reconhecimentos, ausência de padrões de sabotador ativo cruzados com queda de clima.
12. **Análise Meta × Realizado + causa**: em cada fechamento de ciclo, sistema classifica desvio como "execução" (R falhou) ou "calibração" (meta errada em O) — usa dados de rituais e indicadores.
13. **Diagnóstico automático em C**: `LeaderInsight` gerado semanal ("Você evoluiu +12 em Hard, caiu -8 em Heart — provável causa: feedbacks caíram de 4/sem pra 1/sem"). Alimenta PDI.
14. **Dashboard da Empresa v2**: `company.leadership` ganha ROI (custo do programa ÷ melhoria média H/S/H), lista de líderes em risco com motivo, evolução agregada por dimensão.
15. **Auditoria de foro íntimo**: revisar RLS e endpoints garantindo que empresa nunca vê conteúdo de feedback/mentoria/assessment bruto — só score agregado. Adicionar teste automatizado.

### Fase 4 — Inteligência e integrações (2 sprints)
Objetivo: reduzir input manual, antecipar risco.

16. **IA Coach preditiva**: modelo simples (heurística + gateway) que prevê queda H/S/H 2 semanas antes com base em rituais quebrados, atrasos e perfil de sabotador ativo.
17. **Integração planilha/BI pra indicadores**: import CSV agendado + conectores (Google Sheets via `standard_connectors`) pra tirar input manual em O/E.
18. **Google Calendar sync** (rituais e 1:1).
19. **WhatsApp/Slack lembretes** (pulsos, delegações, rituais).
20. **Modo offline** (workbox + IndexedDB, fila de sync).

### Fora deste roadmap
- Refatoração de auth/RBAC.
- App nativo (PWA cobre).
- Novos módulos além de C.O.R.E.

### Ordem interna de cada fase
1. Migração Prisma → 2. rotas API → 3. componentes → 4. telas → 5. jobs/notificações → 6. deploy da fase.

### Onde já estamos bem à frente da spec
- Multi-tenant, billing, notificações, pulsos públicos, voz, PWA, IA config.
- Vale manter e polir, não refazer.

---

Se aprovar, começo pela **Fase 1 item 1 (Assessment C completo)** — é o que destrava a métrica H/S/H em todas as fases seguintes. Também posso quebrar cada fase em issues menores se preferir.