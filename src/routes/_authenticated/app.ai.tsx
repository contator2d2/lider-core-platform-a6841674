import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { FadeIn, StaggerItem, StaggerList } from "@/components/motion";
import { SectionHeader } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const SUGGESTIONS = [
  "Analise minha semana e diga onde estou perdendo tempo.",
  "Prepare o roteiro do meu próximo 1:1 com a equipe.",
  "O que meus sinais atuais dizem sobre o meu estilo de liderar?",
  "Como recuperar a cadência dos rituais que caíram?",
];

type ChatMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/_authenticated/app/ai")({
  component: AICoachPage,
});

function AICoachPage() {
  const { orgId } = useCurrentOrg();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const insightMut = useMutation({
    mutationFn: () => api<{ insight: string }>(`/organization/${orgId}/ai/coach/insight`, { method: "POST" }),
    onSuccess: (d) => setInsight(d.insight),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar insight"),
  });

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !orgId) return;
    setInput("");
    const next: ChatMsg[] = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/organization/${orgId}/ai/coach/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: next
            .filter((m, i) => !(i === next.length - 1 && m.role === "assistant" && !m.content))
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Falha (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());
          if (event === "delta") {
            acc += (data as { text: string }).text;
            setMessages((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          } else if (event === "error") {
            throw new Error((data as { message: string }).message);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no streaming";
      toast.error(msg);
      setMessages((prev) => {
        const copy = prev.slice();
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) {
          copy[copy.length - 1] = { role: "assistant", content: `_${msg}_` };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FadeIn>
        <SectionHeader
          eyebrow="IA Coach"
          title="Seu coach executivo, apoiado por dados reais."
          description="Analisa os fatos que a plataforma já registra — rituais, delegações, score, sinais — e devolve ações concretas."
        />
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        {/* Insight lateral */}
        <FadeIn delay={0.05}>
          <aside className="card-elevated relative flex h-full min-h-[500px] flex-col overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative flex items-center justify-between">
              <div className="eyebrow flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" /> Insight da semana
              </div>
              <button
                onClick={() => insightMut.mutate()}
                disabled={insightMut.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium hover:bg-secondary/60 disabled:opacity-50"
              >
                {insightMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {insight ? "Atualizar" : "Gerar"}
              </button>
            </div>
            <div className="relative mt-4 flex-1 overflow-y-auto">
              {!insight && !insightMut.isPending && (
                <div className="flex h-full flex-col items-start justify-center gap-3">
                  <Wand2 className="h-8 w-8 text-accent" />
                  <p className="text-sm text-muted-foreground">
                    Clique em <span className="font-medium text-foreground">Gerar</span> para receber uma leitura curta
                    da sua semana — o que está funcionando, onde há atrito, próximo movimento.
                  </p>
                </div>
              )}
              {insightMut.isPending && (
                <div className="space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                </div>
              )}
              {insight && (
                <article className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90 prose-headings:font-display prose-headings:font-semibold prose-strong:text-foreground">
                  <ReactMarkdown>{insight}</ReactMarkdown>
                </article>
              )}
            </div>
          </aside>
        </FadeIn>

        {/* Chat */}
        <FadeIn delay={0.1}>
          <section className="card-elevated flex h-full min-h-[500px] flex-col overflow-hidden">
            <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-start justify-end gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-accent" /> Sugestões de conversa
                  </div>
                  <StaggerList className="grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <StaggerItem key={s}>
                        <button
                          onClick={() => send(s)}
                          className="w-full rounded-xl border border-border bg-background/70 p-3 text-left text-sm transition-all hover:border-accent/40 hover:bg-background hover:shadow-[var(--shadow-accent)]"
                        >
                          {s}
                        </button>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </div>
              ) : (
                messages.map((m, i) => <MessageBubble key={i} msg={m} streaming={streaming && i === messages.length - 1} />)
              )}
            </div>

            <div className="border-t border-border p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-accent/50 focus-within:shadow-[var(--shadow-accent)]"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Faça uma pergunta ao seu coach…"
                  rows={1}
                  className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
                  disabled={streaming}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={streaming || !input.trim()}
                  className="h-9 w-9 rounded-lg p-0"
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </section>
        </FadeIn>
      </div>
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: ChatMsg; streaming: boolean }) {
  const isUser = msg.role === "user";
  return (
    <FadeIn y={4}>
      <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
        <div
          className={
            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed " +
            (isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/70 text-foreground")
          }
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <article className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-headings:font-display prose-headings:font-semibold prose-strong:text-foreground">
              <ReactMarkdown>{msg.content || (streaming ? "…" : "")}</ReactMarkdown>
              {streaming && msg.content && <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-accent" />}
            </article>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
