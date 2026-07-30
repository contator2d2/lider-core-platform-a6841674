import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Link2, MessageCircle, Plus, Trash2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  head: () => ({ meta: [{ title: "Convites de líder — Admin" }] }),
  component: InvitesAdmin,
});

type Invite = {
  id: string;
  token: string;
  email: string | null;
  fullName: string | null;
  planSlug: string | null;
  track: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Plan = { slug: string; name: string };

function InvitesAdmin() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [planSlug, setPlanSlug] = useState("");
  const [track, setTrack] = useState<"mentored" | "basic">("mentored");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => api<{ invites: Invite[] }>("/admin/invites"),
  });
  const { data: plansData } = useQuery({
    queryKey: ["signup-plans"],
    queryFn: () => api<{ plans: Plan[] }>("/auth/signup-plans", { auth: false }),
  });
  const plans = plansData?.plans ?? [];

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkFor = (t: string) => `${origin}/auth?invite=${t}`;

  const create = useMutation({
    mutationFn: () =>
      api<Invite>("/admin/invites", {
        method: "POST",
        body: {
          fullName: fullName || null,
          email: email || null,
          planSlug: planSlug || null,
          track,
          note: note || null,
          maxUses,
          expiresInDays: expiresInDays || null,
        },
      }),
    onSuccess: async (inv) => {
      await qc.invalidateQueries({ queryKey: ["admin-invites"] });
      setFullName("");
      setEmail("");
      setNote("");
      try {
        await navigator.clipboard.writeText(linkFor(inv.token));
        toast.success("Convite criado e link copiado.");
      } catch {
        toast.success("Convite criado.");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao criar convite"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/admin/invites/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Convite revogado.");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Convite excluído.");
    },
  });

  const invites = useMemo(() => data?.invites ?? [], [data]);

  const statusOf = (i: Invite) => {
    if (i.revokedAt) return { label: "Revogado", tone: "text-destructive" };
    if (i.expiresAt && new Date(i.expiresAt) < new Date())
      return { label: "Expirado", tone: "text-muted-foreground" };
    if (i.usedCount >= i.maxUses) return { label: "Utilizado", tone: "text-muted-foreground" };
    return { label: "Ativo", tone: "text-emerald-600" };
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Convites de líder</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Gere um link de cadastro. Convites <strong>mentorado</strong> abrem o onboarding completo
          (o líder já conhece a metodologia e as trilhas Neo). Cadastros pelo site seguem a trilha{" "}
          <strong>básica</strong>, que libera funções conforme o uso.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg">Novo convite</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome do líder (opcional)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email (opcional — pré-preenche o cadastro)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-1.5">
            <Label>Trilha de onboarding</Label>
            <div className="flex gap-2">
              {(["mentored", "basic"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrack(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                    track === t ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  }`}
                >
                  {t === "mentored" ? "Mentorado (completo)" : "Básico (progressivo)"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Plano aplicado</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
            >
              <option value="">Deixar o líder escolher</option>
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Usos permitidos</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expira em (dias)</Label>
            <Input
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Mensagem no convite (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <Button className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Gerar convite
        </Button>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-display text-lg">Convites emitidos</h2>
        </div>
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Carregando…</p>
        ) : invites.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum convite ainda.</p>
        ) : (
          <ul className="divide-y">
            {invites.map((i) => {
              const st = statusOf(i);
              const link = linkFor(i.token);
              const waText = encodeURIComponent(
                `Olá${i.fullName ? ` ${i.fullName}` : ""}! Seu acesso ao LÍDER C.O.R.E. está pronto. Crie sua conta aqui: ${link}`,
              );
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-medium">
                      {i.fullName || i.email || "Convite aberto"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.track === "mentored" ? "Mentorado · onboarding completo" : "Básico"} ·{" "}
                      {i.planSlug ?? "plano livre"} · {i.usedCount}/{i.maxUses} usos ·{" "}
                      <span className={st.tone}>{st.label}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(link);
                        toast.success("Link copiado.");
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={link} target="_blank" rel="noreferrer">
                        <Link2 className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {!i.revokedAt && (
                      <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id)}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(i.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
