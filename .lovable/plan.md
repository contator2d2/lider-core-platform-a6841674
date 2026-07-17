# Roadmap Líder C.O.R.E. — 12 upgrades em 4 etapas

Entrega incremental, cada etapa fecha valor sozinha e pode ir pra produção. Ordem pensada por impacto no dia a dia do líder × esforço.

---

## Etapa 1 — "O líder abre o app e já sabe o que fazer" (alto impacto, baixo esforço)

**Itens: 1, 6, 11**

### 1. Tela "Hoje você precisa…" (`/app` reformulado)
- Nova seção topo do dashboard: lista priorizada gerada no backend agregando:
  - delegações vencendo em ≤2 dias ou atrasadas
  - rituais pendentes hoje
  - 1:1s marcados para hoje/amanhã sem briefing
  - cross-signals críticos abertos
  - membros do time com queda de score ≥15% na semana
- Cada item = card com CTA único ("Cobrar", "Marcar como feito", "Preparar 1:1", "Abrir perfil").
- Endpoint novo: `GET /app/today` retorna array tipado com `{ type, priority, title, subtitle, cta, href, payload }`.

### 6. Team Health no header
- Score agregado do time (média ponderada dos CORE scores dos liderados diretos + delta 7d).
- Componente `<TeamHealthPill>` no `AuthenticatedHeader`, click abre popover com breakdown por membro (mini lista com sparkline).
- Endpoint: `GET /team/health` já parcialmente existe em `team.routes.ts`, adiciona agregação.

### 11. "Explique esse número"
- Botão `ⓘ Explicar` em cada KPI de `/app`, `/app/indicators`, `/app/evolution`, member detail.
- Handler `POST /ai/explain-metric` com `{ metric, scope, window }` → gateway Gemini com contexto puxado do Prisma (últimos eventos que moveram a métrica).
- UI: popover com resposta streamada, 2-3 parágrafos + 2 ações sugeridas.

---

## Etapa 2 — "IA vira copiloto real de conversas" (alto impacto, esforço médio)

**Itens: 2, 3, 10**

### 2. Briefing automático de 1:1
- Em `/app/one-on-ones` e no member detail, botão "Gerar briefing".
- Backend `POST /ai/one-on-one/brief` agrega: últimos 5 feedbacks trocados, delegações abertas do membro, PDI ativo, cross-signals, últimos rituais, evolução do CORE score.
- Retorna markdown estruturado (Contexto / Vitórias / Riscos / Perguntas sugeridas / Ações propostas). Salva como `OneOnOne.briefingMarkdown`.
- Export PDF simples via `@react-pdf/renderer` (client-side, evita dep node no worker).

### 3. Captura por voz → feedback/delegação
- Componente `<VoiceCapture>` reusável (usa `MediaRecorder` no browser).
- Backend `POST /ai/transcribe` recebe blob, chama gateway `google/gemini-2.5-flash` (multimodal audio) → texto → classifica em `{ tipo: feedback|delegacao|nota, entidades: {membro?, prazo?}, resumo }`.
- UI: botão flutuante 🎙 no `/app/team`, member detail e organization. Após transcrição mostra draft editável → confirmar cria o registro certo.

### 10. 360 leve trimestral
- Nova rota `/app/360` + entidade `ThreeSixtyRound` (open trimestre × 3 perguntas × 1 nota + comentário por avaliador).
- Fluxo: líder abre round → sistema envia notificação in-app pros pares/liderados → cada um responde em ~2min → líder vê consolidado anônimo com IA resumindo temas.
- Migração Prisma + rotas CRUD + tela de resposta + tela de consolidação.

---

## Etapa 3 — "Rituais e delegações que se cobram sozinhos" (esforço médio)

**Itens: 4, 5, 9**

### 4. Delegações com follow-up ativo
- Job diário no backend (cron via `pg_cron` chamando `/api/public/cron/delegation-followup`):
  - D-2: notificação in-app + WhatsApp opcional pro dono.
  - D0 vencida: notificação pro líder + sugestão IA "sugerir conversa" (rascunho de mensagem).
  - Reincidente (3+ atrasos no trimestre): flag no perfil do membro, cross-signal automático.
- UI: coluna "status vivo" na tabela de delegações com badges (no prazo / atenção / atrasada / crítica).

### 5. Ritual check-in 1-clique
- Refactor `/app/organization/rituals` mobile-first:
  - Card grande do ritual do dia com botão único "Fiz ✓" que registra completion + timestamp + opcional 1 emoji de sentimento.
  - Swipe pra próximo ritual.
- Endpoint `POST /rituals/:id/check-in` já existe? Se sim, só expõe UX; senão adiciona.

### 9. Trilha de evolução do próprio líder
- `/app/evolution` ganha aba "Minha jornada":
  - Timeline dos próprios rituais completados, feedbacks recebidos, marcos de PDI, mudanças de perfil de consciência.
  - Gráfico do próprio CORE score ao longo de 12 meses (não só do time).
- Backend agrega em `GET /evolution/me/journey`.

---

## Etapa 4 — "O app sai da tela do desktop" (esforço maior, valor operacional)

**Itens: 7, 8, 12**

### 7. Mobile-first pass
- Auditoria + refactor de `/app`, `/app/team`, `/app/one-on-ones`, `/app/organization/*`, `/app/ai`:
  - Nav bottom bar em telas <768px (Início / Time / IA / Org / Mais).
  - Botões alvo ≥44px, cards empilhados, tabelas viram lista.
  - Header colapsa em scroll.
- Sem quebrar desktop — usar `useMobile` + variantes Tailwind.

### 8. Integrações
- **Google Calendar**: connector OAuth já disponível — usar `standard_connectors` pra sync de 1:1s e rituais recorrentes.
- **Slack**: notificação de delegação atrasada e briefing pronto no DM do líder.
- **WhatsApp**: via provider externo (ex. Z-API/Twilio, secret user-provided) — enviar lembretes de ritual e delegação.
- **Export CSV/PDF**: já tem `csv.ts`; adicionar botão "Exportar" em indicators, team, delegations.

### 12. Modo offline / rascunhos
- Service worker com `workbox` (PWA já tem manifest).
- IndexedDB cache pra:
  - lista de membros do time
  - último dashboard
  - drafts de feedback/delegação/nota criados offline
- Fila de sincronização: reenvia POSTs quando volta online, com badge "N ações pendentes" no header.

---

## Ordem de execução dentro de cada etapa
1. Migração Prisma (se houver) + rotas backend + testes rápidos com curl.
2. Componentes UI compartilhados.
3. Telas.
4. Notificações/cron/integração externa.
5. Deploy da etapa → validar em produção antes da próxima.

## Fora do escopo geral
- Refatoração de auth/RBAC (já ok).
- Multi-idioma além de pt-BR.
- App nativo iOS/Android (PWA cobre etapa 4).

## Detalhes técnicos relevantes
- **IA**: tudo via Lovable AI Gateway com `google/gemini-2.5-flash` (rápido/barato) e `gemini-2.5-pro` só em briefing 1:1 e consolidação 360.
- **Cron**: `/api/public/cron/*` no TanStack + assinatura HMAC, disparado por `pg_cron` no Supabase.
- **Voz**: `MediaRecorder` → upload multipart → gateway multimodal → não guardar áudio (só transcrição) pra evitar storage pesado.
- **PDF**: `@react-pdf/renderer` no cliente (evita libs Node-only no worker Cloudflare).
- **Offline**: `workbox-window` + `idb-keyval`; fila simples com retry exponencial.

## Estimativa grosseira
- Etapa 1: 1 sprint
- Etapa 2: 1-2 sprints
- Etapa 3: 1-2 sprints
- Etapa 4: 2 sprints

Confirma esse plano que já começo pela Etapa 1?
