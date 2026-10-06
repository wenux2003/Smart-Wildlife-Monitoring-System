import type postgres from "postgres";

export class PatrolSeedError extends Error {}

const routes = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    code: "YALA_TRAIL_4B",
    name: "Trail 4B",
    sector: "Southern Ridge",
    description: "Southern ridge boundary and watering-point patrol.",
    distanceM: 4200,
    geometry: "LINESTRING(81.516 6.372,81.523 6.365,81.531 6.359)",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    code: "YALA_TRAIL_4C",
    name: "Trail 4C",
    sector: "Southern Ridge",
    description: "Extended southern ridge and boundary-fence patrol.",
    distanceM: 4700,
    geometry: "LINESTRING(81.508 6.379,81.516 6.371,81.526 6.366)",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    code: "YALA_TRAIL_3A",
    name: "Trail 3A",
    sector: "Palatupana Corridor",
    description: "Wildlife corridor observation and boundary patrol.",
    distanceM: 3800,
    geometry: "LINESTRING(81.501 6.383,81.509 6.378,81.516 6.374)",
  },
] as const;

/** Adds deterministic patrol demo data without changing accounts or passwords. */
export async function seedPatrolDemo(sql: postgres.Sql) {
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(37003)`;
    const [park] = await tx`SELECT id FROM parks WHERE code = 'YALA'`;
    const [manager] = await tx`
      SELECT id FROM auth_users
      WHERE email = 'manager.yala@example.org' AND role = 'PARK_MANAGER'`;
    const [ranger] = await tx`
      SELECT id FROM auth_users
      WHERE email = 'ranger1.yala@example.org' AND role = 'RANGER'`;
    if (!park || !manager || !ranger)
      throw new PatrolSeedError(
        "Yala demo accounts are missing. Run corepack pnpm db:seed first.",
      );

    for (const route of routes) {
      await tx`
        INSERT INTO patrol_routes
          (id, park_id, code, name, sector, description, route_geometry,
           estimated_distance_m, version, active)
        VALUES
          (${route.id}, ${park.id}, ${route.code}, ${route.name}, ${route.sector},
           ${route.description}, ST_GeomFromText(${route.geometry}, 4326),
           ${route.distanceM}, 1, true)
        ON CONFLICT (id) DO UPDATE SET
          park_id = EXCLUDED.park_id,
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          sector = EXCLUDED.sector,
          description = EXCLUDED.description,
          route_geometry = EXCLUDED.route_geometry,
          estimated_distance_m = EXCLUDED.estimated_distance_m,
          active = true`;
    }

    await tx`
      INSERT INTO patrol_assignments
        (id, route_id, route_version, ranger_id, assigned_by, status, assigned_at)
      VALUES
        ('50000000-0000-4000-8000-000000000001', ${routes[0].id}, 1,
         ${ranger.id}, ${manager.id}, 'ASSIGNED', now() - interval '20 minutes'),
        ('50000000-0000-4000-8000-000000000002', ${routes[1].id}, 1,
         ${ranger.id}, ${manager.id}, 'ASSIGNED', now() - interval '35 minutes'),
        ('50000000-0000-4000-8000-000000000003', ${routes[2].id}, 1,
         ${ranger.id}, ${manager.id}, 'COMPLETED', now() - interval '1 day 3 hours')
      ON CONFLICT (id) DO NOTHING`;

    await tx`
      INSERT INTO patrol_sessions
        (id, assignment_id, status, started_at, ended_at, distance_m, coverage_percent)
      VALUES
        ('60000000-0000-4000-8000-000000000001',
         '50000000-0000-4000-8000-000000000003', 'COMPLETED',
         now() - interval '1 day 2 hours 15 minutes', now() - interval '1 day',
         3820, 100)
      ON CONFLICT (id) DO NOTHING`;

    return { routes: routes.length, assignments: 3, ranger: "ranger1.yala@example.org" };
  });
}
