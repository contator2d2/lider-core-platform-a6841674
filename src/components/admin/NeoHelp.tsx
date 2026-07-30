import { useState } from "react";
import { ChevronDown, HelpCircle, Lightbulb } from "lucide-react";

export type NeoHelpContent = {
  what: string;
  why: string[];
  steps: string[];
  examples?: string[];
  tips?: string[];
};

export function NeoHelp({ content, label = "Como usar esta tela" }: { content: NeoHelpContent; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border neo-hairline bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2.5">
          <HelpCircle className="h-4 w-4 text-[color:var(--neo-muted)]" />
          <span className="text-sm font-medium text-[color:var(--neo-ink)]">{label}</span>
          <span className="hidden text-[13px] text-[color:var(--neo-muted)] sm:inline">— {content.what}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[color:var(--neo-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid gap-6 border-t neo-hairline px-5 py-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="neo-eyebrow">O que é</div>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--neo-ink)]">{content.what}</p>
          </div>

          <div>
            <div className="neo-eyebrow">Para que serve</div>
            <ul className="mt-2 space-y-1.5">
              {content.why.map((w) => (
                <li key={w} className="flex gap-2 text-[14px] leading-relaxed text-[color:var(--neo-muted)]">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[color:var(--neo-ink)]" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="neo-eyebrow">Como aplicar</div>
            <ol className="mt-2 space-y-1.5">
              {content.steps.map((s, i) => (
                <li key={s} className="flex gap-2.5 text-[14px] leading-relaxed text-[color:var(--neo-muted)]">
                  <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--neo-ink)] text-[11px] font-medium text-white">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {content.examples && content.examples.length > 0 && (
            <div>
              <div className="neo-eyebrow">Exemplos</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {content.examples.map((e) => (
                  <span
                    key={e}
                    className="rounded-full border neo-hairline bg-white px-3 py-1 text-[13px] text-[color:var(--neo-muted)]"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {content.tips && content.tips.length > 0 && (
            <div className="rounded-xl border neo-hairline bg-[color:var(--neo-ink)]/[0.03] p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-[color:var(--neo-ink)]" />
                <span className="neo-eyebrow">Dicas</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {content.tips.map((t) => (
                  <li key={t} className="text-[13.5px] leading-relaxed text-[color:var(--neo-muted)]">• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
