# Implementation Plan: Wildlife Guardian (Group 037)

**Revised: 5 October 2026 | Submission deadline: 9 October 2026, 11:59 PM (Asia/Colombo)**

This is a development contract, not a statement of completed functionality. The reviewed repository has app/API shells, shared-package starters and a CI workflow; domain modules, migrations/seed, synchronization and simulators remain to be completed. Coverage enforcement is not yet configured.

[Group037_Assignment02_Plan.md](./Group037_Assignment02_Plan.md) defines assessment requirements, corrected critique IDs C1-C12, scope and report traceability. Preserve Group 039's four use cases and relevant original flows, with explicit justification for changes. Group PDFs are fallible designs, not technical authorities.

## 1. Existing architecture and compatible additions

The repository is the authority for code placement and package boundaries. Extend the existing modular Fastify application and two React apps; do not scaffold replacement apps, split business modules into services, add another database, or turn every named responsibility below into a new package/class. Feature requirements remain, but proposed endpoints/entities below are not evidence of existing implementation.

### Verified repository baseline

| Existing location | What exists now | Where the next work belongs |
|---|---|---|
| `apps/api/src/index.ts`, `server.ts` | Process entry point, `createServer()`, Fastify/Zod compilers and `/health` | Register module routes in `createServer()`; keep startup in `index.ts` and preserve health tests |
| `apps/api/src/core/` | `config.ts`, `errors.ts` (`AppError`), `clock.ts` (`Clock`/`systemClock`) | Extend these; add DB/error mapping/event infrastructure here only as needed |
| `apps/api/src/modules/reference/` | Reserved parks/zones/species/types/seeded-users module | Reference/config/user lookup routes and repositories; do not create a separate reference app |
| `apps/api/src/modules/incidents/`, `patrols/`, `alerts/`, `analytics/` | Reserved domain modules with README boundaries | Implement M1-M4 within these folders; community/camera logic stays in incidents, collar/dispatch logic in alerts |
| `apps/api/drizzle/` | Reserved schema/migration directory | Put Drizzle schema/migrations here; add migration tooling/config when implementing persistence |
| `apps/ranger/src/app/App.tsx`, `HomePage.tsx`, `src/lib/` | Router/home shell; reserved Ranger helpers | Add mobile feature screens and routes to this app; client hooks/API adapters may live in `src/lib/` |
| `apps/ops/src/app/App.tsx`, `DashboardPage.tsx` | Separate router/dashboard shell | Add operations screens and routes here; no Ranger offline dependency |
| `packages/shared/src/` | `Role`, `IncidentStatus`, `Coordinates`, health Zod schema and barrel exports | Extend current files/exports compatibly; do not create a second contracts package |
| `packages/offline/` | Dexie dependency, empty public entry point; no React dependency | Put framework-independent DB/outbox logic here; keep React hooks in Ranger unless a deliberate dependency change is made |
| `packages/ui/` | React peer dependency, Leaflet/react-leaflet dependencies, empty public entry point | Shared presentational/map components here; do not import API repositories or Ranger offline code |
| `tools/*` | Four reserved script folders, no package manifests | Plain scripts launched through documented root/API commands; they are not currently pnpm workspace packages |
| Root workspace/Compose | `apps/*` and `packages/*`; services `db`, `api`, `ranger`, `ops` | Keep names/ports and existing `@wr/*` imports; no extra worker/broker/container required |

The following table separates existing dependencies from additions. Manifest presence does not prove installation or version compatibility; validate the existing dependency set before changing it.

| Concern | Direction |
|---|---|
| Workspace | TypeScript, pnpm workspaces |
| Ranger | Separate React/Vite mobile PWA; root-relative routes; port 5173 |
| Ops | Separate React/Vite desktop dashboard; root-relative routes; port 5174 |
| UI | React Router, Tailwind, shared components; React Hook Form/Zod; TanStack Query; small UI state as needed |
| Offline | Ranger-only Dexie/IndexedDB outbox and Workbox app shell |
| Maps/charts | Leaflet/react-leaflet, heatmap layer, Recharts |
| API | Fastify + Zod; explicit services/repositories and injectable clock |
| Database | PostgreSQL/PostGIS with Drizzle migrations |
| Updates | Planned in-process SSE support in the existing API, plus client refetch/recovery; not yet implemented |
| Export | Planned API-local PDF exporter (pdfmake is a candidate, not installed); CSV may use a small tested serializer rather than another package |
| Verification | Vitest exists; Ranger has Testing Library/jsdom. Add compatible coverage-v8 and fake-indexeddb where needed; reuse Fastify injection for API tests rather than requiring Supertest |
| Tooling | Existing ESLint/Prettier, GitHub Actions and Docker Compose |

Use compatible pinned versions and a committed lockfile when installing dependencies; validate the existing Docker/runtime setup instead of treating a version written in a plan as proof it works. Auth is outside the assessed scope: seeded "Acting as" switcher for Ranger/Manager/Liaison/Researcher. Validate role, park and ownership for demo operations on the server; this switcher is not production authentication.

```text
apps/api/src/core/                       config, DB, errors, clock, event bus, SSE
apps/api/src/server.ts                   existing createServer and route registration
apps/api/src/index.ts                    existing process startup
apps/api/src/modules/reference/          parks, configuration and demo users
apps/api/src/modules/{incidents,patrols,alerts,analytics}/
apps/api/drizzle/                        reserved schema and migrations
apps/ranger/                            mobile PWA
apps/ops/                               desktop dashboard
packages/shared/                        DTOs, schemas, enums, geo helpers
packages/ui/                            common components
packages/offline/                       Ranger persistence/outbox
tools/{seed,collar-simulator,sms-gateway-mock,camera-trap-feeder}/
docs/                                   planned scenarios, diagrams, traceability, AI log
```

Within each reserved API module, use routes -> business logic -> repository as appropriate. A small module can use functions; class-per-service is not required. Reuse the existing Clock and AppError rather than duplicating them. Public DTOs/validation belong in @wr/shared; server-only repositories and database types remain in the API. Preserve current Role/IncidentStatus names and values.

Keep the existing shared Coordinates shape `{ latitude, longitude }` in TypeScript contracts. Convert explicitly to GeoJSON/PostGIS `[longitude, latitude]` at the spatial adapter boundary. Do not replace the public shape with tuple coordinates throughout the apps.

Compose supplies DATABASE_URL, but core/config.ts currently parses only API_HOST/API_PORT. Extend that configuration when adding the postgres/Drizzle client. The existing API uses postgres, not a pg Pool; do not introduce a second database driver without a concrete need. Run stale-collar scans and dispatch timers within the existing API lifecycle with shutdown cleanup and injectable clocks; no separate scheduler service is needed.

Browser-to-API transport still needs implementation: neither Vite config currently defines an API proxy. Prefer relative `/api` and `/health` requests with a development proxy in both apps, configured to reach localhost:3000 on the host and api:3000 from their Compose containers. Keep the browser URL relative; the Docker service name is not a browser hostname. Route SSE through the same transport. Document the production routing separately if deployment is added.

PWA plugin configuration already exists in Ranger. Extend its caching/readiness behavior instead of adding another service worker. Ops remains a normal web app. Leaflet lives in @wr/ui; expose the shared map there so Ops need not import an undeclared map dependency directly. A heatmap plugin, PDF library, drizzle-kit, coverage provider and offline test helper are proposed additions, not existing installed capabilities.

## 2. Scope, ownership and foundation

M1 owns incidents/community/camera review; M2 patrols/coverage; M3 collars/alerts/dispatch; M4 analytics/exports. Actual names/registration numbers still need recording. Proposed shared leads: M2 offline with M1 reviewing media sync, M3 event integration, M4 seed/data contracts. Name a report assembler and release coordinator.

Required additions remain small: SMS plus basic community form, liaison response, camera review and park configuration. Optional after required flows pass: duplicate suggestions, repeat-site/response-time analytics, animated replay, dark theme and additional algorithms. The submitted design must not promise unimplemented optional behavior.

Foundation checklist:

- Verify the existing workspace setup, startup, formatting/lint/typecheck and dependency installation; fix gaps in place rather than re-initializing the monorepo.
- Add migrations in apps/api/drizzle, reference/seed data through the existing reference module, and extend current shared contracts and app shells for role/park selection.
- Reuse existing API validation compilers, AppError and Clock; add error mapping, DB transactions, events/SSE and role/park scoping in the current API.
- Build offline persistence/outbox once, then integrate incident/media and patrol flows.
- Agree revised scenarios/wireframes before their implementation and create flow-level traceability.
- Configure meaningful per-use-case coverage reporting and CI enforcement.

Exit gate: a clean clone can migrate/seed/start both apps and API; reference data loads; offline persistence tests and CI pass. Folder presence alone does not satisfy this gate.

## 3. Canonical states and transitions

Role and IncidentStatus already exist in packages/shared/src/enums.ts and remain unchanged. Other names below are proposed additions to that file (or small exported domain files), not additional frameworks. Store transitions in the owning module and share only the types needed by clients.

```text
Role: RANGER | PARK_MANAGER | LIAISON_OFFICER | RESEARCHER
IncidentSource: RANGER | COMMUNITY | CAMERA_TRAP
IncidentStatus: NEW | VERIFIED | IN_PROGRESS | RESOLVED | REJECTED
LocationStatus: GPS | MANUAL | LANDMARK | UNRESOLVED
SyncStatus: PENDING | SYNCING | SYNCED | FAILED
AssignmentStatus: ASSIGNED | ACTIVE | COMPLETED | PARTIAL | CANCELLED
SessionStatus: ACTIVE | COMPLETED | PARTIAL
AlertStatus: NEW | DISPATCHED | ACCEPTED | ON_SCENE | RESOLVED | CANCELLED | AUTO_RESOLVED
DispatchStatus: PENDING | ACCEPTED | REJECTED | TIMED_OUT | ARRIVED | DONE | CANCELLED
AlertType: GEOFENCE_BREACH | IMMOBILITY | SIGNAL_LOST | LOW_BATTERY
Severity: LOW | MEDIUM | HIGH | CRITICAL
ZoneKind: PARK_BOUNDARY | HIGH_RISK | BUFFER
CameraReview: PENDING | WILDLIFE | AUTHORIZED_PERSON | SUSPICIOUS_ACTIVITY | UNSURE
```

Incident: NEW -> VERIFIED -> IN_PROGRESS -> RESOLVED; NEW/VERIFIED -> REJECTED. Verification can precede location resolution, but spatial dispatch requires a resolved location. Assignment of a responder is required before IN_PROGRESS; record first response time at that transition. Resolution requires outcome notes. Terminal records do not reopen through retry.

Patrol: assignment ASSIGNED -> ACTIVE with one active session -> COMPLETED/PARTIAL. Cancel or reassign only before start. End requires confirmation; early/battery termination produces PARTIAL with reason. Capture times locally; server computes metrics after ingest. Restore an active session after restart.

Alert/dispatch: NEW -> DISPATCHED when a PENDING dispatch is created. Accept sets dispatch ACCEPTED and alert ACCEPTED ("On the way"); arrival sets ARRIVED/ON_SCENE; resolution with notes sets DONE/RESOLVED. Reject or pending timeout returns alert to NEW for reassignment and retains the failed dispatch history. At most one open dispatch per alert; enforce transactionally.

False-positive cancellation closes any open dispatch as CANCELLED and records the actor/reason. Safe-return auto-resolution applies only to a geofence-breach alert and closes its open dispatch as CANCELLED with an auto-resolution reason. It does not clear unrelated immobility/battery/signal-loss conditions. Terminal alerts reject late accept/arrive/resolve commands with 409; duplicate accepted operations return their original acknowledgment.

No available unit: raise priority to CRITICAL and offer manager-triggered station broadcast. Store broadcast recipients and time; broadcasting alone is not acknowledgment or successful response. Keep an unresolved alert until a subsequent targeted response or justified closure. Low-severity diagnostics remain quiet and do not generate high-priority dispatch alarms.

Every state mutation records actor, timestamp, old/new state and reason/notes; alert and dispatch updates commit together.

## 4. Data contract

This is a **proposed logical data model**, not a required one-table-per-row physical schema. No business schema/migration exists yet. Implement the smallest Drizzle schema that supports the agreed flows inside apps/api/drizzle; choose final names there and update this plan to match. Do not create a new persistence package or database to accommodate this table.

Consolidation is encouraged: landmark/settlement/boundary metadata can use configured reference features; entity history can share one audit-event table; broadcast history can use alert events; response fields can stay on incidents. Use a separate coverage-observation structure only if needed for time-filtered spatial results. Preserve transactional/idempotency behavior when combining structures. Optional analytics must not force extra tables before baseline workflows work.

All records are park-scoped directly or through validated foreign keys. Database geometries use SRID 4326 with longitude/latitude ordering; public DTOs retain the existing named latitude/longitude fields. Metric distances/areas must use a meter-based calculation, not degree values.

| Logical entity (physical mapping to be finalized) | Essential data |
|---|---|
| parks | id, name, terrain, config: types/workflow options, thresholds, grid/buffer settings |
| zones | id, park_id, name, kind, polygon, boundary_stretch_id? |
| boundary_stretches | id, park_id, name, geometry |
| landmarks | id, park_id, name/aliases, approximate point, precision description |
| settlements | id, park_id, name, point |
| species / park_species | species identity and per-park availability |
| incident_types | id, park_id, code, label, default_severity, photo_requested (advisory) |
| users | id, name, role, park_id, phone? |
| incidents | client UUID, source/type/park/species?, severity/status, description, point?, location_status, location_text?, accuracy?, captured_at, received_at, reporter_id/phone?, camera_image_id?, revision, assigned_to?, assigned_at?, first_response_at?, resolved_at?, outcome_notes? |
| incident_media | client UUID, incident_id, path, mime, size, checksum |
| incident_events | incident_id, actor, time, event, old/new state, notes |
| community_messages | provider/message ID, park, phone, raw text, incident_id?, validation/follow-up state |
| patrol_routes | id, park_id, name, route geometry, target area/cells, version |
| patrol_assignments | id, route_id/version, ranger_id, assigned_by, status, revision, assigned_at |
| patrol_sessions | client UUID, assignment_id, status, revision, started_at, ended_at?, termination_reason?, distance, coverage |
| track_points / waypoints | client UUID, session_id, position, accuracy/source, recorded_at; waypoint note/photo reference |
| grid_cells | id, park_id, clipped geometry, area |
| coverage_observations | unique session/segment/cell key, observed_at, covered geometry |
| collars / collar_pings | collar/animal/species/park, latest battery/status/time; ping ID, point, speed, battery, recorded_at, received_at |
| alerts | id, park_id, type/severity/status, collar_id, zone_id?, location, created/resolved times, revision |
| dispatches | id, alert_id, ranger_id, status, sent/responded/arrived/completed times, revision, notes |
| alert_events / broadcasts | alert/dispatch, actor, time, event/state, notes; broadcast recipient snapshot |
| camera_traps / camera_images | park/location; image path/time, review classification, species?, person flag, reviewer/time, resulting_incident_id? |
| report_audit | id, user_id, park, filters, generated_at, export format/status? |
| processed_operations | unique operation_id, payload hash, stored acknowledgment and result/revision |

GiST indexes for spatial queries; indexes on park/time/status and collar/time. Unique child IDs prevent duplicate points/media. Enforce one active patrol per ranger, one open dispatch per alert and no double reservation of a responding ranger. Retain failed/completed dispatch history.

Landmark-only community reports may have no point. Preserve raw location text and UNRESOLVED state; display them in a review inbox and nonspatial totals. Do not invent coordinates. Known seeded landmarks resolve to approximate positions labeled LANDMARK; manual liaison resolution records provenance. Exclude unresolved locations from heatmaps/boundary counts and display the excluded count.

## 5. API surface

Only `/health` exists today. The following paths are proposed feature contracts to register under `/api` in the existing server, not routes that can already be called. Keep related endpoints in their existing module; endpoint naming may be simplified while preserving documented flows and shared client contracts. Reference/config/user endpoints belong to modules/reference; nearby-ranger selection belongs to the alerts/patrol integration. No API gateway or additional server is required.

Base `/api`; `/health` remains outside it. Validate inputs and return typed errors `{ code, message, details? }`. Mutations carry an operation ID and, for updates, expected revision. Same operation/payload returns the original result; reused ID with changed payload is rejected.

| Module | Endpoints and contract |
|---|---|
| Reference | GET /parks; GET /parks/:id/config; GET /users?role&park; GET /rangers/nearby?park&lat&lng&limit; GET /stream |
| Incident intake | POST /incidents (create-once by client ID); POST /incidents/:id/media (stable media ID); GET /incidents and /incidents/:id |
| Incident workflow | PATCH /incidents/:id/status; PATCH /incidents/:id/location; POST /incidents/:id/assign; POST /incidents/:id/response (START or RESOLVE, notes); GET /incidents/:id/history |
| Community | POST /community/sms (message ID, park, phone, raw text); POST /community/reports; POST /community/messages/:id/follow-up |
| Camera | POST /camera-images (simulator upload); GET /camera-images; PATCH /camera-images/:id/review |
| Patrol | GET /patrol-routes?park; POST/PATCH /patrol-assignments and /patrol-assignments/:id; GET /patrol-assignments/mine; GET /patrol-assignments/:id/offline-pack |
| Patrol ingest | POST /patrol-sessions/sync (session revision plus incremental point/waypoint operations); GET /patrol-sessions and /patrol-sessions/:id; GET /coverage?park&from&to |
| Collars/alerts | POST /collar-pings; GET /collars and /collars/:id; GET /alerts and /alerts/:id; POST /alerts/:id/acknowledge |
| Dispatch | POST /alerts/:id/dispatch; POST /dispatches/:id/respond (ACCEPT/REJECT); POST /dispatches/:id/progress (ARRIVED/RESOLVE); POST /alerts/:id/cancel; POST /alerts/:id/broadcast |
| Analytics | GET /analytics/summary, /trend, /breakdown, /hotspots, /patrol-gaps, /conflict-trends with consistent park/date/category filters |
| Export/audit | POST /reports/export (filters, PDF or CSV); GET /reports/audit |

Status and response endpoints call the same transition service; neither bypasses assignment/outcome rules. Camera review creates an incident only after explicit suspicious-activity classification or another selected reportable wildlife condition, once per image. A person flag alone only requests review.

SSE emits incident/patrol/alert/dispatch changes after persistence. Clients refetch current state on connect/reconnect and app resume; SSE is a hint, not the sole durable record. Fetch pending ranger dispatches even if their creation event was missed. Show the actual operation acknowledgment before claiming a response was delivered.

## 6. Offline and synchronization contract

Implement storage/queue functions in @wr/offline and consume them from apps/ranger. UI hooks and browser view state belong in Ranger's src/lib unless the package boundary is explicitly revised. Do not add React to the offline package just to match a service/hook name in this plan. @wr/offline may depend on @wr/shared, but not on either app or the API.

Ranger-only IndexedDB stores incidents, media, sessions, track points, waypoints, outbox, assignments, route geometry/version, park reference data and offline-pack metadata.

- **Preparation:** download an assigned route, target geometry and park data while connected. Show offline readiness and version/time. Precache the app shell; a tile-independent route/boundary overlay remains usable without basemap tiles. Do not depend on previously viewed tiles covering a future route.
- **Atomic writes:** commit domain record and outbox operation together. Each operation has stable UUID, kind, entity/child ID, payload/revision, dependencies, attempt count, next attempt and last error.
- **Create versus update:** retrying a create returns its existing result; it never overwrites manager status. Updates check expected revision. Conflicts preserve local data and offer reconciliation; never silently use last-write-wins for lifecycle state.
- **Children/media:** stable UUIDs for points, waypoints and media; retry safely without duplicate rows/files. Upload parent before child. Mark metadata and media synchronization separately; show fully synchronized only after required acknowledgments.
- **Queue execution:** one flusher per queue, retry interrupted SYNCING operations after restart. Flush at app start/resume, reconnect, every 15 seconds while running with pending work, and manual retry.
- **Failure policy:** probe /health as well as network status. Back off transient errors from 2 seconds up to 5 minutes; after 8 failures show FAILED and manual retry. Validation/revision conflicts need action rather than endless retries.
- **Crash safety:** persist start/end and every point/waypoint immediately. Reload the active session without resetting its identity. Keep the filled incident form if storage fails; never show "saved" before commit.
- **Media failure:** permit no-photo submission, including camera/storage failures. Advisory photo requests cannot block the original no-photo alternate flow. Compress images before storage; if even metadata cannot save, show a retryable error and retain the form.
- **Live patrols:** while connected, send active status and incremental points using the same ingest contract every 15 seconds. Offline sessions continue locally; the server shows their last-received time. Do not claim live visibility during disconnection.
- **Offline assignment conflict:** retain captured data if a stale assignment was cancelled/reassigned; flag a reconciliation conflict for manager review and keep it separate from accepted operational coverage until resolved.

Prototype changes to G39 pp. 19-20 must appear in the report:

1. Critical battery below 10%: persist data, end the session as PARTIAL with LOW_BATTERY, stop this app's tracking and warn. Inject battery events for the demo when unavailable; do not claim control over device-wide sensors.
2. The prototype stores synthetic data in IndexedDB without application-level encryption. This explicitly changes the encrypted-local-storage design to keep the prototype focused on assessed workflows; IndexedDB alone is not encryption. Document this limitation rather than silently claiming equivalence.
3. Automatic sync/GPS tracking are demonstrated while the app is running or when it resumes. Closed/suspended-app continuous operation is not a guaranteed prototype capability. Report this constraint and demonstrate recovery/resume.

Tests: atomic save failure, reopen offline with prepared route, interrupted flush, retry/backoff, duplicated parent/child/media operations, stale updates, no-photo fallback and assignment reconciliation.

## 7. Module behavior and tests

Names such as PingProcessor or StaleCollarScanner describe responsibilities within the existing modules. They can be plain functions/files; they do not mandate new services, packages, processes or an enterprise framework.

### M1: Incidents, community and camera review

Require incident category, description, time and location: ranger/camera reports use coordinates; community reports may initially use landmark text. For GPS failure offer retry, a clearly labeled last valid patrol waypoint with age/accuracy, or manual location. Never represent stale coordinates as a new fix.

SMS format: KEYWORD plus description/landmark. Preserve raw text, resolve known seeded landmarks, and request missing information through the mock reply/follow-up flow. Do not lose or reject a valid unknown landmark. The basic form provides the same intake semantics. Liaison verifies, resolves location where possible, assigns response and closes with outcome.

Camera review classifies wildlife, authorized person, suspicious activity or unsure. Unsure remains reviewable; repeat review does not duplicate incidents.

Test validation, no-photo/GPS/camera/storage failures, SMS valid/unknown/missing/noisy inputs, unresolved locations, follow-up, legal/illegal status transitions, cross-park ownership, response timestamps/outcomes and idempotency. Duplicate-nearby suggestions are optional.

### M2: Patrols and coverage

Manager assigns/reassigns before start; reject conflicting active assignments/reservations. Ranger downloads offline pack, starts, records GPS periodically (10 seconds or 15 meters), optionally adds manual observations and confirms completion. No manual waypoint is a valid flow. GPS loss warns and pauses automated recording; manual waypoints are a justified fallback. Avoid joining distant points across long signal gaps.

Coverage definition: buffered valid track segments (default 50 meters), clipped to configured patrol target area; coverage percentage = union covered area / target area. No valid segments means zero measured area; zero target area is a configuration error. Across sessions use geometry union to avoid double counting. Retain observation times for date-filtered and neglected-area queries. Use metric distance/area calculations. Manual points remain observations unless configured to contribute a defined buffer.

Tests cover conflicts/reassignment, offline start/end/recovery, skipped waypoint, GPS loss, battery partial termination, duplicate ingest, zero/single-point tracks, gaps/outliers, overlap, target clipping and date/neglect boundaries.

### M3: Collars, alerts and dispatch

PingProcessor stores validated pings and runs breach/immobility/low-battery rules. Defaults are configurable demo choices: immobility within 50 meters across a full 2-hour observation window, low battery below 15%, stale signal after 6 hours. Require adequate telemetry before claiming immobility; missing telemetry is signal loss, not proof of stillness.

A scheduled StaleCollarScanner runs every minute and detects signal loss even when no new pings arrive. Store recorded/received times; reject or quarantine invalid future/out-of-order data from latest-state decisions. Deduplicate open alerts by collar/type/zone. Low-battery/signal-loss recovery follows its own rule, not geofence return.

Alert detail includes trajectory, battery/speed, nearest configured settlement, nearby reviewed camera images, manager acknowledgment/notes and history. Candidate rangers must be available, in the same park, and have a position received within the configured freshness limit (demo default 2 minutes). Display age; exclude stale positions from "nearest available."

Targeted dispatch requires a current available ranger; pending acknowledgment times out after 2 minutes. No candidate prompts CRITICAL escalation and manager-triggered broadcast. Update related alert/dispatch states atomically as section 3 defines.

Tests cover boundary in/out/edge, adequate/insufficient movement history, every threshold, stale scan with no more pings, duplicate/out-of-order telemetry, stale ranger exclusion, full transition matrix, late response after cancellation/auto-resolution, timeout/reassignment and event/history recording.

### M4: Analytics and export

Use park/time/category filters consistently; validate dates and preserve filters on failure. Support incident counts/trends/type-sector breakdown, hotspot heatmap, patrol gaps and monthly/boundary human-wildlife conflict counts from community reports and relevant collar breaches.

Show community reports and collar alerts as distinct series or explicitly labeled event totals; do not imply they are deduplicated real-world conflicts. Unknown locations contribute to nonspatial counts with an excluded-location count for spatial views. Define timezone as Asia/Colombo and bucket boundaries explicitly.

No records: explanatory empty state with filter adjustment. Query timeout: retry message with filters retained. Export failure: preserve on-screen analytics. Export is optional during normal report viewing; both PDF and CSV are available. Each report generation records filters/user/time; export records format and outcome.

Optional response-time metric uses first_response_at minus received_at for responded incidents only, reports sample size and excludes unanswered incidents from the mean while listing them separately. Optional repeat-site detection must declare its radius/window and avoid double-counting sources.

Tests: small-fixture aggregation, date/timezone boundaries, source separation, unknown locations, spatial/coverage alignment, PDF text/content and CSV values/escaping, no-data/timeout/export failure, skip-export and audit behavior. A nonempty PDF buffer alone is insufficient evidence.

## 8. Screens and design consistency

Both current routers implement only `/` and a wildcard redirect. The routes below are planned additions to their existing App.tsx files. Start with small feature components within each app's src directory, retaining HomePage.tsx and DashboardPage.tsx as entry screens. Add subfolders when helpful; do not replace the app layout or introduce a combined apps/web project. Keep community intake as a route in the Ranger app rather than creating a fourth app.

| App | Screens/routes |
|---|---|
| Ranger | / home/role/park; /incidents list; /incidents/new review-and-submit; /incidents/:id detail |
| Ranger patrol | /patrol assignments/offline readiness; /patrol/active map/tracking; /patrol/waypoint; /patrol/summary |
| Ranger response | /alerts/:dispatchId accept/reject; /alerts/:dispatchId/active arrive/resolve |
| Community | /community/new basic form with online success/failure and landmark handling |
| Ops incidents | /incidents; /incidents/:id detail/history; /camera-traps review; /conflicts liaison inbox/location/assignment/outcome |
| Ops patrol | /patrols assignments; /patrols/coverage; /patrols/:id static track/observations/stats |
| Ops alerts | /alerts feed/map; /alerts/:id details/acknowledgment/dispatch/cancel/broadcast/history; /collars diagnostics |
| Ops analytics | /analytics filters/KPIs/trends/table/heatmap/gaps; /analytics/conflicts; /reports export/audit |

Ranger: readable high-contrast theme, approximately 48px minimum touch targets, icon plus text, persistent sync/connection feedback, GPS accuracy/source/age, confirmation before ending. A saved-state message appears only after successful persistence. Sound/vibration are optional enhancements; visual notifications and durable pending lists are required.

Ops: clear table/map layout, keyboard-accessible controls, loading/empty/error states and explicit freshness. Use Sri Lankan demonstration data. Switching park must change types/species/zones and a workflow or threshold configuration without code changes. Keep improved wireframes consistent with implemented screens.

## 9. Simulators and demo evidence

tools/* is outside the current pnpm workspace globs and has no package.json files. Keep these as local script/assets folders by default. Add explicit root scripts backed by the API's existing tsx runtime when the implementations exist (for example, root script `pnpm --filter @wr/api exec tsx ../../tools/seed/index.ts`). Ensure script imports/dependencies resolve under that execution context, or place the executable implementation in the API and keep tool data in tools. Do not document `pnpm sim:*`, migrate or seed commands as working before adding and verifying them. These scripts use the same API/DB, not separate deployed applications.

| Tool | Required behavior |
|---|---|
| collar-simulator | Deterministic normal/breach/immobile/signal-lost/low-battery/recovery scenarios; injectable demo clock avoids waiting hours |
| sms-gateway-mock | Submit message ID/phone/park/text, show reply and follow-up; known and unknown landmarks |
| camera-trap-feeder | Upload attributed/licensed or owned sample images; optional simulated person flag, never automatic guilt classification |
| seed | Yala/Sinharaja/Wilpattu configuration, routes/areas/landmarks/settlements/boundary stretches, rangers/collars and six months of labeled synthetic analytics data |

Demo:

1. Switch park and show config-driven differences.
2. Assign/download route; go offline, start patrol, log waypoint and incident/photo; reopen and verify persisted route/session.
3. Reconnect; verify automatic flush, no duplicate records and metadata/media acknowledgments in Ops.
4. Trigger breach; inspect telemetry/settlement/camera evidence; acknowledge, dispatch, accept, arrive and resolve.
5. Trigger no-ping signal loss through the scanner; demonstrate pending timeout or no-unit broadcast and late-command rejection.
6. Send known and unknown landmark SMS; resolve/assign/respond/close through the liaison inbox; review a camera image.
7. Generate filtered statistics/heatmap/gaps and separate conflict trends; view without exporting, then export PDF/CSV.
8. Demonstrate representative original failures: no photo, GPS loss, storage failure, battery termination, empty analytics, retained-filter timeout and export failure with report intact.

## 10. Testing, timeline and definition of done

Existing commands: `corepack pnpm dev:all`, `dev:api`, `dev:ranger`, `dev:ops`, `lint`, `typecheck` and `test`; `docker compose up --build` starts the current four services. Preserve these entry points. Add documented migration/seed/coverage commands only when implemented. The API currently starts through tsx; it does not have a compiled build script, so root build is not evidence of a production API bundle.

Tests currently run package-by-package with `vitest run --passWithNoTests`. A root vitest.config.ts alone must not be assumed to govern those package invocations. Explicitly wire package configurations or command arguments to the coverage setup, give UI suites their jsdom environment, and verify the effective config in CI. Do not allow --passWithNoTests to count a required completed module as tested. Add Ops UI test dependencies only when Ops tests need them; they are currently declared only by Ranger.

Target **>80% line and branch coverage per use case**, using an 85% enforcement threshold as a practical margin. Configure explicit source scopes including untested files for each member's API/UI/domain code, and report shared offline code separately. All four modules share an API package, so package totals alone are not individual evidence. Implement the coverage command/threshold checks in CI; they are not currently present.

Use pure-logic/state-machine tests with fake repositories/clocks; integration tests verify transactions, uniqueness and spatial queries against PostGIS; UI tests verify validation, error retention and offline feedback. Keep meaningful positive, negative, edge and error assertions. Run manual offline/restart and cross-app flows; automate a small smoke flow if useful.

| Date (2026) | Gate |
|---|---|
| 5 Oct | Verify/finish foundation; owners, data/API/state contracts and revised scenarios/wireframes |
| 6 Oct | Required end-to-end flows, alternatives/exceptions and meaningful tests; shared data integration |
| 7 Oct | Target feature freeze with integrated demos, >80% per-use-case coverage and report/code agreement; defer optional extras |
| 8 Oct | Bug fixes, clean-clone rehearsal, screenshots, coverage evidence and final report assembly |
| 9 Oct | Clean-clone verification, exact release SHA/tag, early submission and repository freeze |

Dates are targets, not evidence of completion. If behind, remove optional extras first and document justified changes to required design; do not silently skip original exceptions.

Per-use-case completion checklist:

- [ ] Actual owner recorded; every original main/alternate/exception flow traced to retained or justified changed behavior.
- [ ] Revised scenarios/diagrams/wireframes match API/UI behavior, including prototype limitations.
- [ ] Validation, park/role/ownership checks, state transitions, audit and error paths work.
- [ ] Offline preparation/restart/sync/retry demonstrated where applicable.
- [ ] >80% meaningful coverage reported for the member's scope; CI passes.
- [ ] No lint/type errors; reproducible migration/seed/start commands documented.
- [ ] Actual screenshots and flow descriptions supplied; exact AI prompts logged.
- [ ] Release tag and commit SHA recorded; report GitHub URL correct; demo uses the submitted frozen version.
