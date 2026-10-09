# Spatial configuration diagnosis and fix — 2026-10-09

The user's blank hotspot map was traced to missing spatial configuration in Neon. The checked Yala snapshot contains 35 incidents, 33 located and two without resolved locations, but no boundary, grid cells or sectors. No shared database writes were performed. [Aggregate diagnosis](./diagnosis.json) contains no incident coordinates or personal data.

The API now counts outside-boundary incidents using `ST_Covers(park.boundary, incident.location)`, independently of grid membership. A missing boundary cannot establish that an incident is outside. Existing snapshots remain immutable; the map suppresses their legacy outside count when no boundary was saved.

The map shows a setup notice, disables unavailable layers and avoids misleading zero-cell summaries. Direct map/gap/conflict entry now loads analytics CSS through the common subpage layout. A configured park still renders the existing overlays.

Validation:
- M4 suite: 18 files / 129 tests passed including seven isolated Docker/PostGIS cases. [Primary coverage](./coverage-summary.json): 96.93% lines/statements, 92.17% branches, 93.06% functions.
- SQL suite: four files / seven tests passed. [Separate SQL coverage](./database-coverage-summary.json): 98.68% lines/statements, 89.42% branches, 100% functions. The new fixture checks no boundary and a boundary without a grid, using a temporary park that is removed afterward.
- Workspace typecheck and lint pass. Production Ops build passes without a bundle warning (main 236.83 kB; largest 383.37 kB).
- [Browser checks](./browser-checks.json): direct map route, synthetic unconfigured legacy snapshot, desktop 1440 and mobile 390; styled notice, disabled layers, no false outside/zero summary, no page overflow, no uncaught exceptions, no generation requests. Both screenshots were reviewed. This browser fixture is synthetic, not the user's live Neon report.
- [Desktop screenshot](./missing-configuration-desktop.png), [mobile screenshot](./missing-configuration-mobile.png).

Remaining setup: configure an appropriate park boundary and matching analysis grid in Neon, then create a fresh analytics run. The existing demo analytics seed can supply approximate geometry and namespaced fixtures, but its remote guard explicitly requires `--confirm-shared-db` and team agreement. Running it adds demo incidents, patrols and alerts and affects shared counts; it was not run on Neon. Production spatial work needs validated park geometry. Saved reports keep their original snapshots.
