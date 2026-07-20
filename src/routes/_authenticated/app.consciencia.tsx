import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  X,
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

export const Route = createFileRoute("/_authenticated/app/consciencia")({
  component: ConscienciaPage,
});

type Profile = {
  id: string;
  declaredRole: string | null;
  notMine: string | null;
  assessmentType: "disc" | "big_five" | "other" | null;
  assessmentTraits: Record<string, unknown> | null;
  sabotages: string[];
  communicationStyle: string | null;
  mbtiType: string | null;
  discPrimary: "D" | "I" | "S" | "C" | null;
  hardSelfScore: number | null;
  softSelfScore: number | null;
  heartSelfScore: number | null;
  riskFlags: string[];
  strengths: string[];
  notes: string | null;
  assessmentAt: string | null;
  updatedAt: string;
};

type Commitment = {
  id: string;
  phrase: string;
  status: "active" | "in_progress" | "done" | "dropped";
  reviewAt: string | null;
  createdAt: string;
};

type CrossSignal = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  createdAt: string;
};

type MeResponse = {
  profile: Profile | null;
  commitments: Commitment[];
  signals: CrossSignal[];
  assessmentStale: boolean;
};

const RISK_OPTIONS = [
  { value: "controle", label: "Controle excessivo" },
  { value: "evita_conflito", label: "Evita conflito" },
  { value: "cobranca_dura", label: "Cobrança dura" },
  { value: "perfeccionismo", label: "Perfeccionismo" },
  { value: "impaciencia", label: "Impaciência" },
  { value: "acomodacao", label: "Acomodação" },
];

const SABOTAGE_OPTIONS = [
  "Juiz interno",
  "Agradador",
  "Hiper-realizador",
  "Hiper-racional",
  "Vítima",
  "Evasivo",
  "Controlador",
  "Reservado",
  "Inquieto",
];

function ConscienciaPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["consciencia", "me", orgId],
    enabled: !!orgId,
    queryFn: () => api<MeResponse>(`/organization/${orgId}/consciencia/me`),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/signals/${id}/dismiss`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  const delCommitment = useMutation({
    mutationFn: (id: string) =>
      api(`/organization/${orgId}/consciencia/commitments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  const patchCommitment = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Commitment["status"] }) =>
      api(`/organization/${orgId}/consciencia/commitments/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] }),
  });

  if (!orgId) return null;

  const profile = data?.profile ?? null;
  const commitments = data?.commitments ?? [];
  const signals = data?.signals ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Módulo C — Consciência</div>
          <h1 className="mt-2 font-display text-4xl leading-tight">Meu perfil de liderança</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Este espaço é privado. Só você vê o conteúdo detalhado. A organização vê apenas se o perfil existe.
          </p>
        </div>
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Brain className="h-4 w-4" />
              {profile ? "Atualizar perfil" : "Preencher perfil"}
            </Button>
          </DialogTrigger>
          <ProfileDialog
            orgId={orgId!}
            initial={profile}
            onDone={() => {
              setProfileOpen(false);
              qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
            }}
          />
        </Dialog>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && !profile && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Brain className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Ainda não há perfil registrado</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sem consciência não há sustentação. Registre papel, assessment e riscos de comportamento para o motor cruzar com os fatos operacionais.
          </p>
          <Button className="mt-4" onClick={() => setProfileOpen(true)}>Começar agora</Button>
        </div>
      )}

      {profile && (
        <HSHPanel profile={profile} />
      )}

      {profile && (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="Força principal"
            value={profile.strengths[0] ?? "—"}
            icon={Sparkles}
            hint={profile.strengths.slice(1).join(" · ")}
          />
          <SummaryCard
            title="Risco declarado"
            value={profile.riskFlags[0] ? labelRisk(profile.riskFlags[0]) : "—"}
            icon={ShieldAlert}
            hint={profile.riskFlags.slice(1).map(labelRisk).join(" · ")}
          />
          <SummaryCard
            title="Assessment"
            value={profile.assessmentType ? labelAssessment(profile.assessmentType) : "Não feito"}
            icon={Target}
            hint={
              profile.assessmentAt
                ? `Atualizado em ${new Date(profile.assessmentAt).toLocaleDateString("pt-BR")}`
                : "Sem data"
            }
            warn={data?.assessmentStale}
          />
        </div>
      )}

      {/* Alertas cruzados */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Alertas cruzados</h2>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{signals.length}</span>
        </div>
        {signals.length === 0 && (
          <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nenhum alerta ativo. O motor cruza seu perfil com rituais, delegações e indicadores em tempo real.
          </div>
        )}
        <ul className="space-y-3">
          {signals.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={
                      "mt-0.5 rounded-full p-1.5 " +
                      (s.severity === "high"
                        ? "bg-destructive/15 text-destructive"
                        : s.severity === "medium"
                        ? "bg-accent/20 text-accent"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismiss.mutate(s.id)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Descartar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Compromissos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Compromissos de mentoria</h2>
          <Dialog open={commitmentOpen} onOpenChange={setCommitmentOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" /> Novo compromisso
              </Button>
            </DialogTrigger>
            <CommitmentDialog
              orgId={orgId!}
              onDone={() => {
                setCommitmentOpen(false);
                qc.invalidateQueries({ queryKey: ["consciencia", "me", orgId] });
              }}
            />
          </Dialog>
        </div>
        {commitments.length === 0 && (
          <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nenhum compromisso ativo. Registre uma frase-âncora vinda da sua última mentoria.
          </div>
        )}
        <ul className="space-y-2">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
              <div className="flex-1">
                <div className={"text-sm " + (c.status === "done" ? "text-muted-foreground line-through" : "font-medium")}>
                  {c.phrase}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {labelCommitmentStatus(c.status)}
                  {c.reviewAt && ` · rever em ${new Date(c.reviewAt).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {c.status !== "done" && (
                  <button
                    onClick={() => patchCommitment.mutate({ id: c.id, status: "done" })}
                    className="rounded-full p-2 text-success hover:bg-success/10"
                    aria-label="Marcar cumprido"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => delCommitment.mutate(c.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({
  title, value, icon: Icon, hint, warn,
}: { title: string; value: string; icon: typeof Sparkles; hint?: string; warn?: boolean }) {
  return (
    <div className={"rounded-2xl border p-5 " + (warn ? "border-accent/40 bg-accent/5" : "border-border bg-background")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="mt-2 text-lg font-medium">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ---------- Dialogs ----------
function ProfileDialog({
  orgId, initial, onDone,
}: { orgId: string; initial: Profile | null; onDone: () => void }) {
  const [declaredRole, setDeclaredRole] = useState(initial?.declaredRole ?? "");
  const [assessmentType, setAssessmentType] = useState<Profile["assessmentType"]>(initial?.assessmentType ?? null);
  const [strengths, setStrengths] = useState((initial?.strengths ?? []).join(", "));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [communicationStyle, setCommunicationStyle] = useState(initial?.communicationStyle ?? "");
  const [riskFlags, setRiskFlags] = useState<string[]>(initial?.riskFlags ?? []);
  const [sabotages, setSabotages] = useState<string[]>(initial?.sabotages ?? []);

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/me`, {
        method: "PUT",
        body: {
          declaredRole: declaredRole || null,
          assessmentType,
          strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
          communicationStyle: communicationStyle || null,
          riskFlags,
          sabotages,
          markAssessedNow: true,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Meu perfil de liderança</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <div>
          <Label>Papel declarado</Label>
          <Input value={declaredRole} onChange={(e) => setDeclaredRole(e.target.value)} placeholder="Ex.: líder integrador, formador de gente" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Assessment</Label>
            <Select value={assessmentType ?? ""} onValueChange={(v) => setAssessmentType((v || null) as Profile["assessmentType"])}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disc">DISC</SelectItem>
                <SelectItem value="big_five">Big Five</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estilo de comunicação (egograma)</Label>
            <Input value={communicationStyle} onChange={(e) => setCommunicationStyle(e.target.value)} placeholder="Ex.: pai crítico dominante" />
          </div>
        </div>

        <div>
          <Label>Forças (separadas por vírgula)</Label>
          <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Visão, escuta ativa, execução" />
        </div>

        <div>
          <Label className="mb-2 block">Riscos comportamentais</Label>
          <div className="flex flex-wrap gap-2">
            {RISK_OPTIONS.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => toggle(riskFlags, r.value, setRiskFlags)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (riskFlags.includes(r.value)
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border hover:bg-secondary")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Alimentam o motor de alertas cruzados.</p>
        </div>

        <div>
          <Label className="mb-2 block">Sabotadores ativos</Label>
          <div className="flex flex-wrap gap-2">
            {SABOTAGE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggle(sabotages, s, setSabotages)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (sabotages.includes(s)
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border hover:bg-secondary")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Notas pessoais</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Somente você lê." className="min-h-[90px]" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CommitmentDialog({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/consciencia/commitments`, {
        method: "POST",
        body: {
          phrase,
          reviewAt: reviewDate ? new Date(reviewDate).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Compromisso registrado");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <Label>Frase-âncora</Label>
          <Textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Ex.: nesta semana, delego pelo menos 2 entregas do meu backlog." />
        </div>
        <div>
          <Label>Data de revisão</Label>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!phrase.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Registrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- labels ----------
function labelRisk(v: string) {
  return RISK_OPTIONS.find((r) => r.value === v)?.label ?? v;
}
function labelAssessment(v: string) {
  return v === "disc" ? "DISC" : v === "big_five" ? "Big Five" : "Outro";
}
function labelCommitmentStatus(s: Commitment["status"]) {
  return s === "active" ? "Ativo" : s === "in_progress" ? "Em execução" : s === "done" ? "Cumprido" : "Descartado";
}