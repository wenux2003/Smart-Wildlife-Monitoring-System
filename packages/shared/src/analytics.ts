import { z } from "zod";
import {
  CoordinatesSchema,
  IncidentCategorySchema,
  IncidentSourceSchema,
} from "./incidents.js";

export const AnalyticsCategoryGroupSchema = z.enum([
  "ALL",
  "POACHING_AND_SNARES",
  "HUMAN_WILDLIFE_CONFLICT",
  "ANIMAL_WELFARE",
  "OTHER",
]);

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const ReportFormatSchema = z.enum(["PDF", "CSV"]);
export const ReportRunStatusSchema = z.enum([
  "SUCCEEDED",
  "EMPTY",
  "TIMED_OUT",
  "FAILED",
]);
export const DateRangePresetSchema = z.enum([
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "LAST_90_DAYS",
  "LAST_6_MONTHS",
  "LAST_12_MONTHS",
  "CUSTOM",
]);
export const BucketSchema = z.enum(["DAY", "WEEK", "MONTH"]);

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date.");

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return (toMs - fromMs) / 86_400_000;
}

export const ParkAnalyticsConfigSchema = z
  .object({
    gridCellMeters: z.number().int().min(250).max(5000).default(1000),
    trackBufferMeters: z.number().int().min(10).max(500).default(50),
    maxSegmentGapSeconds: z.number().int().min(30).max(3600).default(600),
    maxSegmentLengthMeters: z.number().int().min(50).max(5000).default(1000),
    maxPointAccuracyMeters: z.number().int().min(5).max(500).default(100),
    gapNeglectDays: z.number().int().min(1).max(180).default(14),
    hotspotMinCount: z.number().int().min(1).max(50).default(3),
    boundaryStretchBufferMeters: z
      .number()
      .int()
      .min(100)
      .max(10_000)
      .default(2000),
    typeRiskLevels: z.record(IncidentCategorySchema, RiskLevelSchema).default({
      POACHING: "CRITICAL",
      SNARE_FOUND: "HIGH",
      INJURED_ANIMAL: "HIGH",
      HUMAN_WILDLIFE_CONFLICT: "HIGH",
      CROP_DAMAGE: "MEDIUM",
      FENCE_DAMAGE: "MEDIUM",
      OTHER: "LOW",
    }),
  })
  .strict();
export type ParkAnalyticsConfig = z.infer<typeof ParkAnalyticsConfigSchema>;

export const AnalyticsFilterSchema = z
  .object({
    parkId: z.string().uuid(),
    from: IsoDateSchema,
    to: IsoDateSchema,
    preset: DateRangePresetSchema.default("CUSTOM"),
    categoryGroup: AnalyticsCategoryGroupSchema.default("ALL"),
    types: z.array(IncidentCategorySchema).max(7).default([]),
    sources: z.array(IncidentSourceSchema).max(3).default([]),
    sectorId: z.string().uuid().nullable().default(null),
    includeRejected: z.boolean().default(false),
  })
  .strict()
  .refine((filter) => filter.from <= filter.to, {
    path: ["to"],
    message: "End date must be on or after start date.",
  })
  .refine((filter) => daysBetween(filter.from, filter.to) <= 731, {
    path: ["from"],
    message: "Choose a range of 2 years or less.",
  });
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;

export const KpiSchema = z.object({
  totalIncidents: z.number().int().nonnegative(),
  previousPeriodIncidents: z.number().int().nonnegative(),
  changePercent: z.number().nullable(),
  changeKind: z.enum(["UP", "DOWN", "NO_CHANGE", "NEW_ACTIVITY"]),
  hotspotCells: z.number().int().nonnegative(),
  hotspotSectorNames: z.array(z.string()).max(3),
  patrolGapAreaKm2: z.number().nonnegative().nullable(),
  patrolGapSharePercent: z.number().min(0).max(100).nullable(),
  communityConflictReports: z.number().int().nonnegative(),
  collarBreaches: z.number().int().nonnegative(),
});

export const DataQualitySchema = z.object({
  excludedNoLocation: z.number().int().nonnegative(),
  excludedRejected: z.number().int().nonnegative(),
  outsideBoundary: z.number().int().nonnegative(),
  sessionsAnalyzed: z.number().int().nonnegative().optional(),
  sessionsWithoutTrack: z.number().int().nonnegative(),
  droppedGpsPoints: z.number().int().nonnegative(),
  alertsWithoutLocation: z.number().int().nonnegative(),
});

export const TrendPointSchema = z.object({
  bucketStart: IsoDateSchema,
  label: z.string(),
  count: z.number().int().nonnegative(),
});

export const BreakdownRowSchema = z.object({
  type: IncidentCategorySchema,
  sectorId: z.string().uuid().nullable(),
  sectorName: z.string(),
  count: z.number().int().nonnegative(),
  riskLevel: RiskLevelSchema,
  sharePercent: z.number().min(0).max(100),
});

export const HotspotCellSchema = z.object({
  cellId: z.string(),
  polygon: z.array(CoordinatesSchema),
  sectorName: z.string().nullable(),
  count: z.number().int().positive(),
  riskClass: z.number().int().min(1).max(5),
  isHotspot: z.boolean(),
});

export const CoverageCellSchema = z.object({
  cellId: z.string(),
  polygon: z.array(CoordinatesSchema),
  covered: z.boolean(),
  lastPatrolledAt: z.string().datetime().nullable(),
  daysSincePatrol: z.number().int().nonnegative().nullable(),
});

export const PriorityCellSchema = z.object({
  cellId: z.string(),
  centre: CoordinatesSchema,
  sectorName: z.string().nullable(),
  incidents: z.number().int().nonnegative(),
  daysSincePatrol: z.number().int().nonnegative().nullable(),
  score: z.number().nonnegative(),
});

export const ConflictSeriesPointSchema = z.object({
  bucketStart: IsoDateSchema,
  label: z.string(),
  communityReports: z.number().int().nonnegative(),
  collarBreaches: z.number().int().nonnegative(),
  rangerReported: z.number().int().nonnegative(),
});

export const StretchConflictMonthSchema = z.object({
  bucketStart: IsoDateSchema,
  communityReports: z.number().int().nonnegative(),
  collarBreaches: z.number().int().nonnegative(),
});

export const StretchConflictRowSchema = z.object({
  stretchId: z.string().uuid(),
  stretchName: z.string(),
  communityReports: z.number().int().nonnegative(),
  collarBreaches: z.number().int().nonnegative(),
  byMonth: z.array(StretchConflictMonthSchema),
});

const GeoJsonRingSchema = z.array(CoordinatesSchema).min(4);
const GeoJsonPolygonSchema = z.array(GeoJsonRingSchema).min(1);
const GeoJsonMultiPolygonSchema = z.array(GeoJsonPolygonSchema).min(1);

export const AnalyticsSpatialContextSchema = z.object({
  parkBoundary: GeoJsonMultiPolygonSchema.nullable(),
  sectors: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      kind: z.enum(["SECTOR", "BOUNDARY_STRETCH"]),
      polygon: GeoJsonMultiPolygonSchema,
    }),
  ),
  settlements: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      location: CoordinatesSchema,
      nearestStretchId: z.string().uuid().nullable(),
      nearestStretchName: z.string().nullable(),
    }),
  ),
});

export const ConservationReportSchema = z.object({
  schemaVersion: z.literal(1),
  syntheticDemo: z.boolean().optional(),
  park: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
  filters: AnalyticsFilterSchema,
  window: z.object({
    fromUtc: z.string().datetime(),
    toUtcExclusive: z.string().datetime(),
    bucket: BucketSchema,
    timezone: z.literal("Asia/Colombo"),
    days: z.number().int().positive(),
  }),
  generatedAt: z.string().datetime(),
  kpis: KpiSchema,
  dataQuality: DataQualitySchema,
  trend: z.array(TrendPointSchema),
  breakdown: z.array(BreakdownRowSchema),
  hotspots: z.object({
    cellSizeMeters: z.number().int().positive(),
    cells: z.array(HotspotCellSchema),
    classBreaks: z.array(z.number()),
  }),
  patrolGaps: z.object({
    configured: z.boolean(),
    cells: z.array(CoverageCellSchema),
    coveredAreaKm2: z.number().nonnegative(),
    gapAreaKm2: z.number().nonnegative(),
    parkAreaKm2: z.number().nonnegative(),
    bySector: z.array(
      z.object({
        sectorName: z.string(),
        gapAreaKm2: z.number().nonnegative(),
        gapSharePercent: z.number().min(0).max(100),
      }),
    ),
  }),
  priorityCells: z.array(PriorityCellSchema).max(5),
  conflicts: z.object({
    series: z.array(ConflictSeriesPointSchema),
    byStretch: z.array(StretchConflictRowSchema),
  }),
  spatialContext: AnalyticsSpatialContextSchema.default({
    parkBoundary: null,
    sectors: [],
    settlements: [],
  }),
  summarySentences: z.array(z.string()).max(4),
});
export type ConservationReport = z.infer<typeof ConservationReportSchema>;

export const ReportRunResponseSchema = z
  .object({
    runId: z.string().uuid(),
    code: z.string(),
    status: ReportRunStatusSchema,
    snapshotSha256: z.string().length(64).nullable(),
    report: ConservationReportSchema.nullable(),
    suggestions: z.array(z.string()).default([]),
  })
  .refine(
    (run) =>
      run.status === "SUCCEEDED"
        ? run.report !== null && run.snapshotSha256 !== null
        : run.report === null && run.snapshotSha256 === null,
    "Successful runs require a report and snapshot hash; other runs cannot include either.",
  );
export type ReportRunResponse = z.infer<typeof ReportRunResponseSchema>;

export const AnalyticsParkSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const AnalyticsSectorSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["SECTOR", "BOUNDARY_STRETCH"]),
});

export const ParkAnalyticsConfigSummarySchema = z.object({
  gridCellMeters: z.number().int().positive(),
  trackBufferMeters: z.number().int().positive(),
  maxPointAccuracyMeters: z.number().int().positive(),
  maxSegmentGapSeconds: z.number().int().positive(),
  maxSegmentLengthMeters: z.number().int().positive(),
  boundaryStretchBufferMeters: z.number().int().positive(),
  gapNeglectDays: z.number().int().positive(),
  hotspotMinCount: z.number().int().positive(),
  configured: z.boolean(),
});

export const AnalyticsOptionsSchema = z.object({
  allowedParks: z.array(AnalyticsParkSchema),
  types: z.array(IncidentCategorySchema),
  sources: z.array(IncidentSourceSchema),
  sectors: z.array(AnalyticsSectorSchema),
  earliestDataDate: IsoDateSchema.nullable(),
  latestDataDate: IsoDateSchema.nullable(),
  config: ParkAnalyticsConfigSummarySchema,
});
export type AnalyticsOptions = z.infer<typeof AnalyticsOptionsSchema>;

export const ReportExportSchema = z.object({
  id: z.string().uuid(),
  format: ReportFormatSchema,
  status: z.enum(["SUCCEEDED", "FAILED"]),
  byteSize: z.number().int().positive().nullable(),
  fileSha256: z.string().length(64).nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const ReportHistoryItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  parkId: z.string().uuid(),
  requestedBy: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  requesterRole: z.string(),
  filters: AnalyticsFilterSchema,
  status: ReportRunStatusSchema,
  snapshotSha256: z.string().length(64).nullable(),
  durationMs: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  exports: z.array(ReportExportSchema),
});

export const ReportHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: ReportRunStatusSchema.optional(),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
  })
  .strict()
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      query.from <= query.to,
    { path: ["to"], message: "End date must be on or after start date." },
  );
export type ReportHistoryQuery = z.infer<typeof ReportHistoryQuerySchema>;

export const ReportHistoryResponseSchema = z.object({
  items: z.array(ReportHistoryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type ReportHistoryResponse = z.infer<typeof ReportHistoryResponseSchema>;

export const ReportExportRequestSchema = z
  .object({ format: ReportFormatSchema })
  .strict();
