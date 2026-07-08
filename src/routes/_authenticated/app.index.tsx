import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  Flame,
  MessageSquare,
  ScrollText,
  Sparkles,
  Target,
  Users,
  Workflow,
  Zap,
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

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Topo — saudação, data, status */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Compass className="h-3.5 w-3.5" /> Sala de Liderança
            {current && <span className="ml-1 hidden text-foreground/60 sm:inline">· {current.name}</span>}
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
            {greet()}, <span className="italic">{firstName}</span>.
            <br className="hidden sm:block" />
            <span className="text-muted-foreground">O que precisa da sua atenção hoje?</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{formatToday()}</p>
        </div>

        <div className="flex shrink-0 items-stretch gap-3">
          <ScoreChip label="CORE Score" value={health.data?.score ?? (health.isLoading ? "…" : "—")} tone={healthTone(health.data?.score)} />
          <ScoreChip
            label="Adesão rituais"
            value={data?.rituals.adherence == null ? "—" : `${data.rituals.adherence}%`}
            tone={data?.rituals.adherence == null ? "default" : data.rituals.adherence >= 70 ? "good" : "warn"}
          />
        </div>
      </header>

      {/* Próxima melhor ação — hero */}
      <NextBestActionCard action={data?.nextBestAction} loading={loading} />

      {/* Bloco principal + lateral */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AttentionSection people={data?.attention ?? []} loading={loading} />
          <div className="grid gap-6 md:grid-cols-2">
            <DelegationsCard data={data?.delegations} loading={loading} />
            <DecisionsCard data={data?.decisions} loading={loading} />
          </div>
        </div>
        <aside className="space-y-6">
          <AgendaCard occurrences={data?.upcomingOccurrences ?? []} loading={loading} />
          <RitualsCard rituals={data?.rituals} loading={loading} />
          <AiCoachCard planEnabled={!!current} />
        </aside>
      </div>

      {/* Bloco inferior — indicadores rápidos */}
      <QuickIndicators data={data} health={health.data} />
    </div>
  );
}

// ---------- SUB-COMPONENTS ----------

function NextBestActionCard({ action, loading }: { action: LeadershipRoomData["nextBestAction"] | undefined; loading: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-foreground to-foreground/90 p-6 text-background sm:p-8">
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-background/60">
            <Zap className="h-3.5 w-3.5" /> Próxima melhor ação
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
            {loading ? "Analisando o dia…" : (action?.title ?? "Sem ações prioritárias.")}
          </h2>
          {action?.description && (
            <p className="mt-2 max-w-2xl text-sm text-background/70">{action.description}</p>
          )}
        </div>
        {action && (
          <Link
            to={action.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-background/90"
          >
            {action.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

function AttentionSection({ people, loading }: { people: AttentionPerson[]; loading: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg">Pessoas que pedem atenção</h2>
        </div>
        <span className="text-xs text-muted-foreground">{people.length} mapeadas</span>
      </header>
      {loading ? (
        <SkeletonRows n={4} />
      ) : people.length === 0 ? (
        <EmptyRow icon={CheckCircle2} title="Ninguém em risco no radar" hint="A IA revisa sinais de acompanhamento diariamente." />
      ) : (
        <ul className="divide-y divide-border">
          {people.map((p) => {
            const sig = p.signals[0];
            return (
              <li key={p.membershipId} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40">
                <Avatar name={p.name} severity={sig.severity} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{sig.reason}</div>
                </div>
                <Link
                  to="/app/one-on-ones"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {sig.action} <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AgendaCard({ occurrences, loading }: { occurrences: Occurrence[]; loading: boolean }) {
  return (
    <SectionCard title="Agenda da semana" icon={CalendarClock} href="/app/organization/agenda" hint="Próximos 7 dias">
      {loading ? (
        <SkeletonRows n={3} compact />
      ) : occurrences.length === 0 ? (
        <EmptyRow icon={CalendarClock} title="Semana livre" hint="Agende rituais e 1:1s para trazer cadência." compact />
      ) : (
        <ul className="divide-y divide-border">
          {occurrences.slice(0, 5).map((o) => (
            <li key={o.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{o.ritual.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{o.ritual.type}</div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">{formatDate(o.scheduledAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function RitualsCard({ rituals, loading }: { rituals: LeadershipRoomData["rituals"] | undefined; loading: boolean }) {
  const adherence = rituals?.adherence;
  return (
    <SectionCard title="Rituais de liderança" icon={Workflow} href="/app/organization/rituals">
      {loading || !rituals ? (
        <div className="px-4 py-6"><Skeleton className="h-16" /></div>
      ) : (
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-baseline gap-2">
            <div className="font-display text-3xl">{adherence == null ? "—" : `${adherence}%`}</div>
            <div className="text-xs text-muted-foreground">taxa de adesão · últimos 30 dias</div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/80" style={{ width: `${adherence ?? 0}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <MiniStat label="Feitos" value={rituals.done} tone="good" />
            <MiniStat label="Perdidos" value={rituals.missed} tone={rituals.missed ? "warn" : "default"} />
            <MiniStat label="Ativos" value={rituals.active} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function DelegationsCard({ data, loading }: { data: LeadershipRoomData["delegations"] | undefined; loading: boolean }) {
  return (
    <SectionCard title="Delegações" icon={ClipboardList} href="/app/organization/delegations" hint={data?.overdueCount ? `${data.overdueCount} atrasadas` : undefined} tone={data?.overdueCount ? "warn" : "default"}>
      {loading ? (
        <SkeletonRows n={3} compact />
      ) : (!data?.overdue.length && !data?.upcoming.length) ? (
        <EmptyRow icon={ClipboardList} title="Nada em aberto" hint="Registre um combinado para acompanhar." compact />
      ) : (
        <ul className="divide-y divide-border">
          {data.overdue.slice(0, 3).map((d) => <DelegRow key={d.id} d={d} overdue />)}
          {data.upcoming.slice(0, Math.max(0, 4 - data.overdue.slice(0, 3).length)).map((d) => <DelegRow key={d.id} d={d} />)}
        </ul>
      )}
    </SectionCard>
  );
}

function DelegRow({ d, overdue }: { d: DelegSummary; overdue?: boolean }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${overdue ? "bg-attention/15 text-accent" : "bg-muted text-muted-foreground"}`}>
        {overdue ? <AlertTriangle className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{d.title}</div>
        <div className="text-xs text-muted-foreground">
          {d.dueAt ? (overdue ? `Atrasado desde ${formatDate(d.dueAt)}` : `Prazo ${formatDate(d.dueAt)}`) : "Sem prazo"}
        </div>
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">{d.priority}</span>
    </li>
  );
}

function DecisionsCard({ data, loading }: { data: LeadershipRoomData["decisions"] | undefined; loading: boolean }) {
  return (
    <SectionCard title="Central de decisões" icon={ScrollText} href="/app/organization/decisions" hint={data?.openCount ? `${data.openCount} abertas` : undefined}>
      {loading ? (
        <SkeletonRows n={3} compact />
      ) : !data?.recent.length ? (
        <EmptyRow icon={ScrollText} title="Sem decisões registradas" hint="Toda reunião gera uma decisão. Registre a primeira." compact />
      ) : (
        <ul className="divide-y divide-border">
          {data.recent.slice(0, 4).map((d) => (
            <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.dueAt ? `Prazo ${formatDate(d.dueAt)}` : `Atualizada ${formatDate(d.updatedAt)}`}
                </div>
              </div>
              <DecisionBadge status={d.status} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function AiCoachCard({ planEnabled }: { planEnabled: boolean }) {
  const suggestions = [
    "Preparar roteiro para o próximo 1:1",
    "Gerar plano de ação para delegação atrasada",
    "Resumir a semana da equipe",
  ];
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> IA Coach
      </div>
      <div className="mt-2 font-display text-lg">Quer ajuda para preparar a próxima conversa?</div>
      <ul className="mt-4 space-y-1.5">
        {suggestions.map((s) => (
          <li key={s}>
            <Link
              to="/app/ai"
              className="group flex items-center justify-between rounded-lg border border-transparent bg-background/60 px-3 py-2 text-sm transition-colors hover:border-border hover:bg-background"
            >
              <span className="truncate">{s}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {!planEnabled && (
        <div className="mt-3 text-[11px] text-muted-foreground">Disponível conforme o plano contratado.</div>
      )}
    </section>
  );
}

function QuickIndicators({ data, health }: { data: LeadershipRoomData | undefined; health: HealthScore | undefined }) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <IndicatorCard icon={Activity} label="Saúde da equipe" value={data ? `${data.structure.peopleCount}` : "—"} hint="pessoas ativas" />
      <IndicatorCard icon={Target} label="Estrutura" value={data ? `${data.structure.areas}·${data.structure.teams}` : "—"} hint="áreas · equipes" />
      <IndicatorCard icon={Flame} label="Alertas críticos" value={data?.delegations.overdueCount ?? "—"} tone={(data?.delegations.overdueCount ?? 0) > 0 ? "warn" : "default"} hint="delegações atrasadas" />
      <IndicatorCard icon={MessageSquare} label="Score organizacional" value={health?.score ?? "—"} tone={healthTone(health?.score)} hint="0 a 100" />
    </section>
  );
}

// ---------- PRIMITIVES ----------

function SectionCard({
  title, icon: Icon, href, hint, tone = "default", children,
}: { title: string; icon: typeof CalendarClock; href: string; hint?: string; tone?: "default" | "warn"; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to={href} className="flex items-center gap-2 text-sm font-medium hover:underline">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </Link>
        {hint && (
          <span className={`text-xs ${tone === "warn" ? "text-accent" : "text-muted-foreground"}`}>{hint}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function ScoreChip({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "warn" | "good" }) {
  const cls = tone === "good" ? "text-success" : tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-2xl ${cls}`}>{value}</div>
    </div>
  );
}

function IndicatorCard({ icon: Icon, label, value, hint, tone = "default" }: { icon: typeof Activity; label: string; value: number | string; hint?: string; tone?: "default" | "warn" | "good" }) {
  const cls = tone === "good" ? "text-success" : tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        {label} <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={`mt-2 font-display text-2xl ${cls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" | "good" }) {
  const cls = tone === "good" ? "text-success" : tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-lg bg-secondary/40 py-2">
      <div className={`font-display text-lg ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Avatar({ name, severity }: { name: string; severity: "high" | "medium" | "low" }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const cls =
    severity === "high" ? "bg-attention/15 text-accent" :
    severity === "medium" ? "bg-secondary text-foreground" :
    "bg-muted text-muted-foreground";
  return <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-medium ${cls}`}>{initials || "•"}</span>;
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

function healthTone(score?: number): "default" | "warn" | "good" {
  if (score == null) return "default";
  if (score >= 70) return "good";
  return "warn";
}