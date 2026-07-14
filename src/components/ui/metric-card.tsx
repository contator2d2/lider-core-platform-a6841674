import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FadeIn, CountUp } from "@/components/motion";
import { cn } from "@/lib/utils";

type Tone = "default" | "good" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-success",
  warn: "text-accent",
  bad: "text-destructive",
};

export function MetricCard({
  eyebrow,
  value,
  suffix,
  hint,
  delta,
  tone = "default",
  icon,
  children,
  className,
  decimals = 0,
  delay = 0,
  highlight,
}: {
  eyebrow: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  delta?: number | null;
  tone?: Tone;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  decimals?: number;
  delay?: number;
  highlight?: boolean;
}) {
  const numeric = typeof value === "number";
  return (
    <FadeIn delay={delay} className={className}>
      <div
        className={cn(
          "card-elevated card-elevated-hover relative overflow-hidden p-5",
          highlight && "ring-accent-glow",
        )}
      >
        {highlight && (
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/25 blur-3xl" />
        )}
        <div className="flex items-center justify-between">
          <div className="eyebrow">{eyebrow}</div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={cn("metric-number text-4xl", toneClass[tone])}>
            {numeric ? <CountUp value={value as number} decimals={decimals} /> : value}
          </span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          {delta != null && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 text-xs font-medium",
                delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : null}
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </FadeIn>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  right,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="mt-1 font-display text-3xl">{title}</h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {right}
    </div>
  );
}