import { createFileRoute, Link } from "@tanstack/react-router";
import { NeoCrudPage } from "@/components/admin/NeoCrud";

export const Route = createFileRoute("/_authenticated/admin/neo/journeys/")({
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
      help={{
        what:
          "Jornada é a trilha que o líder percorre: uma sequência de etapas encadeando assessments, conteúdos, exercícios e PDIs dentro de um módulo C.O.R.E.",
        why: [
          "É o que aparece como 'próximo passo' na home do líder.",
          "Garante ordem pedagógica: primeiro diagnóstico, depois consciência, depois ação.",
          "Permite trilhas diferentes por público (líder iniciante, gestor sênior, mentorado).",
        ],
        steps: [
          "Clique em Novo, dê um Nome e escolha o Módulo C.O.R.E. (C, O, R ou E).",
          "Descreva o resultado esperado e informe o Público.",
          "Salve e clique no nome da jornada para abrir o construtor de etapas.",
          "Adicione as etapas na ordem desejada (assessment, conteúdo, exercício, PDI, vídeo).",
          "Revise a sequência e mude o status para Ativo para liberar aos líderes.",
        ],
        examples: [
          "Jornada inicial de Consciência (C)",
          "Trilha de autoconhecimento em 21 dias",
          "Onboarding do líder novo",
        ],
        tips: [
          "Comece a jornada por um assessment: a IA usa o resultado para personalizar o restante.",
          "Jornadas curtas (5 a 8 etapas) têm muito mais conclusão.",
          "Só uma jornada ativa por módulo evita confusão na home do líder.",
        ],
      }}
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
        { key: "name", label: "Nome", render: (it) => (
          <Link
            to="/admin/neo/journeys/$id"
            params={{ id: it.id }}
            className="font-medium text-[color:var(--neo-ink)] underline decoration-transparent underline-offset-2 hover:decoration-current"
          >
            {String(it.name ?? "—")}
          </Link>
        ) },
        { key: "coreModule", label: "CORE" },
        { key: "audience", label: "Público" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}