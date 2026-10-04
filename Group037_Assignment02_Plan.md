# Group 037: Assignment 02 Plan
**SE3070 | Reviewing Group_39 | Deadline: Fri 9 Oct 2026, 11:59 PM | Today: Sun 4 Oct (5 days left)**

---

## 1. What we must deliver

| # | Deliverable | Who | Marks |
|---|---|---|---|
| 1 | One group PDF report: critique + improved design (use case diagram, class diagram, sequence diagrams, scenarios, UI) | Group | 30 |
| 2 | One implemented use case per member (end-to-end, matches the improved design) | Each | 30 |
| 3 | Code quality (SOLID, patterns, clean code, docs) | Each | 20 |
| 4 | Unit tests, aiming for **>80% coverage** (positive, negative, edge, error) | Each | 20 |
| 5 | Report extras: page 1 has Group ID, campus (Malabe) and all reg numbers; UI screenshots with short flow descriptions; GitHub URL; **AI prompts in an Appendix** | Group | n/a (compliance) |

Rules to remember:
- Preserve the original use cases. Broaden them with justification. Do not replace them (G39's use cases are not too simple to modify).
- Do **not** build login/logout/admin. A mock "switch user" is fine.
- IoT/ML (collars, camera traps, SMS gateway) can be **mocked with dummy data**.
- UI must stay consistent with the storyboards/wireframes in **our** report.
- The repo must **not** change after the deadline, and the demo code must equal the repo code.

---

## 2. G39's design: summary and our scope strategy

G39 has **4 business use cases** (3 members, so one did two):

| G39 use case | Original author |
|---|---|
| Report Wildlife Incidents | Wijesundara |
| Manage Ranger Patrols | Wijesundara |
| Monitor Wildlife & Collar Alerts | Rathnayaka |
| Analyze Conservation Data & Generate Reports | Jayakodi |

The spec says "covering the 4 substantial business use cases is sufficient", and we have exactly 4 members. **One use case each**. G39's design is thin, so we get a bigger scope by **broadening each use case** with well-justified additions that come from gaps against the case study. We do not invent new use cases for the sake of it.

### Proposed assignment (swap names as you like)

| Member | Use case (original name kept) | Broadened scope (justified by case study gaps) |
|---|---|---|
| **M1** | **Report Wildlife Incident** | Ranger incident reporting (offline-first, sync queue, validation, configurable incident types/species per park, severity, photo). **Plus** community report intake (villager via SMS-simulator or basic app) and camera-trap image review, all stored as one `Incident` with `source = RANGER / COMMUNITY / CAMERA_TRAP`. Dashboard incident list with status workflow (New → Verified → Resolved). |
| **M2** | **Manage Ranger Patrols** | Manager assigns routes (conflict check), ranger starts/tracks/ends patrol, GPS breadcrumbs plus manual waypoints, early end (partial), crash recovery, offline storage plus sync, coverage calculation per sector grid, neglected-sector view. |
| **M3** | **Monitor Wildlife & Collar Alerts** | Collar feed simulator, geofence/high-risk-zone check (PostGIS), alert creation with severity, **full dispatch lifecycle** (Dispatch → Accept/Reject → On the way → On scene → Resolved), nearest-ranger suggestion, camera-trap verification, collar offline detection, false-positive cancel, escalation when no ranger is available. |
| **M4** | **Analyze Conservation Data & Generate Reports** | Filters (park/time/category), KPIs, trend chart, hotspot heatmap, patrol-coverage gaps, **human-wildlife conflict trends**, export PDF/CSV, audit log of queries. Consumes data from M1/M2/M3 via a seeded dataset plus the live DB. |

Group-level work (shared by all): report critique, improved diagrams, shared foundation, integration, demo data.

---

## 3. Critique of G39's design: findings to put in the report

Verified from their PDF. Use these as the backbone of the critique. Weights are 90% functional design, 10% interaction design.

### 3.1 Requirement coverage gaps (vs. the case study)
1. **Community and conflict reporting is missing.** Villager is wired to "Report Wildlife Incidents" (a ranger use case). There is no SMS/short-code channel, no Community Liaison Officer actor, and no conflict case handling.
2. **Camera traps are missing** from the use case diagram, class diagram and scenarios (the case study requires reviewing images to identify species or poachers).
3. **Offline sync is never a first-class use case.** It is buried in alternates and has no sync-conflict or retry design in the class model (`syncStatus: Boolean` is too weak; use an enum such as `PENDING / SYNCING / SYNCED / FAILED`).
4. **System flexibility (per-park configuration of hazard types, workflows, species) is absent.** Incident type is a free `String`.
5. **High-risk zones are not modelled.** `AnimalCollar.checkZoneBreach(zone: HighRiskZone)` references a class that does not exist in the diagram. There is no `Park`, `Species` or `Zone` class either.
6. **The alert lifecycle is incomplete.** Alerts are dispatched but there is no ranger accept/reject/arrive/resolve, so no closed loop.
7. **Patrol coverage over time is only a number** (`computeCoverage(): Floa`). There is no sector or grid concept, so "neglected areas" cannot actually be derived.
8. **Researcher** is an actor but has no class and no generalization with Park Manager. `Ministry` is an actor but never interacts; it only receives an exported file, so it should be an external stakeholder or removed as an actor.

### 3.2 UML correctness issues
- **Use case diagram:** `Park Manager` is linked to Monitor Alerts but Field Ranger (the one who responds) has no respond use case. No Community Liaison Officer. Include/extend are used loosely ("Record Wildlife Geolocation" is always done, so `<<include>>` is right, but "Attach Photo" being `<<extend>>` is fine while the scenario text treats it as optional only in an alternate flow; make them consistent). GPS sensor actor is the true trigger but sits as a plain association with no sensor-initiated flow.
- **Class diagram:** `PatrolRoute.getRoutePath(): List<Waypoint>` while `Waypoint` is **composed by `PatrolSession`** (a part cannot belong to two wholes). `PatrolRoute`↔`PatrolSession` uses a hollow diamond with unclear multiplicities. Typos (`Floa`, `Date`/`DateTime` mix). `User.role: String` duplicates the subclass hierarchy. No `Researcher`. `ConservationReport` has no association to the data it reports on. `AnalyticsEngine` is a God-class style "engine" with both hotspot and trend logic (SRP). `SensorAlert -> AnimalCollar` is drawn as a dependency in the wrong direction semantically (the collar triggers; the alert should reference the collar).
- **Sequence diagrams:**
  - *Patrol:* no GPS service lifeline, no periodic loop, the Park Manager assignment step is missing even though the scenario's main flow starts with it, and "saveLocalBackup" is drawn as a return message to the app instead of a call to local storage.
  - *Incident:* the network-availability check has no message, offline branch and online branch share lifelines inconsistently, and the manager's view step is absent.
  - *Monitor alerts:* a `new SensorAlert` creation arrow is fine, but `dispatchRangerNotification` is sent from the HUD to the `SensorAlert` entity (entities should not receive UI-originated commands), and the ranger's response is missing.
  - *Analytics:* numbering is inconsistent (`2.`, `3.`, `33.`) and controllers call entity classes directly.
- **Use case scenarios:**
  - Jayakodi's header shows another member's reg number (IT23684362 belongs to Rathnayaka).
  - The patrol scenario names the Park Manager as primary actor but most steps are the ranger's.
  - The monitor scenario's "Dispatch" broadcasts to *all* active units rather than a chosen nearest ranger.
  - Immobility alerts appear in the main flow but nowhere in the class model.

### 3.3 Interaction design / HCI issues
- **Domain inconsistency (strong point):** Monitor wireframes use *Mara Sanctuary, lion, rhino, giraffe* and Kenyan coordinates (-2.3, 37.8). The patrol wireframe uses *Bear Notch Pass* with New Hampshire coordinates (44°N, 71°W). These are not Sri Lankan parks or species.
- **Storyboard tone:** the patrol storyboard shows helmeted, militarised figures and a fortress, which does not match a conservation ranger context. The monitor storyboard is an African savanna.
- **Incident flow:** the high-fidelity form puts *Crop Damage* in the ranger incident categories (a community conflict type), has no severity, no species and no "unsure" option. The final screen titled *Offline Cashed Confirmation* shows an **Offline Map Caching** dialog, which does not match the storyboard. Typos: "Dashbord", "Cashed", "Wirefram".
- **Glanceability/field usability:** dense, small monospace text and many tiny chips are hard to read outdoors (small touch targets, low contrast in sunlight). Primary actions are not consistently placed. There is no sync status indicator beyond text.
- **Feedback and error prevention:** nothing shows the GPS accuracy state or a retry path for the ranger; "End Session" is red and adjacent to "Add Waypoint", with no confirmation, so accidental taps are possible.
- **Analytics UI:** the "Confidence 94.2%" is unexplained, the Spatial Heatmap tab is never designed, and there is no empty or error state.
- **Strengths to acknowledge:** a clear offline banner on the patrol/incident screens, consistent navigation between the low- and high-fidelity versions, good KPI-first layout for the analytics dashboard, and sensible use of severity colours.

(Keep a "Strengths" subsection in each area. The rubric asks for both strengths and weaknesses.)

### 3.4 Improved design to draw (all diagrams must tie back to a critique point)
1. **Use case diagram v2:** add Community Liaison Officer, Researcher (generalizing Park Manager's analytics access), Villager → Submit Community Report (SMS / app), Review Camera Trap Images (extends Report Incident), Respond to Alert (Ranger), Sync Offline Data (`<<include>>` from reporting/patrol). Ministry becomes a note/external recipient.
2. **Class diagram v2:** add `Park`, `Zone`/`HighRiskZone`, `Species`, `IncidentType` (config), `Incident` (with `source`, `status`, `SyncStatus` enum), `CameraTrapImage`, `CommunityReport` (or Incident source), `Alert` + `Dispatch` with state, `SyncQueueItem`, `PatrolAssignment`, `GridCell` (coverage), `Researcher`. Fix the composition problem (`Waypoint` belongs to `PatrolSession` only; route points become `RoutePoint`). Split analytics into `HotspotService`, `TrendService`, `ReportExporter`.
3. **Sequence diagrams v2** (4 diagrams, one per use case): add the missing lifelines (GPS service, local store, sync service, manager UI) and the missing alt/opt/loop fragments; consistent numbering.
4. **Use case scenarios v2:** correct the actors, add the community/camera-trap and full alert lifecycle flows, and add sync-failure and duplicate handling.
5. **UI v2:** Sri Lankan context (Yala, Wilpattu, Udawalawe; elephant, leopard; real coordinates around 6.3°N 81.5°E for Yala); larger touch targets; high-contrast "sunlight" theme; severity/type icons plus labels (not colour only); a persistent sync badge; confirmation on End Patrol; empty and error states.

---

## 4. Technology stack (all free and open source)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language, shared types between API and UI |
| Monorepo | **pnpm workspaces** | Fast, free |
| Frontend | **React + Vite**, **React Router**, **Tailwind CSS** | Free, quick |
| "Mobile" ranger app | Separate React app as an **installable PWA** (mobile-first layout, root-relative routes) with a service worker via **Workbox / vite-plugin-pwa**; offline support lives in `packages/offline` | Real offline behaviour without a native toolchain. The spec only needs usable mobile UI plus offline sync. |
| Offline storage | **Dexie.js** (IndexedDB wrapper) plus an **outbox/sync queue** | Gives local store, pending sync and auto-sync on reconnect |
| Dashboard | Separate React app in `apps/ops` with root-relative routes | Independent desktop build, without PWA/offline dependencies |
| Maps | **Leaflet** + **OpenStreetMap** tiles (**leaflet.heat** for heatmaps) | Free; for the demo, tile usage is light and attribution is shown |
| Charts | **Recharts** | Free |
| Backend | **Node.js + Fastify** (or NestJS if the team prefers structure) with **Zod** validation | Fast and simple; modular per use case |
| Database | **PostgreSQL + PostGIS** | Real geofence and spatial queries (`ST_Contains`, `ST_DWithin`) |
| ORM / migrations | **Drizzle ORM** (or Prisma) | Free; typed |
| Real-time | **Server-Sent Events** (or Socket.IO) | Live alerts to the dashboard and ranger app |
| Mocks | `collar-simulator`, `sms-gateway-mock`, `camera-trap-feeder` (small Node scripts / API endpoints) | IoT is allowed to be mocked |
| PDF export | **pdfmake** (or PDFKit); CSV via a simple writer | Free |
| Testing | **Vitest** (unit) + **@vitest/coverage-v8**, **Testing Library** (UI), **Supertest** (API) | Free; coverage reports for the 80% target |
| Quality | **ESLint + Prettier + Husky/lint-staged** | Free |
| CI | **GitHub Actions** (lint, test, coverage) | Free for public/student repos |
| Dev infra | **Docker Compose** (Postgres+PostGIS, API, web) | One-command start for the demo |
| Diagrams (report) | **draw.io (diagrams.net)** or **PlantUML** | Free |
| UI mockups | **Figma free tier** or **Penpot** (open source) | Free |

Auth: out of scope. Use a seeded **"Acting as" user switcher** (Ranger / Manager / Liaison / Researcher) to demo roles.

---

## 5. Architecture

```
/wildlife-guardian            (monorepo)
├─ packages/
│  └─ shared/                 types, Zod schemas, enums, constants (single source of truth)
├─ apps/
│  ├─ api/
│  │  └─ src/
│  │     ├─ core/             config, db, event-bus, error handling, SSE hub
│  │     └─ modules/
│  │        ├─ incidents/     (M1)  controller / service / repository / validators / tests
│  │        ├─ patrols/       (M2)
│  │        ├─ alerts/        (M3)  collars, zones, dispatch
│  │        └─ analytics/     (M4)  hotspots, trends, exporters
│  └─ web/
│     └─ src/
│        ├─ shared/           layout, API client, offline-sync lib, map components
│        ├─ ranger/           mobile screens (M1, M2, M3 ranger side)
│        └─ ops/              dashboard screens (all four)
├─ tools/                     simulators + seed data
├─ docs/                      diagrams, screenshots, report assets
└─ docker-compose.yml
```

**Patterns to apply (and name in the report/code comments):**
- **Repository** (data access, easy to mock in unit tests)
- **Strategy** (hotspot algorithms, export formats PDF/CSV, incident-type workflows per park)
- **State** (Alert: `NEW → DISPATCHED → ACCEPTED → ON_SCENE → RESOLVED`, plus `REJECTED` and `CANCELLED`; Patrol: `ASSIGNED → ACTIVE → COMPLETED / PARTIAL`)
- **Observer / event bus** (a collar ping raises an event; the alert module and SSE hub react)
- **Adapter** (SMS gateway, collar feed, camera-trap feed behind interfaces so mocks are swappable)
- **Outbox / Command** (offline sync queue)
- **Factory** (create Incident by source)

**Flexibility requirement (system must be configurable per park):** a `park-config` (DB table plus seed JSON) holds incident types, species lists, zones, workflow rules, and alert thresholds. Show the demo by switching *Yala (open grassland)* ↔ *Sinharaja (dense jungle)* and seeing different incident types and species.

**Core data (sketch):** `parks`, `zones(geometry, kind)`, `species`, `incident_types(park_id, …)`, `users(role)`, `incidents(source, status, geom, sync fields)`, `incident_media`, `patrol_routes`, `patrol_assignments`, `patrol_sessions`, `track_points`, `waypoints`, `grid_cells`, `collars`, `collar_pings`, `alerts`, `dispatches`, `camera_traps`, `camera_images`, `report_audit`.

---

## 6. Per-member scope and definition of done

Every member delivers: **(a)** API module plus unit tests, **(b)** UI screens consistent with the report wireframes, **(c)** all scenarios in their use case (main, alternate and exception flows), **(d)** coverage ≥ 80% on their module.

### M1: Report Wildlife Incident (+ community and camera-trap sources)
- Ranger form: type (per-park config), severity, species, description, photo, auto GPS (manual fallback).
- Validation (missing fields, GPS fail, photo/storage failure → submit without photo).
- Offline: save to IndexedDB, mark `PENDING`, auto-sync on reconnect with retry/backoff; corrupted-record handling.
- Community report: SMS parser (`ELEPHANT near Kelegama`) via mock gateway, plus a basic app form; incomplete-report follow-up.
- Camera trap: image feed (mock), staff species/poacher review.
- Dashboard: incident list/detail/status workflow, duplicate flag for nearby reports.
- Tests: validators, SMS parser, sync queue (success/fail/retry), status transitions, repository mocks.

### M2: Manage Ranger Patrols
- Manager assigns route (rejects if ranger already active), reassign before start.
- Ranger: start, GPS breadcrumbs (simulated GPS in demo), manual waypoint, end, **end early (partial, confirm)**, restore after app crash.
- Offline-first tracking and sync; low-battery auto-save.
- Coverage: distance, duration, grid-cell coverage %, sector status "surveyed / neglected for N days"; dashboard coverage map.
- Tests: distance/coverage maths, state transitions, assignment conflicts, offline sync, edge cases (zero points, duplicate points).

### M3: Monitor Wildlife & Collar Alerts
- Collar simulator posts pings; geofence check with PostGIS; severity rules; debounce duplicates.
- Dashboard live map plus alert feed (SSE); detail panel (battery, speed, nearest settlement).
- Dispatch: nearest-available rangers list, dispatch, ranger accept/reject (mobile), on-the-way/on-scene/resolved, manager cancel (false positive), reassign on reject, **timeout when ranger unreachable**.
- Camera trap verification before dispatch; collar offline ("signal lost") detection; auto-resolve when the animal returns; escalation when no ranger is nearby.
- Tests: geofence logic, state machine (all legal and illegal transitions), nearest-ranger selection, timeout handling, event bus.

### M4: Analyze Conservation Data & Generate Reports
- Filters (park, date range, category), KPIs, incident-frequency trend, sector breakdown table.
- Hotspots (grid-density strategy), patrol-gap area, heatmap toggle.
- **Human-wildlife conflict trends:** by month and boundary stretch, repeat-site detection, response times.
- Export PDF and CSV; audit log of queries; empty/error states (no records, timeout, export failure keeps the on-screen report).
- Seed script generating 6+ months of realistic Sri Lankan data (so the analytics look real, and everyone can test with it).
- Tests: aggregation maths, hotspot strategy, trend calc, exporter output, error paths.

---

## 7. Timeline (5 days to deadline)

| Day | Date | Everyone | Milestone |
|---|---|---|---|
| 1 | **Sun 4 Oct** | Confirm assignment and stack. Foundation scaffold (monorepo, DB schema, shared types, mock user switcher, CI). Start critique doc. | Repo live, `docker compose up` works |
| 2 | **Mon 5 Oct** | Core backend of own module + draft UI. **Report:** critique section drafted; v2 use-case and class diagrams. | Core happy path works per module |
| 3 | **Tue 6 Oct** | Alternate/exception flows, offline behaviour, unit tests. **Report:** sequence diagrams v2, scenarios v2. | All flows implemented, coverage ≥ 60% |
| 4 | **Wed 7 Oct** | Integration across modules (shared seed data, live alerts, dashboards). UI polish vs wireframes. Tests to ≥ 80%. | **Feature freeze (evening)** |
| 5 | **Thu 8 Oct** | Bug fixing only. Screenshots, flow descriptions, UI v2 wireframes into the report. Compile PDF. Appendix of AI prompts. | Report v1 complete |
| 6 | **Fri 9 Oct** | Final review, tag release, **submit before ~6 PM** (buffer for upload problems). **No commits after submission.** | Submitted |

---

## 8. Team workflow

- **Branching:** `main` (protected) ← `feat/<member>-<module>` via PR, with one reviewer; squash-merge. Each member only touches their module folder, plus the shared package through small PRs, to avoid conflicts.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`). The history shows who did what (examiners can see it).
- **Definition of Done (per PR):** lint clean, tests pass, coverage for the module ≥ 80%, UI matches the wireframe, scenario steps checked off.
- **Contracts first:** API shapes and enums live in `packages/shared` on day 1 so UI and API work in parallel.
- **Keep an AI-prompt log** (`docs/ai-prompts.md`) from now on. It is required in the report appendix.

---

## 9. Report outline (single PDF)

1. **Cover:** Group_037, campus **Malabe**, all four reg numbers, reviewed group (Group_39).
2. **Executive summary** of findings.
3. **Critique of G39's design** (functional 90%): use case diagram, class diagram, sequence diagrams ×4, use case scenarios ×4, strengths and weaknesses, requirement-coverage matrix (case study requirement → covered / partial / missing).
4. **Critique of interaction design** (10%): usability, logical flow, HCI heuristics (Nielsen), domain consistency issues.
5. **Proposed improvements:** each change = *Problem → Justification → Updated diagram/UI*. Use a table linking every change to a critique item.
6. **Implementation:** per member, with UI screenshots, short flow descriptions, design patterns used and test coverage screenshot.
7. **GitHub repo URL** (and release tag).
8. **Appendix:** all AI prompts.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 5 days is tight | Foundation done on day 1; feature freeze Wed; no gold-plating |
| Offline sync is hard | Build the outbox library once (shared), test it heavily, demo with browser DevTools "Offline" |
| PostGIS setup trouble | Docker image `postgis/postgis`; fallback: Turf.js geofence in code behind the same interface |
| Merge conflicts | Module ownership, small PRs, contracts in `shared` |
| Coverage < 80% | Pure-logic services with injected repositories; track coverage daily in CI |
| Report written last-minute | Critique and diagrams proceed in parallel from day 1 |
| Demo mismatch with repo | Tag `v1.0-submission`; demo from that tag only |

---

## 11. Decisions we need from the group

1. Who takes M1, M2, M3, M4?
2. Do you agree on the **PWA + Node/TypeScript + PostgreSQL/PostGIS** stack? (Alternative: Java Spring Boot + React if the team is stronger in Java.)
3. Is Docker available on everyone's machine? (Otherwise: plain Postgres install, or SQLite plus Turf.js.)
4. Who owns the report assembly and final PDF?
