import { useQuery } from "@tanstack/react-query";
import { authApi } from "./api";
import { useAuth } from "./auth-context";

export type PermAction = "view" | "edit" | "delete" | "export" | "admin";

export function usePermissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me", "permissions", user?.id],
    queryFn: () => authApi.permissions(),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useCan(resource: string, action: PermAction): boolean {
  const q = usePermissions();
  if (!q.data) return false;
  if (q.data.super) return true;
  return q.data.grants.some((g) => g.resource === resource && g.action === action);
}

/** Guard component. Renders children only if the user has the permission. */
export function Can({
  resource,
  action,
  fallback = null,
  children,
}: {
  resource: string;
  action: PermAction;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const allowed = useCan(resource, action);
  return <>{allowed ? children : fallback}</>;
}