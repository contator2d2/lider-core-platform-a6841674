import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout da área de Equipe: a lista fica em app.team.index.tsx e o detalhe em app.team.$membershipId.tsx */
export const Route = createFileRoute("/_authenticated/app/team")({
  component: () => <Outlet />,
});
