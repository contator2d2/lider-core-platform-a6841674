import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/app/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { orgs, orgId, setOrgId, current } = useCurrentOrg();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Preferências e organização ativa.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Conta
        </div>
        <div className="text-sm">{user?.fullName ?? user?.email}</div>
        <div className="text-xs text-muted-foreground">{user?.email}</div>
      </section>

      {orgs.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Organização ativa
          </div>
          <div className="space-y-2">
            {orgs.map((o) => (
              <label
                key={o.id}
                className={
                  "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition " +
                  (orgId === o.id
                    ? "border-accent bg-accent/5"
                    : "border-border hover:bg-secondary/40")
                }
              >
                <span>
                  <span className="font-medium">{o.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">· {o.plan}</span>
                </span>
                <input
                  type="radio"
                  name="org"
                  checked={orgId === o.id}
                  onChange={() => setOrgId(o.id)}
                />
              </label>
            ))}
          </div>
          {current && (
            <p className="mt-3 text-[11px] text-muted-foreground">Slug: {current.slug}</p>
          )}
        </section>
      )}
    </div>
  );
}