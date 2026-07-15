import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type InboxItem = {
  id: string;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationBell({ variant = "app" }: { variant?: "app" | "tenant" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const countQ = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/inbox/unread-count"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const listQ = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => api<InboxItem[]>("/notifications/inbox?take=20"),
    enabled: open,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api(`/notifications/inbox/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api("/notifications/inbox/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Todas marcadas como lidas.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/notifications/inbox/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = countQ.data?.count ?? 0;
  const items = listQ.data ?? [];

  const btnClass =
    variant === "tenant"
      ? "relative inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
      : "relative rounded-full border border-border p-2 text-muted-foreground hover:text-foreground";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        className={btnClass}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-medium">Notificações</div>
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unread === 0}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {listQ.isLoading ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Carregando…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nada por aqui. Você está em dia.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const unreadItem = !n.readAt;
                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        {unreadItem && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                        <div className="min-w-0 flex-1">
                          {n.title && (
                            <div className="truncate text-sm font-medium">{n.title}</div>
                          )}
                          {n.body && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                  return (
                    <li key={n.id} className="group px-4 py-3 hover:bg-secondary/40">
                      <div className="flex items-start justify-between gap-2">
                        {n.linkUrl ? (
                          <a
                            href={n.linkUrl}
                            onClick={() => {
                              if (unreadItem) markOne.mutate(n.id);
                              setOpen(false);
                            }}
                            className="min-w-0 flex-1"
                          >
                            {content}
                          </a>
                        ) : (
                          <div className="min-w-0 flex-1">{content}</div>
                        )}
                        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {unreadItem && (
                            <button
                              title="Marcar como lida"
                              onClick={() => markOne.mutate(n.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            title="Remover"
                            onClick={() => remove.mutate(n.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}