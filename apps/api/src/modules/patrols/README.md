# Patrols (M2)

The patrol foundation follows `docs/Group037_Implementation_Plan.md`:

- `patrol_routes` stores park-scoped, versioned route definitions and PostGIS geometry.
- `patrol_assignments` connects a route/version to a ranger and manager.
- `patrol_sessions` stores lifecycle and calculated distance/coverage results.
- `GET /api/patrol-assignments/mine` returns only the signed-in Ranger's assignments in their park.

Apply `apps/api/drizzle/0004_patrols.sql` with `corepack pnpm db:migrate`.
After the normal account seed, `corepack pnpm db:seed:patrols` safely adds
deterministic Yala demo routes and assignments for `ranger1.yala@example.org`.
The patrol seed does not change accounts or passwords and is safe to repeat.

Start/end, GPS ingest, waypoints, offline packs and synchronization remain later
steps in the M2 implementation plan.
