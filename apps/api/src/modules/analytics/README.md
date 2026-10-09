# M4 — Conservation analytics and export

Owner: Wenura Kavinda. Definitions and phases: [M4 plan](../../../../../docs/M4_Analytics_and_Export_Plan.md).

Run migrations and the account seed on a dedicated development database before `corepack pnpm db:seed:analytics`. Remote targets require `--confirm-shared-db` and team agreement. Production is rejected. The seed sends no SMS or HTTP requests.

Fixtures use a separate UUID-v5 namespace and fixed 2026-10-08 anchor. Yala: 180 incidents, 60 patrols, 40 breaches. Wilpattu and Sinharaja: 45/15/10 each. Each park has two diagnostic alerts. Repeating the seed adds no duplicates. `--remove` removes its operational fixtures; reference sectors/grid/configuration remain because saved reports may refer to them. Existing boundaries and analytics settings are preserved.

PDF and CSV exports render the audited report snapshot through one registered strategy per format. CSV output is bounded at 5,000 data rows and PDF output at 12 pages; oversized files fail instead of truncating. The PDF footer carries the snapshot hash, while the completed PDF byte hash is returned in `X-Report-Sha256` and stored in the export audit. Reports retain a synthetic-demo provenance flag from the park configuration for accurate PDF labeling.

Boundaries are simple synthetic rectangles, not official park boundaries. Five interior sectors and four boundary bands per park are demonstration areas. M4 data is separate from `db:seed:demo`; combining them increases counts.

Grid calculations use EPSG:32644, retain the largest clipped polygon, and discard <5% slivers. Stored area matches retained geometry; the denominator is the retained analysis grid, not official park area. Builds reject more than 20,000 estimated cells and run within the caller transaction.

Domain checks: `corepack pnpm vitest run --config vitest.m4-domain.config.ts --coverage`. Database tests require `M4_TEST_DATABASE_URL` pointing to an isolated local database ending in `_test`, with migrations and account seed applied. Never use the shared database.

P0–P9 are complete for this module's academic-prototype scope. [P9 evidence](../../../../../docs/evidence/m4/README.md) records 114 M4 tests, separate isolated SQL coverage, browser screenshots, real export checks and review limits. The Ops bundle-size warning is resolved through lazy feature routes. Optional Tier 2 response-time/repeat-site features remain deferred.

Implemented API (all under `/api`): `GET /analytics/options`, `POST /reports/runs`, `GET /reports/runs/:runId`, `POST /reports/runs/:runId/exports`, `GET /reports/runs`. Generation stores an immutable aggregate snapshot; exports only render it. Park Managers see own-park history; Researchers see their own runs in their currently assigned park. Revoked park access is checked again when opening/exporting. Other roles have no access. No reporter contacts, incident descriptions, or individual GPS tracks are returned.

Metric/timezone/grid definitions and exception behaviors are in the [plan §4–§9](../../../../../docs/M4_Analytics_and_Export_Plan.md). Ops pages include overview, hotspot map, patrol gaps, conflict trends and report history; maps/charts have table alternatives, keyboard focus and reduced-motion behavior.

Checks: `corepack pnpm test:m4:coverage` enforces 85% lines/statements/branches/functions. With an isolated seeded database and `M4_TEST_DATABASE_URL`, `corepack pnpm test:m4:db` reports spatial SQL separately. Grid construction is the transactional `grid/build-grid.ts` service used by the analytics seed; no standalone grid CLI is registered. CI provisions and seeds its own PostGIS test database. [Traceability](../../../../../docs/traceability.md) maps all 26 flows to passing tests.

The 9 October follow-up adds the `TODAY` preset and automatic Ops updates: Today in Colombo by default, 400 ms edit coalescing, preserved saved snapshots and optional Refresh analytics. [Current evidence](../../../../../docs/evidence/m4/automatic-analytics/README.md) records 128 passing M4 tests and updated coverage. No SQL schema change is required.
