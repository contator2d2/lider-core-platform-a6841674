import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MessageSquareHeart,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
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

export const Route = createFileRoute("/_authenticated/app/pulses")({
  component: PulsesPage,
});

type Kind = "feedback" | "climate" | "disc" | "custom";
type Status = "pending" | "answered" | "expired" | "revoked";

type Template = {
  id: string;
  kind: Kind;
  title: string;
  intro: string | null;
  isSystem: boolean;
  questions: unknown[];
};

type PulseSend = {
  id: string;
  token: string;
  subjectUserId: string | null;
  subjectLabel: string | null;
  subjectPhone: string | null;
  message: string | null;
  status: Status;
  expiresAt: string;
  answeredAt: string | null;
  createdAt: string;
  template: Template;
  answer: {
    id: string;
    answers: Record<string, unknown>;
    aiSummary: string | null;
    discProfile: { pct: Record<string, number>; primary: string } | null;
  } | null;
};

type TeamOption = { membershipId: string; userId: string; fullName: string; whatsapp?: string };

const KIND_LABEL: Record<Kind, string> = {
  feedback: "Feedback solicitado",
  climate: "Pulse de clima",
  disc: "DISC leve",
  custom: "Pesquisa custom",
};

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  answered: "bg-primary/10 text-primary",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Aguardando",
  answered: "Respondido",
  expired: "Expirado",
  revoked: "Cancelado",
};

function PulsesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<PulseSend | null>(null);

  const { data: sends = [], isLoading } = useQuery<PulseSend[]>({
    queryKey: ["pulses", orgId],
    enabled: !!orgId,
    queryFn: () => api<PulseSend[]>(`/organization/${orgId}/pulses`),
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pulses/${id}/revoke`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Link cancelado");
      qc.invalidateQueries({ queryKey: ["pulses", orgId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/pulses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulses", orgId] }),
  });

  if (!orgId) return null;

  const pending = sends.filter((s) => s.status === "pending").length;
  const answered = sends.filter((s) => s.status === "answered").length;
  const responseRate = sends.length ? Math.round((answered / sends.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Pulsos — respostas do liderado, sem login
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
            Escute com um link.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Envie por WhatsApp um link único e temporário. O liderado responde no celular, você recebe
            a resposta, a IA resume, e vira insumo pra 1:1 e CORE.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Enviar pulso
            </Button>
          </DialogTrigger>
          <NewSendDialog
            orgId={orgId}
            team={team}
            onDone={() => {
              setOpenNew(false);
              qc.invalidateQueries({ queryKey: ["pulses", orgId] });
            }}
          />
        </Dialog>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Aguardando" value={pending} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Respondidas" value={answered} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Taxa de resposta" value={`${responseRate}%`} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard label="Total" value={sends.length} icon={<MessageSquareHeart className="h-4 w-4" />} />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && sends.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-10 text-center">
          <MessageSquareHeart className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum pulso enviado ainda</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Comece pedindo feedback sobre você a 2 liderados. Cada resposta que chega alimenta seu
            radar de liderança.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {sends.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-border bg-background p-4 transition hover:border-primary/40"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest " +
                      STATUS_STYLE[s.status]
                    }
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {KIND_LABEL[s.template.kind]}
                  </span>
                </div>
                <div className="mt-1 truncate font-medium">
                  {s.template.title} · <span className="text-muted-foreground">{s.subjectLabel ?? "—"}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Enviado em {new Date(s.createdAt).toLocaleDateString("pt-BR")} · Expira{" "}
                  {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
                  {s.answer?.aiSummary && (
                    <> · <span className="italic">"{s.answer.aiSummary.slice(0, 80)}"</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {s.status === "pending" && (
                  <>
                    <ShareButtons send={s} />
                    <button
                      onClick={() => revoke.mutate(s.id)}
                      className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Cancelar"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {s.status === "answered" && (
                  <Button size="sm" variant="outline" onClick={() => setDetail(s)}>
                    Ver resposta
                  </Button>
                )}
                <button
                  onClick={() => del.mutate(s.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && <AnswerDialog send={detail} />}
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}

function publicUrl(token: string) {
  if (typeof window === "undefined") return `/p/${token}`;
  return `${window.location.origin}/p/${token}`;
}

function ShareButtons({ send }: { send: PulseSend }) {
  const url = publicUrl(send.token);

  function whatsapp() {
    const digits = (send.subjectPhone ?? "").replace(/\D/g, "");
    const greeting = `Oi${send.subjectLabel ? `, ${send.subjectLabel.split(" ")[0]}` : ""}!`;
    const body = send.message?.trim()
      ? send.message.trim()
      : "Consegue responder essa pesquisa rápida pra mim? Leva pouquinho.";
    const text = encodeURIComponent(`${greeting} ${body}\n\n${url}`);
    const link = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(link, "_blank", "noopener");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <button
        onClick={whatsapp}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] transition hover:bg-[#25D366]/20"
      >
        <Send className="h-3 w-3" /> WhatsApp
      </button>
      <button
        onClick={copy}
        className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Copiar link"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

function NewSendDialog({
  orgId,
  team,
  onDone,
  presetSubjectUserId,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
  presetSubjectUserId?: string;
}) {
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["pulse-templates", orgId],
    queryFn: () => api<Template[]>(`/organization/${orgId}/pulses/templates`),
  });

  const [templateId, setTemplateId] = useState("");
  const [subjectUserId, setSubjectUserId] = useState(presetSubjectUserId ?? "");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [subjectPhone, setSubjectPhone] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);

  const selected = useMemo(() => templates.find((t) => t.id === templateId), [templates, subjectUserId, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: () =>
      api<PulseSend>(`/organization/${orgId}/pulses`, {
        method: "POST",
        body: {
          templateId,
          subjectUserId: subjectUserId || null,
          subjectLabel: subjectLabel || null,
          subjectPhone: subjectPhone || null,
          message: message || null,
          expiresInDays,
        },
      }),
    onSuccess: (s) => {
      toast.success("Pulso criado — envie pelo WhatsApp");
      // auto-open whatsapp with the fresh link
      const digits = (s.subjectPhone ?? "").replace(/\D/g, "");
      const url = publicUrl(s.token);
      const greeting = `Oi${s.subjectLabel ? `, ${s.subjectLabel.split(" ")[0]}` : ""}!`;
      const body = (s.message ?? message)?.trim()
        ? (s.message ?? message).trim()
        : "Consegue responder essa pesquisa rápida?";
      const text = encodeURIComponent(`${greeting} ${body}\n\n${url}`);
      const link = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
      window.open(link, "_blank", "noopener");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar"),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Enviar novo pulso</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Modelo</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um modelo…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                    {KIND_LABEL[t.kind]}
                  </span>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected?.intro && (
            <p className="mt-1 text-xs text-muted-foreground">{selected.intro}</p>
          )}
        </div>

        <div>
          <Label>Liderado</Label>
          <Select
            value={subjectUserId}
            onValueChange={(v) => {
              setSubjectUserId(v);
              const t = team.find((x) => x.userId === v);
              if (t) {
                setSubjectLabel(t.fullName);
                setSubjectPhone(t.whatsapp ?? "");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione ou preencha manual…" />
            </SelectTrigger>
            <SelectContent>
              {team.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome (opcional)</Label>
            <Input
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="Ex: Ana"
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              value={subjectPhone}
              onChange={(e) => setSubjectPhone(e.target.value)}
              placeholder="+55 11 90000-0000"
            />
          </div>
        </div>

        <div>
          <Label>Recado personalizado (opcional)</Label>
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Ana, tô querendo melhorar como líder e sua visão importa. Responde com sinceridade, tá tudo bem."
          />
        </div>

        <div>
          <Label>Link expira em (dias)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value) || 7)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !templateId}
          onClick={() => create.mutate()}
          className="gap-2"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gerar link + Abrir WhatsApp
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AnswerDialog({ send }: { send: PulseSend }) {
  const questions = (send.template.questions as Array<{ id: string; type: string; label: string }>) ?? [];
  const answers = send.answer?.answers ?? {};
  const disc = send.answer?.discProfile;

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{send.template.title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="text-xs text-muted-foreground">
          {send.subjectLabel ?? "Anônimo"} · Respondido em{" "}
          {send.answeredAt ? new Date(send.answeredAt).toLocaleString("pt-BR") : "—"}
        </div>

        {disc && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Perfil DISC — Predominante: <span className="text-foreground">{disc.primary}</span>
            </div>
            <div className="mt-3 space-y-2">
              {(["D", "I", "S", "C"] as const).map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-6 text-xs font-medium">{k}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${disc.pct[k]}%` }} />
                  </div>
                  <div className="w-10 text-right text-xs text-muted-foreground">{disc.pct[k]}%</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {disc.primary === "D" && "Direto, focado em resultado, gosta de assumir riscos."}
              {disc.primary === "I" && "Comunicativo, entusiasta, gosta de convencer e inspirar."}
              {disc.primary === "S" && "Paciente, colaborativo, valoriza estabilidade e harmonia."}
              {disc.primary === "C" && "Analítico, detalhista, valoriza precisão e qualidade."}
            </p>
          </div>
        )}

        {send.answer?.aiSummary && !disc && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            {send.answer.aiSummary}
          </div>
        )}

        <div className="space-y-3">
          {questions.filter((q) => q.type !== "disc_pair").map((q) => {
            const v = answers[q.id];
            return (
              <div key={q.id} className="rounded-lg border border-border bg-background p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {q.label}
                </div>
                <div className="mt-1 text-sm">
                  {typeof v === "number"
                    ? `${v}/5`
                    : Array.isArray(v)
                      ? v.join(", ")
                      : typeof v === "string" && v.trim()
                        ? v
                        : <span className="italic text-muted-foreground">(sem resposta)</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DialogContent>
  );
}
