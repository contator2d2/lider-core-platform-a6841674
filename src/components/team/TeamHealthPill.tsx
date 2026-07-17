import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number | null;
  delta: number;
  atRisk: boolean;
};
type HealthResp = { score: number | null; delta: number; membersAtRisk: number; members: Member[] };

export function TeamHealthPill({ orgId }: { orgId: string | null }) {
  const q = useQuery({
    queryKey: ["team", "health-summary", orgId],
    queryFn: () => api<HealthResp>(`/organization/${orgId}/team/health-summary`),
    enabled: !!orgId,
    staleTime: 120_000,
  });

  const score = q.data?.score;
  const delta = q.data?.delta ?? 0;
  const tone = score == null ? "text-muted-foreground" : score >= 75 ? "text-emerald-500" : score >= 60 ? "text-accent" : "text-red-500";
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary md:inline-flex"
          aria-label="Saúde do time"
        >
          <Activity className={`h-3.5 w-3.5 ${tone}`} strokeWidth={2} />
          <span className="text-muted-foreground">Time</span>
          <span className={`font-display ${tone}`}>{score ?? "—"}</span>
          {score != null && (
            <span className={`flex items-center gap-0.5 ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              <DeltaIcon className="h-3 w-3" strokeWidth={2} />
              {delta > 0 ? "+" : ""}{delta}
            </span>
          )}
          {(q.data?.membersAtRisk ?? 0) > 0 && (
            <span className="rounded-full bg-red-500/10 px-1.5 text-[10px] font-semibold text-red-500">
              {q.data?.membersAtRisk}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Saúde do time</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-display text-3xl ${tone}`}>{score ?? "—"}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
            <span className={`ml-auto text-xs ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {delta > 0 ? "+" : ""}{delta} vs. mês anterior
            </span>
          </div>
        </div>
        <div className="max-h-72 divide-y divide-border overflow-y-auto">
          {q.data?.members.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sem dados de time ainda.</div>
          )}
          {q.data?.members.map((m) => (
            <Link
              key={m.membershipId}
              to="/app/team/$membershipId"
              params={{ membershipId: m.membershipId }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-foreground">
                {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.name}</div>
                {m.atRisk && <div className="text-[10px] uppercase tracking-widest text-red-500">Atenção</div>}
              </div>
              <div className="text-right">
                <div className={`font-display text-sm ${m.score == null ? "text-muted-foreground" : m.score >= 75 ? "text-emerald-500" : m.score >= 60 ? "text-accent" : "text-red-500"}`}>
                  {m.score ?? "—"}
                </div>
                {m.delta !== 0 && (
                  <div className={`text-[10px] ${m.delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {m.delta > 0 ? "+" : ""}{m.delta}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2">
          <Link to="/app/team" className="text-xs text-accent hover:underline">Ver mapa completo →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}