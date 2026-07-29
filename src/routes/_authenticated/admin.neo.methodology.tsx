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