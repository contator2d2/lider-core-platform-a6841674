import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Building2, Store, User, Network, Layers, Users } from "lucide-react";
import { api } from "@/lib/api";

type SearchResult = {
  organizations: { id: string; name: string; slug: string; status: string }[];
  franchises: { id: string; name: string; slug: string; status: string }[];
  users: { id: string; email: string; profile: { fullName: string | null } | null }[];
  branches: { id: string; name: string; city: string | null }[];
  areas: { id: string; name: string }[];
  teams: { id: string; name: string }[];
};

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["global-search", q],
    queryFn: () => api<SearchResult>(`/platform/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  const r = query.data;
  const empty =
    r &&
    r.organizations.length === 0 &&
    r.franchises.length === 0 &&
    r.users.length === 0 &&
    r.branches.length === 0 &&
    r.areas.length === 0 &&
    r.teams.length === 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar empresas, franquias, usuários, filiais, áreas, equipes…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {q.length < 2 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Digite ao menos 2 caracteres. Atalho: <kbd className="rounded border border-border px-1.5 py-0.5">⌘K</kbd>
          </div>
        )}
        {q.length >= 2 && empty && <CommandEmpty>Nada encontrado para "{q}".</CommandEmpty>}
        {r?.organizations.length ? (
          <CommandGroup heading="Empresas">
            {r.organizations.map((o) => (
              <CommandItem key={o.id} onSelect={() => go("/admin/organizations")}>
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <div className="text-sm">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.slug} · {o.status}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {r?.franchises.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Franquias">
              {r.franchises.map((f) => (
                <CommandItem key={f.id} onSelect={() => go("/admin/franchises")}>
                  <Store className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.slug} · {f.status}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {r?.users.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Usuários">
              {r.users.map((u) => (
                <CommandItem key={u.id} onSelect={() => go("/admin/users")}>
                  <User className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm">{u.profile?.fullName ?? u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {r?.branches.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Filiais">
              {r.branches.map((b) => (
                <CommandItem key={b.id} onSelect={() => go("/admin/hierarchy")}>
                  <Network className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm">{b.name}</div>
                    {b.city && <div className="text-xs text-muted-foreground">{b.city}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {r?.areas.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Áreas">
              {r.areas.map((a) => (
                <CommandItem key={a.id} onSelect={() => go("/admin/hierarchy")}>
                  <Layers className="mr-2 h-4 w-4" />
                  <div className="text-sm">{a.name}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {r?.teams.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Equipes">
              {r.teams.map((t) => (
                <CommandItem key={t.id} onSelect={() => go("/admin/hierarchy")}>
                  <Users className="mr-2 h-4 w-4" />
                  <div className="text-sm">{t.name}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}