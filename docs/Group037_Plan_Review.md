# Group 037 plan review

Reviewed: 5 October 2026 (Asia/Colombo).

**Verdict: the four-use-case direction fits Assignment 02, but the plans need corrections before being used as the implementation contract or copied into the report.** The largest risks are inaccurate critique claims, expanded scope without complete data contracts, and an optimistic schedule based on an unfinished foundation.

This is a review, not a replacement plan. The existing plans and application code were not changed.

## Evidence and interpretation

Read order: `CSSE/prompt.txt`, the four PDFs in `CSSE`, then the three root Markdown files. Text was extracted from the PDFs, and Group 039's UML diagrams, storyboards, and low/high-fidelity wireframes were visually inspected. A limited code/configuration check was used to distinguish planned features from existing scaffolding; no build or tests were run.

- `CSSE/prompt.txt`: campus FAQ, review allocation, report/submission instructions, and permission to mock IoT/ML. Its embedded request to start development is historical context; this review follows the current request to check the plans.
- `CSSE/SE3070 - Case Study Assignment 02 Specification.pdf`, pp. 1-4: assessment requirements and rubric. Treat this and the campus FAQ as the supplied assessment baseline, not as independently authenticated current campus notices.
- `CSSE/Case study 01.pdf`, pp. 1-3: domain requirements; the document explicitly acknowledges ambiguity.
- `CSSE/Group_039.pdf`, pp. 1-30: the received design to critique and preserve where sound. It is not authoritative evidence that a design choice is correct.
- `CSSE/Group_037.pdf`, pp. 1-30: the team's earlier design. Useful background, but it does not replace Group 039 as the review target.

## What is already right

1. Keep Group 039's four substantial use cases: incident reporting, patrol management, wildlife/collar monitoring, and conservation analytics/reporting. Allocate one to each Group 037 member.
2. The mark breakdown is right: group critique/improvements 30; individual implementation 30, code quality 20, testing 20.
3. The report outline covers the required diagrams, justified improvements, screenshots with flow descriptions, repository URL, cover details, and AI-prompt appendix.
4. Offline ranger storage and automatic synchronization, park-specific configuration, community reporting, and camera-image review all have a basis in the case study. Their implementation depth should be controlled.
5. Mock collar/camera hardware and a simulated SMS gateway are sensible prototype choices. Preserve and implement the business behavior around these mocks.
6. The planned analytics empty/timeout/export-failure flows match Group 039 well. The incident and patrol plans also preserve many important failure paths.
7. A role switcher keeps attention on assessed business functionality. Login/logout/privilege administration are not graded use cases.

## Priority 1: correct the critique before using it in the report

References below use the existing plan line numbers at review time.

| Plan claim | Evidence/problem | Correction |
|---|---|---|
| Assignment plan line 84: nothing shows GPS accuracy | Group 039 p. 16 shows accuracy and GPS lock; p. 17 repeats it; p. 24 shows GPS precision. | Acknowledge existing success-state feedback. Critique missing failure/retry screens instead. |
| Lines 56, 58: community reporting is missing; offline synchronization is not a first-class use case | Villager participates in the p. 2 use-case diagram; conflict analytics consumes villager reports on p. 5. Incident offline save and automatic sync are explicit on p. 12; patrol caching is on p. 19. | Say community intake/response is **under-specified**, and sync recovery/conflicts are **under-specified**. Lack of a separate sync use-case oval is not itself a defect. |
| Line 67: returning `List<Waypoint>` proves two composition owners | The class diagram p. 3 shows composition from PatrolSession to Waypoint. A method returning references does not establish another composition owner. | Describe ambiguity between planned route points and recorded observations. Separate `RoutePoint` if useful, but do not claim a proven double-composition violation. |
| Lines 63, 67, 91: Researcher needs a class/generalization with Park Manager | An actor is a role; a matching domain class is not automatically required. Sharing analytics access does not make one role a specialization of the other. | Associate both actors with analytics, or use a justified common actor. Model persistence/permissions only where needed. |
| Line 67: `SensorAlert -> AnimalCollar` dependency is reversed | The p. 3 dashed arrow points from AnimalCollar toward SensorAlert. | Correct the description. Critique the ambiguous mixture of a dependency, `triggers` label, and multiplicities; define a clear persistent collar-alert association. |
| Lines 66, 71-72: plain actor associations and controller/entity calls are UML errors | These constructs alone do not prove invalid UML. The incident p. 14 `opt` photo fragment also agrees with the optional-photo alternate flow. | Separate UML notation defects from architectural preferences. Justify application-service boundaries through coupling and testability. |
| Line 75: patrol scenario explicitly names Park Manager as primary actor | Group 039 pp. 18-20 describe both manager and ranger but do not contain an explicit primary-actor declaration. | Say actor responsibilities should be made explicit. |
| Line 82: Crop Damage is inappropriate in a ranger form | Rangers can observe crop damage too. Report source and incident category are different concepts. | Keep the category if useful; define who reports and responds. Severity/species fields are proposed improvements, not automatically original requirements. |
| Lines 62, 67: no grid means coverage cannot be derived; two analytics operations make a God class | Other spatial representations can compute coverage; two related operations alone do not establish a God class. | Critique missing coverage definition, spatial/time data, and responsibility boundaries with concrete examples. |

The composition interpretation follows the [OMG UML composition semantics](https://www.omg.org/spec/UML/2.5/PDF): a part has at most one composite owner at a time; returning a reference is not ownership. The proposed unconditional `<<include>> Sync Offline Data` also needs care: included behavior is executed as part of the including behavior, whereas actual synchronization may happen later after reconnect. Use scenario/sequence descriptions for deferred synchronization, or include a clearly named local persistence/enqueue operation. See [OMG's published Include semantics](https://www.omg.org/spec/UML/ISO/19505-2/PDF).

Other critique wording to improve:

- Group 039 already includes ranger participation in monitoring on p. 2. The gap is the detailed response/closure workflow, not complete absence of the ranger.
- Its normal dispatch scenario broadcasts to active units (p. 26), while the storyboard refers to a nearest unit (p. 28). Critique this inconsistency; choosing one ranger is an improvement, not a universal requirement.
- Keep the useful Sri Lankan-context criticism, missing camera-review design, weak park/zone modeling, incomplete patrol sequence, and wrong incident-save confirmation screen.
- The exact touch-target size and contrast cannot be established from scaled PDF screenshots. Describe a usability concern pending measurement rather than a proven accessibility failure. Storyboard clothing is a lower-value point than missing workflows.
- The incident sequence's `SYNCED`/`PENDING_OFFLINE` states versus the class diagram's Boolean `syncStatus` is a concrete cross-diagram inconsistency worth prioritizing.
- Group 039's analytics postcondition says an export is downloaded even though its alternate flow allows skipping export (pp. 6-7). Make that postcondition conditional. The patrol online precondition and unconditional central-storage postcondition also need reconciliation with offline completion (pp. 18-20).
- Group 039 lists three members, but the patrol section has no explicit author header. Do not assert that Wijesundara authored both sections without confirmation. The incorrect registration number in Jayakodi's header is directly visible.

## Priority 2: close implementation-contract gaps

| Finding | Location | Required clarification/fix |
|---|---|---|
| SMS accepts a landmark, but incident processing expects a location suitable for a map | Implementation plan lines 120, 285-287 | Store raw text/landmark and a location-resolution state. Resolve known seeded landmarks, or send unresolved reports to liaison review. Do not reject valid text-only reports or invent precise coordinates. |
| Conflict inbox promises assignment, outcomes, and response-time analytics without matching data/API definitions | Lines 120, 132, 154-164, 265, 308 | Define incident response assignee, assignment/response/resolution timestamps, outcome notes, and allowed mutations. Existing dispatches reference alerts, so they do not automatically cover community incidents. Define the response-time calculation and treatment of unanswered reports. |
| Offline data store omits assigned routes, assignments, and explicit map preparation | Lines 209-219 | Persist route geometry, assignment, and park reference data before departure. Define a download/readiness step and a tile-independent map fallback. Caching tiles already viewed does not establish coverage of an entire future patrol route. |
| UUID upsert is treated as sufficient for safe synchronization | Lines 139, 173, 210-216 | Specify unique identities for track points, waypoints, media, and operations; atomic record-plus-outbox writes; server acknowledgments; and revision/conflict handling. Retrying an old incident must not reset its manager-updated status. Retry media uploads without duplication. |
| Signal-loss rule sits in ping processing | Line 297 | A collar that stops sending pings cannot trigger its own rule through a new ping. Add a scheduled stale-collar scan with a controllable clock and tests where no further ping arrives. |
| Alert and dispatch transitions are incomplete | Lines 102-103, 185-188, 297-305 | Define what happens to outstanding dispatches when the alert is cancelled or auto-resolved. Prevent late acceptance from reopening a terminal alert; make rejection/timeouts reassignable. Limit safe-zone auto-resolution to the applicable breach condition, not unrelated battery/immobility alerts. |
| Person in camera image automatically produces a HIGH incident | Line 288 | A person may be a ranger, tourist, or staff member. Create a review candidate or require a reviewer classification before labeling suspicious activity. This can remain fully simulated. |
| Photo requirement can block an original alternate flow | Lines 118, 285 | Preserve Group 039's no-photo and camera/storage-failure submission flows. Define an explicit override if a park normally requests photo evidence. |
| Original low-battery/encrypted-storage behavior is silently weakened | Group 039 pp. 19-20 versus implementation lines 209-219, 293 | Record a justified design change: what is simulated, when autosave/termination occurs, and whether encrypted local storage is retained. Merely selecting IndexedDB does not specify encryption. |
| Alert history and nearest-settlement UI lack explicit supporting contracts | Lines 115, 131-132, 183, 270 | Define settlements or identify which configured zones serve that purpose. Add timestamped alert/dispatch transition history, including manager acknowledgment and operational notes, as required by Group 039 p. 26. |

Also define whether live patrol positions are synchronized while a session is active. Nearest-ranger selection and live coverage cannot depend solely on an upload after patrol completion. Stale positions should be labeled and excluded or clearly qualified in proximity suggestions.

For each use case, add a traceability table: **original PDF page/flow -> retained or changed with justification -> improved scenario/diagram -> UI/API -> acceptance test -> owner**. This is more valuable than adding further features.

## Priority 3: make scope and completion evidence realistic

The assignment prioritizes complete, maintainable selected use cases over broad low-quality scope. The assignment plan's statement that the design is thin and therefore should be made bigger (line 36) is the wrong priority.

- Keep all four original use cases and their relevant main, alternate, and exception flows, subject to explicitly justified corrections.
- Keep community intake, camera review, and park flexibility small but demonstrable because the case study requests them. A seeded SMS/landmark flow and simple review queue are enough to begin with.
- Treat duplicate detection, elaborate repeat-site analytics, extra presentation themes, and advanced replay/polish as lower priority unless committed in the improved design. Group 039's wireframes already show CSV and PDF export, so reducing export formats also needs an explicit design decision.
- Assign actual names/registration numbers to M1-M4, plus shared offline/integration ownership and report assembly. M1 currently carries especially heavy shared and additional scope.
- Draft and agree the improved wireframes/scenarios before implementation diverges. The current timeline schedules UI v2 wireframes late, alongside screenshots, despite requiring implementation to follow the design.
- Target **more than 80%** meaningful coverage per member's use case for the rubric's Excellent band. The plans mix `>80%` and `>=80%`. Package-level totals alone cannot demonstrate individual use-case coverage when all four API modules share a package.

The current `vitest.config.ts` has no coverage configuration or thresholds, and `.github/workflows/ci.yml` runs tests without an explicit coverage command. Implementation plan line 331 describes future work, not an existing enforcement mechanism.

The README accurately describes a foundation with domain modules, migrations, seed data, and simulators still unfinished. The observed repository supports that description. Do not assume Phase 0 is complete merely because app shells and Docker files exist; its own exit criteria include seeded data and tested offline behavior.

As of 5 October, rebaseline the schedule against actual completion. Keep 7 October as a target for integrated core flows only if feasible; reserve 8 October for report assembly, screenshots, and fixes, and 9 October for clean-clone verification and submission. Avoid solving a late integration problem by deleting an original exception flow without justification.

## Root-document consistency fixes

1. Assignment plan lines 143-147 still show `apps/web/ranger` and `apps/web/ops`; the implementation plan and repository use separate `apps/ranger` and `apps/ops`.
2. Assignment plan line 2 says "Today: Sun 4 Oct". The review date is Monday 5 October 2026. Keep the fixed deadline, remove the aging "today"/days-left wording or label it as the original plan date.
3. README project status includes authentication among pending implementations, while both plans explicitly exclude authentication. Replace that with the planned demo role switcher.
4. The incident lifecycle summary omits `IN_PROGRESS`, and the assignment plan mixes rejected alerts with rejected dispatches. Use one canonical state-transition definition.
5. Replace unsupported claims of verified authorship and categorical UML defects before report drafting. Record page references for every retained critique.
6. Log AI prompts now and include the actual prompts used in the final report appendix. Record the final release commit as well as the tag; demonstrate that exact submitted version and honor the stated repository freeze.

## Recommended decision

Proceed with the same four use cases and the existing separate Ranger/Ops/API structure. First correct the critique, define the missing data/state/offline contracts, assign ownership, and agree a smaller mandatory scope. Then implement each agreed scenario with its tests and keep the improved report design synchronized with the implementation.
