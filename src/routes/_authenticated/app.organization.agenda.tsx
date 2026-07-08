import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";
import { useState } from "react";
import { Calendar, ClipboardList, ScrollText, Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization/agenda")({
  component: AgendaPage,
});

type Entry = { kind: "ritual" | "delegation" | "decision"; id: string; at: string; title: string; subtitle: string; status: string };

function AgendaPage() {
  const { orgId } = useCurrentOrg();
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const q = useQuery({
    queryKey: ["org", "agenda", orgId, range],
    queryFn: () => api<{ entries: Entry[] }>(`/organization/${orgId}/agenda?range=${range}`),
    enabled: !!orgId,
  });

  const groups = new Map<string, Entry[]>();
  for (const e of q.data?.entries ?? []) {
    const day = new Date(e.at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const arr = groups.get(day);
    if (arr) arr.push(e); else groups.set(day, [e]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {(["day", "week", "month"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`rounded-full border px-3 py-1 text-xs ${range === r ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
            {r === "day" ? "Hoje" : r === "week" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([day, items]) => (
          <div key={day}>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> {day}
            </div>
            <ul className="space-y-1.5">
              {items.map((e) => <EntryRow key={e.kind + e.id} e={e} />)}
            </ul>
          </div>
        ))}
        {groups.size === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum evento no período selecionado.
          </div>
        )}
      </div>
    </div>
  );
}

function EntryRow({ e }: { e: Entry }) {
  const Icon = e.kind === "ritual" ? Workflow : e.kind === "delegation" ? ClipboardList : ScrollText;
  return (
    <li className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-medium">{e.title}</div>
          <div className="text-xs text-muted-foreground">{e.subtitle}</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </li>
  );
}
