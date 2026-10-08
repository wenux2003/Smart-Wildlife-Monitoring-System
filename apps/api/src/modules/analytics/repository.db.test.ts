import { expect, it } from "vitest";
import postgres from "postgres";
import { createAnalyticsRepository } from "./repository.js";
import { createReportAuditRepository } from "./audit-repository.js";
import { normalizeFilter } from "./domain/filter.js";
import { assembleReport } from "./domain/report-assembler.js";
const url = process.env.M4_TEST_DATABASE_URL;
it.skipIf(!url)(
  "queries seeded reports consistently and enforces audit park/user isolation",
  async () => {
    if (!url) return;
    const parsed = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw Error("Use isolated local _test DB");
    const db = postgres(url, { max: 1 });
    const repo = createAnalyticsRepository(url),
      audit = createReportAuditRepository(url);
    let runId: string | undefined;
    try {
      const [park] = await db<
        { id: string }[]
      >`SELECT id FROM parks WHERE code='YALA'`;
      const [user] = await db<
        { id: string; name: string }[]
      >`SELECT id,name FROM auth_users WHERE park_id=${park.id} AND role='PARK_MANAGER'`;
      const now = new Date("2026-10-08T12:00:00Z");
      const filter = normalizeFilter(
        { parkId: park.id, from: "2026-04-01", to: "2026-10-08" },
        { now: () => now },
      );
      const start = performance.now();
      const result = await repo.load(filter, now);
      expect(performance.now() - start).toBeLessThan(2000);
      expect(result.hasPatrolPoints).toBe(true);
      const { report, snapshotSha256 } = assembleReport(result.sections);
      expect(report.kpis.totalIncidents).toBe(171);
      expect(report.kpis.collarBreaches).toBe(40);
      expect(report.trend.reduce((n, b) => n + b.count, 0)).toBe(171);
      expect(report.breakdown.reduce((n, b) => n + b.count, 0)).toBe(171);
      expect(report.patrolGaps.gapAreaKm2).toBeGreaterThan(0);
      expect(report.patrolGaps.coveredAreaKm2).toBeGreaterThan(0);
      expect(report.dataQuality.excludedNoLocation).toBeGreaterThan(0);
      expect(report.spatialContext.parkBoundary?.length).toBeGreaterThan(0);
      expect(report.spatialContext.sectors.length).toBeGreaterThan(0);
      expect(
        report.spatialContext.sectors.every((sector) =>
          sector.polygon.every((polygon) =>
            polygon.every((ring) => ring.length >= 4),
          ),
        ),
      ).toBe(true);
      expect(JSON.stringify(report)).not.toMatch(
        /reporter_phone|description|reporter_id/,
      );
      expect((await repo.options(park.id)).allowedParks).toHaveLength(1);
      const stored = await audit.insertRun({
        parkCode: "YALA",
        parkId: park.id,
        requestedBy: user.id,
        requesterName: user.name,
        requesterRole: "PARK_MANAGER",
        filters: filter.filters,
        status: "SUCCEEDED",
        report,
        snapshotSha256,
        durationMs: 1,
        createdAt: now.toISOString(),
        errorCode: null,
        suggestions: [],
      });
      runId = stored.runId;
      expect((await audit.getRun(runId, park.id, null))?.snapshotSha256).toBe(
        snapshotSha256,
      );
      expect(
        await audit.getRun(runId, "11111111-1111-4111-8111-111111111111", null),
      ).toBeNull();
      expect(
        await audit.getRun(
          runId,
          park.id,
          "11111111-1111-4111-8111-111111111111",
        ),
      ).toBeNull();
      await audit.insertExport({
        runId,
        requestedBy: user.id,
        format: "CSV",
        status: "SUCCEEDED",
        byteSize: 13,
        fileSha256: "a".repeat(64),
        errorCode: null,
      });
      const history = await audit.history(park.id, user.id, 1, 20);
      const auditedRun = history.items.find(
        (record) => record.run.runId === runId,
      );
      expect(auditedRun?.exports).toHaveLength(1);
      expect(auditedRun?.exports[0]).toMatchObject({
        format: "CSV",
        status: "SUCCEEDED",
        byteSize: 13,
        fileSha256: "a".repeat(64),
      });
      expect(history.items.some((record) => record.run.runId === runId)).toBe(
        true,
      );
      const datedHistory = await audit.history(
        park.id,
        user.id,
        1,
        20,
        "SUCCEEDED",
        "2026-10-08",
        "2026-10-08",
      );
      expect(
        datedHistory.items.some((record) => record.run.runId === runId),
      ).toBe(true);
    } finally {
      if (runId) {
        await db`DELETE FROM report_exports WHERE run_id=${runId}`;
        await db`DELETE FROM report_runs WHERE id=${runId}`;
      }
      await repo.close?.();
      await audit.close?.();
      await db.end();
    }
  },
  15000,
);
