# Patrols (M2)

The patrol foundation follows `docs/Group037_Implementation_Plan.md`:

- `patrol_routes` stores park-scoped, versioned route definitions and PostGIS geometry.
- `patrol_assignments` connects a route/version to a ranger and manager.
- `patrol_sessions` stores lifecycle and calculated distance/coverage results.
- `patrol_gps_points` and `patrol_waypoints` store idempotent client records.
- `GET /api/patrol-assignments/mine` returns only the signed-in Ranger's assignments in their park.
- `POST /api/patrol-sessions/sync` validates ownership and atomically upserts a
  session plus batched GPS points and waypoints.

Apply the patrol migrations with `corepack pnpm db:migrate`.
After the normal account seed, `corepack pnpm db:seed:patrols` safely adds
deterministic Yala demo routes and assignments for `ranger1.yala@example.org`.
The patrol seed does not change accounts or passwords and is safe to repeat.

Offline packs and server-calculated coverage remain later M2 steps. Patrol
start/end, GPS capture, manual waypoints and automatic retry synchronization are
implemented through the Ranger IndexedDB outbox.
