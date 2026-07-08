import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";

const KEY = "lider_core_current_org";

export type CurrentOrg = { id: string; name: string; slug: string; plan: string };

/**
 * Retorna a organização "atual" do usuário. Persiste seleção em localStorage.
 * Fallback: primeira membership.
 */
export function useCurrentOrg() {
  const { user } = useAuth();
  const orgs = useMemo<CurrentOrg[]>(
    () => user?.memberships?.map((m) => m.organization) ?? [],
    [user],
  );
  const [orgId, setOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(KEY);
  });

  useEffect(() => {
    if (!orgs.length) return;
    if (!orgId || !orgs.find((o) => o.id === orgId)) {
      const next = orgs[0].id;
      setOrgIdState(next);
      window.localStorage.setItem(KEY, next);
    }
  }, [orgs, orgId]);

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    window.localStorage.setItem(KEY, id);
  };

  const current = orgs.find((o) => o.id === orgId) ?? orgs[0] ?? null;
  return { orgId: current?.id ?? null, current, orgs, setOrgId };
}
