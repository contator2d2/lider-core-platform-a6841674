# LÍDER C.O.R.E. — Arquitetura da Plataforma

Sistema Operacional para Liderança, multi-tenant, baseado na metodologia Neo Pessoas. Antes de gerar telas, apresento abaixo a arquitetura completa para sua aprovação.

---

## 1. Princípio Norteador

> "O líder não entra no sistema para preencher formulários. Ele entra para liderar."

- O sistema **registra fatos** (interações, rituais, entregas).
- A plataforma **interpreta comportamento** (padrões, frequência, engajamento).
- A IA **gera diagnósticos** (CORE Score, alertas, recomendações).
- Toda navegação segue o ciclo **C.O.R.E.**: Consciência → Organização → Resultado → Evolução.

---

## 2. Stack Técnica

- **Frontend/SSR:** TanStack Start (React 19, Vite 7), Tailwind v4, shadcn/ui.
- **Backend:** Express 4 + Prisma ORM + JWT próprio, self-hosted no EasyPanel (Postgres oficial).
- **RPC:** REST API interna `/api/*` servida pelo backend Express; webhooks expostos em `/api/public/*`.

- **IA:** Lovable AI Gateway (multi-provedor: OpenAI, Anthropic, Gemini, Groq, Azure) com contabilização de tokens por tenant.
- **Pagamentos:** Stripe seamless (padrão) + arquitetura pluggable para Asaas.
- **Design:** Apple/Linear/Notion — dark-mode-ready, mobile-first, muito respiro.

---

## 3. Hierarquia Multi-Tenant

```text
R2D2 (Super Admin)
  └── Neo Pessoas (Owner da metodologia)
        └── Franquias / Licenciados
              └── Empresas Clientes (tenant isolado)
                    ├── Áreas / Departamentos / Filiais
                    ├── Líderes
                    └── Colaboradores
```

Isolamento lógico via `tenant_id` (empresa) em **toda** tabela de dados operacionais, aplicado por RLS. Franquia e Neo Pessoas veem agregados de suas carteiras via views/policies específicas.

---

## 4. Entidades Principais

### Núcleo organizacional
- `organizations` (empresas clientes) — CNPJ, plano, franquia_id, status.
- `franchises` — carteira do licenciado.
- `branches` (filiais), `departments`, `areas`, `teams`.
- `users` (auth.users) + `profiles` (nome, avatar, telefone).
- `user_roles` (tabela separada — **nunca** no profile) com enum `app_role`: `super_admin`, `neo_admin`, `franchise_admin`, `company_admin`, `leader`, `collaborator`.
- `memberships` — vínculo user × organization × role × area/team.

### Metodologia C.O.R.E.
- `modules` — Consciência, Organização, Resultado, Evolução.
- `rituals` — templates de rituais (1:1, check-in, feedback, reunião de time).
- `ritual_instances` — execuções agendadas/realizadas.
- `pdi` (Plano de Desenvolvimento Individual) + `pdi_actions`.
- `feedbacks` (contínuos, estruturados).
- `one_on_ones` — 1:1 com pauta, notas, ações.
- `delegations` — delegações com prazo/status.
- `objectives` + `key_results` (OKRs/metas).
- `indicators` (KPIs) + `indicator_values` (série temporal).
- `check_ins` — pulso do colaborador.
- `core_score` — snapshot calculado (por líder, por equipe, por empresa).

### IA
- `ai_providers` (openai, anthropic, …), `ai_tokens` (por tenant, encrypted).
- `ai_usage` — consumo por request (tokens in/out, custo, modelo, feature).
- `ai_insights` — diagnósticos gerados (quem precisa de atenção, risco de turnover, gaps).
- `ai_limits` — cotas por plano/empresa.

### Comercial / Billing
- `plans` (Essencial, Pro, Premium, IA) + `plan_features` (feature flags).
- `subscriptions` (organization × plan, status, ciclo).
- `licenses` — 1 por líder, com ativação/suspensão/expiração.
- `invoices`, `payments`, `revenue_splits` (Neo 70% / R2D2 30%).
- `payment_provider_accounts` (Stripe/Asaas).

### Conteúdo & biblioteca
- `contents` (artigos, vídeos, playbooks), `content_categories`.
- `campaigns` (comunicações), `notifications`.

### Governança
- `audit_logs`, `feature_flags`, `system_settings`, `webhook_events`.

---

## 5. Relacionamentos Chave

- `organization` 1—N `memberships` N—1 `user`; role determina painel.
- `leader (membership)` 1—N `collaborators (memberships)` via `team_members`.
- Todo dado operacional (`ritual_instances`, `pdi`, `feedbacks`, `indicators`, `ai_insights`, `check_ins`) carrega `organization_id` para RLS.
- `franchise_id` em `organizations` permite ao franqueado ver sua carteira.
- `subscription` → `plan` → `plan_features` controla módulos ativos por tenant.

---

## 6. Permissões (RBAC + RLS)

Roles em `user_roles` (tabela separada) + função `has_role(_user_id, _role)` `SECURITY DEFINER`. Escopo por tenant via `is_member_of(org_id)` também `SECURITY DEFINER`.

| Role | Escopo | Pode |
|---|---|---|
| `super_admin` (R2D2) | Global | Tudo: empresas, franquias, planos, split, IA global, logs |
| `neo_admin` | Neo Pessoas | Metodologia, conteúdos, franqueados, dashboard executivo |
| `franchise_admin` | Sua carteira | Cadastrar empresas/líderes, ver receitas, dashboards |
| `company_admin` | 1 organization | Configurar empresa, áreas, líderes, KPIs, planos |
| `leader` | Sua equipe | Rituais, PDI, feedbacks, 1:1, delegações, indicadores da equipe |
| `collaborator` | Ele mesmo | PDI próprio, check-ins, feedbacks recebidos, IA coach |

Toda tabela `public.*` recebe **GRANTs explícitos** + RLS habilitado + policies por role/tenant.

---

## 7. Módulos (feature flags por plano)

1. **Consciência** — autodiagnóstico do líder, perfil comportamental, CORE Score pessoal.
2. **Organização** — rituais, agenda de liderança, delegações, 1:1s.
3. **Resultado** — OKRs, KPIs, dashboards de execução.
4. **Evolução** — PDI, feedbacks, biblioteca, IA Coach, trilhas.

Cada módulo é ativado/desativado por `plan_features`. Planos: Essencial, Pro, Premium, IA.

---

## 8. Navegação por Persona

### Super Admin (R2D2)
Sidebar: Visão Geral · Empresas · Franquias · Planos & Licenças · Financeiro & Split · IA Global (tokens/consumo) · Segurança & Logs · Configurações.

### Neo Pessoas
Sidebar: Executivo · Franqueados · Empresas · Metodologia · Rituais & Templates · Biblioteca · Cursos · IA Coach · Campanhas · Notificações.

### Franqueado
Sidebar: Dashboard Comercial · Dashboard Operacional · Empresas · Líderes · Licenças · Receitas.

### Empresa (company_admin)
Sidebar: Visão da Empresa · Organograma · Áreas & Filiais · Líderes · Colaboradores · KPIs & Metas · Rituais · PDIs · Plano & Licenças.

### Líder (coração do produto)
**Home = "Quem precisa da minha atenção?"** — cards priorizados pela IA, não gráficos.
Sidebar: Hoje · Minha Equipe · Rituais · 1:1s · Feedbacks · Delegações · PDIs · Indicadores · CORE Score · IA Coach.

### Colaborador
Sidebar: Meu Dia · Meus Objetivos · Meu PDI · Feedbacks · Check-ins · Conversas · Desenvolvimento · IA.

---

## 9. IA — Arquitetura

- **Gateway abstrato** com providers plugáveis; token default = Neo Pessoas; empresa pode plugar próprio token.
- **Features de IA:** priorização de atenção do líder, sugestões de pauta 1:1, resumo de feedbacks, análise de sentimento em check-ins, geração de PDI, alertas de risco (turnover, disengagement), CORE Score.
- **Contabilização:** cada chamada → `ai_usage` com tenant, feature, tokens, custo. Limites por plano em `ai_limits`.
- Chamadas sempre em `createServerFn` — chave nunca no cliente.

---

## 10. Financeiro

- Stripe seamless como default; abstração `payment_provider` permite Asaas.
- Webhooks em `src/routes/api/public/webhooks/stripe.ts` com verificação HMAC.
- `revenue_splits`: 70% Neo Pessoas / 30% R2D2, calculado por fatura paga.
- Ciclo: assinatura → licença por líder → suspensão automática em inadimplência → upgrade/downgrade em pró-rata.

---

## 11. UX / Design System

- Tokens `oklch` em `src/styles.css` (light + dark).
- Tipografia: display serifado sutil + sans neutra (não Inter/Poppins default).
- Paleta: base off-white/graphite, acento único forte (não roxo genérico).
- Layouts: muita respiração, densidade calculada nas telas de líder, cards de ação (não formulários) na home.
- Componentes: shadcn customizados via variantes (`hero`, `attention`, `ritual`, `core-score`).
- Mobile-first, dark-mode-ready desde o início.

---

## 12. Estrutura Técnica de Rotas (TanStack Start)

```text
src/routes/
  __root.tsx
  index.tsx                       → landing institucional (lidercore.com.br)
  auth.tsx                        → login/signup/SSO
  _authenticated/
    route.tsx                     → gate (managed)
    app.tsx                       → shell (sidebar por persona)
    app.index.tsx                 → redireciona conforme role
    super/…                       → R2D2
    neo/…                         → Neo Pessoas
    franchise/…                   → Franqueado
    company/…                     → Empresa
    leader/                       → Líder (home = atenção)
      index.tsx, team.tsx, rituals.tsx, one-on-ones.tsx,
      feedbacks.tsx, delegations.tsx, pdis.tsx,
      indicators.tsx, core-score.tsx, ai.tsx
    me/…                          → Colaborador
  api/public/webhooks/stripe.ts   → billing
```

---

## 13. Roadmap de Implementação (após aprovação)

1. **Fundações:** Lovable Cloud on, schema base (orgs, memberships, roles, RLS), auth + login social, design system, shell autenticado com sidebar dinâmica por role.
2. **Persona Líder (MVP do coração):** Home "atenção", rituais, 1:1, feedbacks, delegações, PDI, indicadores, CORE Score.
3. **Empresa & Franquia:** cadastros, organograma, dashboards.
4. **Neo Pessoas & Super Admin:** metodologia, planos, licenças, split.
5. **IA:** gateway, features de diagnóstico, contabilização.
6. **Billing:** Stripe + webhooks + licenças automáticas.
7. **Colaborador & biblioteca:** experiência simplificada + conteúdos.

---

## Próximo passo

Confirme (ou ajuste) esta arquitetura — hierarquia, entidades, roles, módulos, navegação e roadmap. Assim que aprovada, começo pela **Fase 1 (Fundações + shell + design system)** e sigo pela **Persona Líder** como MVP.

---

## 14. Reconciliação com a Especificação Funcional (PDF oficial)

O PDF `Lider_CORE_Especificacao_Funcional.pdf` confirma a arquitetura acima e adiciona **regras não-negociáveis** que passam a governar o produto:

### 14.1 Regra de ouro
> "Toda informação que pode ser inferida a partir do uso do sistema NÃO deve ser pedida como formulário de autoavaliação."

O líder registra **fatos operacionais** (rituais, entregas, feedbacks, indicadores). O sistema **infere** maturidade, risco e sabotadores ativos. Nenhuma tela de autoavaliação semanal.

### 14.2 Metáfora da bicicleta (arquitetura de dados)
- **R** (roda traseira / tração): planejamento, indicadores, fatos.
- **C** (roda dianteira / direção): perfil, maturidade, leitura humana.
- **O** (eixo): rituais e comunicação — sem eixo, as rodas não andam.
- **E** (velocímetro): mede sustentação ao longo do tempo, não pedala.

**Implicação:** os 4 módulos compartilham **uma única base de dados** — quatro leituras sobre o mesmo conjunto de fatos. Isso reforça o `organization_id` universal + views especializadas por módulo.

### 14.3 Ajustes por módulo

**C — Consciência**
- Assessment comportamental (Big Five/DISC + sabotadores + egograma) — **1 vez** ou a cada 90 dias, nunca semanal.
- Feature central: **alertas cruzados** — o sistema combina queda de rituais (O) + perfil (C) para gerar leitura comportamental automática. Ex.: "seus rituais caíram 40% — combina com seu padrão de controle sob pressão".
- Visibilidade: perfil detalhado é **foro íntimo** do líder; empresa vê apenas "mapeado sim/não".

**O — Organização**
- **Mapa da Área** (config inicial, revisão trimestral): propósito, entregas, indicadores.
- Rituais com marcação **1 toque** (feito / não feito) — não relatório.
- Registro de decisão por ritual é **opcional e curto** (texto livre), nunca questionário.

**R — Resultado**
- Indicadores em **3 níveis**: área, individuais, liderança.
- **Indicador de concentração** ("carga na própria mão"): % de entregas ativas sob responsabilidade direta do líder. Acima de **30%** → alerta automático de centralização.
- Delegações com combinado registrado 1 vez (o quê, quem, prazo, critério de feito); status muda automaticamente pelo prazo.

**E — Evolução**
- **CORE Score** = 100% calculado a partir dos outros 3 módulos. Nenhuma pergunta de autoavaliação alimenta o score diretamente.
- Radar de maturidade + evolução mensal + plano de desenvolvimento.

### 14.4 Visão da Empresa (RH/Diretoria) — limite de visibilidade
A empresa **NÃO vê**:
- Conteúdo de 1:1s;
- Feedbacks individuais em texto;
- Perfil comportamental detalhado;
- Registro de conversas difíceis.

A empresa vê **agregados**: adesão a rituais, saúde geral, CORE Score consolidado, quantidade (não conteúdo) de feedbacks/conversas. **Esse limite é o que sustenta a confiança do líder no sistema** — sem ele, o produto vira ferramenta de avaliação e perde a função.

### 14.5 Modelos de conversa (Módulo E — Feedbacks)
Templates prontos para: feedback positivo, corretivo, alinhamento, cobrança, conflito, desligamento, reconhecimento. Baseados em: firmeza com amor · verdade sem dureza · afeto sem permissividade. Diagnóstico: técnico / emocional / relacional / governança. Referência: 5 disfunções de equipes (Lencioni).

### 14.6 Faseamento oficial (substitui roadmap anterior)
1. **Fase 1 — Esqueleto operacional**: Módulo O (mapa da área + rituais feito/quebrado).
2. **Fase 2 — Fatos de gestão**: Módulo R (indicadores, delegações, indicador de concentração).
3. **Fase 3 — Leitura humana**: Módulo C (assessment + alertas cruzados).
4. **Fase 4 — Sustentação + empresa**: Módulo E (CORE Score + diagnóstico automático) + dashboard executivo.

**Critério de avanço:** cada fase validada com pequeno grupo de líderes reais por **3-4 semanas de uso sustentado** — não aprovação em demo.

### 14.7 Divergências com o plano anterior (resolvidas a favor do PDF)
- ✅ Removido: telas de autoavaliação semanal → substituídas por **inferência** a partir de fatos.
- ✅ Ajustado: CORE Score deixa de ser um input e passa a ser **100% derivado**.
- ✅ Adicionado: **indicador de concentração** e **alertas cruzados** como features centrais.
- ✅ Reforçado: limites de visibilidade da empresa (RH/diretoria não vê detalhe operacional).
- ✅ Reordenado: roadmap agora começa por **Módulo O** (esqueleto operacional), não por dashboard genérico.

### 14.8 Impacto imediato no código
- A home atual do líder (`/app`) já segue o princípio "quem precisa da atenção agora" ✅.
- As stubs de rituais / delegações / indicadores / feedbacks / PDIs / IA permanecem — serão implementadas nesta ordem de fases.
- O schema precisa incluir: `area_map`, `ritual_templates` × `ritual_instances`, `delegations` com auto-status por prazo, `assessments` (1 por 90d), `ai_cross_alerts`, e a função de cálculo do `core_score`.
