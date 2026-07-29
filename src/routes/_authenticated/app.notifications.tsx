import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  ssr: false,
  component: NotificationsPage,
});

type Item = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => api<Item[]>("/notifications/inbox"),
  });
  const readAll = useMutation({
    mutationFn: () => api("/notifications/inbox/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              Tudo que precisa da sua atenção aqui e no WhatsApp.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => readAll.mutate()}>
          <CheckCheck className="mr-2 h-4 w-4" /> Marcar tudo como lido
        </Button>
      </header>

      <ul className="space-y-2">
        {(q.data ?? []).map((n) => (
          <li
            key={n.id}
            className={
              "rounded-2xl border border-border p-4 shadow-sm " +
              (n.readAt ? "bg-card" : "bg-accent/5")
            }
          >
            <div className="text-sm font-medium">{n.title}</div>
            {n.body && <div className="mt-1 text-sm text-muted-foreground">{n.body}</div>}
            <div className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {new Date(n.createdAt).toLocaleString("pt-BR")}
            </div>
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação por aqui.
          </li>
        )}
      </ul>
    </div>
  );
}