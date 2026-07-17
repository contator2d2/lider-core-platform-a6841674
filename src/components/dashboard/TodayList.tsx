import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { AlertTriangle, CalendarClock, CheckCircle2, MessageSquare, TrendingDown, ArrowRight } from "lucide-react";

type TodayItem = {
  id: string;
  type: "delegation_overdue" | "delegation_due_soon" | "ritual_today" | "one_on_one" | "signal" | "team_drop";
  priority: 1 | 2 | 3;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
};
type TodayResp = { generatedAt: string; items: TodayItem[]; counts: Record<string, number> };

const iconOf = {
  delegation_overdue: AlertTriangle,
  delegation_due_soon: CalendarClock,
  ritual_today: CheckCircle2,
  one_on_one: MessageSquare,
  signal: AlertTriangle,
  team_drop: TrendingDown,
} as const;

const toneOf: Record<TodayItem["priority"], string> = {
  1: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400",
  2: "border-accent/30 bg-accent/5 text-accent",
  3: "border-border bg-card text-muted-foreground",
};

export function TodayList({ orgId }: { orgId: string | null }) {
  const q = useQuery({
    queryKey: ["dashboard", "today", orgId],
    queryFn: () => api<TodayResp>(`/organization/${orgId}/dashboard/today`),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Prioridade</div>
          <h2 className="font-display text-lg">Hoje você precisa…</h2>
        </div>
        {q.data && (
          <span className="text-xs text-muted-foreground">
            {q.data.items.length} {q.data.items.length === 1 ? "item" : "itens"}
          </span>
        )}
      </header>
      <div className="divide-y divide-border">
        {q.isLoading && <div className="px-5 py-6 text-sm text-muted-foreground">Carregando…</div>}
        {q.isError && (
          <div className="px-5 py-6 text-sm text-red-500">Não foi possível carregar sua lista.</div>
        )}
        {q.data?.items.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nada urgente pra hoje. Aproveita pra pensar no time. ✨
          </div>
        )}
        {q.data?.items.map((it) => {
          const Icon = iconOf[it.type] ?? AlertTriangle;
          return (
            <Link
              key={it.id}
              to={it.href}
              className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/50"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${toneOf[it.priority]}`}>
                <Icon className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
              </div>
              <span className="hidden items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground sm:inline-flex">
                {it.cta}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}