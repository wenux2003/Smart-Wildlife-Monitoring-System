import type { AnalyticsFilter } from "@wr/shared";

export function emptyReportSuggestions(filters: AnalyticsFilter): string[] {
  const suggestions = ["Widen the date range"];
  if (filters.categoryGroup !== "ALL" || filters.types.length > 0)
    suggestions.push("Choose All categories");
  if (filters.sectorId) suggestions.push("Clear the sector filter");
  if (filters.sources.length > 0) suggestions.push("Clear the source filter");
  return suggestions;
}
