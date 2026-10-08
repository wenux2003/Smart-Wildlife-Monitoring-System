import { expect, it } from "vitest";
import postgres from "postgres";
import { buildGrid } from "./build-grid.js";
const url = process.env.M4_TEST_DATABASE_URL;
it.skipIf(!url)(
  "rebuilds the metric grid without duplicates and with matching polygon area",
  async () => {
    if (!url) return;
    const parsed = new URL(url);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw Error("Use an isolated local _test database.");
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const [park] = await sql<
        { id: string }[]
      >`SELECT id FROM parks WHERE code='YALA'`;
      expect(park).toBeDefined();
      const rollback = new Error("rollback grid fixture");
      await expect(
        sql.begin(async (tx) => {
          const first = await buildGrid(tx, park.id, 1000),
            second = await buildGrid(tx, park.id, 1000);
          expect(first).toBeGreaterThan(0);
          expect(second).toBe(first);
          const [result] =
            await tx`SELECT count(*)::int n, bool_and(abs(area_m2-ST_Area(geom_m))<0.01) matching FROM analysis_grid_cells WHERE park_id=${park.id} AND cell_size_m=1000`;
          expect(result).toMatchObject({ n: first, matching: true });
          await expect(buildGrid(tx, park.id, 1)).rejects.toThrow("size");
          await expect(
            buildGrid(tx, "11111111-1111-4111-8111-111111111111", 1000),
          ).rejects.toThrow("boundary");
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    } finally {
      await sql.end();
    }
  },
);
