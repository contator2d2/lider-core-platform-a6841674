// Utilitário simples pra exportar arrays de objetos como CSV no cliente.
// Escapa aspas duplas e envolve todo valor. UTF-8 com BOM pra abrir bem no Excel PT-BR.

function esc(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T | string; label: string; get?: (row: T) => unknown }>,
): string {
  const header = columns.map((c) => esc(c.label)).join(";");
  const body = rows
    .map((r) =>
      columns
        .map((c) => esc(c.get ? c.get(r) : (r as Record<string, unknown>)[c.key as string]))
        .join(";"),
    )
    .join("\n");
  return `\uFEFF${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: Array<{ key: keyof T | string; label: string; get?: (row: T) => unknown }>,
): void {
  downloadCsv(filename, toCsv(rows, columns));
}