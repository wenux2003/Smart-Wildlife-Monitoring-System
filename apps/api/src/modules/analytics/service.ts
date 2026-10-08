import { createHash } from "node:crypto";
import {
  AnalyticsFilterSchema,
  AnalyticsOptionsSchema,
  ReportHistoryQuerySchema,
  ReportHistoryResponseSchema,
  ReportRunResponseSchema,
  Role,
} from "@wr/shared";
import type { AnalyticsOptions, ReportRunResponse } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { Clock } from "../../core/clock.js";
import { systemClock } from "../../core/clock.js";
import { assertParkAccess } from "../auth/guard.js";
import type { SessionUser } from "../auth/guard.js";
import { assembleReport } from "./domain/report-assembler.js";
import { normalizeFilter, presetRange } from "./domain/filter.js";
import { emptyReportSuggestions } from "./domain/suggestions.js";
import { ExporterRegistry } from "./exporters/registry.js";
import type {
  AnalyticsRepository,
  ReportAuditRepository,
  ReportExporter,
  ReportFormat,
  StoredRun,
} from "./types.js";

const EXPORT_LIMIT = 10;
const EXPORT_WINDOW_MS = 5 * 60_000;
const allowedRoles = [Role.PARK_MANAGER, Role.RESEARCHER] as const;

function unavailable(): AppError {
  return new AppError(
    "Analytics service is temporarily unavailable.",
    503,
    "ANALYTICS_UNAVAILABLE",
  );
}

function isStatementTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "57014"
  );
}

function isConnectionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error))
    return false;
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
  ].includes(String(error.code));
}

export function createAnalyticsService(
  repository: AnalyticsRepository,
  auditRepository: ReportAuditRepository,
  exporters: readonly ReportExporter[] = [],
  clock: Clock = systemClock,
) {
  const exportersByFormat = new ExporterRegistry(exporters);
  const exportsByUser = new Map<string, number[]>();

  function parkIdFor(user: SessionUser, requestedParkId?: string): string {
    if (!allowedRoles.some((role) => role === user.role))
      throw new AppError(
        "Your role does not allow this action.",
        403,
        "FORBIDDEN",
      );
    if (user.role === Role.RESEARCHER && !user.parkId)
      throw new AppError("Park access is pending.", 403, "PARK_ACCESS_PENDING");
    const parkId = requestedParkId ?? user.parkId;
    if (!parkId)
      throw new AppError(
        "A park assignment is required.",
        403,
        "PARK_FORBIDDEN",
      );
    assertParkAccess(user, parkId);
    return parkId;
  }

  async function loadRun(user: SessionUser, runId: string): Promise<StoredRun> {
    const parkId = parkIdFor(user);
    let run: StoredRun | null;
    try {
      run = await auditRepository.getRun(
        runId,
        parkId,
        user.role === Role.RESEARCHER ? user.id : null,
      );
    } catch (error) {
      if (isConnectionFailure(error)) throw unavailable();
      throw error;
    }
    if (!run) throw new AppError("Report not found.", 404, "REPORT_NOT_FOUND");
    assertParkAccess(user, run.parkId);
    return run;
  }

  async function insertRun(
    input: Parameters<ReportAuditRepository["insertRun"]>[0],
  ): Promise<StoredRun> {
    try {
      return await auditRepository.insertRun(input);
    } catch {
      throw unavailable();
    }
  }

  function enforceExportLimit(userId: string): void {
    const now = clock.now().getTime();
    for (const [id, timestamps] of exportsByUser) {
      const active = timestamps.filter(
        (timestamp) => now - timestamp < EXPORT_WINDOW_MS,
      );
      if (active.length) exportsByUser.set(id, active);
      else exportsByUser.delete(id);
    }
    const timestamps = exportsByUser.get(userId) ?? [];
    if (timestamps.length >= EXPORT_LIMIT)
      throw new AppError(
        "Too many exports. Try again in a moment.",
        429,
        "EXPORT_RATE_LIMITED",
      );
    timestamps.push(now);
    exportsByUser.set(userId, timestamps);
  }

  async function recordExport(
    input: Parameters<ReportAuditRepository["insertExport"]>[0],
  ): Promise<void> {
    try {
      await auditRepository.insertExport(input);
    } catch {
      throw unavailable();
    }
  }

  return {
    async options(
      user: SessionUser,
      requestedParkId?: string,
    ): Promise<AnalyticsOptions> {
      const parkId = parkIdFor(user, requestedParkId);
      try {
        return AnalyticsOptionsSchema.parse(await repository.options(parkId));
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isConnectionFailure(error)) throw unavailable();
        throw error;
      }
    },

    async generate(
      user: SessionUser,
      input: unknown,
    ): Promise<ReportRunResponse> {
      const request = AnalyticsFilterSchema.parse(input);
      const parkId = parkIdFor(user, request.parkId);
      const range = presetRange(request.preset, clock);
      const normalized = normalizeFilter(
        { ...request, parkId, ...range },
        clock,
      );
      let options: AnalyticsOptions;
      try {
        options = AnalyticsOptionsSchema.parse(
          await repository.options(parkId),
        );
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isConnectionFailure(error)) throw unavailable();
        throw error;
      }
      const park = options.allowedParks.find(
        (candidate) => candidate.id === parkId,
      );
      if (!park) throw new AppError("Park not found.", 404, "PARK_NOT_FOUND");

      const startedAt = performance.now();
      const generatedAt = clock.now();
      let query: Awaited<ReturnType<AnalyticsRepository["load"]>>;
      try {
        query = await repository.load(normalized, generatedAt);
      } catch (error) {
        if (!isStatementTimeout(error)) {
          if (isConnectionFailure(error)) throw unavailable();
          throw error;
        }
        await insertRun({
          parkCode: park.code,
          parkId,
          requestedBy: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          filters: normalized.filters,
          status: "TIMED_OUT",
          report: null,
          snapshotSha256: null,
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          createdAt: clock.now().toISOString(),
          errorCode: "ANALYTICS_TIMEOUT",
          suggestions: [],
        });
        throw new AppError(
          "The analysis took too long. Adjust the filters or retry.",
          504,
          "ANALYTICS_TIMEOUT",
        );
      }

      const { sections, hasPatrolPoints } = query;
      const hasConflictEvents = sections.conflicts.series.some(
        (point) =>
          point.communityReports > 0 ||
          point.collarBreaches > 0 ||
          point.rangerReported > 0,
      );
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      if (
        sections.kpis.totalIncidents === 0 &&
        !hasConflictEvents &&
        !hasPatrolPoints
      ) {
        const emptySuggestions = emptyReportSuggestions(normalized.filters);
        return insertRun({
          parkCode: park.code,
          parkId,
          requestedBy: user.id,
          requesterName: user.name,
          requesterRole: user.role,
          filters: normalized.filters,
          status: "EMPTY",
          report: null,
          snapshotSha256: null,
          durationMs,
          createdAt: generatedAt.toISOString(),
          errorCode: null,
          suggestions: emptySuggestions,
        });
      }

      const { report, snapshotSha256 } = assembleReport(sections);
      return insertRun({
        parkCode: park.code,
        parkId,
        requestedBy: user.id,
        requesterName: user.name,
        requesterRole: user.role,
        filters: normalized.filters,
        status: "SUCCEEDED",
        report,
        snapshotSha256,
        durationMs,
        createdAt: generatedAt.toISOString(),
        errorCode: null,
        suggestions: [],
      });
    },

    async getRun(user: SessionUser, runId: string): Promise<ReportRunResponse> {
      const run = await loadRun(user, runId);
      return ReportRunResponseSchema.parse(run);
    },

    async exportRun(
      user: SessionUser,
      runId: string,
      format: ReportFormat,
    ): Promise<{
      bytes: Buffer;
      fileSha256: string;
      mimeType: string;
      filename: string;
    }> {
      const run = await loadRun(user, runId);
      if (run.status !== "SUCCEEDED" || !run.report)
        throw new AppError(
          "This report cannot be exported.",
          409,
          "REPORT_NOT_EXPORTABLE",
        );
      const exporter = exportersByFormat.get(format);
      if (!exporter) throw unavailable();
      enforceExportLimit(user.id);
      let bytes: Buffer;
      try {
        bytes = await exporter.render({ ...run, report: run.report });
        if (!Buffer.isBuffer(bytes) || bytes.length === 0)
          throw new Error("Exporter returned an empty file.");
      } catch (error) {
        const exportError =
          error instanceof AppError && error.code === "EXPORT_TOO_LARGE"
            ? error
            : new AppError(
                "The export could not be created. The report is still available.",
                500,
                "EXPORT_FAILED",
              );
        await recordExport({
          runId,
          requestedBy: user.id,
          format,
          status: "FAILED",
          byteSize: null,
          fileSha256: null,
          errorCode: exportError.code,
        });
        throw exportError;
      }
      const fileSha256 = createHash("sha256").update(bytes).digest("hex");
      await recordExport({
        runId,
        requestedBy: user.id,
        format,
        status: "SUCCEEDED",
        byteSize: bytes.length,
        fileSha256,
        errorCode: null,
      });
      return {
        bytes,
        fileSha256,
        mimeType: exporter.mimeType,
        filename: `wana-rakshaka_${run.code.replace(/[^A-Za-z0-9-]/g, "-")}_${run.filters.from}_to_${run.filters.to}.${exporter.extension}`,
      };
    },

    async history(user: SessionUser, query: unknown) {
      const filters = ReportHistoryQuerySchema.parse(query);
      const parkId = parkIdFor(user);
      let result: Awaited<ReturnType<ReportAuditRepository["history"]>>;
      try {
        result = await auditRepository.history(
          parkId,
          user.role === Role.RESEARCHER ? user.id : null,
          filters.page,
          filters.pageSize,
          filters.status,
        );
      } catch (error) {
        if (isConnectionFailure(error)) throw unavailable();
        throw error;
      }
      return ReportHistoryResponseSchema.parse({
        items: result.items.map(({ run, exports }) => ({
          id: run.runId,
          code: run.code,
          parkId: run.parkId,
          requestedBy: { id: run.requestedBy, name: run.requesterName },
          requesterRole: run.requesterRole,
          filters: run.filters,
          status: run.status,
          snapshotSha256: run.snapshotSha256,
          durationMs: run.durationMs,
          createdAt: run.createdAt,
          exports,
        })),
        total: result.total,
        page: filters.page,
        pageSize: filters.pageSize,
      });
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
