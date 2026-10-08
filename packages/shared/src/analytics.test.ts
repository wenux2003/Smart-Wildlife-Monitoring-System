import { describe, expect, it } from "vitest";
import {
  AnalyticsFilterSchema,
  ParkAnalyticsConfigSchema,
  ReportExportRequestSchema,
  ReportHistoryQuerySchema,
  ReportRunResponseSchema,
} from "./analytics.js";

const baseFilter = {
  parkId: "11111111-1111-4111-8111-111111111111",
  from: "2026-01-01",
  to: "2026-01-31",
};

describe("M4 shared contracts", () => {
  it("applies the documented filter and park configuration defaults", () => {
    expect(AnalyticsFilterSchema.parse(baseFilter)).toMatchObject({
      ...baseFilter,
      preset: "CUSTOM",
      categoryGroup: "ALL",
      types: [],
      sources: [],
      sectorId: null,
      includeRejected: false,
    });
    expect(ParkAnalyticsConfigSchema.parse({})).toMatchObject({
      gridCellMeters: 1000,
      trackBufferMeters: 50,
      maxSegmentGapSeconds: 600,
      maxSegmentLengthMeters: 1000,
      maxPointAccuracyMeters: 100,
      gapNeglectDays: 14,
      hotspotMinCount: 3,
      boundaryStretchBufferMeters: 2000,
      typeRiskLevels: {
        POACHING: "CRITICAL",
        SNARE_FOUND: "HIGH",
        INJURED_ANIMAL: "HIGH",
        HUMAN_WILDLIFE_CONFLICT: "HIGH",
        CROP_DAMAGE: "MEDIUM",
        FENCE_DAMAGE: "MEDIUM",
        OTHER: "LOW",
      },
    });
  });

  it("rejects reversed, invalid-calendar, and overlong date ranges", () => {
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        from: "2026-02-01",
        to: "2026-01-31",
      }).success,
    ).toBe(false);
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        from: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        from: "2024-01-01",
        to: "2026-01-02",
      }).success,
    ).toBe(false);
  });

  it("accepts the maximum 731-day filter span and a one-day filter", () => {
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        from: "2024-01-01",
        to: "2026-01-01",
      }).success,
    ).toBe(true);
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        from: "2026-01-01",
        to: "2026-01-01",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys and invalid type or source selections", () => {
    expect(
      AnalyticsFilterSchema.safeParse({ ...baseFilter, extra: true }).success,
    ).toBe(false);
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        types: ["UNKNOWN"],
      }).success,
    ).toBe(false);
    expect(
      AnalyticsFilterSchema.safeParse({
        ...baseFilter,
        sources: ["UNKNOWN"],
      }).success,
    ).toBe(false);
  });

  it("enforces configured numeric bounds and rejects unknown settings", () => {
    expect(
      ParkAnalyticsConfigSchema.safeParse({ gridCellMeters: 249 }).success,
    ).toBe(false);
    expect(
      ParkAnalyticsConfigSchema.safeParse({ hotspotMinCount: 51 }).success,
    ).toBe(false);
    expect(
      ParkAnalyticsConfigSchema.safeParse({ extraSetting: true }).success,
    ).toBe(false);
  });

  it("validates export and paginated history request contracts", () => {
    expect(ReportExportRequestSchema.safeParse({ format: "PDF" }).success).toBe(
      true,
    );
    expect(
      ReportExportRequestSchema.safeParse({ format: "XLSX" }).success,
    ).toBe(false);
    expect(ReportHistoryQuerySchema.parse({ page: "2" })).toMatchObject({
      page: 2,
      pageSize: 20,
    });
    expect(
      ReportHistoryQuerySchema.safeParse({ pageSize: "101" }).success,
    ).toBe(false);
  });

  it("requires snapshots and hashes only for successful report runs", () => {
    const report = {
      schemaVersion: 1,
      park: {
        id: baseFilter.parkId,
        code: "YALA",
        name: "Yala National Park",
      },
      filters: AnalyticsFilterSchema.parse(baseFilter),
      window: {
        fromUtc: "2026-01-01T00:00:00.000Z",
        toUtcExclusive: "2026-02-01T00:00:00.000Z",
        bucket: "DAY",
        timezone: "Asia/Colombo",
        days: 31,
      },
      generatedAt: "2026-02-01T00:00:00.000Z",
      kpis: {
        totalIncidents: 0,
        previousPeriodIncidents: 0,
        changePercent: null,
        changeKind: "NO_CHANGE",
        hotspotCells: 0,
        hotspotSectorNames: [],
        patrolGapAreaKm2: null,
        patrolGapSharePercent: null,
        communityConflictReports: 0,
        collarBreaches: 0,
      },
      dataQuality: {
        excludedNoLocation: 0,
        excludedRejected: 0,
        outsideBoundary: 0,
        sessionsWithoutTrack: 0,
        droppedGpsPoints: 0,
        alertsWithoutLocation: 0,
      },
      trend: [],
      breakdown: [],
      hotspots: { cellSizeMeters: 1000, cells: [], classBreaks: [] },
      patrolGaps: {
        configured: false,
        cells: [],
        coveredAreaKm2: 0,
        gapAreaKm2: 0,
        parkAreaKm2: 0,
        bySector: [],
      },
      priorityCells: [],
      conflicts: { series: [], byStretch: [] },
      summarySentences: [],
    };
    const emptyRun = {
      runId: "22222222-2222-4222-8222-222222222222",
      code: "RPT-YALA-2026-000001",
      status: "EMPTY",
      snapshotSha256: null,
      report: null,
      suggestions: ["Widen the date range"],
    };
    expect(ReportRunResponseSchema.safeParse(emptyRun).success).toBe(true);
    expect(
      ReportRunResponseSchema.safeParse({
        ...emptyRun,
        status: "SUCCEEDED",
        snapshotSha256: "a".repeat(64),
        report,
      }).success,
    ).toBe(true);
    expect(
      ReportRunResponseSchema.safeParse({
        ...emptyRun,
        status: "SUCCEEDED",
      }).success,
    ).toBe(false);
    expect(
      ReportRunResponseSchema.safeParse({
        ...emptyRun,
        snapshotSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
  });
});
