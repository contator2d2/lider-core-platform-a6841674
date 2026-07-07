import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets?: string[];
};

const DEFAULT_PRESETS = [
  "#0a0a0a",
  "#ffffff",
  "#ff6a1a",
  "#f59e0b",
  "#22c55e",
  "#0ea5e9",
  "#6366f1",
  "#ec4899",
  "#ef4444",
  "#64748b",
];

function normalizeHex(v: string): string {
  let s = v.trim();
  if (!s) return "";
  if (!s.startsWith("#")) s = `#${s}`;
  return s.toLowerCase();
}

export function ColorPicker({ label, value, onChange, presets = DEFAULT_PRESETS }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hex = normalizeHex(value || "#000000");
  const displayHex = value ? normalizeHex(value) : "";

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label>{label}</Label>
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="h-10 w-10 shrink-0 rounded-md border border-border shadow-sm transition-transform hover:scale-105"
            style={{ backgroundColor: hex }}
            aria-label={`Escolher ${label}`}
          />
          <Input
            value={displayHex}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="#000000"
            className="font-mono text-sm uppercase"
          />
        </div>

        {open && (
          <div className="absolute left-0 z-30 mt-2 w-[240px] rounded-xl border border-border bg-popover p-3 shadow-lg">
            <HexColorPicker
              color={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000"}
              onChange={(c) => onChange(c)}
              style={{ width: "100%", height: 160 }}
            />
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {presets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className="h-7 w-full rounded-md border border-border transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}