import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Plus, ExternalLink, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/documents")({
  component: DocumentsPage,
});

type Doc = { id: string; title: string; kind: string; url: string | null; description: string | null; tags: string[]; createdAt: string };

const KINDS = ["policy", "procedure", "flow", "material", "video", "pdf", "link", "other"] as const;

function DocumentsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["org", "docs", orgId],
    queryFn: () => api<Doc[]>(`/organization/${orgId}/documents`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/organization/${orgId}/documents`, { method: "POST", body }),
    onSuccess: () => { toast.success("Documento adicionado."); qc.invalidateQueries({ queryKey: ["org", "docs", orgId] }); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/organization/${orgId}/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org", "docs", orgId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" /> Novo documento</Button></DialogTrigger>
          <DialogContent><CreateForm onSave={(v) => create.mutate(v)} saving={create.isPending} /></DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((d) => (
          <div key={d.id} className="group rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {d.kind}
              </div>
              <button onClick={() => { if (confirm(`Remover "${d.title}"?`)) remove.mutate(d.id); }} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2 font-display text-lg">{d.title}</div>
            {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
            {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> abrir</a>}
          </div>
        ))}
        {q.data?.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum documento. Adicione políticas, procedimentos, fluxos, materiais e links úteis.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateForm({ onSave, saving }: { onSave: (v: Record<string, unknown>) => void; saving: boolean }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("link");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="space-y-4">
      <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Tipo</Label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
      </div>
      <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <DialogFooter>
        <Button disabled={!title || saving} onClick={() => onSave({
          title, kind, url: url || null, description: description || null, scope: "org",
        })}>{saving ? "Salvando…" : "Adicionar"}</Button>
      </DialogFooter>
    </div>
  );
}
