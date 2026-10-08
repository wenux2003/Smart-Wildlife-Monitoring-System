# M4 — Conservation analytics and export

Owner: Wenura Kavinda. Definitions and phases: [M4 plan](../../../../../docs/M4_Analytics_and_Export_Plan.md).

Run migrations and the account seed on a dedicated development database before `corepack pnpm db:seed:analytics`. Remote targets require `--confirm-shared-db` and team agreement. Production is rejected. The seed sends no SMS or HTTP requests.

Fixtures use a separate UUID-v5 namespace and fixed 2026-10-08 anchor. Yala: 180 incidents, 60 patrols, 40 breaches. Wilpattu and Sinharaja: 45/15/10 each. Each park has two diagnostic alerts. Repeating the seed adds no duplicates. `--remove` removes its operational fixtures; reference sectors/grid/configuration remain because saved reports may refer to them. Existing boundaries and analytics settings are preserved.

PDF and CSV exports render the audited report snapshot through one registered strategy per format. CSV output is bounded at 5,000 data rows and PDF output at 12 pages; oversized files fail instead of truncating. The PDF footer carries the snapshot hash, while the completed PDF byte hash is returned in `X-Report-Sha256` and stored in the export audit. Reports retain a synthetic-demo provenance flag from the park configuration for accurate PDF labeling.

Boundaries are simple synthetic rectangles, not official park boundaries. Five interior sectors and four boundary bands per park are demonstration areas. M4 data is separate from `db:seed:demo`; combining them increases counts.

Grid calculations use EPSG:32644, retain the largest clipped polygon, and discard <5% slivers. Stored area matches retained geometry; the denominator is the retained analysis grid, not official park area. Builds reject more than 20,000 estimated cells and run within the caller transaction.

Domain checks: `corepack pnpm vitest run --config vitest.m4-domain.config.ts --coverage`. Database tests require `M4_TEST_DATABASE_URL` pointing to an isolated local database ending in `_test`, with migrations and account seed applied. Never use the shared database.
