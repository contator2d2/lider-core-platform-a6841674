import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/rituals")({
  component: Stub,
});

function Stub() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Em construção</div>
      <h1 className="mt-2 font-display text-4xl capitalize">rituals</h1>
      <p className="mt-4 max-w-lg text-muted-foreground">
        Este módulo entra na Fase 2 do roadmap — MVP da persona Líder. Cada tela nasce a partir de fatos que a plataforma já registra.
      </p>
    </div>
  );
}
