import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getToken } from "@/lib/api";

export type VoiceIntent = {
  tipo: "feedback" | "delegacao" | "nota" | "kudos";
  resumo: string;
  titulo?: string;
  prazoISO?: string | null;
  membroSugerido?: string | null;
  transcricao: string;
};

type State = "idle" | "recording" | "processing" | "review";

/**
 * Botão flutuante: grava áudio, envia ao backend e devolve intenção
 * classificada (feedback | delegação | nota). O consumidor decide o que fazer.
 */
export function VoiceCapture({
  orgId,
  onConfirm,
  label = "Ditar",
}: {
  orgId: string;
  onConfirm: (intent: VoiceIntent) => void | Promise<void>;
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [editable, setEditable] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    try {
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
      setState("recording");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sem acesso ao microfone");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleStop(mime: string) {
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
    setState("idle");
  }

  if (state === "review" && intent) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">
          {intent.tipo === "feedback"
            ? "Feedback ditado"
            : intent.tipo === "delegacao"
              ? "Delegação ditada"
              : intent.tipo === "kudos"
                ? "Kudos ditado"
                : "Nota ditada"}
          {intent.membroSugerido && ` · ${intent.membroSugerido}`}
          {intent.prazoISO && ` · prazo ${new Date(intent.prazoISO).toLocaleDateString("pt-BR")}`}
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

  return (
    <Button
      type="button"
      size="sm"
      variant={state === "recording" ? "destructive" : "outline"}
      onClick={state === "recording" ? stop : start}
      disabled={state === "processing"}
      className="gap-2"
    >
      {state === "processing" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo…
        </>
      ) : state === "recording" ? (
        <>
          <Square className="h-4 w-4" /> Parar gravação
        </>
      ) : (
        <>
          <Mic className="h-4 w-4" /> {label}
        </>
      )}
    </Button>
  );
}