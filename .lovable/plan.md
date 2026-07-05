# Plano — LÍDER C.O.R.E. / Neo Leader — Arquitetura Multi-Tenant Completa

## 1. Visão geral da hierarquia

```text
SUPER ADMIN (Neo Pessoas + R2D2)
   │
   ├── Franquias (tenants regionais / parceiros)
   │      │
   │      ├── Colaboradores da franquia (consultores, admins locais)
   │      │
   │      └── Empresas vinculadas
   │             │
   │             ├── Colaboradores da empresa (RH, gestores)
   │             └── Líderes (usuários finais avaliados)
   │
   └── Empresas diretas (sem franquia) + seus líderes
```

Cada nível tem seu próprio painel, permissões e escopo de dados.

---

## 2. Papéis (roles) e permissões

**Globais (tabela `user_roles`):**
- `super_admin` — Neo Pessoas. Vê tudo.
- `neo_admin` — staff Neo (suporte, financeiro).

**Por franquia (tabela `franchise_members`):**
- `franchise_owner` — dono da franquia
- `franchise_admin` — gestão da franquia
- `franchise_consultant` — consultor operacional

**Por empresa (tabela `memberships`, já existe — expandir):**
- `company_owner` — dono/RH principal
- `company_admin` — gestor de pessoas
- `company_manager` — líder de área (vê seu time)
- `leader` — líder final (só vê a si mesmo)

Cada permissão granular (ver dashboard, cadastrar líder, exportar, etc.) fica em um objeto de capabilities derivado do role — configurável pelo super admin no futuro.

---

## 3. Painéis por perfil

### 3.1 Super Admin (`/admin`)
- **Franquias**: criar, editar, suspender, transferir empresas.
- **Empresas diretas**: cadastrar empresas sem franquia.
- **Usuários globais**: promover super_admins, ver todos os usuários, resetar senha.
- **Planos & Preços**: criar planos (Essencial, Pro, Enterprise), definir limites (nº de líderes, nº de empresas, features).
- **Licenças & Cobrança**: atribuir plano a franquia/empresa, ciclo (mensal/anual), status (trial/ativo/inadimplente/cancelado), histórico de faturas.
- **Provedor de IA**: escolher provider padrão (OpenAI, Gemini, Lovable AI), configurar chaves, modelo, limites de tokens por plano.
- **Branding global**: logo, cores, favicon, e-mails transacionais.
- **Metodologia**: gerir competências C.O.R.E., escalas, avaliações, templates de PDI.
- **Apps & Versões**: controlar release da versão web, versão desktop (Electron), mobile.
- **Analytics global**: MRR, uso de IA, líderes ativos, franquias top.

### 3.2 Franquia (`/franchise`)
- Dashboard consolidado: empresas vinculadas, líderes ativos, evolução média.
- Cadastrar colaboradores da franquia (com role interno).
- Cadastrar empresas e vincular à franquia.
- Cadastrar/convidar líderes das empresas.
- Ver consumo de IA e status do plano da franquia.
- Branding secundário (co-branding permitido pelo super admin).

### 3.3 Empresa (`/company`)
- Cadastrar colaboradores (RH, gestores).
- Cadastrar líderes (usuários finais).
- Ver dashboard agregado da empresa.
- Configurar quais módulos ficam disponíveis para cada líder.

### 3.4 Líder (`/app`) — já existe
- Dashboard pessoal, PDI, IA Coach, feedbacks, indicadores, rituais.

---

## 4. Modelo de dados (novas tabelas)

Estado atual: já existem `organizations`, `memberships`, `profiles`, `user_roles` (roles `super_admin`, `neo_admin`, `collaborator`), `has_role`, `is_org_member`.

**Novas tabelas:**

- `franchises` — id, name, slug, cnpj, owner_user_id, plan_id, status, branding (jsonb), created_at.
- `franchise_members` — franchise_id, user_id, role (`owner`|`admin`|`consultant`), unique(franchise_id, user_id).
- `plans` — id, name, slug, price_monthly, price_yearly, limits (jsonb: max_companies, max_leaders, max_ai_tokens, features[]), active.
- `subscriptions` — id, owner_type (`franchise`|`organization`), owner_id, plan_id, status (`trial`|`active`|`past_due`|`canceled`), current_period_start/end, cancel_at, provider (`stripe`|`manual`), provider_customer_id, provider_subscription_id.
- `invoices` — id, subscription_id, amount_cents, currency, status, due_date, paid_at, provider_invoice_id, pdf_url.
- `ai_settings` — scope (`global`|`franchise`|`organization`), scope_id, provider (`openai`|`gemini`|`lovable_ai`), model, api_key_secret_ref, monthly_token_limit, temperature.
- `ai_usage` — organization_id, franchise_id, user_id, provider, model, prompt_tokens, completion_tokens, cost_cents, created_at.
- `branding` — scope (`global`|`franchise`|`organization`), scope_id, logo_url, primary_color, accent_color, favicon_url, email_from_name.
- `methodology_competencies` — id, code, name, description, weight, order.
- `apps_releases` — platform (`web`|`desktop`|`mobile`), version, channel (`stable`|`beta`), release_notes, published_at, download_url.
- `audit_log` — actor_user_id, action, target_type, target_id, metadata (jsonb), created_at.

**Alterações:**
- `organizations`: já tem `franchise_id` — garantir FK para `franchises.id` (hoje é texto solto).
- `app_role` enum: adicionar `neo_admin` (se ainda não existir), papéis de franquia ficam em tabela própria.
- `memberships.role`: enum próprio (`company_owner`|`company_admin`|`company_manager`|`leader`).

**RLS + GRANTs** para todas as novas tabelas, com funções `SECURITY DEFINER`: `is_franchise_member(uid, fid)`, `is_franchise_admin(uid, fid)`, `has_plan_feature(org_id, feature)`.

---

## 5. Cobrança & IA

- **Cobrança**: iniciar com registro manual (super admin marca `paid`), estrutura pronta para Stripe/Paddle depois. Webhook opcional na fase 2.
- **IA**: chaves guardadas em secrets do backend (`OPENAI_API_KEY`, `GEMINI_API_KEY`). `ai_settings` diz qual usar por escopo. Toda chamada de IA passa por um wrapper que:
  1. Resolve provider/model conforme escopo (org → franchise → global).
  2. Checa `monthly_token_limit` vs `ai_usage`.
  3. Registra uso em `ai_usage` (para billing e dashboard).

---

## 6. UI — novas rotas

```text
/admin                          já existe (super admin)
/admin/franchises               lista + criar
/admin/franchises/$id           detalhe (empresas, membros, plano)
/admin/organizations            empresas diretas + todas
/admin/organizations/$id
/admin/users                    usuários globais + roles
/admin/plans                    CRUD de planos
/admin/subscriptions            licenças ativas + cobrança
/admin/invoices
/admin/ai                       provedor IA, chaves, limites
/admin/branding
/admin/methodology              competências C.O.R.E.
/admin/apps                     releases web/desktop/mobile
/admin/analytics

/franchise                      dashboard da franquia
/franchise/members
/franchise/companies
/franchise/companies/$id/leaders
/franchise/billing
/franchise/branding

/company                        dashboard da empresa
/company/members
/company/leaders
/company/settings

/app/*                          já existe (líder)
```

Guardas: `_authenticated` já existe. Adicionar `_admin`, `_franchise`, `_company` como layouts pathless que checam role antes de renderizar.

---

## 7. Fases de entrega

**Fase 1 — Fundação (esta primeira migration + backend)**
- Migration com todas as tabelas novas + RLS + GRANTs + funções auxiliares.
- Seed do plano padrão ("Essencial") e do super admin (já existe).
- Endpoints REST no backend Express: `/admin/franchises`, `/admin/plans`, `/admin/subscriptions`, `/admin/users`, `/admin/ai`, `/admin/stats` (expandir), `/franchises/:id/*`, `/organizations/:id/*`.

**Fase 2 — Painel Super Admin**
- Telas `/admin/franchises`, `/admin/organizations`, `/admin/users`, `/admin/plans`, `/admin/subscriptions`.
- CRUD completo + tabelas com filtros e paginação.

**Fase 3 — Painel Franquia**
- Rotas `/franchise/*`, cadastro de empresas e líderes, dashboard consolidado.

**Fase 4 — Painel Empresa**
- Rotas `/company/*`, cadastro de líderes, permissões internas.

**Fase 5 — IA, Branding, Metodologia**
- Wrapper de IA com roteamento por provider + medidor de tokens.
- Branding por escopo aplicado no runtime (CSS vars).
- Editor de competências C.O.R.E.

**Fase 6 — Cobrança real**
- Integração Stripe (checkout, webhooks, invoices).
- Página pública de planos.

**Fase 7 — Apps & Desktop**
- Página `/admin/apps` com releases.
- Empacotamento Electron (repositório separado, mesmo backend).

---

## 8. O que preciso confirmar antes de codar

1. **Cobrança**: começamos com registro manual + estrutura pronta para Stripe (recomendado) ou já integrar Stripe agora?
2. **IA**: quer que eu já suba o wrapper suportando OpenAI + Gemini + Lovable AI, ou só a estrutura de config nesta fase?
3. **Desktop**: só a página de releases agora, ou já quer o projeto Electron iniciado?
4. **Ordem**: começo pela Fase 1 (migration + backend) e Fase 2 (painel super admin completo) neste ciclo? Ou prefere outra prioridade?

Confirme os 4 pontos e eu já sigo com a Fase 1 + 2 numa tacada.
