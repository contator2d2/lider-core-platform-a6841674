// Catálogo global de features do app. Cada módulo declara aqui suas
// sub-funções e as ações (view/edit/export) que fazem sentido.
// Isto alimenta a UI de templates (admin) e o resolvedor de gates.

export type FeatureAction = "view" | "edit" | "export";

export interface FeatureDef {
  key: string;
  label: string;
  description?: string;
  actions: FeatureAction[];
}

export interface ModuleDef {
  code: string; // bate com ProductModule.code
  name: string;
  features: FeatureDef[];
}

export const FEATURE_CATALOG: ModuleDef[] = [
  {
    code: "consciencia",
    name: "Consciência",
    features: [
      {
        key: "consciencia.profile",
        label: "Perfil do líder",
        description: "Papel declarado, DISC/MBTI, estilo de comunicação, notas.",
        actions: ["view", "edit"],
      },
      {
        key: "consciencia.hsh",
        label: "Lente Hard · Soft · Heart",
        description: "Autoavaliação nas três dimensões da liderança.",
        actions: ["view", "edit"],
      },
      {
        key: "consciencia.sabotages",
        label: "Sabotadores",
        description: "Padrões internos que atrapalham a liderança.",
        actions: ["view", "edit"],
      },
      {
        key: "consciencia.risks",
        label: "Riscos comportamentais declarados",
        description: "Flags como controle, evita conflito, cobrança dura.",
        actions: ["view", "edit"],
      },
      {
        key: "consciencia.assessment_wizard",
        label: "Assessment guiado (5 passos)",
        description: "Fluxo passo a passo do módulo C.",
        actions: ["view"],
      },
      {
        key: "consciencia.commitments",
        label: "Compromissos de mentoria",
        description: "Frases-âncora ativas do líder.",
        actions: ["view", "edit"],
      },
      {
        key: "consciencia.cross_signals",
        label: "Alertas cruzados",
        description: "Motor que cruza perfil com rituais/delegações.",
        actions: ["view"],
      },
      {
        key: "consciencia.coverage",
        label: "Cobertura organizacional (agregada)",
        description: "Somente contagem — nunca conteúdo íntimo.",
        actions: ["view", "export"],
      },
    ],
  },
];

// Defaults por role — usados no bootstrap para semear templates.
// true = ligado; ausente = false.
type Role = "super_admin" | "neo_admin" | "franchise_owner" | "hr_admin" | "leader" | "collaborator";

export const TEMPLATE_DEFAULTS: Record<Role, { name: string; description: string; enabled: Partial<Record<string, FeatureAction[]>> }> = {
  super_admin: {
    name: "Super Admin",
    description: "Acesso completo — visualiza, edita e exporta tudo.",
    enabled: {
      "consciencia.profile": ["view", "edit"],
      "consciencia.hsh": ["view", "edit"],
      "consciencia.sabotages": ["view", "edit"],
      "consciencia.risks": ["view", "edit"],
      "consciencia.assessment_wizard": ["view"],
      "consciencia.commitments": ["view", "edit"],
      "consciencia.cross_signals": ["view"],
      "consciencia.coverage": ["view", "export"],
    },
  },
  neo_admin: {
    name: "Neo Admin",
    description: "Administração da plataforma — visão agregada.",
    enabled: {
      "consciencia.coverage": ["view", "export"],
    },
  },
  franchise_owner: {
    name: "Gestor / Franqueado",
    description: "Vê o próprio perfil e cobertura agregada do time.",
    enabled: {
      "consciencia.profile": ["view", "edit"],
      "consciencia.hsh": ["view", "edit"],
      "consciencia.assessment_wizard": ["view"],
      "consciencia.commitments": ["view", "edit"],
      "consciencia.cross_signals": ["view"],
      "consciencia.coverage": ["view"],
    },
  },
  hr_admin: {
    name: "RH / Consultor",
    description: "Foco em cobertura agregada. Sem conteúdo íntimo.",
    enabled: {
      "consciencia.coverage": ["view", "export"],
    },
  },
  leader: {
    name: "Líder",
    description: "Uso individual — auto-conhecimento completo.",
    enabled: {
      "consciencia.profile": ["view", "edit"],
      "consciencia.hsh": ["view", "edit"],
      "consciencia.sabotages": ["view", "edit"],
      "consciencia.risks": ["view", "edit"],
      "consciencia.assessment_wizard": ["view"],
      "consciencia.commitments": ["view", "edit"],
      "consciencia.cross_signals": ["view"],
    },
  },
  collaborator: {
    name: "Colaborador",
    description: "Perfil individual básico, sem alertas cruzados.",
    enabled: {
      "consciencia.profile": ["view", "edit"],
      "consciencia.hsh": ["view", "edit"],
      "consciencia.commitments": ["view", "edit"],
    },
  },
};