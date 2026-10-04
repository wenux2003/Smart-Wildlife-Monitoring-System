# Group 037: Assignment 02 Plan

**SE3070 | Reviewing Group 039 | Revised 5 October 2026 | Deadline: 9 October 2026, 11:59 PM (Asia/Colombo)**

## 1. Requirements and sources

Use `CSSE/prompt.txt` and the Assignment 02 specification as the supplied assessment baseline, and `Case study 01.pdf` for domain requirements. Group 039's PDF is the received design to critique, not an authority on correct design. Group 037's earlier PDF is background, not a substitute review target. Page references below are physical PDF pages.

| Deliverable | Responsibility | Marks |
|---|---|---|
| One collaborative PDF: critique and justified improved diagrams, scenarios and UI | Group | 30 |
| One substantial use case implemented end to end, aligned with the improved design | Each member | 30 |
| Maintainable code and appropriate best practices/patterns | Each member | 20 |
| Meaningful positive, negative, edge and error tests; target **>80% coverage** | Each member | 20 |

The cover must contain Group 037, campus and all four registration numbers. Use Malabe as currently recorded in the project, and verify cover details before submission. Include actual app screenshots with short flow descriptions, the GitHub URL and all AI prompts in the appendix. One group member submits.

Preserve the four original substantial use cases and their relevant main, alternate and exception flows. Changes need reasons tied to real problems. Mock IoT/ML behavior and the SMS gateway while implementing surrounding business workflows. Login/logout and privilege administration are not graded use cases; use a seeded demo role switcher. Demo the submitted repository commit and do not modify the repository after the deadline; our stricter working rule is to freeze at submission.

## 2. Scope and ownership

Group 039 presents four substantial use cases. Its cover lists three members, but the patrol section has no explicit author header; do not assume its author.

| Owner slot | Preserved use case | Required implementation |
|---|---|---|
| M1 | Report Wildlife Incident | Ranger reporting, optional photo, location/error handling, offline save/sync; small community SMS/basic-form intake, liaison response and camera-review additions |
| M2 | Manage Ranger Patrols | Assign/reassign and conflict checks; prepare offline route; start/track/manual waypoint/end; partial completion, GPS/battery/recovery paths, sync and time-based coverage |
| M3 | Monitor Wildlife & Collar Alerts | Simulated telemetry; breach/immobility/diagnostic rules; signal-loss scan; alert details/acknowledgment; targeted dispatch/response, safe return, cancellation and broadcast escalation |
| M4 | Analyze Conservation Data & Generate Reports | Filters, incident statistics, heatmap/hotspots, patrol gaps, community/collar conflict trends, PDF/CSV export, query audit and original error/skip-export paths |

Record actual names and registration numbers for M1-M4 before implementation. Do not infer allocation from Assignment 01. Proposed shared-work leads: M2 for offline/route preparation with M1 reviewing incident/media sync; M3 for events/integration; M4 for seed/analytics contracts. All members contribute critique, diagrams and report evidence. A report assembler and release coordinator remain to be selected.

Prioritize complete original flows over breadth. Community intake, camera review and park configuration should be small but demonstrable. Duplicate suggestions, repeat-site/response-time analytics, animated patrol replay, dark theme and additional algorithms are optional after required flows pass. A static patrol trail and monthly/boundary conflict counts form the baseline. Retain PDF and CSV exports shown in Group 039. Optional features become report commitments only if implemented and tested.

## 3. Evidence-based critique

The critique criterion weights functional design 90% and interaction design 10%. Include strengths and weaknesses. Separate observed defects from architecture preferences and usability concerns requiring measurement.

| ID | Evidence in Group 039 | Assessment and justified improvement |
|---|---|---|
| C1 | Villager appears p. 2; p. 5 mentions villager reports; pp. 11-13 describe ranger intake | Community intake/response is under-specified, not entirely absent. Add SMS/basic-form intake, unresolved-landmark review and liaison response. |
| C2 | Four scenarios lack dedicated camera-image review | Case study p. 2 requires staff review. Add a small image queue; person presence alone is not proof of poaching. |
| C3 | Offline incident save/auto-sync p. 12 and patrol caching p. 19; Boolean sync status p. 3 versus named states p. 14 | Preserve offline strengths; define durable queue, acknowledgments, retries and conflict handling. A separate sync use-case oval is not required. |
| C4 | Class diagram p. 3 references HighRiskZone without defining it; park configuration is not explicit | Add park/zone/type/species configuration and explain per-park workflow/threshold behavior. |
| C5 | Ranger participates in monitoring p. 2; p. 26 describes broadcast, p. 28 nearest unit | Clarify targeted dispatch with broadcast escalation, ranger response and closure. The gap is lifecycle detail, not absence of the ranger. |
| C6 | Coverage claims pp. 3, 18-20 lack calculation/data definitions | Define spatial denominator, time window and neglected areas. A grid is our choice, not a UML requirement. |
| C7 | Patrol sequence p. 21 omits manager assignment/GPS polling loop and draws local backup as a return | Add assignment, tracking loop and explicit local persistence/sync sequences. |
| C8 | Incident sequence p. 14 models optional photo and online/offline paths but not later retry/conflict recovery | Retain these strengths; add reconnect/media/storage failure and retained-form behavior. |
| C9 | Analytics p. 6 permits skipping export but makes download an unconditional postcondition | Make download conditional. Preserve no-data, timeout and export-failure paths. |
| C10 | Patrol pp. 18-20 assumes online operation/central persistence while allowing offline completion | Permit prepared offline operation, with central persistence after sync. Explicitly justify prototype battery/encryption changes. |
| C11 | Class diagram p. 3 mixes a collar-to-alert dependency with multiplicities; planned/recorded waypoints are ambiguous | Define a clear association and distinguish route geometry from session observations. Returning Waypoint references does not prove double composition. |
| C12 | Analytics sequence p. 7 has inconsistent numbering; Jayakodi's p. 4 header repeats Rathnayaka's number | Correct notation/presentation and identity inconsistencies; do not infer patrol authorship. |

Interaction strengths include incident GPS lock/accuracy feedback on pp. 16-17, patrol precision/offline feedback on p. 24, optional evidence, and the KPI/filter layout on pp. 9-10. Preserve them.

Interaction improvements:

- Replace the offline map-download dialog on p. 17 with an incident-save confirmation.
- Use Sri Lankan sample context consistently; patrol pp. 23-24 and monitoring pp. 29-30 use nonlocal places, coordinates or wildlife.
- Add GPS failure/retry, empty/error, failed-sync and end-patrol confirmation states. Do not claim success-state GPS accuracy is missing.
- Measure legibility, contrast and touch targets on actual screens; scaled PDFs cannot establish measured failures.
- Explain/remove the analytics confidence percentage and design the heatmap state.
- Separate report source from category: a ranger can report crop damage. Species/severity are enhancements, not proof the original form is invalid.

## 4. Improved design and traceability

1. Preserve the four business use cases. Associate manager and researcher with analytics; shared access alone does not justify inheritance or require matching domain classes.
2. Specify community intake, camera review and ranger response with actors/scenarios. Use include/extend only where semantics fit. Deferred network synchronization must not be required to complete an offline save.
3. Model entities/states from the implementation plan. Services improve testability; controller/entity calls alone are not invalid UML, and two related operations do not establish a God class.
4. Draw four primary sequence diagrams with supporting fragments/diagrams for all retained alternate/exception paths. Correct loops, conditions, lifelines and creation/return notation.
5. Treat Ministry as an external report recipient unless direct interaction is implemented. Make manager/ranger patrol responsibilities explicit.
6. Agree scenarios/wireframes before implementing the corresponding flows; keep report and code synchronized after justified changes.

The prior review checked [OMG composition semantics](https://www.omg.org/spec/UML/2.5/PDF) and [Include semantics](https://www.omg.org/spec/UML/ISO/19505-2/PDF): references are not composite ownership, and included behavior executes within its including behavior rather than being deferred until later connectivity.

Create `docs/traceability.md` during implementation. Each flow needs source/page, retained/changed decision, justification/critique ID, improved scenario/diagram, UI/API, owner and test/evidence.

| Owner | Source flow groups | Required evidence |
|---|---|---|
| M1 | G39 pp. 11-14: online/offline, auto-sync, no photo, GPS/camera/storage failure | Save/sync/recovery/error tests; community/camera additions mapped to C1/C2 |
| M2 | G39 pp. 18-21: assign/reassign, track/end, skipped manual waypoint, offline, unavailable ranger, GPS loss, battery | Offline preparation, assignment/recovery/coverage/battery tests |
| M3 | G39 pp. 25-27: breach/immobility, dispatch/acknowledgment, low severity, safe return, signal loss, no unit | Rule/state tests, audit history, dispatch/broadcast demonstration |
| M4 | G39 pp. 4-7: reports/filters, heatmap, conflicts, optional export, no data, timeout/export error | Aggregation/export assertions, preserved filters/report, query audit |

These groups are a starting checklist; expand into individual flow rows.

## 5. Architecture and technical contract

Use Neon PostgreSQL with PostGIS for shared development, retaining local Docker PostGIS as a fallback. See [Neon setup](./docs/neon-setup.md). The hosted option runs the same three apps through `docker-compose.neon.yml`; only the database host changes. The private connection URL and PostGIS enablement must be supplied before verifying live connectivity.

Keep the existing TypeScript/pnpm architecture: three apps (@wr/api, @wr/ranger, @wr/ops), three shared packages (@wr/shared, @wr/ui, @wr/offline), and four Compose services (db, api, ranger, ops). Preserve current imports, startup scripts, ports, app routers and module folders. This plan extends the repository; it does not replace or re-scaffold it.

Fastify, React/Vite, Drizzle/postgres, Dexie, Leaflet/Recharts and Vitest are declared dependencies; an outbox, DB schema, business routes, SSE and exporters are still future implementation. Do not equate a declared dependency with a completed feature. Proposed data entities/endpoints describe required behavior, not a mandatory new table/service for every name.

```text
apps/api/src/core/              configuration, errors, DB, clock, events
apps/api/src/server.ts          existing createServer and health route
apps/api/src/index.ts           existing startup
apps/api/src/modules/reference/ existing reserved reference/config module
apps/api/src/modules/incidents/ M1
apps/api/src/modules/patrols/   M2
apps/api/src/modules/alerts/    M3
apps/api/src/modules/analytics/ M4
apps/api/drizzle/               existing reserved schema/migration location
apps/ranger/                   mobile PWA (M1/M2/M3 screens)
apps/ops/                      desktop dashboard
packages/shared/               contracts, validation, enums, geo helpers
packages/ui/                   shared components
packages/offline/              Ranger persistence and sync
tools/                         reserved scripts/assets, not workspace packages
docs/                          planned diagrams, traceability, report assets, AI log
```

[Group037_Implementation_Plan.md](./Group037_Implementation_Plan.md) maps each planned capability onto existing code and separates the verified baseline from proposed additions. Reuse current Clock, AppError, Role, IncidentStatus and Coordinates contracts. Keep React hooks in Ranger, generic offline logic in @wr/offline, and common maps/components in @wr/ui. Community/camera workflows remain inside incidents; collars/dispatch remain inside alerts. No extra app, microservice, queue broker or database is required.

Implement planned APIs through createServer and the reserved modules. Consolidate logical entities into a small Drizzle schema where sensible. Reuse Fastify injection tests; add only dependencies actually needed for missing export/coverage/offline-test capabilities. Preserve existing commands and document future migration/seed/simulator commands only after they exist and work. Use patterns where useful; pattern counts or arbitrary function-length limits do not establish quality.

Demonstrate flexibility by switching Yala/Sinharaja configurations, showing changed types/species, zones and at least one workflow or threshold setting. Label synthetic seed data as demo data.

## 6. Schedule and completion gates

The 5 October review found app/API shells, not finished business modules. Verify foundation exit criteria. Dates are targets; defer optional extras before changing required flows.

| Date (2026) | Work and gate |
|---|---|
| Mon 5 Oct | Record owners; agree corrected scenarios/wireframes/contracts; finish migrations, seed, role switcher and tested offline foundation; start core flows |
| Tue 6 Oct | Complete core workflows and original alternate/exception paths; integrate data and write meaningful tests |
| Wed 7 Oct | Target feature freeze: integrated demos, >80% coverage per use case, report design consistent with implementation |
| Thu 8 Oct | Fix defects, rehearse clean-clone setup, capture actual UI/coverage evidence, assemble report and AI appendix |
| Fri 9 Oct | Final verification; tag and record SHA; submit around 6 PM for buffer before official 11:59 PM deadline |

## 7. Team workflow and testing

- Use module branches and small reviewed PRs. Coordinate shared contracts and preserve member attribution.
- Each member supplies API/UI work, agreed flows, meaningful tests, screenshots and report contributions.
- Target **>80% line and branch coverage per use case**; implement an 85% threshold as margin. Include untested sources and report each member's API/UI/domain scope, plus shared offline coverage separately. A combined API-package percentage is insufficient.
- Coverage enforcement remains to be implemented; reviewed Vitest/CI files did not enforce it. Positive/negative/edge/error assertions matter as well as percentage.
- Verify offline persistence, restart, reconnect, media retries and stale-update rejection.
- Keep exact AI prompts in `docs/ai-prompts.md` and include them in the appendix. Do not invent missing historical prompts.

## 8. Report and release checklist

1. Cover: Group 037, verified campus/member numbers and reviewed Group 039.
2. Executive summary and requirement-coverage matrix.
3. Functional critique with strengths/weaknesses and source pages.
4. Interaction critique with evidence and testable concerns.
5. Improvements: problem -> justification -> revised diagrams/scenarios/UI -> implementation/tests.
6. Per-member screenshots, flow descriptions, relevant patterns and individual coverage evidence.
7. GitHub URL, release tag and exact commit SHA.
8. All AI prompts in the appendix.

Before submission: verify clean-clone startup/migrations/seed, lint/typecheck/tests and coverage; run the implementation demo/failure checklist; check report/code/UI agreement; freeze and demonstrate the submitted commit.

## 9. Open ownership details and status

Record actual M1-M4 allocations, report assembler and release coordinator. Verify team environments and cover details. These are human ownership decisions, not a requirement to pause technical work.

These corrected plans do not claim that features, diagrams, tests or the report are finished. [Group037_Plan_Review.md](./Group037_Plan_Review.md) records historical findings using pre-correction line references.
