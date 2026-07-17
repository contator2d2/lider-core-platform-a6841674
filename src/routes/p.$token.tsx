import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageCircleHeart, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Public pulse response page — no auth required.
 * URL: /p/:token
 */

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  component: PublicPulsePage,
});

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type Question =
  | { id: string; type: "scale"; label: string; minLabel?: string; maxLabel?: string; required?: boolean }
  | { id: string; type: "text"; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: "choice"; label: string; options: string[]; multi?: boolean; required?: boolean }
  | { id: string; type: "disc_pair"; label: string; options: { text: string; dim: "D" | "I" | "S" | "C" }[] };

type Payload = {
  id: string;
  token: string;
  subjectLabel: string | null;
  message: string | null;
  senderName: string;
  template: {
    kind: "feedback" | "climate" | "disc" | "custom";
    title: string;
    intro: string | null;
    questions: Question[];
  };
  expiresAt: string;
};

function PublicPulsePage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/pulse/${token}`);
        const json = await res.json();
        if (cancel) return;
        if (!res.ok) setError(json.error ?? "Não foi possível abrir a pesquisa.");
        else setData(json as Payload);
      } catch {
        if (!cancel) setError("Erro de conexão. Tente novamente.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  const questions = data?.template.questions ?? [];
  const isDisc = data?.template.kind === "disc";
  const totalSteps = isDisc ? questions.length : 1;
  const current = isDisc ? questions[step] : null;
  const progress = isDisc ? Math.round(((step + 1) / totalSteps) * 100) : 0;

  const allRequiredFilled = useMemo(() => {
    if (!data) return false;
    for (const q of questions) {
      if ("required" in q && q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") return false;
      }
      if (q.type === "disc_pair") {
        // all pairs required
        if (!answers[q.id]) return false;
      }
    }
    return true;
  }, [answers, questions, data]);

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/public/pulse/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            !
          </div>
          <h1 className="mt-4 text-lg font-semibold">{error}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Se precisar, peça à pessoa que enviou pra gerar um novo link.
          </p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo pesquisa…
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Obrigado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua resposta foi enviada com segurança. Você pode fechar esta página.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {data.template.kind === "feedback"
            ? "Feedback solicitado"
            : data.template.kind === "climate"
              ? "Pulse rápido"
              : data.template.kind === "disc"
                ? "Perfil comportamental"
                : "Pesquisa"}
        </div>
        <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{data.template.title}</h1>
        {data.template.intro && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.template.intro}</p>
        )}
        {data.message && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <MessageCircleHeart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Recado de {data.senderName}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap">{data.message}</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {isDisc && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Par {step + 1} de {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-5">
        {isDisc && current
          ? [current].map((q) => renderQuestion(q, answers, setAnswers))
          : questions.map((q) => renderQuestion(q, answers, setAnswers))}
      </div>

      <footer className="mt-8 flex flex-col gap-3">
        {isDisc ? (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-40"
            >
              Voltar
            </button>
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!answers[current!.id]}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Continuar
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!allRequiredFilled || submitting}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Enviar respostas
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={!allRequiredFilled || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Enviar respostas
          </button>
        )}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Suas respostas ficam registradas apenas para {data.senderName}.
        </div>
      </footer>
    </Shell>
  );
}

function renderQuestion(
  q: Question,
  answers: Record<string, unknown>,
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
) {
  const set = (v: unknown) => setAnswers((s) => ({ ...s, [q.id]: v }));
  if (q.type === "scale") {
    const val = answers[q.id] as number | undefined;
    return (
      <div key={q.id} className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <div className="mt-3 flex items-center justify-between gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => set(n)}
              className={
                "h-11 flex-1 rounded-lg border text-sm font-medium transition " +
                (val === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary")
              }
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{q.minLabel ?? "Baixo"}</span>
          <span>{q.maxLabel ?? "Alto"}</span>
        </div>
      </div>
    );
  }
  if (q.type === "text") {
    return (
      <div key={q.id} className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <textarea
          rows={3}
          value={(answers[q.id] as string) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={q.placeholder ?? "Escreva aqui…"}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
    );
  }
  if (q.type === "choice") {
    const val = answers[q.id];
    return (
      <div key={q.id} className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">
          {q.label} {q.required && <span className="text-destructive">*</span>}
        </label>
        <div className="mt-3 grid gap-2">
          {q.options.map((opt) => {
            const selected = q.multi
              ? Array.isArray(val) && (val as string[]).includes(opt)
              : val === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  if (q.multi) {
                    const arr = Array.isArray(val) ? [...(val as string[])] : [];
                    set(selected ? arr.filter((x) => x !== opt) : [...arr, opt]);
                  } else set(opt);
                }}
                className={
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition " +
                  (selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background hover:bg-secondary")
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.type === "disc_pair") {
    const val = answers[q.id] as string | undefined;
    return (
      <div key={q.id} className="rounded-xl border border-border bg-card p-5">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Qual frase MAIS te descreve?
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {q.options.map((opt) => {
            const selected = val === opt.text;
            return (
              <button
                key={opt.text}
                onClick={() => set(opt.text)}
                className={
                  "rounded-xl border p-4 text-left text-sm transition " +
                  (selected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-secondary")
                }
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 via-background to-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-2">
          <Logo variant="mark" className="h-7 w-7 rounded-lg" />
          <span className="font-display text-sm tracking-tight">líder core</span>
        </div>
        {children}
        <div className="mt-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Powered by Neo Pessoas · Metodologia C.O.R.E.
        </div>
      </div>
    </div>
  );
}
