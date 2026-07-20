import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type KudosCategory =
  | "resultado"
  | "atitude"
  | "colaboracao"
  | "aprendizado"
  | "inovacao"
  | "outro";

type Kudos = {
  id: string;
  category: KudosCategory;
  message: string;
  tags: string[];
  createdAt: string;
  author: { id: string | null; fullName: string | null; avatarUrl: string | null };
  subject: { id: string | null; fullName: string | null; avatarUrl: string | null };
};

type TeamOption = { membershipId: string; userId: string; fullName: string; avatarUrl?: string | null };

const CATEGORY_META: Record<KudosCategory, { label: string; emoji: string; className: string }> = {
  resultado:    { label: "Resultado",    emoji: "🎯", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  atitude:      { label: "Atitude",      emoji: "🔥", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  colaboracao:  { label: "Colaboração",  emoji: "🤝", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  aprendizado:  { label: "Aprendizado",  emoji: "📚", className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  inovacao:     { label: "Inovação",     emoji: "💡", className: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" },
  outro:        { label: "Reconhecimento", emoji: "✨", className: "bg-secondary text-foreground" },
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function KudosWall({
  orgId,
  subjectUserId,
  compact = false,
  presetMessage,
  presetCategory,
  onCreated,
}: {
  orgId: string;
  subjectUserId?: string;
  compact?: boolean;
  presetMessage?: string;
  presetCategory?: KudosCategory;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const queryKey = ["kudos", orgId, subjectUserId ?? "all"];

  const kudosQ = useQuery({
    queryKey,
    enabled: !!orgId,
    queryFn: () =>
      api<Kudos[]>(
        `/organization/${orgId}/kudos${subjectUserId ? `?subjectUserId=${subjectUserId}` : ""}`,
      ),
  });

  const teamQ = useQuery<TeamOption[]>({
    queryKey: ["team", orgId, "kudos-options"],
    enabled: !!orgId && !subjectUserId,
    queryFn: () => api<TeamOption[]>(`/organization/${orgId}/team`),
  });

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(subjectUserId ?? "");
  const [category, setCategory] = useState<KudosCategory>(presetCategory ?? "atitude");
  const [message, setMessage] = useState(presetMessage ?? "");

  const create = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { category, message };
      const chosen = subjectUserId ?? target;
      if (chosen) body.subjectUserId = chosen;
      return api(`/organization/${orgId}/kudos`, { method: "POST", body });
    },
    onSuccess: () => {
      toast.success("Kudos enviado 🎉");
      setMessage("");
      setOpen(false);
      qc.invalidateQueries({ queryKey });
      onCreated?.();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao enviar"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/kudos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const list = kudosQ.data ?? [];
  const memberOptions = useMemo(() => teamQ.data ?? [], [teamQ.data]);

  const canSubmit = message.trim().length >= 3 && (!!subjectUserId || !!target);

  return (
    <section className="rounded-2xl border border-border/60 bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Award className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Mural de kudos</h3>
            <p className="text-[11px] text-muted-foreground">Reconheça atitudes que merecem eco.</p>
          </div>
        </div>
        <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen((v) => !v)} className="gap-1">
          <Sparkles className="h-3.5 w-3.5" /> {open ? "Fechar" : "Novo"}
        </Button>
      </header>

      {open && (
        <div className="space-y-3 border-b border-border/60 bg-muted/30 p-4">
          {!subjectUserId && (
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Para quem?" />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_META) as KudosCategory[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                className={
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
                  (category === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground")
                }
              >
                {CATEGORY_META[k].emoji} {CATEGORY_META[k].label}
              </button>
            ))}
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva um reconhecimento específico (fato + impacto)…"
            className="min-h-[80px] text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending} className="gap-1">
              <Send className="h-3.5 w-3.5" /> Publicar
            </Button>
          </div>
        </div>
      )}

      <ul className={"divide-y divide-border/60 " + (compact ? "max-h-72 overflow-y-auto" : "")}>
        {kudosQ.isLoading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Carregando…</li>
        ) : list.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            Ainda sem kudos. Comece reconhecendo alguém que fez a diferença esta semana.
          </li>
        ) : (
          list.map((k) => {
            const meta = CATEGORY_META[k.category] ?? CATEGORY_META.outro;
            return (
              <li key={k.id} className="flex gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                  {initials(k.author.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{k.author.fullName ?? "Alguém"}</span>
                    <span>→</span>
                    <span className="font-medium text-foreground">{k.subject.fullName ?? "equipe"}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + meta.className}>
                      {meta.emoji} {meta.label}
                    </span>
                    <span>· {fmtDate(k.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => del.mutate(k.id)}
                      className="ml-auto text-muted-foreground/70 hover:text-rose-600"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{k.message}</p>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}