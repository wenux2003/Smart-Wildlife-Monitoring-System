import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import postgres from "postgres";
import { createAnalyticsRepository } from "./repository.js";
import { normalizeFilter } from "./domain/filter.js";
import { buildGrid } from "./grid/build-grid.js";
const url = process.env.M4_TEST_DATABASE_URL;
it.skipIf(!url)(
  "handles cell-edge ties, Colombo midnight, unresolved and outside locations",
  async () => {
    if (!url) return;
    const u = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(u.hostname) ||
      !u.pathname.endsWith("_test")
    )
      throw Error("Use isolated local _test DB");
    const sql = postgres(url, { max: 1 }),
      repo = createAnalyticsRepository(url);
    const parkId = randomUUID();
    try {
      await sql`INSERT INTO parks(id,code,name,boundary) VALUES(${parkId},${"T" + parkId.slice(0, 8).toUpperCase()},'Spatial test',ST_Multi(ST_Transform(ST_MakeEnvelope(540000,710000,543000,713000,32644),4326)))`;
      await sql.begin((tx) => buildGrid(tx, parkId, 1000));
      const insert = async (
        time: string,
        x: number | null,
        y: number | null,
        unresolved = false,
      ) =>
        sql`INSERT INTO incidents(id,park_id,type,status,description,source,location_status,location,captured_at) VALUES(${randomUUID()},${parkId},'POACHING','NEW','private description','RANGER',${unresolved ? "UNRESOLVED" : "MANUAL"},${x === null ? sql`NULL` : sql`ST_Transform(ST_SetSRID(ST_MakePoint(${x},${y}),32644),4326)`},${time})`;
      await insert("2026-01-01T18:30:00Z", 541000, 711000); // four-cell corner, counted once
      await insert("2026-01-02T18:29:59.999Z", 540500, 710500);
      await insert("2026-01-02T18:30:00Z", 540500, 710500); // next day excluded
      await insert("2026-01-02T12:00:00Z", null, null, true);
      await insert("2026-01-02T12:00:00Z", 540500, 710500, true);
      await insert("2026-01-02T12:00:00Z", 550000, 720000);
      await sql`UPDATE incidents SET reported_at='2026-03-01T00:00:00Z' WHERE park_id=${parkId}`;
      const now = new Date("2026-01-03T00:00:00Z");
      const r = await repo.load(
        normalizeFilter(
          { parkId, from: "2026-01-02", to: "2026-01-02" },
          { now: () => now },
        ),
        now,
      );
      expect(r.hasPatrolPoints).toBe(false);
      expect(r.sections.kpis.totalIncidents).toBe(5);
      expect(r.sections.dataQuality.excludedNoLocation).toBe(2);
      expect(r.sections.dataQuality.outsideBoundary).toBe(1);
      expect(r.sections.hotspots.cells.reduce((n, c) => n + c.count, 0)).toBe(
        2,
      );
      expect(r.sections.patrolGaps.cells).toHaveLength(9);
      expect(r.sections.patrolGaps.parkAreaKm2).toBeCloseTo(9, 5);
      expect(r.sections.patrolGaps.gapAreaKm2).toBeCloseTo(9, 5);
      const ranger = randomUUID(),
        route = randomUUID(),
        assignment = randomUUID(),
        session = randomUUID();
      await sql`INSERT INTO auth_users(id,name,email,password_hash,role,park_id) VALUES(${ranger},'Fixture ranger',${ranger + "@example.org"},'not-a-real-password-hash','RANGER',${parkId})`;
      await sql`INSERT INTO patrol_routes(id,park_id,code,name,sector,estimated_distance_m) VALUES(${route},${parkId},'TEST','Test','Test',1000)`;
      await sql`INSERT INTO patrol_assignments(id,route_id,route_version,ranger_id,assigned_by,status) VALUES(${assignment},${route},1,${ranger},${ranger},'COMPLETED')`;
      await sql`INSERT INTO patrol_sessions(id,assignment_id,status,started_at,ended_at) VALUES(${session},${assignment},'COMPLETED','2026-01-02T00:00:00Z','2026-01-02T04:00:00Z')`;
      for (const [x, y, time, accuracy] of [
        [540500, 710500, "00:00:00", 5],
        [540900, 710500, "00:01:00", 5],
        [542500, 712500, "02:00:00", 5],
        [542600, 712500, "02:01:00", 400],
      ] as const)
        await sql`INSERT INTO patrol_gps_points(client_record_id,session_id,position,accuracy_m,recorded_at) VALUES(${randomUUID()},${session},ST_Transform(ST_SetSRID(ST_MakePoint(${x},${y}),32644),4326),${accuracy},${"2026-01-02T" + time + "Z"})`;
      // One-point sessions are unusable; duplicate valid tracks must not double-count area.
      for (const points of [1, 2]) {
        const extraSession = randomUUID(),
          extraAssignment = randomUUID();
        await sql`INSERT INTO patrol_assignments(id,route_id,route_version,ranger_id,assigned_by,status) VALUES(${extraAssignment},${route},1,${ranger},${ranger},'COMPLETED')`;
        await sql`INSERT INTO patrol_sessions(id,assignment_id,status,started_at,ended_at) VALUES(${extraSession},${extraAssignment},'COMPLETED','2026-01-02T00:00:00Z','2026-01-02T01:00:00Z')`;
        for (let point = 0; point < points; point++)
          await sql`INSERT INTO patrol_gps_points(client_record_id,session_id,position,accuracy_m,recorded_at) VALUES(${randomUUID()},${extraSession},ST_Transform(ST_SetSRID(ST_MakePoint(${540500 + point * 400},710500),32644),4326),5,${"2026-01-02T00:0" + point + ":00Z"})`;
      }
      const tracked = await repo.load(
        normalizeFilter(
          { parkId, from: "2026-01-02", to: "2026-01-02" },
          { now: () => now },
        ),
        now,
      );
      expect(tracked.hasPatrolPoints).toBe(true);
      expect(tracked.sections.dataQuality.droppedGpsPoints).toBe(1);
      expect(tracked.sections.dataQuality.sessionsWithoutTrack).toBe(1);
      expect(tracked.sections.patrolGaps.coveredAreaKm2).toBeCloseTo(1, 5);
      const error = new Error("rollback timeout");
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL statement_timeout='1ms'`;
          try {
            await tx`SELECT pg_sleep(0.02)`;
          } catch (e) {
            expect((e as { code: string }).code).toBe("57014");
            throw error;
          }
        }),
      ).rejects.toBe(error);
    } finally {
      await sql`DELETE FROM incidents WHERE park_id=${parkId}`;
      await sql`DELETE FROM patrol_sessions WHERE assignment_id IN(SELECT a.id FROM patrol_assignments a JOIN patrol_routes r ON r.id=a.route_id WHERE r.park_id=${parkId})`;
      await sql`DELETE FROM patrol_assignments WHERE route_id IN(SELECT id FROM patrol_routes WHERE park_id=${parkId})`;
      await sql`DELETE FROM patrol_routes WHERE park_id=${parkId}`;
      await sql`DELETE FROM auth_users WHERE park_id=${parkId}`;
      await sql`DELETE FROM parks WHERE id=${parkId}`;
      await repo.close?.();
      await sql.end();
    }
  },
);

it.skipIf(!url)(
  "separates conflict sources and assigns overlapping stretches and nearby settlements once",
  async () => {
    if (!url) return;
    const parsed = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw Error("Use isolated local _test DB");
    const sql = postgres(url, { max: 1 });
    const repo = createAnalyticsRepository(url);
    const park = randomUUID(),
      collar = randomUUID();
    const stretches = [randomUUID(), randomUUID()].sort();
    try {
      await sql`INSERT INTO parks(id,code,name,boundary) VALUES(${park},${"T" + park.slice(0, 8).toUpperCase()},'Conflict fixture',ST_Multi(ST_MakeEnvelope(81.40,6.40,81.42,6.42,4326)))`;
      for (const [index, id] of stretches.entries())
        await sql`INSERT INTO analysis_sectors(id,park_id,code,name,kind,area) VALUES(${id},${park},${"ST" + index},${"Stretch " + index},'BOUNDARY_STRETCH',ST_Multi(ST_MakeEnvelope(81.40,6.40,81.42,6.42,4326)))`;
      for (const source of ["COMMUNITY", "RANGER"])
        await sql`INSERT INTO incidents(id,park_id,type,status,description,source,location_status,location,captured_at) VALUES(${randomUUID()},${park},'CROP_DAMAGE','NEW','PRIVATE_DESCRIPTION',${source},'MANUAL',ST_SetSRID(ST_MakePoint(81.41,6.41),4326),'2026-01-02T12:00:00Z')`;
      await sql`INSERT INTO collars(id,park_id,animal_name,species,status) VALUES(${collar},${park},'Fixture elephant','Elephant','ACTIVE')`;
      for (const type of ["GEOFENCE_BREACH", "LOW_BATTERY"])
        await sql`INSERT INTO alerts(id,park_id,collar_id,type,severity,status,location,created_at) VALUES(${randomUUID()},${park},${collar},${type},'HIGH','NEW',ST_SetSRID(ST_MakePoint(81.41,6.41),4326),'2026-01-02T12:00:00Z')`;
      await sql`INSERT INTO alerts(id,park_id,collar_id,type,severity,status,location,created_at) VALUES(${randomUUID()},${park},${collar},'GEOFENCE_BREACH','HIGH','NEW',NULL,'2026-01-02T12:00:00Z')`;
      await sql`INSERT INTO settlements(id,park_id,name,location) VALUES(${randomUUID()},${park},'Nearby fixture',ST_SetSRID(ST_MakePoint(81.41,6.41),4326)),(${randomUUID()},${park},'Far fixture',ST_SetSRID(ST_MakePoint(81.8,6.8),4326))`;
      const now = new Date("2026-01-03T00:00:00Z");
      const result = await repo.load(
        normalizeFilter(
          {
            parkId: park,
            from: "2026-01-02",
            to: "2026-01-02",
            categoryGroup: "HUMAN_WILDLIFE_CONFLICT",
          },
          { now: () => now },
        ),
        now,
      );
      expect(result.sections.conflicts.series[0]).toMatchObject({
        communityReports: 1,
        rangerReported: 1,
        collarBreaches: 2,
      });
      expect(result.sections.conflicts.byStretch).toHaveLength(1);
      expect(result.sections.conflicts.byStretch[0]).toMatchObject({
        stretchId: stretches[0],
        communityReports: 1,
        collarBreaches: 1,
      });
      expect(result.sections.dataQuality.alertsWithoutLocation).toBe(1);
      expect(
        result.sections.spatialContext.settlements.find(
          (s) => s.name === "Nearby fixture",
        )?.nearestStretchId,
      ).toBe(stretches[0]);
      expect(
        result.sections.spatialContext.settlements.find(
          (s) => s.name === "Far fixture",
        )?.nearestStretchId,
      ).toBeNull();
    } finally {
      await sql`DELETE FROM incidents WHERE park_id=${park}`;
      await sql`DELETE FROM alerts WHERE park_id=${park}`;
      await sql`DELETE FROM collars WHERE park_id=${park}`;
      await sql`DELETE FROM settlements WHERE park_id=${park}`;
      await sql`DELETE FROM analysis_sectors WHERE park_id=${park}`;
      await sql`DELETE FROM parks WHERE id=${park}`;
      await repo.close?.();
      await sql.end();
    }
  },
);

it.skipIf(!url)(
  "does not classify unmapped incidents as outside a missing boundary or grid",
  async () => {
    if (!url) return;
    const target = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      !target.pathname.endsWith("_test")
    )
      throw Error("Use isolated local _test DB");
    const sql = postgres(url, { max: 1 });
    const repo = createAnalyticsRepository(url);
    const parkId = randomUUID();
    try {
      await sql`INSERT INTO parks(id,code,name) VALUES(${parkId},${"T" + parkId.slice(0, 8).toUpperCase()},'Unconfigured spatial fixture')`;
      for (const [longitude, latitude] of [
        [81.41, 6.41],
        [82, 7],
      ])
        await sql`INSERT INTO incidents(id,park_id,type,status,description,source,location_status,location,captured_at) VALUES(${randomUUID()},${parkId},'POACHING','NEW','Synthetic fixture','RANGER','MANUAL',ST_SetSRID(ST_MakePoint(${longitude},${latitude}),4326),'2026-01-02T12:00:00Z')`;
      const now = new Date("2026-01-03T00:00:00Z");
      const filter = normalizeFilter(
        { parkId, from: "2026-01-02", to: "2026-01-02" },
        { now: () => now },
      );
      const missingBoundary = await repo.load(filter, now);
      expect(missingBoundary.sections.kpis.totalIncidents).toBe(2);
      expect(missingBoundary.sections.dataQuality.outsideBoundary).toBe(0);
      expect(missingBoundary.sections.patrolGaps.configured).toBe(false);
      expect(missingBoundary.sections.kpis.patrolGapAreaKm2).toBeNull();
      await sql`UPDATE parks SET boundary=ST_Multi(ST_MakeEnvelope(81.40,6.40,81.42,6.42,4326)) WHERE id=${parkId}`;
      const boundaryWithoutGrid = await repo.load(filter, now);
      expect(boundaryWithoutGrid.sections.dataQuality.outsideBoundary).toBe(1);
      expect(boundaryWithoutGrid.sections.patrolGaps.configured).toBe(false);
      expect(boundaryWithoutGrid.sections.hotspots.cells).toHaveLength(0);
    } finally {
      await sql`DELETE FROM incidents WHERE park_id=${parkId}`;
      await sql`DELETE FROM parks WHERE id=${parkId}`;
      await repo.close?.();
      await sql.end();
    }
  },
);
