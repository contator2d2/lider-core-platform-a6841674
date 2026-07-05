import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/apps")({
  component: AppsPage,
});

type Release = {
  id: string;
  platform: "web" | "desktop" | "mobile";
  version: string;
  channel: "stable" | "beta";
  releaseNotes: string | null;
  downloadUrl: string | null;
  publishedAt: string;
};

function AppsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    platform: Release["platform"];
    version: string;
    channel: Release["channel"];
    releaseNotes: string;
    downloadUrl: string;
  }>({ platform: "desktop", version: "", channel: "stable", releaseNotes: "", downloadUrl: "" });

  const list = useQuery({ queryKey: ["admin", "apps"], queryFn: () => api<Release[]>("/admin/apps") });
  const create = useMutation({
    mutationFn: () =>
      api("/admin/apps", {
        method: "POST",
        body: {
          ...form,
          releaseNotes: form.releaseNotes || null,
          downloadUrl: form.downloadUrl || null,
        },
      }),
    onSuccess: () => {
      toast.success("Release publicado.");
      setOpen(false);
      setForm({ platform: "desktop", version: "", channel: "stable", releaseNotes: "", downloadUrl: "" });
      qc.invalidateQueries({ queryKey: ["admin", "apps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Apps & Versões"
        description="Controle de release: web, desktop (Electron) e mobile."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Novo release
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo release</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Plataforma</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.platform}
                      onChange={(e) => setForm({ ...form, platform: e.target.value as Release["platform"] })}
                    >
                      <option value="web">Web</option>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Versão</Label>
                    <Input
                      value={form.version}
                      onChange={(e) => setForm({ ...form, version: e.target.value })}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Canal</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.channel}
                      onChange={(e) => setForm({ ...form, channel: e.target.value as Release["channel"] })}
                    >
                      <option value="stable">stable</option>
                      <option value="beta">beta</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>URL de download</Label>
                  <Input
                    value={form.downloadUrl}
                    onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Release notes</Label>
                  <Textarea
                    rows={4}
                    value={form.releaseNotes}
                    onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.version || create.isPending}>
                  {create.isPending ? "Publicando..." : "Publicar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-3">
        {list.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Nenhum release publicado.
          </div>
        )}
        {list.data?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {r.platform} · {r.channel}
                </div>
                <div className="font-display text-lg">v{r.version}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.publishedAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            {r.releaseNotes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.releaseNotes}</p>
            )}
            {r.downloadUrl && (
              <a
                href={r.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-accent underline"
              >
                Download →
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}