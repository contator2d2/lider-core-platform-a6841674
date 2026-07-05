import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.roles?.includes("super_admin");

  useEffect(() => {
    if (user && !isSuperAdmin) navigate({ to: "/app", replace: true });
  }, [user, isSuperAdmin, navigate]);

  if (!isSuperAdmin) return null;
  return <AdminShell />;
}