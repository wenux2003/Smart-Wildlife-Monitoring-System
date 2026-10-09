import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import postgres from "postgres";
import { seedAnalytics } from "./seed.js";
const url = process.env.M4_TEST_DATABASE_URL;
it.skipIf(!url)(
  "seeds twice with stable counts and source variety",
  async () => {
    if (!url) return;
    const parsed = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw Error("Use an isolated local _test database.");
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    const counts = async () =>
      sql`SELECT (SELECT count(*)::int FROM incidents) incidents,(SELECT count(*)::int FROM patrol_sessions) sessions,(SELECT count(*)::int FROM alerts) alerts,(SELECT count(*)::int FROM analysis_grid_cells) cells`;
    try {
      await seedAnalytics(url);
      const first = await counts();
      await seedAnalytics(url);
      expect(await counts()).toEqual(first);
      expect(first[0]).toMatchObject({
        incidents: 270,
        sessions: 90,
        alerts: 66,
      });
      const [q] =
        await sql`SELECT count(DISTINCT source)::int sources,count(*) FILTER(WHERE location_status='UNRESOLVED')::int unresolved FROM incidents`;
      const settings =
        await sql`SELECT code,(config->'analytics'->>'gridCellMeters')::int grid,(config->'analytics'->>'trackBufferMeters')::int buffer FROM parks WHERE code IN('YALA','SINHARAJA','WILPATTU') ORDER BY code`;
      expect(settings).toEqual([
        { code: "SINHARAJA", grid: 500, buffer: 25 },
        { code: "WILPATTU", grid: 1000, buffer: 50 },
        { code: "YALA", grid: 1000, buffer: 75 },
      ]);
      expect(q.sources).toBe(3);
      expect(q.unresolved).toBeGreaterThan(0);
    } finally {
      await sql.end();
    }
  },
  30000,
);

it.skipIf(!url)(
  "removes only namespaced fixtures and retains configuration, grids and unrelated incidents",
  async () => {
    if (!url) return;
    const parsed = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw Error("Use isolated local _test DB");
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    const id = randomUUID();
    try {
      const [park] = await sql`SELECT id FROM parks WHERE code='YALA'`;
      const reference =
        await sql`SELECT id,config,ST_AsText(boundary) boundary FROM parks ORDER BY id`;
      const [grid] =
        await sql`SELECT count(*)::int count FROM analysis_grid_cells`;
      await sql`INSERT INTO incidents(id,park_id,type,status,description,source,location_status,captured_at) VALUES(${id},${park.id},'OTHER','NEW','Unrelated fixture','COMMUNITY','UNRESOLVED','2026-10-08T12:00:00Z')`;
      await seedAnalytics(url, true);
      expect(await sql`SELECT id FROM incidents`).toEqual([{ id }]);
      expect(
        (await sql`SELECT count(*)::int count FROM patrol_sessions`)[0].count,
      ).toBe(0);
      expect((await sql`SELECT count(*)::int count FROM alerts`)[0].count).toBe(
        0,
      );
      expect(
        await sql`SELECT id,config,ST_AsText(boundary) boundary FROM parks ORDER BY id`,
      ).toEqual(reference);
      expect(
        (await sql`SELECT count(*)::int count FROM analysis_grid_cells`)[0],
      ).toEqual(grid);
    } finally {
      await sql`DELETE FROM incidents WHERE id=${id}`;
      await seedAnalytics(url);
      await sql.end();
    }
  },
  30000,
);
