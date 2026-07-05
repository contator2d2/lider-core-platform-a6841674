import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
      <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
        <Field label="URL do logo" value={logoUrl} onChange={setLogoUrl} placeholder="https://..." />
        <Field label="URL do favicon" value={faviconUrl} onChange={setFaviconUrl} placeholder="https://..." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor primária" value={primaryColor} onChange={setPrimaryColor} placeholder="#0a0a0a" />
          <Field label="Cor de destaque" value={accentColor} onChange={setAccentColor} placeholder="#ff6a1a" />
        </div>
        <Field
          label="Remetente de email"
          value={emailFromName}
          onChange={setEmailFromName}
          placeholder="LÍDER C.O.R.E."
        />
        <div className="pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar branding global"}
          </Button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}