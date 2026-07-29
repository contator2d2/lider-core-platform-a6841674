import { createFileRoute } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/journeys")({
  component: Page,
});

function Page() {
  return (
    <NeoCrudPage
      eyebrow="Neo · Inteligência"
      title="Construtor de Jornadas"
      description="Componha trilhas de desenvolvimento encadeando assessments, exercícios, vídeos, PDIs e conteúdos."
      endpoint="/admin/neo/journeys"
      entityLabel="jornada"
      defaultValues={{ status: "draft" }}
      fields={[
        { kind: "text", name: "name", label: "Nome", required: true },
        { kind: "textarea", name: "description", label: "Descrição", rows: 3 },
        { kind: "text", name: "audience", label: "Público" },
        { kind: "select", name: "coreModule", label: "Módulo C.O.R.E.", options: [
          { value: "C", label: "C · Consciência" },
          { value: "O", label: "O · Organização" },
          { value: "R", label: "R · Resultado" },
          { value: "E", label: "E · Evolução" },
        ] },
        { kind: "select", name: "status", label: "Status", options: [
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativo" },
          { value: "archived", label: "Arquivado" },
        ] },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "coreModule", label: "CORE" },
        { key: "audience", label: "Público" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}