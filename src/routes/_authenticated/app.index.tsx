import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LeadershipDrawer, type DrawerTarget } from "@/components/leadership/LeadershipDrawer";
import {
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
  ArrowUpRight,
  Shield,
  Bell,
  MessageCircle,
  ChevronRight,
  Sun,
  Moon,
  User as UserIcon,
  Calendar as CalendarIcon,
  MessageSquare,
  ClipboardCheck,
  FileText,
  Users as UsersIcon,
  TrendingDown,
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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (window.localStorage.getItem("app-home-theme") as "light" | "dark") || "light";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("app-home-theme", theme);
  }, [theme]);

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

  const priorities = buildPriorities(data);
  const nextMeeting = (data?.upcomingOccurrences ?? [])[0];

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-background text-foreground md:-mx-10 md:-my-12">
        {/* Header escuro estilo mobile-first */}
        <header className="relative bg-[#141311] px-5 pb-10 pt-6 text-white md:rounded-b-[32px] md:px-8 md:pt-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-base font-semibold ring-2 ring-white/10">
                {initialsOf(user?.fullName)}
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-xl leading-tight sm:text-2xl">
                  {greet()}, {firstName} <span aria-hidden>👋</span>
                </h1>
                <p className="mt-0.5 text-xs text-white/55">{formatToday()}{current ? ` · ${current.name}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label="Alternar tema"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15"
                aria-label="Notificações"
              >
                <Bell className="h-4 w-4" />
                {(data?.attention?.length ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {Math.min(9, data!.attention.length)}
                  </span>
                )}
              </button>
              <Link
                to="/app/ai"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15"
                aria-label="Conversar com IA"
              >
                <MessageCircle className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <div className="relative -mt-6 space-y-5 px-4 pb-28 md:px-8 md:pb-12">
          {/* Suas prioridades de hoje */}
          <section className="rounded-[24px] border border-border bg-card p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Suas prioridades de hoje</h2>
              <Link to="/app/team" className="text-xs font-semibold text-accent hover:underline">Ver todas</Link>
            </div>
            {loading ? (
              <div className="flex gap-3 overflow-hidden">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-[60%] shrink-0" />)}
              </div>
            ) : priorities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                Nada urgente por aqui. Bom trabalho.
              </div>
            ) : (
              <>
                <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {priorities.map((p, i) => (
                    <PriorityCard key={p.id} priority={p} index={i + 1} onOpen={() => p.onOpen?.(openPerson)} />
                  ))}
                </div>
                <div className="mt-3 flex justify-center gap-1.5">
                  {priorities.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-4 bg-foreground/70" : "w-1.5 bg-foreground/20"}`} />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* CORE Score + Próxima reunião */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-[1.15fr_1fr]">
            <CoreScoreCard score={health.data?.score} loading={health.isLoading} />
            <NextMeetingCard occurrence={nextMeeting} loading={loading} />
          </section>

          {/* Ações rápidas */}
          <section className="rounded-[24px] border border-border bg-card p-4">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Ações rápidas</h2>
            <div className="grid grid-cols-5 gap-2">
              <QuickAction to="/app/feedbacks" label="Novo Feedback" icon={MessageSquare} tint="orange" />
              <QuickAction to="/app/organization/delegations" label="Nova Delegação" icon={ClipboardCheck} tint="sky" />
              <QuickAction to="/app/organization/agenda" label="Nova Reunião" icon={CalendarIcon} tint="violet" />
              <QuickAction to="/app/organization/decisions" label="Nova Decisão" icon={FileText} tint="emerald" />
              <QuickAction to="/app/one-on-ones" label="Nova 1:1" icon={UsersIcon} tint="rose" />
            </div>
          </section>

          {/* Radar da equipe */}
          <section className="rounded-[24px] border border-border bg-card">
            <header className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Radar da equipe</h2>
              <Link to="/app/team" className="text-xs font-semibold text-accent hover:underline">Ver todos</Link>
            </header>
            {loading ? (
              <SkeletonRows n={4} compact />
            ) : (data?.attention.length ?? 0) === 0 ? (
              <EmptyRow icon={CheckCircle2} title="Ninguém em risco" hint="Sua equipe está no verde." compact />
            ) : (
              <ul className="divide-y divide-border/60">
                {data!.attention.slice(0, 4).map((p) => (
                  <li key={p.membershipId}>
                    <button
                      type="button"
                      onClick={() => openPerson(p)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/40"
                    >
                      <Avatar name={p.name} severity={p.signals[0]?.severity ?? "low"} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.signals[0]?.reason ?? "—"}</div>
                      </div>
                      <RadarBadge severity={p.signals[0]?.severity ?? "low"} label={radarLabel(p.signals[0])} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Agenda de hoje */}
          <section className="rounded-[24px] border border-border bg-card">
            <header className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Agenda de hoje</h2>
              <Link to="/app/organization/agenda" className="text-xs font-semibold text-accent hover:underline">Ver agenda</Link>
            </header>
            {loading ? (
              <SkeletonRows n={3} compact />
            ) : (data?.upcomingOccurrences.length ?? 0) === 0 ? (
              <EmptyRow icon={CalendarClock} title="Sem compromissos hoje" compact />
            ) : (
              <ul className="divide-y divide-border/60">
                {data!.upcomingOccurrences.slice(0, 3).map((o, i) => (
                  <li key={o.id} className="grid grid-cols-[56px_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                    <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {formatTime(o.scheduledAt)}
                    </div>
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${agendaTint(i).bg} ${agendaTint(i).fg}`}>
                      {agendaIcon(o.ritual.type)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{o.ritual.name}</div>
                      <div className="truncate text-xs text-muted-foreground uppercase tracking-widest">{o.ritual.type}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground/70">
                      {relTime(o.scheduledAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Delegações e decisões (mantidas para consistência de dados) */}
          <DelegationsCard data={data?.delegations} loading={loading} onOpen={openDeleg} />
          <AiCoachCard />
          <DecisionsCard data={data?.decisions} loading={loading} onOpen={openDecision} />
        </div>

        {/* FAB central laranja (encaixa com bottom nav) */}
        <Link
          to="/app/organization/delegations"
          aria-label="Nova ação"
          className="fixed bottom-14 left-1/2 z-40 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-accent text-white shadow-[0_16px_36px_-10px_color-mix(in_oklab,var(--accent)_60%,transparent)] transition active:scale-95 md:hidden"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>

        <LeadershipDrawer target={drawer} onClose={() => setDrawer(null)} />
      </div>
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
    <section
      className="relative overflow-hidden rounded-[32px] p-7 text-white shadow-[0_24px_60px_-24px_color-mix(in_oklab,black_55%,transparent)]"
      style={{ backgroundColor: "#1C1A19" }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
            CORE Score
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-[56px] font-medium leading-none tabular-nums">
              {shown}
            </span>
            <span className="text-lg font-light text-white/40">/ 100</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            <TrendingUp className="h-3 w-3 text-accent" strokeWidth={2.5} />
            <span className="text-[11px] font-bold text-accent">+12 pts</span>
          </div>
        </div>
        <ScoreGauge value={value} />
      </div>

      <div className="mt-7 flex items-start gap-4 border-t border-white/5 pt-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/10">
          <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-[13px] italic leading-relaxed text-white/55">{insight}</p>
      </div>

      {typeof adherence === "number" && (
        <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          <Workflow className="h-3 w-3" /> Adesão rituais · {adherence}%
        </div>
      )}
    </section>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const size = 96;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="transparent"
          stroke="rgba(255,255,255,0.06)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="transparent"
          stroke="var(--accent)"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 500ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.04] backdrop-blur-sm">
          <Shield className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function AttentionSection({ people, loading, onOpen }: { people: AttentionPerson[]; loading: boolean; onOpen: (p: AttentionPerson) => void }) {
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between px-1">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Acompanhamento
        </h2>
        <Link
          to="/app/team"
          className="border-b border-accent/30 pb-0.5 text-[11px] font-bold uppercase tracking-widest text-accent"
        >
          Ver todas
        </Link>
      </header>
      {loading ? (
        <div className="rounded-[28px] border border-border/60 bg-secondary/40 p-6">
          <SkeletonRows n={4} />
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center rounded-[28px] border border-border/60 bg-secondary/40 p-10 text-center">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-full border border-border bg-background shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Ninguém em risco no radar</h3>
          <p className="mt-2 max-w-[260px] text-[12.5px] font-light leading-relaxed text-muted-foreground">
            Sua inteligência revisa sinais de desempenho e bem-estar diariamente.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-[28px] border border-border/60 bg-card">
          {people.slice(0, 4).map((p) => {
            const sig = p.signals[0];
            const badge = severityBadge(sig.severity);
            return (
              <li key={p.membershipId}>
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
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
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
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

// ---------- NEW HOME HELPERS ----------

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

type PriorityTint = "rose" | "orange" | "violet" | "sky" | "emerald";
type Priority = {
  id: string;
  title: string;
  category: string;
  hint: string;
  tint: PriorityTint;
  onOpen?: (fn: (p: AttentionPerson) => void) => void;
};

function buildPriorities(data: LeadershipRoomData | undefined): Priority[] {
  if (!data) return [];
  const out: Priority[] = [];
  const tints: PriorityTint[] = ["rose", "orange", "violet"];
  data.attention.slice(0, 2).forEach((p, i) => {
    const sig = p.signals[0];
    out.push({
      id: `att-${p.membershipId}`,
      title: p.name.split(" ").slice(0, 2).join(" "),
      category: sig?.kind === "pdi" ? "PDI parado" : sig?.kind === "feedback" ? "Feedback" : "Atenção",
      hint: sig?.reason ?? "Precisa da sua atenção",
      tint: tints[i],
      onOpen: (fn) => fn(p),
    });
  });
  const occ = data.upcomingOccurrences[0];
  if (occ) {
    out.push({
      id: `occ-${occ.id}`,
      title: occ.ritual.name,
      category: `Hoje às ${formatTime(occ.scheduledAt)}`,
      hint: occ.ritual.type,
      tint: "violet",
    });
  }
  return out.slice(0, 3);
}

const PRIORITY_STYLE: Record<PriorityTint, { bg: string; badge: string; icon: React.ReactElement; title: string }> = {
  rose:    { bg: "bg-rose-50 dark:bg-rose-500/10",       badge: "bg-rose-500 text-white",       icon: <UserIcon className="h-4 w-4" />,        title: "text-rose-600 dark:text-rose-300" },
  orange:  { bg: "bg-accent/10",                          badge: "bg-accent text-white",         icon: <ClipboardCheck className="h-4 w-4" />,  title: "text-accent" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-500/10",   badge: "bg-violet-500 text-white",     icon: <CalendarIcon className="h-4 w-4" />,    title: "text-violet-600 dark:text-violet-300" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-500/10",         badge: "bg-sky-500 text-white",        icon: <CalendarIcon className="h-4 w-4" />,    title: "text-sky-600 dark:text-sky-300" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", badge: "bg-emerald-500 text-white",    icon: <FileText className="h-4 w-4" />,        title: "text-emerald-600 dark:text-emerald-300" },
};

function PriorityCard({ priority, index, onOpen }: { priority: Priority; index: number; onOpen: () => void }) {
  const s = PRIORITY_STYLE[priority.tint];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative flex w-[62%] shrink-0 snap-start flex-col justify-between rounded-2xl p-4 text-left transition hover:-translate-y-0.5 sm:w-[44%] md:w-[30%] ${s.bg}`}
      style={{ minHeight: 150 }}
    >
      <div className="flex items-start justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${s.badge}`}>{s.icon}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${s.badge}`}>{index}</span>
      </div>
      <div className="mt-6">
        <div className="text-sm font-semibold text-foreground">{priority.title}</div>
        <div className={`mt-1 text-xs font-semibold ${s.title}`}>{priority.category}</div>
        <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{priority.hint}</div>
      </div>
      <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
    </button>
  );
}

function CoreScoreCard({ score, loading }: { score?: number; loading: boolean }) {
  const value = typeof score === "number" ? score : 0;
  const shown = typeof score === "number" ? score : loading ? "…" : "—";
  return (
    <div className="rounded-[24px] border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">CORE Score</h3>
        <span className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-muted-foreground">i</span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <BigRing value={value} label={shown} />
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" strokeWidth={2.25} />
            <span className="text-sm font-bold">+3</span>
          </div>
          <div className="text-xs text-muted-foreground">essa semana</div>
          <svg viewBox="0 0 100 30" className="mt-2 h-8 w-24 text-accent">
            <path d="M0 22 Q 15 18 25 20 T 55 12 T 85 8 L 100 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="100" cy="4" r="2.5" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function BigRing({ value, label }: { value: number; label: string | number }) {
  const size = 118;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
          stroke="var(--accent)" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 500ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl leading-none tabular-nums">{label}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">de 100</div>
        </div>
      </div>
    </div>
  );
}

function NextMeetingCard({ occurrence, loading }: { occurrence?: Occurrence; loading: boolean }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Próxima reunião</h3>
      {loading ? (
        <Skeleton className="mt-4 h-24" />
      ) : !occurrence ? (
        <div className="mt-4 text-sm text-muted-foreground">Nada agendado.</div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-2xl leading-none tabular-nums">{formatTime(occurrence.scheduledAt)}</div>
              <div className="mt-1 truncate text-xs font-semibold">{occurrence.ritual.name}</div>
              <div className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">{occurrence.ritual.type}</div>
            </div>
          </div>
          <Link
            to="/app/organization/agenda"
            className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold hover:bg-secondary"
          >
            Abrir agenda <ChevronRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}

const QUICK_TINTS: Record<PriorityTint, { bg: string; fg: string }> = {
  rose:    { bg: "bg-rose-50 dark:bg-rose-500/10",       fg: "text-rose-600 dark:text-rose-300" },
  orange:  { bg: "bg-accent/10",                          fg: "text-accent" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-500/10",   fg: "text-violet-600 dark:text-violet-300" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-500/10",         fg: "text-sky-600 dark:text-sky-300" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-300" },
};

function QuickAction({ to, label, icon: Icon, tint }: { to: string; label: string; icon: typeof CalendarIcon; tint: PriorityTint }) {
  const s = QUICK_TINTS[tint];
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-2 text-center transition hover:border-accent/40 hover:bg-secondary/40">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.bg} ${s.fg}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[10.5px] font-semibold leading-tight text-foreground/80">{label}</span>
    </Link>
  );
}

function RadarBadge({ severity, label }: { severity: "high" | "medium" | "low"; label: string }) {
  const cls =
    severity === "high"   ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" :
    severity === "medium" ? "bg-attention/15 text-amber-700 dark:text-amber-300" :
                            "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  const Icon = severity === "high" ? AlertTriangle : severity === "medium" ? TrendingDown : CheckCircle2;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function radarLabel(sig?: Signal): string {
  if (!sig) return "Tudo em dia";
  if (sig.severity === "high") return sig.kind === "feedback" ? "Feedback atrasado" : "Atenção";
  if (sig.severity === "medium") return sig.kind === "pdi" ? "PDI parado" : "Evoluindo";
  return "Tudo em dia";
}

function agendaTint(i: number): { bg: string; fg: string } {
  const arr = [
    { bg: "bg-accent/10", fg: "text-accent" },
    { bg: "bg-violet-50 dark:bg-violet-500/10", fg: "text-violet-600 dark:text-violet-300" },
    { bg: "bg-emerald-50 dark:bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300" },
  ];
  return arr[i % arr.length];
}

function agendaIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("1") || t.includes("one")) return <UsersIcon className="h-4 w-4" />;
  if (t.includes("indic") || t.includes("resultado")) return <TrendingUp className="h-4 w-4" />;
  return <CalendarIcon className="h-4 w-4" />;
}

function relTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return "Agora";
  if (diffMin < 60) return `Em ${diffMin}min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h < 24) return m ? `Em ${h}h ${m}min` : `Em ${h}h`;
  return relDay(d);
}
