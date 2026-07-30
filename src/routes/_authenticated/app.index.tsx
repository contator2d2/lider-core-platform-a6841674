// Home do líder — "Briefing do dia" (Sistema Operacional do Líder).
// Consome /me/home/briefing (agregação server-side). O app do líder é
// desacoplado da metodologia: todo o conteúdo vem do backend Neo.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";
import { api } from "@/lib/api";
import {
  Bell,
  Brain,
  Calendar as CalendarIcon,
  Compass,
  MessageSquare,
  Sparkles,
  Target,
  Users as UsersIcon,
  ArrowRight,
} from "lucide-react";
import { useFeatures, type FeaturesResponse } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/app/")({
  ssr: false,
  component: HomeBriefing,
});

type Briefing = {
  generatedAt: string;
  greeting: string;
  profile: {
    fullName: string | null;
    onboardingCompletedAt: string | null;
    didNeoMentorship: boolean;
  };
  dna: null | {
    scores: Record<string, number> | null;
    strengths: string[];
    improvements: string[];
    updatedAt: string;
  };
  initialJourney: null | { id: string; slug: string; name: string; description: string | null };
  notifications: Array<{
    id: string;
    title: string;
    body: string | null;
    linkUrl: string | null;
    createdAt: string;
  }>;
};

function HomeBriefing() {
  const featuresQ = useFeatures();
  const modules = collectModules(featuresQ.data);
  const q = useQuery({
    queryKey: ["me", "home", "briefing"],
    queryFn: () => api<Briefing>("/me/home/briefing"),
    refetchInterval: 60_000,
  });
  const data = q.data;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          Briefing do dia
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {data?.greeting ?? "Sala de liderança"}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          O que precisa da sua atenção hoje. Este é o seu Sistema Operacional do Líder — a metodologia vem toda do backend Neo.
        </p>
      </header>

      {data?.initialJourney && (
        <Link
          to="/app/journey"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-sm transition hover:bg-accent/10"
        >
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                Jornada Inicial
              </div>
              <div className="mt-1 font-medium">{data.initialJourney.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece por aqui para gerar seu CORE DNA e desbloquear o app.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-accent transition group-hover:translate-x-1" />
        </Link>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {/* Módulo C (ativo hoje) */}
        <Tile icon={Brain} label="Meu perfil" desc="Diagnóstico C.O.R.E. e CORE DNA" to="/app/consciencia" enabled={hasC} />
        <Tile icon={UsersIcon} label="Minha equipe" desc="Radar HSH, 9-box e delegações" to="/app/team" enabled={hasC} />
        <Tile icon={Target} label="PDIs" desc="Plano de desenvolvimento" to="/app/pdis" enabled={hasC} />
        <Tile icon={MessageSquare} label="Feedbacks e pulsos" desc="Enviar, receber e coletar respostas" to="/app/pulses" enabled={hasC} />
        {/* Base do app — sempre disponível, independente de módulo */}
        <Tile icon={CalendarIcon} label="Agenda" desc="Rituais, 1:1s e compromissos" to="/app/consciencia/agenda" enabled />
        <Tile icon={NotebookPen} label="Notas" desc="Anotações rápidas e por voz" to="/app/notes" enabled />
        <Tile icon={Sparkles} label="Copiloto IA" desc="Coach e recomendações" to="/app/ai" enabled />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Últimos avisos
            </h2>
          </div>
          <Link to="/app/notifications" className="text-xs font-medium text-accent hover:underline">
            Ver tudo
          </Link>
        </div>
        <ul className="space-y-2">
          {(data?.notifications ?? []).slice(0, 4).map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
            </li>
          ))}
          {!q.isLoading && (data?.notifications ?? []).length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Nada novo por aqui. Tudo tranquilo.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function collectModules(features: FeaturesResponse | undefined): Set<string> {
  const roles = features?.roles ?? [];
  const isAdmin = roles.includes("super_admin") || roles.includes("neo_admin");
  if (isAdmin || !features) return new Set(["consciencia", "organizacao", "resultado", "evolucao"]);
  const set = new Set<string>();
  for (const [k, actions] of Object.entries(features.features ?? {})) {
    if (Object.values(actions ?? {}).some(Boolean)) set.add(k.split(".")[0]);
  }
  return set;
}

function Tile({
  icon: Icon,
  label,
  desc,
  to,
  enabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  to: string;
  enabled: boolean;
}) {
  const inner = (
    <div
      className={
        "flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition " +
        (enabled
          ? "border-border bg-card hover:bg-secondary/40"
          : "border-dashed border-border bg-muted/40 text-muted-foreground")
      }
    >
      <div
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl " +
          (enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")
        }
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{label}</div>
          {!enabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest">
              Em breve
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
  return enabled ? <Link to={to}>{inner}</Link> : <div aria-disabled>{inner}</div>;
}