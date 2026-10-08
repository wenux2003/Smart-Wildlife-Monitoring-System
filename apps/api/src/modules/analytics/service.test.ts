import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Role } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { SessionUser } from "../auth/guard.js";
import {
  analyticsMemoryRepository,
  OTHER_PARK,
  reportAuditMemoryRepository,
  reportFixtureSections,
  TEST_PARK,
} from "./testing.js";
import { createAnalyticsService } from "./service.js";

const fixedNow = new Date("2026-10-08T12:00:00.000Z");
const clock = { now: () => new Date(fixedNow) };
const manager: SessionUser = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Park Manager",
  email: "manager@example.org",
  role: Role.PARK_MANAGER,
  parkId: TEST_PARK,
  parkName: "Yala",
};
const baseFilter = {
  parkId: TEST_PARK,
  from: "2026-10-01",
  to: "2026-10-08",
  preset: "CUSTOM" as const,
};

function create(
  result?: Parameters<typeof analyticsMemoryRepository>[0],
  exporters: Parameters<typeof createAnalyticsService>[2] = [],
) {
  const analytics = analyticsMemoryRepository(result);
  const audit = reportAuditMemoryRepository();
  return {
    analytics,
    audit,
    service: createAnalyticsService(
      analytics.repository,
      audit.repository,
      exporters,
      clock,
    ),
  };
}

async function expectAppError(
  work: Promise<unknown>,
  statusCode: number,
  code: string,
) {
  try {
    await work;
    throw new Error("Expected an AppError.");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode, code });
  }
}

describe("M4 analytics service", () => {
  it("generates and audits a snapshot, resolving a preset against the injected clock", async () => {
    const { service, analytics, audit } = create();
    const run = await service.generate(manager, {
      ...baseFilter,
      from: "2026-01-01",
      to: "2026-10-08",
      preset: "LAST_7_DAYS",
    });

    expect(run.status).toBe("SUCCEEDED");
    expect(run.report?.filters).toMatchObject({
      from: "2026-10-02",
      to: "2026-10-08",
    });
    expect(run.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(audit.insertedRuns[0]).toMatchObject({
      status: "SUCCEEDED",
      requestedBy: manager.id,
      requesterRole: Role.PARK_MANAGER,
      filters: { from: "2026-10-02", to: "2026-10-08" },
      snapshotSha256: run.snapshotSha256,
      createdAt: fixedNow.toISOString(),
    });
    expect(audit.insertedRuns[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(analytics.loadedFilters).toHaveLength(1);
  });

  it("returns EMPTY only when incidents, conflicts and patrol points are all absent", async () => {
    const analyticsResult = {
      sections: reportFixtureSections(),
      hasPatrolPoints: false,
    };
    const { service, audit } = create(analyticsResult);
    const run = await service.generate(manager, {
      ...baseFilter,
      categoryGroup: "OTHER",
      sectorId: randomUUID(),
    });

    expect(run.status).toBe("EMPTY");
    expect(run.report).toBeNull();
    expect(run.snapshotSha256).toBeNull();
    expect(run.suggestions).toEqual([
      "Widen the date range",
      "Choose All categories",
      "Clear the sector filter",
    ]);
    expect([...audit.runs.values()][0].status).toBe("EMPTY");
  });

  it("keeps partial data as a successful report when patrol points exist", async () => {
    const { service } = create({
      sections: reportFixtureSections(),
      hasPatrolPoints: true,
    });
    expect((await service.generate(manager, baseFilter)).status).toBe(
      "SUCCEEDED",
    );
  });

  it("records query timeouts before returning the 504 error", async () => {
    const { service, analytics, audit } = create();
    analytics.setLoadError(
      Object.assign(new Error("cancelled"), { code: "57014" }),
    );

    await expectAppError(
      service.generate(manager, baseFilter),
      504,
      "ANALYTICS_TIMEOUT",
    );
    expect(audit.insertedRuns).toMatchObject([
      {
        status: "TIMED_OUT",
        requestedBy: manager.id,
        errorCode: "ANALYTICS_TIMEOUT",
      },
    ]);
    expect(audit.insertedRuns[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("enforces park access and the pending-researcher state", async () => {
    const { service } = create();
    await expectAppError(
      service.options(manager, OTHER_PARK),
      403,
      "PARK_FORBIDDEN",
    );
    await expectAppError(
      service.options({ ...manager, role: Role.RESEARCHER, parkId: null }),
      403,
      "PARK_ACCESS_PENDING",
    );
    await expectAppError(
      service.options({ ...manager, role: Role.RANGER }),
      403,
      "FORBIDDEN",
    );
  });

  it("hides another researcher's runs while allowing managers to read them", async () => {
    const { service } = create();
    const run = await service.generate(manager, baseFilter);
    const researcher: SessionUser = {
      ...manager,
      id: randomUUID(),
      role: Role.RESEARCHER,
    };

    await expectAppError(
      service.getRun(researcher, run.runId),
      404,
      "REPORT_NOT_FOUND",
    );
    expect((await service.getRun(manager, run.runId)).runId).toBe(run.runId);
    const history = await service.history(researcher, {});
    expect(history.items).toHaveLength(0);
  });

  it("filters report history by inclusive Colombo calendar dates and status", async () => {
    const { service } = create();
    const run = await service.generate(manager, baseFilter);
    const result = await service.history(manager, {
      from: "2026-10-08",
      to: "2026-10-08",
      status: "SUCCEEDED",
    });
    expect(result.items.map((item) => item.id)).toContain(run.runId);
    const outsideRange = await service.history(manager, {
      from: "2026-10-09",
      to: "2026-10-10",
    });
    expect(outsideRange.items).toHaveLength(0);
  });

  it("renders only successful snapshots and audits both export outcomes", async () => {
    const exporter = {
      format: "CSV" as const,
      mimeType: "text/csv",
      extension: "csv",
      async render() {
        return Buffer.from("report,snapshot\n");
      },
    };
    const { service, audit } = create(undefined, [exporter]);
    const run = await service.generate(manager, baseFilter);
    const file = await service.exportRun(manager, run.runId, "CSV");
    expect(file.bytes.toString()).toContain("report,snapshot");
    expect(file.filename).toBe(
      "wana-rakshaka_RPT-YALA-2026-000001_2026-10-01_to_2026-10-08.csv",
    );
    expect(file.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(audit.insertedExports).toMatchObject([
      {
        runId: run.runId,
        requestedBy: manager.id,
        format: "CSV",
        status: "SUCCEEDED",
        byteSize: file.bytes.length,
        fileSha256: file.fileSha256,
      },
    ]);

    const failing = create(undefined, [
      {
        ...exporter,
        format: "PDF",
        extension: "pdf",
        async render() {
          throw new Error("renderer failed");
        },
      },
    ]);
    const failedRun = await failing.service.generate(manager, baseFilter);
    await expectAppError(
      failing.service.exportRun(manager, failedRun.runId, "PDF"),
      500,
      "EXPORT_FAILED",
    );
    expect(failing.audit.insertedExports).toMatchObject([
      { status: "FAILED", errorCode: "EXPORT_FAILED" },
    ]);
    expect(audit.insertedExports).toHaveLength(1);
  });

  it("audits oversized exports and preserves the EXPORT_TOO_LARGE error", async () => {
    const { service, audit } = create(undefined, [
      {
        format: "CSV",
        mimeType: "text/csv",
        extension: "csv",
        async render() {
          throw new AppError(
            "This report is too large to export as CSV.",
            413,
            "EXPORT_TOO_LARGE",
          );
        },
      },
    ]);
    const run = await service.generate(manager, baseFilter);
    await expectAppError(
      service.exportRun(manager, run.runId, "CSV"),
      413,
      "EXPORT_TOO_LARGE",
    );
    expect(audit.insertedExports).toMatchObject([
      {
        status: "FAILED",
        errorCode: "EXPORT_TOO_LARGE",
        byteSize: null,
        fileSha256: null,
      },
    ]);
  });

  it("rejects exports for empty runs", async () => {
    const exporter = {
      format: "CSV" as const,
      mimeType: "text/csv",
      extension: "csv",
      async render() {
        return Buffer.from("report");
      },
    };
    const { service } = create(
      { sections: reportFixtureSections(), hasPatrolPoints: false },
      [exporter],
    );
    const run = await service.generate(manager, baseFilter);
    expect(run.status).toBe("EMPTY");
    await expectAppError(
      service.exportRun(manager, run.runId, "CSV"),
      409,
      "REPORT_NOT_EXPORTABLE",
    );
  });

  it("limits each user to ten exports per five-minute window", async () => {
    const exporter = {
      format: "CSV" as const,
      mimeType: "text/csv",
      extension: "csv",
      async render() {
        return Buffer.from("report");
      },
    };
    const { service } = create(undefined, [exporter]);
    const run = await service.generate(manager, baseFilter);
    for (let count = 0; count < 10; count++)
      await service.exportRun(manager, run.runId, "CSV");
    await expectAppError(
      service.exportRun(manager, run.runId, "CSV"),
      429,
      "EXPORT_RATE_LIMITED",
    );
  });
});
