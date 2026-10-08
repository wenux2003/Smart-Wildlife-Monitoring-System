import { AnalyticsFilterSchema, type ConservationReport } from "@wr/shared";
export const TEST_PARK = "11111111-1111-4111-8111-111111111111";
export function reportFixture(): ConservationReport {
  return {
    schemaVersion: 1,
    park: { id: TEST_PARK, code: "YALA", name: "Yala" },
    filters: AnalyticsFilterSchema.parse({
      parkId: TEST_PARK,
      from: "2026-01-01",
      to: "2026-01-31",
    }),
    window: {
      fromUtc: "2025-12-31T18:30:00.000Z",
      toUtcExclusive: "2026-01-31T18:30:00.000Z",
      bucket: "DAY",
      timezone: "Asia/Colombo",
      days: 31,
    },
    generatedAt: "2026-02-01T00:00:00.000Z",
    kpis: {
      totalIncidents: 0,
      previousPeriodIncidents: 0,
      changePercent: 0,
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
}
