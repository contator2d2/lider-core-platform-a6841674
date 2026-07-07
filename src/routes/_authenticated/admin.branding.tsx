import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ColorPicker } from "@/components/admin/ColorPicker";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  component: BrandingPage,
});

type Branding = {
  id: string;
  scope: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  faviconUrl: string | null;
  emailFromName: string | null;
};

function BrandingPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "branding"], queryFn: () => api<Branding[]>("/admin/branding") });
  const global = list.data?.find((b) => b.scope === "global");

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [emailFromName, setEmailFromName] = useState("");

  const [initialized, setInitialized] = useState(false);
  if (!initialized && global) {
    setInitialized(true);
    setLogoUrl(global.logoUrl ?? "");
    setPrimaryColor(global.primaryColor ?? "");
    setAccentColor(global.accentColor ?? "");
    setFaviconUrl(global.faviconUrl ?? "");
    setEmailFromName(global.emailFromName ?? "");
  }

  const save = useMutation({
    mutationFn: () =>
      api("/admin/branding", {
        method: "POST",
        body: {
          scope: "global",
          scopeId: null,
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || null,
          accentColor: accentColor || null,
          faviconUrl: faviconUrl || null,
          emailFromName: emailFromName || null,
        },
      }),
    onSuccess: () => {
      toast.success("Branding salvo.");
      qc.invalidateQueries({ queryKey: ["admin", "branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Branding"
        description="Identidade visual padrão da plataforma. Franquias podem sobrescrever no plano Enterprise."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ImageUploader
              label="Logo principal"
              hint="Recomendado: PNG horizontal com fundo transparente"
              value={logoUrl}
              onChange={setLogoUrl}
            />
            <ImageUploader
              label="Favicon"
              hint="Ícone quadrado — .ico, .png ou .svg"
              value={faviconUrl}
              onChange={setFaviconUrl}
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ColorPicker label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
            <ColorPicker label="Cor de destaque" value={accentColor} onChange={setAccentColor} />
          </div>

          <div className="space-y-1.5">
            <Label>Remetente de email</Label>
            <Input
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              placeholder="LÍDER C.O.R.E."
            />
          </div>

          <div className="pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar branding global"}
            </Button>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Preview</div>
          <div
            className="flex h-24 items-center justify-center rounded-xl border border-border p-4"
            style={{ backgroundColor: primaryColor || undefined }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Logo aparecerá aqui</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border border-border"
              style={{ backgroundColor: primaryColor || "#e5e7eb" }}
            />
            <div>
              <div className="text-xs text-muted-foreground">Primária</div>
              <div className="font-mono text-xs uppercase">{primaryColor || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border border-border"
              style={{ backgroundColor: accentColor || "#e5e7eb" }}
            />
            <div>
              <div className="text-xs text-muted-foreground">Destaque</div>
              <div className="font-mono text-xs uppercase">{accentColor || "—"}</div>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor || "#ff6a1a" }}
          >
            Botão de destaque
          </button>
        </aside>
      </div>
    </>
  );
}