# Implementation Plan: Wildlife Guardian (Group 037)

Covers both web apps and the backend they share:

- **Ranger App**: separate mobile-first installable PWA, offline-first app; routes start at `/`
- **Ops Dashboard**: separate desktop web app for Park Manager, Liaison Officer and Researcher; routes start at `/`
- **API + DB + simulators**: shared by both

Everything below is free and open source. Auth is out of scope (mock "Acting as" user switcher).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) everywhere |
| Monorepo | pnpm workspaces |
| Ranger app | React 18 + Vite + TypeScript + React Router + Tailwind CSS |
| Ops app | React 18 + Vite + TypeScript + React Router + Tailwind CSS |
| Shared UI | `packages/ui`: common React components, Leaflet map wrapper, layout primitives, theme tokens |
| State/data fetching | TanStack Query (server state) + Zustand (small UI state) |
| Forms/validation | React Hook Form + Zod (schemas shared with API) |
| Ranger PWA/offline | Ranger-only vite-plugin-pwa (Workbox) + `packages/offline` (Dexie.js, IndexedDB, outbox sync) |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles, leaflet.heat |
| Charts | Recharts |
| API | Node 20 + Fastify + Zod (fastify-type-provider-zod) |
| DB | PostgreSQL 16 + PostGIS |
| ORM/migrations | Drizzle ORM + drizzle-kit |
| Realtime | Server-Sent Events (SSE) |
| PDF/CSV | pdfmake, fast-csv |
| Tests | Vitest, @vitest/coverage-v8, Testing Library, Supertest, fake-indexeddb |
| Quality | ESLint, Prettier, Husky + lint-staged |
| CI | GitHub Actions |
| Dev env | Docker Compose (`db`, `api`, `ranger`, `ops`) |

---

## 2. Repository layout

```
wana-rakshaka/
├─ apps/
│  ├─ api/                     # Node + Fastify + Zod + Drizzle
│  ├─ ranger/                  # mobile-first PWA (port 5173)
│  │  ├─ index.html
│  │  ├─ vite.config.ts        # Ranger-only PWA plugin
│  │  └─ src/
│  └─ ops/                     # desktop dashboard (port 5174; no PWA/offline code)
│     ├─ index.html
│     ├─ vite.config.ts
│     └─ src/
├─ packages/
│  ├─ shared/                  # enums, Zod schemas, DTO types, geo helpers
│  │  └─ src/{enums,schemas,geo,index}.ts
│  ├─ ui/                      # shared React components and theme
│  │  └─ src/index.ts
│  └─ offline/                 # Dexie, outbox sync, connectivity, ranger hooks
│     └─ src/index.ts
├─ tools/
│  ├─ seed/
│  ├─ collar-simulator/
│  ├─ sms-gateway-mock/
│  └─ camera-trap-feeder/
├─ .github/workflows/ci.yml
├─ docker-compose.yml
├─ package.json                # workspace scripts and shared tooling
└─ pnpm-workspace.yaml
```

The starter files establish the workspace, API health route, separate app
shells, shared packages, local PostGIS service, and CI workflow. The domain
modules and simulator folders are reserved for the implementation phases below.
Inside each API module, use `routes.ts` → `service.ts` → `repository.ts`, with
`schemas.ts` and `*.test.ts` alongside. Services receive repositories through
constructor injection, so unit tests use in-memory fakes.

---

## 3. Phase 0: Foundation (Day 1, done once, then everyone branches)

1. Init pnpm monorepo, TS configs/project paths, ESLint/Prettier, Husky, Vitest workspace.
2. `docker-compose.yml`: `db` (`postgis/postgis:16`), api, ranger, ops. Env via `.env.example`.
3. `packages/shared`: enums and schemas (below); `packages/ui`: shared component entry point.
4. DB schema + first migration (section 4) and seed script.
5. API core: Fastify bootstrap, error handler (typed `AppError`), request validation, health route, `EventBus` (typed pub/sub), `SseHub` (`GET /api/stream`), injectable `Clock`.
6. Two independent React/Vite shells: Ranger at port 5173 and Ops at port 5174; both use root-relative routes and retain the "Acting as" user switcher.
7. **Offline package** (`packages/offline`), built once and used by the Ranger app for M1 and M2 (section 6); Ops does not depend on it.
8. CI: lint, typecheck, test with coverage on every PR.

**Exit criteria:** `docker compose up` shows both apps and the API, seeded data loads, CI is green, the offline package has tests.

### Shared enums (packages/shared)

```
Role: RANGER | PARK_MANAGER | LIAISON_OFFICER | RESEARCHER
IncidentSource: RANGER | COMMUNITY | CAMERA_TRAP
IncidentStatus: NEW | VERIFIED | IN_PROGRESS | RESOLVED | REJECTED
Severity: LOW | MEDIUM | HIGH | CRITICAL
SyncStatus (client): PENDING | SYNCING | SYNCED | FAILED
PatrolStatus: ASSIGNED | ACTIVE | COMPLETED | PARTIAL | CANCELLED
AlertStatus: NEW | DISPATCHED | ACCEPTED | ON_SCENE | RESOLVED | CANCELLED | AUTO_RESOLVED
DispatchStatus: PENDING | ACCEPTED | REJECTED | TIMED_OUT | ARRIVED | DONE
AlertType: GEOFENCE_BREACH | IMMOBILITY | SIGNAL_LOST | LOW_BATTERY
ZoneKind: PARK_BOUNDARY | HIGH_RISK (farmland/road/village) | BUFFER
```

---

## 4. Database (PostgreSQL + PostGIS)

| Table | Key columns |
|---|---|
| `parks` | id, name, terrain, config jsonb |
| `zones` | id, park_id, name, kind, geom (Polygon, 4326) |
| `species` | id, name, scientific_name, at_risk |
| `park_species` | park_id, species_id |
| `incident_types` | id, park_id, code, label, icon, default_severity, requires_photo |
| `users` | id, name, role, park_id, phone |
| `incidents` | id (client UUID), source, type_id, park_id, species_id?, severity, status, description, geom (Point), gps_accuracy_m, location_manual bool, reporter_id?, reporter_phone?, camera_id?, captured_at, received_at |
| `incident_media` | id, incident_id, path, mime, size_bytes |
| `patrol_routes` | id, park_id, name, geom (LineString), est_km |
| `patrol_assignments` | id, route_id, ranger_id, assigned_by, status, assigned_at |
| `patrol_sessions` | id (client UUID), assignment_id, status, started_at, ended_at, distance_km, coverage_pct, ended_early bool |
| `track_points` | id, session_id, geom, accuracy_m, recorded_at |
| `waypoints` | id, session_id, geom, type, note, photo_path?, recorded_at |
| `grid_cells` | id, park_id, geom (Polygon), size_m |
| `cell_coverage` | cell_id, session_id, covered_at |
| `collars` | id, animal_name, species_id, park_id, battery_pct, last_ping_at, status |
| `collar_pings` | id, collar_id, geom, speed_kmh, recorded_at |
| `alerts` | id, type, severity, status, collar_id?, geom, zone_id?, created_at, resolved_at |
| `dispatches` | id, alert_id, ranger_id, status, sent_at, responded_at, notes |
| `camera_traps` | id, park_id, geom, name, last_upload_at |
| `camera_images` | id, camera_id, path, captured_at, species_id?, has_person bool, reviewed_by? |
| `report_audit` | id, user_id, filters jsonb, created_at |

Indexes: GiST on every `geom`; B-tree on `incidents(park_id, captured_at)`, `alerts(status)`, `collar_pings(collar_id, recorded_at)`.

Client-generated UUIDs for `incidents` and `patrol_sessions` make sync idempotent (upsert on id).

---

## 5. API surface (REST + SSE)

Base `/api`. All inputs validated with the shared Zod schemas. Errors: `{ code, message, details? }`.

### Reference (shared)
```
GET  /parks                      GET /parks/:id/config   (types, species, zones)
GET  /users?role=                GET /rangers/nearby?lat&lng&limit
GET  /stream                     (SSE: alert.*, incident.*, patrol.*, dispatch.*)
```

### M1 Incidents
```
POST  /incidents                 (idempotent upsert by client id; multipart for photo or JSON + /media)
POST  /incidents/:id/media
GET   /incidents?park&status&source&from&to&type
GET   /incidents/:id
PATCH /incidents/:id/status      (NEW→VERIFIED→IN_PROGRESS→RESOLVED / REJECTED)
POST  /community/sms             (called by sms-gateway-mock: raw text + phone)
POST  /community/reports         (basic app form)
GET   /camera-images?camera&reviewed
PATCH /camera-images/:id/review  (species / person present → may create incident)
```

### M2 Patrols
```
GET   /patrol-routes?park
POST  /patrol-assignments        (manager; 409 if ranger already ACTIVE)
PATCH /patrol-assignments/:id    (reassign before start)
GET   /patrol-assignments/mine   (ranger)
POST  /patrol-sessions/sync      (batch: session + track points + waypoints, idempotent)
GET   /patrol-sessions?park&from&to
GET   /patrol-sessions/:id
GET   /coverage?park&from&to     (grid cells + last-covered time + neglected flag)
```

### M3 Alerts
```
POST  /collar-pings              (from simulator; batch allowed)
GET   /collars        GET /collars/:id
GET   /alerts?status&park        GET /alerts/:id (collar, history, nearest settlement, nearest rangers, camera images)
POST  /alerts/:id/dispatch       { rangerId }
POST  /dispatches/:id/respond    { action: ACCEPT | REJECT }
POST  /dispatches/:id/progress   { action: ARRIVED | RESOLVE, notes, photo? }
POST  /alerts/:id/cancel         (false positive)
POST  /alerts/:id/broadcast      (no ranger available escalation)
```

### M4 Analytics
```
GET  /analytics/summary?park&from&to&category      (KPIs)
GET  /analytics/trend?...&bucket=month
GET  /analytics/breakdown?...                       (type × sector table, paginated)
GET  /analytics/hotspots?...                        (grid density → cells/points)
GET  /analytics/patrol-gaps?...
GET  /analytics/conflict-trends?...                 (by month, boundary stretch, repeat sites, response time)
POST /reports/export  { filters, format: PDF|CSV }  (logs to report_audit, returns file)
GET  /reports/audit
```

---

## 6. Offline package (`packages/offline`): Ranger app only

Used by `apps/ranger` only. The Ops Dashboard has no offline package dependency or offline code.

- **Dexie DB:** tables `incidents`, `media` (blobs), `sessions`, `trackPoints`, `waypoints`, `outbox`.
- **Outbox item:** `{ id, kind, payloadRef, status, attempts, nextAttemptAt, lastError }`.
- **Enqueue** on every write, **flush** triggered by: `window 'online'` event, app start, a 15 s interval while pending items exist, manual "Sync now".
- **Backoff:** 2 s → 4 s → … max 5 min. After 8 failures → `FAILED` (shown in UI, user can retry).
- **Idempotency:** server upserts by client UUID, so retries are safe.
- **Photos:** compressed client-side (canvas, max 1280 px, JPEG 0.7) before storing and uploading.
- **Connectivity:** `navigator.onLine` plus a lightweight `/health` probe (because "online" can still mean no route).
- **Crash recovery:** active session state is written to IndexedDB on every track point, so reopening the app restores it.
- **Storage failure:** catch `QuotaExceededError` → keep form on screen, offer "submit without photo".
- **Exposed hooks:** `useSyncStatus()` (pending count, last sync, online), `useOutbox()`.
- **Service worker:** precache app shell; runtime-cache map tiles (cache-first, capped) and `/parks/:id/config`.

Tests: fake-indexeddb for enqueue/flush/backoff/idempotency/failure paths.

---

## 7. Ranger App (mobile PWA; routes start at `/`)

Design rules: single-hand use, ≥48 px touch targets, high-contrast "sunlight" theme (plus dark), icon plus text (never colour only), persistent sync badge in the header, confirmations on destructive actions, Sri Lankan sample data (Yala/Wilpattu/Udawalawe).

### Screens and routes

| Route | Screen | Owner |
|---|---|---|
| `/` | Home: today's patrol card, "Report incident" FAB, alerts badge, sync badge | shared |
| `/incidents` | My incidents list (status chips: Queued / Synced / Failed) | M1 |
| `/incidents/new` | Step 1 type → Step 2 evidence (photo, species, GPS) → Step 3 details/severity → Step 4 review/submit | M1 |
| `/incidents/:id` | Detail | M1 |
| `/patrol` | Assigned routes/patrol home | M2 |
| `/patrol/active` | Live map, elapsed/distance, Add waypoint, End patrol | M2 |
| `/patrol/waypoint` | New waypoint sheet | M2 |
| `/patrol/summary` | Summary + submit/sync status | M2 |
| `/alerts/:dispatchId` | Urgent alert: Accept / Reject | M3 |
| `/alerts/:dispatchId/active` | On the way → Arrived → Resolve form (action taken, notes, photo) | M3 |
| `/community/new` | Basic community report form (also usable by villagers) | M1 |

### Key behaviours
- **Geolocation hook** `useGps()`: `watchPosition`, accuracy, error state; "manual location" fallback (tap on map).
- **Dev GPS simulator:** a toggle that replays a GPX-style path from the assigned route, so patrol/tracking can be demoed on a desktop.
- **Alerts to rangers:** SSE `dispatch.created` for this ranger → full-screen modal with sound and vibration (`navigator.vibrate`).
- **Offline banners:** "No signal · recording locally" in header; every submit screen shows "Saved on device. Will sync automatically".

---

## 8. Ops Dashboard (separate desktop web app; routes start at `/`)

Design rules: left sidebar nav, KPI-first layouts, map plus list split views, accessible colour palette (colour-blind safe), empty/loading/error states on every panel, keyboard-friendly tables.

### Screens and routes

| Route | Screen | Owner |
|---|---|---|
| `/` | Overview: live map (rangers, collars, alerts, incidents), KPI strip, recent activity (SSE) | shared |
| `/incidents` | Table + map filter by status/source/type/park | M1 |
| `/incidents/:id` | Detail, photo, change status, duplicate/nearby reports | M1 |
| `/camera-traps` | Image review queue (identify species / person) | M1 |
| `/conflicts` | Community/conflict inbox (liaison): assign response, close with outcome | M1 |
| `/patrols` | Assignments: assign route to ranger, status board | M2 |
| `/patrols/coverage` | Coverage map (covered / stale / neglected cells), filters | M2 |
| `/patrols/:id` | Session replay: track, waypoints, stats | M2 |
| `/alerts` | Alert feed (SSE) + live map | M3 |
| `/alerts/:id` | Detail: collar telemetry, camera images, nearest rangers, Dispatch / Cancel / Broadcast, timeline | M3 |
| `/collars` | Collar list: battery, last ping, signal lost | M3 |
| `/analytics` | Filters, KPI cards, trend chart, breakdown table, hotspot/heatmap toggle, patrol gaps | M4 |
| `/analytics/conflicts` | Conflict trends: monthly, top stretches, repeat sites, response time | M4 |
| `/reports` | Export (PDF/CSV) and audit history | M4 |

Park selector in the top bar (Yala ↔ Sinharaja ↔ Wilpattu) switches config-driven content everywhere (incident types, species, zones). This is the "system flexibility" demo.

---

## 9. Module implementation specs

### M1: Incidents (API + both apps)
**Services:** `IncidentService` (create/upsert, validate, transition), `IncidentFactory` (build by source), `SmsParser`, `DuplicateDetector` (same type within 200 m / 2 h → flag), `CameraReviewService`.
**Rules:**
- Required: type, description, location (auto or manual), timestamp. Photo required only if `incident_types.requires_photo`.
- Allowed status transitions in a table; others → 409.
- SMS format: `<KEYWORD> <free text location/landmark>` (e.g., `ELEPHANT near Kelegama junction`); unknown keyword → reply asking for a valid keyword (mock gateway returns the reply text); missing location → follow-up prompt.
- Camera review with `has_person = true` → auto-creates `CAMERA_TRAP` incident at HIGH severity.
**Tests:** validators, factory per source, SMS parser (valid, unknown keyword, empty, noisy), transitions (legal/illegal), duplicate detector, upsert idempotency, sync outbox integration, UI form validation and offline submit path.

### M2: Patrols
**Services:** `AssignmentService` (conflict check), `SessionSyncService` (idempotent batch ingest), `CoverageCalculator` (distance via haversine; buffered track vs grid cells, default 50 m), `NeglectService` (cells not covered within N days from park config).
**Client:** `PatrolRecorder` state machine (`ASSIGNED→ACTIVE→COMPLETED|PARTIAL`), samples GPS every 10 s or 15 m, writes each point to IndexedDB, restores on reopen, low-battery listener (`navigator.getBattery` if available) triggers a save and warns the user.
**Tests:** haversine, coverage maths (empty track, single point, duplicate points, off-route), state transitions, assignment conflict, partial completion, batch idempotency, recorder with fake clock and fake geolocation.

### M3: Alerts and collars
**Services:** `PingProcessor` (stores ping, updates collar, runs rules), `GeofenceEvaluator` (PostGIS `ST_Intersects` with HIGH_RISK zones; strategy interface so it can be swapped for Turf), `RuleEngine` (breach, immobility = < 50 m moved in 2 h, low battery < 15%, signal lost = no ping > 6 h), `AlertStateMachine`, `DispatchService`, `NearestRangerFinder` (`ST_Distance` on latest ranger positions from active sessions), `TimeoutScheduler` (ranger didn't respond in 2 min → `TIMED_OUT`, alert back to manager).
**Behaviour:**
- Debounce: one open alert per collar per type.
- Animal returns to the safe zone → `AUTO_RESOLVED`, notify dispatched ranger.
- Reject → "Dispatch failed – reassign" event.
- No ranger within radius → severity CRITICAL, offer broadcast.
- Camera images within 1 km in the last 6 h are attached to the alert detail.
**Events (EventBus → SSE):** `alert.created/updated`, `dispatch.created/updated`.
**Tests:** geofence in/out/edge on the boundary, each rule threshold (below/at/above), full state machine matrix (legal and illegal), debounce, nearest ranger ordering, timeout with fake timers, auto-resolve, event emission.

### M4: Analytics
**Services:** `SummaryService`, `TrendService`, `HotspotService` (Strategy: `GridDensityStrategy` default; interface allows other algorithms), `PatrolGapService`, `ConflictTrendService` (monthly counts, per boundary stretch, repeat sites ≥ 3 in 90 days, mean response time), `ReportExporter` (Strategy: `PdfExporter`, `CsvExporter`), `AuditLogger`.
**Rules:**
- Filters validated (date range ≤ 2 years, park exists). No data → structured `NO_RECORDS` response (UI shows a prompt to widen the range).
- Query timeout → `503 RETRY` with filters preserved on the client.
- Export failure keeps the on-screen report (the export is a separate request).
- Each generated report/export writes `report_audit`.
**Tests:** aggregation maths with small fixtures, bucket edges (month boundaries, timezone Asia/Colombo), hotspot cell ranking, repeat-site logic, exporters (content assertions on CSV; PDF smoke test of generated buffer), empty/timeout/error paths, audit logging.

---

## 10. Simulators (mock IoT / SMS)

| Tool | Behaviour |
|---|---|
| `collar-simulator` | CLI: `pnpm sim:collar --scenario breach|immobile|signal-lost|normal`. Moves an elephant along a scripted path toward farmland and POSTs pings every few seconds. |
| `sms-gateway-mock` | Small web page plus CLI to "send an SMS" to the API; shows the auto-reply. Demonstrates the short-code channel with no real SMS service. |
| `camera-trap-feeder` | Uploads sample images (free-licence wildlife photos, placeholder files in repo) for random cameras, with an optional "person detected" flag. |
| `seed` | Reference data (3 parks, zones, species, incident types per park), 6+ months of incidents/patrols/conflicts with realistic spatial clusters and a visible trend, 8 collars, 6 rangers. |

---

## 11. Testing strategy

- **Target:** ≥ 80% line and branch coverage per module (enforced per package in `vitest.config.ts` thresholds), measured in CI.
- **Unit (bulk):** services with fake repositories, pure functions (geo, parsers, calculators), state machines, outbox.
- **API integration (a few per module):** Supertest against a test DB (Docker Postgres); one happy path and one failure path per endpoint group.
- **UI:** Testing Library for forms, validation messages, offline/online banners, and role-restricted screens. No heavy E2E needed. Optionally one Playwright smoke test of the demo flow.
- **Conventions:** Arrange-Act-Assert, descriptive names (`should reject dispatch when ranger already on scene`), no shared mutable state, fake clock for time-based logic.
- **Per-test-case checklist per module:** positive / negative / edge / error, as the rubric asks.

---

## 12. Code quality rules

- Strict TS, no `any`; ESLint with `@typescript-eslint` recommended + `import/no-cycle`.
- SOLID by construction: services depend on interfaces (`IncidentRepository`), adapters for external things, strategies for variable algorithms.
- Small functions (< 30 lines), no duplicated logic across modules (shared goes in `packages/shared`).
- Comment the *why*, and JSDoc public service methods.
- Conventional Commits; PRs reviewed by one teammate; squash-merge.
- Config and magic numbers (thresholds, radii, timeouts) live in park config or named constants, not inline.

---

## 13. Timeline (implementation only)

| Day | Date | Work |
|---|---|---|
| 1 | Sun 4 Oct | Phase 0: monorepo, DB, shared types/UI, API core, separate Ranger/Ops shells, Ranger offline package, seed, CI |
| 2 | Mon 5 Oct | Each member: API endpoints + services for own module, ranger/ops screens (happy path) |
| 3 | Tue 6 Oct | Alternate/exception flows, offline behaviours, simulators wired, tests to ≥ 60% |
| 4 | Wed 7 Oct | Cross-module integration (live SSE, shared map, seed data), UI polish, tests ≥ 80%, **feature freeze** |
| 5 | Thu 8 Oct | Bug fixes only, README/run instructions, capture screenshots, final coverage report |
| 6 | Fri 9 Oct | Final check on a clean clone (`docker compose up`), tag `v1.0-submission`, **no commits after submitting** |

---

## 14. Demo script (use this to verify everything works end to end)

1. Switch park to **Yala**, then **Sinharaja**: incident types and species change (flexibility).
2. Manager assigns a route in Ops → Ranger app shows the assignment.
3. Ranger starts patrol (GPS simulator), toggles **Offline**, adds a waypoint, reports a **snare incident** with a photo → sees "Saved on device".
4. Ranger goes **Online** → outbox flushes → incident and patrol appear in Ops in real time.
5. Run `sim:collar --scenario breach` → alert appears on the dashboard (SSE) with the camera images → manager dispatches the nearest ranger → ranger accepts, arrives, resolves.
6. Villager SMS `ELEPHANT near Kelegama` through the mock gateway → conflict inbox → liaison closes with outcome notes.
7. Analytics: filter Wilpattu / 6 months / Snares → KPIs, hotspots, patrol gaps, conflict trends → export PDF/CSV.

---

## 15. Definition of Done (per module)

- [ ] All main, alternate and exception flows from the (improved) use case scenario implemented
- [ ] Ranger and/or Ops screens match the group-report wireframes
- [ ] API validated, errors typed, SSE events emitted where specified
- [ ] Offline behaviour verified manually (DevTools → Offline) where applicable
- [ ] ≥ 80% coverage on the module, CI green
- [ ] No lint/type errors; README section for the module (how to run, how to demo)
- [ ] Merged to `main` via PR; included in the `v1.0-submission` tag
