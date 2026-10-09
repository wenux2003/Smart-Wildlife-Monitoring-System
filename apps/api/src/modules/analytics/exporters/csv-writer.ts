export type CsvValue = string | number | null;

function escapeText(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

function formatValue(value: CsvValue): string {
  if (value === null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("CSV numbers must be finite.");
    return Object.is(value, -0) ? "0" : String(value);
  }
  return escapeText(value);
}

export function writeCsv(rows: readonly (readonly CsvValue[])[]): Buffer {
  const body = rows.map((row) => row.map(formatValue).join(",")).join("\r\n");
  return Buffer.from(`\uFEFF${body}\r\n`, "utf8");
}
