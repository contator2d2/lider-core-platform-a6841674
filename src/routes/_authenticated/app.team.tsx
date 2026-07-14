import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Users } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/team")({
  component: TeamPage,
});

type Autonomy = "n1_direciono" | "n2_acompanho" | "n3_valido" | "n4_delego" | "n5_autonomo";

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  n1_direciono: "N1 — Direciono",
  n2_acompanho: "N2 — Acompanho",
  n3_valido: "N3 — Valido",
  n4_delego: "N4 — Delego",
  n5_autonomo: "N5 — Autônomo",
};

type TeamMember = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  areaName: string | null;
  teamName: string | null;
  profile: {
    roleTitle: string | null;
    expectedDeliverables: string[];
    keyIndicators: string[];
    autonomyLevel: Autonomy;
    strengths: string[];
    developPoints: string[];
    notes: string | null;
  } | null;
  openDelegations: number;
  feedbackCount: number;
  hasActivePdi: boolean;
};

function TeamPage() {
  const { orgId } = useCurrentOrg();
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team", orgId],
    enabled: !!orgId,
    queryFn: () => api<TeamMember[]>(`/organization/${orgId}/team`),
  });

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Tela 3 — Mapa da equipe
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight">Minha equipe</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Uma linha por pessoa: papel, entregas centrais, indicadores, autonomia, feedbacks e PDI ativo.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && members.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">Nenhum membro na organização ainda</div>
        </div>
      )}

      <div className="grid gap-3">
        {members.map((m) => (
          <article
            key={m.membershipId}
            className="rounded-xl border border-border bg-background p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-base font-medium">{m.fullName}</h3>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {m.profile?.roleTitle && <span className="text-foreground">{m.profile.roleTitle}</span>}
                  {m.areaName && <span>· {m.areaName}</span>}
                  {m.teamName && <span>· {m.teamName}</span>}
                  <span>· {AUTONOMY_LABEL[m.profile?.autonomyLevel ?? "n2_acompanho"]}</span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Block title="Entregas esperadas" items={m.profile?.expectedDeliverables ?? []} />
                  <Block title="Indicadores centrais" items={m.profile?.keyIndicators ?? []} />
                  <Block title="Forças" items={m.profile?.strengths ?? []} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <Stat label="Delegações abertas" value={m.openDelegations} />
                  <Stat label="Feedbacks" value={m.feedbackCount} />
                  <Stat label="PDI" value={m.hasActivePdi ? "Ativo" : "—"} tone={m.hasActivePdi ? "ok" : "muted"} />
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => setEditing(m)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <ProfileDialog orgId={orgId} member={editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm">
          {items.map((v, i) => (
            <li key={i}>· {v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "muted" }) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 " +
        (tone === "ok"
          ? "border-success/40 text-success"
          : tone === "muted"
          ? "border-border text-muted-foreground"
          : "border-border text-foreground")
      }
    >
      {label}: {value}
    </span>
  );
}

function ProfileDialog({
  orgId,
  member,
  onDone,
}: {
  orgId: string;
  member: TeamMember;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [roleTitle, setRoleTitle] = useState(member.profile?.roleTitle ?? "");
  const [deliverables, setDeliverables] = useState((member.profile?.expectedDeliverables ?? []).join("\n"));
  const [indicators, setIndicators] = useState((member.profile?.keyIndicators ?? []).join("\n"));
  const [autonomy, setAutonomy] = useState<Autonomy>(member.profile?.autonomyLevel ?? "n2_acompanho");
  const [strengths, setStrengths] = useState((member.profile?.strengths ?? []).join(", "));
  const [developPoints, setDevelopPoints] = useState((member.profile?.developPoints ?? []).join(", "));
  const [notes, setNotes] = useState(member.profile?.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api(`/organization/${orgId}/team/${member.membershipId}/profile`, {
        method: "PUT",
        body: {
          roleTitle: roleTitle || null,
          expectedDeliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          keyIndicators: indicators.split("\n").map((s) => s.trim()).filter(Boolean),
          autonomyLevel: autonomy,
          strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean),
          developPoints: developPoints.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["team", orgId] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Perfil — {member.fullName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Cargo/Papel</Label>
            <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          </div>
          <div>
            <Label>Nível de autonomia</Label>
            <Select value={autonomy} onValueChange={(v) => setAutonomy(v as Autonomy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((a) => (
                  <SelectItem key={a} value={a}>{AUTONOMY_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Entregas esperadas (uma por linha)</Label>
          <Textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className="min-h-[80px]" />
        </div>
        <div>
          <Label>Indicadores centrais (um por linha)</Label>
          <Textarea value={indicators} onChange={(e) => setIndicators(e.target.value)} className="min-h-[80px]" />
        </div>
        <div>
          <Label>Forças (separadas por vírgula)</Label>
          <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        </div>
        <div>
          <Label>Pontos a desenvolver (separados por vírgula)</Label>
          <Input value={developPoints} onChange={(e) => setDevelopPoints(e.target.value)} />
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
