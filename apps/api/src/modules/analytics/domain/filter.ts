import {
  AnalyticsFilterSchema,
  IncidentCategorySchema,
  type AnalyticsFilter,
  type ConservationReport,
} from "@wr/shared";
import type { Clock } from "../../../core/clock.js";
import { AppError } from "../../../core/errors.js";
const DAY = 86_400_000;
const OFFSET = 330 * 60_000;
export const CATEGORY_TYPES = {
  ALL: IncidentCategorySchema.options,
  POACHING_AND_SNARES: ["POACHING", "SNARE_FOUND"],
  HUMAN_WILDLIFE_CONFLICT: [
    "HUMAN_WILDLIFE_CONFLICT",
    "CROP_DAMAGE",
    "FENCE_DAMAGE",
  ],
  ANIMAL_WELFARE: ["INJURED_ANIMAL"],
  OTHER: ["OTHER"],
} as const;
export const colomboDate = (date: Date): string =>
  new Date(date.getTime() + OFFSET).toISOString().slice(0, 10);
export const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(date + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
export function presetRange(
  preset: AnalyticsFilter["preset"],
  clock: Clock,
): { from: string; to: string } | null {
  const to = colomboDate(clock.now());
  if (preset === "CUSTOM") return null;
  const days = {
    TODAY: 1,
    LAST_7_DAYS: 7,
    LAST_30_DAYS: 30,
    LAST_90_DAYS: 90,
    LAST_6_MONTHS: 180,
    LAST_12_MONTHS: 365,
  }[preset];
  return { from: shiftDate(to, 1 - days), to };
}
export type NormalizedFilter = {
  filters: AnalyticsFilter;
  window: ConservationReport["window"];
  previousFromUtc: string;
  previousToUtcExclusive: string;
  effectiveTypes: AnalyticsFilter["types"];
};
/** Dates are authoritative; preset is a UI label, not permission to replace typed dates. */
export function normalizeFilter(
  input: unknown,
  clock: Clock,
): NormalizedFilter {
  const filters = AnalyticsFilterSchema.parse(input);
  if (filters.to > colomboDate(clock.now()))
    throw new AppError(
      "End date cannot be in the future.",
      400,
      "INVALID_DATE_RANGE",
    );
  const start = Date.parse(filters.from + "T00:00:00+05:30");
  const end = Date.parse(filters.to + "T00:00:00+05:30") + DAY;
  const days = (end - start) / DAY;
  const group: readonly string[] = CATEGORY_TYPES[filters.categoryGroup];
  return {
    filters,
    window: {
      fromUtc: new Date(start).toISOString(),
      toUtcExclusive: new Date(end).toISOString(),
      days,
      bucket: days <= 31 ? "DAY" : days <= 120 ? "WEEK" : "MONTH",
      timezone: "Asia/Colombo",
    },
    previousFromUtc: new Date(start - days * DAY).toISOString(),
    previousToUtcExclusive: new Date(start).toISOString(),
    effectiveTypes: IncidentCategorySchema.options.filter(
      (type) =>
        group.includes(type) &&
        (!filters.types.length || filters.types.includes(type)),
    ),
  };
}
export function buckets(
  filter: NormalizedFilter,
): { bucketStart: string; label: string }[] {
  let date = filter.filters.from;
  const unit = filter.window.bucket;
  if (unit === "WEEK")
    date = shiftDate(
      date,
      -((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7),
    );
  if (unit === "MONTH") date = date.slice(0, 7) + "-01";
  const result = [];
  while (date <= filter.filters.to) {
    result.push({
      bucketStart: date,
      label: unit === "MONTH" ? date.slice(0, 7) : date,
    });
    if (unit === "MONTH") {
      const next = new Date(date + "T00:00:00Z");
      next.setUTCMonth(next.getUTCMonth() + 1);
      date = next.toISOString().slice(0, 10);
    } else date = shiftDate(date, unit === "WEEK" ? 7 : 1);
  }
  return result;
}
