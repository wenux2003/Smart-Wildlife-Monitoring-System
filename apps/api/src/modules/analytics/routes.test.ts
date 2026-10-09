import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Role } from "@wr/shared";
import { createServer } from "../../server.js";
import { memoryRepository } from "../auth/testing.js";
import { tokenHash } from "../auth/security.js";
import {
  analyticsMemoryRepository,
  reportAuditMemoryRepository,
  TEST_PARK,
} from "./testing.js";
import type { ReportExporter } from "./types.js";

const fixedNow = new Date("2026-10-08T12:00:00.000Z");
const clock = { now: () => new Date(fixedNow) };
const validFilter = {
  parkId: TEST_PARK,
  from: "2026-10-01",
  to: "2026-10-08",
  preset: "CUSTOM",
};
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function setup(exporters?: readonly ReportExporter[]) {
  const auth = memoryRepository();
  const analytics = analyticsMemoryRepository();
  const audit = reportAuditMemoryRepository();
  const server = createServer({
    repository: auth.repository,
    analyticsRepository: analytics.repository,
    reportAuditRepository: audit.repository,
    analyticsExporters: exporters,
    clock,
  });
  servers.push(server);
  function session(role: Role, parkId: string | null = TEST_PARK) {
    const id = randomUUID();
    auth.users.set(id, {
      id,
      name: "Analytics test user",
      email: `${id}@example.org`,
      password_hash: "unused",
      role,
      park_id: parkId,
      park_name: "Yala",
      disabled_at: null,
      must_change_password: false,
    });
    const token = randomUUID().replaceAll("-", "").repeat(2);
    auth.sessions.set(tokenHash(token), {
      id,
      expires: new Date(fixedNow.getTime() + 60_000),
    });
    return { cookie: `wr_session=${token}`, id };
  }
  const call = (
    method: "GET" | "POST",
    path: string,
    payload?: object,
    cookie?: string,
    origin?: string,
  ) =>
    server.inject({
      method,
      url: `/api${path}`,
      payload,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
    });
  return { server, call, session, audit };
}

describe("M4 analytics routes", () => {
  it("registers the CSV and PDF exporters on the real API composition root", async () => {
    const s = setup();
    const session = s.session(Role.PARK_MANAGER);
    const generated = await s.call(
      "POST",
      "/reports/runs",
      validFilter,
      session.cookie,
    );
    const run = generated.json();

    const csv = await s.call(
      "POST",
      `/reports/runs/${run.runId}/exports`,
      { format: "CSV" },
      session.cookie,
      "http://localhost:5173",
    );
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.payload).toContain("report_code,section,dimension");
    expect(csv.headers["x-report-sha256"]).toMatch(/^[a-f0-9]{64}$/);

    const pdf = await s.call(
      "POST",
      `/reports/runs/${run.runId}/exports`,
      { format: "PDF" },
      session.cookie,
      "http://localhost:5173",
    );
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.headers["x-report-sha256"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("serves options, a generated run, reload, export and scoped history", async () => {
    const exporter: ReportExporter = {
      format: "CSV",
      mimeType: "text/csv",
      extension: "csv",
      async render() {
        return Buffer.from("snapshot");
      },
    };
    const s = setup([exporter]);
    const session = s.session(Role.PARK_MANAGER);

    const options = await s.call(
      "GET",
      "/analytics/options",
      undefined,
      session.cookie,
    );
    expect(options.statusCode).toBe(200);
    expect(options.headers["cache-control"]).toBe("no-store");
    expect(options.json().allowedParks[0].id).toBe(TEST_PARK);

    const generated = await s.call(
      "POST",
      "/reports/runs",
      validFilter,
      session.cookie,
    );
    expect(generated.statusCode).toBe(201);
    expect(generated.headers["cache-control"]).toBe("no-store");
    const run = generated.json();
    expect(run.status).toBe("SUCCEEDED");
    expect(JSON.stringify(run.report)).not.toMatch(
      /reporterPhone|reporterName|description|reporter_id/,
    );

    const reload = await s.call(
      "GET",
      `/reports/runs/${run.runId}`,
      undefined,
      session.cookie,
    );
    expect(reload.statusCode).toBe(200);
    expect(reload.json().snapshotSha256).toBe(run.snapshotSha256);

    const exported = await s.call(
      "POST",
      `/reports/runs/${run.runId}/exports`,
      { format: "CSV" },
      session.cookie,
      "http://localhost:5173",
    );
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-disposition"]).toContain(".csv");
    expect(exported.headers["x-report-sha256"]).toMatch(/^[a-f0-9]{64}$/);
    expect(exported.payload).toBe("snapshot");

    const history = await s.call(
      "GET",
      "/reports/runs?page=1&pageSize=10",
      undefined,
      session.cookie,
    );
    expect(history.statusCode).toBe(200);
    expect(history.json().items[0].exports).toHaveLength(1);
  });

  it("rejects unauthorized roles, cross-park filters and invalid bodies", async () => {
    const s = setup();
    for (const role of [Role.RANGER, Role.LIAISON_OFFICER, Role.SUPER_ADMIN]) {
      const nonAnalyticsUser = s.session(role);
      expect(
        (
          await s.call(
            "GET",
            "/analytics/options",
            undefined,
            nonAnalyticsUser.cookie,
          )
        ).statusCode,
      ).toBe(403);
    }

    const manager = s.session(Role.PARK_MANAGER);
    expect(
      (
        await s.call(
          "POST",
          "/reports/runs",
          { ...validFilter, parkId: randomUUID() },
          manager.cookie,
        )
      ).json(),
    ).toMatchObject({ code: "PARK_FORBIDDEN" });
    const invalid = await s.call(
      "POST",
      "/reports/runs",
      { ...validFilter, types: ["NOT_A_CATEGORY"] },
      manager.cookie,
    );
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().code).toBe("VALIDATION_FAILED");
  });

  it("allows researchers to generate and reload only their own park-scoped runs", async () => {
    const s = setup();
    const manager = s.session(Role.PARK_MANAGER);
    const researcher = s.session(Role.RESEARCHER);
    const managerRun = await s.call(
      "POST",
      "/reports/runs",
      validFilter,
      manager.cookie,
    );
    const researcherRun = await s.call(
      "POST",
      "/reports/runs",
      validFilter,
      researcher.cookie,
    );
    expect(managerRun.statusCode).toBe(201);
    expect(researcherRun.statusCode).toBe(201);
    const managerRunId = managerRun.json().runId;
    const researcherRunId = researcherRun.json().runId;

    const own = await s.call(
      "GET",
      `/reports/runs/${researcherRunId}`,
      undefined,
      researcher.cookie,
    );
    const other = await s.call(
      "GET",
      `/reports/runs/${managerRunId}`,
      undefined,
      researcher.cookie,
    );
    const history = await s.call(
      "GET",
      "/reports/runs",
      undefined,
      researcher.cookie,
    );
    expect(own.statusCode).toBe(200);
    expect(other.statusCode).toBe(404);
    expect(history.json().items.map((item: { id: string }) => item.id)).toEqual(
      [researcherRunId],
    );
  });

  it("returns park-access-pending for an unassigned researcher", async () => {
    const s = setup();
    const researcher = s.session(Role.RESEARCHER, null);
    const response = await s.call(
      "GET",
      "/analytics/options",
      undefined,
      researcher.cookie,
    );
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("PARK_ACCESS_PENDING");
  });

  it("checks same-origin POST requests and exposes unavailable configuration", async () => {
    vi.stubEnv("APP_ORIGINS", "http://trusted.test");
    const configured = setup();
    const manager = configured.session(Role.PARK_MANAGER);
    const blocked = await configured.call(
      "POST",
      "/reports/runs",
      validFilter,
      manager.cookie,
      "http://attacker.test",
    );
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe("ORIGIN_FORBIDDEN");

    const auth = memoryRepository();
    vi.stubEnv("DATABASE_URL", "");
    const unavailable = createServer({
      repository: auth.repository,
      clock,
    });
    servers.push(unavailable);
    const id = randomUUID();
    auth.users.set(id, {
      id,
      name: "Manager",
      email: `${id}@example.org`,
      password_hash: "unused",
      role: Role.PARK_MANAGER,
      park_id: TEST_PARK,
      disabled_at: null,
      must_change_password: false,
    });
    const token = randomUUID().replaceAll("-", "").repeat(2);
    auth.sessions.set(tokenHash(token), {
      id,
      expires: new Date(fixedNow.getTime() + 60_000),
    });
    const response = await unavailable.inject({
      method: "GET",
      url: "/api/analytics/options",
      headers: { cookie: `wr_session=${token}` },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe("ANALYTICS_UNAVAILABLE");
  });
});
