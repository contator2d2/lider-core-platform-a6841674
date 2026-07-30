import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Página pública para responder assessments via link externo (sem login).
 * URL: /pa/:token
 */
export const Route = createFileRoute("/pa/$token")({
  ssr: false,
  component: PublicAssessmentPage,
});

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type Option = { id: string; label: string; value: string };
type Question = {
  id: string;
  type: "unica" | "multipla" | "likert" | "slider" | "ranking" | "texto" | "cenario" | "autoavaliacao";
  prompt: string;
  helpText: string | null;
  required: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  options: Option[];
};
type Block = { id: string; title: string; description: string | null; questions: Question[] };
type Payload = {
  id: string;
  name: string;
  objective: string | null;
  audience: string | null;
  coreModule: string | null;
  estimatedTime: number | null;
  label: string | null;
  blocks: Block[];
};

function PublicAssessmentPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [blockIdx, setBlockIdx] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/assessment/${token}`);
        const json = await res.json();
        if (cancel) return;
        if (!res.ok) setError(json.error ?? "Não foi possível abrir o teste.");
        else setData(json as Payload);
      } catch {
        if (!cancel) setError("Erro de conexão. Tente novamente.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  const blocks = data?.blocks ?? [];
  const totalBlocks = blocks.length;
  const currentBlock = blocks[blockIdx];
  const progress = totalBlocks > 0 ? Math.round(((blockIdx + 1) / totalBlocks) * 100) : 0;

  const blockValid = useMemo(() => {
    if (!currentBlock) return true;
    for (const q of currentBlock.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (v === undefined || v === null || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
    }
    return true;
  }, [currentBlock, answers]);

  const allValid = useMemo(() => {
    for (const b of blocks) {
      for (const q of b.questions) {
        if (!q.required) continue;
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") return false;
        if (Array.isArray(v) && v.length === 0) return false;
      }
    }
    return true;
  }, [blocks, answers]);

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/public/assessment/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondentName: name || null,
          respondentEmail: email || null,
          answers,
        }),
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
        <div className="animate-fade-in rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-2xl font-bold text-destructive">!</div>
          <h1 className="mt-4 text-lg font-semibold">{error}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Se precisar, peça a quem enviou pra gerar um novo link.</p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
            <div className="relative grid h-12 w-12 place-items-center rounded-full bg-accent-gradient text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <span className="text-sm font-medium">Preparando o teste…</span>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="animate-scale-in relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-2xl">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-gradient text-white shadow-xl ring-8 ring-accent/10">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="relative mt-5 font-display text-3xl">Obrigado! 🎉</h1>
          <p className="relative mt-2 text-sm text-muted-foreground">Sua resposta foi enviada com segurança. Você pode fechar esta página.</p>
        </div>
      </Shell>
    );
  }

  const isLast = blockIdx >= totalBlocks - 1;

  return (
    <Shell>
      <header className="animate-fade-in relative mb-6 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-md">
            <Sparkles className="h-3 w-3" /> {data.coreModule ? `Módulo ${data.coreModule}` : "Assessment"}
          </span>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{data.name}</h1>
          {data.objective && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.objective}</p>}
          {data.estimatedTime && (
            <p className="mt-2 text-xs text-muted-foreground">⏱ Tempo estimado: {data.estimatedTime} min</p>
          )}
        </div>
      </header>

      {blockIdx === 0 && (
        <div className="animate-fade-in mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-widest text-accent">Identificação (opcional)</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Seu e-mail"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      )}

      {totalBlocks > 1 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Bloco {blockIdx + 1} de {totalBlocks}</span>
            <span className="text-accent">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary shadow-inner">
            <div className="h-full rounded-full bg-accent-gradient shadow-[0_0_12px_var(--accent)] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {currentBlock && (
        <div key={currentBlock.id} className="animate-fade-in space-y-5">
          <div>
            <h2 className="font-display text-2xl">{currentBlock.title}</h2>
            {currentBlock.description && (
              <p className="mt-1 text-sm text-muted-foreground">{currentBlock.description}</p>
            )}
          </div>
          {currentBlock.questions.map((q, i) => renderQuestion(q, answers, setAnswers, i))}
        </div>
      )}

      <footer className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setBlockIdx((s) => Math.max(0, s - 1))}
            disabled={blockIdx === 0}
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40"
          >
            ← Voltar
          </button>
          {!isLast ? (
            <button
              onClick={() => {
                if (!blockValid) return;
                setBlockIdx((s) => Math.min(totalBlocks - 1, s + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={!blockValid}
              className="rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!allValid || submitting}
              className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Enviar respostas
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Suas respostas ficam registradas apenas para quem enviou este link.
        </div>
      </footer>
    </Shell>
  );
}

function renderQuestion(
  q: Question,
  answers: Record<string, unknown>,
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  index = 0,
) {
  const set = (v: unknown) => setAnswers((s) => ({ ...s, [q.id]: v }));
  const delay = { animationDelay: `${index * 60}ms` };

  if (q.type === "likert" || q.type === "slider" || q.type === "autoavaliacao") {
    const min = q.scaleMin ?? 1;
    const max = q.scaleMax ?? 5;
    const scale = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const val = answers[q.id] as number | undefined;
    // rótulos vindos do helpText no formato "1 Nem um pouco · 2 Um pouco · ..."
    const parsedLabels = (q.helpText ?? "")
      .split("·")
      .map((p) => p.trim())
      .map((p) => /^\d+\s+(.+)$/.exec(p)?.[1]?.trim() ?? "")
      .filter(Boolean);
    const labels = parsedLabels.length === scale.length ? parsedLabels : null;
    return (
      <div key={q.id} style={delay} className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
        <label className="text-sm font-semibold">
          {q.prompt} {q.required && <span className="text-destructive">*</span>}
        </label>
        {q.helpText && !labels && <p className="mt-1 text-xs text-muted-foreground">{q.helpText}</p>}
        <div className="mt-4 flex items-stretch justify-between gap-2">
          {scale.map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => set(n)}
              className={
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-3 transition-all duration-200 " +
                (val === n
                  ? "border-transparent bg-accent-gradient text-white shadow-lg shadow-accent/40"
                  : "border-border bg-background hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5")
              }
            >
              <span className="text-base font-bold">{n}</span>
              {labels && (
                <span className={"text-[10px] leading-tight " + (val === n ? "text-white/90" : "text-muted-foreground")}>
                  {labels[i]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "texto" || q.type === "cenario") {
    return (
      <div key={q.id} style={delay} className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm transition focus-within:border-accent/60 focus-within:shadow-md">
        <label className="text-sm font-semibold">
          {q.prompt} {q.required && <span className="text-destructive">*</span>}
        </label>
        {q.helpText && <p className="mt-1 text-xs text-muted-foreground">{q.helpText}</p>}
        <textarea
          rows={4}
          value={(answers[q.id] as string) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder="Escreva aqui…"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
    );
  }

  if (q.type === "unica" || q.type === "multipla" || q.type === "ranking") {
    const multi = q.type === "multipla";
    const val = answers[q.id];
    return (
      <div key={q.id} style={delay} className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="text-sm font-semibold">
          {q.prompt} {q.required && <span className="text-destructive">*</span>}
        </label>
        {q.helpText && <p className="mt-1 text-xs text-muted-foreground">{q.helpText}</p>}
        <div className="mt-4 grid gap-2.5">
          {q.options.map((opt) => {
            const selected = multi
              ? Array.isArray(val) && (val as string[]).includes(opt.value)
              : val === opt.value;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (multi) {
                    const arr = Array.isArray(val) ? [...(val as string[])] : [];
                    set(selected ? arr.filter((x) => x !== opt.value) : [...arr, opt.value]);
                  } else set(opt.value);
                }}
                className={
                  "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 " +
                  (selected
                    ? "translate-x-1 border-accent bg-accent/15 shadow-md shadow-accent/20"
                    : "border-border bg-background hover:translate-x-1 hover:border-accent/40 hover:bg-accent/5")
                }
              >
                <span
                  className={
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition " +
                    (selected ? "border-transparent bg-accent-gradient text-white" : "border-border")
                  }
                >
                  {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                </span>
                <span>{opt.label}</span>
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="animate-fade-in mb-8 flex items-center justify-center">
          <Logo variant="mark" className="h-9 w-9 rounded-xl shadow-md" />
        </div>
        {children}
      </div>
    </div>
  );
}