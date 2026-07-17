import { useMutation } from "@tanstack/react-query";
import { Info, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { useCurrentOrg } from "@/lib/use-current-org";

type Props = {
  metric: string;
  value?: string | number;
  scope?: string;
  window?: string;
  hint?: string;
};

export function ExplainButton({ metric, value, scope, window, hint }: Props) {
  const { orgId } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      api<{ explanation: string }>(`/organization/${orgId}/ai/explain-metric`, {
        method: "POST",
        body: { metric, value, scope, window, hint },
      }),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !m.data && !m.isPending) m.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          aria-label={`Explicar ${metric}`}
        >
          <Info className="h-3 w-3" strokeWidth={2} />
          Explicar
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">IA Coach</span>
        </div>
        <div className="mb-1 font-display text-sm">{metric}</div>
        {m.isPending && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
          </div>
        )}
        {m.isError && (
          <div className="py-2 text-sm text-red-500">Falha ao gerar explicação.</div>
        )}
        {m.data && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.data.explanation}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}