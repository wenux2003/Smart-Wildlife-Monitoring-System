import type { ConservationReport } from "@wr/shared";
export function percentChange(
  current: number,
  previous: number,
): Pick<ConservationReport["kpis"], "changePercent" | "changeKind"> {
  if (previous === 0)
    return {
      changePercent: current === 0 ? 0 : null,
      changeKind: current === 0 ? "NO_CHANGE" : "NEW_ACTIVITY",
    };
  const changePercent = Math.round(((current - previous) / previous) * 100);
  return {
    changePercent,
    changeKind:
      changePercent === 0 ? "NO_CHANGE" : changePercent > 0 ? "UP" : "DOWN",
  };
}
export function classBreaks(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  return max === 0
    ? []
    : [...new Set([0.2, 0.4, 0.6, 0.8].map((f) => Math.ceil(max * f)))];
}
export const riskClass = (count: number, breaks: number[]): number =>
  1 + breaks.filter((value) => count > value).length;
export function hotspotThreshold(counts: number[], minimum: number): number {
  if (counts.length < 10) return minimum;
  const sorted = [...counts].sort((a, b) => b - a);
  return Math.max(minimum, sorted[Math.ceil(sorted.length / 10) - 1]);
}
export const priorityScore = (count: number, days: number | null): number =>
  count * Math.min(days ?? 90, 90);
export const sharePercent = (part: number, total: number): number =>
  total === 0 ? 0 : Math.min(100, Math.max(0, (part / total) * 100));
