import { createFileRoute } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/knowledge")({
  component: Page,
});

const KINDS = [
  { value: "conceito", label: "Conceito" },
  { value: "playbook", label: "Playbook" },
  { value: "boa_pratica", label: "Boa prática" },
  { value: "estudo_caso", label: "Estudo de caso" },
  { value: "recomendacao", label: "Recomendação" },
  { value: "tecnica", label: "Técnica" },
  { value: "exercicio", label: "Exercício" },
  { value: "leitura", label: "Leitura" },
  { value: "video", label: "Vídeo" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "template", label: "Template" },
  { value: "modelo_feedback", label: "Modelo de feedback" },
  { value: "modelo_pdi", label: "Modelo de PDI" },
  { value: "ritual", label: "Ritual" },
];

function Page() {
  return (
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Base de Conhecimento"
      description="Playbooks, conceitos, técnicas e recomendações que alimentam a IA e os líderes. Tudo versionado e pesquisável."
      endpoint="/admin/neo/knowledge"
      entityLabel="conteúdo"
      help={{
        what:
          "É a biblioteca de conteúdo da Neo: playbooks, conceitos, técnicas, exercícios e boas práticas. É daqui que a IA tira embasamento e o líder tira material de apoio.",
        why: [
          "Dá repertório à IA: quanto mais conteúdo ativo, mais específicas as recomendações.",
          "Vira material de apoio dentro das jornadas e dos PDIs.",
          "Centraliza o conhecimento da Neo sem depender de arquivos soltos.",
        ],
        steps: [
          "Clique em Novo e escolha o Tipo (playbook, conceito, exercício, vídeo…).",
          "Dê um Título objetivo e escreva um Resumo de 2 a 3 linhas — é o que a IA lê primeiro.",
          "Coloque o material completo em Conteúdo (aceita markdown: títulos, listas, negrito).",
          "Informe Público-alvo e Dificuldade para a IA saber a quem recomendar.",
          "Marque Tags ligadas às competências da Metodologia e publique como Ativo.",
        ],
        examples: [
          "Playbook: Como conduzir um 1:1 difícil",
          "Conceito: Razão de positividade",
          "Exercício: Diário de gatilhos (7 dias)",
        ],
        tips: [
          "Use as mesmas Tags dos itens de Metodologia para conectar conteúdo e competência.",
          "Resumo bem escrito = recomendação melhor da IA.",
          "Rascunho não é exibido nem usado pela IA.",
        ],
      }}
      filterField="kind"
      filterOptions={KINDS}
      defaultValues={{ kind: "playbook", status: "active", tags: [] }}
      fields={[
        { kind: "select", name: "kind", label: "Tipo", options: KINDS },
        { kind: "text", name: "title", label: "Título", required: true },
        { kind: "text", name: "author", label: "Autor" },
        { kind: "text", name: "audience", label: "Público-alvo" },
        { kind: "select", name: "difficulty", label: "Dificuldade", options: [
          { value: "iniciante", label: "Iniciante" },
          { value: "intermediario", label: "Intermediário" },
          { value: "avancado", label: "Avançado" },
        ] },
        { kind: "textarea", name: "summary", label: "Resumo", rows: 3 },
        { kind: "textarea", name: "body", label: "Conteúdo (markdown)", rows: 8 },
        { kind: "tags", name: "tags", label: "Tags" },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "title", label: "Título" },
        { key: "kind", label: "Tipo", render: (it) => KINDS.find((k) => k.value === it.kind)?.label ?? String(it.kind) },
        { key: "audience", label: "Público" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}