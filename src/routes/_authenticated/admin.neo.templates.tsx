import { createFileRoute } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/templates")({
  component: Page,
});

const KINDS = [
  { value: "feedback", label: "Feedback" },
  { value: "pdi", label: "PDI" },
  { value: "exercicio", label: "Exercício" },
  { value: "one_on_one", label: "Reunião 1:1" },
  { value: "plano", label: "Plano" },
  { value: "checklist", label: "Checklist" },
  { value: "avaliacao", label: "Avaliação" },
];

function Page() {
  return (
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Templates"
      description="Modelos reutilizáveis de feedback, PDI, 1:1, checklists e avaliações que a plataforma oferece aos líderes."
      endpoint="/admin/neo/templates"
      entityLabel="template"
      help={{
        what:
          "São modelos prontos que o líder usa no dia a dia: roteiros de feedback, PDI, 1:1, checklists e avaliações. O líder abre o modelo e só preenche.",
        why: [
          "Padroniza a qualidade: todo líder conduz o ritual do mesmo jeito.",
          "Reduz o esforço do líder — ele não começa da folha em branco.",
          "Servem de estrutura para a IA gerar rascunhos já no formato Neo.",
        ],
        steps: [
          "Clique em Novo e escolha o Tipo (feedback, PDI, 1:1, checklist…).",
          "Nomeie de forma que o líder entenda quando usar (ex.: 'Feedback de reconhecimento').",
          "Na Descrição, explique em qual situação aplicar o modelo.",
          "Use Tags para o template aparecer nas jornadas e recomendações certas.",
          "Publique como Ativo para disponibilizar no app do líder.",
        ],
        examples: [
          "Feedback: modelo SCI (Situação-Comportamento-Impacto)",
          "1:1: pauta quinzenal em 4 blocos",
          "PDI: plano de 90 dias",
        ],
        tips: [
          "Um template por situação — evite modelos genéricos demais.",
          "Teste como Rascunho antes de ativar para toda a base.",
        ],
      }}
      filterField="kind"
      filterOptions={KINDS}
      defaultValues={{ kind: "feedback", status: "active", tags: [], body: {} }}
      fields={[
        { kind: "select", name: "kind", label: "Tipo", options: KINDS },
        { kind: "text", name: "name", label: "Nome", required: true },
        { kind: "textarea", name: "description", label: "Descrição", rows: 3 },
        { kind: "tags", name: "tags", label: "Tags" },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "kind", label: "Tipo", render: (it) => KINDS.find((k) => k.value === it.kind)?.label ?? String(it.kind) },
        { key: "status", label: "Status" },
      ]}
    />
  );
}