/**
 * Catálogo central de features do app.
 * Sempre que criar uma nova funcionalidade, adicione uma entrada aqui —
 * o Super Admin poderá marcá-la em qualquer plano na tela /admin/plans.
 *
 * `key` é o identificador salvo no array `features` de cada Plan (Prisma).
 */

export type FeatureCategory =
  | "core"
  | "leader"
  | "ai"
  | "hr"
  | "analytics"
  | "branding"
  | "integrations"
  | "support";

export type FeatureDef = {
  key: string;
  label: string;
  description: string;
  category: FeatureCategory;
};

export const FEATURE_CATEGORIES: Record<FeatureCategory, string> = {
  core: "Essencial",
  leader: "Liderança",
  ai: "Inteligência Artificial",
  hr: "RH & Pessoas",
  analytics: "Relatórios & Analytics",
  branding: "Branding & Personalização",
  integrations: "Integrações",
  support: "Suporte & SLA",
};

export const PLAN_FEATURES: FeatureDef[] = [
  // Core
  { key: "dashboard_lider", label: "Dashboard do Líder", description: "Visão geral com indicadores C.O.R.E.", category: "core" },
  { key: "avaliacao_core", label: "Avaliação C.O.R.E.", description: "Metodologia proprietária de avaliação de competências.", category: "core" },
  { key: "pdi", label: "Plano de Desenvolvimento Individual", description: "PDIs por colaborador.", category: "core" },
  { key: "team", label: "Gestão de Time", description: "Cadastro e organização de liderados.", category: "core" },

  // Liderança
  { key: "one_on_ones", label: "1:1 estruturados", description: "Templates e histórico de 1:1s.", category: "leader" },
  { key: "feedbacks", label: "Feedbacks contínuos", description: "Ciclo de feedback entre líder e liderado.", category: "leader" },
  { key: "delegations", label: "Delegações", description: "Delegue tarefas com acompanhamento.", category: "leader" },
  { key: "rituals", label: "Rituais de gestão", description: "Cadência de reuniões, dailies e reviews.", category: "leader" },
  { key: "indicators", label: "Indicadores personalizados", description: "KPIs por líder e por time.", category: "leader" },

  // AI
  { key: "ai_coach", label: "IA Coach", description: "Assistente de coaching para líderes.", category: "ai" },
  { key: "ai_feedback", label: "Feedback assistido por IA", description: "Sugestões de feedback e planos de ação.", category: "ai" },
  { key: "ai_reports", label: "Insights automáticos", description: "Resumos de time gerados por IA.", category: "ai" },

  // HR
  { key: "hr_admin", label: "Painel de RH", description: "Visão do RH com toda a organização.", category: "hr" },
  { key: "org_dashboard", label: "Dashboard Empresa", description: "Consolidado por empresa/franquia.", category: "hr" },
  { key: "onboarding", label: "Onboarding guiado", description: "Fluxo de entrada de novos líderes.", category: "hr" },

  // Analytics
  { key: "reports_export", label: "Exportação de relatórios", description: "CSV/PDF de indicadores.", category: "analytics" },
  { key: "benchmarks", label: "Benchmarks C.O.R.E.", description: "Comparativo com média da rede.", category: "analytics" },

  // Branding
  { key: "custom_branding", label: "Branding próprio", description: "Logo, cores e domínio da franquia.", category: "branding" },
  { key: "custom_methodology", label: "Metodologia customizada", description: "Editar competências da franquia.", category: "branding" },
  { key: "email_templates", label: "Templates de email", description: "Personalizar comunicações enviadas.", category: "branding" },

  // Integrações
  { key: "sso", label: "SSO / SAML", description: "Login único corporativo.", category: "integrations" },
  { key: "api_access", label: "Acesso à API", description: "Endpoints REST para integrações.", category: "integrations" },
  { key: "webhooks", label: "Webhooks", description: "Eventos enviados a sistemas externos.", category: "integrations" },

  // Support
  { key: "email_support", label: "Suporte por email", description: "Atendimento em até 48h.", category: "support" },
  { key: "priority_support", label: "Suporte prioritário", description: "Atendimento em até 4h úteis.", category: "support" },
  { key: "sla_dedicado", label: "SLA dedicado", description: "Gerente de conta e SLA contratual.", category: "support" },
];

export const FEATURES_BY_CATEGORY: Array<{ category: FeatureCategory; label: string; items: FeatureDef[] }> =
  (Object.keys(FEATURE_CATEGORIES) as FeatureCategory[]).map((category) => ({
    category,
    label: FEATURE_CATEGORIES[category],
    items: PLAN_FEATURES.filter((f) => f.category === category),
  }));

export function findFeature(key: string): FeatureDef | undefined {
  return PLAN_FEATURES.find((f) => f.key === key);
}

export const DEFAULT_LIMIT_FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: "max_leaders", label: "Máx. líderes", hint: "vazio = ilimitado" },
  { key: "max_companies", label: "Máx. empresas", hint: "vazio = ilimitado" },
  { key: "max_ai_tokens", label: "Tokens IA / mês", hint: "vazio = ilimitado" },
  { key: "max_storage_mb", label: "Armazenamento (MB)", hint: "vazio = ilimitado" },
];