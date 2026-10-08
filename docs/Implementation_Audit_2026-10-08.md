# Implementation audit — M1 to M3 status (2026-10-08)

## Scope and latest review

Updated by Codex on 2026-10-08 after reviewing Copilot's original audit against local commit `ead5e9ddd38b41e33b9d13d55608f21ecee837d0`.

Scope: M1 incident reporting, M2 ranger patrols, and M3 collars, alerts and dispatch. M4 remains excluded. The initial review changed only this audit. The migration follow-up below subsequently restored a missing migration and applied pending database migrations. Findings below distinguish static code evidence, executed checks, and unverified runtime behavior.

**Verdict: not all green or release-ready.** TypeScript passes, but lint fails with 17 errors. M2 is substantially more implemented than the original audit stated. Specific workflow and consistency gaps remain in M2 and M3. Tests and frontend builds were blocked by filesystem access errors in this environment, so their current success or failure is not established.

## 1) Validation performed

The package scripts were invoked through the installed Corepack pnpm JavaScript entry point because the normal shell execution tool failed to initialize.

| Check | Fresh result | Interpretation |
|---|---|---|
| `corepack pnpm typecheck` | PASS, exit 0 | All six workspace packages passed TypeScript checks. |
| `corepack pnpm lint` | FAIL, exit 1 | 17 errors: explicit `any` and unused declarations. |
| `corepack pnpm test` | BLOCKED, exit 1 before tests | esbuild could not load `vitest.config.ts`: parent-directory access denied. No test assertions ran. |
| `corepack pnpm build` | BLOCKED, exit 1 | Ranger and Ops Vite config loading failed with parent-directory access denied. This does not establish an application compilation defect. |
| Fresh DB migration, legacy upgrade, browser E2E | NOT RUN | No isolated test database or browser workflow was exercised. The shared database was not modified. |

Lint errors by file:

| File | Count | Rule |
|---|---:|---|
| [alerts/processor.ts](../apps/api/src/modules/alerts/processor.ts) | 1 | no-explicit-any |
| [alerts/repository.ts](../apps/api/src/modules/alerts/repository.ts) | 7 | no-explicit-any |
| [alerts/routes.ts](../apps/api/src/modules/alerts/routes.ts) | 1 | unused `reply` |
| [alerts/service.ts](../apps/api/src/modules/alerts/service.ts) | 1 | no-explicit-any |
| [AlertCard.tsx](../apps/ops/src/components/AlertCard.tsx) | 2 | no-explicit-any |
| [AlertsMap.tsx](../apps/ops/src/components/AlertsMap.tsx) | 1 | no-explicit-any |
| [MapPolygonDrawer.tsx](../apps/ops/src/components/MapPolygonDrawer.tsx) | 1 | unused `e` |
| [NewZoneModal.tsx](../apps/ops/src/components/NewZoneModal.tsx) | 2 | unused `Severity`, `AlertConfig` |
| [AlertsPage.tsx](../apps/ops/src/pages/AlertsPage.tsx) | 1 | unused `Account` |

### Earlier test report retained for traceability

Copilot reported exit 1 for:

`corepack pnpm vitest run apps/ops/src/pages/CameraReviewPage.test.tsx apps/ops/src/pages/IncidentWorkflow.test.tsx`

The reported missing expectations were “Camera queue unavailable” and “Incident list unavailable”. These are **historical observations, not reproduced by this review**. The current pages contain error-rendering branches and the tests still contain these expectations. Rerun the targeted tests and full suite in an environment where Vite/esbuild can load their configuration before closing or reconfirming them.

## 2) Corrections to the original M2 findings

The original statements that patrols have no durable lifecycle, photos are discarded on unmount, and elapsed time resets do not match the reviewed code.

| Original finding | Corrected assessment and evidence |
|---|---|
| M2-1: start/end are local-only with no server persistence | Start and end update durable Dexie sessions in [offline/index.ts](../packages/offline/src/index.ts). [patrolSync.ts](../apps/ranger/src/lib/patrolSync.ts) sends them to the API; [patrols/repository.ts](../apps/api/src/modules/patrols/repository.ts) transactionally inserts/updates sessions, child records and assignment status. Immediate synchronous server writes are not required for an offline-first lifecycle. |
| M2-2: waypoint image content is not stored | [NewWaypointPage.tsx](../apps/ranger/src/pages/NewWaypointPage.tsx) passes the actual File as `photo`; `addWaypoint` stores it in IndexedDB as a Blob. The remaining problem is server upload, described below. |
| M2-3: elapsed time resets on remount | [PatrolMapPage.tsx](../apps/ranger/src/pages/PatrolMapPage.tsx) restores the session and derives elapsed seconds from persisted `session.startedAt`. |
| M2-4: no durable sync/retry | Dexie persists pending/failed records, bundles are batched, acknowledgements are revision-aware on the client, and [PatrolSyncCoordinator.tsx](../apps/ranger/src/app/PatrolSyncCoordinator.tsx) retries while online. Assignment-list recovery and server ordering still need work. |

Existing tests include [offline/index.test.ts](../packages/offline/src/index.test.ts), [patrolSync.test.ts](../apps/ranger/src/lib/patrolSync.test.ts), and [patrols.test.ts](../apps/api/src/modules/patrols/patrols.test.ts). Their presence supports implementation coverage, but does not imply a fresh passing result.

## 3) Confirmed current-code findings

The following issues are supported by source inspection; the described runtime scenarios still need regression or integration tests.

### High — M3 telemetry accepts requests when its secret is unset

[alerts/routes.ts](../apps/api/src/modules/alerts/routes.ts), around lines 244–254, checks the request header only inside `if (pingSecret)`. There is no production-mode rejection when `PING_SECRET` is absent, and the route has no user authorization guard. The comment saying the route is development-only does not enforce that restriction.

Impact: a deployment with a configured repository and no secret permits unauthenticated telemetry submissions. This review did not inspect deployed environment values or establish that a live deployment is exposed.

Required fix: reject an unset secret outside explicitly allowed development mode, or refuse startup; test absent, incorrect and correct secrets.

### High — M3 alert transitions can reopen resolved alerts

[alerts/service.ts](../apps/api/src/modules/alerts/service.ts) checks park membership for `acknowledgeAlert` and `dispatchRanger`, but does not reject terminal alert states. [alerts/repository.ts](../apps/api/src/modules/alerts/repository.ts), `updateAlertStatus`, updates by ID without a transition predicate.

Trigger: acknowledge a resolved alert, or dispatch another ranger to it. The service can change it back to ACCEPTED or DISPATCHED. The update retains the previous `resolved_at`, producing a nonterminal status with a resolution timestamp.

Required fix: validate legal alert transitions in an atomic database operation and return a conflict for invalid actions.

### High — M3 dispatch transitions and related alert updates are not atomic

[alerts/repository.ts](../apps/api/src/modules/alerts/repository.ts), `updateDispatchStatus`, reads the dispatch, validates the transition, and then updates using only its ID. There is no lock or old-status condition on the update. Concurrent actions can both pass validation against the same old status.

[alerts/service.ts](../apps/api/src/modules/alerts/service.ts) separately writes dispatch status, alert status and cancellation of competing dispatches. Dispatch creation and alert status updates are also separate writes. A failure between writes can leave partial state; concurrent acceptance of competing dispatches is not serialized at the alert level.

Required fix: transactionally enforce the dispatch transition and related alert/competing-dispatch updates, with row locking or conditional updates. Test simultaneous accept/reject, competing accepts, and injected failure between writes.

### Medium — M2 home page cannot resume a server-synchronized ACTIVE patrol

[RangerHomePage](../apps/ranger/src/HomePage.tsx) only makes ASSIGNED cards selectable, and `selectedPatrol` only considers ASSIGNED records. Once synchronization changes the assignment to ACTIVE, returning to the home page provides no resume action for it, even though its local session exists.

Required fix: show a Resume patrol action for an owned ACTIVE session, navigate to its active map, and cover return-to-home and reload scenarios.

### Medium — M2 assignment listing is not persisted for an offline cold start

[patrols.ts](../apps/ranger/src/lib/patrols.ts) fetches assignments only from HTTP, and [main.tsx](../apps/ranger/src/main.tsx) creates a plain in-memory QueryClient. Home reads that query rather than IndexedDB sessions or a durable assignment cache. A saved route snapshot supports restoring an existing patrol by its URL, but does not restore the home assignment list after an offline reload.

Required fix: persist an account-scoped assignment cache and surface recoverable local sessions on home. Test closing and reopening the app offline.

### Medium — M2 waypoint photos are local but never uploaded by patrol sync

[offline/index.ts](../packages/offline/src/index.ts), `getPendingSyncBundles`, serializes `photoName` but omits `photo`. [patrols/repository.ts](../apps/api/src/modules/patrols/repository.ts) stores the filename only. A waypoint can be marked SYNCED while its image exists only on the original device.

Required fix: add durable media upload/retry and server media references; only report photo synchronization complete once the server acknowledges the image. Preserve the existing local Blob behavior.

### Medium — M2 server sync does not reject older session revisions

[patrols/repository.ts](../apps/api/src/modules/patrols/repository.ts), `syncPatrol`, overwrites `status` and `ended_at` on conflict and updates assignment status from the request. It echoes `clientRevision` without using it to reject older data. The client acknowledgement check protects local pending state, but does not protect the server against stale payloads.

Trigger: replay an older ACTIVE payload after a COMPLETED payload for the same session. The SQL permits status to regress to ACTIVE and `ended_at` to become null.

Required fix: enforce monotonic revisions and legal lifecycle transitions server-side. Test completion followed by stale active replay and duplicate delivery.

### Documentation drift

[README.md](../README.md) still groups M1 and M3 as “Not started”, despite their implemented modules and UI. It also marks M2 done without noting the workflow gaps above. Update that status table when the functional fixes and validation are complete. This review leaves README unchanged as requested.

## 4) Module assessment and remaining verification

### M1 — implemented, still needs fresh validation

The incident repository includes legacy review merging, and the Ops incident detail page includes legacy photo fallback. The original audit's positive linkage assessment remains reasonable, but it is not an end-to-end pass.

A dedicated [legacy upgrade test](../apps/api/src/modules/incidents/upgrade.test.ts) already exists and is skipped unless `M1_UPGRADE_TEST_DATABASE_URL` is configured. Run it on a fresh isolated local PostGIS database, then verify report/list/detail/review and legacy media rendering in the UI. Do not use the shared team database for the upgrade test.

### M2 — durable offline capture and server synchronization implemented, workflow gaps remain

The lifecycle, Blob storage, persisted timer, batching and retry mechanisms exist. Prioritize resume/offline-home behavior, photo upload, and stale-update protection rather than rebuilding the whole offline layer.

### M3 — UI/API linkage exists, concrete consistency and intake issues remain

Ranger dispatch URLs align with the backend routes. Park checks and dispatch ownership checks exist on reviewed paths, but this is not proof of complete authorization coverage. The telemetry guard and state-transition problems in section 3 require fixes, followed by HTTP-schema, cross-park, cross-ranger, timeout, concurrent-dispatch and clean-database tests. No dedicated alerts-module test file was found in `apps/api/src/modules/alerts` during this review.

## 5) Recommended order

1. Fix the 17 lint errors so the quality gate can pass.
2. Close the M3 missing-secret path and make alert/dispatch transitions atomic and terminal-state aware.
3. Fix M2 resume/offline-home behavior, media synchronization and server revision checks.
4. Rerun the two historically failing Ops tests, the complete test suite, typecheck, lint and production builds in a working execution environment.
5. Run isolated PostGIS migration/upgrade and integration tests, then browser checks for M1–M3 including offline restart and reconnect.

The project has substantial working implementation, but a full “all good” claim is not supported by the current evidence.

## 6) Migration follow-up — 2026-10-08

At the user's request, checked the configured database and applied pending migrations. This supersedes the initial review's statement that the shared database was not modified; fresh isolated-database and browser tests remain unperformed.

- **Fixed repository gap:** restored [0006_incidents.sql](../apps/api/drizzle/0006_incidents.sql) unchanged from Git commit `fbf2892`. It had been removed in later history despite `0008_incident_workflow.sql` depending on its `incidents` table, and incident detail querying `incident_reviews`. The configured database already recorded this migration and contained both tables, so restoration did not recreate or overwrite their data.
- **Applied:** `0006_alerts_extensions.sql` creates `camera_traps` and `ranger_locations` and adds `alerts.resolution_reason` and `alerts.is_broadcast`. These tables/fields were absent before this run.
- **Applied:** `0007_relax_alert_dispatches_index.sql` changes the unique open-dispatch index to cover ACCEPTED/ARRIVED, allowing multiple PENDING broadcast offers.
- **Verified:** no pending repository migrations; every table declared by the repository migration files exists in public schema; both new alert columns and the expected dispatch index predicate exist. A second migration run exited 0 with “Database schema is already up to date.”
- **Limit:** this verifies the configured database upgrade, not a fresh-database migration test or resolution of the lint/workflow issues above. No seed, account reset, or data deletion was performed.
