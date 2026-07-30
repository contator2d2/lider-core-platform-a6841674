import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/neo/journeys")({
  component: () => <Outlet />,
});
