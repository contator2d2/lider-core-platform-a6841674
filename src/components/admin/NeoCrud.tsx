import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

export type FieldDef =
  | { kind: "text"; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: "textarea"; name: string; label: string; rows?: number }
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: "tags"; name: string; label: string }
  | { kind: "number"; name: string; label: string };

type Item = Record<string, unknown> & { id: string };

export function NeoCrudPage<T extends Item>({
  title,
  eyebrow,
  description,
  endpoint,
  fields,
  columns,
  filterField,
  filterOptions,
  entityLabel,
  defaultValues,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  endpoint: string;
  fields: FieldDef[];
  columns: { key: keyof T & string; label: string; render?: (item: T) => React.ReactNode }[];
  filterField?: string;
  filterOptions?: { value: string; label: string }[];
  entityLabel: string;
  defaultValues?: Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; data: Record<string, unknown> } | null>(null);

  const query = useQuery<T[]>({
    queryKey: [endpoint, filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter && filterField) params.set(filterField, filter);
      const suffix = params.toString() ? `?${params}` : "";
      return api<T[]>(`${endpoint}${suffix}`);
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((it) =>
      Object.values(it).some((v) => typeof v === "string" && v.toLowerCase().includes(needle))
    );
  }, [query.data, q]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (dialog?.mode === "edit" && payload.id) {
        const { id, ...rest } = payload;
        return api(`${endpoint}/${id}`, { method: "PATCH", body: rest });
      }
      return api(endpoint, { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success(dialog?.mode === "edit" ? `${entityLabel} atualizado` : `${entityLabel} criado`);
      qc.invalidateQueries({ queryKey: [endpoint] });
      setDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${entityLabel} removido`);
      qc.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b neo-hairline pb-6">
        <div>
          <div className="neo-eyebrow">{eyebrow ?? "Neo"}</div>
          <h1 className="mt-2 text-4xl md:text-5xl">{title}</h1>
          {description && (
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[color:var(--neo-muted)]">{description}</p>
          )}
        </div>
        <Button
          onClick={() => setDialog({ mode: "create", data: defaultValues ?? {} })}
          className="rounded-full bg-[color:var(--neo-ink)] px-5 text-white hover:bg-[color:var(--neo-ink)]/90"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--neo-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="rounded-full border-[color:var(--neo-line)] bg-white/70 pl-9 pr-4"
          />
        </div>
        {filterField && filterOptions && (
          <Select value={filter || "__all"} onValueChange={(v) => setFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-[220px] rounded-full border-[color:var(--neo-line)] bg-white/70">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {filterOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border neo-hairline bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b neo-hairline bg-[color:var(--neo-cream)]">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 text-left neo-eyebrow">{c.label}</th>
              ))}
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td className="px-4 py-6 text-center text-[color:var(--neo-muted)]" colSpan={columns.length + 1}>Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-[color:var(--neo-muted)]" colSpan={columns.length + 1}>
                Nenhum registro. Clique em <b>Novo</b> para começar.
              </td></tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.id} className="border-b neo-hairline last:border-none hover:bg-[color:var(--neo-cream)]/60">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 align-top">
                      {c.render ? c.render(it) : String(it[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setDialog({ mode: "edit", data: it as Record<string, unknown> })}
                        className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-[color:var(--neo-cream)] hover:text-[color:var(--neo-ink)]"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => confirm(`Remover ${entityLabel.toLowerCase()}?`) && remove.mutate(it.id)}
                        className="rounded-md p-1.5 text-[color:var(--neo-muted)] hover:bg-red-50 hover:text-red-600"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b neo-hairline px-6 py-4">
            <DialogTitle className="font-editorial text-2xl">
              {dialog?.mode === "edit" ? `Editar ${entityLabel}` : `Novo ${entityLabel}`}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(dialog.data);
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  {f.kind === "textarea" ? (
                    <Textarea
                      rows={f.rows ?? 3}
                      value={String(dialog.data[f.name] ?? "")}
                      onChange={(e) => setDialog({ ...dialog, data: { ...dialog.data, [f.name]: e.target.value } })}
                    />
                  ) : f.kind === "select" ? (
                    <Select
                      value={String(dialog.data[f.name] ?? "")}
                      onValueChange={(v) => setDialog({ ...dialog, data: { ...dialog.data, [f.name]: v } })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : f.kind === "tags" ? (
                    <Input
                      value={((dialog.data[f.name] as string[]) ?? []).join(", ")}
                      placeholder="tag1, tag2"
                      onChange={(e) => setDialog({
                        ...dialog,
                        data: { ...dialog.data, [f.name]: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) },
                      })}
                    />
                  ) : f.kind === "number" ? (
                    <Input
                      type="number"
                      value={String(dialog.data[f.name] ?? "")}
                      onChange={(e) => setDialog({ ...dialog, data: { ...dialog.data, [f.name]: e.target.value === "" ? null : Number(e.target.value) } })}
                    />
                  ) : (
                    <Input
                      value={String(dialog.data[f.name] ?? "")}
                      placeholder={f.placeholder}
                      required={f.required}
                      onChange={(e) => setDialog({ ...dialog, data: { ...dialog.data, [f.name]: e.target.value } })}
                    />
                  )}
                </div>
              ))}
              </div>
              <DialogFooter className="border-t neo-hairline px-6 py-4">
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
                <Button type="submit" disabled={save.isPending} className="bg-[color:var(--neo-ink)] text-white hover:bg-[color:var(--neo-ink)]/90">
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}