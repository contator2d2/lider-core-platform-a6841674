import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Users, Lock, CheckCircle2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useAuth } from "@/lib/auth-context";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/360")({
  component: ThreeSixtyPage,
});

type RoundListItem = {
  id: string;
  subjectUserId: string;
  createdById: string;
  title: string;
  quarter: string;
  status: "open" | "closed";
  createdAt: string;
  responses: { id: string; evaluatorId: string }[];
};

type RoundDetail = {
  id: string;
  subjectUserId: string;
  createdById: string;
  title: string;
  quarter: string;
  status: "open" | "closed";
  summaryMarkdown: string | null;
  closedAt: string | null;
  createdAt: string;
  questions: string[];
  myResponse: null | {
    score1: number;
    score2: number;
    score3: number;
    comment1: string | null;
    comment2: string | null;
    comment3: string | null;
  };
  responseCount: number;
  responses?: Array<{
    id: string;
    score1: number;
    score2: number;
    score3: number;
    comment1: string | null;
    comment2: string | null;
    comment3: string | null;
    createdAt: string;
  }>;
};

type TeamOption = { membershipId: string; userId: string; fullName: string };

function ThreeSixtyPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: rounds = [], isLoading } = useQuery<RoundListItem[]>({
    queryKey: ["360", orgId],
    enabled: !!orgId,
    queryFn: () => api<RoundListItem[]>(`/organization/${orgId}/three-sixty`),
  });

  const { data: pending = [] } = useQuery<RoundListItem[]>({
    queryKey: ["360-pending", orgId],
    enabled: !!orgId,
    queryFn: () => api<RoundListItem[]>(`/organization/${orgId}/three-sixty/pending`),
  });

  const { data: team = [] } = useQuery<TeamOption[]>({
    queryKey: ["team-basic", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            360 leve · trimestral
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Feedback 360</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            3 perguntas, notas de 1 a 5 e um consolidado anônimo com IA.
            Continuar · Começar · Parar — o suficiente para gerar direção sem esgotar o time.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova rodada
            </Button>
          </DialogTrigger>
          <NewRoundDialog
            orgId={orgId}
            team={team}
            onDone={() => {
              setOpenNew(false);
              qc.invalidateQueries({ queryKey: ["360", orgId] });
            }}
          />
        </Dialog>
      </header>

      {pending.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 text-[10px] uppercase tracking-widest text-primary">
            Convites aguardando sua resposta ({pending.length})
          </div>
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.quarter}</div>
                </div>
                <Button size="sm" onClick={() => setSelected(r.id)}>
                  Responder
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && rounds.length === 0 && pending.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhuma rodada 360 ainda</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Abra uma rodada trimestral sobre um liderado e convide 3-5 pessoas próximas.
          </p>
        </div>
      )}

      {rounds.length > 0 && (
        <ul className="space-y-3">
          {rounds.map((r) => {
            const isMine = r.createdById === user?.id;
            const isAboutMe = r.subjectUserId === user?.id;
            const subject = team.find((t) => t.userId === r.subjectUserId);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-5"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {r.quarter} · {r.responses.length} respostas
                    {isAboutMe && " · sobre você"}
                    {isMine && !isAboutMe && " · criada por você"}
                  </div>
                  <div className="mt-1 font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {subject ? `Sobre ${subject.fullName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest " +
                      (r.status === "closed"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-primary/10 text-primary")
                    }
                  >
                    {r.status === "closed" ? "Fechada" : "Aberta"}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setSelected(r.id)}>
                    Abrir
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <RoundDialog
          orgId={orgId}
          roundId={selected}
          onClose={() => setSelected(null)}
          team={team}
        />
      )}
    </div>
  );
}

function NewRoundDialog({
  orgId,
  team,
  onDone,
}: {
  orgId: string;
  team: TeamOption[];
  onDone: () => void;
}) {
  const [subjectUserId, setSubjectUserId] = useState("");
  const [title, setTitle] = useState("");
  const [evaluatorIds, setEvaluatorIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/three-sixty`, {
        method: "POST",
        body: { subjectUserId, title, evaluatorIds },
      }),
    onSuccess: () => {
      toast.success("Rodada criada e convites enviados");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const toggle = (id: string) =>
    setEvaluatorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova rodada 360</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Sobre quem</Label>
          <Select value={subjectUserId} onValueChange={setSubjectUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
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
        <div>
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: 360 Q1 · time de vendas"
          />
        </div>
        <div>
          <Label>Convidar avaliadores</Label>
          <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded-lg border border-border p-2">
            {team
              .filter((t) => t.userId !== subjectUserId)
              .map((t) => (
                <label key={t.userId} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-secondary/50">
                  <input
                    type="checkbox"
                    checked={evaluatorIds.includes(t.userId)}
                    onChange={() => toggle(t.userId)}
                  />
                  <span className="text-sm">{t.fullName}</span>
                </label>
              ))}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5" />
          Respostas são anônimas. O avaliado nunca vê quem respondeu o quê.
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={create.isPending || !subjectUserId || !title}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Criar rodada
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RoundDialog({
  orgId,
  roundId,
  onClose,
  team,
}: {
  orgId: string;
  roundId: string;
  onClose: () => void;
  team: TeamOption[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: round, isLoading } = useQuery<RoundDetail>({
    queryKey: ["360-round", roundId],
    queryFn: () => api<RoundDetail>(`/organization/${orgId}/three-sixty/${roundId}`),
  });

  const subject = useMemo(
    () => team.find((t) => round && t.userId === round.subjectUserId),
    [round, team],
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{round?.title ?? "Rodada 360"}</DialogTitle>
        </DialogHeader>
        {isLoading || !round ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <RoundBody
            round={round}
            orgId={orgId}
            userId={user?.id ?? ""}
            subjectName={subject?.fullName ?? "liderado"}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ["360-round", roundId] });
              qc.invalidateQueries({ queryKey: ["360", orgId] });
              qc.invalidateQueries({ queryKey: ["360-pending", orgId] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoundBody({
  round,
  orgId,
  userId,
  subjectName,
  onChanged,
}: {
  round: RoundDetail;
  orgId: string;
  userId: string;
  subjectName: string;
  onChanged: () => void;
}) {
  const isSubject = round.subjectUserId === userId;
  const isCreator = round.createdById === userId;
  const canRespond = round.status === "open" && !isSubject;

  const [scores, setScores] = useState({
    score1: round.myResponse?.score1 ?? 3,
    score2: round.myResponse?.score2 ?? 3,
    score3: round.myResponse?.score3 ?? 3,
  });
  const [comments, setComments] = useState({
    comment1: round.myResponse?.comment1 ?? "",
    comment2: round.myResponse?.comment2 ?? "",
    comment3: round.myResponse?.comment3 ?? "",
  });

  const send = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/three-sixty/${round.id}/responses`, {
        method: "POST",
        body: { ...scores, ...comments },
      }),
    onSuccess: () => {
      toast.success("Resposta registrada");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const close = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/three-sixty/${round.id}/close`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success("Rodada fechada — consolidação gerada");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
        Sobre <span className="font-medium">{subjectName}</span> · {round.quarter} · {round.responseCount} respostas
        {round.status === "closed" && " · fechada"}
      </div>

      {canRespond && (
        <div className="space-y-5">
          {round.questions.map((q, i) => {
            const scoreKey = `score${i + 1}` as "score1" | "score2" | "score3";
            const commentKey = `comment${i + 1}` as "comment1" | "comment2" | "comment3";
            return (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="text-sm font-medium">{q}</div>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setScores({ ...scores, [scoreKey]: n })}
                      className={
                        "h-9 w-9 rounded-md border text-sm transition " +
                        (scores[scoreKey] === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-secondary")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={comments[commentKey]}
                  onChange={(e) => setComments({ ...comments, [commentKey]: e.target.value })}
                  placeholder="Comentário (opcional, anônimo)"
                  className="mt-3 min-h-[60px] text-sm"
                />
              </div>
            );
          })}
          <Button onClick={() => send.mutate()} disabled={send.isPending} className="gap-2">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {round.myResponse ? "Atualizar resposta" : "Enviar resposta"}
          </Button>
        </div>
      )}

      {round.summaryMarkdown && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Consolidação anônima
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{round.summaryMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}

      {(isSubject || isCreator) && round.responses && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Respostas anônimas ({round.responses.length})
          </div>
          <div className="space-y-2">
            {round.responses.map((r, idx) => (
              <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Avaliador {idx + 1}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Continuar:</span> {r.score1}/5</div>
                  <div><span className="text-muted-foreground">Começar:</span> {r.score2}/5</div>
                  <div><span className="text-muted-foreground">Parar:</span> {r.score3}/5</div>
                </div>
                {(r.comment1 || r.comment2 || r.comment3) && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {r.comment1 && <p>· {r.comment1}</p>}
                    {r.comment2 && <p>· {r.comment2}</p>}
                    {r.comment3 && <p>· {r.comment3}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isCreator && round.status === "open" && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => close.mutate()}
            disabled={close.isPending}
            className="gap-2"
          >
            {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Fechar rodada e gerar consolidação
          </Button>
        </div>
      )}
    </div>
  );
}