import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, X, Trash2, AudioLines } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getToken } from "@/lib/api";

export type VoiceIntent = {
  tipo: "feedback" | "delegacao" | "nota" | "kudos" | "agenda";
  resumo: string;
  titulo?: string;
  prazoISO?: string | null;
  membroSugerido?: string | null;
  transcricao: string;
};

type State = "idle" | "recording" | "processing" | "review";

const BAR_COUNT = 28;

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Botão flutuante: grava áudio, envia ao backend e devolve intenção
 * classificada (feedback | delegação | nota). O consumidor decide o que fazer.
 */
export function VoiceCapture({
  orgId,
  onConfirm,
  label = "Ditar",
  variant = "button",
}: {
  orgId: string;
  onConfirm: (intent: VoiceIntent) => void | Promise<void>;
  label?: string;
  variant?: "button" | "panel";
}) {
  const [state, setState] = useState<State>("idle");
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [editable, setEditable] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, []);

  function teardown() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  async function start() {
    try {
      cancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => void handleStop(mime);
      rec.start();
      setSeconds(0);
      setLevels(Array(BAR_COUNT).fill(0.08));
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      startMeter(stream);
      setState("recording");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sem acesso ao microfone");
    }
  }

  function startMeter(stream: MediaStream) {
    try {
      const AudioCtx: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        const level = Math.min(1, Math.max(0.08, peak * 2.2));
        setLevels((prev) => [...prev.slice(1), level]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* medidor é opcional */
    }
  }

  function stop() {
    recorderRef.current?.stop();
    teardown();
  }

  function cancel() {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    teardown();
    setState("idle");
  }

  async function handleStop(mime: string) {
    if (cancelledRef.current) {
      chunksRef.current = [];
      return;
    }
    setState("processing");
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size < 1024) {
        toast.error("Gravação vazia. Tente novamente.");
        setState("idle");
        return;
      }
      const fd = new FormData();
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `recording.${ext}`);
      const base = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");
      const res = await fetch(`${base}/organization/${orgId}/ai/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: fd,
      });
      const data = (await res.json()) as VoiceIntent | { error: string };
      if (!res.ok || "error" in data) {
        toast.error(("error" in data && data.error) || "Falha ao transcrever");
        setState("idle");
        return;
      }
      setIntent(data);
      setEditable(data.resumo || data.transcricao);
      setState("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
      setState("idle");
    }
  }

  async function confirm() {
    if (!intent) return;
    await onConfirm({ ...intent, resumo: editable || intent.resumo });
    reset();
  }

  function reset() {
    setIntent(null);
    setEditable("");
    setSeconds(0);
    setState("idle");
  }

  const intentLabel = (t: VoiceIntent["tipo"]) =>
    t === "feedback"
      ? "Feedback ditado"
      : t === "delegacao"
        ? "Delegação ditada"
        : t === "kudos"
          ? "Kudos ditado"
          : t === "agenda"
            ? "Agenda de liderança"
            : "Nota ditada";

  if (state === "review" && intent) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
            <AudioLines className="h-3 w-3" /> {intentLabel(intent.tipo)}
          </span>
          {intent.membroSugerido && (
            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              {intent.membroSugerido}
            </span>
          )}
          {intent.prazoISO && (
            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              prazo {new Date(intent.prazoISO).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
        {intent.titulo && <div className="mb-2 font-medium">{intent.titulo}</div>}
        <Textarea
          value={editable}
          onChange={(e) => setEditable(e.target.value)}
          className="min-h-[100px] text-sm"
        />
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Ver transcrição bruta</summary>
          <p className="mt-1 whitespace-pre-wrap">{intent.transcricao}</p>
        </details>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={confirm} className="gap-1">
            <Check className="h-4 w-4" /> Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} className="gap-1">
            <X className="h-4 w-4" /> Descartar
          </Button>
        </div>
      </div>
    );
  }

  if (state === "recording" || state === "processing") {
    const recording = state === "recording";
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          {recording && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/25" />
              <span className="absolute inset-2 rounded-full bg-destructive/15" />
            </>
          )}
          <span
            className={
              "relative grid h-14 w-14 place-items-center rounded-full text-white " +
              (recording ? "bg-destructive" : "bg-primary")
            }
          >
            {recording ? (
              <Mic className="h-6 w-6" strokeWidth={2.25} />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </span>
        </div>

        <p className="mt-3 text-sm font-medium">
          {recording ? "Gravando… fale naturalmente" : "Transcrevendo com a IA…"}
        </p>
        <p className="font-mono text-2xl tabular-nums tracking-tight">{formatTime(seconds)}</p>

        <div className="mt-4 flex h-12 items-end justify-center gap-[3px]">
          {levels.map((l, i) => (
            <span
              key={i}
              className={
                "w-[4px] rounded-full transition-[height] duration-75 " +
                (recording ? "bg-destructive/70" : "bg-muted-foreground/30")
              }
              style={{ height: `${Math.round(l * 100)}%` }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {recording ? (
            <>
              <Button type="button" onClick={stop} className="gap-2">
                <Square className="h-4 w-4" /> Parar e transcrever
              </Button>
              <Button type="button" variant="ghost" onClick={cancel} className="gap-2">
                <Trash2 className="h-4 w-4" /> Descartar
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Isso leva alguns segundos.</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <button
          type="button"
          onClick={start}
          aria-label={label}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent text-white shadow-[0_18px_38px_-14px_color-mix(in_oklab,var(--accent)_65%,transparent)] transition active:scale-95"
        >
          <Mic className="h-8 w-8" strokeWidth={2} />
        </button>
        <p className="mt-4 text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Toque para começar. A IA transcreve e organiza para você.
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={start}
      className="gap-2"
    >
      <Mic className="h-4 w-4" /> {label}
    </Button>
  );
}