import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, CalendarClock, MessageSquare, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/app/")({
  component: LeaderHome,
});

type Attention = {
  name: string;
  reason: string;
  since: string;
  action: string;
  severity: "high" | "medium" | "low";
};

const attention: Attention[] = [
  {
    name: "Marina Alves",
    reason: "Sem 1:1 há 21 dias",
    since: "Última conversa: 11/06",
    action: "Agendar 1:1",
    severity: "high",
  },
  {
    name: "Rafael Souza",
    reason: "Feedback pendente há 5 dias",
    since: "Solicitado por você em 27/06",
    action: "Registrar feedback",
    severity: "high",
  },
  {
    name: "Camila Prado",
    reason: "Check-in negativo esta semana",
    since: "Score de humor caiu 40%",
    action: "Conversar",
    severity: "medium",
  },
  {
    name: "João Ribeiro",
    reason: "PDI sem evolução há 30 dias",
    since: "Última ação: 02/06",
    action: "Revisar PDI",
    severity: "low",
  },
];

function LeaderHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user?.roles?.includes("super_admin")) {
      navigate({ to: "/admin", replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Consciência · Hoje
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
            Quem precisa da sua
            <br />
            <span className="text-accent italic">atenção agora?</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              CORE Score
            </div>
            <div className="mt-1 font-display text-3xl">78</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-xs text-muted-foreground">
            <div>Equipe estável</div>
            <div className="text-success">+4 pts vs. mês passado</div>
          </div>
        </div>
      </header>

      {/* Ações prioritárias */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Prioridades da IA</h2>
          <span className="text-xs text-muted-foreground">
            {attention.length} pessoas mapeadas
          </span>
        </div>
        <ul className="grid gap-3">
          {attention.map((a) => (
            <li
              key={a.name}
              className="group flex items-center justify-between gap-6 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-4">
                <span
                  className={
                    "grid h-11 w-11 place-items-center rounded-full font-medium " +
                    (a.severity === "high"
                      ? "bg-attention/15 text-accent"
                      : a.severity === "medium"
                        ? "bg-secondary text-foreground"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {a.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-sm text-muted-foreground">{a.reason}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground/70">
                    {a.since}
                  </div>
                </div>
              </div>
              <button className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground group-hover:flex">
                {a.action}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Rotina de hoje */}
      <section className="mt-14 grid gap-6 md:grid-cols-3">
        <QuickCard
          icon={CalendarClock}
          title="Próximo ritual"
          value="Weekly do time"
          hint="Hoje, 15:30 · 6 participantes"
        />
        <QuickCard
          icon={MessageSquare}
          title="1:1s desta semana"
          value="3 agendados"
          hint="2 realizados · 1 pendente"
        />
        <QuickCard
          icon={Sparkles}
          title="Sugestão da IA"
          value="Reveja o PDI da Marina"
          hint="Padrão detectado após check-in"
        />
      </section>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: typeof CalendarClock;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        {title}
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="mt-3 font-display text-xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}