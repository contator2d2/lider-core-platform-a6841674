# Fase 6 — Módulo Organização (Líder C.O.R.E.)

Este módulo transforma a estrutura da empresa no **ambiente operacional da liderança**. Toda entidade é modelada para servir de insumo futuro para a IA (diagnósticos, inferências e recomendações).

Antes das telas, modelamos: **entidades → relacionamentos → regras → fluxos → permissões → UI**.

---

## 1. Modelagem de entidades (Prisma)

Reaproveitando `Organization`, `Branch`, `Area`, `Team`, `Membership`, `User`, `Profile` já existentes. Novas entidades:

- **Role (cargo)** — `id, orgId, title, mission, responsibilities[], deliverables[], competencies[], relationships[], docs[], flows[]`
- **RoleAssignment** — vincula `Membership ↔ Role`
- **AreaProfile** — extensão 1:1 de `Area`: `mission, objective, kpis[], docsCount, healthScore, updatedBy`
- **TeamProfile** — extensão 1:1 de `Team`: `objective, leaderId (Membership), kpis[]`
- **Ritual** — `id, orgId, scope (org|branch|area|team), scopeId, name, type (daily|weekly|1on1|feedback|action_plan|indicators|strategic|day_one|checkpoint|retro|custom), objective, cadence (cron ou enum), ownerId, durationMin, agendaTemplate (md), checklist (json), status`
- **RitualParticipant** — `ritualId, membershipId, role (owner|required|optional)`
- **RitualOccurrence** — instância executada: `ritualId, scheduledAt, startedAt, endedAt, status (scheduled|done|missed|canceled), minutes (ata md), aiSummary, notes`
- **RitualPending** — pendências geradas em uma ocorrência
- **Delegation** — `id, orgId, areaId?, teamId?, title, description, assigneeId, delegatorId, dueAt, priority (low|med|high|critical), doneCriteria, doneAt, status (open|in_progress|blocked|done|canceled)`
- **DelegationComment / DelegationAttachment / DelegationHistory**
- **Decision** — `id, orgId, ritualOccurrenceId?, title, context, decision, ownerId, dueAt, expectedResult, status (open|in_progress|done|reverted), tags[]`
- **DecisionHistory** — trilha de auditoria
- **Document** — `id, orgId, scope, scopeId, title, kind (policy|procedure|flow|material|video|pdf|link|other), url, mime, size, tags[], uploadedBy`
- **DocumentLink** — associa documento ↔ ritual / decisão / delegação
- **AgendaEntry** — visão agregada (view materializada em query) sobre rituais, feedbacks, 1:1s, delegações, PDIs, checkpoints
- **HealthScoreSnapshot** — `orgId, areaId?, teamId?, score, breakdown (json), computedAt`
- **EntityTag / EntityCategory** — genérico para todas as entidades

**Auditoria padrão em todas**: `createdAt, updatedAt, createdBy, updatedBy, historyJson`, mais tabela `AuditLog` já existente.

---

## 2. Relacionamentos-chave

```text
Organization ─┬─ Branch ─ Area ─ Team ─ Membership ─ User
              ├─ Role ── RoleAssignment ── Membership
              ├─ Ritual ── RitualOccurrence ── (Decision, Pending, Document)
              ├─ Delegation (opcional area/team)
              ├─ Decision (opcional ritualOccurrence)
              └─ Document (scoped)
```

Um **líder** é `Membership` com `role ∈ {leader, hr_admin}` **ou** com `RoleAssignment` marcado como `isLeader`. Relação "quem lidera quem" resolvida por: líder da Team → membros da Team; líder da Area → líderes das Teams.

---

## 3. Regras de negócio

- Um ritual só pode ter escopo compatível (`team` exige `teamId` da mesma org).
- Ocorrência `missed` é gerada automaticamente por cron quando `scheduledAt + duration < now()` e status = `scheduled`.
- Delegação vencida (`dueAt < now()` e `status ∉ {done,canceled}`) entra em "atrasadas" e conta no Health Score.
- Decisão sem prazo permitida, mas contabiliza pendência após 7 dias sem status.
- Health Score (0–100) = média ponderada:
  - Estrutura (15%) — % Areas/Teams com missão + KPIs + líder definido
  - Rituais (25%) — % ocorrências realizadas nos últimos 30d vs planejadas
  - Delegações (20%) — 1 − (atrasadas / abertas)
  - Indicadores (15%) — % KPIs atualizados no ciclo
  - Atualização (10%) — média de dias desde `updatedAt` das entidades da área
  - Pendências (15%) — 1 − (pendentes / total gerado)
- Toda mutação registra `AuditLog` + append em `historyJson` da entidade.

---

## 4. Fluxos principais

1. **Onboarding do líder** — checklist: definir missão da área → KPIs → cadastrar equipes → indicar líderes → cadastrar rituais base (Daily, Weekly, 1:1) → primeira delegação.
2. **Ritual em execução** — abrir ocorrência → checklist → registrar ata → gerar decisões e delegações a partir da ata → fechar.
3. **Delegação** — criar → acompanhar (comentários/anexos) → concluir com evidência do critério.
4. **Decisão** — cria manualmente ou a partir de uma ocorrência de ritual; timeline mostra reversões.
5. **Documentos** — upload no escopo da área; vincular a rituais.

---

## 5. Permissões (RBAC granular já existente)

Novos `resource.action`:
- `org_map.view`
- `area.view|edit`, `team.view|edit`, `role.view|edit`
- `ritual.view|edit|execute`
- `delegation.view|edit|assign`
- `decision.view|edit`
- `document.view|edit|delete`
- `health_score.view`

Grants padrão:
- **collaborator**: `.view` em area/team/ritual/document do próprio escopo; `delegation.view` das próprias; `decision.view`.
- **leader**: `.edit` em area/team/ritual/delegation/decision/document do seu escopo.
- **hr_admin / owner / admin**: tudo dentro da org.
- **super_admin / neo_admin**: bypass.

---

## 6. Backend (API Express + Prisma)

Rotas novas em `api/src/routes/`:
- `org-map.routes.ts` — `GET /org-map/:orgId` (árvore agregada com counts, líderes, health)
- `roles.routes.ts` — CRUD Role, atribuição a Membership
- `rituals.routes.ts` — CRUD Ritual + `/occurrences` (list, open, close, minutes)
- `agenda.routes.ts` — `GET /agenda?scope&range` unificando rituais, 1:1, feedbacks, delegações, PDIs
- `delegations.routes.ts` — CRUD, comentários, anexos, histórico
- `decisions.routes.ts` — CRUD, histórico
- `documents.routes.ts` — upload (multipart → storage), lista por escopo
- `health-score.routes.ts` — `GET` calcula on-demand + snapshot diário
- Estender `data.routes.ts` para import/export de Rituais, Delegações, Decisões, Documentos.

Cron endpoints (`/api/public/cron/*` protegidos por `x-cron-secret`):
- `rituals-tick` — cria ocorrências futuras, marca missed
- `health-score-daily` — snapshot por org/area/team
- `dunning` (já existe)

---

## 7. Frontend (TanStack Start + shadcn)

Novas rotas em `src/routes/_authenticated/`:

```text
app/organization.tsx              → layout com sub-nav
app/organization.index.tsx        → Dashboard Organização + Health Score
app/organization.map.tsx          → Mapa/Organograma inteligente (react-flow)
app/organization.areas.tsx        → Lista áreas (cards)
app/organization.areas.$id.tsx    → Detalhe área (drawer + tabs)
app/organization.teams.tsx        → Lista equipes
app/organization.teams.$id.tsx    → Detalhe equipe
app/organization.roles.tsx        → Cargos e responsabilidades
app/organization.rituals.tsx      → Gestão de rituais + calendário
app/organization.rituals.$id.tsx  → Detalhe ritual + ocorrências
app/organization.agenda.tsx       → Agenda da liderança (calendário, timeline, lista)
app/organization.delegations.tsx  → Kanban de delegações
app/organization.decisions.tsx    → Central de Decisões (timeline + tabela)
app/organization.documents.tsx    → Base documental por área
```

Componentes:
- `OrgTree` — organograma com `@xyflow/react` (react-flow), cards ricos, drawer lateral (`Sheet` shadcn).
- `EntityDrawer` — abertura lateral universal, nunca navega.
- `RitualCard`, `DelegationCard`, `DecisionCard`, `AreaCard`, `TeamCard`.
- `HealthScoreGauge` — gauge radial com breakdown.
- `AgendaView` — 3 modos (Mês/Semana/Hoje) + Timeline + Lista.
- `KanbanBoard` — para delegações (drag & drop pronto via `@dnd-kit`).
- `OnboardingChecklist` — steps de implantação.

UX: paleta e tipografia já definidas do projeto, muito whitespace, cards com sombra sutil, motion suave via `framer-motion` já instalado. Nada de tabelas cruas — sempre cards, timeline ou board.

---

## 8. Preparação para IA

Toda entidade nova exporta:
- `createdAt, updatedAt, createdBy, updatedBy`
- `historyJson` (append-only)
- `tags[], category, context (md)`
- Endpoints `/ai/context/:entity/:id` retornam payload normalizado para o Coach usar depois.

---

## 9. Entrega em ondas (dentro desta fase)

Para caber e ser testável:

- **Onda A — Modelagem + backend base**: migration Prisma completa; rotas `org-map`, `areas`, `teams`, `roles`, `rituals` (CRUD + ocorrências), `delegations`, `decisions`, `documents`, `health-score`, `agenda`; permissões; cron `rituals-tick` e `health-score-daily`.
- **Onda B — UI Organização**: layout + Dashboard + Mapa (react-flow) + Áreas/Equipes/Cargos com drawer.
- **Onda C — Rituais + Agenda + Delegações + Decisões + Documentos**: telas ricas, kanban, calendário, timeline, ata, decisões.
- **Onda D — Health Score + Onboarding + polimento** + import/export CSV das novas entidades.

Cada onda deixa o sistema navegável e testável.

---

## Detalhes técnicos rápidos

- Novas libs frontend: `@xyflow/react` (organograma), `@dnd-kit/core` + `@dnd-kit/sortable` (kanban), `date-fns` (já presente), `react-day-picker` (já).
- Uploads de documentos: via API multipart → armazenamento local `/uploads` (mesma estratégia do `admin.data`) com metadados em `Document`.
- Cron: reaproveita header `x-cron-secret` do módulo billing.
- Ata do ritual em Markdown com editor leve (`textarea` + preview) — sem dependência pesada agora.
- Health Score recalculado on-demand no dashboard e snapshotado diariamente para tendência.
- i18n mantido em pt-BR.

Aprove para iniciar pela **Onda A (modelagem + backend)**; sigo em seguida com as ondas B–D no mesmo ciclo.
