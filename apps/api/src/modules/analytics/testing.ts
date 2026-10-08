import { randomUUID } from "node:crypto";
import {
  AnalyticsFilterSchema,
  ReportRunResponseSchema,
  type AnalyticsOptions,
  type ConservationReport,
} from "@wr/shared";
import type {
  AnalyticsQueryResult,
  AnalyticsRepository,
  NewRun,
  ReportAuditRepository,
  StoredRun,
} from "./types.js";
import type { ReportSections } from "./domain/report-assembler.js";
export const TEST_PARK = "11111111-1111-4111-8111-111111111111";
export const OTHER_PARK = "22222222-2222-4222-8222-222222222222";
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

export function reportFixtureSections(): ReportSections {
  const report = reportFixture();
  return {
    park: report.park,
    filters: report.filters,
    window: report.window,
    generatedAt: report.generatedAt,
    kpis: report.kpis,
    dataQuality: report.dataQuality,
    trend: report.trend,
    breakdown: report.breakdown,
    hotspots: report.hotspots,
    patrolGaps: report.patrolGaps,
    priorityCells: report.priorityCells,
    conflicts: report.conflicts,
  };
}

export function analyticsMemoryRepository(
  result: AnalyticsQueryResult = {
    sections: reportFixtureSections(),
    hasPatrolPoints: true,
  },
) {
  const loadedFilters: unknown[] = [];
  let loadError: unknown;
  const repository: AnalyticsRepository = {
    async options(parkId) {
      return {
        allowedParks: [{ id: parkId, code: "YALA", name: "Yala" }],
        types: [
          "POACHING",
          "SNARE_FOUND",
          "HUMAN_WILDLIFE_CONFLICT",
          "CROP_DAMAGE",
          "FENCE_DAMAGE",
          "INJURED_ANIMAL",
          "OTHER",
        ],
        sources: ["RANGER", "COMMUNITY", "CAMERA_TRAP"],
        sectors: [],
        earliestDataDate: "2026-01-01",
        latestDataDate: "2026-10-08",
        config: {
          gridCellMeters: 1000,
          trackBufferMeters: 50,
          gapNeglectDays: 14,
          hotspotMinCount: 3,
          configured: false,
        },
      } satisfies AnalyticsOptions;
    },
    async load(filter, generatedAt) {
      loadedFilters.push(filter);
      if (loadError) throw loadError;
      return {
        hasPatrolPoints: result.hasPatrolPoints,
        sections: {
          ...result.sections,
          filters: filter.filters,
          window: filter.window,
          generatedAt: generatedAt.toISOString(),
        },
      };
    },
  };
  return {
    repository,
    loadedFilters,
    setLoadError(error: unknown) {
      loadError = error;
    },
  };
}

export function reportAuditMemoryRepository() {
  const runs = new Map<string, StoredRun>();
  const insertedRuns: NewRun[] = [];
  const exportsByRun = new Map<
    string,
    {
      id: string;
      format: "PDF" | "CSV";
      status: "SUCCEEDED" | "FAILED";
      byteSize: number | null;
      fileSha256: string | null;
      errorCode: string | null;
      createdAt: string;
    }[]
  >();
  const insertedExports: unknown[] = [];
  const repository: ReportAuditRepository = {
    async insertRun(input: NewRun) {
      insertedRuns.push(input);
      const run = {
        ...ReportRunResponseSchema.parse({
          runId: randomUUID(),
          code: "RPT-YALA-2026-000001",
          status: input.status,
          snapshotSha256: input.snapshotSha256,
          report: input.report,
          suggestions: input.suggestions,
        }),
        parkId: input.parkId,
        requestedBy: input.requestedBy,
        requesterName: input.requesterName,
        requesterRole: input.requesterRole,
        filters: input.filters,
        durationMs: input.durationMs,
        createdAt: input.createdAt,
      };
      runs.set(run.runId, run);
      return run;
    },
    async getRun(id, parkId, userId) {
      const run = runs.get(id);
      if (
        !run ||
        run.parkId !== parkId ||
        (userId !== null && run.requestedBy !== userId)
      )
        return null;
      return run;
    },
    async history(parkId, userId, page, pageSize, status) {
      const filtered = [...runs.values()]
        .filter(
          (run) =>
            run.parkId === parkId &&
            (userId === null || run.requestedBy === userId) &&
            (!status || run.status === status),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        items: filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((run) => ({
            run,
            exports: exportsByRun.get(run.runId) ?? [],
          })),
        total: filtered.length,
      };
    },
    async insertExport(input) {
      insertedExports.push(input);
      const exports = exportsByRun.get(input.runId) ?? [];
      exports.push({
        id: randomUUID(),
        format: input.format,
        status: input.status,
        byteSize: input.byteSize,
        fileSha256: input.fileSha256,
        errorCode: input.errorCode,
        createdAt: "2026-10-08T12:00:00.000Z",
      });
      exportsByRun.set(input.runId, exports);
    },
  };
  return { repository, runs, insertedRuns, insertedExports };
}
