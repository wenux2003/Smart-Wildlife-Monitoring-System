import {
  AnalyticsCategoryGroupSchema,
  AnalyticsFilterSchema,
  DateRangePresetSchema,
} from "@wr/shared";
import type { AnalyticsFilter } from "@wr/shared";

function colomboToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function rangeFor(preset: AnalyticsFilter["preset"]): [string, string] {
  const to = colomboToday();
  const fromDate = new Date(`${to}T12:00:00.000Z`);
  const days =
    preset === "LAST_7_DAYS"
      ? 7
      : preset === "LAST_30_DAYS"
        ? 30
        : preset === "LAST_90_DAYS"
          ? 90
          : preset === "LAST_12_MONTHS"
            ? 365
            : 180;
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  return [fromDate.toISOString().slice(0, 10), to];
}

export function defaultAnalyticsFilter(parkId: string): AnalyticsFilter {
  const [from, to] = rangeFor("LAST_6_MONTHS");
  return AnalyticsFilterSchema.parse({
    parkId,
    from,
    to,
    preset: "LAST_6_MONTHS",
  });
}

export function filterFromSearch(
  params: URLSearchParams,
  fallbackParkId: string,
): AnalyticsFilter {
  const defaults = defaultAnalyticsFilter(fallbackParkId);
  const candidate = {
    parkId: params.get("park") ?? fallbackParkId,
    from: params.get("from") ?? defaults.from,
    to: params.get("to") ?? defaults.to,
    preset: params.get("preset") ?? defaults.preset,
    categoryGroup: params.get("group") ?? "ALL",
    types: params.get("types")?.split(",").filter(Boolean) ?? [],
    sources: params.get("sources")?.split(",").filter(Boolean) ?? [],
    sectorId: params.get("sector") || null,
    includeRejected: params.get("rejected") === "true",
  };
  const parsed = AnalyticsFilterSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const calendarDate = (value: string) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };
  const otherFields = AnalyticsFilterSchema.safeParse({
    ...candidate,
    from: defaults.from,
    to: defaults.to,
  });
  return otherFields.success &&
    calendarDate(candidate.from) &&
    calendarDate(candidate.to)
    ? { ...otherFields.data, from: candidate.from, to: candidate.to }
    : defaults;
}

export function patchFilterSearch(
  params: URLSearchParams,
  patch: Partial<AnalyticsFilter>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (patch.parkId !== undefined) next.set("park", patch.parkId);
  if (patch.from !== undefined) next.set("from", patch.from);
  if (patch.to !== undefined) next.set("to", patch.to);
  if (patch.preset !== undefined) next.set("preset", patch.preset);
  if (patch.categoryGroup !== undefined) next.set("group", patch.categoryGroup);
  if (patch.types !== undefined) {
    if (patch.types.length) next.set("types", patch.types.join(","));
    else next.delete("types");
  }
  if (patch.sources !== undefined) {
    if (patch.sources.length) next.set("sources", patch.sources.join(","));
    else next.delete("sources");
  }
  if (patch.sectorId !== undefined) {
    if (patch.sectorId) next.set("sector", patch.sectorId);
    else next.delete("sector");
  }
  if (patch.includeRejected !== undefined) {
    if (patch.includeRejected) next.set("rejected", "true");
    else next.delete("rejected");
  }
  return next;
}

export function isDatePreset(
  value: string,
): value is AnalyticsFilter["preset"] {
  return DateRangePresetSchema.safeParse(value).success;
}

export function isCategoryGroup(
  value: string,
): value is AnalyticsFilter["categoryGroup"] {
  return AnalyticsCategoryGroupSchema.safeParse(value).success;
}

export function presetDateRange(preset: AnalyticsFilter["preset"]): {
  from: string;
  to: string;
} {
  const [from, to] = rangeFor(preset);
  return { from, to };
}
