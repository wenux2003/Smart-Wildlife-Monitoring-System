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
      expect(q.sources).toBe(3);
      expect(q.unresolved).toBeGreaterThan(0);
    } finally {
      await sql.end();
    }
  },
  30000,
);
