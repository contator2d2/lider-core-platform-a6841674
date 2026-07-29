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