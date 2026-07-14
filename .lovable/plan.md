## Objetivo
Deixar o Líder C.O.R.E. com cara premium e ativar a IA Coach usando dados reais — em paralelo, uma única rodada.

## Parte 1 — Polimento visual (design system + motion)

### 1.1 Tokens e utilitários novos em `src/styles.css`
- Novo gradiente `--gradient-accent` (laranja→laranja-suave) para números-chave, headers de destaque.
- Sombras coloridas: `--shadow-accent` (laranja 15% de opacidade) e `--shadow-soft` (neutra).
- Utility `.eyebrow` (uppercase 10px tracking-widest muted).
- Utility `.card-elevated` (borda + sombra suave + hover lift).
- Utility `.metric-number` (font-display, tabular-nums, tracking tight).
- Toggle de dark mode funcional (hoje já tem tokens, falta o botão).

### 1.2 Biblioteca de motion (framer-motion, intensidade 3)
- `bun add framer-motion`.
- Novo `src/components/motion/` com:
  - `<FadeIn />` — entrada com fade+rise 8px, 300ms.
  - `<StaggerList />` — filhos entram em cascata 60ms.
  - `<CountUp />` — números animam de 0 ao valor final em 800ms.
  - `<PageTransition />` — wrapper para o `<Outlet />` das rotas.
- Aplicar em: `/app`, `/app/evolution`, `/app/consciencia`, `/company/leadership`, `/app/indicators`.

### 1.3 Gráficos elegantes com Recharts
- `bun add recharts` (se não estiver).
- Novo `src/components/charts/`:
  - `<TrendArea />` — gráfico de área com gradiente laranja→transparente, linha 1.5px, sem grid, tooltip minimalista dark.
  - `<ScoreGauge />` — semi-círculo animado com arco laranja e valor central grande.
  - `<RankBars />` — barras horizontais finas para ranking de líderes.
  - `<SignalPulse />` — sparkline compacta para os cross-signals.
- Substituir os SVGs manuais de `app.evolution.tsx` e `company.leadership.tsx`.

### 1.4 Header/sidebar refinados
- Sidebar: seções com divisórias mais sutis, item ativo com barra lateral laranja de 2px em vez de background sólido.
- Header: relógio ao vivo + toggle de tema + notificações com badge.
- Logo com hover sutil (opacidade da versão "mark").

### 1.5 Cards padrão em todas as telas
- Componente `<MetricCard>` reutilizável (eyebrow + número + delta + sparkline opcional).
- Componente `<SectionHeader>` (eyebrow + h2 display + descrição).

## Parte 2 — IA Coach real

### 2.1 Backend
- Novo `api/src/routes/ai.routes.ts`:
  - `POST /ai/coach/chat` — streaming SSE. Monta contexto do líder (perfil de consciência, últimos rituais, delegações abertas/atrasadas, cross-signals ativos, score atual e trend) e chama `google/gemini-3.5-flash` via Lovable AI Gateway com system prompt de coach.
  - `POST /ai/coach/insight` — one-shot que gera insight semanal a partir dos mesmos dados.
- Helper `api/src/lib/ai-gateway.ts` — wrapper OpenAI-compatible pro gateway com `LOVABLE_API_KEY`.
- Ferramentas expostas ao modelo (function calling):
  - `registrar_delegacao` (needsApproval).
  - `marcar_ritual_concluido` (needsApproval).
  - `criar_compromisso_mentoria` (needsApproval).

### 2.2 Frontend `/app/ai`
- Substituir stub por chat completo:
  - Layout split: à esquerda, "insight da semana" gerado on-demand com botão de refresh; à direita, chat conversacional.
  - Bolhas com markdown, streaming char-by-char.
  - Chips de prompts sugeridos ("Analise minha semana", "Onde estou perdendo tempo?", "Prepare meu próximo 1:1").
  - Tool-calls aparecem como cards de ação com botão "Aprovar" antes de executar.

### 2.3 Secret
- Garantir `LOVABLE_API_KEY` via `ai_gateway--create`.

## Fora do escopo desta rodada
- Módulo 1:1s (fica para próxima).
- Central de notificações completa (só o badge no header aqui).
- Export PDF de relatórios.
- Onboarding guiado.

## Detalhes técnicos

**Motion**: `framer-motion` com `<LazyMotion features={domAnimation}>` no root pra bundle enxuto. `prefers-reduced-motion` respeitado nativamente pelo motion.

**Recharts theme**: `<defs><linearGradient id="accentFill">...</linearGradient></defs>` usando `var(--accent)`; tooltip customizado com `bg-popover border-border`.

**IA Coach streaming**: `res.setHeader('Content-Type', 'text/event-stream')` no Fastify + `ReadableStream` no cliente com `EventSource`-like handler manual (o api usa Fastify, não TanStack server routes).

**Contexto do prompt**: query única no Prisma que agrega os últimos 30 dias de rituais/delegações/signals + score atual; token budget ~2k.

**Dark mode**: adicionar `<ThemeToggle />` no header que faz `document.documentElement.classList.toggle('dark')` e persiste em localStorage lido no `useEffect` (evita hydration mismatch já que o app é SPA client-side).

## Ordem de execução
1. Tokens + utilities em styles.css.
2. Instalar framer-motion + recharts.
3. Componentes de motion e charts.
4. Refactor das 5 telas principais (dashboard, evolution, consciencia, leadership, indicators).
5. Backend IA Coach + tela `/app/ai`.
6. Header refinado + dark toggle.