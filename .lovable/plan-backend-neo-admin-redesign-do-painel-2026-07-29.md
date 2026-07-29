# Backend Neo Admin + Redesign do Painel

Construir a camada de inteligência da Neo (10 módulos administrativos) sobre o backend Express+Prisma+Postgres já existente, e redesenhar o painel `/admin` com uma identidade nova, moderna, editorial — sem cara de IA.

## Entrega em 4 fases

Cada fase termina implantável. Sem migrations manuais: schema sincroniza no boot (`prisma db push` no Dockerfile) e dados iniciais em `bootstrap*` no `api/src/index.ts`.

### Fase A — Fundações (Metodologia + Auditoria + Versionamento)

- Novo schema Prisma para:
  - `MethodologyItem` (tipo: competencia, valor, pilar, modulo_core, ritual, ferramenta, modelo_lideranca, comp_tecnica, comp_comportamental, comp_emocional)
  - Campos: nome, categoria, descricao, objetivo, conteudo (rich JSON), tags[], ordem, status, versao
  - `MethodologyItemVersion` (snapshot completo por versão, autor, timestamp, comentário)
  - `AuditEntry` genérico (entidade, entidadeId, acao, atorId, diff JSON, timestamp) — usado por todos os módulos
- Rotas `/admin/methodology-items` (CRUD + `/versions` + `/restore/:v`)
- Helper `withAudit()` reutilizável para todas as futuras entidades
- Substitui o `MethodologyCompetency` atual mantendo compatibilidade (migração de dados no bootstrap)

### Fase B — Knowledge Builder + Templates + Biblioteca de Assessments

- `KnowledgeItem` (conceito, playbook, boa_pratica, caso, tecnica, exercicio, leitura, video, ferramenta, template, modelo_feedback, modelo_pdi, ritual)
  - categoria, tags[], competenciasIds[], moduloCore, dificuldade, publicoAlvo, autor, versao, dataRevisao, status
  - full-text search via `pg_trgm` (índice GIN)
- `Template` (feedback, pdi, exercicio, one_on_one, plano, checklist, avaliacao) com corpo em JSON estruturado
- `Assessment` (metadata: nome, objetivo, publico, competencia, categoria, tempoEstimado, frequencia, peso, moduloCore, status, versao)
- Rotas `/admin/knowledge`, `/admin/templates`, `/admin/assessments` com versionamento e auditoria via helper da Fase A

### Fase C — Assessment Builder + Construtor de Jornadas + CORE DNA + Recommendation Engine

- `AssessmentBlock` → `AssessmentQuestion` (tipo: unica, multipla, likert, slider, ranking, texto, cenario, autoavaliacao) → `AssessmentOption`
  - condicionais (mostrar_se: {questaoId, operador, valor}), pesos, ramificações, ordem, randomização
- `Journey` → `JourneyStep` (tipo: assessment, video, texto, exercicio, quiz, documento, pdi, conteudo, aprovacao), com pré-requisitos e ordem
- `LeaderDNA` + `LeaderDNAEvent` (append-only): competências, scores, tendências, perfil comportamental/emocional/técnico, comunicação, forças, melhorias — toda mudança gera evento, nunca sobrescreve
- `Recommendation` gerada por regras cruzando DNA × Competência × Assessment × Jornada × PDI × Resultado (sem IA)
- Rotas admin CRUD + endpoints de execução para o app do líder

### Fase D — IA Knowledge Layer + Redesign completo do painel

- Endpoint `/ai/context` que monta o contexto a partir de: Metodologia, Competências, DNA do líder, Assessments respondidos, Jornada ativa, Histórico, Conteúdos relevantes, Playbooks, Templates, Recomendações. Todas as chamadas de IA do sistema passam a incluir esse contexto.
- **Redesign do painel `/admin`** com nova identidade:
  - Layout editorial: sidebar clara e estreita, tipografia serif fina nos títulos (Fraunces) + sans neutra no corpo (Instrument Sans), muito espaço em branco, sem gradientes coloridos, sem ícones "IA"
  - Novo shell `AdminShell` com breadcrumbs, comando `⌘K` (Cmd+K palette), busca global sobre metodologia+knowledge+assessments
  - Cards com bordas hairline, hover sutil, tabelas densas estilo Linear/Notion
  - Página inicial do admin vira um "briefing" com números-chave e atalhos para as 10 áreas
  - Menu reorganizado em 4 grupos: **Neo (metodologia, knowledge, assessments, jornadas, templates)** · **Clientes (franquias, organizações, planos, licenças)** · **Sistema (IA, branding, apps, dados)** · **Auditoria (logs, versões)**

## Detalhes técnicos

- Migrations: nenhuma. Schema evolui via `prisma db push` no Dockerfile. Dados semente em `bootstrapMethodology`, `bootstrapKnowledge`, `bootstrapAssessments` chamados no `app.listen`.
- Auditoria: middleware `withAudit(entity)` intercepta create/update/delete e grava `AuditEntry` com diff.
- Versionamento: qualquer item versionado (metodologia, knowledge, assessment, journey, template) tem tabela `<Entidade>Version` com snapshot completo e endpoint `POST /restore/:versao`.
- RBAC: rotas admin já protegidas por `requireRoles("super_admin", "neo_admin")`. Auditoria e versionamento não expõem para outros roles.
- Frontend admin usa apenas tokens semânticos do design system; nova paleta em `src/styles.css` (mode admin).

## Fora do escopo desta entrega

- App do líder não muda (só consome os novos endpoints quando existirem).
- Sem migração destrutiva: `MethodologyCompetency` continua funcionando; novos itens vão para `MethodologyItem`.
