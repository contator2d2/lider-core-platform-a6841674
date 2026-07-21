import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Radar,
  Users2,
  Wifi,
  WifiOff,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/coach")({
  component: CoachPage,
  head: () => ({
    meta: [
      { title: "Coach preditivo — LíderCore" },
      { name: "description", content: "Riscos antecipados, lembretes prontos e integrações (Calendar, WhatsApp, offline)." },
    ],
  }),
});

type Predictions = {
  generatedAt: string;
  horizonWeeks: number;
  signals: {
    hard: { current: number; previous: number; trend: number };
    soft: { rate: number; overdue: number };
    heart: { feedbackLast2w: number; feedbackPrev2w: number; openPulses: number; closedPulses: number };
  };
  risks: Array<{
    dimension: "hard" | "soft" | "heart";
    level: "low" | "medium" | "high";
    title: string;
    reason: string;
    action: string;
  }>;
};

type Reminders = {
  generatedAt: string;
  items: Array<{
    id: string;
    kind: "delegation" | "pulse" | "one_on_one";
    title: string;
    subtitle: string;
    dueAt: string | null;
    recipient: string | null;
    whatsappUrl: string | null;
    slackText: string;
  }>;
};

type Feed = { token: string; url: string; webcal: string };

type AIRecs = { generatedAt: string; markdown: string; context: Record<string, number> };

function simpleMarkdown(md: string) {
  const html = md
    .replace(/</g, "&lt;")
    .replace(/^##\s+(.+)$/gm, '<h3 class="mt-4 mb-2 font-display text-lg text-foreground">$1</h3>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-5 list-decimal">$1</li>')
    .replace(/^-\s+(.+)$/gm, '<li class="ml-5 list-disc">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-secondary px-1 py-0.5 text-xs">$1</code>')
    .replace(/\n{2,}/g, '</p><p class="mt-2">')
    .replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

const DIM_META = {
  hard: { label: "Hard · Estrutura", icon: Building2, tone: "text-sky-600", dot: "bg-sky-500" },
  soft: { label: "Soft · Execução", icon: Users2, tone: "text-emerald-600", dot: "bg-emerald-500" },
  heart: { label: "Heart · Cultura", icon: Heart, tone: "text-rose-600", dot: "bg-rose-500" },
} as const;

const LEVEL_TONE: Record<"low" | "medium" | "high", string> = {
  low: "border-muted text-muted-foreground",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  high: "border-rose-300 bg-rose-50 text-rose-700",
};

function CoachPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => setIsOnline(true), { once: true });
    window.addEventListener("offline", () => setIsOnline(false), { once: true });
  }

  const predictions = useQuery({
    queryKey: ["coach-predictions", orgId],
    enabled: !!orgId,
    queryFn: () => api<Predictions>(`/organization/${orgId}/coach/predictions`),
    staleTime: 60_000,
  });
  const reminders = useQuery({
    queryKey: ["coach-reminders", orgId],
    enabled: !!orgId,
    queryFn: () => api<Reminders>(`/organization/${orgId}/coach/reminders`),
    staleTime: 60_000,
  });
  const feed = useQuery({
    queryKey: ["coach-feed", orgId],
    enabled: !!orgId,
    queryFn: () => api<Feed>(`/organization/${orgId}/calendar/feed`),
    staleTime: 5 * 60_000,
  });
  const rotate = useMutation({
    mutationFn: () => api(`/organization/${orgId}/calendar/feed/rotate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Novo link gerado. O antigo parou de funcionar.");
      qc.invalidateQueries({ queryKey: ["coach-feed", orgId] });
    },
  });
  const aiRecs = useMutation({
    mutationFn: () => api<AIRecs>(`/organization/${orgId}/coach/ai-recommendations`, { method: "POST" }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) return null;

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fase 4 · Inteligência</div>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl">
            <Radar className="h-6 w-6 text-accent" /> Coach preditivo
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Antecipa risco H/S/H nas próximas 2 semanas, entrega lembretes prontos pra WhatsApp e conecta o app ao seu calendário e ao modo offline.
          </p>
        </div>
        <div className={"flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] " + (isOnline ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600")}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {isOnline ? "Online" : "Offline"}
        </div>
      </header>

      {/* Predictions */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <AlertTriangle className="h-4 w-4 text-accent" /> Riscos previstos (2 semanas)
        </h2>
        {predictions.isLoading ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : predictions.data && predictions.data.risks.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-700">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6" />
            Sem sinais de risco relevante. Siga o ritmo.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {predictions.data?.risks.map((r, i) => {
              const m = DIM_META[r.dimension];
              const Icon = m.icon;
              return (
                <div key={i} className={"rounded-2xl border-2 p-4 " + LEVEL_TONE[r.level]}>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                    <span className={"inline-block h-2 w-2 rounded-full " + m.dot} />
                    <Icon className="h-3.5 w-3.5" /> {m.label} · {r.level === "high" ? "alto" : r.level === "medium" ? "médio" : "leve"}
                  </div>
                  <div className="mt-2 font-display text-lg">{r.title}</div>
                  <p className="mt-1 text-xs opacity-80">{r.reason}</p>
                  <div className="mt-2 rounded-lg bg-white/60 p-2 text-xs">
                    <span className="font-semibold">Ação: </span>{r.action}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reminders */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <MessageCircle className="h-4 w-4 text-accent" /> Lembretes prontos
          </h2>
          <span className="text-xs text-muted-foreground">Clique no botão pra abrir no WhatsApp com a mensagem escrita.</span>
        </div>
        {reminders.isLoading ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !reminders.data || reminders.data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nada pendente nos próximos 3 dias.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {reminders.data.items.map((it) => (
              <li key={it.kind + it.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {it.recipient ? it.recipient + " · " : ""}{it.subtitle}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(it.slackText); toast.success("Mensagem copiada"); }}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                </Button>
                {it.whatsappUrl ? (
                  <a href={it.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">sem telefone</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Calendar feed */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Calendar className="h-4 w-4 text-accent" /> Google Calendar / iCal
        </h2>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Copie esta URL e adicione no Google Calendar em <em>Outros calendários → A partir de URL</em>. Rituais, 1:1s e delegações com prazo aparecem na sua agenda.
          </p>
          {feed.data ? (
            <>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary p-2 font-mono text-xs">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{feed.data.url}</span>
                <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(feed.data!.url); toast.success("URL copiada"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={feed.data.webcal} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                  Abrir no Calendar do sistema
                </a>
                <Button size="sm" variant="ghost" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
                  <RefreshCw className={"mr-1 h-3.5 w-3.5 " + (rotate.isPending ? "animate-spin" : "")} /> Gerar novo link
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-3 text-xs text-muted-foreground">Carregando link…</div>
          )}
        </div>
      </section>

      {/* Data sync + offline */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Item 17</div>
          <h3 className="mt-1 font-display text-lg">Sync de indicadores via CSV / Google Sheets</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Em cada indicador, cole a URL de um Google Sheets publicado como CSV (colunas <code>periodo</code> e <code>valor</code>). Uma chamada <code>POST /indicators/:id/sync</code> importa as leituras.
          </p>
          <a href="/app/indicators" className="mt-3 inline-flex text-xs text-accent hover:underline">Configurar nos indicadores →</a>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Item 20</div>
          <h3 className="mt-1 font-display text-lg">Modo offline (PWA)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Service Worker registrado. Assets estáticos ficam em cache e a tela inicial abre mesmo sem rede. Escritas seguem exigindo conexão.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            {isOnline ? <><Wifi className="h-3.5 w-3.5 text-emerald-600" /> Você está online agora</> : <><WifiOff className="h-3.5 w-3.5 text-amber-600" /> Você está offline</>}
          </div>
        </div>
      </section>
    </div>
  );
}