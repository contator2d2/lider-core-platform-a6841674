import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LeadershipDrawer, type DrawerTarget } from "@/components/leadership/LeadershipDrawer";
import {
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  ScrollText,
  Sparkles,
  TrendingUp,
  Workflow,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentOrg } from "@/lib/use-current-org";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/app/")({
  component: LeadershipRoom,
});

type Signal = { kind: string; reason: string; severity: "high" | "medium" | "low"; action: string };
type AttentionPerson = { userId: string; membershipId: string; name: string; avatarUrl: string | null; signals: Signal[] };
type Occurrence = { id: string; scheduledAt: string; status: string; ritual: { name: string; type: string } };
type DelegSummary = { id: string; title: string; dueAt: string | null; priority: string; status: string };
type DecisionSummary = { id: string; title: string; status: string; dueAt: string | null; updatedAt: string };

type LeadershipRoomData = {
  generatedAt: string;
  attention: AttentionPerson[];
  upcomingOccurrences: Occurrence[];
  rituals: { active: number; done: number; missed: number; planned: number; adherence: number | null };
  delegations: { overdue: DelegSummary[]; upcoming: DelegSummary[]; overdueCount: number };
  decisions: { recent: DecisionSummary[]; openCount: number };
  structure: { areas: number; teams: number; peopleCount: number };
  nextBestAction: { title: string; description: string; cta: string; href: string } | null;
};

type HealthScore = { score: number; breakdown: Record<string, { weight: number; score: number }> };

function LeadershipRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orgId, current } = useCurrentOrg();
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  useEffect(() => {
    if (user?.roles?.includes("super_admin")) {
      navigate({ to: "/admin", replace: true });
    }
  }, [user, navigate]);

  const room = useQuery({
    queryKey: ["leadership-room", orgId],
    queryFn: () => api<LeadershipRoomData>(`/organization/${orgId}/leadership-room`),
    enabled: !!orgId,
  });
  const health = useQuery({
    queryKey: ["org", "health", orgId],
    queryFn: () => api<HealthScore>(`/organization/${orgId}/health-score`),
    enabled: !!orgId,
  });

  const firstName = useMemo(() => {
    const full = user?.fullName ?? "";
    return full.split(" ")[0] || "líder";
  }, [user]);

  if (!orgId) return <EmptyOrgState />;

  const data = room.data;
  const loading = room.isLoading;

  const openPerson = (p: AttentionPerson) => setDrawer({ kind: "person", orgId, person: p });
  const openDeleg = (d: DelegSummary) => setDrawer({ kind: "delegation", orgId, delegation: d });
  const openDecision = (d: DecisionSummary) => setDrawer({ kind: "decision", orgId, decision: d });

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 md:max-w-6xl md:pb-0">
      {/* Saudação */}
      <header className="px-1">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          {greet()}, {firstName} <span className="inline-block">👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatToday()}
          {current && <span className="ml-1 text-foreground/60">· {current.name}</span>}
        </p>
      </header>

      {/* Hero: CORE Score com gauge */}
      <CoreScoreHero
        score={health.data?.score}
        loading={health.isLoading}
        adherence={data?.rituals.adherence}
      />

      {/* Pessoas que precisam da sua atenção */}
      <AttentionSection people={data?.attention ?? []} loading={loading} onOpen={openPerson} />

      {/* Agenda + Rituais (grid 2 cols no mobile) */}
      <div className="grid grid-cols-2 gap-3">
        <AgendaCard occurrences={data?.upcomingOccurrences ?? []} loading={loading} />
        <RitualsCard rituals={data?.rituals} loading={loading} />
      </div>

      {/* Delegações */}
      <DelegationsCard data={data?.delegations} loading={loading} onOpen={openDeleg} />

      {/* IA Coach */}
      <AiCoachCard />

      {/* Decisões recentes (colapsado, extra info) */}
      <DecisionsCard data={data?.decisions} loading={loading} onOpen={openDecision} />

      {/* FAB de nova ação */}
      <Link
        to="/app/organization/delegations"
        aria-label="Nova delegação"
        className="fixed bottom-24 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_12px_32px_-8px_color-mix(in_oklab,var(--accent)_60%,transparent)] transition-transform active:scale-95 md:bottom-8"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </Link>

      <LeadershipDrawer target={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

// ---------- SUB-COMPONENTS ----------

function CoreScoreHero({ score, loading, adherence }: { score: number | undefined; loading: boolean; adherence: number | null | undefined }) {
  const value = typeof score === "number" ? score : 0;
  const shown = typeof score === "number" ? score : loading ? "…" : "—";
  const insight =
    typeof score !== "number"
      ? "Configure sua equipe para ativar o CORE Score."
      : score >= 70
        ? "Você está evoluindo! Mantenha a cadência dos rituais."
        : score >= 40
          ? "Você está evoluindo! Foque nas ações de hoje para continuar avançando."
          : "Atenção: retome os rituais e conversas de 1:1 para reagir.";
  return (
    <section className="relative overflow-hidden rounded-3xl bg-foreground p-6 text-background shadow-[0_20px_60px_-24px_color-mix(in_oklab,black_50%,transparent)]">
      <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-background/60">
            CORE Score
            <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-success">
              <TrendingUp className="h-3 w-3" /> +12 pts
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="metric-number text-6xl">{shown}</span>
            <span className="text-sm text-background/60">de 100</span>
          </div>
        </div>
        <ScoreGauge value={value} />
      </div>
      <p className="relative mt-5 flex items-start gap-2 text-sm text-background/75">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>{insight}</span>
      </p>
      {typeof adherence === "number" && (
        <div className="relative mt-4 flex items-center gap-2 text-[11px] uppercase tracking-widest text-background/50">
          <Workflow className="h-3 w-3" /> Adesão rituais · {adherence}%
        </div>
      )}
    </section>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75; // 3/4 arc
  const dash = (clamped / 100) * arc;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-[135deg]">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-background/10"
        strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-accent"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 500ms ease" }} />
    </svg>
  );
}

function AttentionSection({ people, loading, onOpen }: { people: AttentionPerson[]; loading: boolean; onOpen: (p: AttentionPerson) => void }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          Pessoas que precisam da sua atenção
        </h2>
        <Link to="/app/team" className="text-xs font-medium text-accent hover:underline">Ver todas</Link>
      </header>
      {loading ? (
        <SkeletonRows n={4} />
      ) : people.length === 0 ? (
        <EmptyRow icon={CheckCircle2} title="Ninguém em risco no radar" hint="A IA revisa sinais de acompanhamento diariamente." />
      ) : (
        <ul className="divide-y divide-border/70">
          {people.slice(0, 4).map((p) => {
            const sig = p.signals[0];
            const badge = severityBadge(sig.severity);
            return (
              <li key={p.membershipId}>
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                >
                  <Avatar name={p.name} severity={sig.severity} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{sig.reason}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function severityBadge(sev: "high" | "medium" | "low") {
  if (sev === "high") return { label: "Crítico", cls: "bg-accent/15 text-accent" };
  if (sev === "medium") return { label: "Atenção", cls: "bg-attention/15 text-attention" };
  return { label: "Info", cls: "bg-muted text-muted-foreground" };
}

function AgendaCard({ occurrences, loading }: { occurrences: Occurrence[]; loading: boolean }) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> Agenda de hoje
      </div>
      <div className="mt-3 flex-1 space-y-2.5">
        {loading ? (
          <Skeleton className="h-20" />
        ) : occurrences.length === 0 ? (
          <div className="py-3 text-xs text-muted-foreground">Sem compromissos hoje.</div>
        ) : (
          occurrences.slice(0, 3).map((o) => (
            <div key={o.id} className="flex items-start gap-2.5 border-l-2 border-accent pl-2.5">
              <div>
                <div className="text-xs font-semibold tabular-nums">{formatTime(o.scheduledAt)}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{o.ritual.name}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/app/organization/agenda"
        className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-background py-2 text-xs font-medium hover:bg-secondary"
      >
        Ver agenda
      </Link>
    </section>
  );
}

function RitualsCard({ rituals, loading }: { rituals: LeadershipRoomData["rituals"] | undefined; loading: boolean }) {
  const adherence = rituals?.adherence ?? 0;
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Workflow className="h-3.5 w-3.5" /> Rituais da semana
      </div>
      {loading || !rituals ? (
        <div className="mt-3 flex-1"><Skeleton className="h-20" /></div>
      ) : (
        <div className="mt-3 flex flex-1 items-center gap-3">
          <MiniGauge value={adherence} />
          <ul className="space-y-1 text-xs">
            <li className="flex items-center gap-1.5"><Dot cls="bg-success" /> {rituals.done} Feitos</li>
            <li className="flex items-center gap-1.5"><Dot cls="bg-attention" /> {rituals.planned} Pendentes</li>
            <li className="flex items-center gap-1.5"><Dot cls="bg-accent" /> {rituals.missed} Atrasados</li>
          </ul>
        </div>
      )}
      <Link
        to="/app/organization/rituals"
        className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-background py-2 text-xs font-medium hover:bg-secondary"
      >
        Ver rituais
      </Link>
    </section>
  );
}

function Dot({ cls }: { cls: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function MiniGauge({ value }: { value: number }) {
  const size = 64;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-accent"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{value}%</div>
    </div>
  );
}

function DelegationsCard({ data, loading, onOpen }: { data: LeadershipRoomData["delegations"] | undefined; loading: boolean; onOpen: (d: DelegSummary) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          Delegações pendentes
        </h2>
        <Link to="/app/organization/delegations" className="text-xs font-medium text-accent hover:underline">Ver todas</Link>
      </header>
      {loading ? (
        <SkeletonRows n={3} compact />
      ) : (!data?.overdue.length && !data?.upcoming.length) ? (
        <EmptyRow icon={ClipboardList} title="Nada em aberto" hint="Registre um combinado para acompanhar." compact />
      ) : (
        <ul className="divide-y divide-border/70">
          {data.overdue.slice(0, 3).map((d) => <DelegRow key={d.id} d={d} overdue onOpen={onOpen} />)}
          {data.upcoming.slice(0, Math.max(0, 4 - data.overdue.slice(0, 3).length)).map((d) => <DelegRow key={d.id} d={d} onOpen={onOpen} />)}
        </ul>
      )}
    </section>
  );
}

function DelegRow({ d, overdue, onOpen }: { d: DelegSummary; overdue?: boolean; onOpen: (d: DelegSummary) => void }) {
  const dueLabel = overdue
    ? d.dueAt ? `Atrasada · ${daysFrom(d.dueAt)}d` : "Atrasada"
    : d.dueAt ? relDay(d.dueAt) : "Sem prazo";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(d)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${overdue ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
          {overdue ? <AlertTriangle className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{d.title}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{d.priority}</div>
        </div>
        <span className={`shrink-0 text-xs font-medium ${overdue ? "text-accent" : "text-muted-foreground"}`}>{dueLabel}</span>
      </button>
    </li>
  );
}

function DecisionsCard({ data, loading, onOpen }: { data: LeadershipRoomData["decisions"] | undefined; loading: boolean; onOpen: (d: DecisionSummary) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5" /> Decisões recentes
        </h2>
        {!!data?.openCount && <span className="text-xs text-accent">{data.openCount} abertas</span>}
      </header>
      {loading ? (
        <SkeletonRows n={3} compact />
      ) : !data?.recent.length ? (
        <EmptyRow icon={ScrollText} title="Sem decisões registradas" hint="Toda reunião gera uma decisão. Registre a primeira." compact />
      ) : (
        <ul className="divide-y divide-border/70">
          {data.recent.slice(0, 4).map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.dueAt ? `Prazo ${formatDate(d.dueAt)}` : `Atualizada ${formatDate(d.updatedAt)}`}
                  </div>
                </div>
                <DecisionBadge status={d.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AiCoachCard() {
  const quick = [
    { label: "Preparar conversa", to: "/app/ai" },
    { label: "Plano de ação", to: "/app/ai" },
    { label: "Resumo da equipe", to: "/app/ai" },
    { label: "Dar feedback", to: "/app/feedbacks" },
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" /> IA Coach
        </div>
        <Link to="/app/ai" className="text-xs font-medium text-accent hover:underline">Ver</Link>
      </div>
      <div className="mt-2 text-sm text-foreground/80">Como posso te ajudar hoje?</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <Link
            key={q.label}
            to={q.to}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            {q.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- PRIMITIVES ----------

function Avatar({ name, severity }: { name: string; severity: "high" | "medium" | "low" }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const ring =
    severity === "high" ? "ring-2 ring-accent" :
    severity === "medium" ? "ring-2 ring-attention/50" :
    "";
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary to-muted text-sm font-semibold text-foreground ${ring}`}>
      {initials || "•"}
    </span>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string }> = {
    open: { l: "Aberta", c: "bg-attention/15 text-accent" },
    in_progress: { l: "Em execução", c: "bg-secondary text-foreground" },
    done: { l: "Concluída", c: "bg-success/15 text-success" },
    reverted: { l: "Revertida", c: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { l: status, c: "bg-muted text-muted-foreground" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${s.c}`}>{s.l}</span>;
}

function EmptyRow({ icon: Icon, title, hint, compact }: { icon: typeof CalendarClock; title: string; hint?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 text-center ${compact ? "px-4 py-6" : "px-5 py-10"}`}>
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SkeletonRows({ n, compact }: { n: number; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 p-4" : "space-y-2 p-5"}>
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={compact ? "h-10" : "h-12"} />)}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function EmptyOrgState() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border p-12 text-center">
      <Compass className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-4 font-display text-2xl">Sua Sala de Liderança</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Você ainda não pertence a nenhuma organização. Peça a um administrador para adicionar você
        para começar a acompanhar pessoas, rituais e decisões.
      </p>
    </div>
  );
}

// ---------- HELPERS ----------

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatToday() {
  const s = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
    (d.getHours() || d.getMinutes() ? " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
}

function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function daysFrom(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

function relDay(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
