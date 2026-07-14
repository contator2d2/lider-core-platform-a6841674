import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

const ACCENT = "var(--accent)";

function TinyTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string | number;
  format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label != null && (
        <div className="mb-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      )}
      <div className="font-medium">{format ? format(v) : v}</div>
    </div>
  );
}

export function TrendArea({
  data,
  height = 200,
  yKey = "value",
  xKey = "label",
  suffix = "",
}: {
  data: Array<Record<string, number | string>>;
  height?: number;
  yKey?: string;
  xKey?: string;
  suffix?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lc-accent-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} opacity={0.5} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: ACCENT, strokeOpacity: 0.25, strokeWidth: 1 }}
            content={<TinyTooltip format={(v) => `${v}${suffix}`} />}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={ACCENT}
            strokeWidth={1.75}
            fill="url(#lc-accent-fill)"
            dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: ACCENT, strokeWidth: 2, stroke: "var(--background)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  data,
  height = 40,
  yKey = "value",
}: {
  data: Array<Record<string, number | string>>;
  height?: number;
  yKey?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={ACCENT}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Semi-circular gauge — grande número no centro, arco laranja com animação nativa.
 */
export function ScoreGauge({
  value,
  max = 100,
  label,
  size = 220,
  center,
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  center?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const data = [{ name: "score", value: pct * 100, fill: ACCENT }];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          startAngle={220}
          endAngle={-40}
          data={data}
        >
          <defs>
            <linearGradient id="lc-gauge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={ACCENT} />
              <stop offset="100%" stopColor="oklch(0.74 0.16 55)" />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: "var(--secondary)" }}
            dataKey="value"
            cornerRadius={12}
            fill="url(#lc-gauge)"
            isAnimationActive
            animationDuration={900}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {center}
        {label && (
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

export function RankBars({
  data,
  height = 260,
  suffix = "",
}: {
  data: Array<{ label: string; value: number; tone?: "good" | "warn" | "bad" | "default" }>;
  height?: number;
  suffix?: string;
}) {
  const colorFor = (tone?: string) =>
    tone === "good"
      ? "var(--success)"
      : tone === "bad"
        ? "var(--destructive)"
        : tone === "warn"
          ? ACCENT
          : ACCENT;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" horizontal={false} opacity={0.4} />
          <XAxis type="number" tickLine={false} axisLine={false} domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={140}
            tick={{ fontSize: 11, fill: "var(--foreground)" }}
          />
          <Tooltip content={<TinyTooltip format={(v) => `${v}${suffix}`} />} cursor={{ fill: "var(--secondary)", opacity: 0.5 }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={14}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.tone)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompositionBars({
  segments,
}: {
  segments: Array<{ label: string; value: number; hint?: string }>;
}) {
  return (
    <div className="space-y-4">
      {segments.map((s) => {
        const pct = Math.round(Math.max(0, Math.min(1, s.value)) * 100);
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="metric-number text-sm">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent-gradient transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            {s.hint && (
              <div className="mt-1 text-[10px] text-muted-foreground">{s.hint}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}