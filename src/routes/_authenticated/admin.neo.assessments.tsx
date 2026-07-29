import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/assessments")({
  component: Page,
});

function Page() {
  return (
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Biblioteca de Assessments"
      description="Catálogo dos assessments disponíveis. O construtor de perguntas fica em cada assessment aberto."
      endpoint="/admin/neo/assessments"
      entityLabel="assessment"
      defaultValues={{ status: "draft", frequency: "one_off", weight: 1, competencies: [] }}
      fields={[
        { kind: "text", name: "name", label: "Nome", required: true },
        { kind: "textarea", name: "objective", label: "Objetivo", rows: 3 },
        { kind: "text", name: "audience", label: "Público" },
        { kind: "text", name: "category", label: "Categoria" },
        { kind: "select", name: "coreModule", label: "Módulo C.O.R.E.", options: [
          { value: "C", label: "C · Consciência" },
          { value: "O", label: "O · Organização" },
          { value: "R", label: "R · Resultado" },
          { value: "E", label: "E · Evolução" },
        ] },
        { kind: "select", name: "frequency", label: "Frequência", options: [
          { value: "one_off", label: "Única" },
          { value: "monthly", label: "Mensal" },
          { value: "quarterly", label: "Trimestral" },
          { value: "yearly", label: "Anual" },
        ] },
        { kind: "number", name: "estimatedMinutes", label: "Tempo estimado (min)" },
        { kind: "number", name: "weight", label: "Peso" },
        { kind: "tags", name: "competencies", label: "Competências relacionadas" },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "name", label: "Nome", render: (it) => (
          <Link
            to="/admin/neo/assessments/$id"
            params={{ id: it.id }}
            className="font-medium text-[color:var(--neo-ink)] underline decoration-transparent underline-offset-2 hover:decoration-current"
          >
            {String(it.name ?? "—")}
          </Link>
        ) },
        { key: "coreModule", label: "CORE" },
        { key: "frequency", label: "Frequência" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}