import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout do Módulo C (Consciência).
 * Só renderiza o Outlet — a home da jornada vive em app.consciencia.index.tsx
 * e cada etapa (assessment, atividades, PDI, liderados, coach, agenda) é uma rota filha.
 */
export const Route = createFileRoute("/_authenticated/app/consciencia")({
  component: () => <Outlet />,
});
