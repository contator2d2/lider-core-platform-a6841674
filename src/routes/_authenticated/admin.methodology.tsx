import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bot,
  Compass,
  Eye,
  GripVertical,
  Layers,
  ListChecks,
  MessageCircleQuestion,
  Plus,
  Save,
  ScrollText,
  Sparkles,
  Target,
  Trash2,
  Workflow,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/methodology")({
  component: MethodologyPage,
});

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type Comp = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  orderIndex: number;
  active: boolean;
  purpose: string | null;
  behaviors: string[];
  practices: string[];
  guidingQuestions: string[];
  rituals: string[];
  indicators: string[];
  aiPrompt: string | null;
  color: string | null;
};

type Doc = {
  id: string;
  mission: string | null;
  vision: string | null;
  manifesto: string | null;
  principles: string[];
  leaderProfile: string | null;
  aiSystemPrompt: string | null;
  pillars: unknown | null;
};

type Tab = "manifesto" | "competencies";

function MethodologyPage() {
  const [tab, setTab] = useState<Tab>("manifesto");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["admin", "methodology"], queryFn: () => api<Comp[]>("/admin/methodology") });
  const doc = useQuery({ queryKey: ["admin", "methodology-doc"], queryFn: () => api<Doc>("/admin/methodology-doc") });

  const create = useMutation({
    mutationFn: (body: Partial<Comp>) => api<Comp>("/admin/methodology", { method: "POST", body }),
    onSuccess: (c) => {
      toast.success("Competência criada.");
      qc.invalidateQueries({ queryKey: ["admin", "methodology"] });
      setCreating(false);
      setEditingId(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Metodologia C.O.R.E."
        description="Detalhe a metodologia que orienta o app: manifesto, competências, comportamentos, rituais, indicadores e o coach de IA."
        action={
          tab === "competencies" ? (
            <CreateDialog open={creating} onOpenChange={setCreating} onCreate={(v) => create.mutate(v)} saving={create.isPending} />
          ) : undefined
        }
      />

      <div className="mb-5 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
        {(["manifesto", "competencies"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
              (tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            {t === "manifesto" ? "Manifesto e IA" : "Competências"}
          </button>
        ))}
      </div>

      {tab === "manifesto" ? (
        <ManifestoEditor initial={doc.data} loading={doc.isLoading} />
      ) : (
        <CompetencyList list={list.data ?? []} onOpen={setEditingId} loading={list.isLoading} />
      )}

      <Sheet open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {editingId && <CompetencyEditor id={editingId} onClose={() => setEditingId(null)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ------------------------------------------------------------------
// Manifesto tab
// ------------------------------------------------------------------
function ManifestoEditor({ initial, loading }: { initial: Doc | undefined; loading: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Doc>({
    id: "singleton", mission: "", vision: "", manifesto: "",
    principles: [], leaderProfile: "", aiSystemPrompt: "", pillars: null,
  });
  useEffect(() => { if (initial) setForm({ ...initial, principles: initial.principles ?? [] }); }, [initial]);

  const save = useMutation({
    mutationFn: () => api<Doc>("/admin/methodology-doc", { method: "PUT", body: form }),
    onSuccess: () => { toast.success("Manifesto salvo."); qc.invalidateQueries({ queryKey: ["admin", "methodology-doc"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-4">
      <Panel icon={Target}   title="Missão"        hint="Por que a metodologia existe. Uma frase.">
        <Textarea rows={2} value={form.mission ?? ""} onChange={(e) => setForm({ ...form, mission: e.target.value })} />
      </Panel>
      <Panel icon={Eye}      title="Visão"         hint="Onde a metodologia quer levar o líder e a organização.">
        <Textarea rows={2} value={form.vision ?? ""} onChange={(e) => setForm({ ...form, vision: e.target.value })} />
      </Panel>
      <Panel icon={ScrollText} title="Manifesto"    hint="Texto longo com a filosofia — em Markdown.">
        <Textarea rows={7} value={form.manifesto ?? ""} onChange={(e) => setForm({ ...form, manifesto: e.target.value })} />
      </Panel>
      <Panel icon={Compass}  title="Princípios"    hint="Crenças inegociáveis. Um por linha.">
        <ListEditor items={form.principles} onChange={(principles) => setForm({ ...form, principles })} placeholder="Ex: Líder que forma líderes." />
      </Panel>
      <Panel icon={Sparkles} title="Perfil do líder ideal" hint="Descrição comportamental que o app usa como norte.">
        <Textarea rows={5} value={form.leaderProfile ?? ""} onChange={(e) => setForm({ ...form, leaderProfile: e.target.value })} />
      </Panel>
      <Panel icon={Bot}      title="Prompt-base do IA Coach" hint="Este texto é injetado como sistema em toda conversa do coach. Explique tom, princípios e o que ele nunca deve fazer.">
        <Textarea rows={8} className="font-mono text-xs" value={form.aiSystemPrompt ?? ""} onChange={(e) => setForm({ ...form, aiSystemPrompt: e.target.value })} />
      </Panel>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar manifesto"}
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Competency list
// ------------------------------------------------------------------
function CompetencyList({ list, onOpen, loading }: { list: Comp[]; onOpen: (id: string) => void; loading: boolean }) {
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma competência ainda. Comece criando as pilares da sua metodologia.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {list.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-accent/40 hover:shadow-sm"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Layers className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.code}</div>
              <div className="font-semibold">{c.name}</div>
              <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {c.purpose || c.description || "Sem detalhamento. Clique para descrever."}
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">
              <Badge n={c.behaviors.length} label="comportamentos" />
              <Badge n={c.practices.length} label="práticas" />
              <Badge n={c.rituals.length} label="rituais" />
              <Badge n={c.indicators.length} label="indicadores" />
            </div>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">peso {c.weight}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Badge({ n, label }: { n: number; label: string }) {
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 " + (n > 0 ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
      <span className="tabular-nums font-semibold">{n}</span> {label}
    </span>
  );
}

// ------------------------------------------------------------------
// Competency editor (drawer)
// ------------------------------------------------------------------
function CompetencyEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "methodology"], queryFn: () => api<Comp[]>("/admin/methodology") });
  const current = useMemo(() => list.data?.find((c) => c.id === id), [list.data, id]);
  const [form, setForm] = useState<Comp | null>(null);
  useEffect(() => { if (current) setForm(current); }, [current]);

  const save = useMutation({
    mutationFn: (patch: Partial<Comp>) => api<Comp>(`/admin/methodology/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => { toast.success("Competência atualizada."); qc.invalidateQueries({ queryKey: ["admin", "methodology"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/admin/methodology/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "methodology"] }); onClose(); toast.success("Competência removida."); },
  });

  if (!form) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;

  const setField = <K extends keyof Comp>(k: K, v: Comp[K]) => setForm({ ...form, [k]: v });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent"><Layers className="h-4 w-4" /></span>
          {form.name || "Competência"}
        </SheetTitle>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{form.code}</div>
      </SheetHeader>

      <div className="mt-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código"><Input value={form.code} onChange={(e) => setField("code", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></Field>
          <Field label="Nome"><Input value={form.name} onChange={(e) => setField("name", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Peso"><Input type="number" min={1} value={form.weight} onChange={(e) => setField("weight", Number(e.target.value))} /></Field>
          <Field label="Ordem"><Input type="number" min={0} value={form.orderIndex} onChange={(e) => setField("orderIndex", Number(e.target.value))} /></Field>
          <Field label="Cor (hex)"><Input placeholder="#F97316" value={form.color ?? ""} onChange={(e) => setField("color", e.target.value)} /></Field>
        </div>

        <Field label="Descrição curta" hint="Uma frase resumindo a competência.">
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
        </Field>

        <Section icon={Target} title="Propósito" hint="Por que esta competência importa? Que problema resolve?">
          <Textarea rows={3} value={form.purpose ?? ""} onChange={(e) => setField("purpose", e.target.value)} />
        </Section>

        <Section icon={Sparkles} title="Comportamentos observáveis" hint="O que se enxerga no líder que domina isto.">
          <ListEditor items={form.behaviors} onChange={(v) => setField("behaviors", v)} placeholder="Ex: Escuta ativa antes de dar retorno" />
        </Section>

        <Section icon={ListChecks} title="Práticas recomendadas" hint="Ações que o líder deve treinar semanalmente.">
          <ListEditor items={form.practices} onChange={(v) => setField("practices", v)} placeholder="Ex: Fazer 1 feedback por semana" />
        </Section>

        <Section icon={MessageCircleQuestion} title="Perguntas de reflexão" hint="Perguntas que o app usa em check-ins e no 1:1.">
          <ListEditor items={form.guidingQuestions} onChange={(v) => setField("guidingQuestions", v)} placeholder="Ex: Qual conversa você está evitando?" />
        </Section>

        <Section icon={Workflow} title="Rituais associados" hint="Rituais que sustentam esta competência.">
          <ListEditor items={form.rituals} onChange={(v) => setField("rituals", v)} placeholder="Ex: Weekly de equipe" />
        </Section>

        <Section icon={ListChecks} title="Indicadores" hint="Como medir evolução nesta competência.">
          <ListEditor items={form.indicators} onChange={(v) => setField("indicators", v)} placeholder="Ex: Nº de 1:1s no mês" />
        </Section>

        <Section icon={Bot} title="Prompt do IA Coach" hint="Instruções específicas que o coach usa ao tratar desta competência.">
          <Textarea rows={6} className="font-mono text-xs" value={form.aiPrompt ?? ""} onChange={(e) => setField("aiPrompt", e.target.value)} />
        </Section>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => { if (confirm(`Remover "${form.name}"?`)) remove.mutate(); }}
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Create dialog (simple: just code + name; details live in the drawer)
// ------------------------------------------------------------------
function CreateDialog({ open, onOpenChange, onCreate, saving }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (v: Partial<Comp>) => void;
  saving: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(1);
  useEffect(() => { if (!open) { setCode(""); setName(""); setWeight(1); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> Nova competência</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova competência</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome"><Input value={name} onChange={(e) => {
            setName(e.target.value);
            if (!code) setCode(slugify(e.target.value));
          }} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código"><Input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></Field>
            <Field label="Peso"><Input type="number" min={1} value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">Você poderá detalhar propósito, comportamentos, práticas e prompt de IA depois de criar.</p>
        </div>
        <DialogFooter>
          <Button disabled={!name || !code || saving} onClick={() => onCreate({ code, name, weight, orderIndex: 0 })}>
            {saving ? "Criando…" : "Criar e detalhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Building blocks
// ------------------------------------------------------------------
function Panel({ icon: Icon, title, hint, children }: { icon: typeof Target; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Target; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft(""); };
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="group flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={it}
              onChange={(e) => { const copy = [...items]; copy[i] = e.target.value; onChange(copy); }}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder ?? "Adicionar item"}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}