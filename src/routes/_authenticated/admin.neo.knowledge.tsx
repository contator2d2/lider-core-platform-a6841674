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