import { createFileRoute } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/methodology")({
  component: Page,
});

const TYPES = [
  { value: "competencia", label: "Competência" },
  { value: "valor", label: "Valor" },
  { value: "pilar", label: "Pilar" },
  { value: "modulo_core", label: "Módulo C.O.R.E." },
  { value: "ritual", label: "Ritual" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "modelo_lideranca", label: "Modelo de liderança" },
  { value: "comp_tecnica", label: "Competência técnica" },
  { value: "comp_comportamental", label: "Competência comportamental" },
  { value: "comp_emocional", label: "Competência emocional" },
];

function Page() {
  return (
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Metodologia"
      description="Administre competências, valores, pilares, rituais e todos os artefatos da metodologia Neo. Cada alteração gera versão auditável."
      endpoint="/admin/neo/methodology-items"
      entityLabel="item"
      help={{
        what:
          "É o dicionário oficial da metodologia Neo: competências, valores, pilares, módulos C.O.R.E., rituais e ferramentas. Tudo o que o app e a IA consideram 'verdade da metodologia' nasce aqui.",
        why: [
          "Alimenta o contexto da IA (coach, análises de assessment e recomendações).",
          "Define as competências usadas no radar, no 9-Box e nos PDIs dos líderes.",
          "Padroniza a linguagem: o app do líder exibe estes nomes e descrições.",
          "Cada alteração gera versão auditável, então dá para evoluir sem perder histórico.",
        ],
        steps: [
          "Clique em Novo e escolha o Tipo (competência, valor, pilar, ritual…).",
          "Preencha Nome, Descrição e Objetivo com a linguagem que o líder deve ler no app.",
          "Use Categoria e Tags para agrupar (ex.: 'Consciência', 'Heart', 'liderança').",
          "Defina a Ordem para controlar a sequência de exibição nas telas.",
          "Deixe em Rascunho enquanto valida e mude para Ativo para publicar ao app.",
        ],
        examples: [
          "Competência: Autoconsciência",
          "Pilar: Consciência (C)",
          "Ritual: 1:1 quinzenal",
          "Valor: Verdade com cuidado",
        ],
        tips: [
          "Só itens com status Ativo aparecem para os líderes e para a IA.",
          "Escreva a Descrição pensando em quem vai ler: o líder, não o time técnico.",
          "Arquive em vez de excluir para manter o histórico das avaliações antigas.",
        ],
      }}
      filterField="type"
      filterOptions={TYPES}
      defaultValues={{ type: "competencia", status: "active", orderIndex: 0, tags: [] }}
      fields={[
        { kind: "select", name: "type", label: "Tipo", options: TYPES },
        { kind: "text", name: "name", label: "Nome", required: true },
        { kind: "text", name: "category", label: "Categoria", placeholder: "opcional" },
        { kind: "textarea", name: "description", label: "Descrição", rows: 3 },
        { kind: "textarea", name: "objective", label: "Objetivo", rows: 2 },
        { kind: "tags", name: "tags", label: "Tags" },
        { kind: "number", name: "orderIndex", label: "Ordem" },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "type", label: "Tipo", render: (it) => TYPES.find((t) => t.value === it.type)?.label ?? String(it.type) },
        { key: "status", label: "Status" },
        { key: "orderIndex", label: "Ordem" },
      ]}
    />
  );
}