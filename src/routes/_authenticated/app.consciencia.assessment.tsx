import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/consciencia/assessment")({
  component: AssessmentWizard,
});

type DiscPrimary = "D" | "I" | "S" | "C";
type Profile = {
  declaredRole: string | null; notMine: string | null;
  discPrimary: DiscPrimary | null; mbtiType: string | null;
  sabotages: string[]; riskFlags: string[];
  hardSelfScore: number | null; softSelfScore: number | null; heartSelfScore: number | null;
  strengths: string[]; notes: string | null; communicationStyle: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
};
type Me = { profile: Profile | null };

const DISC = [
  { key: "D" as const, title: "Dominante",  desc: "Direto, decidido, orientado a resultado." },
  { key: "I" as const, title: "Influente",  desc: "Comunicativo, entusiasta, mobiliza pessoas." },
  { key: "S" as const, title: "Estável",    desc: "Cooperativo, paciente, mantém o time unido." },
  { key: "C" as const, title: "Cauteloso",  desc: "Analítico, metódico, valoriza precisão." },
];
const SABOTAGES = [
  "Juiz interno","Agradador","Hiper-realizador","Hiper-racional","Vítima",
  "Evasivo","Controlador","Reservado","Inquieto","Perfeccionista",
];
const RISKS = [
  { value: "controle", label: "Controle excessivo" },
  { value: "evita_conflito", label: "Evita conflito" },
  { value: "cobranca_dura", label: "Cobrança dura" },
  { value: "perfeccionismo", label: "Perfeccionismo" },
  { value: "impaciencia", label: "Impaciência" },
  { value: "acomodacao", label: "Acomodação" },
];

const HSH_QUESTIONS = {
  hard: [
    "Sei traduzir a estratégia em indicadores claros para meu time.",
    "Planejo semana e trimestre com método (não no improviso).",
    "Sei ler dados e mudar rota quando o número muda.",
  ],
  soft: [
    "Delego com clareza e acompanho sem sufocar.",
    "Dou feedback direto, no tempo certo, sem rodeio.",
    "Conduzo decisões difíceis mesmo sob pressão.",
  ],
  heart: [
    "Escuto o que não foi dito e acolho antes de reagir.",
    "Sou coerente entre o que falo e o que faço.",
    "Cuido de mim para poder cuidar de quem lidero.",
  ],
};

function AssessmentWizard() {
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<Me>(`/organization/${orgId}/consciencia/me`),
  });

  const initial = data?.profile ?? null;
  const [step, setStep] = useState(0);
  const [declaredRole, setDeclaredRole] = useState("");
  const [notMine, setNotMine] = useState("");
  const [discPrimary, setDiscPrimary] = useState<DiscPrimary | null>(null);
  const [mbtiType, setMbtiType] = useState("");
  const [sabotages, setSabotages] = useState<string[]>([]);
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [hard, setHard] = useState<number[]>([3, 3, 3]);
  const [soft, setSoft] = useState<number[]>([3, 3, 3]);
  const [heart, setHeart] = useState<number[]>([3, 3, 3]);

  // hidrata quando dados chegam
  useMemo(() => {
    if (!initial) return;
    setDeclaredRole(initial.declaredRole ?? "");
    setNotMine(initial.notMine ?? "");
    setDiscPrimary(initial.discPrimary ?? null);
    setMbtiType(initial.mbtiType ?? "");
    setSabotages(initial.sabotages ?? []);
    setRiskFlags(initial.riskFlags ?? []);
  }, [initial]);

  const avg = (arr: number[]) => Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 20); // 1..5 → 20..100
  const hardScore = avg(hard);
  const softScore = avg(soft);
  const heartScore = avg(heart);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          declaredRole: declaredRole || null,
          notMine: notMine || null,
          discPrimary,
          mbtiType: mbtiType.toUpperCase() || null,
          assessmentType: "disc",
          sabotages,
          riskFlags,
          hardSelfScore: hardScore,
          softSelfScore: softScore,
          heartSelfScore: heartScore,
          markAssessedNow: true,
        },
      }),
    onSuccess: () => {
      toast.success("Assessment concluído.");
      navigate({ to: "/app/consciencia" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  if (!orgId) return null;
  if (isLoading) return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando…</div>;

  const steps = [
    { title: "Papel",      hint: "Pra que sua liderança existe." },
    { title: "DISC · MBTI", hint: "Como você opera no mundo." },
    { title: "Sabotadores", hint: "As vozes que travam você." },
    { title: "Riscos",      hint: "Padrões que aparecem sob pressão." },
    { title: "Hard · Soft · Heart", hint: "Autoavaliação nas 3 dimensões." },
  ];
  const canNext = () => {
    if (step === 0) return declaredRole.trim().length > 3;
    if (step === 1) return !!discPrimary;
    return true;
  };
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Módulo C · Assessment guiado</div>
        <h1 className="mt-2 font-display text-3xl leading-tight">{steps[step].title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{steps[step].hint}</p>

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-foreground" : "bg-border")} />
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Papel declarado *</Label>
              <Input value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value)} placeholder="Ex.: líder integrador que forma gente e entrega resultado" />
            </div>
            <div>
              <Label>O que NÃO é meu papel</Label>
              <Textarea rows={3} value={notMine} onChange={(e) => setNotMine(e.target.value)} placeholder="Ex.: executar tarefas técnicas do time; ser bombeiro de conflitos entre pares." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label>Estilo DISC predominante *</Label>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {DISC.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDiscPrimary(d.key)}
                    className={
                      "rounded-xl border p-3 text-left transition-colors " +
                      (discPrimary === d.key
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:bg-secondary/60")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-display text-lg">{d.title}</div>
                      <span className="rounded-full border border-border px-1.5 text-xs font-mono">{d.key}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>MBTI (opcional)</Label>
              <Input value={mbtiType} onChange={(e) => setMbtiType(e.target.value.toUpperCase().slice(0, 4))} placeholder="Ex.: ENTJ" maxLength={4} />
              <p className="mt-1 text-xs text-muted-foreground">4 letras. Se não sabe, deixe em branco.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Marque as vozes internas que mais atrapalham você.</p>
            <div className="flex flex-wrap gap-2">
              {SABOTAGES.map((s) => {
                const on = sabotages.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(sabotages, s, setSabotages)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary")
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Padrões que aparecem quando a pressão sobe.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {RISKS.map((r) => {
                const on = riskFlags.includes(r.value);
                return (
                  <button
                    key={r.value}
                    onClick={() => toggle(riskFlags, r.value, setRiskFlags)}
                    className={
                      "flex items-center justify-between rounded-xl border p-3 text-sm transition-colors " +
                      (on ? "border-foreground bg-foreground/5" : "border-border hover:bg-secondary/60")
                    }
                  >
                    <span>{r.label}</span>
                    {on && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Para cada afirmação, escolha de 1 (discordo totalmente) a 5 (concordo totalmente).</p>
            <HshBlock title="Hard — saber fazer" color="bg-primary" values={hard} setValues={setHard} questions={HSH_QUESTIONS.hard} />
            <HshBlock title="Soft — saber agir"  color="bg-accent"  values={soft} setValues={setSoft} questions={HSH_QUESTIONS.soft} />
            <HshBlock title="Heart — saber ser"  color="bg-success" values={heart} setValues={setHeart} questions={HSH_QUESTIONS.heart} />
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Resultado inicial
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <ResultTile label="Hard"  value={hardScore} />
                <ResultTile label="Soft"  value={softScore} />
                <ResultTile label="Heart" value={heartScore} />
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {step < steps.length - 1 ? (
          <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)} className="gap-1.5">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={save.isPending} onClick={() => save.mutate()} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Concluir
          </Button>
        )}
      </footer>
    </div>
  );
}

function HshBlock({
  title, color, values, setValues, questions,
}: { title: string; color: string; values: number[]; setValues: (v: number[]) => void; questions: string[] }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={"h-2.5 w-2.5 rounded-full " + color} />
        <div className="font-display text-lg">{title}</div>
      </div>
      <ul className="space-y-3">
        {questions.map((q, i) => (
          <li key={i}>
            <div className="text-sm">{q}</div>
            <div className="mt-1.5 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setValues(values.map((x, j) => (j === i ? v : x)))}
                  className={
                    "h-9 flex-1 rounded-lg border text-sm transition-colors " +
                    (values[i] === v
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:bg-secondary")
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}<span className="text-sm text-muted-foreground">/100</span></div>
    </div>
  );
}