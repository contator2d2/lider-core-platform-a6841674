import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CalendarDays,
  Bell,
  Bookmark,
  Zap,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  X,
  ArrowRight,
  Pencil,
  Quote,
  TrendingUp,
  User,
  CalendarClock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Feature, useFeature } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/consciencia")({
  component: ConscienciaPage,
});

type Profile = {
  id: string;
  declaredRole: string | null;
  notMine: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
  assessmentTraits: Record<string, unknown> | null;
  sabotages: string[];
  communicationStyle: string | null;
  mbtiType: string | null;
  discPrimary: "D" | "I" | "S" | "C" | null;
  hardSelfScore: number | null;
  softSelfScore: number | null;
  heartSelfScore: number | null;
  riskFlags: string[];
  strengths: string[];
  notes: string | null;
  assessmentAt: string | null;
  updatedAt: string;
};

type Commitment = {
  id: string;
  phrase: string;
  status: "active" | "in_progress" | "done" | "dropped";
  reviewAt: string | null;
  createdAt: string;
};

type CrossSignal = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  createdAt: string;
};

type MeResponse = {
  profile: Profile | null;
  commitments: Commitment[];
  signals: CrossSignal[];
  assessmentStale: boolean;
};

const RISK_OPTIONS = [
  { value: "controle", label: "Controle excessivo" },
  { value: "evita_conflito", label: "Evita conflito" },
  { value: "cobranca_dura", label: "Cobrança dura" },
  { value: "perfeccionismo", label: "Perfeccionismo" },
  { value: "impaciencia", label: "Impaciência" },
  { value: "acomodacao", label: "Acomodação" },
];

const SABOTAGE_OPTIONS = [
  "Juiz interno",
  "Agradador",
  "Hiper-realizador",
  "Hiper-racional",
  "Vítima",
  "Evasivo",
  "Controlador",
  "Reservado",
  "Inquieto",
];

function ConscienciaPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const canEditProfile = useFeature("consciencia.profile", "edit");
  const canEditCommitments = useFeature("consciencia.commitments", "edit");

  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<MeResponse>(`/organization/${orgId}/consciencia/me`),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/signals/${id}/dismiss`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  const delCommitment = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/commitments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  const patchCommitment = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Commitment["status"] }) =>
      api(`/organization/${orgId}/consciencia/commitments/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  if (!orgId) return null;

  const profile = data?.profile ?? null;
  const commitments = data?.commitments ?? [];
  const signals = data?.signals ?? [];

  // ---------- Trilha do perfil (steps) ----------
  const behavioralDone = !!(profile?.discPrimary || profile?.mbtiType);
  const roleDone = !!(profile?.declaredRole && profile.declaredRole.trim().length > 0);
  const sabCount = profile?.sabotages?.length ?? 0;
  const sabotagesState: "done" | "progress" | "pending" =
    sabCount >= 3 ? "done" : sabCount > 0 ? "progress" : "pending";
  const activeCommitments = commitments.filter((c) => c.status !== "done" && c.status !== "dropped").length;
  const evolutionDone = activeCommitments > 0;

  type TrilhaStep = {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    state: "done" | "progress" | "pending";
    to: string;
    openProfile?: boolean;
  };
  const trilha: TrilhaStep[] = [
    {
      key: "behavioral",
      icon: Brain,
      title: "Perfil Comportamental",
      subtitle: profile?.discPrimary || profile?.mbtiType
        ? `${profile?.discPrimary ? "DISC " + profile.discPrimary : "DISC —"} · ${profile?.mbtiType || "MBTI —"}`
        : "DISC · MBTI",
      state: behavioralDone ? "done" : "pending",
      to: "/app/consciencia/assessment",
    },
    {
      key: "role",
      icon: User,
      title: "Meu Papel",
      subtitle: "Função e responsabilidades",
      state: roleDone ? "done" : "pending",
      to: "/app/consciencia",
      openProfile: true,
    },
    {
      key: "sabotages",
      icon: Zap,
      title: "Sabotadores",
      subtitle: sabCount > 0 ? `${sabCount} identificado${sabCount > 1 ? "s" : ""}` : "Identifique os principais",
      state: sabotagesState,
      to: "/app/consciencia",
      openProfile: true,
    },
    {
      key: "evolution",
      icon: TrendingUp,
      title: "Plano de Evolução",
      subtitle: activeCommitments > 0 ? `${activeCommitments} meta${activeCommitments > 1 ? "s" : ""} ativa${activeCommitments > 1 ? "s" : ""}` : "Defina suas próximas metas",
      state: evolutionDone ? "done" : "pending",
      to: "/app/consciencia/pdi",
    },
  ];

  const completedSteps = trilha.filter((s) => s.state === "done").length;
  const progressPct = Math.round((completedSteps / trilha.length) * 100);
  const missingSteps = trilha.length - completedSteps;
  const nextStep = trilha.find((s) => s.state !== "done") ?? null;

  // Evolução geral (média das autoavaliações H·S·H)
  const hshValues = [profile?.hardSelfScore, profile?.softSelfScore, profile?.heartSelfScore].filter(
    (v): v is number => typeof v === "number",
  );
  const evolutionAvg = hshValues.length ? Math.round(hshValues.reduce((a, b) => a + b, 0) / hshValues.length) : null;

  // Histórico recente — deriva do que temos disponível
  const history: Array<{ when: string; label: string; done: boolean }> = [];
  if (profile?.updatedAt) history.push({ when: relativeDay(profile.updatedAt), label: "Você atualizou seu perfil", done: true });
  if (profile?.discPrimary) history.push({ when: relativeDay(profile.assessmentAt ?? profile.updatedAt), label: `DISC ${profile.discPrimary} concluído`, done: true });
  if (profile?.mbtiType) history.push({ when: relativeDay(profile.assessmentAt ?? profile.updatedAt), label: `MBTI ${profile.mbtiType} concluído`, done: true });

  const primaryInsight = signals[0] ?? null;

  return (
    <div className="mx-auto max-w-md space-y-5 pb-24 md:max-w-3xl">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
            Módulo C — Consciência
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl">
            Meu Perfil
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Conheça melhor a si mesmo e lidere com consciência todos os dias.
          </p>
        </div>
        {canEditProfile && (
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[11px] font-semibold text-background shadow-sm transition-transform hover:scale-[1.02] active:scale-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Atualizar perfil
              </button>
            </DialogTrigger>
            <ProfileDialog
              orgId={orgId!}
              initial={profile}
              onDone={() => {
                setProfileOpen(false);
                qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
              }}
            />
          </Dialog>
        )}
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {/* Progresso */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Seu progresso</div>
        <div className="mt-4 flex items-center gap-5">
          <ProgressGauge value={progressPct} />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            {missingSteps > 0
              ? <>Falta{missingSteps > 1 ? "m" : ""} <strong className="text-foreground">{missingSteps} etapa{missingSteps > 1 ? "s" : ""}</strong> para concluir seu perfil</>
              : "Perfil completo. Continue evoluindo com a trilha."}
            <button
              type="button"
              onClick={() => document.getElementById("trilha")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              Ver trilha <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>

      {/* Trilha */}
      <section id="trilha" className="space-y-3">
        <div className="text-sm font-semibold">Sua trilha</div>
        <ul className="space-y-2.5">
          {trilha.map((step) => (
            <TrilhaItem
              key={step.key}
              icon={step.icon}
              title={step.title}
              subtitle={step.subtitle}
              state={step.state}
              onClick={() => {
                if (step.openProfile && canEditProfile) setProfileOpen(true);
                else window.location.assign(step.to);
              }}
            />
          ))}
        </ul>
      </section>

      {/* Próximo passo */}
      {nextStep && (
        <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background text-accent shadow-sm">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                Próximo passo · Hoje
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold">
                Continue: {nextStep.title}
              </div>
              <div className="text-[11px] text-muted-foreground">5 minutos</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (nextStep.openProfile && canEditProfile) setProfileOpen(true);
                else window.location.assign(nextStep.to);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background shadow-sm transition-transform hover:scale-[1.02]"
            >
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Evolução + Insights */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Minha evolução
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold">{evolutionAvg ?? "—"}</span>
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Evolução geral</div>
          <MiniSpark values={hshValues.length ? hshValues : [30, 45, 60]} />
          <Link to="/app/evolution" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            Ver detalhes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Insights de hoje
          </div>
          <div className="mt-2 flex items-start gap-2 text-[13px] leading-snug">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-foreground">
              {primaryInsight?.detail ?? "Você tende a decidir rápido e a assumir responsabilidades."}
            </p>
          </div>
          <Link to="/app/coach" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            Ver insights <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* Histórico */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Histórico recente</div>
          <ul className="mt-3 space-y-3">
            {history.slice(0, 4).map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px]">
                <div className="relative flex flex-col items-center">
                  <div className={"h-2.5 w-2.5 rounded-full " + (i === 0 ? "bg-accent ring-4 ring-accent/20" : "border border-border bg-background")} />
                </div>
                <div className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {h.when}
                </div>
                <div className="min-w-0 flex-1 truncate text-foreground/90">{h.label}</div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA final */}
      {canEditProfile && (
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary/60"
        >
          <Pencil className="h-4 w-4" /> Editar perfil
        </button>
      )}

      {/* Alertas cruzados (mantido, discreto) */}
      <Feature featureKey="consciencia.cross_signals">
        {signals.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Alertas cruzados</h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{signals.length}</span>
            </div>
            <ul className="space-y-2">
              {signals.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div
                        className={
                          "mt-0.5 rounded-full p-1 " +
                          (s.severity === "high"
                            ? "bg-destructive/15 text-destructive"
                            : s.severity === "medium"
                            ? "bg-accent/20 text-accent"
                            : "bg-secondary text-muted-foreground")
                        }
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">{s.title}</div>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{s.detail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss.mutate(s.id)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Descartar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Feature>
    </div>
  );
}

// ---------- helpers de UI ----------
function ProgressGauge({ value }: { value: number }) {
  // Semicircle SVG gauge
  const radius = 46;
  const stroke = 10;
  const cx = 56;
  const cy = 56;
  const circ = Math.PI * radius;
  const dash = (value / 100) * circ;
  return (
    <div className="relative h-[72px] w-[112px] shrink-0">
      <svg viewBox="0 0 112 64" className="h-full w-full">
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1">
        <div className="font-display text-2xl font-bold leading-none">{value}%</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">Perfil concluído</div>
      </div>
    </div>
  );
}

function TrilhaItem({
  icon: Icon, title, subtitle, state, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  state: "done" | "progress" | "pending";
  onClick: () => void;
}) {
  const badge =
    state === "done"
      ? { label: "Concluído", cls: "bg-success/15 text-success" }
      : state === "progress"
      ? { label: "Em andamento", cls: "bg-accent/15 text-accent" }
      : { label: "Pendente", cls: "bg-secondary text-muted-foreground" };
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/60 text-foreground">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " + badge.cls}>
          {badge.label}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  const w = 120;
  const h = 32;
  const max = Math.max(100, ...values);
  const pts = values.length > 1
    ? values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ")
    : `0,${h - 4} ${w},${h - (values[0] ?? 0) / max * (h - 4) - 2}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-8 w-full">
      <polyline
        points={pts}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function relativeDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `${diff} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function FeatureRow({
  to, icon: Icon, eyebrow, title, description, purpose,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  purpose?: string[];
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </div>
        <div className="mt-0.5 font-display text-sm font-bold md:text-base">
          {title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground md:text-[13px]">
          {description}
        </p>
        {purpose && purpose.length > 0 && (
          <ul className="mt-2 space-y-1 border-l border-accent/30 pl-3">
            {purpose.map((p, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-muted-foreground md:text-xs">
                <span className="mr-1 text-accent">•</span>{p}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SummaryCard({
  title, value, icon: Icon, hint, warn,
}: { title: string; value: string; icon: typeof Sparkles; hint?: string; warn?: boolean }) {
  return (
    <div className={"rounded-2xl border p-5 " + (warn ? "border-accent/40 bg-accent/5" : "border-border bg-background")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="mt-2 text-lg font-medium">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function HSHPanel({ profile }: { profile: Profile }) {
  const dims: Array<{ key: "hard" | "soft" | "heart"; label: string; sub: string; value: number | null; tone: string }> = [
    { key: "hard", label: "Hard", sub: "Saber fazer — método, indicadores, planejamento", value: profile.hardSelfScore, tone: "bg-primary" },
    { key: "soft", label: "Soft", sub: "Saber agir — comunicação, decisão, delegação", value: profile.softSelfScore, tone: "bg-accent" },
    { key: "heart", label: "Heart", sub: "Saber ser — escuta, empatia, coerência", value: profile.heartSelfScore, tone: "bg-success" },
  ];
  const filled = dims.filter((d) => d.value != null).length;
  return (
    <section className="rounded-2xl border border-border bg-background p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Lente Hard · Soft · Heart</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Sua autoavaliação inicial nas 3 dimensões da liderança. O sistema vai inferir a evolução real a partir do seu uso em O e R.
          </div>
        </div>
        {filled < 3 && (
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-accent">
            Preencha as 3 dimensões
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {dims.map((d) => (
          <div key={d.key} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-lg">{d.label}</div>
              <div className="font-mono text-sm tabular-nums">
                {d.value != null ? `${d.value}` : "—"}<span className="text-muted-foreground">/100</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{d.sub}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/50">
              <div className={`h-full ${d.tone} transition-all`} style={{ width: `${d.value ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Dialogs ----------
function ProfileDialog({
  orgId, initial, onDone,
}: { orgId: string; initial: Profile | null; onDone: () => void }) {
  const [declaredRole, setDeclaredRole] = useState(initial?.declaredRole ?? "");
  const [notMine, setNotMine] = useState(initial?.notMine ?? "");
  const [assessmentType, setAssessmentType] = useState<Profile["assessmentType"]>(initial?.assessmentType ?? null);
  const [mbtiType, setMbtiType] = useState(initial?.mbtiType ?? "");
  const [discPrimary, setDiscPrimary] = useState<Profile["discPrimary"]>(initial?.discPrimary ?? null);
  const [hardSelfScore, setHardSelfScore] = useState<number>(initial?.hardSelfScore ?? 50);
  const [softSelfScore, setSoftSelfScore] = useState<number>(initial?.softSelfScore ?? 50);
  const [heartSelfScore, setHeartSelfScore] = useState<number>(initial?.heartSelfScore ?? 50);
  const [strengths, setStrengths] = useState((initial?.strengths ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [communicationStyle, setCommunicationStyle] = useState(initial?.communicationStyle ?? "");
  const [riskFlags, setRiskFlags] = useState<string[]>(initial?.riskFlags ?? []);
  const [sabotages, setSabotages] = useState<string[]>(initial?.sabotages ?? []);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          declaredRole: declaredRole || null,
          notMine: notMine || null,
          assessmentType,
          mbtiType: mbtiType.toUpperCase() || null,
          discPrimary,
          hardSelfScore,
          softSelfScore,
          heartSelfScore,
          strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
          communicationStyle: communicationStyle || null,
          riskFlags,
          sabotages,
          markAssessedNow: true,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Meu perfil de liderança</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <div>
          <Label>Papel declarado</Label>
          <Input value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value)} placeholder="Ex.: líder integrador, formador de gente" />
          <p className="mt-1 text-xs text-muted-foreground">Pra que essa liderança existe — em uma frase.</p>
        </div>

        <div>
          <Label>O que NÃO é meu papel</Label>
          <Textarea value={notMine} onChange={(e) => setNotMine(e.target.value)} placeholder="Ex.: executar entregas técnicas no lugar do time; resolver conflitos entre pares." className="min-h-[70px]" />
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Autoavaliação Hard · Soft · Heart</div>
          <div className="space-y-4">
            <ScoreSlider label="Hard — método, indicadores, planejamento" value={hardSelfScore} onChange={setHardSelfScore} tone="bg-primary" />
            <ScoreSlider label="Soft — comunicação, delegação, decisão" value={softSelfScore} onChange={setSoftSelfScore} tone="bg-accent" />
            <ScoreSlider label="Heart — escuta, empatia, coerência" value={heartSelfScore} onChange={setHeartSelfScore} tone="bg-success" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Ponto de partida. Depois disso, o sistema mede evolução real a partir do uso — não pede autoavaliação toda semana.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Assessment</Label>
            <Select value={assessmentType ?? ""} onValueChange={(v) => setAssessmentType((v || null) as Profile["assessmentType"])}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disc">DISC</SelectItem>
                <SelectItem value="big_five">Big Five</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estilo de comunicação (egograma)</Label>
            <Input value={communicationStyle} onChange={(e) => setCommunicationStyle(e.target.value)} placeholder="Ex.: pai crítico dominante" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Tipo MBTI (opcional)</Label>
            <Input maxLength={4} value={mbtiType} onChange={(e) => setMbtiType(e.target.value.toUpperCase())} placeholder="Ex.: ENTJ" />
          </div>
          <div>
            <Label>Perfil DISC dominante</Label>
            <Select value={discPrimary ?? ""} onValueChange={(v) => setDiscPrimary((v || null) as Profile["discPrimary"])}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="D">D — Dominância</SelectItem>
                <SelectItem value="I">I — Influência</SelectItem>
                <SelectItem value="S">S — Estabilidade</SelectItem>
                <SelectItem value="C">C — Conformidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Forças (separadas por vírgula)</Label>
          <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Visão, escuta ativa, execução" />
        </div>

        <div>
          <Label className="mb-2 block">Riscos comportamentais</Label>
          <div className="flex flex-wrap gap-2">
            {RISK_OPTIONS.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => toggle(riskFlags, r.value, setRiskFlags)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (riskFlags.includes(r.value)
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border hover:bg-secondary")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Alimentam o motor de alertas cruzados.</p>
        </div>

        <div>
          <Label className="mb-2 block">Sabotadores ativos</Label>
          <div className="flex flex-wrap gap-2">
            {SABOTAGE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggle(sabotages, s, setSabotages)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (sabotages.includes(s)
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border hover:bg-secondary")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Notas pessoais</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Somente você lê." className="min-h-[90px]" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CommitmentDialog({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/commitments`, {
        method: "POST",
        body: {
          phrase,
          reviewAt: reviewDate ? new Date(reviewDate).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Compromisso registrado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Frase-âncora</Label>
          <Textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Ex.: nesta semana, delego pelo menos 2 entregas do meu backlog." />
        </div>
        <div>
          <Label>Data de revisão</Label>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!phrase.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Registrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- labels ----------
function ScoreSlider({ label, value, onChange, tone }: { label: string; value: number; onChange: (v: number) => void; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs tabular-nums">{value}<span className="text-muted-foreground">/100</span></span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border/60 accent-primary"
          aria-label={label}
        />
        <div className={`pointer-events-none absolute inset-y-0 left-0 h-2 rounded-full ${tone} opacity-40`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function labelRisk(v: string) {
  return RISK_OPTIONS.find((r) => r.value === v)?.label ?? v;
}
function labelAssessment(v: string) {
  return v === "disc" ? "DISC" : v === "big_five" ? "Big Five" : "Outro";
}
function labelCommitmentStatus(s: Commitment["status"]) {
  return s === "active" ? "Ativo" : s === "in_progress" ? "Em execução" : s === "done" ? "Cumprido" : "Descartado";
}