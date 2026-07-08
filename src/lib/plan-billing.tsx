// Client-side plan / module gate. Reads the user's current subscription and
// exposes helpers to conditionally render features.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "./api";

export type PlanTier = "essencial" | "profissional" | "enterprise";
const RANK: Record<PlanTier, number> = { essencial: 1, profissional: 2, enterprise: 3 };

export interface BillingMe {
  organization: { id: string; name: string; plan: PlanTier; status: string } | null;
  subscription: {
    id: string;
    status: string;
    plan: { id: string; name: string; slug: string; features: string[] };
  } | null;
  licenses: Array<{ id: string; planName: string; seats: number; used: number; status: string; expiresAt: string | null }>;
}

export function useBillingMe() {
  return useQuery({
    queryKey: ["billing", "me"],
    queryFn: () => api<BillingMe>("/billing/me"),
    staleTime: 60_000,
  });
}

export function usePlan() {
  const q = useBillingMe();
  const tier = (q.data?.organization?.plan ?? "essencial") as PlanTier;
  return {
    ...q,
    tier,
    hasTier: (min: PlanTier) => RANK[tier] >= RANK[min],
    isSuspended: q.data?.organization?.status === "suspended" || q.data?.organization?.status === "canceled",
    seatsUsed: q.data?.licenses.reduce((s, l) => s + l.used, 0) ?? 0,
    seatsTotal: q.data?.licenses.reduce((s, l) => s + l.seats, 0) ?? 0,
  };
}

export function Feature({ min, children, fallback }: { min: PlanTier; children: ReactNode; fallback?: ReactNode }) {
  const { hasTier } = usePlan();
  if (!hasTier(min)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
